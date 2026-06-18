<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    open,
    title,
    children,
    onClose
  }: {
    open: boolean;
    title: string;
    children: Snippet;
    onClose: () => void;
  } = $props();
</script>

{#if open}
  <div class="modal-backdrop" role="presentation" onclick={onClose}>
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header>
        <h3>{title}</h3>
        <button class="ghost icon-button" onclick={onClose} aria-label="Cerrar">x</button>
      </header>
      {@render children()}
    </div>
  </div>
{/if}
