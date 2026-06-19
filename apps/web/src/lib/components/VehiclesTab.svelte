<script lang="ts">
  import DataTable from "./DataTable.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    vehicleForm,
    permitForm,
    onCreateVehicle,
    onCreatePermitQr
  }: {
    rows: Row[];
    vehicleForm: { ownerPersonId: string; plate: string; make: string; model: string; color: string };
    permitForm: { personId: string; vehicleId: string; validUntil: string };
    onCreateVehicle: () => void;
    onCreatePermitQr: () => void;
  } = $props();
</script>

<section class="grid two">
  <form class="panel" onsubmit={(event) => { event.preventDefault(); onCreateVehicle(); }}>
    <h2>Registrar vehiculo</h2>
    <input bind:value={vehicleForm.ownerPersonId} placeholder="ID persona propietaria" required />
    <input bind:value={vehicleForm.plate} placeholder="Placa" required />
    <input bind:value={vehicleForm.make} placeholder="Marca" />
    <input bind:value={vehicleForm.model} placeholder="Modelo" />
    <input bind:value={vehicleForm.color} placeholder="Color" />
    <button>Guardar vehiculo</button>
  </form>
  <form class="panel" onsubmit={(event) => { event.preventDefault(); onCreatePermitQr(); }}>
    <h2>Permiso vehicular</h2>
    <input bind:value={permitForm.personId} placeholder="ID persona autorizada" required />
    <input bind:value={permitForm.vehicleId} placeholder="ID vehiculo" required />
    <input bind:value={permitForm.validUntil} type="datetime-local" />
    <button>Generar QR vehicular</button>
  </form>
</section>

<section class="panel">
  <DataTable rows={rows} columns={[
    { key: "plate", label: "Placa" },
    { key: "make", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "color", label: "Color" },
    { key: "status", label: "Estado", kind: "status" },
    { key: "ownerPersonId", label: "Propietario" }
  ]} />
</section>
