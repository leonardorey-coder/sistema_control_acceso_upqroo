<script lang="ts">
  import type { CareerRowPayload, PersonTypeRowPayload, TemporaryDailyQrRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import EntitySearchSelect from "./EntitySearchSelect.svelte";
  import PaginationControls from "./PaginationControls.svelte";
  import QrPreview from "./QrPreview.svelte";

  type Row = Record<string, unknown>;
  type PersonTypeRow = PersonTypeRowPayload & Row;
  type CareerRow = CareerRowPayload & Row;
  type TemporaryQrRow = TemporaryDailyQrRowPayload & Row;

  let {
    personForm,
    personTypeRows,
    careerRows,
    generatedToken,
    generatedTitle,
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
    onSubmit: (mode: "register" | "generate") => void;
    onCreateTemporaryQr: () => void;
    onShowTemporaryQr: (row: TemporaryQrRow) => void;
    onRevokeTemporaryQr: (row: TemporaryQrRow) => void;
  } = $props();

  let mode = $state<"register" | "generate">("register");

  const selectedType = $derived(personTypeRows.find((row) => row.code === personForm.tipoPersona));
  const requiresCareer = $derived(Boolean(selectedType?.requiresCareer));

  function displayPerson(row: Row) {
    return `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim();
  }
</script>

<section class="grid two">
  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onSubmit(mode); }}>
    <div class="section-header">
      <h2>Generador de Codigo QR</h2>
      <p>Cree credenciales personales con registro nuevo o matricula existente</p>
    </div>
    <div class="mode-switch" role="tablist" aria-label="Modo de generacion">
      <button type="button" class:active={mode === "register"} onclick={() => (mode = "register")}>
        Registrar y Generar
      </button>
      <button type="button" class:active={mode === "generate"} onclick={() => (mode = "generate")}>
        Solo Generar
      </button>
    </div>
    <input bind:value={personForm.matricula} placeholder="Matricula" required />
    {#if mode === "register"}
      <input bind:value={personForm.nombres} placeholder="Nombres" />
      <input bind:value={personForm.apellidos} placeholder="Apellidos" />
      <input bind:value={personForm.curp} placeholder="CURP" oninput={() => (personForm.curp = personForm.curp.toUpperCase())} />
      <select bind:value={personForm.tipoPersona}>
        {#each personTypeRows as type}
          <option value={String(type.code)}>{type.label}</option>
        {/each}
      </select>
      {#if requiresCareer}
        <select bind:value={personForm.carreraId} required>
          <option value="">Seleccione carrera</option>
          {#each careerRows as career}
            <option value={String(career.id)}>{career.nombre}</option>
          {/each}
        </select>
      {/if}
    {/if}
    <input bind:value={personForm.expiresAt} type="datetime-local" />
    {#if mode === "register"}
      <textarea bind:value={personForm.notas} placeholder="Notas"></textarea>
    {/if}
    <button>{mode === "register" ? "Registrar y Generar" : "Solo Generar"}</button>
  </form>
  <section class="panel">
    <QrPreview token={generatedToken} title={generatedTitle || "QR"} subtitle="El token visible se muestra solo en esta respuesta" />
  </section>
</section>

<section class="grid two">
  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onCreateTemporaryQr(); }}>
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
    <input bind:value={temporaryQrForm.operationalDate} type="date" required />
    <select bind:value={temporaryQrForm.missingCredentialType}>
      <option value="personal_qr">Credencial QR personal</option>
      <option value="physical_card">Credencial fisica</option>
      <option value="vehicle_qr">QR vehicular</option>
    </select>
    <select bind:value={temporaryQrForm.reasonCode}>
      <option value="credential_unavailable">Credencial no disponible</option>
      <option value="credential_lost">Credencial extraviada</option>
      <option value="credential_damaged">Credencial dañada</option>
      <option value="admin_exception">Excepcion administrativa</option>
    </select>
    <input bind:value={temporaryQrForm.maxUses} type="number" min="1" max="10" />
    <input bind:value={temporaryQrForm.validUntil} type="datetime-local" />
    <textarea bind:value={temporaryQrForm.reasonText} placeholder="Detalle"></textarea>
    <button>Generar QR temporal</button>
  </form>
  <section class="panel">
    <h2>Temporales recientes</h2>
    <div class="toolbar">
      <input bind:value={temporaryFilters.q} placeholder="Buscar persona o motivo" />
      <input bind:value={temporaryFilters.operationalDate} type="date" />
      <select bind:value={temporaryFilters.status}>
        <option value="">Todos</option>
        <option value="active">Activo</option>
        <option value="revoked">Revocado</option>
        <option value="expired">Expirado</option>
        <option value="rotated">Rotado</option>
      </select>
      <button onclick={onFilterTemporaryQr}>Filtrar</button>
    </div>
    <DataTable
      rows={temporaryRows}
      columns={[
        { key: "matricula", label: "Matricula" },
        { key: "personName", label: "Persona" },
        { key: "operationalDate", label: "Fecha" },
        { key: "missingCredentialType", label: "Tipo" },
        { key: "reasonCode", label: "Motivo" },
        { key: "status", label: "Estado", kind: "status" },
        { key: "validUntil", label: "Expira", kind: "date" }
      ]}
      actions={[
        { label: "QR dinamico", onClick: (row) => onShowTemporaryQr(row as TemporaryQrRow) },
        { label: "Revocar", onClick: (row) => onRevokeTemporaryQr(row as TemporaryQrRow), tone: "ghost" }
      ]}
    />
    <PaginationControls
      page={temporaryPage}
      pageSize={temporaryPageSize}
      total={temporaryTotal}
      onChange={onTemporaryPageChange}
    />
  </section>
</section>
