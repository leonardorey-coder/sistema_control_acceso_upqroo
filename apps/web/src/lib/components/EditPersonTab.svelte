<script lang="ts">
  import type { CareerRowPayload, PersonCredentialRowPayload, PersonRowPayload, PersonTypeRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import EntitySearchSelect from "./EntitySearchSelect.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import Modal from "./Modal.svelte";
  import PaginationControls from "./PaginationControls.svelte";
  import QrPreview from "./QrPreview.svelte";

  type Row = Record<string, unknown>;
  type PersonRow = PersonRowPayload & Row;
  type PersonTypeRow = PersonTypeRowPayload & Row;
  type CareerRow = CareerRowPayload & Row;
  type CredentialRow = PersonCredentialRowPayload & Row;

  let {
    editMatricula = $bindable(),
    editPerson,
    personTypeRows,
    careerRows,
    credentialRows,
    credentialTotal,
    credentialPage,
    credentialPageSize,
    generatedToken,
    generatedTitle,
    onSearch,
    onSave,
    onDisable,
    onEnable,
    onRotateQr,
    onRevokeQr,
    onCredentialPageChange,
    onPhoto,
    searchPeople
  }: {
    editMatricula: string;
    editPerson: PersonRow | null;
    personTypeRows: PersonTypeRow[];
    careerRows: CareerRow[];
    credentialRows: CredentialRow[];
    credentialTotal: number;
    credentialPage: number;
    credentialPageSize: number;
    generatedToken: string;
    generatedTitle: string;
    onSearch: () => void | Promise<void>;
    onSave: () => void | Promise<void>;
    onDisable: () => void | Promise<void>;
    onEnable: () => void | Promise<void>;
    onRotateQr: () => void | Promise<void>;
    onRevokeQr: () => void | Promise<void>;
    onCredentialPageChange: (next: { page: number; pageSize: number }) => void;
    onPhoto: (file: File) => void | Promise<void>;
    searchPeople: (query: string) => Promise<Row[]>;
  } = $props();

  const selectedType = $derived(personTypeRows.find((row) => row.code === editPerson?.tipoPersona));
  const requiresCareer = $derived(Boolean(selectedType?.requiresCareer));
  let editOpen = $state(false);
  let pendingDestructive = $state<"disable" | "revoke" | null>(null);
  let editPersonLabel = $state("");
  let searchPending = $state(false);
  let savePending = $state(false);
  let enablePending = $state(false);
  let rotatePending = $state(false);
  let photoPending = $state(false);

  $effect(() => {
    if (editPerson?.id) editOpen = true;
  });

  async function runDestructive() {
    const action = pendingDestructive;
    pendingDestructive = null;
    if (action === "disable") await onDisable();
    if (action === "revoke") await onRevokeQr();
  }

  function displayPerson(row: Row) {
    return `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim();
  }

  function selectSearchPerson(row: Row | null) {
    editMatricula = row?.matricula ? String(row.matricula) : "";
    editPersonLabel = row ? displayPerson(row) : "";
  }

  async function searchPerson() {
    searchPending = true;
    try {
      await onSearch();
      editOpen = true;
    } finally {
      searchPending = false;
    }
  }

  async function savePerson() {
    savePending = true;
    try {
      await onSave();
    } finally {
      savePending = false;
    }
  }

  async function enablePerson() {
    enablePending = true;
    try {
      await onEnable();
    } finally {
      enablePending = false;
    }
  }

  async function rotateQr() {
    rotatePending = true;
    try {
      await onRotateQr();
    } finally {
      rotatePending = false;
    }
  }

  async function uploadPhoto(file: File) {
    photoPending = true;
    try {
      await onPhoto(file);
    } finally {
      photoPending = false;
    }
  }
</script>

<section class="edit-search-workspace">
  <form class="panel" aria-busy={searchPending} onsubmit={(event) => { event.preventDefault(); searchPerson(); }}>
    <h2>Editar persona</h2>
    <EntitySearchSelect
      label="Matricula"
      value={editMatricula}
      displayValue={editPersonLabel || editMatricula}
      placeholder="21A00000 o Ana Lopez"
      search={searchPeople}
      displayResult={displayPerson}
      onSelect={selectSearchPerson}
      onQueryChange={(query) => {
        editMatricula = query;
        editPersonLabel = "";
      }}
      onSelectSubmit={searchPerson}
    />
    <LoadingButton type="submit" loading={searchPending} loadingLabel="Buscando...">Buscar</LoadingButton>
  </form>
</section>

{#if editPerson}
  <Modal open={editOpen} title="Editar persona" size="xl" onClose={() => (editOpen = false)}>
    <div class="edit-modal-grid">
      <div class="edit-modal-stack">
        <form class="form-grid" aria-busy={savePending || photoPending} onsubmit={(event) => { event.preventDefault(); savePerson(); }}>
          <label class="form-field">
            <span>Matricula</span>
            <input bind:value={editPerson.matricula} placeholder="21A00000" />
          </label>
          <label class="form-field">
            <span>Nombres</span>
            <input bind:value={editPerson.nombres} placeholder="Ana Maria" />
          </label>
          <label class="form-field">
            <span>Apellidos</span>
            <input bind:value={editPerson.apellidos} placeholder="Lopez Perez" />
          </label>
          <label class="form-field">
            <span>Tipo de persona</span>
            <select bind:value={editPerson.tipoPersona}>
              {#each personTypeRows as type}
                <option value={String(type.code)}>{type.label}</option>
              {/each}
            </select>
          </label>
          {#if requiresCareer}
            <label class="form-field">
              <span>Carrera</span>
              <select bind:value={editPerson.carreraId}>
                <option value="">Seleccione carrera</option>
                {#each careerRows as career}
                  <option value={String(career.id)}>{career.nombre}</option>
                {/each}
              </select>
            </label>
          {/if}
          <label class="form-field">
            <span>Estado</span>
            <select bind:value={editPerson.estado}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="suspendido">Suspendido</option>
              <option value="egresado">Egresado</option>
              <option value="baja">Baja</option>
            </select>
          </label>
          <label class="form-field">
            <span>Notas</span>
            <textarea bind:value={editPerson.notas} placeholder="Cambio de carrera validado"></textarea>
          </label>
          <label class="form-field">
            <span>Foto</span>
            <input
              type="file"
              accept="image/*"
              onchange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) uploadPhoto(file);
              }}
            />
          </label>
          {#if photoPending}<span class="muted">Subiendo foto...</span>{/if}
          <div class="modal-actions">
            <LoadingButton type="submit" loading={savePending} loadingLabel="Guardando...">Guardar cambios</LoadingButton>
            <LoadingButton tone="ghost" loading={enablePending} loadingLabel="Activando..." onClick={enablePerson}>Activar</LoadingButton>
            <button type="button" class="danger-button" onclick={() => (pendingDestructive = "disable")}>Desactivar</button>
          </div>
        </form>

        <section class="edit-credentials-section">
          <div class="section-title">
            <h3>Credenciales QR</h3>
            <span>{credentialTotal} registros</span>
          </div>
          <DataTable
            rows={credentialRows}
            columns={[
              { key: "status", label: "Estado", kind: "status" },
              { key: "tokenVersion", label: "Version", compact: true },
              { key: "issuedAt", label: "Emitido", kind: "date" },
              { key: "expiresAt", label: "Expira", kind: "date" },
              { key: "lastUsedAt", label: "Ultimo uso", kind: "date" }
            ]}
          />
          <PaginationControls
            page={credentialPage}
            pageSize={credentialPageSize}
            total={credentialTotal}
            onChange={onCredentialPageChange}
          />
          <div class="button-row">
            <LoadingButton loading={rotatePending} loadingLabel="Rotando..." onClick={rotateQr}>Rotar QR</LoadingButton>
            <button class="danger-button" onclick={() => (pendingDestructive = "revoke")}>Revocar activos</button>
          </div>
        </section>
      </div>

      <aside class="modal-side edit-qr-side" aria-label="QR generado de persona">
        <QrPreview
          token={generatedToken}
          title={generatedTitle || "QR personal"}
          subtitle="El token solo se muestra al generar o rotar."
          subjectName={[editPerson?.nombres, editPerson?.apellidos].filter(Boolean).join(" ")}
          subjectId={String(editPerson?.matricula ?? "")}
          autoOpen
        />
      </aside>
    </div>
  </Modal>

  <Modal open={Boolean(pendingDestructive)} title="Confirmar accion" size="sm" onClose={() => (pendingDestructive = null)}>
    <div class="confirm-body">
      <p>
        {pendingDestructive === "disable"
          ? "Esta accion desactiva la persona seleccionada."
          : "Esta accion revoca los QR personales activos."}
      </p>
      <div class="modal-actions">
        <button type="button" class="ghost" onclick={() => (pendingDestructive = null)}>Cancelar</button>
        <button type="button" class="danger-button" onclick={runDestructive}>Confirmar</button>
      </div>
    </div>
  </Modal>
{/if}
