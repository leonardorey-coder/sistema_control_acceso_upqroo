<script lang="ts">
  import type {
    GateRowPayload,
    GateScannerRowPayload,
    GateStatus,
    GateType,
    PersonTypeRowPayload,
    ScannerDeviceRowPayload
  } from "@control-acceso/shared";
  import LoadingButton from "./LoadingButton.svelte";
  import PaginationControls from "./PaginationControls.svelte";
  import StatusBadge from "./StatusBadge.svelte";

  type GateInput = {
    code: string;
    name: string;
    type: GateType;
    location?: string;
    status: GateStatus;
    schedule: Record<string, unknown>;
    rules: Record<string, unknown>;
    notes?: string;
  };

  let {
    rows,
    total,
    page,
    pageSize,
    filters,
    scannerDevices,
    personTypeRows,
    isSuperAdmin,
    onFilter,
    onPageChange,
    onCreate,
    onUpdate,
    onSetStatus,
    onLoadScanners,
    onCreateScanner,
    onRevokeScanner
  }: {
    rows: GateRowPayload[];
    total: number;
    page: number;
    pageSize: number;
    filters: { q: string; gateType: string; gateStatus: string };
    scannerDevices: ScannerDeviceRowPayload[];
    personTypeRows: PersonTypeRowPayload[];
    isSuperAdmin: boolean;
    onFilter: () => void | Promise<void>;
    onPageChange: (next: { page: number; pageSize: number }) => void;
    onCreate: (input: GateInput) => void | Promise<void>;
    onUpdate: (id: string, input: Partial<GateInput>) => void | Promise<void>;
    onSetStatus: (id: string, action: "disable" | "block" | "emergency" | "activate" | "maintenance") => void | Promise<void>;
    onLoadScanners: (id: string) => Promise<GateScannerRowPayload[]>;
    onCreateScanner: (gateId: string, input: { scannerDeviceId?: string; scannerId?: string; label?: string }) => void | Promise<void>;
    onRevokeScanner: (gateId: string, scannerId: string) => void | Promise<void>;
  } = $props();

  const gateTypes: Array<{ value: GateType; label: string }> = [
    { value: "pedestrian", label: "Peatonal" },
    { value: "vehicle", label: "Vehicular" },
    { value: "mixed", label: "Mixta" },
    { value: "visitors", label: "Visitantes" },
    { value: "staff", label: "Personal" },
    { value: "providers", label: "Proveedores" },
    { value: "events", label: "Eventos" },
    { value: "emergency", label: "Emergencia" }
  ];
  const gateStatuses: Array<{ value: GateStatus; label: string }> = [
    { value: "active", label: "Activa" },
    { value: "inactive", label: "Inactiva" },
    { value: "maintenance", label: "Mantenimiento" },
    { value: "entry_only", label: "Solo entrada" },
    { value: "exit_only", label: "Solo salida" },
    { value: "blocked", label: "Bloqueada" },
    { value: "emergency", label: "Emergencia" }
  ];
  const weekdays = [
    { value: "1", label: "L" }, { value: "2", label: "M" }, { value: "3", label: "X" },
    { value: "4", label: "J" }, { value: "5", label: "V" }, { value: "6", label: "S" }, { value: "0", label: "D" }
  ];

  let editingId = $state("");
  let form = $state({
    code: "",
    name: "",
    type: "mixed" as GateType,
    location: "",
    status: "active" as GateStatus,
    notes: "",
    scheduleEnabled: false,
    start: "06:00",
    end: "22:00",
    days: ["1", "2", "3", "4", "5", "6"] as string[],
    allowedAccessModes: ["pedestrian", "vehicle", "visitor", "manual"] as string[],
    allowedPersonTypes: [] as string[]
  });
  let saving = $state(false);
  let filterPending = $state(false);
  let selectedGate = $state<GateRowPayload | null>(null);
  let scanners = $state<GateScannerRowPayload[]>([]);
  let scannersLoading = $state(false);
  let scannerForm = $state({ scannerDeviceId: "", scannerId: "", label: "" });
  let scannerSaving = $state(false);

  function resetForm() {
    editingId = "";
    form = {
      code: "", name: "", type: "mixed", location: "", status: "active", notes: "",
      scheduleEnabled: false, start: "06:00", end: "22:00", days: ["1", "2", "3", "4", "5", "6"],
      allowedAccessModes: ["pedestrian", "vehicle", "visitor", "manual"], allowedPersonTypes: []
    };
  }

  function editGate(row: GateRowPayload) {
    const weekly = row.schedule?.weekly ?? {};
    const firstSlot = Object.values(weekly)[0]?.[0];
    editingId = row.id;
    form = {
      code: row.code,
      name: row.name,
      type: row.type,
      location: row.location ?? "",
      status: row.status,
      notes: row.notes ?? "",
      scheduleEnabled: Object.keys(weekly).length > 0,
      start: firstSlot?.start ?? "06:00",
      end: firstSlot?.end ?? "22:00",
      days: Object.keys(weekly),
      allowedAccessModes: row.rules?.allowedAccessModes ?? ["pedestrian", "vehicle", "visitor", "manual"],
      allowedPersonTypes: row.rules?.allowedPersonTypes ?? []
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function gatePayload(): GateInput {
    const weekly = form.scheduleEnabled
      ? Object.fromEntries(form.days.map((day) => [day, [{ start: form.start, end: form.end }]]))
      : undefined;
    return {
      code: form.code,
      name: form.name,
      type: form.type,
      location: form.location || undefined,
      status: form.status,
      schedule: weekly ? { timezone: "America/Cancun", weekly } : {},
      rules: {
        allowedAccessModes: form.allowedAccessModes,
        ...(form.allowedPersonTypes.length ? { allowedPersonTypes: form.allowedPersonTypes } : {})
      },
      notes: form.notes || undefined
    };
  }

  async function saveGate() {
    saving = true;
    try {
      if (editingId) await onUpdate(editingId, gatePayload());
      else await onCreate(gatePayload());
      resetForm();
    } finally {
      saving = false;
    }
  }

  async function filterGates() {
    filterPending = true;
    try { await onFilter(); } finally { filterPending = false; }
  }

  async function selectGate(row: GateRowPayload) {
    selectedGate = row;
    scannersLoading = true;
    try { scanners = await onLoadScanners(row.id); } finally { scannersLoading = false; }
  }

  async function addScanner() {
    if (!selectedGate) return;
    scannerSaving = true;
    try {
      await onCreateScanner(selectedGate.id, {
        scannerDeviceId: scannerForm.scannerDeviceId || undefined,
        scannerId: scannerForm.scannerId || undefined,
        label: scannerForm.label || undefined
      });
      scannerForm = { scannerDeviceId: "", scannerId: "", label: "" };
      scanners = await onLoadScanners(selectedGate.id);
    } finally { scannerSaving = false; }
  }

  async function revokeScanner(row: GateScannerRowPayload) {
    if (!selectedGate) return;
    await onRevokeScanner(selectedGate.id, row.id);
    scanners = await onLoadScanners(selectedGate.id);
  }
</script>

<div class="grid two gates-layout">
  <form class="panel form-grid gate-form" onsubmit={(event) => { event.preventDefault(); saveGate(); }}>
    <div class="tabla-header">
      <h2>{editingId ? "Editar puerta" : "Nueva puerta"}</h2>
      {#if editingId}<button type="button" class="ghost" onclick={resetForm}>Cancelar</button>{/if}
    </div>
    <label class="form-field"><span>Codigo estable</span><input bind:value={form.code} placeholder="caseta-principal" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
    <label class="form-field"><span>Nombre</span><input bind:value={form.name} placeholder="Caseta principal" required /></label>
    <label class="form-field"><span>Tipo</span><select bind:value={form.type}>{#each gateTypes as option}<option value={option.value}>{option.label}</option>{/each}</select></label>
    <label class="form-field"><span>Estado</span><select bind:value={form.status}>{#each gateStatuses as option}<option value={option.value}>{option.label}</option>{/each}</select></label>
    <label class="form-field full"><span>Ubicacion</span><input bind:value={form.location} placeholder="Acceso norte del campus" /></label>

    <fieldset class="gate-fieldset full">
      <legend>Horario</legend>
      <label class="check-row"><input type="checkbox" bind:checked={form.scheduleEnabled} /> Restringir por horario</label>
      {#if form.scheduleEnabled}
        <div class="gate-time-row">
          <label class="form-field"><span>Abre</span><input type="time" bind:value={form.start} /></label>
          <label class="form-field"><span>Cierra</span><input type="time" bind:value={form.end} /></label>
        </div>
        <div class="weekday-picker" aria-label="Dias habilitados">
          {#each weekdays as day}<label><input type="checkbox" value={day.value} bind:group={form.days} /><span>{day.label}</span></label>{/each}
        </div>
      {/if}
    </fieldset>

    <fieldset class="gate-fieldset full">
      <legend>Modos permitidos</legend>
      <div class="gate-check-grid">
        {#each [["pedestrian", "Peatonal"], ["vehicle", "Vehicular"], ["visitor", "Visitante"], ["manual", "Manual"]] as mode}
          <label class="check-row"><input type="checkbox" value={mode[0]} bind:group={form.allowedAccessModes} /> {mode[1]}</label>
        {/each}
      </div>
    </fieldset>

    <fieldset class="gate-fieldset full">
      <legend>Tipos de persona</legend>
      <p class="muted">Sin seleccion permite todos.</p>
      <div class="gate-check-grid">
        {#each personTypeRows as type}<label class="check-row"><input type="checkbox" value={type.code} bind:group={form.allowedPersonTypes} /> {type.label}</label>{/each}
      </div>
    </fieldset>
    <label class="form-field full"><span>Notas</span><textarea bind:value={form.notes} placeholder="Indicaciones operativas para guardias"></textarea></label>
    <LoadingButton type="submit" loading={saving} loadingLabel="Guardando..." disabled={!isSuperAdmin}>{editingId ? "Guardar cambios" : "Crear puerta"}</LoadingButton>
    {#if !isSuperAdmin}<p class="muted full">Solo un super administrador puede modificar puertas.</p>{/if}
  </form>

  <section class="panel">
    <div class="tabla-header"><h2>Puertas</h2><span>{total} registradas</span></div>
    <div class="toolbar">
      <label class="form-field"><span>Busqueda</span><input bind:value={filters.q} placeholder="caseta o ubicacion" /></label>
      <label class="form-field"><span>Tipo</span><select bind:value={filters.gateType}><option value="">Todos</option>{#each gateTypes as option}<option value={option.value}>{option.label}</option>{/each}</select></label>
      <label class="form-field"><span>Estado</span><select bind:value={filters.gateStatus}><option value="">Todos</option>{#each gateStatuses as option}<option value={option.value}>{option.label}</option>{/each}</select></label>
      <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterGates}>Filtrar</LoadingButton>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Puerta</th><th>Tipo</th><th>Estado</th><th>Scanners</th><th>Ultimo uso</th><th class="actions-cell">Acciones</th></tr></thead>
        <tbody>
          {#each rows as row}
            <tr>
              <td><strong>{row.name}</strong><div class="muted gate-code">{row.code}{row.location ? ` · ${row.location}` : ""}</div></td>
              <td>{gateTypes.find((item) => item.value === row.type)?.label ?? row.type}</td>
              <td><StatusBadge value={row.status} /></td>
              <td>{row.activeScannerCount ?? 0} / {row.scannerCount ?? 0}</td>
              <td>{row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString("es-MX") : "Sin uso"}</td>
              <td class="actions-cell"><div class="row-actions">
                <button type="button" class="ghost" onclick={() => selectGate(row)}>Scanners</button>
                {#if isSuperAdmin}<button type="button" class="ghost" onclick={() => editGate(row)}>Editar</button>{/if}
              </div></td>
            </tr>
          {:else}<tr><td colspan="6" class="empty-cell">No hay puertas con estos filtros.</td></tr>{/each}
        </tbody>
      </table>
    </div>
    <PaginationControls {page} {pageSize} {total} onChange={onPageChange} />

    {#if selectedGate}
      <div class="gate-scanner-section">
        <div class="tabla-header"><h3>Scanners de {selectedGate.name}</h3><StatusBadge value={selectedGate.status} /></div>
        {#if isSuperAdmin}
          <form class="toolbar" onsubmit={(event) => { event.preventDefault(); addScanner(); }}>
            <label class="form-field"><span>Dispositivo autorizado</span><select bind:value={scannerForm.scannerDeviceId}><option value="">Asignacion por codigo</option>{#each scannerDevices.filter((device) => device.status === "active") as device}<option value={device.id}>{device.label} · {device.code}</option>{/each}</select></label>
            <label class="form-field"><span>Codigo scanner</span><input bind:value={scannerForm.scannerId} placeholder="caseta-norte-01" disabled={Boolean(scannerForm.scannerDeviceId)} /></label>
            <label class="form-field"><span>Etiqueta</span><input bind:value={scannerForm.label} placeholder="Tablet de caseta" /></label>
            <LoadingButton type="submit" loading={scannerSaving} loadingLabel="Asignando..." disabled={!scannerForm.scannerDeviceId && !scannerForm.scannerId}>Asignar</LoadingButton>
          </form>
        {/if}
        {#if scannersLoading}<p class="muted">Cargando scanners...</p>{:else}
          <div class="table-wrap"><table class="data-table gate-scanner-table"><thead><tr><th>Scanner</th><th>Estado</th><th>Dispositivo</th><th>Ultimo uso</th><th class="actions-cell">Accion</th></tr></thead><tbody>
            {#each scanners as scanner}<tr><td><strong>{scanner.label}</strong><div class="muted gate-code">{scanner.scannerId}</div></td><td><StatusBadge value={scanner.status} /></td><td>{scanner.deviceLabel ?? "Codigo local"}</td><td>{scanner.lastSeenAt ? new Date(scanner.lastSeenAt).toLocaleString("es-MX") : "Sin uso"}</td><td class="actions-cell">{#if isSuperAdmin && scanner.status !== "revoked"}<button type="button" class="danger ghost" onclick={() => revokeScanner(scanner)}>Revocar</button>{/if}</td></tr>
            {:else}<tr><td colspan="5" class="empty-cell">Esta puerta todavia no tiene scanners.</td></tr>{/each}
          </tbody></table></div>
        {/if}
        {#if isSuperAdmin}<div class="gate-state-actions"><span>Estado rapido:</span><button type="button" class="ghost" onclick={() => onSetStatus(selectedGate!.id, "activate")}>Activar</button><button type="button" class="ghost" onclick={() => onSetStatus(selectedGate!.id, "maintenance")}>Mantenimiento</button><button type="button" class="ghost" onclick={() => onSetStatus(selectedGate!.id, "block")}>Bloquear</button><button type="button" class="ghost" onclick={() => onSetStatus(selectedGate!.id, "emergency")}>Emergencia</button></div>{/if}
      </div>
    {/if}
  </section>
</div>
