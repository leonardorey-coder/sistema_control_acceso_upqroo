<script lang="ts">
  import DataTable from "./DataTable.svelte";
  import PaginationControls from "./PaginationControls.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    total,
    filters,
    page,
    pageSize,
    personTypeRows,
    onFilter,
    onPageChange
  }: {
    rows: Row[];
    total: number;
    filters: { q: string; date: string; page: number; pageSize: number; personType: string; accessMode: string; status: string };
    page: number;
    pageSize: number;
    personTypeRows: Row[];
    onFilter: () => void;
    onPageChange: (next: { page: number; pageSize: number }) => void;
  } = $props();
</script>

<section class="panel">
  <div class="tabla-header">
    <h2>Registros del dia</h2>
    <span>{total} registros</span>
  </div>
  <div class="toolbar">
    <label class="form-field">
      <span>Busqueda</span>
      <input bind:value={filters.q} placeholder="Buscar matricula, nombre, placa" />
    </label>
    <label class="form-field">
      <span>Fecha</span>
      <input bind:value={filters.date} type="date" />
    </label>
    <label class="form-field">
      <span>Tipo</span>
      <select bind:value={filters.personType}>
        <option value="">Todos los tipos</option>
        {#each personTypeRows as type}
          <option value={String(type.code)}>{type.label}</option>
        {/each}
      </select>
    </label>
    <label class="form-field">
      <span>Modo</span>
      <select bind:value={filters.accessMode}>
        <option value="">Todos los modos</option>
        <option value="pedestrian">Peatonal</option>
        <option value="vehicle">Vehicular</option>
        <option value="visitor">Visitante</option>
        <option value="manual">Manual</option>
      </select>
    </label>
    <label class="form-field">
      <span>Estado</span>
      <select bind:value={filters.status}>
        <option value="">Todos los estados</option>
        <option value="in_progress">En curso</option>
        <option value="completed">Completado</option>
        <option value="auto_closed">Salida auto</option>
        <option value="rejected">Rechazado</option>
      </select>
    </label>
    <button onclick={onFilter}>Filtrar</button>
  </div>
  <DataTable rows={rows} columns={[
    { key: "matricula", label: "Matricula" },
    { key: "nombres", label: "Nombre", kind: "name" },
    { key: "tipoPersona", label: "Tipo" },
    { key: "carrera", label: "Carrera" },
    { key: "entradaAt", label: "Entrada", kind: "date" },
    { key: "salidaAt", label: "Salida", kind: "date" },
    { key: "salidaAutomatica", label: "Salida auto" },
    { key: "adminEntrada", label: "Admin entrada" },
    { key: "adminSalida", label: "Admin salida" },
    { key: "status", label: "Estado", kind: "status" },
    { key: "accessMode", label: "Modo" },
    { key: "subjectType", label: "Sujeto" },
    { key: "credentialType", label: "Credencial" },
    { key: "credentialOrigin", label: "Origen" },
    { key: "isExceptionAccess", label: "Excepcion" },
    { key: "vehiclePlate", label: "Vehiculo" },
    { key: "hashRegistro", label: "Hash" }
  ]} />
  <PaginationControls {page} {pageSize} {total} onChange={onPageChange} />
</section>
