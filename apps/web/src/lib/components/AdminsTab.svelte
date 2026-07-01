<script lang="ts">
import type { AdminRowPayload, AdminSessionRowPayload, AuditLogRowPayload } from "@control-acceso/shared";
import DataTable from "./DataTable.svelte";
import LoadingButton from "./LoadingButton.svelte";
import Modal from "./Modal.svelte";
import PaginationControls from "./PaginationControls.svelte";
import SegmentedControl from "./SegmentedControl.svelte";
import Switch from "./Switch.svelte";

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
    auditTotal,
    auditPage,
    auditPageSize,
    currentAdmin,
    currentSessionId,
    onCreate,
    onSelect,
    onUpdate,
    onDisable,
    onEnable,
    onResetPassword,
    onLoadSessions,
    onRevokeSession,
    onFilterAudit,
    onAuditPageChange
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
    auditTotal: number;
    auditPage: number;
    auditPageSize: number;
    currentAdmin: { id: string; displayName: string; username: string };
    currentSessionId: string;
    onSelect: (row: AdminRow) => void;
    onUpdate: () => void;
    onDisable: (row: Row) => void;
    onEnable: (row: Row) => void;
    onResetPassword: (row: Row) => void;
    onLoadSessions: (row: Row) => void;
    onRevokeSession: (row: Row) => void;
    onFilterAudit: () => void;
    onAuditPageChange: (next: { page: number; pageSize: number }) => void;
  } = $props();

  let selectedAudit = $state<AuditRow | null>(null);
  let editOpen = $state(false);
  let section = $state("accounts");
  let sessionsAdminId = $state("");
  let sessionsTitle = $state("Mis sesiones");
  let createPending = $state(false);
  let auditPending = $state(false);
  let editPending = $state(false);
  const sectionOptions = [
    { value: "accounts", label: "Cuentas" },
    { value: "sessions", label: "Sesiones" },
    { value: "audit", label: "Auditoria" }
  ];

  function auditMetadata(row: AuditRow | null) {
    if (!row) return "{}";
    return JSON.stringify(row.metadata ?? {}, null, 2);
  }

  function selectForModal(row: AdminRow) {
    onSelect(row);
    editOpen = true;
  }

  function loadSessions(row: Row) {
    sessionsAdminId = String(row.id ?? currentAdmin.id);
    sessionsTitle = row.displayName ? `Sesiones de ${row.displayName}` : "Sesiones administrativas";
    onLoadSessions(row);
    section = "sessions";
  }

  async function loadMySessions() {
    sessionsAdminId = currentAdmin.id;
    sessionsTitle = "Mis sesiones";
    await onLoadSessions({ id: currentAdmin.id, displayName: currentAdmin.displayName, username: currentAdmin.username });
  }

  async function createAdmin() {
    createPending = true;
    try {
      await onCreate();
    } finally {
      createPending = false;
    }
  }

  async function filterAudit() {
    auditPending = true;
    try {
      await onFilterAudit();
    } finally {
      auditPending = false;
    }
  }

  async function updateAdmin() {
    editPending = true;
    try {
      await onUpdate();
      editOpen = false;
    } finally {
      editPending = false;
    }
  }

  function sessionState(row: Row) {
    if (String(row.id) === currentSessionId) return "Actual";
    if (row.revokedAt) return "Revocada";
    return "Activa";
  }

  function shortUserAgent(value: unknown) {
    const text = String(value ?? "");
    if (!text) return "";
    return text.length > 64 ? `${text.slice(0, 61)}...` : text;
  }

  $effect(() => {
    if (section === "sessions" && !sessionsAdminId && currentAdmin.id) {
      loadMySessions().catch(() => null);
    }
  });
</script>

