<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { apiRequest } from "$lib/api/client";
  import ActionCard from "$lib/components/ActionCard.svelte";
  import DataTable from "$lib/components/DataTable.svelte";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import QrPreview from "$lib/components/QrPreview.svelte";
  import { clearStoredDevice, ensureDevice, getApiErrorCode, isDeviceBindingError, readStoredDevice } from "$lib/portal/device-binding";
  import { requestPersonalDynamicQr, requestTemporaryDynamicQr } from "$lib/portal/qr";

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
  let dynamicQrEnabled = $state(true);
  let deviceStatus = $state("Dispositivo pendiente");
  let deviceError = $state("");
  let devices = $state<Row[]>([]);
  let passwordForm = $state({ currentPassword: "", newPassword: "" });
  let passwordNotice = $state("");
  let passwordError = $state("");
  let accessRows = $state<Row[]>([]);
  let attendanceRows = $state<Row[]>([]);
  let error = $state("");

  async function resetPortalState() {
    session = null;
    qrToken = "";
    qrCredential = null;
    temporaryToken = "";
    temporaryCredential = null;
    temporaryHistory = [];
    temporaryForm = { reasonCode: "credential_unavailable", reasonText: "" };
    deviceStatus = "Dispositivo pendiente";
    deviceError = "";
    devices = [];
    passwordForm = { currentPassword: "", newPassword: "" };
    passwordNotice = "";
    passwordError = "";
    accessRows = [];
    attendanceRows = [];
    await goto("/portal/login", { replaceState: true });
  }

  async function loadDevices() {
    devices = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/devices")).rows;
  }

  async function handleDeviceBindingError(error: unknown) {
    const code = getApiErrorCode(error);
    if (!isDeviceBindingError(code)) return false;

    await clearStoredDevice().catch(() => null);
    deviceStatus = "Dispositivo requiere vinculacion";
    deviceError = "El vinculo de este dispositivo ya no es valido. Regenera el vinculo local e intenta de nuevo.";
    await loadDevices().catch(() => null);
    return true;
  }

  async function loadPortal() {
    try {
      session = await apiRequest<PortalSession>("/api/v1/portal/me");
      const qr = await apiRequest<{ credential: Row | null }>("/api/v1/portal/qr");
      qrCredential = qr.credential;
      await loadDevices();
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
    try {
      deviceError = "";
      const result = await requestPersonalDynamicQr((status) => (deviceStatus = status));
      dynamicQrEnabled = true;
      qrToken = result.token;
      if (result.deviceId) deviceStatus = "Dispositivo firmado";
    } catch (qrError) {
      if (await handleDeviceBindingError(qrError)) return;
      const code = getApiErrorCode(qrError);
      if (code !== "SIGNED_QR_DISABLED") throw qrError;
      dynamicQrEnabled = false;
      const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/portal/qr/rotate", {
        method: "POST"
      });
      qrCredential = result.credential;
      qrToken = result.token;
    }
  }

  async function requestTemporaryQr() {
    const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/portal/temporary-daily-qr/request", {
      method: "POST",
      body: JSON.stringify(temporaryForm)
    });
    temporaryCredential = result.credential;
    try {
      deviceError = "";
      const dynamic = await requestTemporaryDynamicQr((status) => (deviceStatus = status));
      dynamicQrEnabled = true;
      temporaryToken = dynamic.token;
      if (dynamic.deviceId) deviceStatus = "Dispositivo firmado";
    } catch (temporaryError) {
      if (await handleDeviceBindingError(temporaryError)) return;
      const code = getApiErrorCode(temporaryError);
      if (code !== "SIGNED_QR_DISABLED") throw temporaryError;
      dynamicQrEnabled = false;
      temporaryToken = result.token;
    }
    temporaryHistory = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/temporary-daily-qr/history")).rows;
  }

  async function resetLocalDevice() {
    deviceError = "";
    await clearStoredDevice().catch(() => null);
    deviceStatus = "Vinculo local regenerado";
    await ensureDevice((status) => (deviceStatus = status)).then(loadDevices).catch((resetError) => {
      deviceError = resetError instanceof Error ? resetError.message : "No se pudo registrar el dispositivo";
    });
  }

  async function revokeDevice(row: Row) {
    const id = String(row.id ?? "");
    if (!id) return;

    deviceError = "";
    await apiRequest(`/api/v1/portal/devices/${id}`, { method: "DELETE" });
    const stored = await readStoredDevice().catch(() => null);
    if (stored?.id === id) {
      await clearStoredDevice().catch(() => null);
      deviceStatus = "Dispositivo actual revocado";
    }
    await loadDevices();
  }

  async function logout() {
    await apiRequest("/api/v1/portal/auth/logout", { method: "POST" }).catch(() => null);
    await resetPortalState();
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

  onMount(() => {
    loadPortal();
    const expireHandler = () => {
      resetPortalState().catch(() => null);
    };
    window.addEventListener("control-acceso:session-expired", expireHandler);
    return () => window.removeEventListener("control-acceso:session-expired", expireHandler);
  });
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
        <label class="form-field">
          <span>Password actual</span>
          <input type="password" bind:value={passwordForm.currentPassword} placeholder="PasswordAnterior2026" required />
        </label>
        <label class="form-field">
          <span>Nuevo password</span>
          <input type="password" bind:value={passwordForm.newPassword} placeholder="NuevoPassword2026" minlength="8" required />
        </label>
        <button>Actualizar password</button>
      </form>
    {/if}

    <section class="grid two">
      <section class="panel qr-focus">
        <QrPreview
          token={qrToken}
          title="QR personal"
          subtitle={qrToken ? dynamicQrEnabled ? "QR dinamico firmado para esta sesion" : "Token visible solo en esta emision" : qrCredential ? "QR vigente registrado. Genera para mostrar un token nuevo." : "No hay QR vigente visible."}
          showToken={!dynamicQrEnabled}
        />
        <p class="muted">{deviceStatus}</p>
        <button onclick={rotateQr}>Generar QR personal</button>
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
      <div class="section-header">
        <div>
          <h2>Dispositivos vinculados</h2>
          <p class="muted">{deviceStatus}</p>
        </div>
        <button type="button" onclick={resetLocalDevice}>Regenerar vinculo local</button>
      </div>
      {#if deviceError}<p class="error">{deviceError}</p>{/if}
      <div class="action-grid">
        {#each devices as device}
          <ActionCard
            title={String(device.label ?? "Dispositivo")}
            subtitle={String(device.id ?? "")}
            avatar="DV"
            badges={[device.status]}
            meta={[
              { label: "Ultimo uso", value: device.lastUsedAt, kind: "date" },
              { label: "Alta", value: device.createdAt, kind: "date" }
            ]}
            actions={[
              { label: "Revocar", icon: "revoke", tone: "danger", confirm: "Esta accion revoca el dispositivo vinculado.", onClick: () => revokeDevice(device) }
            ]}
          />
        {/each}
      </div>
    </section>

    <section class="grid two">
      <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); requestTemporaryQr(); }}>
        <h2>QR temporal diario</h2>
        <label class="form-field">
          <span>Motivo</span>
          <select bind:value={temporaryForm.reasonCode}>
            <option value="credential_unavailable">Credencial no disponible</option>
            <option value="credential_lost">Credencial extraviada</option>
            <option value="credential_damaged">Credencial dañada</option>
          </select>
        </label>
        <label class="form-field">
          <span>Detalle</span>
          <textarea bind:value={temporaryForm.reasonText} placeholder="Olvide mi credencial en casa"></textarea>
        </label>
        <button>Solicitar QR temporal</button>
      </form>
      <section class="panel qr-focus">
        <QrPreview
          token={temporaryToken}
          title="QR temporal diario"
          subtitle={temporaryToken ? dynamicQrEnabled ? "QR temporal dinamico firmado" : "Token visible solo en esta solicitud" : temporaryCredential ? "Ya existe un QR temporal vigente para hoy." : "No hay QR temporal activo."}
          showToken={!dynamicQrEnabled}
        />
      </section>
    </section>

    <section class="panel">
      <h2>Temporales recientes</h2>
      <div class="action-grid">
        {#each temporaryHistory as item}
          <ActionCard
            title={String(item.operationalDate ?? "QR temporal")}
            subtitle={String(item.reasonText ?? item.reasonCode ?? "")}
            avatar="QR"
            badges={[item.status]}
            meta={[
              { label: "Motivo", value: item.reasonCode },
              { label: "Expira", value: item.validUntil, kind: "date" }
            ]}
          />
        {/each}
      </div>
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
