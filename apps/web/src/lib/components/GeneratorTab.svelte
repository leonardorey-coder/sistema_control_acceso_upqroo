<script lang="ts">
  import type { CareerRowPayload, PersonTypeRowPayload, TemporaryDailyQrRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import EntitySearchSelect from "./EntitySearchSelect.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import PaginationControls from "./PaginationControls.svelte";
  import QrPreview from "./QrPreview.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  type Row = Record<string, unknown>;
  type PersonTypeRow = PersonTypeRowPayload & Row;
  type CareerRow = CareerRowPayload & Row;
  type TemporaryQrRow = TemporaryDailyQrRowPayload & Row;
  type ImportSummary = {
    created: number;
    updated: number;
    issuedQr: number;
    skipped: number;
    errors: Array<{ row: number; code: string; message: string }>;
  };

  let {
    personForm,
    personTypeRows,
    careerRows,
    generatedToken,
    generatedTitle,
    temporaryGeneratedToken,
    temporaryGeneratedTitle,
    temporaryQrError,
    temporaryQrForm,
    temporaryQrPersonLabel,
    temporaryRows,
    temporaryFilters,
    temporaryTotal,
    temporaryPage,
    temporaryPageSize,
    onTemporaryPageChange,
    onFilterTemporaryQr,
    searchPeople,
    onSelectTemporaryPerson,
    onSubmit,
    importResult,
    importError,
    onImportPeople,
    onCreateTemporaryQr,
    onShowTemporaryQr,
    onRevokeTemporaryQr
  }: {
    personForm: {
      matricula: string;
      nombres: string;
      apellidos: string;
      curp: string;
      tipoPersona: string;
      carreraId: string;
      estado: string;
      notas: string;
      expiresAt: string;
    };
    personTypeRows: PersonTypeRow[];
    careerRows: CareerRow[];
    generatedToken: string;
    generatedTitle: string;
    temporaryGeneratedToken: string;
    temporaryGeneratedTitle: string;
    temporaryQrError: string;
    temporaryQrForm: {
      personId: string;
      operationalDate: string;
      missingCredentialType: string;
      reasonCode: string;
      reasonText: string;
      maxUses: number;
      validUntil: string;
    };
    temporaryQrPersonLabel: string;
    temporaryRows: TemporaryQrRow[];
    temporaryFilters: { q: string; status: string; operationalDate: string };
    temporaryTotal: number;
    temporaryPage: number;
    temporaryPageSize: number;
    onTemporaryPageChange: (next: { page: number; pageSize: number }) => void;
    onFilterTemporaryQr: () => void;
    searchPeople: (query: string) => Promise<Row[]>;
    onSelectTemporaryPerson: (row: Row | null) => void;
    onSubmit: (mode: "register" | "generate") => void | Promise<void>;
    importResult: ImportSummary | null;
    importError: string;
    onImportPeople: (file: File) => void | Promise<void>;
    onCreateTemporaryQr: () => void | Promise<void>;
    onShowTemporaryQr: (row: TemporaryQrRow) => void | Promise<void>;
    onRevokeTemporaryQr: (row: TemporaryQrRow) => void | Promise<void>;
  } = $props();

  let mode = $state<"register" | "generate">("register");
  let section = $state("personal");
  let personalPersonLabel = $state("");
  let personalPending = $state(false);
  let importPending = $state(false);
  let temporaryPending = $state(false);
  let filterPending = $state(false);
  const sections = [
    { value: "personal", label: "Credencial personal" },
    { value: "import", label: "Importar CSV" },
    { value: "temporary", label: "QR temporal diario" },
    { value: "recent", label: "Temporales recientes" }
  ];

  const selectedType = $derived(personTypeRows.find((row) => row.code === personForm.tipoPersona));
  const requiresCareer = $derived(Boolean(selectedType?.requiresCareer));

  function displayPerson(row: Row) {
    return `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim();
  }

  function selectPersonalPerson(row: Row | null) {
    personForm.matricula = row?.matricula ? String(row.matricula) : "";
    personalPersonLabel = row ? displayPerson(row) : "";
  }

  async function submitPersonal() {
    personalPending = true;
    try {
      await onSubmit(mode);
    } finally {
      personalPending = false;
    }
  }

  async function importPeople(file: File) {
    importPending = true;
    try {
      await onImportPeople(file);
    } finally {
      importPending = false;
    }
  }

  async function createTemporaryQr() {
    temporaryPending = true;
    try {
      await onCreateTemporaryQr();
    } finally {
      temporaryPending = false;
    }
  }

  async function filterTemporaryQr() {
    filterPending = true;
    try {
      await onFilterTemporaryQr();
    } finally {
      filterPending = false;
    }
  }
</script>

<section class="workspace-header">
  <div>
    <h2>Generador de Codigo QR</h2>
    <p class="muted">Crea credenciales personales, importa usuarios o emite QR temporales desde tareas separadas.</p>
  </div>
  <SegmentedControl bind:value={section} options={sections} label="Acciones de generacion" />
</section>

{#if section === "personal"}
  <section class="qr-flow">
    <form class="panel form-grid qr-form-panel" aria-busy={personalPending} onsubmit={(event) => { event.preventDefault(); submitPersonal(); }}>
      <div class="section-header">
        <h2>Credencial personal</h2>
        <p>Registro nuevo o matricula existente.</p>
      </div>
      <SegmentedControl
        bind:value={mode}
        label="Modo de generacion"
        options={[
          { value: "register", label: "Registrar y generar" },
          { value: "generate", label: "Solo generar" }
        ]}
      />
      {#if mode === "generate"}
        <EntitySearchSelect
          label="Matricula"
          value={personForm.matricula}
          displayValue={personalPersonLabel || personForm.matricula}
          placeholder="Matricula, nombre o correo"
          search={searchPeople}
          displayResult={displayPerson}
          onSelect={selectPersonalPerson}
          onQueryChange={(query) => {
            personForm.matricula = query;
            personalPersonLabel = "";
          }}
        />
      {:else}
        <label class="form-field">
          <span>Matricula</span>
          <input bind:value={personForm.matricula} placeholder="Matricula" required />
        </label>
      {/if}
      {#if mode === "register"}
        <label class="form-field">
          <span>Nombres</span>
          <input bind:value={personForm.nombres} placeholder="Nombres" />
        </label>
        <label class="form-field">
          <span>Apellidos</span>
          <input bind:value={personForm.apellidos} placeholder="Apellidos" />
        </label>
        <label class="form-field">
          <span>CURP</span>
          <input bind:value={personForm.curp} placeholder="CURP" oninput={() => (personForm.curp = personForm.curp.toUpperCase())} />
        </label>
        <label class="form-field">
          <span>Tipo de persona</span>
          <select bind:value={personForm.tipoPersona}>
            {#each personTypeRows as type}
              <option value={String(type.code)}>{type.label}</option>
            {/each}
          </select>
        </label>
        {#if requiresCareer}
          <label class="form-field">
            <span>Carrera</span>
            <select bind:value={personForm.carreraId} required>
              <option value="">Seleccione carrera</option>
              {#each careerRows as career}
                <option value={String(career.id)}>{career.nombre}</option>
              {/each}
            </select>
          </label>
        {/if}
      {/if}
      <label class="form-field">
        <span>Expira</span>
        <input bind:value={personForm.expiresAt} type="datetime-local" />
      </label>
      {#if mode === "register"}
        <label class="form-field">
          <span>Notas</span>
          <textarea bind:value={personForm.notas} placeholder="Notas"></textarea>
        </label>
      {/if}
      <LoadingButton type="submit" loading={personalPending} loadingLabel="Generando...">{mode === "register" ? "Registrar y Generar" : "Solo Generar"}</LoadingButton>
    </form>
    <section class="panel qr-side-panel">
      <QrPreview token={generatedToken} title={generatedTitle || "QR"} subtitle="El token visible se muestra solo en esta respuesta" autoOpen />
    </section>
  </section>
{/if}

{#if section === "import"}
  <section class="panel form-grid qr-form-panel" aria-busy={importPending}>
    <div class="section-header">
      <h2>Importar usuarios y QR</h2>
      <p>CSV: matricula,nombres,apellidos,curp,tipoPersona,carreraId,estado,notas,expiresAt</p>
    </div>
    <label class="form-field">
      <span>Archivo CSV</span>
      <input
        type="file"
        accept=".csv,text/csv"
        onchange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) importPeople(file);
          event.currentTarget.value = "";
        }}
      />
    </label>
    {#if importPending}
      <div class="import-loading">
        <span class="skeleton-line"></span>
        <span class="skeleton-line short"></span>
      </div>
    {/if}
    {#if importError}
      <p class="error">{importError}</p>
    {/if}
    {#if importResult}
      <div class="import-summary">
        <span>Creados: {importResult.created}</span>
        <span>Actualizados: {importResult.updated}</span>
        <span>QR emitidos: {importResult.issuedQr}</span>
        <span>Omitidos: {importResult.skipped}</span>
      </div>
      {#if importResult.errors.length}
        <DataTable
          rows={importResult.errors}
          columns={[
            { key: "row", label: "Fila" },
            { key: "code", label: "Codigo", kind: "reason" },
            { key: "message", label: "Error" }
          ]}
        />
      {/if}
    {/if}
  </section>
{/if}

{#if section === "temporary"}
  <section class="qr-flow">
  <form class="panel form-grid qr-form-panel" aria-busy={temporaryPending} onsubmit={(event) => { event.preventDefault(); createTemporaryQr(); }}>
    <h2>QR temporal diario</h2>
    <EntitySearchSelect
      label="Persona"
      value={temporaryQrForm.personId}
      displayValue={temporaryQrPersonLabel}
      placeholder="Matricula, nombre o correo"
      search={searchPeople}
      displayResult={displayPerson}
      onSelect={onSelectTemporaryPerson}
    />
    <label class="form-field">
      <span>Fecha operativa</span>
      <input bind:value={temporaryQrForm.operationalDate} type="date" required />
    </label>
    <label class="form-field">
      <span>Credencial faltante</span>
      <select bind:value={temporaryQrForm.missingCredentialType}>
        <option value="personal_qr">Credencial QR personal</option>
        <option value="physical_card">Credencial fisica</option>
        <option value="vehicle_qr">QR vehicular</option>
      </select>
    </label>
    <label class="form-field">
      <span>Motivo</span>
      <select bind:value={temporaryQrForm.reasonCode}>
        <option value="credential_unavailable">Credencial no disponible</option>
        <option value="credential_lost">Credencial extraviada</option>
        <option value="credential_damaged">Credencial danada</option>
        <option value="admin_exception">Excepcion administrativa</option>
      </select>
    </label>
    <label class="form-field">
      <span>Usos maximos</span>
      <input bind:value={temporaryQrForm.maxUses} type="number" min="1" max="10" />
    </label>
    <label class="form-field">
      <span>Valido hasta</span>
      <input bind:value={temporaryQrForm.validUntil} type="datetime-local" />
    </label>
    <label class="form-field">
      <span>Detalle</span>
      <textarea bind:value={temporaryQrForm.reasonText} placeholder="Detalle"></textarea>
    </label>
    <LoadingButton type="submit" loading={temporaryPending} loadingLabel="Generando...">Generar QR temporal</LoadingButton>
  </form>
  <section class="panel qr-side-panel">
    <QrPreview
      token={temporaryGeneratedToken}
      title={temporaryGeneratedTitle || "QR temporal diario"}
      subtitle="QR temporal listo para mostrar, descargar o compartir."
      showToken={false}
      autoOpen
    />
  </section>
  </section>
{/if}

{#if section === "recent"}
<section class="panel">
  <h2>Temporales recientes</h2>
  <div class="toolbar">
    <label class="form-field">
      <span>Busqueda</span>
      <input bind:value={temporaryFilters.q} placeholder="Buscar persona o motivo" />
    </label>
    <label class="form-field">
      <span>Fecha operativa</span>
      <input bind:value={temporaryFilters.operationalDate} type="date" />
    </label>
    <label class="form-field">
      <span>Estado</span>
      <select bind:value={temporaryFilters.status}>
        <option value="">Todos</option>
        <option value="active">Activo</option>
        <option value="revoked">Revocado</option>
        <option value="expired">Expirado</option>
        <option value="rotated">Rotado</option>
      </select>
    </label>
    <LoadingButton loading={filterPending} loadingLabel="Filtrando..." onClick={filterTemporaryQr}>Filtrar</LoadingButton>
  </div>
  {#if temporaryQrError}
    <p class="error">{temporaryQrError}</p>
  {/if}
  {#if temporaryGeneratedToken}
    <QrPreview
      token={temporaryGeneratedToken}
      title={temporaryGeneratedTitle || "QR temporal diario"}
      subtitle="QR generado desde la fila seleccionada"
      showToken={false}
      autoOpen
    />
  {/if}
  <DataTable
    rows={temporaryRows}
    columns={[
      { key: "matricula", label: "Matricula" },
      { key: "personName", label: "Persona" },
      { key: "operationalDate", label: "Fecha" },
      { key: "missingCredentialType", label: "Tipo", kind: "credential" },
      { key: "reasonCode", label: "Motivo", kind: "reason" },
      { key: "status", label: "Estado", kind: "status" },
      { key: "validUntil", label: "Expira", kind: "date" }
    ]}
    actions={[
      { label: "QR dinamico", icon: "qr", onClick: (row) => onShowTemporaryQr(row as TemporaryQrRow) },
      { label: "Revocar", icon: "revoke", onClick: (row) => onRevokeTemporaryQr(row as TemporaryQrRow), tone: "danger", confirm: "Esta accion revoca el QR temporal seleccionado." }
    ]}
  />
  <PaginationControls
    page={temporaryPage}
    pageSize={temporaryPageSize}
    total={temporaryTotal}
    onChange={onTemporaryPageChange}
  />
</section>
{/if}
