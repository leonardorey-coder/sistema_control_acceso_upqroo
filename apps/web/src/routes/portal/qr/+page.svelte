<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { apiRequest } from "$lib/api/client";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import QrPreview from "$lib/components/QrPreview.svelte";

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
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
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

  async function ensureDevice() {
    if (!("indexedDB" in window) || !crypto?.subtle) {
      deviceStatus = "Dispositivo sin soporte WebCrypto";
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
    try {
      const proof = await buildDeviceProof();
      const result = await apiRequest<{ token: string; expiresAt: string; refreshAfterMs: number; jti: string; deviceId?: string }>("/api/v1/portal/qr/dynamic", {
        method: "POST",
        body: JSON.stringify(proof)
      });
      dynamicEnabled = true;
      qrToken = result.token;
      expiresAt = result.expiresAt;
      if (result.deviceId) deviceStatus = "Dispositivo firmado";
      secondsLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      scheduleCountdown();
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(loadDynamicQr, result.refreshAfterMs);
    } catch (dynamicError) {
      const code = dynamicError instanceof Error && "code" in dynamicError ? String(dynamicError.code) : "";
      if (code === "SIGNED_QR_DISABLED") {
        dynamicEnabled = false;
        qrCredential = (await apiRequest<{ credential: Row | null }>("/api/v1/portal/qr")).credential;
        error = "QR dinamico desactivado";
        return;
      }
      qrToken = "";
      error = dynamicError instanceof Error ? dynamicError.message : "No se pudo generar el QR dinamico";
    }
  }

  async function rotateQr() {
    const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/portal/qr/rotate", { method: "POST" });
    qrCredential = result.credential;
    qrToken = result.token;
  }

  async function logout() {
    await apiRequest("/api/v1/portal/auth/logout", { method: "POST" }).catch(() => null);
    await goto("/portal/login");
  }

  onMount(() => {
    load();
    return () => {
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
      </section>
  {/if}
</main>
