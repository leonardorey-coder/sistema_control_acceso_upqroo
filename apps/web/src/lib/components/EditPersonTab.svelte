<script lang="ts">
  type Row = Record<string, unknown>;

  let {
    editMatricula = $bindable(),
    editPerson,
    onSearch,
    onSave
  }: {
    editMatricula: string;
    editPerson: Row | null;
    onSearch: () => void;
    onSave: () => void;
  } = $props();
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
        <option value="estudiante">Estudiante</option>
        <option value="aspirante">Aspirante</option>
        <option value="docente">Docente</option>
        <option value="administrativo">Administrativo</option>
        <option value="invitado">Invitado</option>
        <option value="otro">Otro</option>
      </select>
      <select bind:value={editPerson.estado}>
        <option value="activo">Activo</option>
        <option value="inactivo">Inactivo</option>
        <option value="suspendido">Suspendido</option>
        <option value="egresado">Egresado</option>
        <option value="baja">Baja</option>
      </select>
      <textarea bind:value={editPerson.notas} placeholder="Notas"></textarea>
      <button>Guardar cambios</button>
    </form>
  {/if}
</section>
