<script lang="ts">
  import DataTable from "./DataTable.svelte";
  import QrPreview from "./QrPreview.svelte";

  type Row = Record<string, unknown>;

  let {
    personForm,
    personTypeRows,
    careerRows,
    generatedToken,
    generatedTitle,
    temporaryQrForm,
    temporaryRows,
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
    personTypeRows: Row[];
    careerRows: Row[];
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
    temporaryRows: Row[];
    onSubmit: () => void;
    onCreateTemporaryQr: () => void;
    onShowTemporaryQr: (row: Row) => void;
    onRevokeTemporaryQr: (row: Row) => void;
  } = $props();

  let mode = $state<"register" | "generate">("register");

  const selectedType = $derived(personTypeRows.find((row) => row.code === personForm.tipoPersona));
  const requiresCareer = $derived(Boolean(selectedType?.requiresCareer));
</script>

<section class="grid two">
  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onSubmit(); }}>
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
    <input bind:value={temporaryQrForm.personId} placeholder="ID persona" required />
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
    <DataTable
      rows={temporaryRows}
      columns={[
        { key: "operationalDate", label: "Fecha" },
        { key: "missingCredentialType", label: "Tipo" },
        { key: "reasonCode", label: "Motivo" },
        { key: "status", label: "Estado", kind: "status" },
        { key: "validUntil", label: "Expira", kind: "date" }
      ]}
      actions={[
        { label: "QR dinamico", onClick: onShowTemporaryQr },
        { label: "Revocar", onClick: onRevokeTemporaryQr, tone: "ghost" }
      ]}
    />
  </section>
</section>
