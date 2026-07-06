<script lang="ts">
  import type { VehiclePermitRowPayload, VehicleRowPayload, VehicleVisitorPermitRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import EntitySearchSelect from "./EntitySearchSelect.svelte";
  import FormFlow from "./FormFlow.svelte";
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
    onUpdateVehicle,
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
    onUpdateVehicle: (row: VehicleRow, input: { plate: string; vehicleType: string; make: string; model: string; color: string }) => void | Promise<void>;
    onRevokeVehicleVisitorPermit: (row: VisitorPermitRow) => void | Promise<void>;
    onFilter: () => void | Promise<void>;
  } = $props();

  let vehiclePending = $state(false);
  let permitPending = $state(false);
  let visitorPending = $state(false);
  let filterPending = $state(false);
  let editPending = $state(false);
  let previewVehicle = $state<VehicleRow | VisitorPermitRow | null>(null);
  let editingVehicle = $state<VehicleRow | null>(null);
  let editVehicleForm = $state({ plate: "", vehicleType: "car", make: "", model: "", color: "" });
  let flow = $state("vehicle");
  const flowOptions = [
    { value: "vehicle", label: "Vehiculo" },
    { value: "permit", label: "Permiso QR" },
    { value: "visitor", label: "Visitante" }
  ];

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

  function openVehicleEditor(row: VehicleRow) {
    editingVehicle = row;
    editVehicleForm = {
      plate: String(row.plate ?? ""),
      vehicleType: String(row.vehicleType ?? "car"),
      make: String(row.make ?? ""),
      model: String(row.model ?? ""),
      color: String(row.color ?? "")
    };
  }

  function closeVehicleEditor() {
    editingVehicle = null;
    editVehicleForm = { plate: "", vehicleType: "car", make: "", model: "", color: "" };
  }

  async function saveVehicleEdit() {
    if (!editingVehicle) return;
    editPending = true;
    try {
      await onUpdateVehicle(editingVehicle, editVehicleForm);
      closeVehicleEditor();
    } finally {
      editPending = false;
    }
  }
</script>

<FormFlow
  title="Acceso vehicular"
  description="Registra vehiculos, emite permisos y genera accesos de visitante desde un flujo unico."
  bind:value={flow}
  options={flowOptions}
