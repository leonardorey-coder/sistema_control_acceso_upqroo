<script lang="ts">
  import DataTable from "./DataTable.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    total,
    filters,
    careerRows,
    subjectRows,
    scheduleRows,
    subjectForm,
    scheduleForm,
    onFilter,
    onCreateSubject,
    onCreateSchedule
  }: {
    rows: Row[];
    total: number;
    filters: { q: string; date: string; page: number; pageSize: number; subject: string; status: string; careerId: string };
    careerRows: Row[];
    subjectRows: Row[];
    scheduleRows: Row[];
    subjectForm: { clave: string; nombre: string };
    scheduleForm: { personId: string; subjectId: string; weekday: number; horaInicio: string; horaFin: string; aula: string; validFrom: string; validUntil: string };
    onFilter: () => void;
    onCreateSubject: () => void;
    onCreateSchedule: () => void;
  } = $props();
</script>

<section class="panel">
  <div class="tabla-header">
    <h2>Asistencias del dia</h2>
    <span>{total} asistencias</span>
  </div>
  <div class="toolbar">
    <input bind:value={filters.q} placeholder="Buscar alumno o materia" />
    <input bind:value={filters.date} type="date" />
    <input bind:value={filters.subject} placeholder="Materia" />
    <select bind:value={filters.status}>
      <option value="">Todos los estados</option>
      <option value="in_progress">En curso</option>
      <option value="confirmed">Confirmada</option>
      <option value="partial">Parcial</option>
      <option value="unverified">Sin verificar</option>
      <option value="assumed">Asumida</option>
    </select>
    <select bind:value={filters.careerId}>
      <option value="">Todas las carreras</option>
      {#each careerRows as career}
        <option value={String(career.id)}>{career.nombre}</option>
      {/each}
    </select>
    <button onclick={onFilter}>Filtrar</button>
  </div>
  <DataTable rows={rows} columns={[
    { key: "matricula", label: "Matricula" },
    { key: "nombres", label: "Estudiante", kind: "name" },
    { key: "subjectName", label: "Materia" },
    { key: "aula", label: "Aula" },
    { key: "horaInicio", label: "Inicio" },
    { key: "horaFin", label: "Fin" },
    { key: "minutosAsistidos", label: "Min. asistidos" },
    { key: "minutosTotales", label: "Min. totales" },
    { key: "porcentaje", label: "%" },
    { key: "carrera", label: "Carrera" },
    { key: "estado", label: "Estado", kind: "status" }
  ]} />
</section>

<section class="grid two">
  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onCreateSubject(); }}>
    <h2>Materias</h2>
    <input bind:value={subjectForm.clave} placeholder="Clave" required />
    <input bind:value={subjectForm.nombre} placeholder="Nombre de materia" required />
    <button>Guardar materia</button>
    <DataTable rows={subjectRows} columns={[
      { key: "clave", label: "Clave" },
      { key: "nombre", label: "Materia" },
      { key: "active", label: "Activa" }
    ]} />
  </form>

  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onCreateSchedule(); }}>
    <h2>Horarios</h2>
    <input bind:value={scheduleForm.personId} placeholder="ID persona" required />
    <select bind:value={scheduleForm.subjectId} required>
      <option value="">Seleccione materia</option>
      {#each subjectRows as subject}
        <option value={String(subject.id)}>{subject.nombre}</option>
      {/each}
    </select>
    <select bind:value={scheduleForm.weekday}>
      <option value={1}>Lunes</option>
      <option value={2}>Martes</option>
      <option value={3}>Miercoles</option>
      <option value={4}>Jueves</option>
      <option value={5}>Viernes</option>
      <option value={6}>Sabado</option>
      <option value={0}>Domingo</option>
    </select>
    <input bind:value={scheduleForm.horaInicio} type="time" />
    <input bind:value={scheduleForm.horaFin} type="time" />
    <input bind:value={scheduleForm.aula} placeholder="Aula" />
    <input bind:value={scheduleForm.validFrom} type="date" />
    <input bind:value={scheduleForm.validUntil} type="date" />
    <button>Guardar horario</button>
  </form>
</section>

<section class="panel">
  <h2>Horarios registrados</h2>
  <DataTable rows={scheduleRows} columns={[
    { key: "personId", label: "Persona" },
    { key: "subjectName", label: "Materia" },
    { key: "weekday", label: "Dia" },
    { key: "horaInicio", label: "Inicio" },
    { key: "horaFin", label: "Fin" },
    { key: "aula", label: "Aula" }
  ]} />
</section>
