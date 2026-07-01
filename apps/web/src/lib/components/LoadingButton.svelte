<script lang="ts">
  let {
    loading = false,
    loadingLabel = "Procesando...",
    type = "button",
    disabled = false,
    tone = "primary",
    onClick,
    children
  }: {
    loading?: boolean;
    loadingLabel?: string;
    type?: "button" | "submit";
    disabled?: boolean;
    tone?: "primary" | "ghost" | "danger";
    onClick?: () => void | Promise<void>;
    children?: import("svelte").Snippet;
  } = $props();
</script>

<button
  class={`loading-button ${tone === "ghost" ? "ghost" : tone === "danger" ? "danger-button" : ""}`}
  {type}
  disabled={disabled || loading}
  aria-busy={loading}
  onclick={() => onClick?.()}
>
  {#if loading}
    <span class="button-spinner" aria-hidden="true"></span>
    <span>{loadingLabel}</span>
  {:else if children}
    {@render children()}
  {/if}
</button>
