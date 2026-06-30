<script lang="ts">
  import type { AttendanceRowPayload } from "@control-acceso/shared";
  import DataTable from "./DataTable.svelte";
  import PaginationControls from "./PaginationControls.svelte";

  type Row = Record<string, unknown>;

  type ImportSummary = {
    created: number;
    updated: number;
    issuedQr: number;
    skipped: number;
    errors: Array<{ row: number; code: string; message: string }>;
  };

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
    importResult,
    importError,
    onFilter,
    onPageChange,
    onFilterSubjects,
    onSubjectPageChange,
    onFilterSchedules,
    onSchedulePageChange,
    onImportSchedules,
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
    importResult: ImportSummary | null;
    importError: string;
    onFilter: () => void;
    onPageChange: (next: { page: number; pageSize: number }) => void;
    onFilterSubjects: () => void;
    onSubjectPageChange: (next: { page: number; pageSize: number }) => void;
    onFilterSchedules: () => void;
    onSchedulePageChange: (next: { page: number; pageSize: number }) => void;
    onImportSchedules: (file: File) => void;
    onAdjustAttendance: (row: AttendanceRowPayload & Row, estado: "confirmed" | "partial" | "unverified") => void;
  } = $props();

  function asAttendanceRow(row: Row) {
    return row as AttendanceRowPayload & Row;
  }

</script>

<section class="panel">
  <div class="tabla-header">
    <h2>Asistencias del dia</h2>
    <span>{total} asistencias</span>
  </div>
  <div class="toolbar">
    <label class="form-field">
      <span>Busqueda</span>
      <input bind:value={filters.q} placeholder="Buscar alumno o materia" />
    </label>
    <label class="form-field">
      <span>Fecha</span>
      <input bind:value={filters.date} type="date" />
    </label>
    <label class="form-field">
      <span>Materia</span>
      <input bind:value={filters.subject} placeholder="Materia" />
    </label>
    <label class="form-field">
      <span>Estado</span>
      <select bind:value={filters.status}>
        <option value="">Todos los estados</option>
        <option value="in_progress">En curso</option>
        <option value="confirmed">Confirmada</option>
        <option value="partial">Parcial</option>
        <option value="unverified">Sin verificar</option>
        <option value="assumed">Asumida</option>
      </select>
    </label>
    <label class="form-field">
      <span>Carrera</span>
      <select bind:value={filters.careerId}>
        <option value="">Todas las carreras</option>
        {#each careerRows as career}
          <option value={String(career.id)}>{career.nombre}</option>
        {/each}
      </select>
    </label>
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

<section class="panel form-grid">
  <div class="section-header">
    <h2>Importar horarios</h2>
    <p>CSV: matricula,subjectClave,subjectName,weekday,horaInicio,horaFin,aula,validFrom,validUntil</p>
  </div>
  <label class="form-field">
    <span>Archivo CSV</span>
    <input
      type="file"
      accept=".csv,text/csv"
      onchange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) onImportSchedules(file);
        event.currentTarget.value = "";
      }}
    />
  </label>
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
      <DataTable rows={importResult.errors} columns={[
        { key: "row", label: "Fila" },
        { key: "code", label: "Codigo" },
        { key: "message", label: "Error" }
      ]} />
    {/if}
  {/if}
</section>

<section class="panel">
  <div class="tabla-header">
    <h2>Materias registradas</h2>
    <span>{subjectTotal} materias</span>
  </div>
  <div class="toolbar">
    <label class="form-field">
      <span>Materia</span>
      <input bind:value={subjectFilters.q} placeholder="Filtrar materia" />
    </label>
    <label class="form-field">
      <span>Estado</span>
      <select bind:value={subjectFilters.active}>
        <option value="">Todas</option>
        <option value="true">Activas</option>
        <option value="false">Inactivas</option>
      </select>
    </label>
    <button type="button" onclick={onFilterSubjects}>Filtrar</button>
  </div>
  <DataTable rows={subjectRows} columns={[
    { key: "clave", label: "Clave" },
    { key: "nombre", label: "Materia" },
    { key: "active", label: "Activa" }
  ]} />
  <PaginationControls page={subjectPage} pageSize={subjectPageSize} total={subjectTotal} onChange={onSubjectPageChange} />
</section>

<section class="panel">
  <div class="tabla-header">
    <h2>Horarios registrados</h2>
    <span>{scheduleTotal} horarios</span>
  </div>
  <div class="toolbar">
    <label class="form-field">
      <span>Busqueda</span>
      <input bind:value={scheduleFilters.q} placeholder="Buscar alumno, materia o aula" />
    </label>
    <label class="form-field">
      <span>Materia</span>
      <select bind:value={scheduleFilters.subjectId}>
        <option value="">Todas las materias</option>
        {#each subjectRows as subject}
          <option value={String(subject.id)}>{subject.nombre}</option>
        {/each}
      </select>
    </label>
    <label class="form-field">
      <span>Dia</span>
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
    </label>
    <label class="form-field">
      <span>Estado</span>
      <select bind:value={scheduleFilters.active}>
        <option value="">Todos</option>
        <option value="true">Activos</option>
        <option value="false">Inactivos</option>
      </select>
    </label>
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