{#if isSuperAdmin}
  <div class="workspace-header">
    <div>
      <h2>Administradores</h2>
      <p>Gestiona cuentas, sesiones y auditoria sin mezclar tablas en una misma vista.</p>
    </div>
    <SegmentedControl bind:value={section} options={sectionOptions} label="Seccion de administradores" />
  </div>

  {#if section === "accounts"}
  <section class="grid two">
    <form class="panel" aria-busy={createPending} onsubmit={(event) => { event.preventDefault(); createAdmin(); }}>
      <h2>Crear administrador</h2>
      <label class="form-field">
        <span>Usuario</span>
        <input bind:value={form.username} placeholder="Usuario" required />
      </label>
      <label class="form-field">
        <span>Nombre</span>
        <input bind:value={form.displayName} placeholder="Nombre" required />
      </label>
      <label class="form-field">
        <span>Correo</span>
        <input bind:value={form.email} placeholder="Correo" />
      </label>
      <label class="form-field">
        <span>Rol</span>
        <select bind:value={form.role}>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
      </label>
      <label class="form-field">
        <span>Password temporal</span>
        <input bind:value={form.temporaryPassword} placeholder="Password temporal opcional" />
      </label>
      <LoadingButton type="submit" loading={createPending} loadingLabel="Creando...">Crear admin</LoadingButton>
    </form>
    <section class="panel selected-summary centered-empty">
      <h2>Edicion en modal</h2>
      <p class="muted">Usa Editar en la tabla para abrir el formulario sin perder el contexto.</p>
      {#if editForm.id}
        <button type="button" class="ghost" onclick={() => (editOpen = true)}>Reabrir edicion</button>
      {/if}
    </section>
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
      { key: "role", label: "Rol", kind: "role" },
      { key: "status", label: "Estado", kind: "status" },
      { key: "mustChangePassword", label: "Cambio pass", kind: "boolean" },
      { key: "lastLoginAt", label: "Ultimo login", kind: "date" }
    ]} actions={[
      { label: "Editar", icon: "edit", onClick: (row) => selectForModal(row as AdminRow), tone: "ghost" },
      { label: "Sesiones", icon: "user", onClick: loadSessions, tone: "ghost" },
      { label: "Reset", icon: "refresh", onClick: onResetPassword, tone: "danger", confirm: "Se generara un password temporal para este administrador." },
      { label: "Activar", icon: "check", onClick: onEnable, tone: "ghost" },
      { label: "Desactivar", icon: "revoke", onClick: onDisable, tone: "danger", confirm: "Esta accion deshabilita el administrador seleccionado." }
    ]} />
  </section>

  {:else if section === "sessions"}
  <section class="panel">
    <div class="section-title">
      <h2>{sessionsTitle}</h2>
      <button type="button" class="ghost" onclick={loadMySessions}>Ver mis sesiones</button>
    </div>
    <DataTable rows={sessionRows} columns={[
      { key: "id", label: "Sesion", kind: "technical", minWidth: "120px", truncate: true },
      { key: "state", label: "Estado", format: (_value, row) => sessionState(row), minWidth: "96px" },
      { key: "ipAddress", label: "IP", minWidth: "112px", nowrap: true },
      { key: "userAgent", label: "User-Agent", format: shortUserAgent, minWidth: "220px", truncate: true },
      { key: "lastUsedAt", label: "Ultimo uso", kind: "date", minWidth: "150px" },
      { key: "expiresAt", label: "Expira", kind: "date", minWidth: "150px" },
      { key: "revokedAt", label: "Revocada", kind: "date", minWidth: "150px" }
    ]} actions={[{
      label: "Revocar",
      icon: "revoke",
      onClick: onRevokeSession,
      tone: "danger",
      confirm: "Esta accion revoca la sesion administrativa.",
      disabled: (row) => String(row.id) === currentSessionId || Boolean(row.revokedAt)
    }]} />
  </section>

  {:else if section === "audit"}
  <section class="panel">
    <form class="filter-bar" aria-busy={auditPending} onsubmit={(event) => { event.preventDefault(); filterAudit(); }}>
      <label class="form-field">
        <span>Busqueda</span>
        <input bind:value={auditFilters.q} placeholder="Buscar auditoria" />
      </label>
      <label class="form-field">
        <span>Accion</span>
        <input bind:value={auditFilters.action} placeholder="Accion" />
      </label>
      <label class="form-field">
        <span>Entidad</span>
        <input bind:value={auditFilters.entityType} placeholder="Entidad" />
      </label>
      <label class="form-field">
        <span>Desde</span>
        <input type="datetime-local" bind:value={auditFilters.from} />
      </label>
      <label class="form-field">
        <span>Hasta</span>
        <input type="datetime-local" bind:value={auditFilters.to} />
      </label>
      <LoadingButton type="submit" loading={auditPending} loadingLabel="Filtrando...">Filtrar</LoadingButton>
    </form>
    <h2>Auditoria</h2>
    <DataTable rows={auditRows} columns={[
      { key: "action", label: "Accion", kind: "adminAction", minWidth: "190px" },
      { key: "entityType", label: "Entidad", minWidth: "120px" },
      { key: "entityId", label: "ID", kind: "technical", minWidth: "130px", truncate: true, hideOnMobile: true },
      { key: "ipAddress", label: "IP", minWidth: "112px", nowrap: true },
      { key: "userAgent", label: "User-Agent", format: shortUserAgent, minWidth: "180px", truncate: true, hideOnMobile: true },
      { key: "actorAdminId", label: "Actor admin", kind: "technical", minWidth: "130px", truncate: true, hideOnMobile: true },
      { key: "createdAt", label: "Fecha", kind: "date", minWidth: "150px" }
    ]} actions={[
      { label: "Detalle", icon: "search", onClick: (row) => { selectedAudit = row as AuditRow; }, tone: "ghost" }
    ]} />
    <PaginationControls
      page={auditPage}
      pageSize={auditPageSize}
      total={auditTotal}
      onChange={onAuditPageChange}
    />
  </section>
  {/if}

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
  <Modal open={editOpen} title="Editar administrador" size="lg" onClose={() => (editOpen = false)}>
    {#if editForm.id}
      <form class="form-grid" aria-busy={editPending} onsubmit={(event) => { event.preventDefault(); updateAdmin(); }}>
        <label class="form-field">
          <span>Usuario</span>
          <input bind:value={editForm.username} placeholder="Usuario" required />
        </label>
        <label class="form-field">
          <span>Nombre</span>
          <input bind:value={editForm.displayName} placeholder="Nombre" required />
        </label>
        <label class="form-field">
          <span>Correo</span>
          <input bind:value={editForm.email} placeholder="Correo" />
        </label>
        <label class="form-field">
          <span>Rol</span>
          <select bind:value={editForm.role}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </label>
        <label class="form-field">
          <span>Estado</span>
          <select bind:value={editForm.status}>
            <option value="active">Activo</option>
            <option value="disabled">Deshabilitado</option>
          </select>
        </label>
        <Switch bind:checked={editForm.mustChangePassword} label="Requerir cambio de password" />
        <div class="modal-actions">
          <LoadingButton type="submit" loading={editPending} loadingLabel="Guardando...">Guardar cambios</LoadingButton>
          <button type="button" class="ghost" onclick={() => (editOpen = false)}>Cancelar</button>
        </div>
      </form>
    {:else}
      <p class="muted">Selecciona un administrador para editar.</p>
    {/if}
  </Modal>
{:else}
  <section class="panel"><p class="muted">Modulo disponible para super administradores.</p></section>
{/if}
