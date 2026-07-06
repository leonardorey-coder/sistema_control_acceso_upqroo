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
    size?: "sm" | "md" | "lg" | "xl" | "qr";
    closeOnEscape?: boolean;
  } = $props();

  let modalNode: HTMLDivElement | null = $state(null);
  let previousFocus: Element | null = null;
  let initialControlValues: string[] = [];
  let hasChanges = $state(false);
  const titleId = `modal-title-${Math.random().toString(36).slice(2)}`;
  const controlSelector = "input, textarea, select";

  function portalToBody(node: HTMLDivElement) {
    document.body.appendChild(node);

    return {
      destroy() {
        node.remove();
      }
    };
  }

  function isTopModal() {
    const modals = Array.from(document.querySelectorAll('[role="dialog"].modal'));
    return modals.at(-1) === modalNode;
  }

  function handleEscape(event: KeyboardEvent) {
    if (!open || !closeOnEscape || event.key !== "Escape" || !isTopModal()) return;
    event.preventDefault();
    onClose();
  }

  function getEditableControls() {
    if (!modalNode) return [];
    return Array.from(modalNode.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(controlSelector))
      .filter((control) => {
        if (control.disabled) return false;
        if (!(control instanceof HTMLInputElement)) return true;
        return !["button", "submit", "reset", "image", "hidden"].includes(control.type);
      });
  }

  function readControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
    if (control instanceof HTMLInputElement) {
      if (control.type === "checkbox" || control.type === "radio") return `${control.checked}:${control.value}`;
      if (control.type === "file") return Array.from(control.files ?? []).map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
    }

    if (control instanceof HTMLSelectElement && control.multiple) {
      return Array.from(control.selectedOptions).map((option) => option.value).join("|");
    }

    return control.value;
  }

  function currentControlValues() {
    return getEditableControls().map(readControlValue);
  }

  function captureInitialValues() {
    initialControlValues = currentControlValues();
    hasChanges = false;
  }

  function updateChangeState() {
    const currentValues = currentControlValues();
    hasChanges =
      currentValues.length !== initialControlValues.length ||
      currentValues.some((value, index) => value !== initialControlValues[index]);
  }

  $effect(() => {
    if (!open) return;
    previousFocus = document.activeElement;
    tick().then(() => {
      modalNode?.focus();
      captureInitialValues();
    });

    return () => {
      hasChanges = false;
      initialControlValues = [];
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  });
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
  <div class="modal-backdrop" role="presentation" use:portalToBody>
    <div
      class={`modal ${size}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      bind:this={modalNode}
      oninput={updateChangeState}
      onchange={updateChangeState}
    >
      <header>
        <h3 id={titleId}>
          <span class="modal-title-text">{title}</span>
          {#if hasChanges}
            <span class="modal-dirty-indicator" aria-label="Hay cambios sin guardar" title="Hay cambios sin guardar">*</span>
          {/if}
        </h3>
        <IconButton icon="close" label="Cerrar" compact onClick={onClose} />
      </header>
      {@render children()}
    </div>
  </div>
{/if}
