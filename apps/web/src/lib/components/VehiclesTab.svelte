<script lang="ts">
  import type { PersonRowPayload, VehiclePermitRowPayload, VehicleRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import QrPreview from "./QrPreview.svelte";

  type Row = Record<string, unknown>;
  type PersonRow = PersonRowPayload & Row;
  type VehicleRow = VehicleRowPayload & Row;
  type PermitRow = VehiclePermitRowPayload & Row;

  let {
    rows,
    permitRows,
    vehicleForm,
    permitForm,
    peopleRows,
    generatedToken,
    generatedTitle,
    filters,
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
    peopleRows: PersonRow[];
    generatedToken: string;
    generatedTitle: string;
    filters: { q: string; vehicleStatus: string };
    onCreateVehicle: () => void;
    onCreatePermitQr: () => void;
    onCreateDynamicPermitQr: (row: PermitRow) => void;
    onRevokePermit: (row: PermitRow) => void;
    onDisableVehicle: (row: VehicleRow) => void;
    onFilter: () => void;
  } = $props();
</script>

<section class="grid two">
  <form class="panel" onsubmit={(event) => { event.preventDefault(); onCreateVehicle(); }}>
    <h2>Registrar vehiculo</h2>
    <select bind:value={vehicleForm.ownerPersonId} required>
      <option value="">Persona propietaria</option>
      {#each peopleRows as person}
        <option value={String(person.id)}>{person.matricula} - {person.nombres} {person.apellidos}</option>
      {/each}
    </select>
    <input bind:value={vehicleForm.plate} placeholder="Placa" required />
    <input bind:value={vehicleForm.make} placeholder="Marca" />
    <input bind:value={vehicleForm.model} placeholder="Modelo" />
    <input bind:value={vehicleForm.color} placeholder="Color" />
    <button>Guardar vehiculo</button>
  </form>
  <form class="panel" onsubmit={(event) => { event.preventDefault(); onCreatePermitQr(); }}>
    <h2>Permiso vehicular</h2>
    <select bind:value={permitForm.personId} required>
      <option value="">Persona autorizada</option>
      {#each peopleRows as person}
        <option value={String(person.id)}>{person.matricula} - {person.nombres} {person.apellidos}</option>
      {/each}
    </select>
    <select bind:value={permitForm.vehicleId} required>
      <option value="">Vehiculo</option>
      {#each rows as vehicle}
        <option value={String(vehicle.id)}>{vehicle.plate} {vehicle.make ? `- ${vehicle.make}` : ""}</option>
      {/each}
    </select>
    <input bind:value={permitForm.validUntil} type="datetime-local" />
    <button>Generar QR vehicular</button>
  </form>
</section>

<section class="panel">
  <QrPreview token={generatedToken} title={generatedTitle || "QR vehicular"} subtitle="El token vehicular se muestra solo al rotar o emitir." />
</section>

<section class="panel">
  <div class="tabla-header">
    <h2>Vehiculos</h2>
  </div>
  <div class="toolbar">
    <input bind:value={filters.q} placeholder="Buscar placa, marca o persona" />
    <select bind:value={filters.vehicleStatus}>
      <option value="">Todos</option>
      <option value="active">Activo</option>
      <option value="inactive">Inactivo</option>
      <option value="blocked">Bloqueado</option>
    </select>
    <button onclick={onFilter}>Filtrar</button>
  </div>
  <DataTable rows={rows} columns={[
    { key: "plate", label: "Placa" },
    { key: "make", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "color", label: "Color" },
    { key: "status", label: "Estado", kind: "status" },
    { key: "ownerPersonId", label: "Propietario" }
  ]} actions={[{ label: "Desactivar", onClick: (row) => onDisableVehicle(row as VehicleRow), tone: "ghost" }]} />
</section>

<section class="panel">
  <h2>Permisos vehiculares</h2>
  <DataTable rows={permitRows} columns={[
    { key: "personId", label: "Persona" },
    { key: "vehicleId", label: "Vehiculo" },
    { key: "status", label: "Estado", kind: "status" },
    { key: "validUntil", label: "Vigencia", kind: "date" }
  ]} actions={[
    { label: "QR dinamico", onClick: (row) => onCreateDynamicPermitQr(row as PermitRow) },
    { label: "Revocar", onClick: (row) => onRevokePermit(row as PermitRow), tone: "ghost" }
  ]} />
</section>
