import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { asistenciasPotenciales, carreras, personas, schedules, subjects } from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

export type AttendanceFilters = {
  q?: string;
  subject?: string;
  status?: "in_progress" | "confirmed" | "partial" | "unverified" | "assumed";
  careerId?: string;
  date: string;
};

export type SubjectFilters = {
  q?: string;
  active?: boolean;
};

export type ScheduleFilters = {
  q?: string;
  personId?: string;
  subjectId?: string;
  weekday?: number;
  active?: boolean;
};

function buildAttendanceWhere(filters: AttendanceFilters) {
  const where: SQL[] = [
    eq(asistenciasPotenciales.fechaClase, filters.date)
  ];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(
      ilike(personas.matricula, q),
      ilike(personas.nombres, q),
      ilike(personas.apellidos, q),
      ilike(subjects.nombre, q),
      ilike(subjects.clave, q)
    )!);
  }

  if (filters.subject) {
    const subject = `%${filters.subject}%`;
    where.push(or(ilike(subjects.nombre, subject), ilike(subjects.clave, subject))!);
  }

  if (filters.status) {
    where.push(eq(asistenciasPotenciales.estado, filters.status));
  }

  if (filters.careerId) {
    where.push(eq(personas.carreraId, filters.careerId));
  }

  return and(...where);
}

export async function listAttendanceToday(filters: AttendanceFilters, pagination: Pagination) {
  const where = buildAttendanceWhere(filters);

  const [rows, totalRows] = await Promise.all([
    db.select({
      id: asistenciasPotenciales.id,
      matricula: personas.matricula,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      carrera: carreras.nombre,
      subjectClave: subjects.clave,
      subjectName: subjects.nombre,
      aula: asistenciasPotenciales.aula,
      fechaClase: asistenciasPotenciales.fechaClase,
      horaInicio: asistenciasPotenciales.horaInicio,
      horaFin: asistenciasPotenciales.horaFin,
      porcentaje: asistenciasPotenciales.porcentaje,
      minutosAsistidos: asistenciasPotenciales.minutosAsistidos,
      minutosTotales: asistenciasPotenciales.minutosTotales,
      estado: asistenciasPotenciales.estado,
      confirmedAt: asistenciasPotenciales.confirmedAt
    })
      .from(asistenciasPotenciales)
      .innerJoin(personas, eq(asistenciasPotenciales.personId, personas.id))
      .leftJoin(carreras, eq(personas.carreraId, carreras.id))
      .leftJoin(subjects, eq(asistenciasPotenciales.subjectId, subjects.id))
      .where(where)
      .orderBy(asc(asistenciasPotenciales.horaInicio), asc(personas.apellidos), asc(personas.nombres))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() })
      .from(asistenciasPotenciales)
      .innerJoin(personas, eq(asistenciasPotenciales.personId, personas.id))
      .leftJoin(subjects, eq(asistenciasPotenciales.subjectId, subjects.id))
      .where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export function listAttendanceByPerson(personId: string) {
  return db.select()
    .from(asistenciasPotenciales)
    .where(eq(asistenciasPotenciales.personId, personId))
    .orderBy(desc(asistenciasPotenciales.fechaClase), desc(asistenciasPotenciales.horaInicio))
    .limit(100);
}

export async function adjustAttendance(id: string, input: {
  estado: "confirmed" | "partial" | "unverified" | "assumed";
  minutosAsistidos?: number;
  porcentaje?: number;
}) {
  const [current] = await db
    .select({
      minutosTotales: asistenciasPotenciales.minutosTotales,
      minutosAsistidos: asistenciasPotenciales.minutosAsistidos,
      porcentaje: asistenciasPotenciales.porcentaje
    })
    .from(asistenciasPotenciales)
    .where(eq(asistenciasPotenciales.id, id))
    .limit(1);

  if (!current) return null;

  const minutosTotales = current.minutosTotales || 0;
  const minutosAsistidos = input.minutosAsistidos ?? (
    input.estado === "confirmed" ? minutosTotales :
    input.estado === "partial" ? Math.floor(minutosTotales / 2) :
    0
  );
  const porcentaje = input.porcentaje ?? (
    minutosTotales > 0 ? Math.min(100, Math.max(0, Math.round((minutosAsistidos / minutosTotales) * 100))) :
    (input.estado === "confirmed" ? 100 : input.estado === "partial" ? 50 : 0)
  );

  const [row] = await db
    .update(asistenciasPotenciales)
    .set({
      estado: input.estado,
      minutosAsistidos,
      porcentaje,
      confirmedAt: input.estado === "confirmed" ? new Date() : null,
      updatedAt: new Date()
    })
    .where(eq(asistenciasPotenciales.id, id))
    .returning();

  return row;
}

function buildSubjectWhere(filters: SubjectFilters) {
  const where: SQL[] = [];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(ilike(subjects.clave, q), ilike(subjects.nombre, q))!);
  }

  if (typeof filters.active === "boolean") {
    where.push(eq(subjects.active, filters.active));
  }

  return where.length ? and(...where) : undefined;
}

