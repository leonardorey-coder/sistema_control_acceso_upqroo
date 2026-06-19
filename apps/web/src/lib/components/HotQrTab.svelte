<script lang="ts">
  import DataTable from "./DataTable.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    form,
    onCreate
  }: {
    rows: Row[];
    form: { visitorName: string; reason: string; minutes: number };
    onCreate: () => void;
  } = $props();
</script>

<section class="grid two">
  <form class="panel" onsubmit={(event) => { event.preventDefault(); onCreate(); }}>
    <h2>Hot-QR</h2>
    <input bind:value={form.visitorName} placeholder="Visitante" required />
    <input bind:value={form.reason} placeholder="Motivo" required />
    <select bind:value={form.minutes}>
      <option value={15}>15 min</option>
      <option value={30}>30 min</option>
      <option value={60}>1 hora</option>
      <option value={120}>2 horas</option>
      <option value={240}>4 horas</option>
      <option value={480}>8 horas</option>
    </select>
    <button>Generar Hot-QR</button>
  </form>
  <section class="panel">
    <DataTable rows={rows} columns={[
      { key: "visitorName", label: "Visitante" },
      { key: "reason", label: "Motivo" },
      { key: "status", label: "Estado", kind: "status" },
      { key: "validUntil", label: "Expira", kind: "date" },
      { key: "creator", label: "Creador" }
    ]} />
  </section>
</section>
