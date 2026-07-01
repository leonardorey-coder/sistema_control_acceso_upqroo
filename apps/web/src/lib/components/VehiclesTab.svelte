<script lang="ts">
  import type { VehiclePermitRowPayload, VehicleRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import EntitySearchSelect from "./EntitySearchSelect.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import PaginationControls from "./PaginationControls.svelte";
  import QrPreview from "./QrPreview.svelte";

  type Row = Record<string, unknown>;
  type VehicleRow = VehicleRowPayload & Row;
  type PermitRow = VehiclePermitRowPayload & Row;

  let {
    rows,
    permitRows,
    vehicleForm,
    permitForm,
    vehicleOwnerLabel,
    permitPersonLabel,
    permitVehicleLabel,
    permitFilterPersonLabel,
    permitFilterVehicleLabel,
    generatedToken,
    generatedTitle,
    filters,
    vehicleTotal,
    vehiclePage,
    vehiclePageSize,
    permitTotal,
    permitPage,
    permitPageSize,
    searchPeople,
    searchVehicles,
    onSelectVehicleOwner,
    onSelectPermitPerson,
    onSelectPermitVehicle,
    onSelectPermitFilterPerson,
    onSelectPermitFilterVehicle,
    onVehiclePageChange,
    onPermitPageChange,
    onCreateVehicle,
    onCreatePermitQr,
    onCreateDynamicPermitQr,
    onRevokePermit,
    onDisableVehicle,
    onFilter
  }: {
    rows: VehicleRow[];
    permitRows: PermitRow[];
    vehicleForm: { ownerPersonId: string; plate: string; make: string; model: string; color: string };
    permitForm: { personId: string; vehicleId: string; validUntil: string };
    vehicleOwnerLabel: string;
    permitPersonLabel: string;
    permitVehicleLabel: string;
    permitFilterPersonLabel: string;
    permitFilterVehicleLabel: string;
    generatedToken: string;
    generatedTitle: string;
    filters: { q: string; vehicleStatus: string; permitStatus: string; permitPersonId: string; permitVehicleId: string };
    vehicleTotal: number;
    vehiclePage: number;
    vehiclePageSize: number;
    permitTotal: number;
    permitPage: number;
    permitPageSize: number;
    searchPeople: (query: string) => Promise<Row[]>;
    searchVehicles: (query: string) => Promise<Row[]>;
    onSelectVehicleOwner: (row: Row | null) => void;
    onSelectPermitPerson: (row: Row | null) => void;
    onSelectPermitVehicle: (row: Row | null) => void;
    onSelectPermitFilterPerson: (row: Row | null) => void;
    onSelectPermitFilterVehicle: (row: Row | null) => void;
    onVehiclePageChange: (next: { page: number; pageSize: number }) => void;
    onPermitPageChange: (next: { page: number; pageSize: number }) => void;
    onCreateVehicle: () => void | Promise<void>;
    onCreatePermitQr: () => void | Promise<void>;
    onCreateDynamicPermitQr: (row: PermitRow) => void | Promise<void>;
    onRevokePermit: (row: PermitRow) => void | Promise<void>;
    onDisableVehicle: (row: VehicleRow) => void | Promise<void>;
    onFilter: () => void | Promise<void>;
  } = $props();

  let vehiclePending = $state(false);
  let permitPending = $state(false);
  let filterPending = $state(false);

  function displayPerson(row: Row) {
    return `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim();
  }

  function displayVehicle(row: Row) {
    return `${row.plate ?? ""}${row.make ? ` - ${row.make}` : ""}${row.model ? ` ${row.model}` : ""}`.trim();
  }

  async function createVehicle() {
    vehiclePending = true;
    try {
      await onCreateVehicle();
    } finally {
      vehiclePending = false;
    }
  }

  async function createPermitQr() {
    permitPending = true;
    try {
      await onCreatePermitQr();
    } finally {
      permitPending = false;
    }
  }

  async function filterRows() {
    filterPending = true;
    try {
      await onFilter();
    } finally {
      filterPending = false;
    }
  }
</script>

<section class="qr-flow">
  <form class="panel qr-form-panel" aria-busy={vehiclePending} onsubmit={(event) => { event.preventDefault(); createVehicle(); }}>
    <h2>Registrar vehiculo</h2>
    <EntitySearchSelect
      label="Persona propietaria"
      value={vehicleForm.ownerPersonId}
      displayValue={vehicleOwnerLabel}
      placeholder="Matricula o nombre"
      search={searchPeople}
      displayResult={displayPerson}
      onSelect={onSelectVehicleOwner}
    />
    <label class="form-field">
      <span>Placa</span>
      <input bind:value={vehicleForm.plate} placeholder="Placa" required />
    </label>
    <label class="form-field">
      <span>Marca</span>
      <input bind:value={vehicleForm.make} placeholder="Marca" />
    </label>
    <label class="form-field">
      <span>Modelo</span>
      <input bind:value={vehicleForm.model} placeholder="Modelo" />
    </label>
    <label class="form-field">
      <span>Color</span>
      <input bind:value={vehicleForm.color} placeholder="Color" />
    </label>
    <LoadingButton type="submit" loading={vehiclePending} loadingLabel="Guardando...">Guardar vehiculo</LoadingButton>
  </form>
  <form class="panel qr-form-panel" aria-busy={permitPending} onsubmit={(event) => { event.preventDefault(); createPermitQr(); }}>
    <h2>Permiso vehicular</h2>
    <EntitySearchSelect
      label="Persona autorizada"
      value={permitForm.personId}
      displayValue={permitPersonLabel}
      placeholder="Matricula o nombre"
      search={searchPeople}
      displayResult={displayPerson}
      onSelect={onSelectPermitPerson}
    />
    <EntitySearchSelect
      label="Vehiculo"
      value={permitForm.vehicleId}
      displayValue={permitVehicleLabel}
      placeholder="Placa, marca o modelo"
      search={searchVehicles}
      displayResult={displayVehicle}
      onSelect={onSelectPermitVehicle}
    />
    <label class="form-field">
      <span>Vigencia</span>
      <input bind:value={permitForm.validUntil} type="datetime-local" />
    </label>
    <LoadingButton type="submit" loading={permitPending} loadingLabel="Generando...">Generar QR vehicular</LoadingButton>
  </form>

  <section class="panel qr-side-panel">
    <QrPreview token={generatedToken} title={generatedTitle || "QR vehicular"} subtitle="El token vehicular se muestra solo al rotar o emitir." autoOpen />
  </section>
</section>

<section class="panel">
  <div class="tabla-header">
    <h2>Vehiculos</h2>
  </div>
  <div class="toolbar">
    <label class="form-field">
      <span>Busqueda</span>
      <input bind:value={filters.q} placeholder="Buscar placa, marca o persona" />
    </label>
    <label class="form-field">
      <span>Estado</span>
      <select bind:value={filters.vehicleStatus}>
        <option value="">Todos</option>
        <option value="active">Activo</option>
        <option value="inactive">Inactivo</option>
        <option value="blocked">Bloqueado</option>
      </select>
    </label>
    <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterRows}>Filtrar</LoadingButton>
  </div>
  <DataTable rows={rows} columns={[
    { key: "plate", label: "Placa" },
    { key: "make", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "color", label: "Color" },
    { key: "status", label: "Estado", kind: "status" },
    { key: "ownerPersonId", label: "Propietario", kind: "technical", hideOnMobile: true }
  ]} actions={[{ label: "Desactivar", icon: "revoke", onClick: (row) => onDisableVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion desactiva el vehiculo seleccionado." }]} />
  <PaginationControls
    page={vehiclePage}
    pageSize={vehiclePageSize}
    total={vehicleTotal}
    onChange={onVehiclePageChange}
  />
</section>

<section class="panel">
  <div class="section-header">
    <h2>Permisos vehiculares</h2>
  </div>
  <div class="toolbar">
    <label class="form-field">
      <span>Busqueda</span>
      <input bind:value={filters.q} placeholder="Buscar persona o placa" />
    </label>
    <EntitySearchSelect
      label="Persona"
      value={filters.permitPersonId}
      displayValue={permitFilterPersonLabel}
      placeholder="Filtrar persona"
      search={searchPeople}
      displayResult={displayPerson}
      onSelect={onSelectPermitFilterPerson}
    />
    <EntitySearchSelect
      label="Vehiculo"
      value={filters.permitVehicleId}
      displayValue={permitFilterVehicleLabel}
      placeholder="Filtrar vehiculo"
      search={searchVehicles}
      displayResult={displayVehicle}
      onSelect={onSelectPermitFilterVehicle}
    />
    <label class="form-field">
      <span>Estado</span>
      <select bind:value={filters.permitStatus}>
        <option value="">Todos</option>
        <option value="active">Activo</option>
        <option value="expired">Expirado</option>
        <option value="revoked">Revocado</option>
        <option value="suspended">Suspendido</option>
      </select>
    </label>
    <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterRows}>Filtrar</LoadingButton>
  </div>
  <DataTable rows={permitRows} columns={[
    { key: "matricula", label: "Matricula" },
    { key: "personName", label: "Persona" },
    { key: "vehiclePlate", label: "Placa" },
    { key: "status", label: "Estado", kind: "status" },
    { key: "validUntil", label: "Vigencia", kind: "date" }
  ]} actions={[
    { label: "QR dinamico", icon: "qr", onClick: (row) => onCreateDynamicPermitQr(row as PermitRow) },
    { label: "Revocar", icon: "revoke", onClick: (row) => onRevokePermit(row as PermitRow), tone: "danger", confirm: "Esta accion revoca el permiso vehicular." }
  ]} />
  <PaginationControls
    page={permitPage}
    pageSize={permitPageSize}
    total={permitTotal}
    onChange={onPermitPageChange}
  />
</section>
