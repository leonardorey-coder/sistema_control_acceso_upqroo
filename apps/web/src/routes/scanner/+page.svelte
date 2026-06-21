<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { ScannerResultPayload } from "@control-acceso/shared";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import ScannerView from "$lib/components/ScannerView.svelte";
  import { apiBaseUrl, apiRequest, toQuery, type PaginatedRows } from "$lib/api/client";

  type Row = Record<string, unknown>;

  let result = $state<(ScannerResultPayload & Row) | null>(null);
  let recentRows = $state<Row[]>([]);
  let apiOnline = $state(false);
  let sessionReady = $state(false);
  let authError = $state("");
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  let shouldReconnect = false;

  function closeSocket() {
    shouldReconnect = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    socket?.close();
    socket = null;
  }

  function connectSocket() {
    closeSocket();
    shouldReconnect = true;
    socket = new WebSocket(`${apiBaseUrl.replace(/^http/, "ws")}/api/v1/events`);
    socket.addEventListener("open", () => {
      reconnectDelay = 1000;
    });
    socket.addEventListener("message", () => refreshRecent());
    socket.addEventListener("close", () => {
      if (!shouldReconnect || !sessionReady) return;
      reconnectTimer = setTimeout(connectSocket, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15000);
    });
  }

  async function refreshRecent() {
    const date = new Date().toISOString().slice(0, 10);
    const response = await apiRequest<PaginatedRows<Row>>(`/api/v1/access/today${toQuery({ date, page: 1, pageSize: 10 })}`);
    recentRows = response.rows;
  }

  async function scan(payload: { token?: string; signedQr?: string; manualMatricula?: string }) {
    result = await apiRequest<ScannerResultPayload & Row>("/api/v1/access/scan", {
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
      connectSocket();
    } catch (error) {
      authError = error instanceof Error ? error.message : "Sesion administrativa requerida";
    }
  });

  onDestroy(closeSocket);
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
