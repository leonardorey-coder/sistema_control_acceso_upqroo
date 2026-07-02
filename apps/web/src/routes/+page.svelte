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
    ScannerDeviceRowPayload,
    ScannerDevicesConfigPayload,
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
  import DismissibleNotice from "$lib/components/DismissibleNotice.svelte";
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
  type ImportSummary = {
    created: number;
    updated: number;
    issuedQr: number;
    skipped: number;
    errors: Array<{ row: number; code: string; message: string }>;
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

  function operatingDateValue(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Cancun",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

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
  let personalGeneratedToken = $state("");
  let personalGeneratedTitle = $state("");
  let editGeneratedToken = $state("");
  let editGeneratedTitle = $state("");
  let hotQrGeneratedToken = $state("");
  let hotQrGeneratedTitle = $state("");
  let vehicleGeneratedToken = $state("");
  let vehicleGeneratedTitle = $state("");
  let temporaryGeneratedToken = $state("");
  let temporaryGeneratedTitle = $state("");
  let temporaryQrError = $state("");

  let accessRows = $state<Row[]>([]);
  let accessTotal = $state(0);
  let attendanceRows = $state<Array<AttendanceRowPayload & Row>>([]);
  let attendanceTotal = $state(0);
  let peopleRows = $state<Array<PersonRowPayload & Row>>([]);
  let personTypeRows = $state<Array<PersonTypeRowPayload & Row>>([]);
  let careerRows = $state<Array<CareerRowPayload & Row>>([]);
  let credentialRows = $state<Array<PersonCredentialRowPayload & Row>>([]);
  let credentialTotal = $state(0);
  let temporaryQrRows = $state<Array<TemporaryDailyQrRowPayload & Row>>([]);
  let temporaryQrTotal = $state(0);
  let hotQrRows = $state<Array<HotQrRowPayload & Row>>([]);
  let hotQrTotal = $state(0);
  let vehicleRows = $state<Array<VehicleRowPayload & Row>>([]);
  let vehicleTotal = $state(0);
  let permitRows = $state<Array<VehiclePermitRowPayload & Row>>([]);
  let permitTotal = $state(0);
  let adminRows = $state<Array<AdminRowPayload & Row>>([]);
  let adminSessionRows = $state<Array<AdminSessionRowPayload & Row>>([]);
  let adminAuditRows = $state<Array<AuditLogRowPayload & Row>>([]);
  let adminAuditTotal = $state(0);
  let scannerDeviceRows = $state<Array<ScannerDeviceRowPayload & Row>>([]);
  let subjectRows = $state<Row[]>([]);
  let subjectTotal = $state(0);
  let scheduleRows = $state<Row[]>([]);
  let scheduleTotal = $state(0);
  let peopleOptionsCache: Array<PersonRowPayload & Row> | null = null;
  let vehicleOptionsCache: Array<VehicleRowPayload & Row> | null = null;
  const peopleOptionsByQuery = new Map<string, Array<PersonRowPayload & Row>>();
  const vehicleOptionsByQuery = new Map<string, Array<VehicleRowPayload & Row>>();
  const peopleOptionsPromises = new Map<string, Promise<Array<PersonRowPayload & Row>>>();
  const vehicleOptionsPromises = new Map<string, Promise<Array<VehicleRowPayload & Row>>>();
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
  let scannerDevicesConfigForm = $state<ScannerDevicesConfigPayload>({
    required: false
  });

  let filters = $state({
    q: "",
    date: operatingDateValue(),
    page: 1,
    pageSize: 10,
    personType: "",
    accessMode: "",
    status: "",
    subject: "",
    careerId: "",
    hotQrStatus: "",
    vehicleStatus: "",
    permitStatus: "",
    permitPersonId: "",
    permitVehicleId: ""
  });

  let temporaryPagination = $state({ page: 1, pageSize: 10 });
  let accessPagination = $state({ page: 1, pageSize: 10 });
  let attendancePagination = $state({ page: 1, pageSize: 10 });
  let vehiclePagination = $state({ page: 1, pageSize: 10 });
  let permitPagination = $state({ page: 1, pageSize: 10 });
  let hotQrPagination = $state({ page: 1, pageSize: 10 });
  let credentialPagination = $state({ page: 1, pageSize: 10 });
  let adminAuditPagination = $state({ page: 1, pageSize: 10 });
  let temporaryFilters = $state({ q: "", status: "", operationalDate: "" });
  let subjectPagination = $state({ page: 1, pageSize: 10 });
  let subjectFilters = $state({ q: "", active: "" });
  let schedulePagination = $state({ page: 1, pageSize: 10 });
  let scheduleFilters = $state({ q: "", subjectId: "", weekday: "", active: "" });
  let peopleImportResult = $state<ImportSummary | null>(null);
  let peopleImportError = $state("");
  let scheduleImportResult = $state<ImportSummary | null>(null);
  let scheduleImportError = $state("");

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
    operationalDate: operatingDateValue(),
    missingCredentialType: "personal_qr",
    reasonCode: "credential_unavailable",
    reasonText: "",
    maxUses: 10,
    validUntil: ""
  });
  let temporaryQrPersonLabel = $state("");
  let hotQrForm = $state({ visitorName: "", reason: "", minutes: 60 });
  let vehicleForm = $state({ ownerPersonId: "", plate: "", make: "", model: "", color: "" });
  let permitForm = $state({ personId: "", vehicleId: "", validUntil: "" });
  let vehicleOwnerLabel = $state("");
  let permitPersonLabel = $state("");
  let permitVehicleLabel = $state("");
  let permitFilterPersonLabel = $state("");
  let permitFilterVehicleLabel = $state("");
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
  const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let eventsReconnectDelay = 1000;
  let eventsShouldReconnect = false;

  function closeEventsSocket() {
    eventsShouldReconnect = false;
    if (eventsReconnectTimer) clearTimeout(eventsReconnectTimer);
    eventsReconnectTimer = null;
    eventsSocket?.close();
    eventsSocket = null;
    for (const timer of refreshTimers.values()) clearTimeout(timer);
    refreshTimers.clear();
  }

  function scheduleRefresh(key: string, action: () => Promise<void>) {
    const current = refreshTimers.get(key);
    if (current) clearTimeout(current);
    refreshTimers.set(key, setTimeout(() => {
      refreshTimers.delete(key);
      action().catch(() => null);
    }, 300));
  }

  function handleEventMessage(message: EventMessage) {
    if ((message.topic === "access.scan" || message.topic === "access.table") && activeTab === "access") {
      scheduleRefresh("access", refreshAccess);
    }
    if ((message.topic === "access.scan" || message.topic === "attendance.table") && activeTab === "attendance") {
      scheduleRefresh("attendance", refreshAttendance);
    }
    if (message.topic === "hot-qr.table" && activeTab === "hotqr") scheduleRefresh("hotqr", refreshHotQr);
    if (message.topic === "credentials.table" && activeTab === "edit") scheduleRefresh("credentials", () => refreshCredentials());
    if (message.topic === "temporary-daily-qr.table" && activeTab === "generator") scheduleRefresh("temporary", refreshTemporaryQr);
    if (message.topic === "vehicles.table" && activeTab === "vehicles") scheduleRefresh("vehicles", refreshVehicles);
    if (message.topic === "vehicle-permits.table" && activeTab === "vehicles") scheduleRefresh("permits", refreshPermits);
    if ((message.topic === "admins.table" || message.topic === "audit.table") && activeTab === "admins") {
      scheduleRefresh("admins", refreshAdmins);
    }
    if (message.topic === "admin-sessions.table" && activeTab === "admins") {
      adminSessionRows = [];
      scheduleRefresh("admins", refreshAdmins);
    }
    if (message.topic === "config.table" && activeTab === "config") scheduleRefresh("config", refreshConfig);
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

      handleEventMessage(message);
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
      await refreshInitial();
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
      await refreshInitial();
      connectEventsSocket();
    } catch {
      session = null;
    }
  }

  async function refreshAccess() {
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/access/today${toQuery({
      q: filters.q,
      date: filters.date,
      page: accessPagination.page,
      pageSize: accessPagination.pageSize,
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
      page: attendancePagination.page,
      pageSize: attendancePagination.pageSize,
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

  function clearPeopleOptionsCache() {
    peopleOptionsCache = null;
    peopleOptionsByQuery.clear();
    peopleOptionsPromises.clear();
  }

  function clearVehicleOptionsCache() {
    vehicleOptionsCache = null;
    vehicleOptionsByQuery.clear();
    vehicleOptionsPromises.clear();
  }

  async function searchPeopleOptions(query: string) {
    const needle = query.trim().toLowerCase();
    const key = needle || "__all__";
    const cached = peopleOptionsByQuery.get(key);
    if (cached) return cached;

    if (!peopleOptionsPromises.has(key)) {
      peopleOptionsPromises.set(key, apiRequest<PaginatedRows<PersonRowPayload & Row>>(`/api/v1/people${toQuery({ q: needle || undefined, page: 1, pageSize: 100 })}`)
        .then((result) => result.rows)
        .finally(() => {
          peopleOptionsPromises.delete(key);
        }));
    }

    const rows = await peopleOptionsPromises.get(key)!;
    peopleOptionsByQuery.set(key, rows);
    if (!needle) peopleOptionsCache = rows;
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.matricula, row.nombres, row.apellidos, row.curp, row.tipoPersonaLabel, row.tipoPersona]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }

  async function searchVehicleOptions(query: string) {
    const needle = query.trim().toLowerCase();
    const key = needle || "__all__";
    const cached = vehicleOptionsByQuery.get(key);
    if (cached) return cached;

    if (!vehicleOptionsPromises.has(key)) {
      vehicleOptionsPromises.set(key, apiRequest<PaginatedRows<VehicleRowPayload & Row>>(`/api/v1/vehicles${toQuery({ q: needle || undefined, page: 1, pageSize: 100 })}`)
        .then((result) => result.rows)
        .finally(() => {
          vehicleOptionsPromises.delete(key);
        }));
    }

    const rows = await vehicleOptionsPromises.get(key)!;
    vehicleOptionsByQuery.set(key, rows);
    if (!needle) vehicleOptionsCache = rows;
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.plate, row.make, row.model, row.color, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
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
      credentialTotal = 0;
      return;
    }
    const result = await apiRequest<PaginatedRows<PersonCredentialRowPayload & Row>>(`/api/v1/credentials/person/${personId}${toQuery({
      page: credentialPagination.page,
      pageSize: credentialPagination.pageSize
    })}`);
    credentialRows = result.rows;
    credentialTotal = result.total;
  }

  async function refreshTemporaryQr() {
    const result = await apiRequest<PaginatedRows<TemporaryDailyQrRowPayload & Row>>(`/api/v1/credentials/temporary-daily${toQuery({
      q: temporaryFilters.q,
      status: temporaryFilters.status,
      operationalDate: temporaryFilters.operationalDate,
      page: temporaryPagination.page,
      pageSize: temporaryPagination.pageSize
    })}`);
    temporaryQrRows = result.rows;
    temporaryQrTotal = result.total;
  }

  async function refreshHotQr() {
    const result = await apiRequest<PaginatedRows<HotQrRowPayload & Row>>(`/api/v1/hot-qr/today${toQuery({
      q: filters.q,
      status: filters.hotQrStatus,
      date: filters.date,
      page: hotQrPagination.page,
      pageSize: hotQrPagination.pageSize
    })}`);
    hotQrRows = result.rows;
    hotQrTotal = result.total;
  }

  async function refreshVehicles() {
    const result = await apiRequest<PaginatedRows<VehicleRowPayload & Row>>(`/api/v1/vehicles${toQuery({
      q: filters.q,
      status: filters.vehicleStatus,
      page: vehiclePagination.page,
      pageSize: vehiclePagination.pageSize
    })}`);
    vehicleRows = result.rows;
    vehicleTotal = result.total;
  }

  async function refreshPermits() {
    const result = await apiRequest<PaginatedRows<VehiclePermitRowPayload & Row>>(`/api/v1/vehicles/permits${toQuery({
      q: filters.q,
      status: filters.permitStatus,
      personId: filters.permitPersonId,
      vehicleId: filters.permitVehicleId,
      page: permitPagination.page,
      pageSize: permitPagination.pageSize
    })}`);
    permitRows = result.rows;
    permitTotal = result.total;
  }

  async function refreshAdmins() {
    if (session?.admin.role !== "super_admin") return;
    adminRows = (await apiRequest<{ rows: Array<AdminRowPayload & Row> }>("/api/v1/admins")).rows;
    scannerDeviceRows = (await apiRequest<{ rows: Array<ScannerDeviceRowPayload & Row> }>("/api/v1/scanner-devices")).rows;
    const auditResult = await apiRequest<PaginatedRows<AuditLogRowPayload & Row>>(`/api/v1/admins/audit${toQuery({
      q: auditFilters.q,
      action: auditFilters.action,
      entityType: auditFilters.entityType,
      from: auditFilters.from ? new Date(auditFilters.from).toISOString() : "",
      to: auditFilters.to ? new Date(auditFilters.to).toISOString() : "",
      page: adminAuditPagination.page,
      pageSize: adminAuditPagination.pageSize
    })}`);
    adminAuditRows = auditResult.rows;
    adminAuditTotal = auditResult.total;
  }

  async function refreshConfig() {
    const result = await apiRequest<{ value?: Partial<OperationalConfigPayload> }>("/api/v1/config/operational");
    const signedQrResult = await apiRequest<{ value?: Partial<SignedQrConfigPayload> }>("/api/v1/config/signed-qr");
    const scannerDevicesResult = await apiRequest<{ value?: Partial<ScannerDevicesConfigPayload> }>("/api/v1/config/scanner-devices");
    configForm = { ...configForm, ...(result.value as Partial<typeof configForm> ?? {}) };
    signedQrConfigForm = { ...signedQrConfigForm, ...(signedQrResult.value as Partial<typeof signedQrConfigForm> ?? {}) };
    scannerDevicesConfigForm = { ...scannerDevicesConfigForm, ...(scannerDevicesResult.value as Partial<typeof scannerDevicesConfigForm> ?? {}) };
  }

  async function refreshSubjects() {
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/subjects${toQuery({
      q: subjectFilters.q,
      active: subjectFilters.active,
      page: subjectPagination.page,
      pageSize: subjectPagination.pageSize
    })}`);
    subjectRows = result.rows;
    subjectTotal = result.total;
  }

  async function refreshSchedules() {
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/schedules${toQuery({
      q: scheduleFilters.q,
      subjectId: scheduleFilters.subjectId,
      weekday: scheduleFilters.weekday,
      active: scheduleFilters.active,
      page: schedulePagination.page,
      pageSize: schedulePagination.pageSize
    })}`);
    scheduleRows = result.rows;
    scheduleTotal = result.total;
  }

  async function refreshInitial() {
    await Promise.allSettled([
      refreshPersonTypes(),
      refreshCareers(),
      refreshActiveTab()
    ]);
  }

  async function refreshActiveTab() {
    if (activeTab === "generator") await refreshTemporaryQr();
    else if (activeTab === "edit") await refreshCredentials();
    else if (activeTab === "access") await refreshAccess();
    else if (activeTab === "attendance") await Promise.allSettled([refreshAttendance(), refreshSubjects(), refreshSchedules()]);
    else if (activeTab === "hotqr") await refreshHotQr();
    else if (activeTab === "vehicles") await Promise.allSettled([refreshVehicles(), refreshPermits()]);
    else if (activeTab === "admins") await refreshAdmins();
    else if (activeTab === "config") await refreshConfig();
  }

  function switchTab(id: string) {
    activeTab = id;
    if (session) refreshActiveTab().catch(() => null);
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

    personalGeneratedToken = result.token;
    personalGeneratedTitle = "QR personal";
    notice = "QR generado";
    clearPeopleOptionsCache();
    await Promise.allSettled([refreshPeople(), refreshCredentials(personId)]);
  }

  async function searchPerson() {
    editPerson = await apiRequest<PersonRowPayload & Row>(`/api/v1/people/by-matricula/${editMatricula}`);
    editGeneratedToken = "";
    editGeneratedTitle = "";
    credentialPagination.page = 1;
    await refreshCredentials(String(editPerson.id));
  }

  function selectTemporaryPerson(row: Row | null) {
    temporaryQrForm.personId = row?.id ? String(row.id) : "";
    temporaryQrPersonLabel = row ? `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim() : "";
    temporaryPagination.page = 1;
  }

  function selectVehicleOwner(row: Row | null) {
    vehicleForm.ownerPersonId = row?.id ? String(row.id) : "";
    vehicleOwnerLabel = row ? `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim() : "";
  }

  function selectPermitPerson(row: Row | null) {
    permitForm.personId = row?.id ? String(row.id) : "";
    permitPersonLabel = row ? `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim() : "";
  }

  function selectPermitVehicle(row: Row | null) {
    permitForm.vehicleId = row?.id ? String(row.id) : "";
    permitVehicleLabel = row ? `${row.plate ?? ""}${row.make ? ` - ${row.make}` : ""}${row.model ? ` ${row.model}` : ""}`.trim() : "";
  }

  function selectPermitFilterPerson(row: Row | null) {
    filters.permitPersonId = row?.id ? String(row.id) : "";
    permitFilterPersonLabel = row ? `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim() : "";
    permitPagination.page = 1;
  }

  function selectPermitFilterVehicle(row: Row | null) {
    filters.permitVehicleId = row?.id ? String(row.id) : "";
    permitFilterVehicleLabel = row ? `${row.plate ?? ""}${row.make ? ` - ${row.make}` : ""}${row.model ? ` ${row.model}` : ""}`.trim() : "";
    permitPagination.page = 1;
  }

  async function changeAccessPage(next: { page: number; pageSize: number }) {
    accessPagination = next;
    await refreshAccess();
  }

  async function filterAccess() {
    accessPagination.page = 1;
    await refreshAccess();
  }

  async function changeAttendancePage(next: { page: number; pageSize: number }) {
    attendancePagination = next;
    await refreshAttendance();
  }

  async function filterAttendance() {
    attendancePagination.page = 1;
    await refreshAttendance();
  }

  async function changeSubjectPage(next: { page: number; pageSize: number }) {
    subjectPagination = next;
    await refreshSubjects();
  }

  async function filterSubjects() {
    subjectPagination.page = 1;
    await refreshSubjects();
  }

  async function changeSchedulePage(next: { page: number; pageSize: number }) {
    schedulePagination = next;
    await refreshSchedules();
  }

  async function filterSchedules() {
    schedulePagination.page = 1;
    await refreshSchedules();
  }

  async function changeTemporaryPage(next: { page: number; pageSize: number }) {
    temporaryPagination = next;
    await refreshTemporaryQr();
  }

  async function filterTemporaryQr() {
    temporaryPagination.page = 1;
    await refreshTemporaryQr();
  }

  async function changeVehiclePage(next: { page: number; pageSize: number }) {
    vehiclePagination = next;
    await refreshVehicles();
  }

  async function changePermitPage(next: { page: number; pageSize: number }) {
    permitPagination = next;
    await refreshPermits();
  }

  async function changeHotQrPage(next: { page: number; pageSize: number }) {
    hotQrPagination = next;
    await refreshHotQr();
  }

  async function filterHotQr() {
    hotQrPagination.page = 1;
    await refreshHotQr();
  }

  async function changeCredentialPage(next: { page: number; pageSize: number }) {
    credentialPagination = next;
    await refreshCredentials();
  }

  async function changeAuditPage(next: { page: number; pageSize: number }) {
    adminAuditPagination = next;
    await refreshAdmins();
  }

  async function filterAudit() {
    adminAuditPagination.page = 1;
    await refreshAdmins();
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
    editGeneratedToken = result.token;
    editGeneratedTitle = "QR personal rotado";
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
    temporaryQrError = "";
    if (!temporaryQrForm.personId) {
      temporaryQrError = "Selecciona una persona de la lista antes de generar el QR temporal.";
      return;
    }
    const validUntil = temporaryQrForm.validUntil ? new Date(temporaryQrForm.validUntil).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString();
    const payload = {
      personId: temporaryQrForm.personId,
      operationalDate: temporaryQrForm.operationalDate,
      missingCredentialType: temporaryQrForm.missingCredentialType,
      reasonCode: temporaryQrForm.reasonCode,
      ...(temporaryQrForm.reasonText.trim() ? { reasonText: temporaryQrForm.reasonText.trim() } : {}),
      scope: {},
      maxUses: Number(temporaryQrForm.maxUses),
      validUntil
    };
    try {
      const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/credentials/temporary-daily", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await showTemporaryQr(result.credential, result.token);
      await refreshTemporaryQr();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      temporaryQrError = message.includes("Invalid request payload")
        ? "Revisa la persona, vigencia y usos maximos. El QR temporal necesita una persona seleccionada y datos validos."
        : message || "No se pudo generar el QR temporal.";
    }
  }

  async function showTemporaryQr(row: Row, fallbackToken = "") {
    temporaryQrError = "";
    try {
      const result = await apiRequest<DynamicQrResult>(`/api/v1/credentials/temporary-daily/${row.id}/dynamic`, { method: "POST" });
      temporaryGeneratedToken = result.token;
      temporaryGeneratedTitle = "QR temporal diario dinamico";
      notice = `QR temporal dinamico generado. Expira: ${new Date(result.expiresAt).toLocaleTimeString("es-MX")}`;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code && code !== "SIGNED_QR_DISABLED") throw error;
      temporaryGeneratedToken = fallbackToken;
      temporaryGeneratedTitle = "QR temporal diario";
      if (!fallbackToken) {
        temporaryQrError = "No se pudo generar el QR dinamico porque QR firmado esta deshabilitado y este registro no conserva el token visible. Genera un nuevo QR temporal o activa QR firmado.";
      }
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
    hotQrGeneratedToken = result.token;
    hotQrGeneratedTitle = "Hot-QR";
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
    vehicleOwnerLabel = "";
    clearVehicleOptionsCache();
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
    permitPersonLabel = "";
    permitVehicleLabel = "";
    permitForm = { personId: "", vehicleId: "", validUntil: "" };
    await Promise.allSettled([refreshPermits(), refreshVehicles()]);
  }

  async function showDynamicPermitQr(row: Row, fallbackToken = "") {
    try {
      const result = await apiRequest<DynamicQrResult>(`/api/v1/vehicles/permits/${row.id}/qr/dynamic`, { method: "POST" });
      vehicleGeneratedToken = result.token;
      vehicleGeneratedTitle = "QR vehicular dinamico";
      notice = `QR vehicular dinamico generado. Expira: ${new Date(result.expiresAt).toLocaleTimeString("es-MX")}`;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code && code !== "SIGNED_QR_DISABLED") throw error;
      vehicleGeneratedToken = fallbackToken;
      vehicleGeneratedTitle = "QR vehicular";
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

  async function approveScannerDevice(row: Row) {
    await apiRequest(`/api/v1/scanner-devices/${row.id}/approve`, { method: "POST" });
    notice = "Dispositivo scanner aprobado";
    await refreshAdmins();
  }

  async function revokeScannerDevice(row: Row) {
    await apiRequest(`/api/v1/scanner-devices/${row.id}/revoke`, { method: "POST" });
    notice = "Dispositivo scanner revocado";
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

  async function saveScannerDevicesConfig() {
    await apiRequest("/api/v1/config/scanner-devices", {
      method: "PATCH",
      body: JSON.stringify({ value: scannerDevicesConfigForm })
    });
    notice = "Configuracion de dispositivos scanner guardada";
  }

  async function importPeopleCsv(file: File) {
    peopleImportError = "";
    const body = new FormData();
    body.set("file", file);

    try {
      peopleImportResult = await apiRequest<ImportSummary>("/api/v1/people/import", { method: "POST", body });
      notice = "Importacion de usuarios finalizada";
      clearPeopleOptionsCache();
      await Promise.allSettled([refreshPeople(), refreshCredentials()]);
    } catch (error) {
      peopleImportError = error instanceof Error ? error.message : "No se pudo importar usuarios";
    }
  }

  async function importSchedulesCsv(file: File) {
    scheduleImportError = "";
    const body = new FormData();
    body.set("file", file);

    try {
      scheduleImportResult = await apiRequest<ImportSummary>("/api/v1/schedules/import", { method: "POST", body });
      notice = "Importacion de horarios finalizada";
      await Promise.allSettled([refreshSubjects(), refreshSchedules(), refreshAttendance()]);
    } catch (error) {
      scheduleImportError = error instanceof Error ? error.message : "No se pudo importar horarios";
    }
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
    onTab={switchTab}
    onLogout={logout}
  >
    <DismissibleNotice message={notice} onDismiss={() => (notice = "")} />
    {#if session.admin.mustChangePassword}
      <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); changeAdminPassword(); }}>
        <h2>Cambiar password</h2>
        <p class="muted">Debes actualizar tu password antes de continuar con tareas sensibles.</p>
        <DismissibleNotice message={passwordNotice} onDismiss={() => (passwordNotice = "")} />
        {#if passwordError}<p class="error" role="alert">{passwordError}</p>{/if}
        <label class="form-field">
          <span>Password actual</span>
          <input type="password" bind:value={passwordForm.currentPassword} placeholder="Password actual" required />
        </label>
        <label class="form-field">
          <span>Nuevo password</span>
          <input type="password" bind:value={passwordForm.newPassword} placeholder="Nuevo password" minlength="8" required />
        </label>
        <button>Actualizar password</button>
      </form>
    {/if}

    {#if activeTab === "generator"}
      <GeneratorTab
        {personForm}
        {personTypeRows}
        {careerRows}
        generatedToken={personalGeneratedToken}
        generatedTitle={personalGeneratedTitle}
        {temporaryGeneratedToken}
        {temporaryGeneratedTitle}
        {temporaryQrError}
        {temporaryQrForm}
        {temporaryQrPersonLabel}
        temporaryRows={temporaryQrRows}
        {temporaryFilters}
        temporaryTotal={temporaryQrTotal}
        temporaryPage={temporaryPagination.page}
        temporaryPageSize={temporaryPagination.pageSize}
        onTemporaryPageChange={changeTemporaryPage}
        onFilterTemporaryQr={filterTemporaryQr}
        searchPeople={searchPeopleOptions}
        onSelectTemporaryPerson={selectTemporaryPerson}
        onSubmit={createPersonAndQr}
        importResult={peopleImportResult}
        importError={peopleImportError}
        onImportPeople={importPeopleCsv}
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
        credentialTotal={credentialTotal}
        credentialPage={credentialPagination.page}
        credentialPageSize={credentialPagination.pageSize}
        generatedToken={editGeneratedToken}
        generatedTitle={editGeneratedTitle}
        onSearch={searchPerson}
        onSave={saveEditPerson}
        onDisable={disableEditPerson}
        onEnable={enableEditPerson}
        onRotateQr={rotatePersonQr}
        onRevokeQr={revokePersonQr}
        onCredentialPageChange={changeCredentialPage}
        onPhoto={uploadPersonPhoto}
        searchPeople={searchPeopleOptions}
      />
    {/if}

    {#if activeTab === "access"}
      <AccessTab
        rows={accessRows}
        total={accessTotal}
        {filters}
        page={accessPagination.page}
        pageSize={accessPagination.pageSize}
        {personTypeRows}
        onFilter={filterAccess}
        onPageChange={changeAccessPage}
      />
    {/if}

    {#if activeTab === "attendance"}
      <AttendanceTab
        rows={attendanceRows}
        total={attendanceTotal}
        {filters}
        page={attendancePagination.page}
        pageSize={attendancePagination.pageSize}
        {careerRows}
        {subjectRows}
        {subjectTotal}
        subjectPage={subjectPagination.page}
        subjectPageSize={subjectPagination.pageSize}
        {subjectFilters}
        {scheduleRows}
        {scheduleTotal}
        schedulePage={schedulePagination.page}
        schedulePageSize={schedulePagination.pageSize}
        {scheduleFilters}
        importResult={scheduleImportResult}
        importError={scheduleImportError}
        onFilter={filterAttendance}
        onPageChange={changeAttendancePage}
        onFilterSubjects={filterSubjects}
        onSubjectPageChange={changeSubjectPage}
        onFilterSchedules={filterSchedules}
        onSchedulePageChange={changeSchedulePage}
        onImportSchedules={importSchedulesCsv}
        onAdjustAttendance={adjustAttendance}
      />
    {/if}

    {#if activeTab === "hotqr"}
      <HotQrTab
        rows={hotQrRows}
        form={hotQrForm}
        generatedToken={hotQrGeneratedToken}
        generatedTitle={hotQrGeneratedTitle}
        {filters}
        total={hotQrTotal}
        page={hotQrPagination.page}
        pageSize={hotQrPagination.pageSize}
        onCreate={createHotQr}
        onFilter={filterHotQr}
        onPageChange={changeHotQrPage}
        onRevoke={revokeHotQr}
      />
    {/if}

    {#if activeTab === "vehicles"}
      <VehiclesTab
        rows={vehicleRows}
        permitRows={permitRows}
        {vehicleForm}
        {permitForm}
        {vehicleOwnerLabel}
        {permitPersonLabel}
        {permitVehicleLabel}
        {permitFilterPersonLabel}
        {permitFilterVehicleLabel}
        generatedToken={vehicleGeneratedToken}
        generatedTitle={vehicleGeneratedTitle}
        {filters}
        vehicleTotal={vehicleTotal}
        vehiclePage={vehiclePagination.page}
        vehiclePageSize={vehiclePagination.pageSize}
        permitTotal={permitTotal}
        permitPage={permitPagination.page}
        permitPageSize={permitPagination.pageSize}
        searchPeople={searchPeopleOptions}
        searchVehicles={searchVehicleOptions}
        onSelectVehicleOwner={selectVehicleOwner}
        onSelectPermitPerson={selectPermitPerson}
        onSelectPermitVehicle={selectPermitVehicle}
        onSelectPermitFilterPerson={selectPermitFilterPerson}
        onSelectPermitFilterVehicle={selectPermitFilterVehicle}
        onVehiclePageChange={changeVehiclePage}
        onPermitPageChange={changePermitPage}
        onCreateVehicle={createVehicle}
        onCreatePermitQr={createPermitQr}
        onCreateDynamicPermitQr={showDynamicPermitQr}
        onRevokePermit={revokePermit}
        onDisableVehicle={disableVehicle}
        onFilter={async () => {
          vehiclePagination.page = 1;
          permitPagination.page = 1;
          await Promise.allSettled([refreshVehicles(), refreshPermits()]);
        }}
      />
    {/if}

    {#if activeTab === "admins"}
      <AdminsTab
        rows={adminRows}
        form={adminForm}
        editForm={adminEditForm}
        auditFilters={auditFilters}
        isSuperAdmin={session.admin.role === "super_admin"}
        currentAdmin={{
          id: session.admin.id,
          displayName: session.admin.displayName,
          username: session.admin.username
        }}
        currentSessionId={session.sessionId}
        sessionRows={adminSessionRows}
        scannerDeviceRows={scannerDeviceRows}
        auditRows={adminAuditRows}
        auditTotal={adminAuditTotal}
        auditPage={adminAuditPagination.page}
        auditPageSize={adminAuditPagination.pageSize}
        onCreate={createAdmin}
        onApproveScannerDevice={approveScannerDevice}
        onRevokeScannerDevice={revokeScannerDevice}
        onSelect={selectAdminForEdit}
        onUpdate={updateAdmin}
        onDisable={disableAdmin}
        onEnable={enableAdmin}
        onResetPassword={resetAdminPassword}
        onLoadSessions={loadAdminSessions}
        onRevokeSession={revokeAdminSession}
        onFilterAudit={filterAudit}
        onAuditPageChange={changeAuditPage}
      />
    {/if}

    {#if activeTab === "config"}
      <ConfigTab
        bind:config={configForm}
        bind:signedQrConfig={signedQrConfigForm}
        bind:scannerDevicesConfig={scannerDevicesConfigForm}
        onSave={saveConfig}
        onSaveSignedQr={saveSignedQrConfig}
        onSaveScannerDevices={saveScannerDevicesConfig}
      />
    {/if}
  </AdminShell>
{/if}
