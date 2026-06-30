<script lang="ts">
  import type { HotQrRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import PaginationControls from "./PaginationControls.svelte";
  import QrPreview from "./QrPreview.svelte";

  type Row = Record<string, unknown>;
  type HotQrRow = HotQrRowPayload & Row;

  let {
    rows,
    form,
    generatedToken,
    generatedTitle,
    filters,
    total,
    page,
    pageSize,
    onCreate,
    onFilter,
    onPageChange,
    onRevoke
  }: {
    rows: HotQrRow[];
    form: { visitorName: string; reason: string; minutes: number };
    generatedToken: string;
    generatedTitle: string;
    filters: { q: string; date: string; hotQrStatus: string };
    total: number;
    page: number;
    pageSize: number;
    onCreate: () => void;
    onFilter: () => void;
    onPageChange: (next: { page: number; pageSize: number }) => void;
    onRevoke: (row: HotQrRow) => void;
  } = $props();
</script>

<section class="grid two">
  <form class="panel" onsubmit={(event) => { event.preventDefault(); onCreate(); }}>
    <h2>Hot-QR</h2>
    <label class="form-field">
      <span>Visitante</span>
      <input bind:value={form.visitorName} placeholder="Visitante" required />
    </label>
    <label class="form-field">
      <span>Motivo</span>
      <input bind:value={form.reason} placeholder="Motivo" required />
    </label>
    <label class="form-field">
      <span>Vigencia</span>
      <select bind:value={form.minutes}>
        <option value={15}>15 min</option>
        <option value={30}>30 min</option>
        <option value={60}>1 hora</option>
        <option value={120}>2 horas</option>
        <option value={240}>4 horas</option>
        <option value={480}>8 horas</option>
      </select>
    </label>
    <button>Generar Hot-QR</button>
  </form>
  <section class="panel">
    <QrPreview token={generatedToken} title={generatedTitle || "Hot-QR"} subtitle="Comparte o descarga este QR solo al emitirlo." />
  </section>
</section>

<section class="panel">
  <div class="tabla-header">
    <h2>Hot-QR del dia</h2>
    <span>{total} tokens</span>
  </div>
  <div class="toolbar">
    <label class="form-field">
      <span>Busqueda</span>
      <input bind:value={filters.q} placeholder="Buscar visitante o motivo" />
    </label>
    <label class="form-field">
      <span>Fecha</span>
      <input bind:value={filters.date} type="date" />
    </label>
    <label class="form-field">
      <span>Estado</span>
      <select bind:value={filters.hotQrStatus}>
        <option value="">Todos</option>
        <option value="active">Activo</option>
        <option value="used">Usado</option>
        <option value="expired">Expirado</option>
        <option value="revoked">Revocado</option>
        <option value="disabled">Deshabilitado</option>
      </select>
    </label>
    <button onclick={onFilter}>Filtrar</button>
  </div>
    <DataTable rows={rows} columns={[
      { key: "visitorName", label: "Visitante" },
      { key: "reason", label: "Motivo" },
      { key: "status", label: "Estado", kind: "status" },
      { key: "validUntil", label: "Expira", kind: "date" },
    { key: "createdByAdminId", label: "Creador" }
  ]} actions={[{ label: "Revocar", onClick: (row) => onRevoke(row as HotQrRow), tone: "ghost" }]} />
  <PaginationControls {page} {pageSize} {total} onChange={onPageChange} />
</section>
