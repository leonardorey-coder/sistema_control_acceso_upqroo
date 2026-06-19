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
    <h2>Asistencias del dia</h2>
    <span>{total} asistencias</span>
  </div>
  <div class="toolbar">
    <input bind:value={filters.q} placeholder="Buscar alumno o materia" />
    <input bind:value={filters.date} type="date" />
    <button onclick={onFilter}>Filtrar</button>
  </div>
  <DataTable rows={rows} columns={[
    { key: "matricula", label: "Matricula" },
    { key: "nombres", label: "Estudiante", kind: "name" },
    { key: "subjectName", label: "Materia" },
    { key: "aula", label: "Aula" },
    { key: "horaInicio", label: "Inicio" },
    { key: "horaFin", label: "Fin" },
    { key: "porcentaje", label: "%" },
    { key: "estado", label: "Estado", kind: "status" }
  ]} />
</section>
