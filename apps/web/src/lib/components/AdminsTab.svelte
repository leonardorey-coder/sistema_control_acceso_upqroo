<script lang="ts">
import type { AdminRowPayload, AdminSessionRowPayload, AuditLogRowPayload, ScannerDeviceRowPayload } from "@control-acceso/shared";
import { labelFor } from "$lib/ui/labels";
import ActivityTimeline, { type ActivityItem, type ActivityTone } from "./ActivityTimeline.svelte";
import AdminUserCard from "./AdminUserCard.svelte";
import ActionCard from "./ActionCard.svelte";
import DataTable from "./DataTable.svelte";
import type { IconName } from "./Icon.svelte";
import LoadingButton from "./LoadingButton.svelte";
import Modal from "./Modal.svelte";
import PaginationControls from "./PaginationControls.svelte";
import SegmentedControl from "./SegmentedControl.svelte";
import Switch from "./Switch.svelte";

  type Row = Record<string, unknown>;
  type AdminRow = AdminRowPayload & Row;
  type AdminSessionRow = AdminSessionRowPayload & Row;
  type AuditRow = AuditLogRowPayload & Row;
  type ScannerDeviceRow = ScannerDeviceRowPayload & Row;

  let {
    rows,
    form,
    editForm,
    auditFilters,
    isSuperAdmin,
    sessionRows,
    scannerDeviceRows,
    auditRows,
    auditTotal,
    auditPage,
    auditPageSize,
    currentAdmin,
    currentSessionId,
    onCreate,
    onApproveScannerDevice,
    onRevokeScannerDevice,
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
    onApproveScannerDevice: (row: Row) => void;
    onRevokeScannerDevice: (row: Row) => void;
    sessionRows: AdminSessionRow[];
    scannerDeviceRows: ScannerDeviceRow[];
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
  let createOpen = $state(false);
  let editOpen = $state(false);
  let section = $state("accounts");
  let sessionsAdminId = $state("");
  let sessionsTitle = $state("Mis sesiones");
  let createPending = $state(false);
  let auditPending = $state(false);
  const auditActivityItems = $derived(auditRows.map((row, index) => auditActivity(row, index)));
  let editPending = $state(false);
  const sectionOptions = [
    { value: "accounts", label: "Cuentas" },
    { value: "sessions", label: "Sesiones" },
    { value: "scanners", label: "Scanners" },
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

  function openCreateModal() {
    createOpen = true;
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
      createOpen = false;
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
    return text.length > 64 ? `${text.slice(0, 61)}…` : text;
  }

  function auditTone(row: AuditRow): ActivityTone {
    const action = String(row.action ?? "");
    if (action.includes("failed") || action.includes("rejected") || action.includes("revoked") || action.includes("disabled")) return "danger";
    if (action.includes("created") || action.includes("enabled") || action.includes("approved") || action.includes("login_success")) return "success";
    if (action.includes("updated") || action.includes("rotated") || action.includes("reset") || action.includes("config")) return "warning";
    if (String(row.entityType ?? "").includes("vehicle")) return "info";
    return "primary";
  }

  function auditIcon(row: AuditRow): IconName {
    const action = String(row.action ?? "");
    const entity = String(row.entityType ?? "");
    if (action.includes("login") || action.includes("session") || action.includes("password")) return "key";
    if (action.includes("failed") || action.includes("rejected") || action.includes("revoked") || action.includes("disabled")) return "shield";
    if (entity.includes("vehicle")) return "vehicle";
    if (entity.includes("credential") || action.includes("qr")) return "qr";
    if (entity.includes("admin") || entity.includes("user")) return "user";
    if (action.includes("config")) return "settings";
    return "file";
  }

  function titleize(value: unknown) {
    return String(value ?? "evento")
      .replace(/[._-]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function auditEntityLabel(row: AuditRow) {
    const entity = String(row.entityType ?? "");
    const labels: Record<string, string> = {
      admin: "Administrador",
      admin_session: "Sesion administrativa",
      scanner_device: "Dispositivo scanner",
      person: "Persona",
      personas: "Personas",
      credential: "Credencial",
      credentials: "Credenciales",
      qr_token: "Credencial QR",
      vehicle: "Vehiculo",
      vehicles: "Vehiculos",
      vehicle_permit: "Permiso vehicular",
      vehicle_permit_qr: "QR de permiso vehicular",
      vehicle_visitor_permit: "Permiso de visitante vehicular",
      config: "Configuracion",
      attendance: "Asistencia",
      access: "Acceso",
      subject: "Materia",
      schedule: "Horario",
      user: "Usuario",
      user_device: "Dispositivo de usuario"
    };
    return labels[entity] ?? titleize(entity || "evento");
  }

  function auditActorName(row: AuditRow) {
    const name = String(row.actorAdminDisplayName ?? row.actorAdminUsername ?? "").trim();
    if (name) return name;
    return row.actorAdminId ? "Admin no disponible" : "Sistema";
  }

  function auditFolio(row: AuditRow, index: number) {
    const date = row.createdAt ? new Date(String(row.createdAt)) : null;
    const stamp = date && !Number.isNaN(date.getTime())
      ? `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
      : "SFECHA";
    return `AUD-${stamp}-${String(index + 1).padStart(2, "0")}`;
  }

  function auditSubject(row: AuditRow, index: number) {
    return `${auditEntityLabel(row)} · ${auditFolio(row, index)}`;
  }

  function auditDescription(row: AuditRow) {
    const parts = [
      row.actorAdminId ? `Ejecutado por ${auditActorName(row)}` : "Evento del sistema",
      row.userAgent ? "Navegador registrado" : "",
      row.ipAddress ? "Origen de red guardado" : ""
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function auditActivity(row: AuditRow, index: number): ActivityItem {
    return {
      id: String(row.id ?? `${row.action ?? ""}-${row.createdAt ?? ""}`),
      title: labelFor("adminAction", row.action) || "Evento de auditoria",
      subject: auditSubject(row, index),
      description: auditDescription(row),
      time: row.createdAt,
      icon: auditIcon(row),
      tone: auditTone(row),
      detailLabel: "Detalle",
      onDetail: () => { selectedAudit = row; },
      chips: [
        { label: auditEntityLabel(row), icon: "file", tone: "primary" },
        { label: auditActorName(row), icon: "shield", tone: "info" },
        { label: auditFolio(row, index), icon: "settings", tone: "muted" }
      ]
    };
  }

  function initials(value: unknown) {
    const text = String(value ?? "").trim();
    if (!text) return "AD";
    return text
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
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
  <section class="panel">
    <div class="section-title">
      <h2>Administradores</h2>
      <div class="button-row">
        <span>{rows.length} cuentas</span>
        <button type="button" onclick={openCreateModal}>Nuevo admin</button>
      </div>
    </div>
    <div class="action-grid admin-user-grid">
      {#each rows as row}
        <AdminUserCard
          name={String(row.displayName ?? row.username ?? "Administrador")}
          username={String(row.username ?? "")}
          email={row.email}
          role={row.role}
          status={row.status}
          initials={initials(row.displayName ?? row.username)}
          lastLoginAt={row.lastLoginAt}
          mustChangePassword={Boolean(row.mustChangePassword)}
          actions={[
            { label: "Editar", icon: "edit", onClick: () => selectForModal(row), tone: "primary" },
            { label: "Sesiones", icon: "user", onClick: () => loadSessions(row), tone: "ghost" },
            { label: "Reset", icon: "refresh", onClick: () => onResetPassword(row), tone: "danger", confirm: "Se generara un password temporal para este administrador." },
            { label: "Activar", icon: "check", onClick: () => onEnable(row), tone: "ghost", disabled: row.status === "active" },
            { label: "Desactivar", icon: "revoke", onClick: () => onDisable(row), tone: "danger", confirm: "Esta accion deshabilita el administrador seleccionado.", disabled: row.status === "disabled" }
          ]}
        />
      {/each}
    </div>
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

  {:else if section === "scanners"}
  <section class="grid two">
    <section class="panel selected-summary">
      <h2>Flujo de vinculacion</h2>
      <p class="muted">El admin abre /scanner desde su dispositivo y solicita autorizacion. El navegador genera una clave local no exportable y envia la clave publica.</p>
      <p class="muted">El superadmin revisa la solicitud pendiente en esta tabla y la aprueba. Hasta entonces no aparece el scanner en ese dispositivo.</p>
    </section>
    <section class="panel selected-summary">
      <h2>Alcance de seguridad</h2>
      <p class="muted">La firma del dispositivo solo autentica el scanner ante el backend; no firma ni crea QR institucionales.</p>
    </section>
  </section>

  <section class="panel">
    <div class="section-title">
      <h2>Dispositivos scanner</h2>
      <span>{scannerDeviceRows.length} dispositivos</span>
    </div>
    <div class="action-grid">
      {#each scannerDeviceRows as row}
        <ActionCard
          title={String(row.label ?? row.code ?? "Scanner")}
          subtitle={String(row.code ?? "")}
          avatar="SC"
          badges={[row.status]}
          meta={[
            { label: "Solicitante", value: row.requestedByAdminId },
            { label: "Ultimo uso", value: row.lastSeenAt, kind: "date" },
            { label: "Creado", value: row.createdAt, kind: "date" }
          ]}
          actions={[
            { label: "Aprobar", icon: "check", onClick: () => onApproveScannerDevice(row), tone: "primary", disabled: row.status !== "pending" },
            { label: "Revocar", icon: "revoke", onClick: () => onRevokeScannerDevice(row), tone: "danger", confirm: "Esta accion revoca el dispositivo scanner seleccionado.", disabled: row.status === "revoked" }
          ]}
        />
      {/each}
    </div>
  </section>

  {:else if section === "audit"}
  <section class="panel">
    <form class="filter-bar" aria-busy={auditPending} onsubmit={(event) => { event.preventDefault(); filterAudit(); }}>
      <label class="form-field">
        <span>Busqueda</span>
        <input bind:value={auditFilters.q} placeholder="login o credencial" />
      </label>
      <label class="form-field">
        <span>Accion</span>
        <input bind:value={auditFilters.action} placeholder="admin.login" />
      </label>
      <label class="form-field">
        <span>Entidad</span>
        <input bind:value={auditFilters.entityType} placeholder="person" />
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
    <div class="section-title">
      <h2>Auditoria</h2>
      <span>{auditTotal} eventos</span>
    </div>
    <ActivityTimeline
      items={auditActivityItems}
      emptyTitle="Sin auditoria"
      emptyDescription="No hay eventos administrativos con los filtros actuales."
    />
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
          <dt>Admin responsable</dt>
          <dd>{auditActorName(selectedAudit)}</dd>
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
  <Modal open={createOpen} title="Crear administrador" size="lg" onClose={() => (createOpen = false)}>
    <form class="form-grid" aria-busy={createPending} onsubmit={(event) => { event.preventDefault(); createAdmin(); }}>
      <label class="form-field">
        <span>Usuario</span>
        <input name="username" bind:value={form.username} placeholder="adminCaseta" autocomplete="username" required />
      </label>
      <label class="form-field">
        <span>Nombre</span>
        <input name="displayName" bind:value={form.displayName} placeholder="Ana Lopez" autocomplete="name" required />
      </label>
      <label class="form-field">
        <span>Correo</span>
        <input name="email" bind:value={form.email} placeholder="ana.lopez@upqroo.edu.mx" type="email" autocomplete="email" />
      </label>
      <label class="form-field">
        <span>Rol</span>
        <select name="role" bind:value={form.role}>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
      </label>
      <label class="form-field">
        <span>Password temporal</span>
        <input name="temporaryPassword" bind:value={form.temporaryPassword} placeholder="TempAcceso2026" autocomplete="new-password" />
      </label>
      <div class="modal-actions">
        <LoadingButton type="submit" loading={createPending} loadingLabel="Creando...">Crear admin</LoadingButton>
        <button type="button" class="ghost" onclick={() => (createOpen = false)}>Cancelar</button>
      </div>
    </form>
  </Modal>
  <Modal open={editOpen} title="Editar administrador" size="lg" onClose={() => (editOpen = false)}>
    {#if editForm.id}
      <form class="form-grid" aria-busy={editPending} onsubmit={(event) => { event.preventDefault(); updateAdmin(); }}>
        <label class="form-field">
          <span>Usuario</span>
          <input name="editUsername" bind:value={editForm.username} placeholder="adminCaseta" autocomplete="username" required />
        </label>
        <label class="form-field">
          <span>Nombre</span>
          <input name="editDisplayName" bind:value={editForm.displayName} placeholder="Ana Lopez" autocomplete="name" required />
        </label>
        <label class="form-field">
          <span>Correo</span>
          <input name="editEmail" bind:value={editForm.email} placeholder="ana.lopez@upqroo.edu.mx" type="email" autocomplete="email" />
        </label>
        <label class="form-field">
          <span>Rol</span>
          <select name="editRole" bind:value={editForm.role}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </label>
        <label class="form-field">
          <span>Estado</span>
          <select name="editStatus" bind:value={editForm.status}>
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
