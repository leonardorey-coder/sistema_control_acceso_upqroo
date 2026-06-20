<script lang="ts">
  import DataTable from "./DataTable.svelte";
  import QrPreview from "./QrPreview.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    form,
    generatedToken,
    generatedTitle,
    filters,
    onCreate,
    onFilter,
    onRevoke
  }: {
    rows: Row[];
    form: { visitorName: string; reason: string; minutes: number };
    generatedToken: string;
    generatedTitle: string;
    filters: { q: string; date: string; hotQrStatus: string };
    onCreate: () => void;
    onFilter: () => void;
    onRevoke: (row: Row) => void;
  } = $props();
</script>

<section class="grid two">
  <form class="panel" onsubmit={(event) => { event.preventDefault(); onCreate(); }}>
    <h2>Hot-QR</h2>
    <input bind:value={form.visitorName} placeholder="Visitante" required />
    <input bind:value={form.reason} placeholder="Motivo" required />
    <select bind:value={form.minutes}>
      <option value={15}>15 min</option>
      <option value={30}>30 min</option>
      <option value={60}>1 hora</option>
      <option value={120}>2 horas</option>
      <option value={240}>4 horas</option>
      <option value={480}>8 horas</option>
    </select>
    <button>Generar Hot-QR</button>
  </form>
  <section class="panel">
    <QrPreview token={generatedToken} title={generatedTitle || "Hot-QR"} subtitle="Comparte o descarga este QR solo al emitirlo." />
  </section>
</section>

<section class="panel">
  <div class="tabla-header">
    <h2>Hot-QR del dia</h2>
  </div>
  <div class="toolbar">
    <input bind:value={filters.q} placeholder="Buscar visitante o motivo" />
    <input bind:value={filters.date} type="date" />
    <select bind:value={filters.hotQrStatus}>
      <option value="">Todos</option>
      <option value="active">Activo</option>
      <option value="used">Usado</option>
      <option value="expired">Expirado</option>
      <option value="revoked">Revocado</option>
      <option value="disabled">Deshabilitado</option>
    </select>
    <button onclick={onFilter}>Filtrar</button>
  </div>
    <DataTable rows={rows} columns={[
      { key: "visitorName", label: "Visitante" },
      { key: "reason", label: "Motivo" },
      { key: "status", label: "Estado", kind: "status" },
      { key: "validUntil", label: "Expira", kind: "date" },
      { key: "createdByAdminId", label: "Creador" }
    ]} actions={[{ label: "Revocar", onClick: onRevoke, tone: "ghost" }]} />
</section>
