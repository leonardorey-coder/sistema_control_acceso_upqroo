<script lang="ts">
  import DataTable from "./DataTable.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    form,
    isSuperAdmin,
    sessionRows,
    auditRows,
    onCreate,
    onDisable,
    onEnable,
    onResetPassword,
    onLoadSessions,
    onRevokeSession
  }: {
    rows: Row[];
    form: { username: string; displayName: string; email: string; role: string; temporaryPassword: string };
    isSuperAdmin: boolean;
    onCreate: () => void;
    sessionRows: Row[];
    auditRows: Row[];
    onDisable: (row: Row) => void;
    onEnable: (row: Row) => void;
    onResetPassword: (row: Row) => void;
    onLoadSessions: (row: Row) => void;
    onRevokeSession: (row: Row) => void;
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
      ]} actions={[
        { label: "Sesiones", onClick: onLoadSessions, tone: "ghost" },
        { label: "Reset", onClick: onResetPassword, tone: "ghost" },
        { label: "Activar", onClick: onEnable, tone: "ghost" },
        { label: "Desactivar", onClick: onDisable, tone: "ghost" }
      ]} />
    </section>
  </section>

  <section class="grid two">
    <section class="panel">
      <h2>Sesiones administrativas</h2>
      <DataTable rows={sessionRows} columns={[
        { key: "adminId", label: "Admin" },
        { key: "ipAddress", label: "IP" },
        { key: "expiresAt", label: "Expira", kind: "date" },
        { key: "revokedAt", label: "Revocada", kind: "date" }
      ]} actions={[{ label: "Revocar", onClick: onRevokeSession, tone: "ghost" }]} />
    </section>
    <section class="panel">
      <h2>Auditoria basica</h2>
      <DataTable rows={auditRows} columns={[
        { key: "action", label: "Accion" },
        { key: "entityType", label: "Entidad" },
        { key: "entityId", label: "ID" },
        { key: "createdAt", label: "Fecha", kind: "date" }
      ]} />
    </section>
  </section>
{:else}
  <section class="panel"><p class="muted">Modulo disponible para super administradores.</p></section>
{/if}
