<script lang="ts">
  import type { CareerRowPayload, PersonCredentialRowPayload, PersonRowPayload, PersonTypeRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
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
    onPhoto
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
    onSearch: () => void;
    onSave: () => void;
    onDisable: () => void;
    onEnable: () => void;
    onRotateQr: () => void;
    onRevokeQr: () => void;
    onCredentialPageChange: (next: { page: number; pageSize: number }) => void;
    onPhoto: (file: File) => void;
  } = $props();

  const selectedType = $derived(personTypeRows.find((row) => row.code === editPerson?.tipoPersona));
  const requiresCareer = $derived(Boolean(selectedType?.requiresCareer));
</script>

<section class="grid two">
  <form class="panel" onsubmit={(event) => { event.preventDefault(); onSearch(); }}>
    <h2>Editar persona</h2>
    <input bind:value={editMatricula} placeholder="Buscar por matricula" />
    <button>Buscar</button>
  </form>
  {#if editPerson}
    <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onSave(); }}>
      <input bind:value={editPerson.matricula} placeholder="Matricula" />
      <input bind:value={editPerson.nombres} placeholder="Nombres" />
      <input bind:value={editPerson.apellidos} placeholder="Apellidos" />
      <select bind:value={editPerson.tipoPersona}>
        {#each personTypeRows as type}
          <option value={String(type.code)}>{type.label}</option>
        {/each}
      </select>
      {#if requiresCareer}
        <select bind:value={editPerson.carreraId}>
          <option value="">Seleccione carrera</option>
          {#each careerRows as career}
            <option value={String(career.id)}>{career.nombre}</option>
          {/each}
        </select>
      {/if}
      <select bind:value={editPerson.estado}>
        <option value="activo">Activo</option>
        <option value="inactivo">Inactivo</option>
        <option value="suspendido">Suspendido</option>
        <option value="egresado">Egresado</option>
        <option value="baja">Baja</option>
      </select>
      <textarea bind:value={editPerson.notas} placeholder="Notas"></textarea>
      <input
        type="file"
        accept="image/*"
        onchange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onPhoto(file);
        }}
      />
      <button>Guardar cambios</button>
      <div class="button-row">
        <button type="button" class="ghost" onclick={onEnable}>Activar</button>
        <button type="button" class="ghost" onclick={onDisable}>Desactivar</button>
      </div>
    </form>
  {/if}
</section>

{#if editPerson}
  <section class="grid two">
    <section class="panel">
      <h2>Credenciales QR</h2>
      <DataTable
        rows={credentialRows}
        columns={[
          { key: "status", label: "Estado", kind: "status" },
          { key: "tokenVersion", label: "Version" },
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
        <button onclick={onRotateQr}>Rotar QR</button>
        <button class="ghost" onclick={onRevokeQr}>Revocar activos</button>
      </div>
    </section>
    <section class="panel">
      <QrPreview token={generatedToken} title={generatedTitle || "QR personal"} subtitle="El token solo se muestra al generar o rotar." />
    </section>
  </section>
{/if}
