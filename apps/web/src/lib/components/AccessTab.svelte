<script lang="ts">
  import DataTable from "./DataTable.svelte";
  import LoadingButton from "./LoadingButton.svelte";
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
    onFilter: () => void | Promise<void>;
    onPageChange: (next: { page: number; pageSize: number }) => void;
  } = $props();

  let filterPending = $state(false);

  async function filterRows() {
    filterPending = true;
    try {
      await onFilter();
    } finally {
      filterPending = false;
    }
  }
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
    <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterRows}>Filtrar</LoadingButton>
  </div>
  <DataTable rows={rows} columns={[
    { key: "matricula", label: "Matricula", minWidth: "110px", nowrap: true },
    { key: "nombres", label: "Nombre", kind: "name", minWidth: "160px" },
    { key: "tipoPersona", label: "Tipo", minWidth: "105px" },
    { key: "carrera", label: "Carrera", minWidth: "160px", truncate: true },
    { key: "entradaAt", label: "Entrada", kind: "date", minWidth: "150px" },
    { key: "salidaAt", label: "Salida", kind: "date", minWidth: "150px" },
    { key: "salidaAutomatica", label: "Salida auto", kind: "boolean", compact: true, minWidth: "100px" },
    { key: "adminEntrada", label: "Admin entrada", minWidth: "140px", truncate: true },
    { key: "adminSalida", label: "Admin salida", minWidth: "140px", truncate: true },
    { key: "status", label: "Estado", kind: "status", minWidth: "120px" },
    { key: "accessMode", label: "Modo", kind: "accessMode", minWidth: "105px" },
    { key: "subjectType", label: "Sujeto", minWidth: "105px" },
    { key: "credentialType", label: "Credencial", kind: "credential", minWidth: "150px" },
    { key: "credentialOrigin", label: "Origen", minWidth: "110px" },
    { key: "isExceptionAccess", label: "Excepcion", kind: "boolean", compact: true, minWidth: "105px" },
    { key: "vehiclePlate", label: "Vehiculo", minWidth: "110px", nowrap: true },
    { key: "hashRegistro", label: "Hash", kind: "technical", minWidth: "130px", truncate: true, hideOnMobile: true }
  ]} />
  <PaginationControls {page} {pageSize} {total} onChange={onPageChange} />
</section>
