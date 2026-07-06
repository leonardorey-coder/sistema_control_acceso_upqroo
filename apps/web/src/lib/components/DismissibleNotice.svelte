<script lang="ts">
  import { onDestroy } from "svelte";
  import Icon from "./Icon.svelte";

  let {
    message,
    detail = "La accion se completo correctamente.",
    tone = "success",
    durationMs = 5000,
    onDismiss
  }: {
    message: string;
    detail?: string;
    tone?: "success" | "warning" | "danger" | "info";
    durationMs?: number;
    onDismiss: () => void;
  } = $props();

  let timeout: ReturnType<typeof setTimeout> | undefined;

  function clearNoticeTimeout() {
    if (!timeout) return;
    clearTimeout(timeout);
    timeout = undefined;
  }

  $effect(() => {
    clearNoticeTimeout();
    if (!message) return;

    timeout = setTimeout(onDismiss, durationMs);
    return clearNoticeTimeout;
  });

  onDestroy(clearNoticeTimeout);
</script>

{#if message}
  <div class={`notice dismissible-notice ${tone}`} role="status" aria-live="polite">
    <span class="notice-status-icon"><Icon name={tone === "success" ? "check" : "warning"} size={16} /></span>
    <span class="notice-copy">
      <strong>{message}</strong>
      {#if detail}<small>{detail}</small>{/if}
    </span>
    <button type="button" class="notice-close" aria-label="Cerrar mensaje" onclick={onDismiss}>&times;</button>
    {#key message}
      <span class="notice-timer" style={`animation-duration: ${durationMs}ms`}></span>
    {/key}
  </div>
{/if}
