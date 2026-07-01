<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";

  let {
    icon,
    label,
    tone = "ghost",
    type = "button",
    disabled = false,
    compact = false,
    loading = false,
    onClick
  }: {
    icon: IconName;
    label: string;
    tone?: "primary" | "ghost" | "danger";
    type?: "button" | "submit";
    disabled?: boolean;
    compact?: boolean;
    loading?: boolean;
    onClick?: () => void | Promise<void>;
  } = $props();
</script>

<button
  class={`icon-action ${tone} ${compact ? "compact" : ""}`}
  {type}
  disabled={disabled || loading}
  aria-busy={loading}
  aria-label={label}
  title={label}
  onclick={() => onClick?.()}
>
  {#if loading}
    <span class="button-spinner" aria-hidden="true"></span>
  {:else}
    <Icon name={icon} />
  {/if}
  <span class="icon-action-label">{label}</span>
</button>
