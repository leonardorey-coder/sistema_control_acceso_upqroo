<script lang="ts">
  import { onMount } from "svelte";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import ScannerView from "$lib/components/ScannerView.svelte";
  import { apiBaseUrl, apiRequest, toQuery, type PaginatedRows } from "$lib/api/client";

  type Row = Record<string, unknown>;

  let result = $state<Row | null>(null);
  let recentRows = $state<Row[]>([]);
  let apiOnline = $state(false);
  let sessionReady = $state(false);
  let authError = $state("");

  async function refreshRecent() {
    const date = new Date().toISOString().slice(0, 10);
    const response = await apiRequest<PaginatedRows<Row>>(`/api/v1/access/today${toQuery({ date, page: 1, pageSize: 10 })}`);
    recentRows = response.rows;
  }

  async function scan(payload: { token?: string; manualMatricula?: string }) {
    result = await apiRequest<Row>("/api/v1/access/scan", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await refreshRecent();
  }

  onMount(async () => {
    try {
      await apiRequest("/health");
      apiOnline = true;
      await apiRequest("/api/v1/auth/me");
      sessionReady = true;
      await refreshRecent();
    } catch (error) {
      authError = error instanceof Error ? error.message : "Sesion administrativa requerida";
    }

    const socket = new WebSocket(`${apiBaseUrl.replace(/^http/, "ws")}/api/v1/events`);
    socket.addEventListener("message", () => refreshRecent());
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
    <ScannerView {result} {recentRows} onScan={scan} />
  {:else}
    <section class="panel login-card">
      <h2>Sesion requerida</h2>
      <p class="muted">{authError || "Inicia sesion administrativa para usar el scanner."}</p>
      <a class="view-switch" href="/">Ir al panel administrativo</a>
    </section>
  {/if}
</main>
