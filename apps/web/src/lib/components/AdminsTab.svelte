<script lang="ts">
  import DataTable from "./DataTable.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    form,
    isSuperAdmin,
    onCreate
  }: {
    rows: Row[];
    form: { username: string; displayName: string; email: string; role: string; temporaryPassword: string };
    isSuperAdmin: boolean;
    onCreate: () => void;
  } = $props();
</script>

{#if isSuperAdmin}
  <section class="grid two">
    <form class="panel" onsubmit={(event) => { event.preventDefault(); onCreate(); }}>
      <h2>Crear administrador</h2>
      <input bind:value={form.username} placeholder="Usuario" required />
      <input bind:value={form.displayName} placeholder="Nombre" required />
      <input bind:value={form.email} placeholder="Correo" />
      <select bind:value={form.role}>
        <option value="admin">Admin</option>
        <option value="super_admin">Super admin</option>
      </select>
      <input bind:value={form.temporaryPassword} placeholder="Password temporal opcional" />
      <button>Crear admin</button>
    </form>
    <section class="panel">
      <DataTable rows={rows} columns={[
        { key: "username", label: "Usuario" },
        { key: "displayName", label: "Nombre" },
        { key: "email", label: "Correo" },
        { key: "role", label: "Rol" },
        { key: "status", label: "Estado", kind: "status" }
      ]} />
    </section>
  </section>
{:else}
  <section class="panel"><p class="muted">Modulo disponible para super administradores.</p></section>
{/if}
