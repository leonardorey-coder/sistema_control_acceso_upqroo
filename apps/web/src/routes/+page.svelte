<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type {
    AdminRowPayload,
    AdminSessionPayload,
    AdminSessionRowPayload,
    AttendanceRowPayload,
    AuditLogRowPayload,
    CareerRowPayload,
    HotQrRowPayload,
    OperationalConfigPayload,
    PersonCredentialRowPayload,
    PersonRowPayload,
    PersonTypeRowPayload,
    SignedQrConfigPayload,
    TemporaryDailyQrRowPayload,
    VehiclePermitRowPayload,
    VehicleRowPayload
  } from "@control-acceso/shared";
  import AdminShell from "$lib/components/AdminShell.svelte";
  import AccessTab from "$lib/components/AccessTab.svelte";
  import AdminsTab from "$lib/components/AdminsTab.svelte";
  import AttendanceTab from "$lib/components/AttendanceTab.svelte";
  import ConfigTab from "$lib/components/ConfigTab.svelte";
  import EditPersonTab from "$lib/components/EditPersonTab.svelte";
  import GeneratorTab from "$lib/components/GeneratorTab.svelte";
  import HotQrTab from "$lib/components/HotQrTab.svelte";
  import LoginCard from "$lib/components/LoginCard.svelte";
  import VehiclesTab from "$lib/components/VehiclesTab.svelte";
  import { apiBaseUrl, apiRequest, toQuery, type PaginatedRows } from "$lib/api/client";
  import type { PageData } from "./$types";

  type Row = Record<string, unknown>;
  type DynamicQrResult = {
    token: string;
    expiresAt: string;
    refreshAfterMs: number;
    jti: string;
  };
  type EventTopic =
    | "access.scan"
    | "access.table"
    | "attendance.table"
    | "hot-qr.table"
    | "credentials.table"
    | "temporary-daily-qr.table"
    | "vehicles.table"
    | "vehicle-permits.table"
    | "admins.table"
    | "admin-sessions.table"
    | "audit.table"
    | "config.table";
  type EventMessage = {
    topic: EventTopic;
    payload?: Row;
    emittedAt?: string;
  };
  type Session = AdminSessionPayload;

  let { data }: { data: PageData } = $props();

  let activeTab = $state("generator");
  let session = $state<Session | null>(null);
  let loginIdentity = $state("");
  let loginPassword = $state("");
  let loginError = $state("");
  let notice = $state("");
  let passwordNotice = $state("");
  let passwordError = $state("");
  let passwordForm = $state({ currentPassword: "", newPassword: "" });
  let generatedToken = $state("");
  let generatedTitle = $state("");

  let accessRows = $state<Row[]>([]);
  let accessTotal = $state(0);
  let attendanceRows = $state<Array<AttendanceRowPayload & Row>>([]);
  let attendanceTotal = $state(0);
  let peopleRows = $state<Array<PersonRowPayload & Row>>([]);
  let personTypeRows = $state<Array<PersonTypeRowPayload & Row>>([]);
  let careerRows = $state<Array<CareerRowPayload & Row>>([]);
  let credentialRows = $state<Array<PersonCredentialRowPayload & Row>>([]);
  let temporaryQrRows = $state<Array<TemporaryDailyQrRowPayload & Row>>([]);
  let hotQrRows = $state<Array<HotQrRowPayload & Row>>([]);
  let vehicleRows = $state<Array<VehicleRowPayload & Row>>([]);
  let permitRows = $state<Array<VehiclePermitRowPayload & Row>>([]);
  let adminRows = $state<Array<AdminRowPayload & Row>>([]);
  let adminSessionRows = $state<Array<AdminSessionRowPayload & Row>>([]);
  let adminAuditRows = $state<Array<AuditLogRowPayload & Row>>([]);
  let subjectRows = $state<Row[]>([]);
  let scheduleRows = $state<Row[]>([]);
  let configForm = $state<OperationalConfigPayload>({
    retryEnabled: true,
    retryDelayMs: 1200,
    cameraEnabled: true,
    manualEntryEnabled: true,
    soundsEnabled: true,
    autoExitEnabled: true
  });
  let signedQrConfigForm = $state<SignedQrConfigPayload>({
    enabled: false,
    ttlSeconds: 30,
    clockToleranceSeconds: 5,
    compatibilityOpaqueTokens: true,
    requireDeviceBinding: false
  });

  let filters = $state({
    q: "",
    date: new Date().toISOString().slice(0, 10),
    page: 1,
    pageSize: 25,
    personType: "",
    accessMode: "",
    status: "",
    subject: "",
    careerId: "",
    hotQrStatus: "",
    vehicleStatus: ""
  });

  let personForm = $state({
    matricula: "",
    nombres: "",
    apellidos: "",
    curp: "",
    tipoPersona: "estudiante",
    carreraId: "",
    estado: "activo",
    notas: "",
    expiresAt: ""
  });

  let editMatricula = $state("");
  let editPerson = $state<(PersonRowPayload & Row) | null>(null);
  let temporaryQrForm = $state({
    personId: "",
    operationalDate: new Date().toISOString().slice(0, 10),
    missingCredentialType: "personal_qr",
    reasonCode: "credential_unavailable",
    reasonText: "",
    maxUses: 10,
    validUntil: ""
  });
  let hotQrForm = $state({ visitorName: "", reason: "", minutes: 60 });
  let vehicleForm = $state({ ownerPersonId: "", plate: "", make: "", model: "", color: "" });
  let permitForm = $state({ personId: "", vehicleId: "", validUntil: "" });
  let adminForm = $state({ username: "", displayName: "", email: "", role: "admin", temporaryPassword: "" });
  let adminEditForm = $state({
    id: "",
    username: "",
    displayName: "",
    email: "",
    role: "admin",
    status: "active",
    mustChangePassword: false
  });
  let auditFilters = $state({ q: "", action: "", entityType: "", from: "", to: "" });
  let subjectForm = $state({ clave: "", nombre: "" });
  let scheduleForm = $state({ personId: "", subjectId: "", weekday: 1, horaInicio: "08:00", horaFin: "09:00", aula: "", validFrom: new Date().toISOString().slice(0, 10), validUntil: "" });

  const tabs = [
    { id: "generator", label: "Generar QR" },
    { id: "edit", label: "Editar" },
    { id: "access", label: "Registros" },
    { id: "attendance", label: "Asistencias" },
    { id: "hotqr", label: "Hot-QR" },
    { id: "vehicles", label: "Vehiculos" },
    { id: "admins", label: "Administradores" },
    { id: "config", label: "Configuracion" }
  ];

  const apiOnline = $derived(Boolean(data.health));
  let eventsSocket: WebSocket | null = null;
  let eventsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let eventsReconnectDelay = 1000;
  let eventsShouldReconnect = false;

  function closeEventsSocket() {
    eventsShouldReconnect = false;
    if (eventsReconnectTimer) clearTimeout(eventsReconnectTimer);
    eventsReconnectTimer = null;
    eventsSocket?.close();
    eventsSocket = null;
  }

  function connectEventsSocket() {
    closeEventsSocket();
    eventsShouldReconnect = true;
    eventsSocket = new WebSocket(`${apiBaseUrl.replace(/^http/, "ws")}/api/v1/events`);

    eventsSocket.addEventListener("open", () => {
      eventsReconnectDelay = 1000;
    });

    eventsSocket.addEventListener("message", (event) => {
      let message: EventMessage;

      try {
        message = JSON.parse(event.data) as EventMessage;
      } catch {
        return;
      }

      if (message.topic === "access.scan" || message.topic === "access.table") refreshAccess();
      if (message.topic === "access.scan" || message.topic === "attendance.table") refreshAttendance();
      if (message.topic === "hot-qr.table") refreshHotQr();
      if (message.topic === "credentials.table") refreshCredentials();
      if (message.topic === "temporary-daily-qr.table") refreshTemporaryQr();
      if (message.topic === "vehicles.table") refreshVehicles();
      if (message.topic === "vehicle-permits.table") refreshPermits();
      if (message.topic === "admins.table" || message.topic === "audit.table") refreshAdmins();
      if (message.topic === "admin-sessions.table") {
        refreshAdmins();
        adminSessionRows = [];
      }
      if (message.topic === "config.table") refreshConfig();
    });

    eventsSocket.addEventListener("close", () => {
      if (!session || !eventsShouldReconnect) return;
      eventsReconnectTimer = setTimeout(connectEventsSocket, eventsReconnectDelay);
      eventsReconnectDelay = Math.min(eventsReconnectDelay * 2, 15000);
    });
  }

  async function login() {
    loginError = "";
    try {
      session = await apiRequest<Session>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ identity: loginIdentity, password: loginPassword })
      });
      loginPassword = "";
      await refreshAll();
      connectEventsSocket();
    } catch (error) {
      loginError = error instanceof Error ? error.message : "No se pudo iniciar sesion";
    }
  }

  async function logout() {
    await apiRequest("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
    closeEventsSocket();
    session = null;
  }

  async function loadSession() {
    try {
      session = await apiRequest<Session>("/api/v1/auth/me");
      await refreshAll();
      connectEventsSocket();
    } catch {
      session = null;
    }
  }

  async function refreshAccess() {
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/access/today${toQuery({
      q: filters.q,
      date: filters.date,
      page: filters.page,
      pageSize: filters.pageSize,
      personType: filters.personType,
      accessMode: filters.accessMode,
      status: filters.status
    })}`);
    accessRows = result.rows;
    accessTotal = result.total;
  }

  async function refreshAttendance() {
    const result = await apiRequest<PaginatedRows<AttendanceRowPayload & Row>>(`/api/v1/attendance/today${toQuery({
      q: filters.q,
      date: filters.date,
      page: filters.page,
      pageSize: filters.pageSize,
      subject: filters.subject,
      status: filters.status,
      careerId: filters.careerId
    })}`);
    attendanceRows = result.rows;
    attendanceTotal = result.total;
  }

  async function refreshPeople() {
    const result = await apiRequest<PaginatedRows<PersonRowPayload & Row>>(`/api/v1/people${toQuery({ q: filters.q, personType: filters.personType, status: filters.status, careerId: filters.careerId, page: filters.page, pageSize: filters.pageSize })}`);
    peopleRows = result.rows;
  }

  async function refreshPersonTypes() {
    personTypeRows = (await apiRequest<{ rows: Array<PersonTypeRowPayload & Row> }>("/api/v1/person-types")).rows;
  }

  async function refreshCareers() {
    careerRows = (await apiRequest<{ rows: Array<CareerRowPayload & Row> }>("/api/v1/careers")).rows;
  }

  async function refreshCredentials(personId = editPerson?.id ? String(editPerson.id) : "") {
    if (!personId) {
      credentialRows = [];
      return;
    }
    credentialRows = (await apiRequest<{ rows: Array<PersonCredentialRowPayload & Row> }>(`/api/v1/credentials/person/${personId}`)).rows;
  }

  async function refreshTemporaryQr() {
    temporaryQrRows = (await apiRequest<{ rows: Array<TemporaryDailyQrRowPayload & Row> }>("/api/v1/credentials/temporary-daily")).rows;
  }

  async function refreshHotQr() {
    const result = await apiRequest<PaginatedRows<HotQrRowPayload & Row>>(`/api/v1/hot-qr/today${toQuery({ q: filters.q, status: filters.hotQrStatus, date: filters.date, page: filters.page, pageSize: filters.pageSize })}`);
    hotQrRows = result.rows;
  }

  async function refreshVehicles() {
    vehicleRows = (await apiRequest<PaginatedRows<VehicleRowPayload & Row>>(`/api/v1/vehicles${toQuery({ q: filters.q, status: filters.vehicleStatus, page: filters.page, pageSize: filters.pageSize })}`)).rows;
  }

  async function refreshPermits() {
    permitRows = (await apiRequest<PaginatedRows<VehiclePermitRowPayload & Row>>(`/api/v1/vehicles/permits${toQuery({ q: filters.q, page: filters.page, pageSize: filters.pageSize })}`)).rows;
  }

  async function refreshAdmins() {
    if (session?.admin.role !== "super_admin") return;
    adminRows = (await apiRequest<{ rows: Array<AdminRowPayload & Row> }>("/api/v1/admins")).rows;
    adminAuditRows = (await apiRequest<{ rows: Array<AuditLogRowPayload & Row> }>(`/api/v1/admins/audit${toQuery({
      q: auditFilters.q,
      action: auditFilters.action,
      entityType: auditFilters.entityType,
      from: auditFilters.from ? new Date(auditFilters.from).toISOString() : "",
      to: auditFilters.to ? new Date(auditFilters.to).toISOString() : ""
    })}`)).rows;
  }

  async function refreshConfig() {
    const result = await apiRequest<{ value?: Partial<OperationalConfigPayload> }>("/api/v1/config/operational");
    const signedQrResult = await apiRequest<{ value?: Partial<SignedQrConfigPayload> }>("/api/v1/config/signed-qr");
    configForm = { ...configForm, ...(result.value as Partial<typeof configForm> ?? {}) };
    signedQrConfigForm = { ...signedQrConfigForm, ...(signedQrResult.value as Partial<typeof signedQrConfigForm> ?? {}) };
  }

  async function refreshSubjects() {
    subjectRows = (await apiRequest<{ rows: Row[] }>("/api/v1/subjects")).rows;
  }

  async function refreshSchedules() {
    scheduleRows = (await apiRequest<{ rows: Row[] }>("/api/v1/schedules")).rows;
  }

  async function refreshAll() {
    await Promise.allSettled([
      refreshPersonTypes(),
      refreshCareers(),
      refreshAccess(),
      refreshAttendance(),
      refreshPeople(),
      refreshTemporaryQr(),
      refreshHotQr(),
      refreshVehicles(),
      refreshPermits(),
      refreshAdmins(),
      refreshConfig(),
      refreshSubjects(),
      refreshSchedules()
    ]);
  }

  async function changeAdminPassword() {
    passwordError = "";
    passwordNotice = "";
    try {
      await apiRequest("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm)
      });
      passwordForm = { currentPassword: "", newPassword: "" };
      if (session) {
        session = {
          ...session,
          admin: { ...session.admin, mustChangePassword: false }
        };
      }
      passwordNotice = "Password actualizado";
    } catch (error) {
      passwordError = error instanceof Error ? error.message : "No se pudo cambiar el password";
    }
  }

  async function createPersonAndQr(mode: "register" | "generate") {
    let personId = "";

    if (mode === "register") {
      const person = await apiRequest<PersonRowPayload & Row>("/api/v1/people", {
        method: "POST",
        body: JSON.stringify({
          matricula: personForm.matricula,
          nombres: personForm.nombres,
          apellidos: personForm.apellidos,
          curp: personForm.curp || undefined,
          tipoPersona: personForm.tipoPersona,
          carreraId: personForm.carreraId || undefined,
          estado: personForm.estado,
          notas: personForm.notas || undefined
        })
      });
      personId = String(person.id);
    } else {
      if (!personForm.matricula) {
        notice = "Capture una matricula para generar QR";
        return;
      }
      const person = await apiRequest<PersonRowPayload & Row>(`/api/v1/people/by-matricula/${personForm.matricula}`);
      personId = String(person.id);
    }

    const expiresAt = personForm.expiresAt ? new Date(personForm.expiresAt).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const result = await apiRequest<{ token: string }>("/api/v1/credentials/person", {
      method: "POST",
      body: JSON.stringify({ personId, expiresAt })
    });

    generatedToken = result.token;
    generatedTitle = "QR personal";
    notice = "QR generado";
    await Promise.allSettled([refreshPeople(), refreshCredentials(personId)]);
  }

  async function searchPerson() {
    editPerson = await apiRequest<PersonRowPayload & Row>(`/api/v1/people/by-matricula/${editMatricula}`);
    temporaryQrForm.personId = String(editPerson.id ?? "");
    permitForm.personId = String(editPerson.id ?? permitForm.personId);
    vehicleForm.ownerPersonId = String(editPerson.id ?? vehicleForm.ownerPersonId);
    await refreshCredentials(String(editPerson.id));
  }

  async function saveEditPerson() {
    if (!editPerson?.id) return;
    const payload = {
      matricula: String(editPerson.matricula ?? ""),
      nombres: String(editPerson.nombres ?? ""),
      apellidos: String(editPerson.apellidos ?? ""),
      curp: editPerson.curp ? String(editPerson.curp).toUpperCase() : undefined,
      tipoPersona: String(editPerson.tipoPersona ?? "estudiante"),
      estado: String(editPerson.estado ?? "activo"),
      carreraId: editPerson.carreraId ? String(editPerson.carreraId) : undefined,
      notas: editPerson.notas ? String(editPerson.notas) : undefined
    };
    await apiRequest(`/api/v1/people/${editPerson.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    notice = "Persona actualizada";
    await refreshPeople();
  }

  async function disableEditPerson() {
    if (!editPerson?.id) return;
    editPerson = await apiRequest<PersonRowPayload & Row>(`/api/v1/people/${editPerson.id}/disable`, { method: "POST" });
    notice = "Persona desactivada";
    await refreshPeople();
  }

  async function enableEditPerson() {
    if (!editPerson?.id) return;
    editPerson = await apiRequest<PersonRowPayload & Row>(`/api/v1/people/${editPerson.id}/enable`, { method: "POST" });
    notice = "Persona activada";
    await refreshPeople();
  }

  async function rotatePersonQr() {
    if (!editPerson?.id) return;
    const result = await apiRequest<{ token: string }>(`/api/v1/credentials/person/${editPerson.id}/rotate`, {
      method: "POST",
      body: JSON.stringify({ expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() })
    });
    generatedToken = result.token;
    generatedTitle = "QR personal rotado";
    await refreshCredentials(String(editPerson.id));
  }

  async function revokePersonQr() {
    if (!editPerson?.id) return;
    await apiRequest(`/api/v1/credentials/person/${editPerson.id}/revoke`, { method: "POST" });
    notice = "QR personal revocado";
    await refreshCredentials(String(editPerson.id));
  }

  async function uploadPersonPhoto(file: File) {
    if (!editPerson?.id) return;
    const body = new FormData();
    body.set("file", file);
    const result = await apiRequest<{ person: PersonRowPayload & Row }>(`/api/v1/people/${editPerson.id}/photo`, { method: "POST", body });
    editPerson = result.person;
    notice = "Foto actualizada";
  }

  async function createTemporaryQr() {
    const validUntil = temporaryQrForm.validUntil ? new Date(temporaryQrForm.validUntil).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString();
    const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/credentials/temporary-daily", {
      method: "POST",
      body: JSON.stringify({ ...temporaryQrForm, validUntil, maxUses: Number(temporaryQrForm.maxUses) })
    });
    await showTemporaryQr(result.credential, result.token);
    await refreshTemporaryQr();
  }

  async function showTemporaryQr(row: Row, fallbackToken = "") {
    try {
      const result = await apiRequest<DynamicQrResult>(`/api/v1/credentials/temporary-daily/${row.id}/dynamic`, { method: "POST" });
      generatedToken = result.token;
      generatedTitle = "QR temporal diario dinamico";
      notice = `QR temporal dinamico generado. Expira: ${new Date(result.expiresAt).toLocaleTimeString("es-MX")}`;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code && code !== "SIGNED_QR_DISABLED") throw error;
      generatedToken = fallbackToken;
      generatedTitle = "QR temporal diario";
      notice = "QR temporal generado en modo compatible";
    }
  }

  async function revokeTemporaryQr(row: Row) {
    await apiRequest(`/api/v1/credentials/temporary-daily/${row.id}/revoke`, { method: "POST" });
    await refreshTemporaryQr();
  }

  async function createHotQr() {
    const validUntil = new Date(Date.now() + Number(hotQrForm.minutes) * 60_000).toISOString();
    const result = await apiRequest<{ token: string }>("/api/v1/hot-qr", {
      method: "POST",
      body: JSON.stringify({
        visitorName: hotQrForm.visitorName,
        reason: hotQrForm.reason,
        validUntil
      })
    });
    generatedToken = result.token;
    generatedTitle = "Hot-QR";
    hotQrForm = { visitorName: "", reason: "", minutes: 60 };
    await refreshHotQr();
  }

  async function revokeHotQr(row: Row) {
    await apiRequest(`/api/v1/hot-qr/${row.id}/revoke`, { method: "POST" });
    await refreshHotQr();
  }

  async function createVehicle() {
    await apiRequest("/api/v1/vehicles", { method: "POST", body: JSON.stringify(vehicleForm) });
    vehicleForm = { ownerPersonId: "", plate: "", make: "", model: "", color: "" };
    await refreshVehicles();
  }

  async function createPermitQr() {
    const permit = await apiRequest<Row>("/api/v1/vehicles/permits", {
      method: "POST",
      body: JSON.stringify({
        personId: permitForm.personId,
        vehicleId: permitForm.vehicleId,
        validUntil: permitForm.validUntil ? new Date(permitForm.validUntil).toISOString() : undefined
      })
    });
    const result = await apiRequest<{ token: string }>(`/api/v1/vehicles/permits/${permit.id}/qr/rotate`, {
      method: "POST",
      body: JSON.stringify({
        expiresAt: permitForm.validUntil ? new Date(permitForm.validUntil).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString()
      })
    });
    await showDynamicPermitQr(permit, result.token);
    await Promise.allSettled([refreshPermits(), refreshVehicles()]);
  }

  async function showDynamicPermitQr(row: Row, fallbackToken = "") {
    try {
      const result = await apiRequest<DynamicQrResult>(`/api/v1/vehicles/permits/${row.id}/qr/dynamic`, { method: "POST" });
      generatedToken = result.token;
      generatedTitle = "QR vehicular dinamico";
      notice = `QR vehicular dinamico generado. Expira: ${new Date(result.expiresAt).toLocaleTimeString("es-MX")}`;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code && code !== "SIGNED_QR_DISABLED") throw error;
      generatedToken = fallbackToken;
      generatedTitle = "QR vehicular";
      notice = "QR vehicular generado en modo compatible";
    }
  }

  async function revokePermit(row: Row) {
    await apiRequest(`/api/v1/vehicles/permits/${row.id}/revoke`, { method: "POST" });
    await refreshPermits();
  }

  async function disableVehicle(row: Row) {
    await apiRequest(`/api/v1/vehicles/${row.id}/disable`, { method: "POST" });
    await refreshVehicles();
  }

  async function createAdmin() {
    const result = await apiRequest<{ temporaryPassword: string }>("/api/v1/admins", {
      method: "POST",
      body: JSON.stringify({
        ...adminForm,
        email: adminForm.email || undefined,
        temporaryPassword: adminForm.temporaryPassword || undefined
      })
    });
    notice = `Admin creado. Password temporal: ${result.temporaryPassword}`;
    adminForm = { username: "", displayName: "", email: "", role: "admin", temporaryPassword: "" };
    await refreshAdmins();
  }

  function selectAdminForEdit(row: AdminRowPayload & Row) {
    adminEditForm = {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      email: row.email ?? "",
      role: row.role,
      status: row.status,
      mustChangePassword: row.mustChangePassword
    };
  }

  async function updateAdmin() {
    if (!adminEditForm.id) return;
    await apiRequest(`/api/v1/admins/${adminEditForm.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        username: adminEditForm.username,
        displayName: adminEditForm.displayName,
        email: adminEditForm.email || undefined,
        role: adminEditForm.role,
        status: adminEditForm.status,
        mustChangePassword: adminEditForm.mustChangePassword
      })
    });
    notice = "Administrador actualizado";
    await refreshAdmins();
  }

  async function disableAdmin(row: Row) {
    await apiRequest(`/api/v1/admins/${row.id}/disable`, { method: "POST" });
    await refreshAdmins();
  }

  async function enableAdmin(row: Row) {
    await apiRequest(`/api/v1/admins/${row.id}/enable`, { method: "POST" });
    await refreshAdmins();
  }

  async function resetAdminPassword(row: Row) {
    const result = await apiRequest<{ temporaryPassword: string }>(`/api/v1/admins/${row.id}/reset-password`, { method: "POST", body: JSON.stringify({}) });
    notice = `Password temporal: ${result.temporaryPassword}`;
    await refreshAdmins();
  }

  async function loadAdminSessions(row: Row) {
    adminSessionRows = (await apiRequest<{ rows: Array<AdminSessionRowPayload & Row> }>(`/api/v1/admins/${row.id}/sessions`)).rows;
  }

  async function revokeAdminSession(row: Row) {
    if (!row.adminId || !row.id) return;
    await apiRequest(`/api/v1/admins/${row.adminId}/sessions/${row.id}/revoke`, { method: "POST" });
    adminSessionRows = adminSessionRows.filter((sessionRow) => sessionRow.id !== row.id);
  }

  async function saveConfig() {
    await apiRequest("/api/v1/config/operational", {
      method: "PATCH",
      body: JSON.stringify({ value: configForm })
    });
    notice = "Configuracion guardada";
  }

  async function saveSignedQrConfig() {
    await apiRequest("/api/v1/config/signed-qr", {
      method: "PATCH",
      body: JSON.stringify({ value: signedQrConfigForm })
    });
    notice = "Configuracion de QR firmado guardada";
  }

  async function createSubject() {
    await apiRequest("/api/v1/subjects", { method: "POST", body: JSON.stringify(subjectForm) });
    subjectForm = { clave: "", nombre: "" };
    await refreshSubjects();
  }

  async function createSchedule() {
    await apiRequest("/api/v1/schedules", {
      method: "POST",
      body: JSON.stringify({
        ...scheduleForm,
        weekday: Number(scheduleForm.weekday),
        aula: scheduleForm.aula || undefined,
        validUntil: scheduleForm.validUntil || undefined
      })
    });
    await refreshSchedules();
  }

  async function adjustAttendance(row: AttendanceRowPayload & Row, estado: "confirmed" | "partial" | "unverified") {
    if (!row.id) return;
    await apiRequest(`/api/v1/attendance/${row.id}/adjust`, {
      method: "PATCH",
      body: JSON.stringify({
        estado,
        reason: "Ajuste manual desde panel administrativo"
      })
    });
    notice = "Asistencia ajustada";
    await refreshAttendance();
  }

  onMount(() => {
    loadSession();
  });

  onDestroy(closeEventsSocket);
</script>

<svelte:head>
  <title>Panel Administrativo - Sistema de Acceso</title>
</svelte:head>

{#if !session}
  <LoginCard
    bind:identity={loginIdentity}
    bind:password={loginPassword}
    title="Acceso Administrativo"
    identityPlaceholder="Usuario o correo"
    passwordPlaceholder="Contrasena"
    error={loginError}
    onSubmit={login}
  />
{:else}
  <AdminShell
    {activeTab}
    {tabs}
    {session}
    {apiOnline}
    onTab={(id) => (activeTab = id)}
    onLogout={logout}
  >
    {#if notice}<p class="notice">{notice}</p>{/if}
    {#if session.admin.mustChangePassword}
      <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); changeAdminPassword(); }}>
        <h2>Cambiar password</h2>
        <p class="muted">Debes actualizar tu password antes de continuar con tareas sensibles.</p>
        {#if passwordNotice}<p class="notice">{passwordNotice}</p>{/if}
        {#if passwordError}<p class="error">{passwordError}</p>{/if}
        <input type="password" bind:value={passwordForm.currentPassword} placeholder="Password actual" required />
        <input type="password" bind:value={passwordForm.newPassword} placeholder="Nuevo password" minlength="8" required />
        <button>Actualizar password</button>
      </form>
    {/if}

    {#if activeTab === "generator"}
      <GeneratorTab
        {personForm}
        {personTypeRows}
        {careerRows}
        {generatedToken}
        {generatedTitle}
        {temporaryQrForm}
        temporaryRows={temporaryQrRows}
        onSubmit={createPersonAndQr}
        onCreateTemporaryQr={createTemporaryQr}
        onShowTemporaryQr={showTemporaryQr}
        onRevokeTemporaryQr={revokeTemporaryQr}
      />
    {/if}

    {#if activeTab === "edit"}
      <EditPersonTab
        bind:editMatricula
        {editPerson}
        {personTypeRows}
        {careerRows}
        credentialRows={credentialRows}
        {generatedToken}
        {generatedTitle}
        onSearch={searchPerson}
        onSave={saveEditPerson}
        onDisable={disableEditPerson}
        onEnable={enableEditPerson}
        onRotateQr={rotatePersonQr}
        onRevokeQr={revokePersonQr}
        onPhoto={uploadPersonPhoto}
      />
    {/if}

    {#if activeTab === "access"}
      <AccessTab rows={accessRows} total={accessTotal} {filters} {personTypeRows} onFilter={refreshAccess} />
    {/if}

    {#if activeTab === "attendance"}
      <AttendanceTab
        rows={attendanceRows}
        total={attendanceTotal}
        {filters}
        {careerRows}
        {subjectRows}
        {scheduleRows}
        {subjectForm}
        {scheduleForm}
        onFilter={refreshAttendance}
        onCreateSubject={createSubject}
        onCreateSchedule={createSchedule}
        onAdjustAttendance={adjustAttendance}
      />
    {/if}

    {#if activeTab === "hotqr"}
      <HotQrTab rows={hotQrRows} form={hotQrForm} {generatedToken} {generatedTitle} {filters} onCreate={createHotQr} onFilter={refreshHotQr} onRevoke={revokeHotQr} />
    {/if}

    {#if activeTab === "vehicles"}
      <VehiclesTab
        rows={vehicleRows}
        permitRows={permitRows}
        {vehicleForm}
        {permitForm}
        {peopleRows}
        {generatedToken}
        {generatedTitle}
        {filters}
        onCreateVehicle={createVehicle}
        onCreatePermitQr={createPermitQr}
        onCreateDynamicPermitQr={showDynamicPermitQr}
        onRevokePermit={revokePermit}
        onDisableVehicle={disableVehicle}
        onFilter={refreshVehicles}
      />
    {/if}

    {#if activeTab === "admins"}
      <AdminsTab
        rows={adminRows}
        form={adminForm}
        editForm={adminEditForm}
        auditFilters={auditFilters}
        isSuperAdmin={session.admin.role === "super_admin"}
        sessionRows={adminSessionRows}
        auditRows={adminAuditRows}
        onCreate={createAdmin}
        onSelect={selectAdminForEdit}
        onUpdate={updateAdmin}
        onDisable={disableAdmin}
        onEnable={enableAdmin}
        onResetPassword={resetAdminPassword}
        onLoadSessions={loadAdminSessions}
        onRevokeSession={revokeAdminSession}
        onFilterAudit={refreshAdmins}
      />
    {/if}

    {#if activeTab === "config"}
      <ConfigTab bind:config={configForm} bind:signedQrConfig={signedQrConfigForm} onSave={saveConfig} onSaveSignedQr={saveSignedQrConfig} />
    {/if}
  </AdminShell>
{/if}
