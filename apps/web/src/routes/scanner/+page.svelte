<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import type { ScannerResultPayload } from "@control-acceso/shared";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import ScannerView from "$lib/components/ScannerView.svelte";
  import { apiRequest } from "$lib/api/client";

  type Row = Record<string, unknown>;

  let apiOnline = $state(false);
  let sessionReady = $state(false);
  let authError = $state("");
  const scannerId = $derived(page.url.searchParams.get("scannerId") ?? "");
  const storageKey = $derived(scannerId ? `scanner:last-result:${scannerId}` : "scanner:last-result");

  async function scan(payload: { token?: string; signedQr?: string; manualMatricula?: string; scannerId?: string }) {
    const result = await apiRequest<ScannerResultPayload & Row>("/api/v1/access/scan", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    sessionStorage.setItem(storageKey, JSON.stringify(result));
    sessionStorage.setItem("scanner:last-result", JSON.stringify(result));
  }

  onMount(async () => {
    try {
      await apiRequest("/health");
      apiOnline = true;
      await apiRequest("/api/v1/auth/me");
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
    <ScannerView {scannerId} onScan={scan} />
  {:else}
    <section class="panel login-card">
      <h2>Sesion requerida</h2>
      <p class="muted">{authError || "Inicia sesion administrativa para usar el scanner."}</p>
      <a class="view-switch" href="/">Ir al panel administrativo</a>
    </section>
  {/if}
</main>
