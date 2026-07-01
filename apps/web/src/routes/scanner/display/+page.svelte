<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/state";
  import type { ScannerResultPayload } from "@control-acceso/shared";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import ScannerResultDisplay from "$lib/components/ScannerResultDisplay.svelte";
  import { apiBaseUrl, apiRequest } from "$lib/api/client";

  type Row = Record<string, unknown>;
  type EventMessage = {
    topic: string;
    payload?: {
      scannerId?: string;
      result?: ScannerResultPayload & Row;
    };
  };

  let result = $state<(ScannerResultPayload & Row) | null>(null);
  let apiOnline = $state(false);
  let sessionReady = $state(false);
  let authError = $state("");
  let connected = $state(false);
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const scannerId = $derived(page.url.searchParams.get("scannerId") ?? "");
  const storageKey = $derived(scannerId ? `scanner:last-result:${scannerId}` : "scanner:last-result");

  function loadStoredResult() {
    const stored = sessionStorage.getItem(storageKey) ?? sessionStorage.getItem("scanner:last-result");
    if (!stored) return;

    try {
      result = JSON.parse(stored) as ScannerResultPayload & Row;
    } catch {
      result = null;
    }
  }

  function resultMatches(message: EventMessage) {
    if (message.topic !== "access.scan" || !message.payload?.result) return false;
    if (!scannerId) return true;
    return message.payload.scannerId === scannerId;
  }

  function connectSocket() {
    socket?.close();
    socket = new WebSocket(`${apiBaseUrl.replace(/^http/, "ws")}/api/v1/events`);

    socket.addEventListener("open", () => {
      connected = true;
    });

    socket.addEventListener("message", (event) => {
      let message: EventMessage;
      try {
        message = JSON.parse(event.data) as EventMessage;
      } catch {
        return;
      }

      if (!resultMatches(message)) return;
      result = message.payload!.result!;
      sessionStorage.setItem(storageKey, JSON.stringify(result));
      sessionStorage.setItem("scanner:last-result", JSON.stringify(result));
    });

    socket.addEventListener("close", () => {
      connected = false;
      reconnectTimer = setTimeout(connectSocket, 1500);
    });
  }

  onMount(async () => {
    loadStoredResult();
    try {
      await apiRequest("/health");
      apiOnline = true;
      await apiRequest("/api/v1/auth/me");
      sessionReady = true;
      connectSocket();
    } catch (error) {
      authError = error instanceof Error ? error.message : "Sesion administrativa requerida";
    }
  });

  onDestroy(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  });
</script>

<svelte:head>
  <title>Resultado de Acceso - Sistema de Control</title>
</svelte:head>

<LegacyHeader title="Resultado de Acceso" actionHref={scannerId ? `/scanner?scannerId=${encodeURIComponent(scannerId)}` : "/scanner"} actionLabel="Vista Scanner" />

<main class="legacy-main">
  <div class="api-state">
    <span class={apiOnline ? "dot ok-dot" : "dot bad-dot"}></span>
    API {apiOnline ? "activa" : "sin conexion"}
  </div>
  {#if sessionReady}
    <ScannerResultDisplay {result} {scannerId} {connected} />
  {:else}
    <section class="panel login-card">
      <h2>Sesion requerida</h2>
      <p class="muted">{authError || "Inicia sesion administrativa para ver resultados del scanner."}</p>
      <a class="view-switch" href="/">Ir al panel administrativo</a>
    </section>
  {/if}
</main>
