<script lang="ts">
  import { tick } from "svelte";
  import type { Snippet } from "svelte";
  import IconButton from "./IconButton.svelte";

  let {
    open,
    title,
    children,
    onClose,
    size = "md",
    closeOnEscape = true
  }: {
    open: boolean;
    title: string;
    children: Snippet;
    onClose: () => void;
    size?: "sm" | "md" | "lg" | "xl";
    closeOnEscape?: boolean;
  } = $props();

  let modalNode: HTMLDivElement | null = $state(null);
  let previousFocus: Element | null = null;

  $effect(() => {
    if (!open) return;
    previousFocus = document.activeElement;
    tick().then(() => modalNode?.focus());

    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  });
</script>

{#if open}
  <div class="modal-backdrop" role="presentation">
    <div
      class={`modal ${size}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      bind:this={modalNode}
      onkeydown={(event) => {
        if (closeOnEscape && event.key === "Escape") onClose();
      }}
    >
      <header>
        <h3>{title}</h3>
        <IconButton icon="close" label="Cerrar" compact onClick={onClose} />
      </header>
      {@render children()}
    </div>
  </div>
{/if}
