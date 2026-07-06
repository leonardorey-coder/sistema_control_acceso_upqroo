<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";
  import IconButton from "./IconButton.svelte";
  import Modal from "./Modal.svelte";
  import StatusBadge from "./StatusBadge.svelte";

  type AdminAction = {
    label: string;
    icon?: IconName;
    tone?: "primary" | "ghost" | "danger";
    confirm?: string;
    disabled?: boolean;
    onClick: () => void | Promise<void>;
  };

  let {
    name,
    username,
    email = "",
    role,
    status,
    initials,
    lastLoginAt = null,
    mustChangePassword = false,
    actions = []
  }: {
    name: string;
    username: string;
    email?: string | null;
    role: unknown;
    status: unknown;
    initials: string;
    lastLoginAt?: unknown;
    mustChangePassword?: boolean;
    actions?: AdminAction[];
  } = $props();

  let pendingAction = $state<AdminAction | null>(null);
  let runningAction = $state("");

  const isActive = $derived(String(status ?? "").toLowerCase() === "active");
  const requiresPasswordChange = $derived(Boolean(mustChangePassword));

  function actionIcon(action: AdminAction): IconName {
    if (action.icon) return action.icon;
    const label = action.label.toLowerCase();
    if (label.includes("editar")) return "edit";
    if (label.includes("sesion")) return "user";
    if (label.includes("activar")) return "check";
    if (label.includes("reset")) return "refresh";
    if (label.includes("desactivar")) return "revoke";
    return "settings";
  }

  function formatDate(value: unknown) {
    if (!value) return "Sin registro";
    return new Date(String(value)).toLocaleString("es-MX");
  }

  async function runAction(action: AdminAction) {
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

<article class="admin-user-card" aria-label={`Administrador ${name}`}>
  <div class="admin-user-tab" aria-label={`Rol ${role}`}>
    <StatusBadge value={role} />
  </div>

  <div class="admin-user-hero" aria-hidden="true">
    <span class="admin-user-avatar">{initials}</span>
    <span class={`admin-corner-icon status-${isActive ? "active" : "inactive"}`} title={isActive ? "Activo" : "Inactivo"}>
      <Icon name={isActive ? "check" : "revoke"} size={18} />
    </span>
    {#if requiresPasswordChange}
      <span class="admin-corner-icon password-required" title="Debe cambiar password">
        <Icon name="lock" size={18} />
      </span>
    {/if}
  </div>

  <div class="admin-user-body">
    <div class="admin-user-title">
      <h3>{name}</h3>
      <StatusBadge value={status} />
    </div>
    <p>{email || username}</p>

    <dl class="admin-user-context">
      <div>
        <dt>Usuario</dt>
        <dd>{username}</dd>
      </div>
      <div>
        <dt>Ultimo acceso</dt>
        <dd>{formatDate(lastLoginAt)}</dd>
      </div>
      <div>
        <dt>Password</dt>
        <dd>{requiresPasswordChange ? "Cambio requerido" : "Vigente"}</dd>
      </div>
    </dl>

    <div class="admin-user-actions">
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
  </div>
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
