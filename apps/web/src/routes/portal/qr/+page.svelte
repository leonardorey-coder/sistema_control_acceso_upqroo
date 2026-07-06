<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { apiRequest } from "$lib/api/client";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import QrPreview from "$lib/components/QrPreview.svelte";
  import { clearStoredDevice, ensureDevice, getApiErrorCode, isDeviceBindingError } from "$lib/portal/device-binding";
  import { requestPersonalDynamicQr } from "$lib/portal/qr";

  type Row = Record<string, unknown>;
  type PortalSession = {
    user: { fullName: string; matricula: string; personType: string };
    expiresAt: string;
  };

  let session = $state<PortalSession | null>(null);
  let qrToken = $state("");
  let qrCredential = $state<Row | null>(null);
  let expiresAt = $state("");
  let secondsLeft = $state(0);
  let dynamicEnabled = $state(true);
  let deviceStatus = $state("Preparando dispositivo...");
  let canRegenerateDevice = $state(false);
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let error = $state("");

  async function resetQrState() {
    if (refreshTimer) clearTimeout(refreshTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    refreshTimer = null;
    countdownTimer = null;
    session = null;
    qrToken = "";
    qrCredential = null;
    expiresAt = "";
    secondsLeft = 0;
    deviceStatus = "Preparando dispositivo...";
    canRegenerateDevice = false;
    error = "";
    await goto("/portal/login", { replaceState: true });
  }

  async function load() {
    try {
      session = await apiRequest<PortalSession>("/api/v1/portal/me");
      await loadDynamicQr();
    } catch {
      if (!session) await goto("/portal/login");
    }
  }

  function scheduleCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      secondsLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
    }, 500);
  }

  async function loadDynamicQr() {
    error = "";
    canRegenerateDevice = false;
    try {
      const result = await requestPersonalDynamicQr((status) => (deviceStatus = status));
      dynamicEnabled = true;
      qrToken = result.token;
      expiresAt = result.expiresAt;
      if (result.deviceId) deviceStatus = "Dispositivo firmado";
      secondsLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      scheduleCountdown();
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(loadDynamicQr, result.refreshAfterMs);
    } catch (dynamicError) {
      const code = getApiErrorCode(dynamicError);
      if (code === "SIGNED_QR_DISABLED") {
        dynamicEnabled = false;
        qrCredential = (await apiRequest<{ credential: Row | null }>("/api/v1/portal/qr")).credential;
        error = "QR dinamico desactivado";
        return;
      }
      if (isDeviceBindingError(code)) {
        await clearStoredDevice().catch(() => null);
        deviceStatus = "Dispositivo requiere vinculacion";
        canRegenerateDevice = true;
        error = "El vinculo de este dispositivo ya no es valido. Regenera el vinculo local para continuar.";
        return;
      }
      qrToken = "";
      error = dynamicError instanceof Error ? dynamicError.message : "No se pudo generar el QR dinamico";
    }
  }

  async function regenerateDeviceAndRefresh() {
    error = "";
    canRegenerateDevice = false;
    deviceStatus = "Registrando dispositivo...";
    try {
      await clearStoredDevice().catch(() => null);
      await ensureDevice((status) => (deviceStatus = status));
      await loadDynamicQr();
    } catch (deviceError) {
      canRegenerateDevice = true;
      error = deviceError instanceof Error ? deviceError.message : "No se pudo registrar el dispositivo";
    }
  }

  async function rotateQr() {
    const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/portal/qr/rotate", { method: "POST" });
    qrCredential = result.credential;
    qrToken = result.token;
  }

  async function logout() {
    await apiRequest("/api/v1/portal/auth/logout", { method: "POST" }).catch(() => null);
    await resetQrState();
  }

  onMount(() => {
    load();
    const expireHandler = () => {
      resetQrState().catch(() => null);
    };
    window.addEventListener("control-acceso:session-expired", expireHandler);
    return () => {
      window.removeEventListener("control-acceso:session-expired", expireHandler);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  });
</script>

<svelte:head><title>Mi QR - Sistema de Control</title></svelte:head>

<LegacyHeader title="Mi QR" actionHref="/portal" actionLabel="Portal" session={session} onLogout={logout} />

<main class="legacy-main portal-qr-page">
  {#if session}
      <section class="panel qr-focus qr-max">
        <QrPreview
          token={qrToken}
          title={session.user.fullName}
          subtitle={dynamicEnabled ? `QR dinamico expira en ${secondsLeft}s` : qrToken ? "Token opaco visible solo en esta emision" : qrCredential ? "QR vigente registrado. Rota para ver un token nuevo." : "No hay QR vigente."}
          showToken={!dynamicEnabled}
        />
        <p class="muted">{deviceStatus}</p>
        {#if error}<p class="muted">{error}</p>{/if}
        {#if dynamicEnabled}
          <button onclick={loadDynamicQr}>Actualizar QR dinamico</button>
        {:else}
          <button onclick={rotateQr}>Rotar QR personal</button>
        {/if}
        {#if canRegenerateDevice}
          <button class="ghost" onclick={regenerateDeviceAndRefresh}>Regenerar vinculo local</button>
        {/if}
      </section>
  {/if}
</main>