export async function listSubjects(filters: SubjectFilters, pagination: Pagination) {
  const where = buildSubjectWhere(filters);
  const [rows, totalRows] = await Promise.all([
    db.select()
      .from(subjects)
      .where(where)
      .orderBy(asc(subjects.nombre))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() })
      .from(subjects)
      .where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export async function createSubject(input: typeof subjects.$inferInsert) {
  const [row] = await db.insert(subjects).values(input).returning();
  return row!;
}

export async function updateSubject(id: string, input: Partial<typeof subjects.$inferInsert>) {
  const [row] = await db.update(subjects).set({ ...input, updatedAt: new Date() }).where(eq(subjects.id, id)).returning();
  return row;
}

function buildScheduleWhere(filters: ScheduleFilters) {
  const where: SQL[] = [];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(
      ilike(personas.matricula, q),
      ilike(personas.nombres, q),
      ilike(personas.apellidos, q),
      ilike(subjects.clave, q),
      ilike(subjects.nombre, q),
      ilike(schedules.aula, q)
    )!);
  }

  if (filters.personId) {
    where.push(eq(schedules.personId, filters.personId));
  }

  if (filters.subjectId) {
    where.push(eq(schedules.subjectId, filters.subjectId));
  }

  if (typeof filters.weekday === "number") {
    where.push(eq(schedules.weekday, filters.weekday));
  }

  if (typeof filters.active === "boolean") {
    where.push(eq(schedules.active, filters.active));
  }

  return where.length ? and(...where) : undefined;
}

export async function listSchedules(filters: ScheduleFilters, pagination: Pagination) {
  const where = buildScheduleWhere(filters);
  const [rows, totalRows] = await Promise.all([
    db.select({
    id: schedules.id,
    personId: schedules.personId,
    subjectId: schedules.subjectId,
    weekday: schedules.weekday,
    horaInicio: schedules.horaInicio,
    horaFin: schedules.horaFin,
    aula: schedules.aula,
    validFrom: schedules.validFrom,
    validUntil: schedules.validUntil,
    active: schedules.active,
    createdAt: schedules.createdAt,
    updatedAt: schedules.updatedAt,
    matricula: personas.matricula,
    personName: sql<string>`trim(coalesce(${personas.nombres}, '') || ' ' || coalesce(${personas.apellidos}, ''))`,
    subjectClave: subjects.clave,
    subjectName: subjects.nombre
  })
    .from(schedules)
    .innerJoin(personas, eq(schedules.personId, personas.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .where(where)
    .orderBy(asc(schedules.weekday), asc(schedules.horaInicio), asc(personas.apellidos), asc(personas.nombres))
    .limit(pagination.pageSize)
    .offset(pagination.offset),
    db.select({ total: count() })
      .from(schedules)
      .innerJoin(personas, eq(schedules.personId, personas.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export async function createSchedule(input: typeof schedules.$inferInsert) {
  const [row] = await db.insert(schedules).values(input).returning();
  return row!;
}

export async function updateSchedule(id: string, input: Partial<typeof schedules.$inferInsert>) {
  const [row] = await db.update(schedules).set({ ...input, updatedAt: new Date() }).where(eq(schedules.id, id)).returning();
  return row;
}
