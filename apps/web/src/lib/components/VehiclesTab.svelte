<script lang="ts">
  import type { VehiclePermitRowPayload, VehicleRowPayload, VehicleVisitorPermitRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import EntitySearchSelect from "./EntitySearchSelect.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import Modal from "./Modal.svelte";
  import PaginationControls from "./PaginationControls.svelte";
  import QrPreview from "./QrPreview.svelte";
  import VehiclePreview3D from "./VehiclePreview3D.svelte";
  import { permitTypeLabels, vehicleTypeLabels } from "$lib/ui/labels";

  type Row = Record<string, unknown>;
  type VehicleRow = VehicleRowPayload & Row;
  type PermitRow = VehiclePermitRowPayload & Row;
  type VisitorPermitRow = VehicleVisitorPermitRowPayload & Row;

  let {
    rows,
    permitRows,
    visitorPermitRows,
    vehicleForm,
    permitForm,
    visitorPermitForm,
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
    visitorPermitTotal,
    visitorPermitPage,
    visitorPermitPageSize,
    searchPeople,
    searchVehicles,
    onSelectVehicleOwner,
    onSelectPermitPerson,
    onSelectPermitVehicle,
    onSelectPermitFilterPerson,
    onSelectPermitFilterVehicle,
    onVehiclePageChange,
    onPermitPageChange,
    onVisitorPermitPageChange,
    onCreateVehicle,
    onCreatePermitQr,
    onCreateVehicleVisitorPermit,
    onCreateDynamicPermitQr,
    onRevokePermit,
    onDisableVehicle,
    onApproveVehicle,
    onRejectVehicle,
    onBlockVehicle,
    onDeleteVehicle,
    onRevokeVehicleVisitorPermit,
    onFilter
  }: {
    rows: VehicleRow[];
    permitRows: PermitRow[];
    visitorPermitRows: VisitorPermitRow[];
    vehicleForm: { ownerPersonId: string; plate: string; vehicleType: string; make: string; model: string; color: string };
    permitForm: { personId: string; vehicleId: string; permitType: string; validUntil: string };
    visitorPermitForm: { visitorName: string; plate: string; vehicleType: string; color: string; reason: string; minutes: number; maxUses: number };
    vehicleOwnerLabel: string;
    permitPersonLabel: string;
    permitVehicleLabel: string;
    permitFilterPersonLabel: string;
    permitFilterVehicleLabel: string;
    generatedToken: string;
    generatedTitle: string;
    filters: { q: string; vehicleStatus: string; vehicleApprovalStatus: string; vehicleType: string; permitStatus: string; permitType: string; permitPersonId: string; permitVehicleId: string; visitorPermitStatus: string };
    vehicleTotal: number;
    vehiclePage: number;
    vehiclePageSize: number;
    permitTotal: number;
    permitPage: number;
    permitPageSize: number;
    visitorPermitTotal: number;
    visitorPermitPage: number;
    visitorPermitPageSize: number;
    searchPeople: (query: string) => Promise<Row[]>;
    searchVehicles: (query: string) => Promise<Row[]>;
    onSelectVehicleOwner: (row: Row | null) => void;
    onSelectPermitPerson: (row: Row | null) => void;
    onSelectPermitVehicle: (row: Row | null) => void;
    onSelectPermitFilterPerson: (row: Row | null) => void;
    onSelectPermitFilterVehicle: (row: Row | null) => void;
    onVehiclePageChange: (next: { page: number; pageSize: number }) => void;
    onPermitPageChange: (next: { page: number; pageSize: number }) => void;
    onVisitorPermitPageChange: (next: { page: number; pageSize: number }) => void;
    onCreateVehicle: () => void | Promise<void>;
    onCreatePermitQr: () => void | Promise<void>;
    onCreateVehicleVisitorPermit: () => void | Promise<void>;
    onCreateDynamicPermitQr: (row: PermitRow) => void | Promise<void>;
    onRevokePermit: (row: PermitRow) => void | Promise<void>;
    onDisableVehicle: (row: VehicleRow) => void | Promise<void>;
    onApproveVehicle: (row: VehicleRow) => void | Promise<void>;
    onRejectVehicle: (row: VehicleRow) => void | Promise<void>;
    onBlockVehicle: (row: VehicleRow) => void | Promise<void>;
    onDeleteVehicle: (row: VehicleRow) => void | Promise<void>;
    onRevokeVehicleVisitorPermit: (row: VisitorPermitRow) => void | Promise<void>;
    onFilter: () => void | Promise<void>;
  } = $props();

  let vehiclePending = $state(false);
  let permitPending = $state(false);
  let visitorPending = $state(false);
  let filterPending = $state(false);
  let previewVehicle = $state<VehicleRow | VisitorPermitRow | null>(null);

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

  async function createVisitorPermit() {
    visitorPending = true;
    try {
      await onCreateVehicleVisitorPermit();
    } finally {
      visitorPending = false;
    }
  }

  function previewTitle(row: VehicleRow | VisitorPermitRow | null) {
    if (!row) return "Vista de vehiculo";
    return String(row.plate ?? row.vehiclePlate ?? "Vista de vehiculo");
  }
</script>

<section class="qr-flow">
  <section class="vehicle-form-layout">
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
        <span>Tipo</span>
        <select bind:value={vehicleForm.vehicleType}>
          {#each Object.entries(vehicleTypeLabels) as [value, label]}
            <option {value}>{label}</option>
          {/each}
        </select>
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
    <VehiclePreview3D
      vehicleType={vehicleForm.vehicleType}
      plate={vehicleForm.plate}
      color={vehicleForm.color}
      make={vehicleForm.make}
      model={vehicleForm.model}
      status="pending"
      approvalStatus="pending"
      size="compact"
    />
  </section>
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
      <span>Tipo de permiso</span>
      <select bind:value={permitForm.permitType}>
        {#each Object.entries(permitTypeLabels) as [value, label]}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
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
    <label class="form-field">
      <span>Aprobacion</span>
      <select bind:value={filters.vehicleApprovalStatus}>
        <option value="">Todas</option>
        <option value="pending">Pendiente</option>
        <option value="approved">Aprobado</option>
        <option value="rejected">Rechazado</option>
      </select>
    </label>
    <label class="form-field">
      <span>Tipo</span>
      <select bind:value={filters.vehicleType}>
        <option value="">Todos</option>
        {#each Object.entries(vehicleTypeLabels) as [value, label]}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
    <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterRows}>Filtrar</LoadingButton>
  </div>
  <DataTable rows={rows} columns={[
    { key: "plate", label: "Placa" },
    { key: "vehicleType", label: "Tipo", kind: "vehicleType" },
    { key: "make", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "color", label: "Color" },
    { key: "status", label: "Estado", kind: "status" },
    { key: "approvalStatus", label: "Aprobacion", kind: "status" },
    { key: "ownerName", label: "Propietario", hideOnMobile: true }
  ]} actions={[
    { label: "Ver", icon: "settings", onClick: (row) => { previewVehicle = row as VehicleRow; }, tone: "ghost" },
    { label: "Aprobar", icon: "check", onClick: (row) => onApproveVehicle(row as VehicleRow), confirm: "Esta accion aprueba el vehiculo seleccionado." },
    { label: "Rechazar", icon: "revoke", onClick: (row) => onRejectVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion rechaza el vehiculo seleccionado." },
    { label: "Bloquear", icon: "revoke", onClick: (row) => onBlockVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion bloquea el vehiculo seleccionado." },
    { label: "Desactivar", icon: "revoke", onClick: (row) => onDisableVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion desactiva el vehiculo seleccionado." },
    { label: "Eliminar", icon: "revoke", onClick: (row) => onDeleteVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion hace borrado logico del vehiculo seleccionado." }
  ]} />
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
    <label class="form-field">
      <span>Tipo</span>
      <select bind:value={filters.permitType}>
        <option value="">Todos</option>
        {#each Object.entries(permitTypeLabels) as [value, label]}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
    <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterRows}>Filtrar</LoadingButton>
  </div>
  <DataTable rows={permitRows} columns={[
    { key: "matricula", label: "Matricula" },
    { key: "personName", label: "Persona" },
    { key: "vehiclePlate", label: "Placa" },
    { key: "permitType", label: "Tipo", kind: "permitType" },
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

<section class="panel">
  <div class="section-header">
    <h2>Visitantes vehiculares</h2>
  </div>
  <div class="vehicle-visitor-layout">
    <form class="toolbar" aria-busy={visitorPending} onsubmit={(event) => { event.preventDefault(); createVisitorPermit(); }}>
      <label class="form-field">
        <span>Visitante</span>
        <input bind:value={visitorPermitForm.visitorName} placeholder="Nombre" required />
      </label>
      <label class="form-field">
        <span>Placa</span>
        <input bind:value={visitorPermitForm.plate} placeholder="Placa" required />
      </label>
      <label class="form-field">
        <span>Tipo</span>
        <select bind:value={visitorPermitForm.vehicleType}>
          {#each Object.entries(vehicleTypeLabels) as [value, label]}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>
      <label class="form-field">
        <span>Color</span>
        <input bind:value={visitorPermitForm.color} placeholder="Color" />
      </label>
      <label class="form-field">
        <span>Motivo</span>
        <input bind:value={visitorPermitForm.reason} placeholder="Motivo" required />
      </label>
      <label class="form-field">
        <span>Minutos</span>
        <input bind:value={visitorPermitForm.minutes} type="number" min="1" max="1440" />
      </label>
      <label class="form-field">
        <span>Usos</span>
        <input bind:value={visitorPermitForm.maxUses} type="number" min="1" max="10" />
      </label>
      <label class="form-field">
        <span>Estado</span>
        <select bind:value={filters.visitorPermitStatus}>
          <option value="">Todos</option>
          <option value="active">Activo</option>
          <option value="expired">Expirado</option>
          <option value="revoked">Revocado</option>
        </select>
      </label>
      <LoadingButton type="submit" loading={visitorPending} loadingLabel="Generando...">Generar Hot-QR vehicular</LoadingButton>
      <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterRows}>Filtrar</LoadingButton>
    </form>
    <VehiclePreview3D
      vehicleType={visitorPermitForm.vehicleType}
      plate={visitorPermitForm.plate}
      color={visitorPermitForm.color}
      make=""
      model=""
      status="active"
      approvalStatus="approved"
      size="compact"
    />
  </div>
  <DataTable rows={visitorPermitRows} columns={[
    { key: "visitorName", label: "Visitante" },
    { key: "plate", label: "Placa" },
    { key: "vehicleType", label: "Tipo", kind: "vehicleType" },
    { key: "color", label: "Color" },
    { key: "reason", label: "Motivo", hideOnMobile: true },
    { key: "status", label: "Estado", kind: "status" },
    { key: "validUntil", label: "Vigencia", kind: "date" }
  ]} actions={[
    { label: "Ver", icon: "settings", onClick: (row) => { previewVehicle = row as VisitorPermitRow; }, tone: "ghost" },
    { label: "Revocar", icon: "revoke", onClick: (row) => onRevokeVehicleVisitorPermit(row as VisitorPermitRow), tone: "danger", confirm: "Esta accion revoca el acceso vehicular visitante." }
  ]} />
  <PaginationControls
    page={visitorPermitPage}
    pageSize={visitorPermitPageSize}
    total={visitorPermitTotal}
    onChange={onVisitorPermitPageChange}
  />
</section>

<Modal open={Boolean(previewVehicle)} title={previewTitle(previewVehicle)} size="md" onClose={() => (previewVehicle = null)}>
  {#if previewVehicle}
    <VehiclePreview3D
      vehicleType={String(previewVehicle.vehicleType ?? "other")}
      plate={String(previewVehicle.plate ?? previewVehicle.vehiclePlate ?? "")}
      color={String(previewVehicle.color ?? "")}
      make={String(previewVehicle.make ?? "")}
      model={String(previewVehicle.model ?? "")}
      status={String(previewVehicle.status ?? "")}
      approvalStatus={String(previewVehicle.approvalStatus ?? "")}
      size="card"
      interactive
    />
  {/if}
</Modal>
