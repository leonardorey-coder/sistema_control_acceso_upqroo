<script lang="ts">
  import type { AdminRowPayload, AdminSessionRowPayload, AuditLogRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import Modal from "./Modal.svelte";

  type Row = Record<string, unknown>;
  type AdminRow = AdminRowPayload & Row;
  type AdminSessionRow = AdminSessionRowPayload & Row;
  type AuditRow = AuditLogRowPayload & Row;

  let {
    rows,
    form,
    editForm,
    auditFilters,
    isSuperAdmin,
    sessionRows,
    auditRows,
    onCreate,
    onSelect,
    onUpdate,
    onDisable,
    onEnable,
    onResetPassword,
    onLoadSessions,
    onRevokeSession,
    onFilterAudit
  }: {
    rows: AdminRow[];
    form: { username: string; displayName: string; email: string; role: string; temporaryPassword: string };
    editForm: {
      id: string;
      username: string;
      displayName: string;
      email: string;
      role: string;
      status: string;
      mustChangePassword: boolean;
    };
    auditFilters: { q: string; action: string; entityType: string; from: string; to: string };
    isSuperAdmin: boolean;
    onCreate: () => void;
    sessionRows: AdminSessionRow[];
    auditRows: AuditRow[];
    onSelect: (row: AdminRow) => void;
    onUpdate: () => void;
    onDisable: (row: Row) => void;
    onEnable: (row: Row) => void;
    onResetPassword: (row: Row) => void;
    onLoadSessions: (row: Row) => void;
    onRevokeSession: (row: Row) => void;
    onFilterAudit: () => void;
  } = $props();

  let selectedAudit = $state<AuditRow | null>(null);

  function auditMetadata(row: AuditRow | null) {
    if (!row) return "{}";
    return JSON.stringify(row.metadata ?? {}, null, 2);
  }
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
    <form class="panel" onsubmit={(event) => { event.preventDefault(); onUpdate(); }}>
      <h2>Editar administrador</h2>
      {#if editForm.id}
        <input bind:value={editForm.username} placeholder="Usuario" required />
        <input bind:value={editForm.displayName} placeholder="Nombre" required />
        <input bind:value={editForm.email} placeholder="Correo" />
        <select bind:value={editForm.role}>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
        <select bind:value={editForm.status}>
          <option value="active">Activo</option>
          <option value="disabled">Deshabilitado</option>
        </select>
        <label class="check-row">
          <input type="checkbox" bind:checked={editForm.mustChangePassword} />
          Requerir cambio de password
        </label>
        <button>Guardar cambios</button>
      {:else}
        <p class="muted">Selecciona un administrador para editar datos, rol o estado.</p>
      {/if}
    </form>
  </section>

  <section class="panel">
    <div class="section-title">
      <h2>Administradores</h2>
      <span>{rows.length} cuentas</span>
    </div>
    <DataTable rows={rows} columns={[
      { key: "username", label: "Usuario" },
      { key: "displayName", label: "Nombre" },
      { key: "email", label: "Correo" },
      { key: "role", label: "Rol" },
      { key: "status", label: "Estado", kind: "status" },
      { key: "mustChangePassword", label: "Cambio pass" },
      { key: "lastLoginAt", label: "Ultimo login", kind: "date" }
    ]} actions={[
      { label: "Editar", onClick: (row) => onSelect(row as AdminRow), tone: "ghost" },
      { label: "Sesiones", onClick: onLoadSessions, tone: "ghost" },
      { label: "Reset", onClick: onResetPassword, tone: "ghost" },
      { label: "Activar", onClick: onEnable, tone: "ghost" },
      { label: "Desactivar", onClick: onDisable, tone: "ghost" }
    ]} />
  </section>

  <section class="grid two">
    <section class="panel">
      <h2>Sesiones administrativas</h2>
      <DataTable rows={sessionRows} columns={[
        { key: "adminId", label: "Admin" },
        { key: "ipAddress", label: "IP" },
        { key: "userAgent", label: "User-Agent" },
        { key: "lastUsedAt", label: "Ultimo uso", kind: "date" },
        { key: "expiresAt", label: "Expira", kind: "date" },
        { key: "revokedAt", label: "Revocada", kind: "date" }
      ]} actions={[{ label: "Revocar", onClick: onRevokeSession, tone: "ghost" }]} />
    </section>
    <section class="panel">
      <form class="filter-bar" onsubmit={(event) => { event.preventDefault(); onFilterAudit(); }}>
        <input bind:value={auditFilters.q} placeholder="Buscar auditoria" />
        <input bind:value={auditFilters.action} placeholder="Accion" />
        <input bind:value={auditFilters.entityType} placeholder="Entidad" />
        <input type="datetime-local" bind:value={auditFilters.from} />
        <input type="datetime-local" bind:value={auditFilters.to} />
        <button>Filtrar</button>
      </form>
      <h2>Auditoria</h2>
      <DataTable rows={auditRows} columns={[
        { key: "action", label: "Accion" },
        { key: "entityType", label: "Entidad" },
        { key: "entityId", label: "ID" },
        { key: "ipAddress", label: "IP" },
        { key: "actorAdminId", label: "Actor admin" },
        { key: "createdAt", label: "Fecha", kind: "date" }
      ]} actions={[
        { label: "Detalle", onClick: (row) => { selectedAudit = row as AuditRow; }, tone: "ghost" }
      ]} />
    </section>
  </section>

  <Modal open={Boolean(selectedAudit)} title="Detalle de auditoria" onClose={() => (selectedAudit = null)}>
    {#if selectedAudit}
      <dl class="metadata-list">
        <div>
          <dt>Accion</dt>
          <dd>{selectedAudit.action}</dd>
        </div>
        <div>
          <dt>Entidad</dt>
          <dd>{selectedAudit.entityType}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>{selectedAudit.entityId ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Actor admin</dt>
          <dd>{selectedAudit.actorAdminId ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Actor usuario</dt>
          <dd>{selectedAudit.actorAccountId ?? "N/A"}</dd>
        </div>
        <div>
          <dt>IP</dt>
          <dd>{selectedAudit.ipAddress ?? "N/A"}</dd>
        </div>
        <div>
          <dt>User-Agent</dt>
          <dd>{selectedAudit.userAgent ?? "N/A"}</dd>
        </div>
      </dl>
      <h4>Metadata</h4>
      <pre class="metadata-pre">{auditMetadata(selectedAudit)}</pre>
    {/if}
  </Modal>
{:else}
  <section class="panel"><p class="muted">Modulo disponible para super administradores.</p></section>
{/if}
