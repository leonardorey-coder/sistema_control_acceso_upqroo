<script lang="ts">
  import { labelAny, labelFor } from "$lib/ui/labels";
  import ActivityTimeline, { type ActivityItem, type ActivityTone } from "./ActivityTimeline.svelte";
  import type { IconName } from "./Icon.svelte";
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
    gateRows,
    onFilter,
    onPageChange
  }: {
    rows: Row[];
    total: number;
    filters: { q: string; date: string; page: number; pageSize: number; personType: string; accessMode: string; status: string; gateId: string };
    page: number;
    pageSize: number;
    personTypeRows: Row[];
    gateRows: Row[];
    onFilter: () => void | Promise<void>;
    onPageChange: (next: { page: number; pageSize: number }) => void;
  } = $props();

  let filterPending = $state(false);
  const activityItems = $derived(rows.map(accessActivity));

  async function filterRows() {
    filterPending = true;
    try {
      await onFilter();
    } finally {
      filterPending = false;
    }
  }

  function fullName(row: Row) {
    return String(row.nombres ?? row.nombreCompleto ?? row.matricula ?? row.vehiclePlate ?? "Registro de acceso");
  }

  function accessTime(row: Row) {
    return row.salidaAt || row.entradaAt;
  }

  function accessTone(row: Row): ActivityTone {
    const status = String(row.status ?? "");
    if (status === "rejected") return "danger";
    if (status === "completed") return "success";
    if (status === "auto_closed") return "warning";
    if (String(row.accessMode ?? "") === "vehicle") return "info";
    return "primary";
  }

  function accessIcon(row: Row): IconName {
    const mode = String(row.accessMode ?? "");
    const status = String(row.status ?? "");
    if (status === "rejected") return "reject";
    if (mode === "vehicle" || row.vehiclePlate) return "vehicle";
    if (mode === "visitor") return "users";
    if (String(row.credentialType ?? "").includes("qr")) return "qr";
    return "user";
  }

  function accessTitle(row: Row) {
    const mode = labelFor("accessMode", row.accessMode) || "Acceso";
    const status = String(row.status ?? "");
    if (status === "rejected") return `${mode} rechazado`;
    if (status === "completed") return `${mode} completado`;
    if (status === "auto_closed") return "Salida automatica";
    if (row.salidaAt) return `${mode} con salida`;
    return `${mode} registrado`;
  }

  function accessDescription(row: Row) {
    const pieces = [
      row.matricula ? `Matricula ${row.matricula}` : "",
      row.carrera ? String(row.carrera) : "",
      row.adminEntrada ? `Entrada por ${row.adminEntrada}` : "",
      row.adminSalida ? `Salida por ${row.adminSalida}` : "",
      row.gateName ? `Puerta ${row.gateName}` : "",
      row.exitGateName ? `Salida ${row.exitGateName}` : "",
      row.scannerId ? `Scanner ${row.scannerId}` : ""
    ].filter(Boolean);
    return pieces.join(" · ");
  }

  function accessActivity(row: Row): ActivityItem {
    return {
      id: String(row.id ?? row.hashRegistro ?? `${row.matricula ?? ""}-${accessTime(row) ?? ""}`),
      title: accessTitle(row),
      subject: fullName(row),
      description: accessDescription(row),
      time: accessTime(row),
      icon: accessIcon(row),
      tone: accessTone(row),
      chips: [
        { label: labelAny(row.tipoPersona) || "Persona", icon: "users", tone: "primary" },
        { label: labelFor("status", row.status) || "Estado", icon: row.status === "rejected" ? "warning" : "check", tone: accessTone(row) },
        { label: labelFor("credentialType", row.credentialType), icon: "qr", tone: "info" },
        { label: row.vehiclePlate ? `Vehiculo ${row.vehiclePlate}` : "", icon: "vehicle", tone: "info" },
        { label: row.gateName ? `Puerta ${row.gateName}` : "", icon: "shield", tone: "primary" },
        { label: row.isExceptionAccess ? "Excepcion" : "", icon: "shield", tone: "warning" }
      ]
    };
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
      <input bind:value={filters.q} placeholder="21A00000, Ana Lopez o ABC-123-A" />
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
      <span>Puerta</span>
      <select bind:value={filters.gateId}>
        <option value="">Todas las puertas</option>
        {#each gateRows as gate}<option value={String(gate.id)}>{gate.name}</option>{/each}
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
  <ActivityTimeline
    items={activityItems}
    emptyTitle="Sin registros"
    emptyDescription="No hay accesos con los filtros actuales."
  />
  <PaginationControls {page} {pageSize} {total} onChange={onPageChange} />
</section>
