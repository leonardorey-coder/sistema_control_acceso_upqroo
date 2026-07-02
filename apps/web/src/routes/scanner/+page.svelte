<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import type { AdminSessionPayload, ScannerResultPayload } from "@control-acceso/shared";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import ScannerView from "$lib/components/ScannerView.svelte";
  import { apiRequest } from "$lib/api/client";
  import {
    buildScannerProof,
    clearStoredScannerDevice,
    readStoredScannerDevice,
    refreshScannerDeviceStatus,
    requestScannerDevice,
    type StoredScannerDevice
  } from "$lib/scanner-device";

  type Row = Record<string, unknown>;

  let apiOnline = $state(false);
  let sessionReady = $state(false);
  let authError = $state("");
  let adminId = $state("");
  let adminRole = $state<AdminSessionPayload["admin"]["role"]>("admin");
  let scannerDevice = $state<StoredScannerDevice | null>(null);
  let scannerDeviceLabel = $state("");
  let scannerDeviceBusy = $state(false);
  let scannerDeviceError = $state("");
  const scannerId = $derived(page.url.searchParams.get("scannerId") ?? "");
  const isSuperAdmin = $derived(adminRole === "super_admin");
  const scannerReady = $derived(isSuperAdmin || scannerDevice?.status === "active");
  const effectiveScannerId = $derived(scannerDevice?.code || scannerId || (isSuperAdmin ? "super-admin-scanner" : ""));
  const storageKey = $derived(effectiveScannerId ? `scanner:last-result:${effectiveScannerId}` : "scanner:last-result");

  async function scan(payload: { token?: string; signedQr?: string; manualMatricula?: string; scannerId?: string }) {
    let requestPayload: Record<string, unknown> = { ...payload };
    if (!isSuperAdmin && scannerDevice?.status === "active" && adminId) {
      const proof = await buildScannerProof({
        adminId,
        device: scannerDevice,
        payload
      });
      requestPayload = {
        ...payload,
        ...proof,
        scannerId: proof.scannerCode
      };
    }

    const result = await apiRequest<ScannerResultPayload & Row>("/api/v1/access/scan", {
      method: "POST",
      body: JSON.stringify(requestPayload)
    });
    sessionStorage.setItem(storageKey, JSON.stringify(result));
    sessionStorage.setItem("scanner:last-result", JSON.stringify(result));
  }

  async function registerDevice() {
    scannerDeviceBusy = true;
    scannerDeviceError = "";
    try {
      scannerDevice = await requestScannerDevice({
        label: scannerDeviceLabel || navigator.userAgent.slice(0, 120)
      });
    } catch (error) {
      scannerDeviceError = error instanceof Error ? error.message : "No se pudo solicitar autorizacion";
    } finally {
      scannerDeviceBusy = false;
    }
  }

  async function refreshDeviceStatus() {
    if (!scannerDevice) return;
    scannerDeviceBusy = true;
    scannerDeviceError = "";
    try {
      scannerDevice = await refreshScannerDeviceStatus(scannerDevice);
    } catch (error) {
      scannerDeviceError = error instanceof Error ? error.message : "No se pudo consultar la autorizacion";
    } finally {
      scannerDeviceBusy = false;
    }
  }

  async function forgetDevice() {
    await clearStoredScannerDevice();
    scannerDevice = null;
  }

  onMount(async () => {
    try {
      await apiRequest("/health");
      apiOnline = true;
      const session = await apiRequest<AdminSessionPayload>("/api/v1/auth/me");
      adminId = session.admin.id;
      adminRole = session.admin.role;
      if (session.admin.role !== "super_admin") {
        scannerDevice = await readStoredScannerDevice().catch(() => null);
      }
      if (scannerDevice && session.admin.role !== "super_admin") {
        scannerDevice = await refreshScannerDeviceStatus(scannerDevice).catch(() => scannerDevice);
      }
      sessionReady = true;
    } catch (error) {
      authError = error instanceof Error ? error.message : "Sesion administrativa requerida";
    }
  });
</script>

<svelte:head>
  <title>Acceso - Sistema de Control</title>
</svelte:head>

<LegacyHeader title="Escaner de Acceso" actionHref="/" actionLabel="Panel Administrativo" />

<main class="legacy-main">
  <div class="api-state">
    <span class={apiOnline ? "dot ok-dot" : "dot bad-dot"}></span>
    API {apiOnline ? "activa" : "sin conexion"}
  </div>
  {#if sessionReady}
    {#if isSuperAdmin}
      <section class="panel scanner-card">
        <div class="section-title">
          <h2>Dispositivo scanner</h2>
          <span>Superadmin</span>
        </div>
        <p class="muted">Acceso directo habilitado. La autorizacion de dispositivo aplica para admins operativos.</p>
      </section>
    {:else}
      <section class="panel scanner-card">
        <div class="section-title">
          <h2>Dispositivo scanner</h2>
          <span>{scannerDevice ? scannerDevice.status : "No solicitado"}</span>
        </div>
        {#if scannerDevice}
          {#if scannerDevice.status === "active"}
            <p class="muted">Scanner autorizado: <strong>{scannerDevice.code}</strong></p>
          {:else if scannerDevice.status === "pending"}
            <p class="muted">Solicitud enviada. Un superadmin debe aprobar este dispositivo en Administradores -> Scanners.</p>
          {:else}
            <p class="error" role="alert">Este dispositivo scanner esta {scannerDevice.status}. Solicita una nueva autorizacion.</p>
          {/if}
          <button type="button" class="ghost" onclick={refreshDeviceStatus} disabled={scannerDeviceBusy}>
            {scannerDeviceBusy ? "Consultando..." : "Consultar autorizacion"}
          </button>
          <button type="button" class="ghost" onclick={forgetDevice}>Olvidar este dispositivo</button>
        {:else}
          <form class="filter-bar" aria-busy={scannerDeviceBusy} onsubmit={(event) => { event.preventDefault(); registerDevice(); }}>
            <label class="form-field">
              <span>Tag del dispositivo</span>
              <input bind:value={scannerDeviceLabel} placeholder="Mi celular caseta principal" />
            </label>
            <button type="submit" disabled={scannerDeviceBusy}>
              {scannerDeviceBusy ? "Solicitando..." : "Solicitar autorizacion"}
            </button>
          </form>
          <p class="muted">El navegador generara una clave privada local. El servidor guardara solo la clave publica para que el superadmin apruebe este dispositivo.</p>
          {#if scannerDeviceError}
            <p class="error" role="alert">{scannerDeviceError}</p>
          {/if}
        {/if}
      </section>
    {/if}
    {#if scannerReady}
      <ScannerView scannerId={effectiveScannerId} onScan={scan} />
    {/if}
  {:else}
    <section class="panel login-card">
      <h2>Sesion requerida</h2>
      <p class="muted">{authError || "Inicia sesion administrativa para usar el scanner."}</p>
      <a class="view-switch" href="/">Ir al panel administrativo</a>
    </section>
  {/if}
</main>
