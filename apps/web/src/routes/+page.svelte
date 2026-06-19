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
  import ScannerView from "$lib/components/ScannerView.svelte";
  import VehiclesTab from "$lib/components/VehiclesTab.svelte";
  import { apiBaseUrl, apiRequest, toQuery, type PaginatedRows } from "$lib/api/client";
  import type { PageData } from "./$types";

  type Row = Record<string, unknown>;
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
  let scannerResult = $state<Row | null>(null);
  let generatedToken = $state("");
  let generatedTitle = $state("");

  let accessRows = $state<Row[]>([]);
  let accessTotal = $state(0);
  let attendanceRows = $state<Row[]>([]);
  let attendanceTotal = $state(0);
  let peopleRows = $state<Row[]>([]);
  let hotQrRows = $state<Row[]>([]);
  let vehicleRows = $state<Row[]>([]);
  let adminRows = $state<Row[]>([]);
  let configValue = $state("{}");

  let filters = $state({
    q: "",
    date: new Date().toISOString().slice(0, 10),
    page: 1,
    pageSize: 25
  });

  let personForm = $state({
    matricula: "",
    nombres: "",
    apellidos: "",
    curp: "",
    tipoPersona: "estudiante",
    estado: "activo",
    notas: "",
    expiresAt: ""
  });

  let editMatricula = $state("");
  let editPerson = $state<Row | null>(null);
  let hotQrForm = $state({ visitorName: "", reason: "", minutes: 60 });
  let vehicleForm = $state({ ownerPersonId: "", plate: "", make: "", model: "", color: "" });
  let permitForm = $state({ personId: "", vehicleId: "", validUntil: "" });
  let adminForm = $state({ username: "", displayName: "", email: "", role: "admin", temporaryPassword: "" });

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
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/access/today${toQuery(filters)}`);
    accessRows = result.rows;
    accessTotal = result.total;
  }

  async function refreshAttendance() {
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/attendance/today${toQuery(filters)}`);
    attendanceRows = result.rows;
    attendanceTotal = result.total;
  }

  async function refreshPeople() {
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/people${toQuery({ q: filters.q, page: filters.page, pageSize: filters.pageSize })}`);
    peopleRows = result.rows;
  }

  async function refreshHotQr() {
    const result = await apiRequest<PaginatedRows<Row>>(`/api/v1/hot-qr/today${toQuery(filters)}`);
    hotQrRows = result.rows;
  }

  async function refreshVehicles() {
    vehicleRows = (await apiRequest<PaginatedRows<Row>>(`/api/v1/vehicles${toQuery({ page: 1, pageSize: 100 })}`)).rows;
  }

  async function refreshAdmins() {
    adminRows = (await apiRequest<{ rows: Row[] }>("/api/v1/admins")).rows;
  }

  async function refreshConfig() {
    const result = await apiRequest<Row>("/api/v1/config/operational");
    configValue = JSON.stringify(result.value ?? {}, null, 2);
  }

  async function refreshAll() {
    await Promise.allSettled([
      refreshAccess(),
      refreshAttendance(),
      refreshPeople(),
      refreshHotQr(),
      refreshVehicles(),
      refreshAdmins(),
      refreshConfig()
    ]);
  }

  async function scan(payload: { token?: string; manualMatricula?: string }) {
    scannerResult = await apiRequest<Row>("/api/v1/access/scan", {
      method: "POST",
      body: JSON.stringify({ ...payload, adminId: session?.admin.id })
    });
    await Promise.allSettled([refreshAccess(), refreshAttendance()]);
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
    await refreshPeople();
  }

  async function searchPerson() {
    editPerson = await apiRequest<Row>(`/api/v1/people/by-matricula/${editMatricula}`);
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
    generatedToken = result.token;
    generatedTitle = "QR vehicular";
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

  async function saveConfig() {
    await apiRequest("/api/v1/config/operational", {
      method: "PATCH",
      body: JSON.stringify({ value: JSON.parse(configValue), updatedByAdminId: session?.admin.id })
    });
    notice = "Configuracion guardada";
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
  <main class="login-page">
    <form class="panel login-card" onsubmit={(event) => { event.preventDefault(); login(); }}>
      <div class="logo-mark large">UP</div>
      <h1>Sistema de Control de Acceso</h1>
      <input bind:value={loginIdentity} placeholder="Usuario o correo" autocomplete="username" />
      <input bind:value={loginPassword} placeholder="Password" type="password" autocomplete="current-password" />
      <button>Entrar</button>
      {#if loginError}<p class="error">{loginError}</p>{/if}
    </form>
  </main>
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
      <GeneratorTab {personForm} {generatedToken} {generatedTitle} onSubmit={createPersonAndQr} />
    {/if}

    {#if activeTab === "edit"}
      <EditPersonTab bind:editMatricula {editPerson} onSearch={searchPerson} onSave={saveEditPerson} />
    {/if}

    {#if activeTab === "access"}
      <AccessTab rows={accessRows} total={accessTotal} {filters} onFilter={refreshAccess} />
    {/if}

    {#if activeTab === "attendance"}
      <AttendanceTab rows={attendanceRows} total={attendanceTotal} {filters} onFilter={refreshAttendance} />
    {/if}

    {#if activeTab === "hotqr"}
      <HotQrTab rows={hotQrRows} form={hotQrForm} onCreate={createHotQr} />
    {/if}

    {#if activeTab === "vehicles"}
      <VehiclesTab
        rows={vehicleRows}
        {vehicleForm}
        {permitForm}
        onCreateVehicle={createVehicle}
        onCreatePermitQr={createPermitQr}
      />
    {/if}

    {#if activeTab === "admins"}
      <AdminsTab rows={adminRows} form={adminForm} isSuperAdmin={session.admin.role === "super_admin"} onCreate={createAdmin} />
    {/if}

    {#if activeTab === "config"}
      <ConfigTab bind:value={configValue} onSave={saveConfig} />
    {/if}

    {#if activeTab === "generator" || activeTab === "access"}
      <section class="panel">
        <h2>Scanner embebido</h2>
        <ScannerView result={scannerResult} recentRows={accessRows} onScan={scan} />
      </section>
    {/if}
  </AdminShell>
{/if}
