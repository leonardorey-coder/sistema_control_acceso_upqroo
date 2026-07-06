<script lang="ts">
  import IconButton from "./IconButton.svelte";
  import Modal from "./Modal.svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import type { IconName } from "./Icon.svelte";

  type MetaItem = { label: string; value: unknown; kind?: "status" | "date" | "text" };
  type CardAction = {
    label: string;
    icon?: IconName;
    tone?: "primary" | "ghost" | "danger";
    confirm?: string;
    disabled?: boolean;
    onClick: () => void | Promise<void>;
  };

  let {
    title,
    subtitle = "",
    avatar = "",
    badges = [],
    meta = [],
    actions = []
  }: {
    title: string;
    subtitle?: string;
    avatar?: string;
    badges?: unknown[];
    meta?: MetaItem[];
    actions?: CardAction[];
  } = $props();

  let pendingAction = $state<CardAction | null>(null);
  let runningAction = $state("");

  function actionIcon(action: CardAction): IconName {
    if (action.icon) return action.icon;
    const label = action.label.toLowerCase();
    if (label.includes("editar")) return "edit";
    if (label.includes("sesion") || label.includes("usuario")) return "user";
    if (label.includes("aprobar") || label.includes("activar")) return "check";
    if (label.includes("revocar") || label.includes("desactivar") || label.includes("reset")) return "revoke";
    if (label.includes("qr")) return "qr";
    return "settings";
  }

  function formatMeta(item: MetaItem) {
    if (item.value == null || item.value === "") return "N/A";
    if (item.kind === "date") return new Date(String(item.value)).toLocaleString("es-MX");
    return String(item.value);
  }

  async function runAction(action: CardAction) {
    if (action.disabled) return;
    if (action.confirm) {
      pendingAction = action;
      return;
    }
    runningAction = action.label;
    try {
      await action.onClick();
    } finally {
      if (runningAction === action.label) runningAction = "";
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    pendingAction = null;
    runningAction = action.label;
    try {
      await action.onClick();
    } finally {
      if (runningAction === action.label) runningAction = "";
    }
  }
</script>

<article class="action-card">
  <header class="action-card-header">
    {#if avatar}
      <span class="action-card-avatar" aria-hidden="true">{avatar}</span>
    {/if}
    <div>
      <h3>{title}</h3>
      {#if subtitle}<p>{subtitle}</p>{/if}
    </div>
  </header>

  {#if badges.length}
    <div class="action-card-badges">
      {#each badges as badge}
        <StatusBadge value={badge} />
      {/each}
    </div>
  {/if}

  {#if meta.length}
    <dl class="action-card-meta">
      {#each meta as item}
        <div>
          <dt>{item.label}</dt>
          <dd>
            {#if item.kind === "status"}
              <StatusBadge value={item.value} />
            {:else}
              {formatMeta(item)}
            {/if}
          </dd>
        </div>
      {/each}
    </dl>
  {/if}

  {#if actions.length}
    <div class="action-card-actions">
      {#each actions as action, index}
        <IconButton
          icon={actionIcon(action)}
          label={action.label}
          compact={index > 0}
          tone={action.tone ?? (index === 0 ? "primary" : "ghost")}
          disabled={action.disabled ?? false}
          loading={runningAction === action.label}
          onClick={() => runAction(action)}
        />
      {/each}
    </div>
  {/if}
</article>

<Modal open={Boolean(pendingAction)} title="Confirmar accion" size="sm" onClose={() => (pendingAction = null)}>
  {#if pendingAction}
    <div class="confirm-body">
      <p>{pendingAction.confirm}</p>
      <div class="modal-actions">
        <button type="button" class="ghost" onclick={() => (pendingAction = null)}>Cancelar</button>
        <button type="button" class="danger-button" onclick={confirmAction}>Confirmar</button>
      </div>
    </div>
  {/if}
</Modal>
