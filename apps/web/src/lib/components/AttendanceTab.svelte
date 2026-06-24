<script lang="ts">
  import type { AttendanceRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import EntitySearchSelect from "./EntitySearchSelect.svelte";
  import PaginationControls from "./PaginationControls.svelte";

  type Row = Record<string, unknown>;

  let {
    rows,
    total,
    filters,
    page,
    pageSize,
    careerRows,
    subjectRows,
    subjectTotal,
    subjectPage,
    subjectPageSize,
    subjectFilters,
    scheduleRows,
    scheduleTotal,
    schedulePage,
    schedulePageSize,
    scheduleFilters,
    subjectForm,
    scheduleForm,
    schedulePersonLabel,
    searchPeople,
    onSelectSchedulePerson,
    onFilter,
    onPageChange,
    onFilterSubjects,
    onSubjectPageChange,
    onFilterSchedules,
    onSchedulePageChange,
    onCreateSubject,
    onCreateSchedule,
    onAdjustAttendance
  }: {
    rows: Array<AttendanceRowPayload & Row>;
    total: number;
    filters: { q: string; date: string; page: number; pageSize: number; subject: string; status: string; careerId: string };
    page: number;
    pageSize: number;
    careerRows: Row[];
    subjectRows: Row[];
    subjectTotal: number;
    subjectPage: number;
    subjectPageSize: number;
    subjectFilters: { q: string; active: string };
    scheduleRows: Row[];
    scheduleTotal: number;
    schedulePage: number;
    schedulePageSize: number;
    scheduleFilters: { q: string; subjectId: string; weekday: string; active: string };
    subjectForm: { clave: string; nombre: string };
    scheduleForm: { personId: string; subjectId: string; weekday: number; horaInicio: string; horaFin: string; aula: string; validFrom: string; validUntil: string };
    schedulePersonLabel: string;
    searchPeople: (query: string) => Promise<Row[]>;
    onSelectSchedulePerson: (row: Row | null) => void;
    onFilter: () => void;
    onPageChange: (next: { page: number; pageSize: number }) => void;
    onFilterSubjects: () => void;
    onSubjectPageChange: (next: { page: number; pageSize: number }) => void;
    onFilterSchedules: () => void;
    onSchedulePageChange: (next: { page: number; pageSize: number }) => void;
    onCreateSubject: () => void;
    onCreateSchedule: () => void;
    onAdjustAttendance: (row: AttendanceRowPayload & Row, estado: "confirmed" | "partial" | "unverified") => void;
  } = $props();

  function asAttendanceRow(row: Row) {
    return row as AttendanceRowPayload & Row;
  }

  function displayPerson(row: Row) {
    return `${row.matricula ?? ""} - ${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim();
  }
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
  ]}
  actions={[
    { label: "Confirmar", onClick: (row) => onAdjustAttendance(asAttendanceRow(row), "confirmed") },
    { label: "Parcial", onClick: (row) => onAdjustAttendance(asAttendanceRow(row), "partial"), tone: "ghost" },
    { label: "No verificada", onClick: (row) => onAdjustAttendance(asAttendanceRow(row), "unverified"), tone: "ghost" }
  ]} />
  <PaginationControls {page} {pageSize} {total} onChange={onPageChange} />
</section>

<section class="grid two">
  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onCreateSubject(); }}>
    <h2>Materias</h2>
    <input bind:value={subjectForm.clave} placeholder="Clave" required />
    <input bind:value={subjectForm.nombre} placeholder="Nombre de materia" required />
    <button>Guardar materia</button>
    <div class="toolbar compact">
      <input bind:value={subjectFilters.q} placeholder="Filtrar materia" />
      <select bind:value={subjectFilters.active}>
        <option value="">Todas</option>
        <option value="true">Activas</option>
        <option value="false">Inactivas</option>
      </select>
      <button type="button" onclick={onFilterSubjects}>Filtrar</button>
    </div>
    <DataTable rows={subjectRows} columns={[
      { key: "clave", label: "Clave" },
      { key: "nombre", label: "Materia" },
      { key: "active", label: "Activa" }
    ]} />
    <PaginationControls page={subjectPage} pageSize={subjectPageSize} total={subjectTotal} onChange={onSubjectPageChange} />
  </form>

  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onCreateSchedule(); }}>
    <h2>Horarios</h2>
    <EntitySearchSelect
      label="Persona"
      value={scheduleForm.personId}
      displayValue={schedulePersonLabel}
      placeholder="Buscar por matricula o nombre"
      search={searchPeople}
      displayResult={displayPerson}
      onSelect={onSelectSchedulePerson}
    />
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
  <div class="tabla-header">
    <h2>Horarios registrados</h2>
    <span>{scheduleTotal} horarios</span>
  </div>
  <div class="toolbar">
    <input bind:value={scheduleFilters.q} placeholder="Buscar alumno, materia o aula" />
    <select bind:value={scheduleFilters.subjectId}>
      <option value="">Todas las materias</option>
      {#each subjectRows as subject}
        <option value={String(subject.id)}>{subject.nombre}</option>
      {/each}
    </select>
    <select bind:value={scheduleFilters.weekday}>
      <option value="">Todos los dias</option>
      <option value="1">Lunes</option>
      <option value="2">Martes</option>
      <option value="3">Miercoles</option>
      <option value="4">Jueves</option>
      <option value="5">Viernes</option>
      <option value="6">Sabado</option>
      <option value="0">Domingo</option>
    </select>
    <select bind:value={scheduleFilters.active}>
      <option value="">Todos</option>
      <option value="true">Activos</option>
      <option value="false">Inactivos</option>
    </select>
    <button onclick={onFilterSchedules}>Filtrar</button>
  </div>
  <DataTable rows={scheduleRows} columns={[
    { key: "matricula", label: "Matricula" },
    { key: "personName", label: "Persona", kind: "name" },
    { key: "subjectName", label: "Materia" },
    { key: "weekday", label: "Dia" },
    { key: "horaInicio", label: "Inicio" },
    { key: "horaFin", label: "Fin" },
    { key: "aula", label: "Aula" }
  ]} />
  <PaginationControls page={schedulePage} pageSize={schedulePageSize} total={scheduleTotal} onChange={onSchedulePageChange} />
</section>
