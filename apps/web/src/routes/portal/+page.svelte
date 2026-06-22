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

  type StoredDevice = {
    id: string;
    privateKey: CryptoKey;
  };

  function toBase64Url(bytes: ArrayBuffer) {
    const binary = String.fromCharCode(...new Uint8Array(bytes));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function openDeviceDb() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("control-acceso-device-binding", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("devices");
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function readStoredDevice() {
    const db = await openDeviceDb();
    return new Promise<StoredDevice | null>((resolve, reject) => {
      const tx = db.transaction("devices", "readonly");
      const request = tx.objectStore("devices").get("current");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve((request.result as StoredDevice | undefined) ?? null);
      tx.oncomplete = () => db.close();
    });
  }

  async function writeStoredDevice(device: StoredDevice) {
    const db = await openDeviceDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("devices", "readwrite");
      tx.objectStore("devices").put(device, "current");
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  }

  async function clearStoredDevice() {
    const db = await openDeviceDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("devices", "readwrite");
      tx.objectStore("devices").delete("current");
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  }

  async function loadDevices() {
    devices = (await apiRequest<{ rows: Row[] }>("/api/v1/portal/devices")).rows;
  }

  async function ensureDevice() {
    if (!("indexedDB" in window) || !crypto?.subtle) {
      deviceStatus = "Dispositivo sin soporte criptografico";
      return null;
    }

    const stored = await readStoredDevice().catch(() => null);
    if (stored?.id && stored.privateKey) {
      deviceStatus = "Dispositivo verificado";
      return stored;
    }

    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    );
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const result = await apiRequest<{ device: { id: string } }>("/api/v1/portal/devices", {
      method: "POST",
      body: JSON.stringify({
        publicKeyJwk,
        label: navigator.userAgent.slice(0, 120)
      })
    });
    const device = { id: result.device.id, privateKey: pair.privateKey };
    await writeStoredDevice(device);
    deviceStatus = "Dispositivo registrado";
    await loadDevices();
    return device;
  }

  async function buildDeviceProof() {
    const device = await ensureDevice();
    if (!device) return {};

    const challenge = await apiRequest<{ id: string; message: string }>("/api/v1/portal/devices/challenge", {
      method: "POST",
      body: JSON.stringify({ deviceId: device.id })
    });
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      device.privateKey,
      new TextEncoder().encode(challenge.message)
    );

    return {
      deviceId: device.id,
      challengeId: challenge.id,
      signature: toBase64Url(signature)
    };
  }

  function getApiErrorCode(error: unknown) {
    return error instanceof Error && "code" in error ? String(error.code) : "";
  }

  function isDeviceBindingError(code: string) {
    return [
      "DEVICE_NOT_FOUND",
      "DEVICE_PROOF_REQUIRED",
      "DEVICE_CHALLENGE_INVALID",
      "DEVICE_KEY_INVALID",
      "DEVICE_SIGNATURE_INVALID"
    ].includes(code);
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
      const proof = await buildDeviceProof();
      const result = await apiRequest<{ token: string; expiresAt: string; deviceId?: string }>("/api/v1/portal/qr/dynamic", {
        method: "POST",
        body: JSON.stringify(proof)
      });
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
      const proof = await buildDeviceProof();
      const dynamic = await apiRequest<{ token: string; deviceId?: string }>("/api/v1/portal/temporary-daily-qr/dynamic", {
        method: "POST",
        body: JSON.stringify(proof)
      });
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
    await ensureDevice().catch((resetError) => {
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
      <DataTable rows={devices} columns={[
        { key: "label", label: "Dispositivo" },
        { key: "status", label: "Estado", kind: "status" },
        { key: "lastUsedAt", label: "Ultimo uso", kind: "date" },
        { key: "createdAt", label: "Alta", kind: "date" }
      ]} actions={[
        { label: "Revocar", onClick: revokeDevice }
      ]} />
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
          subtitle={temporaryToken ? dynamicQrEnabled ? "QR temporal dinamico firmado" : "Token visible solo en esta solicitud" : temporaryCredential ? "Ya existe un QR temporal vigente para hoy." : "No hay QR temporal activo."}
          showToken={!dynamicQrEnabled}
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
