<script lang="ts">
  import { onDestroy } from "svelte";

  let {
    message,
    durationMs = 5000,
    onDismiss
  }: {
    message: string;
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
  <div class="notice dismissible-notice" role="status" aria-live="polite">
    <span>{message}</span>
    <button type="button" class="notice-close" aria-label="Cerrar mensaje" onclick={onDismiss}>&times;</button>
    {#key message}
      <span class="notice-timer" style={`animation-duration: ${durationMs}ms`}></span>
    {/key}
  </div>
{/if}
