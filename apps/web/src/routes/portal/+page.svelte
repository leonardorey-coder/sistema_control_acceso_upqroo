<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { apiRequest } from "$lib/api/client";
  import DataTable from "$lib/components/DataTable.svelte";
  import QrPreview from "$lib/components/QrPreview.svelte";

  type Row = Record<string, unknown>;
  type PortalSession = {
    user: {
      accountId: string;
      personId: string;
      email: string;
      matricula: string;
      fullName: string;
      personType: string;
      status: string;
      mustChangePassword: boolean;
    };
    expiresAt: string;
  };

  let session = $state<PortalSession | null>(null);
  let qrToken = $state("");
  let qrCredential = $state<Row | null>(null);
  let accessRows = $state<Row[]>([]);
  let attendanceRows = $state<Row[]>([]);
  let error = $state("");

  async function loadPortal() {
    try {
      session = await apiRequest<PortalSession>("/api/v1/portal/me");
      const qr = await apiRequest<{ credential: Row | null }>("/api/v1/portal/qr");
      qrCredential = qr.credential;
      accessRows = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/access/recent")).rows;
      attendanceRows = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/attendance/recent")).rows;
    } catch (loadError) {
      error = loadError instanceof Error ? loadError.message : "Sesion requerida";
      await goto("/portal/login");
    }
  }

  async function rotateQr() {
    const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/portal/qr/rotate", {
      method: "POST"
    });
    qrCredential = result.credential;
    qrToken = result.token;
  }

  async function logout() {
    await apiRequest("/api/v1/portal/auth/logout", { method: "POST" }).catch(() => null);
    await goto("/portal/login");
  }

  onMount(loadPortal);
</script>

<svelte:head>
  <title>Mi QR - Sistema de Control</title>
</svelte:head>

<header class="legacy-header">
  <div class="header-left">
    <div class="logo-mark">UP</div>
    <div class="divider"></div>
    <h1>Mi QR</h1>
  </div>
  <div class="header-right">
    <a class="view-switch" href="/">Panel Administrativo</a>
    <button class="ghost" onclick={logout}>Salir</button>
  </div>
</header>

<main class="legacy-main">
  {#if error}<p class="error">{error}</p>{/if}
  {#if session}
    <section class="portal-hero panel">
      <div>
        <p class="muted">{session.user.matricula} · {session.user.personType}</p>
        <h2>{session.user.fullName}</h2>
        <p>Estado: {session.user.status}</p>
      </div>
      <button onclick={rotateQr}>Generar QR vigente</button>
    </section>

    <section class="grid two">
      <section class="panel qr-focus">
        <QrPreview
          token={qrToken}
          title="QR personal"
          subtitle={qrToken ? "Token visible solo en esta emision" : qrCredential ? "QR vigente registrado. Rota para mostrar un token nuevo." : "No hay QR vigente visible."}
        />
      </section>
      <section class="panel">
        <h2>Estado de credencial</h2>
        {#if qrCredential}
          <dl class="detail-list">
            <div><dt>Estado</dt><dd>{qrCredential.status}</dd></div>
            <div><dt>Version</dt><dd>{qrCredential.tokenVersion}</dd></div>
            <div><dt>Expira</dt><dd>{qrCredential.expiresAt ? new Date(String(qrCredential.expiresAt)).toLocaleString("es-MX") : ""}</dd></div>
            <div><dt>Ultimo uso</dt><dd>{qrCredential.lastUsedAt ? new Date(String(qrCredential.lastUsedAt)).toLocaleString("es-MX") : "Sin uso"}</dd></div>
          </dl>
        {:else}
          <p class="muted">No hay credencial activa.</p>
        {/if}
      </section>
    </section>

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
        { key: "aula", label: "Aula" },
        { key: "porcentaje", label: "%" },
        { key: "estado", label: "Estado", kind: "status" }
      ]} />
    </section>
  {/if}
</main>
