<script lang="ts">
  import Modal from "./Modal.svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import IconButton from "./IconButton.svelte";
  import { labelAny, labelFor, type LabelGroup } from "$lib/ui/labels";
  import type { IconName } from "./Icon.svelte";

  type Row = Record<string, unknown>;
  type Column = {
    key: string;
    label: string;
    kind?: "status" | "date" | "name" | "role" | "credential" | "accessMode" | "reason" | "vehicleType" | "permitType" | "boolean" | "technical" | "adminAction";
    format?: (value: unknown, row: Row) => string;
    priority?: "high" | "medium" | "low";
    compact?: boolean;
    hideOnMobile?: boolean;
    minWidth?: string;
    nowrap?: boolean;
    truncate?: boolean;
  };
  type Action = {
    label: string;
    onClick: (row: Row) => void | Promise<void>;
    tone?: "default" | "ghost" | "danger";
    icon?: IconName;
    confirm?: string;
    disabled?: (row: Row) => boolean;
  };

  let {
    rows,
    columns,
    empty = "Sin datos",
    actions = [],
    loading = false,
    rowKey = (row: Row) => String(row.id ?? row.uuid ?? JSON.stringify(row))
  }: {
    rows: Row[];
    columns: Column[];
    empty?: string;
    actions?: Action[];
    loading?: boolean;
    rowKey?: (row: Row) => string;
  } = $props();

  let pendingAction = $state<{ action: Action; row: Row } | null>(null);
  let runningActionKey = $state("");

  function formatDate(value: unknown) {
    if (!value) return "";
    return new Date(String(value)).toLocaleString("es-MX");
  }

  function formatName(row: Row) {
    return `${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim() || String(row.fullName ?? row.visitorName ?? "");
  }

  function groupForKind(kind: Column["kind"]): LabelGroup | null {
    if (kind === "role") return "role";
    if (kind === "credential") return "credentialType";
    if (kind === "accessMode") return "accessMode";
    if (kind === "reason") return "reasonCode";
    if (kind === "vehicleType") return "vehicleType";
    if (kind === "permitType") return "permitType";
    if (kind === "boolean") return "boolean";
    if (kind === "adminAction") return "adminAction";
    return null;
  }

  function formatCell(row: Row, column: Column) {
    const value = row[column.key];
    if (column.format) return column.format(value, row);
    if (column.kind === "date") return formatDate(value);
    if (column.kind === "name") return formatName(row);
    if (column.kind === "technical" && value) return String(value);
    const group = groupForKind(column.kind);
    if (group) return labelFor(group, value);
    if (typeof value === "boolean") return labelAny(value);
    return value ?? "";
  }

  function actionIcon(action: Action): IconName {
    if (action.icon) return action.icon;
    const label = action.label.toLowerCase();
    if (label.includes("ver") || label.includes("detalle")) return "eye";
    if (label.includes("editar")) return "edit";
    if (label.includes("qr")) return "qr";
    if (label.includes("eliminar") || label.includes("borrar")) return "trash";
    if (label.includes("bloquear")) return "lock";
    if (label.includes("desactivar")) return "power";
    if (label.includes("rechazar")) return "reject";
    if (label.includes("revocar")) return "revoke";
    if (label.includes("reset")) return "refresh";
    if (label.includes("activar") || label.includes("aprobar") || label.includes("confirmar")) return "check";
    if (label.includes("filtrar")) return "filter";
    return "settings";
  }

  function cellStyle(column: Column) {
    return column.minWidth ? `--col-min-width: ${column.minWidth}` : "";
  }

  function actionKey(action: Action, row: Row) {
    return `${action.label}:${rowKey(row)}`;
  }

  async function runAction(action: Action, row: Row) {
    if (action.disabled?.(row)) return;
    if (action.confirm) {
      pendingAction = { action, row };
      return;
    }
    const key = actionKey(action, row);
    runningActionKey = key;
    try {
      await action.onClick(row);
    } finally {
      if (runningActionKey === key) runningActionKey = "";
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    const current = pendingAction;
    pendingAction = null;
    const key = actionKey(current.action, current.row);
    runningActionKey = key;
    try {
      await current.action.onClick(current.row);
    } finally {
      if (runningActionKey === key) runningActionKey = "";
    }
  }
</script>

<div class="table-wrap" aria-busy={loading}>
  <table class="data-table">
    <thead>
      <tr>
        {#each columns as column}
          <th
            class:min-width-column={Boolean(column.minWidth)}
            class:nowrap-cell={column.nowrap}
            style={cellStyle(column)}
          >{column.label}</th>
        {/each}
        {#if actions.length}<th class="actions-cell">Acciones</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#if loading}
        {#each Array(4) as _}
          <tr class="skeleton-row">
            {#each columns as column}
              <td data-label={column.label}><span class="skeleton-line"></span></td>
            {/each}
            {#if actions.length}<td data-label="Acciones"><span class="skeleton-line short"></span></td>{/if}
          </tr>
        {/each}
      {:else}
      {#each rows as row}
        <tr>
          {#each columns as column}
            <td
              data-label={column.label}
              class:compact-cell={column.compact}
              class:hide-mobile={column.hideOnMobile}
              class:min-width-column={Boolean(column.minWidth)}
              class:nowrap-cell={column.nowrap}
              class:truncate-cell={column.truncate}
              class={`priority-${column.priority ?? "medium"}`}
              style={cellStyle(column)}
            >
              {#if column.kind === "status"}
                <StatusBadge value={row[column.key]} />
              {:else if (column.kind === "technical" || column.truncate) && row[column.key]}
                <code class="technical-value" title={String(row[column.key])}>{String(row[column.key])}</code>
              {:else}
                {formatCell(row, column)}
              {/if}
            </td>
          {/each}
          {#if actions.length}
            <td data-label="Acciones" class="actions-cell">
              <div class="row-actions">
                {#each actions as action}
                  <IconButton
                    icon={actionIcon(action)}
                    label={action.label}
                    compact
                    tone={action.tone === "danger" ? "danger" : action.tone === "ghost" ? "ghost" : "primary"}
                    disabled={action.disabled?.(row) ?? false}
                    loading={runningActionKey === actionKey(action, row)}
                    onClick={() => runAction(action, row)}
                  />
                {/each}
              </div>
            </td>
          {/if}
        </tr>
      {:else}
        <tr>
          <td colspan={columns.length + (actions.length ? 1 : 0)} class="muted empty-cell">{empty}</td>
        </tr>
      {/each}
      {/if}
    </tbody>
  </table>
</div>

<Modal open={Boolean(pendingAction)} title="Confirmar accion" size="sm" onClose={() => (pendingAction = null)}>
  {#if pendingAction}
    <div class="confirm-body">
      <p>{pendingAction.action.confirm}</p>
      <div class="modal-actions">
        <button type="button" class="ghost" onclick={() => (pendingAction = null)}>Cancelar</button>
        <button type="button" class="danger-button" onclick={confirmAction}>Confirmar</button>
      </div>
    </div>
  {/if}
</Modal>
