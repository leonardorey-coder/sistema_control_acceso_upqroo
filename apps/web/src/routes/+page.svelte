<script lang="ts">
  import { onMount } from "svelte";
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
  type Session = {
    admin: {
      id: string;
      username: string;
      displayName: string;
      role: string;
      mustChangePassword: boolean;
    };
    expiresAt: string;
  };

  let { data }: { data: PageData } = $props();

  let activeTab = $state("generator");
  let session = $state<Session | null>(null);
  let loginIdentity = $state("");
  let loginPassword = $state("");
  let loginError = $state("");
  let notice = $state("");
  let generatedToken = $state("");
  let generatedTitle = $state("");

  let accessRows = $state<Row[]>([]);
  let accessTotal = $state(0);
  let attendanceRows = $state<Row[]>([]);
  let attendanceTotal = $state(0);
  let peopleRows = $state<Row[]>([]);
  let personTypeRows = $state<Row[]>([]);
  let careerRows = $state<Row[]>([]);
  let credentialRows = $state<Row[]>([]);
  let temporaryQrRows = $state<Row[]>([]);
  let hotQrRows = $state<Row[]>([]);
  let vehicleRows = $state<Row[]>([]);
  let permitRows = $state<Row[]>([]);
  let adminRows = $state<Row[]>([]);
  let adminSessionRows = $state<Row[]>([]);
  let adminAuditRows = $state<Row[]>([]);
  let subjectRows = $state<Row[]>([]);
  let scheduleRows = $state<Row[]>([]);
  let configForm = $state({
    retryEnabled: true,
    retryDelayMs: 1200,
    cameraEnabled: true,
    manualEntryEnabled: true,
    soundsEnabled: true,
    autoExitEnabled: true
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
  let editPerson = $state<Row | null>(null);
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

  async function login() {
    loginError = "";
    try {
      session = await apiRequest<Session>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ identity: loginIdentity, password: loginPassword })
      });
      loginPassword = "";
      await refreshAll();
    } catch (error) {
      loginError = error instanceof Error ? error.message : "No se pudo iniciar sesion";
    }
  }

  async function logout() {
    await apiRequest("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
    session = null;
  }

  async function loadSession() {
    try {
      session = await apiRequest<Session>("/api/v1/auth/me");
      await refreshAll();
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
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/attendance/today${toQuery({
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
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/people${toQuery({ q: filters.q, personType: filters.personType, status: filters.status, careerId: filters.careerId, page: filters.page, pageSize: filters.pageSize })}`);
    peopleRows = result.rows;
  }

  async function refreshPersonTypes() {
    personTypeRows = (await apiRequest<{ rows: Row[] }>("/api/v1/person-types")).rows;
  }

  async function refreshCareers() {
    careerRows = (await apiRequest<{ rows: Row[] }>("/api/v1/careers")).rows;
  }

  async function refreshCredentials(personId = editPerson?.id ? String(editPerson.id) : "") {
    if (!personId) {
      credentialRows = [];
      return;
    }
    credentialRows = (await apiRequest<{ rows: Row[] }>(`/api/v1/credentials/person/${personId}`)).rows;
  }

  async function refreshTemporaryQr() {
    temporaryQrRows = (await apiRequest<{ rows: Row[] }>("/api/v1/credentials/temporary-daily")).rows;
  }

  async function refreshHotQr() {
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/hot-qr/today${toQuery({ q: filters.q, status: filters.hotQrStatus, date: filters.date, page: filters.page, pageSize: filters.pageSize })}`);
    hotQrRows = result.rows;
  }

  async function refreshVehicles() {
    vehicleRows = (await apiRequest<PaginatedRows<Row>>(`/api/v1/vehicles${toQuery({ q: filters.q, status: filters.vehicleStatus, page: filters.page, pageSize: filters.pageSize })}`)).rows;
  }

  async function refreshPermits() {
    permitRows = (await apiRequest<PaginatedRows<Row>>(`/api/v1/vehicles/permits${toQuery({ page: filters.page, pageSize: filters.pageSize })}`)).rows;
  }

  async function refreshAdmins() {
    if (session?.admin.role !== "super_admin") return;
    adminRows = (await apiRequest<{ rows: Row[] }>("/api/v1/admins")).rows;
    adminAuditRows = (await apiRequest<{ rows: Row[] }>("/api/v1/admins/audit")).rows;
  }

  async function refreshConfig() {
    const result = await apiRequest<Row>("/api/v1/config/operational");
    configForm = { ...configForm, ...(result.value as Partial<typeof configForm> ?? {}) };
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

  async function createPersonAndQr() {
    let personId = "";

    if (personForm.nombres && personForm.apellidos) {
      const person = await apiRequest<Row>("/api/v1/people", {
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
      const person = await apiRequest<Row>(`/api/v1/people/by-matricula/${personForm.matricula}`);
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
    editPerson = await apiRequest<Row>(`/api/v1/people/by-matricula/${editMatricula}`);
    temporaryQrForm.personId = String(editPerson.id ?? "");
    permitForm.personId = String(editPerson.id ?? permitForm.personId);
    vehicleForm.ownerPersonId = String(editPerson.id ?? vehicleForm.ownerPersonId);
    await refreshCredentials(String(editPerson.id));
  }

  async function saveEditPerson() {
    if (!editPerson?.id) return;
    await apiRequest(`/api/v1/people/${editPerson.id}`, {
      method: "PATCH",
      body: JSON.stringify(editPerson)
    });
    notice = "Persona actualizada";
    await refreshPeople();
  }

  async function disableEditPerson() {
    if (!editPerson?.id) return;
    editPerson = await apiRequest<Row>(`/api/v1/people/${editPerson.id}/disable`, { method: "POST" });
    notice = "Persona desactivada";
    await refreshPeople();
  }

  async function enableEditPerson() {
    if (!editPerson?.id) return;
    editPerson = await apiRequest<Row>(`/api/v1/people/${editPerson.id}/enable`, { method: "POST" });
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
    const result = await apiRequest<{ person: Row }>(`/api/v1/people/${editPerson.id}/photo`, { method: "POST", body });
    editPerson = result.person;
    notice = "Foto actualizada";
  }

  async function createTemporaryQr() {
    const validUntil = temporaryQrForm.validUntil ? new Date(temporaryQrForm.validUntil).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString();
    const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/credentials/temporary-daily", {
      method: "POST",
      body: JSON.stringify({ ...temporaryQrForm, validUntil, maxUses: Number(temporaryQrForm.maxUses), createdByAdminId: session?.admin.id })
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
        validUntil,
        createdByAdminId: session?.admin.id
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
    adminSessionRows = (await apiRequest<{ rows: Row[] }>(`/api/v1/admins/${row.id}/sessions`)).rows;
  }

  async function revokeAdminSession(row: Row) {
    if (!row.adminId || !row.id) return;
    await apiRequest(`/api/v1/admins/${row.adminId}/sessions/${row.id}/revoke`, { method: "POST" });
    adminSessionRows = adminSessionRows.filter((sessionRow) => sessionRow.id !== row.id);
  }

  async function saveConfig() {
    await apiRequest("/api/v1/config/operational", {
      method: "PATCH",
      body: JSON.stringify({ value: configForm, updatedByAdminId: session?.admin.id })
    });
    notice = "Configuracion guardada";
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

  onMount(() => {
    loadSession();

    const socket = new WebSocket(`${apiBaseUrl.replace(/^http/, "ws")}/api/v1/events`);
    socket.addEventListener("message", () => {
      refreshAccess();
      refreshAttendance();
      refreshHotQr();
    });
  });
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
        isSuperAdmin={session.admin.role === "super_admin"}
        sessionRows={adminSessionRows}
        auditRows={adminAuditRows}
        onCreate={createAdmin}
        onDisable={disableAdmin}
        onEnable={enableAdmin}
        onResetPassword={resetAdminPassword}
        onLoadSessions={loadAdminSessions}
        onRevokeSession={revokeAdminSession}
      />
    {/if}

    {#if activeTab === "config"}
      <ConfigTab bind:config={configForm} onSave={saveConfig} />
    {/if}
  </AdminShell>
{/if}
