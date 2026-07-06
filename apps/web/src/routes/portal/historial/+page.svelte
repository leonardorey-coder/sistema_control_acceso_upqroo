<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { apiRequest } from "$lib/api/client";
  import DataTable from "$lib/components/DataTable.svelte";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";

  type Row = Record<string, unknown>;
  type PortalSession = {
    user: { fullName: string; matricula: string; personType: string };
    expiresAt: string;
  };

  let session = $state<PortalSession | null>(null);
  let accessRows = $state<Row[]>([]);
  let attendanceRows = $state<Row[]>([]);
  let temporaryRows = $state<Row[]>([]);

  async function resetHistoryState() {
    session = null;
    accessRows = [];
    attendanceRows = [];
    temporaryRows = [];
    await goto("/portal/login", { replaceState: true });
  }

  async function load() {
    try {
      session = await apiRequest<PortalSession>("/api/v1/portal/me");
      accessRows = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/access/recent")).rows;
      attendanceRows = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/attendance/recent")).rows;
      temporaryRows = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/temporary-daily-qr/history")).rows;
    } catch {
      await resetHistoryState();
    }
  }

  async function logout() {
    await apiRequest("/api/v1/portal/auth/logout", { method: "POST" }).catch(() => null);
    await resetHistoryState();
  }

  onMount(() => {
    load();
    const expireHandler = () => {
      resetHistoryState().catch(() => null);
    };
    window.addEventListener("control-acceso:session-expired", expireHandler);
    return () => window.removeEventListener("control-acceso:session-expired", expireHandler);
  });
</script>

<svelte:head><title>Historial - Sistema de Control</title></svelte:head>

<LegacyHeader title="Historial" actionHref="/portal" actionLabel="Portal" session={session} onLogout={logout} />

<main class="legacy-main">
  <section class="panel">
    <h2>Accesos recientes</h2>
    <DataTable rows={accessRows} columns={[
      { key: "entradaAt", label: "Entrada", kind: "date" },
      { key: "salidaAt", label: "Salida", kind: "date" },
      { key: "status", label: "Estado", kind: "status" },
      { key: "accessMode", label: "Modo" },
      { key: "credentialType", label: "Credencial" }
    ]} />
  </section>
  <section class="panel">
    <h2>Asistencias recientes</h2>
    <DataTable rows={attendanceRows} columns={[
      { key: "fechaClase", label: "Fecha" },
      { key: "horaInicio", label: "Inicio" },
      { key: "horaFin", label: "Fin" },
      { key: "porcentaje", label: "%" },
      { key: "estado", label: "Estado", kind: "status" }
    ]} />
  </section>
  <section class="panel">
    <h2>QR temporales</h2>
    <DataTable rows={temporaryRows} columns={[
      { key: "operationalDate", label: "Fecha" },
      { key: "reasonCode", label: "Motivo" },
      { key: "status", label: "Estado", kind: "status" },
      { key: "validUntil", label: "Expira", kind: "date" }
    ]} />
  </section>
</main>
