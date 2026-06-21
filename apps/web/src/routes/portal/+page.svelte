<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { apiRequest } from "$lib/api/client";
  import DataTable from "$lib/components/DataTable.svelte";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
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
  let temporaryToken = $state("");
  let temporaryCredential = $state<Row | null>(null);
  let temporaryHistory = $state<Row[]>([]);
  let temporaryForm = $state({ reasonCode: "credential_unavailable", reasonText: "" });
  let passwordForm = $state({ currentPassword: "", newPassword: "" });
  let passwordNotice = $state("");
  let passwordError = $state("");
  let accessRows = $state<Row[]>([]);
  let attendanceRows = $state<Row[]>([]);
  let error = $state("");

  async function loadPortal() {
    try {
      session = await apiRequest<PortalSession>("/api/v1/portal/me");
      const qr = await apiRequest<{ credential: Row | null }>("/api/v1/portal/qr");
      qrCredential = qr.credential;
      temporaryCredential = (await apiRequest<{ credential: Row | null }>("/api/v1/portal/temporary-daily-qr/current")).credential;
      temporaryHistory = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/temporary-daily-qr/history")).rows;
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

  async function requestTemporaryQr() {
    const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/portal/temporary-daily-qr/request", {
      method: "POST",
      body: JSON.stringify(temporaryForm)
    });
    temporaryCredential = result.credential;
    temporaryToken = result.token;
    temporaryHistory = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/temporary-daily-qr/history")).rows;
  }

  async function logout() {
    await apiRequest("/api/v1/portal/auth/logout", { method: "POST" }).catch(() => null);
    await goto("/portal/login");
  }

  async function changePassword() {
    passwordNotice = "";
    passwordError = "";
    try {
      await apiRequest("/api/v1/portal/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm)
      });
      passwordForm = { currentPassword: "", newPassword: "" };
      if (session) {
        session = {
          ...session,
          user: { ...session.user, mustChangePassword: false }
        };
      }
      passwordNotice = "Password actualizado";
    } catch (changeError) {
      passwordError = changeError instanceof Error ? changeError.message : "No se pudo cambiar el password";
    }
  }

  onMount(loadPortal);
</script>

<svelte:head>
  <title>Mi QR - Sistema de Control</title>
</svelte:head>

<LegacyHeader
  title="Mi QR"
  actionHref="/"
  actionLabel="Panel Administrativo"
  session={session}
  onLogout={logout}
/>

<main class="legacy-main">
  {#if error}<p class="error">{error}</p>{/if}
  {#if session}
    <section class="portal-hero panel">
      <div>
        <p class="muted">{session.user.matricula} · {session.user.personType}</p>
        <h2>{session.user.fullName}</h2>
        <p>Estado: {session.user.status}</p>
      </div>
      <div class="button-row">
        <a class="view-switch-button" href="/portal/qr">Ver QR</a>
        <a class="view-switch-button" href="/portal/historial">Historial</a>
      </div>
    </section>

    {#if session.user.mustChangePassword}
      <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); changePassword(); }}>
        <h2>Cambiar password</h2>
        <p class="muted">Actualiza tu password para continuar usando el portal.</p>
        {#if passwordNotice}<p class="notice">{passwordNotice}</p>{/if}
        {#if passwordError}<p class="error">{passwordError}</p>{/if}
        <input type="password" bind:value={passwordForm.currentPassword} placeholder="Password actual" required />
        <input type="password" bind:value={passwordForm.newPassword} placeholder="Nuevo password" minlength="8" required />
        <button>Actualizar password</button>
      </form>
    {/if}

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

    <section class="grid two">
      <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); requestTemporaryQr(); }}>
        <h2>QR temporal diario</h2>
        <select bind:value={temporaryForm.reasonCode}>
          <option value="credential_unavailable">Credencial no disponible</option>
          <option value="credential_lost">Credencial extraviada</option>
          <option value="credential_damaged">Credencial dañada</option>
        </select>
        <textarea bind:value={temporaryForm.reasonText} placeholder="Detalle opcional"></textarea>
        <button>Solicitar QR temporal</button>
      </form>
      <section class="panel qr-focus">
        <QrPreview
          token={temporaryToken}
          title="QR temporal diario"
          subtitle={temporaryToken ? "Token visible solo en esta solicitud" : temporaryCredential ? "Ya existe un QR temporal vigente para hoy." : "No hay QR temporal activo."}
        />
      </section>
    </section>

    <section class="panel">
      <h2>Temporales recientes</h2>
      <DataTable rows={temporaryHistory} columns={[
        { key: "operationalDate", label: "Fecha" },
        { key: "reasonCode", label: "Motivo" },
        { key: "status", label: "Estado", kind: "status" },
        { key: "validUntil", label: "Expira", kind: "date" }
      ]} />
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
