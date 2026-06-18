<script lang="ts">
  import { onMount } from "svelte";
  import AdminShell from "$lib/components/AdminShell.svelte";
  import DataTable from "$lib/components/DataTable.svelte";
  import QrPreview from "$lib/components/QrPreview.svelte";
  import ScannerView from "$lib/components/ScannerView.svelte";
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
    vehicleRows = (await apiRequest<{ rows: Row[] }>("/api/v1/vehicles")).rows;
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
      <section class="grid two">
        <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); createPersonAndQr(); }}>
          <div class="section-header">
            <h2>Generador de Codigo QR</h2>
            <p>Cree credenciales personales con registro nuevo o matricula existente</p>
          </div>
          <input bind:value={personForm.matricula} placeholder="Matricula" required />
          <input bind:value={personForm.nombres} placeholder="Nombres" />
          <input bind:value={personForm.apellidos} placeholder="Apellidos" />
          <input bind:value={personForm.curp} placeholder="CURP" oninput={() => (personForm.curp = personForm.curp.toUpperCase())} />
          <select bind:value={personForm.tipoPersona}>
            <option value="estudiante">Estudiante</option>
            <option value="aspirante">Aspirante</option>
            <option value="docente">Docente</option>
            <option value="administrativo">Administrativo</option>
            <option value="invitado">Invitado</option>
            <option value="otro">Otro</option>
          </select>
          <input bind:value={personForm.expiresAt} type="datetime-local" />
          <textarea bind:value={personForm.notas} placeholder="Notas"></textarea>
          <button>Registrar y Generar</button>
        </form>
        <section class="panel">
          <QrPreview token={generatedToken} title={generatedTitle || "QR"} subtitle="El token visible se muestra solo en esta respuesta" />
        </section>
      </section>
    {/if}

    {#if activeTab === "edit"}
      <section class="grid two">
        <form class="panel" onsubmit={(event) => { event.preventDefault(); searchPerson(); }}>
          <h2>Editar persona</h2>
          <input bind:value={editMatricula} placeholder="Buscar por matricula" />
          <button>Buscar</button>
        </form>
        {#if editPerson}
          <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); saveEditPerson(); }}>
            <input bind:value={editPerson.matricula} placeholder="Matricula" />
            <input bind:value={editPerson.nombres} placeholder="Nombres" />
            <input bind:value={editPerson.apellidos} placeholder="Apellidos" />
            <select bind:value={editPerson.tipoPersona}>
              <option value="estudiante">Estudiante</option>
              <option value="aspirante">Aspirante</option>
              <option value="docente">Docente</option>
              <option value="administrativo">Administrativo</option>
              <option value="invitado">Invitado</option>
              <option value="otro">Otro</option>
            </select>
            <select bind:value={editPerson.estado}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="suspendido">Suspendido</option>
              <option value="egresado">Egresado</option>
              <option value="baja">Baja</option>
            </select>
            <textarea bind:value={editPerson.notas} placeholder="Notas"></textarea>
            <button>Guardar cambios</button>
          </form>
        {/if}
      </section>
    {/if}

    {#if activeTab === "access"}
      <section class="panel">
        <div class="tabla-header">
          <h2>Registros del dia</h2>
          <span>{accessTotal} registros</span>
        </div>
        <div class="toolbar">
          <input bind:value={filters.q} placeholder="Buscar matricula, nombre, placa" />
          <input bind:value={filters.date} type="date" />
          <button onclick={refreshAccess}>Filtrar</button>
        </div>
        <DataTable rows={accessRows} columns={[
          { key: "matricula", label: "Matricula" },
          { key: "nombres", label: "Nombre", kind: "name" },
          { key: "tipoPersona", label: "Tipo" },
          { key: "carrera", label: "Carrera" },
          { key: "entradaAt", label: "Entrada", kind: "date" },
          { key: "salidaAt", label: "Salida", kind: "date" },
          { key: "status", label: "Estado", kind: "status" },
          { key: "accessMode", label: "Modo" },
          { key: "vehiclePlate", label: "Vehiculo" }
        ]} />
      </section>
    {/if}

    {#if activeTab === "attendance"}
      <section class="panel">
        <div class="tabla-header">
          <h2>Asistencias del dia</h2>
          <span>{attendanceTotal} asistencias</span>
        </div>
        <div class="toolbar">
          <input bind:value={filters.q} placeholder="Buscar alumno o materia" />
          <input bind:value={filters.date} type="date" />
          <button onclick={refreshAttendance}>Filtrar</button>
        </div>
        <DataTable rows={attendanceRows} columns={[
          { key: "matricula", label: "Matricula" },
          { key: "nombres", label: "Estudiante", kind: "name" },
          { key: "subjectName", label: "Materia" },
          { key: "aula", label: "Aula" },
          { key: "horaInicio", label: "Inicio" },
          { key: "horaFin", label: "Fin" },
          { key: "porcentaje", label: "%" },
          { key: "estado", label: "Estado", kind: "status" }
        ]} />
      </section>
    {/if}

    {#if activeTab === "hotqr"}
      <section class="grid two">
        <form class="panel" onsubmit={(event) => { event.preventDefault(); createHotQr(); }}>
          <h2>Hot-QR</h2>
          <input bind:value={hotQrForm.visitorName} placeholder="Visitante" required />
          <input bind:value={hotQrForm.reason} placeholder="Motivo" required />
          <select bind:value={hotQrForm.minutes}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hora</option>
            <option value={120}>2 horas</option>
            <option value={240}>4 horas</option>
            <option value={480}>8 horas</option>
          </select>
          <button>Generar Hot-QR</button>
        </form>
        <section class="panel">
          <DataTable rows={hotQrRows} columns={[
            { key: "visitorName", label: "Visitante" },
            { key: "reason", label: "Motivo" },
            { key: "status", label: "Estado", kind: "status" },
            { key: "validUntil", label: "Expira", kind: "date" },
            { key: "creator", label: "Creador" }
          ]} />
        </section>
      </section>
    {/if}

    {#if activeTab === "vehicles"}
      <section class="grid two">
        <form class="panel" onsubmit={(event) => { event.preventDefault(); createVehicle(); }}>
          <h2>Registrar vehiculo</h2>
          <input bind:value={vehicleForm.ownerPersonId} placeholder="ID persona propietaria" required />
          <input bind:value={vehicleForm.plate} placeholder="Placa" required />
          <input bind:value={vehicleForm.make} placeholder="Marca" />
          <input bind:value={vehicleForm.model} placeholder="Modelo" />
          <input bind:value={vehicleForm.color} placeholder="Color" />
          <button>Guardar vehiculo</button>
        </form>
        <form class="panel" onsubmit={(event) => { event.preventDefault(); createPermitQr(); }}>
          <h2>Permiso vehicular</h2>
          <input bind:value={permitForm.personId} placeholder="ID persona autorizada" required />
          <input bind:value={permitForm.vehicleId} placeholder="ID vehiculo" required />
          <input bind:value={permitForm.validUntil} type="datetime-local" />
          <button>Generar QR vehicular</button>
        </form>
      </section>
      <section class="panel">
        <DataTable rows={vehicleRows} columns={[
          { key: "plate", label: "Placa" },
          { key: "make", label: "Marca" },
          { key: "model", label: "Modelo" },
          { key: "color", label: "Color" },
          { key: "status", label: "Estado", kind: "status" },
          { key: "ownerPersonId", label: "Propietario" }
        ]} />
      </section>
    {/if}

    {#if activeTab === "admins" && session.admin.role === "super_admin"}
      <section class="grid two">
        <form class="panel" onsubmit={(event) => { event.preventDefault(); createAdmin(); }}>
          <h2>Crear administrador</h2>
          <input bind:value={adminForm.username} placeholder="Usuario" required />
          <input bind:value={adminForm.displayName} placeholder="Nombre" required />
          <input bind:value={adminForm.email} placeholder="Correo" />
          <select bind:value={adminForm.role}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
          <input bind:value={adminForm.temporaryPassword} placeholder="Password temporal opcional" />
          <button>Crear admin</button>
        </form>
        <section class="panel">
          <DataTable rows={adminRows} columns={[
            { key: "username", label: "Usuario" },
            { key: "displayName", label: "Nombre" },
            { key: "email", label: "Correo" },
            { key: "role", label: "Rol" },
            { key: "status", label: "Estado", kind: "status" }
          ]} />
        </section>
      </section>
    {:else if activeTab === "admins"}
      <section class="panel"><p class="muted">Modulo disponible para super administradores.</p></section>
    {/if}

    {#if activeTab === "config"}
      <form class="panel" onsubmit={(event) => { event.preventDefault(); saveConfig(); }}>
        <h2>Configuracion operativa</h2>
        <textarea bind:value={configValue} rows="12"></textarea>
        <button>Guardar configuracion</button>
      </form>
    {/if}

    {#if activeTab === "generator" || activeTab === "access"}
      <section class="panel">
        <h2>Scanner embebido</h2>
        <ScannerView result={scannerResult} recentRows={accessRows} onScan={scan} />
      </section>
    {/if}
  </AdminShell>
{/if}