>
  {#if flow === "vehicle"}
  <section class="vehicle-form-layout">
    <form class="panel qr-form-panel" aria-busy={vehiclePending} onsubmit={(event) => { event.preventDefault(); createVehicle(); }}>
      <h2>Registrar vehiculo</h2>
      <EntitySearchSelect
        label="Persona propietaria"
        value={vehicleForm.ownerPersonId}
        displayValue={vehicleOwnerLabel}
        placeholder="21A00000 o Ana Lopez"
        search={searchPeople}
        displayResult={displayPerson}
        onSelect={onSelectVehicleOwner}
      />
      <label class="form-field">
        <span>Placa</span>
        <input bind:value={vehicleForm.plate} placeholder="ABC-123-A" required />
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
        <input bind:value={vehicleForm.make} placeholder="Nissan" />
      </label>
      <label class="form-field">
        <span>Modelo</span>
        <input bind:value={vehicleForm.model} placeholder="Versa 2022" />
      </label>
      <label class="form-field">
        <span>Color</span>
        <input bind:value={vehicleForm.color} placeholder="Blanco" />
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
  {:else if flow === "permit"}
  <form class="panel qr-form-panel" aria-busy={permitPending} onsubmit={(event) => { event.preventDefault(); createPermitQr(); }}>
    <h2>Permiso vehicular</h2>
    <EntitySearchSelect
      label="Persona autorizada"
      value={permitForm.personId}
      displayValue={permitPersonLabel}
      placeholder="21A00000 o Ana Lopez"
      search={searchPeople}
      displayResult={displayPerson}
      onSelect={onSelectPermitPerson}
    />
    <EntitySearchSelect
      label="Vehiculo"
      value={permitForm.vehicleId}
      displayValue={permitVehicleLabel}
      placeholder="ABC-123-A o Nissan"
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
  {:else}
  <div class="vehicle-visitor-layout">
    <form class="panel form-grid" aria-busy={visitorPending} onsubmit={(event) => { event.preventDefault(); createVisitorPermit(); }}>
      <div class="section-header">
        <h2>Visitante vehicular</h2>
        <p>Genera un Hot-QR vehicular temporal sin mezclarlo con los filtros de consulta.</p>
      </div>
      <label class="form-field">
        <span>Visitante</span>
        <input bind:value={visitorPermitForm.visitorName} placeholder="Carlos Ruiz" required />
      </label>
      <label class="form-field">
        <span>Placa</span>
        <input bind:value={visitorPermitForm.plate} placeholder="XYZ-987-B" required />
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
        <input bind:value={visitorPermitForm.color} placeholder="Gris" />
      </label>
      <label class="form-field">
        <span>Motivo</span>
        <input bind:value={visitorPermitForm.reason} placeholder="Entrega de documentos" required />
      </label>
      <label class="form-field">
        <span>Minutos</span>
        <input bind:value={visitorPermitForm.minutes} type="number" min="1" max="1440" />
      </label>
      <label class="form-field">
        <span>Usos</span>
        <input bind:value={visitorPermitForm.maxUses} type="number" min="1" max="10" />
      </label>
      <LoadingButton type="submit" loading={visitorPending} loadingLabel="Generando...">Generar Hot-QR vehicular</LoadingButton>
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
  {/if}

  {#snippet aside()}
    <section class="panel qr-side-panel">
      <QrPreview token={generatedToken} title={generatedTitle || "QR vehicular"} subtitle="El token vehicular se muestra solo al rotar o emitir." autoOpen />
    </section>
    <section class="flow-card">
      <h3>Resumen vehicular</h3>
      <dl class="flow-summary">
        <div><dt>Placa</dt><dd>{flow === "visitor" ? visitorPermitForm.plate || "Pendiente" : vehicleForm.plate || permitVehicleLabel || "Pendiente"}</dd></div>
        <div><dt>Persona</dt><dd>{flow === "vehicle" ? vehicleOwnerLabel || "Pendiente" : flow === "permit" ? permitPersonLabel || "Pendiente" : visitorPermitForm.visitorName || "Visitante"}</dd></div>
        <div><dt>Accion</dt><dd>{flow === "vehicle" ? "Guardar vehiculo" : flow === "permit" ? "Emitir permiso QR" : "Emitir Hot-QR visitante"}</dd></div>
      </dl>
    </section>
  {/snippet}
</FormFlow>

<section class="panel">
  <div class="tabla-header">
    <h2>Vehiculos</h2>
  </div>
  <div class="toolbar">
    <label class="form-field">
      <span>Busqueda</span>
      <input bind:value={filters.q} placeholder="ABC-123-A o Ana Lopez" />
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
    { label: "Ver", icon: "eye", onClick: (row) => { previewVehicle = row as VehicleRow; }, tone: "ghost" },
    { label: "Editar", icon: "edit", onClick: (row) => openVehicleEditor(row as VehicleRow), tone: "ghost" },
    { label: "Aprobar", icon: "check", onClick: (row) => onApproveVehicle(row as VehicleRow), confirm: "Esta accion aprueba el vehiculo seleccionado." },
    { label: "Rechazar", icon: "reject", onClick: (row) => onRejectVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion rechaza el vehiculo seleccionado." },
    { label: "Bloquear", icon: "lock", onClick: (row) => onBlockVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion bloquea el vehiculo seleccionado." },
    { label: "Desactivar", icon: "power", onClick: (row) => onDisableVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion desactiva el vehiculo seleccionado." },
    { label: "Eliminar", icon: "trash", onClick: (row) => onDeleteVehicle(row as VehicleRow), tone: "danger", confirm: "Esta accion hace borrado logico del vehiculo seleccionado." }
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
      <input bind:value={filters.q} placeholder="Ana Lopez o ABC-123-A" />
    </label>
    <EntitySearchSelect
      label="Persona"
      value={filters.permitPersonId}
      displayValue={permitFilterPersonLabel}
      placeholder="21A00000 o Ana Lopez"
      search={searchPeople}
      displayResult={displayPerson}
      onSelect={onSelectPermitFilterPerson}
    />
    <EntitySearchSelect
      label="Vehiculo"
      value={filters.permitVehicleId}
      displayValue={permitFilterVehicleLabel}
      placeholder="ABC-123-A o Nissan"
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
  <div class="toolbar">
      <label class="form-field">
        <span>Estado</span>
        <select bind:value={filters.visitorPermitStatus}>
          <option value="">Todos</option>
          <option value="active">Activo</option>
          <option value="expired">Expirado</option>
          <option value="revoked">Revocado</option>
        </select>
      </label>
      <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterRows}>Filtrar</LoadingButton>
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
    { label: "Ver", icon: "eye", onClick: (row) => { previewVehicle = row as VisitorPermitRow; }, tone: "ghost" },
    { label: "Revocar", icon: "revoke", onClick: (row) => onRevokeVehicleVisitorPermit(row as VisitorPermitRow), tone: "danger", confirm: "Esta accion revoca el acceso vehicular visitante." }
  ]} />
  <PaginationControls
    page={visitorPermitPage}
    pageSize={visitorPermitPageSize}
    total={visitorPermitTotal}
    onChange={onVisitorPermitPageChange}
  />
</section>

<Modal open={Boolean(editingVehicle)} title="Editar Detalles del Vehiculo" size="xl" onClose={closeVehicleEditor}>
  {#if editingVehicle}
    <form class="vehicle-edit-modal" aria-busy={editPending} onsubmit={(event) => { event.preventDefault(); saveVehicleEdit(); }}>
      <p class="vehicle-edit-subtitle">Actualizar la informacion de registro y acceso.</p>

      <button type="button" class="vehicle-photo-dropzone" aria-label="Actualizar foto del vehiculo">
        <span class="vehicle-photo-icon" aria-hidden="true">+</span>
        <span>Haga clic o arrastre para actualizar la foto del vehiculo</span>
        <small>JPG, PNG o WEBP. Max 5MB.</small>
      </button>

      <div class="vehicle-edit-sections">
        <section class="vehicle-edit-section">
          <h3>Informacion del vehiculo</h3>
          <label class="form-field vehicle-edit-wide">
            <span>Marca</span>
            <input bind:value={editVehicleForm.make} placeholder="Toyota" />
          </label>
          <label class="form-field vehicle-edit-wide">
            <span>Modelo</span>
            <input bind:value={editVehicleForm.model} placeholder="Hilux 2022" />
          </label>
          <label class="form-field">
            <span>Placa</span>
            <input bind:value={editVehicleForm.plate} placeholder="ABC-1234" required />
          </label>
          <label class="form-field">
            <span>Tipo de Vehiculo</span>
            <select bind:value={editVehicleForm.vehicleType}>
              {#each Object.entries(vehicleTypeLabels) as [value, label]}
                <option {value}>{label}</option>
              {/each}
            </select>
          </label>
          <label class="form-field">
            <span>Color</span>
            <input bind:value={editVehicleForm.color} placeholder="Blanco" />
          </label>
        </section>

        <section class="vehicle-edit-section">
          <h3>Informacion del conductor</h3>
          <label class="form-field vehicle-edit-wide">
            <span>Nombre Completo</span>
            <input value={String(editingVehicle.ownerName ?? "No capturado")} readonly />
          </label>
          <label class="form-field vehicle-edit-wide">
            <span>Matricula / Identificador</span>
            <input value={String(editingVehicle.matricula ?? editingVehicle.ownerPersonId ?? "No capturado")} readonly />
          </label>
          <label class="form-field vehicle-edit-wide">
            <span>Estado del Vehiculo</span>
            <input value={`${String(editingVehicle.status ?? "")} / ${String(editingVehicle.approvalStatus ?? "")}`} readonly />
          </label>
        </section>
      </div>

      <div class="vehicle-edit-actions">
        <button type="button" onclick={closeVehicleEditor}>Cancelar</button>
        <LoadingButton type="submit" loading={editPending} loadingLabel="Guardando...">Guardar Cambios</LoadingButton>
      </div>
    </form>
  {/if}
</Modal>

<Modal open={Boolean(previewVehicle)} title={previewTitle(previewVehicle)} size="lg" onClose={() => (previewVehicle = null)}>
  {#if previewVehicle}
    <div class="vehicle-preview-modal">
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
      <dl class="vehicle-modal-facts">
        <div>
          <dt>Placa</dt>
          <dd>{String(previewVehicle.plate ?? previewVehicle.vehiclePlate ?? "Sin placa")}</dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{vehicleTypeLabels[String(previewVehicle.vehicleType ?? "other")] ?? "Otro"}</dd>
        </div>
        <div>
          <dt>Marca y modelo</dt>
          <dd>{[previewVehicle.make, previewVehicle.model].filter(Boolean).join(" ") || "No capturado"}</dd>
        </div>
        <div>
          <dt>Color</dt>
          <dd>{String(previewVehicle.color ?? "No capturado")}</dd>
        </div>
        {#if "ownerName" in previewVehicle && previewVehicle.ownerName}
          <div>
            <dt>Propietario</dt>
            <dd>{String(previewVehicle.ownerName)}</dd>
          </div>
        {/if}
      </dl>
    </div>
  {/if}
</Modal>
