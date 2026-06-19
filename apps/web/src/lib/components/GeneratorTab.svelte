<script lang="ts">
  import QrPreview from "./QrPreview.svelte";

  let {
    personForm,
    generatedToken,
    generatedTitle,
    onSubmit
  }: {
    personForm: {
      matricula: string;
      nombres: string;
      apellidos: string;
      curp: string;
      tipoPersona: string;
      estado: string;
      notas: string;
      expiresAt: string;
    };
    generatedToken: string;
    generatedTitle: string;
    onSubmit: () => void;
  } = $props();
</script>

<section class="grid two">
  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <div class="section-header">
      <h2>Generador de Codigo QR</h2>
      <p>Cree credenciales personales con registro nuevo o matricula existente</p>
    </div>
    <input bind:value={personForm.matricula} placeholder="Matricula" required />
    <input bind:value={personForm.nombres} placeholder="Nombres" />
    <input bind:value={personForm.apellidos} placeholder="Apellidos" />
    <input bind:value={personForm.curp} placeholder="CURP" oninput={() => (personForm.curp = personForm.curp.toUpperCase())} />
    <select bind:value={personForm.tipoPersona}>
      <option value="estudiante">Estudiante</option>
      <option value="aspirante">Aspirante</option>
      <option value="docente">Docente</option>
      <option value="administrativo">Administrativo</option>
      <option value="invitado">Invitado</option>
      <option value="otro">Otro</option>
    </select>
    <input bind:value={personForm.expiresAt} type="datetime-local" />
    <textarea bind:value={personForm.notas} placeholder="Notas"></textarea>
    <button>Registrar y Generar</button>
  </form>
  <section class="panel">
    <QrPreview token={generatedToken} title={generatedTitle || "QR"} subtitle="El token visible se muestra solo en esta respuesta" />
  </section>
</section>
