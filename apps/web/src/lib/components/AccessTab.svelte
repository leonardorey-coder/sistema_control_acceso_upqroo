<script lang="ts">
  import DataTable from "./DataTable.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    total,
    filters,
    onFilter
  }: {
    rows: Row[];
    total: number;
    filters: { q: string; date: string; page: number; pageSize: number };
    onFilter: () => void;
  } = $props();
</script>

<section class="panel">
  <div class="tabla-header">
    <h2>Registros del dia</h2>
    <span>{total} registros</span>
  </div>
  <div class="toolbar">
    <input bind:value={filters.q} placeholder="Buscar matricula, nombre, placa" />
    <input bind:value={filters.date} type="date" />
    <button onclick={onFilter}>Filtrar</button>
  </div>
  <DataTable rows={rows} columns={[
    { key: "matricula", label: "Matricula" },
    { key: "nombres", label: "Nombre", kind: "name" },
    { key: "tipoPersona", label: "Tipo" },
    { key: "carrera", label: "Carrera" },
    { key: "entradaAt", label: "Entrada", kind: "date" },
    { key: "salidaAt", label: "Salida", kind: "date" },
    { key: "status", label: "Estado", kind: "status" },
    { key: "accessMode", label: "Modo" },
    { key: "vehiclePlate", label: "Vehiculo" }
  ]} />
</section>
