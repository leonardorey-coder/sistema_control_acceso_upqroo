<script lang="ts">
  import StatusBadge from "./StatusBadge.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    columns,
    empty = "Sin datos",
    actions = []
  }: {
    rows: Row[];
    columns: Array<{ key: string; label: string; kind?: "status" | "date" | "name" }>;
    empty?: string;
    actions?: Array<{ label: string; onClick: (row: Row) => void | Promise<void>; tone?: "default" | "ghost" }>;
  } = $props();

  function formatDate(value: unknown) {
    if (!value) return "";
    return new Date(String(value)).toLocaleString("es-MX");
  }

  function formatName(row: Row) {
    return `${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim() || String(row.fullName ?? row.visitorName ?? "");
  }
</script>

<div class="table-wrap">
  <table class="data-table">
    <thead>
      <tr>
        {#each columns as column}
          <th>{column.label}</th>
        {/each}
        {#if actions.length}<th>Acciones</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr>
          {#each columns as column}
            <td>
              {#if column.kind === "status"}
                <StatusBadge value={row[column.key]} />
              {:else if column.kind === "date"}
                {formatDate(row[column.key])}
              {:else if column.kind === "name"}
                {formatName(row)}
              {:else}
                {row[column.key] ?? ""}
              {/if}
            </td>
          {/each}
          {#if actions.length}
            <td>
              <div class="row-actions">
                {#each actions as action}
                  <button class={action.tone === "ghost" ? "ghost" : ""} onclick={() => action.onClick(row)}>
                    {action.label}
                  </button>
                {/each}
              </div>
            </td>
          {/if}
        </tr>
      {:else}
        <tr>
          <td colspan={columns.length + (actions.length ? 1 : 0)} class="muted">{empty}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
