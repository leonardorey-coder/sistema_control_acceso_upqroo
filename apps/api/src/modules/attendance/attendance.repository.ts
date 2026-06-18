import { and, asc, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
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

export function listSubjects() {
  return db.select().from(subjects).orderBy(asc(subjects.nombre));
}

export async function createSubject(input: typeof subjects.$inferInsert) {
  const [row] = await db.insert(subjects).values(input).returning();
  return row;
}

export async function updateSubject(id: string, input: Partial<typeof subjects.$inferInsert>) {
  const [row] = await db.update(subjects).set({ ...input, updatedAt: new Date() }).where(eq(subjects.id, id)).returning();
  return row;
}

export function listSchedules() {
  return db.select().from(schedules).orderBy(asc(schedules.weekday), asc(schedules.horaInicio)).limit(200);
}

export async function createSchedule(input: typeof schedules.$inferInsert) {
  const [row] = await db.insert(schedules).values(input).returning();
  return row;
}

export async function updateSchedule(id: string, input: Partial<typeof schedules.$inferInsert>) {
  const [row] = await db.update(schedules).set({ ...input, updatedAt: new Date() }).where(eq(schedules.id, id)).returning();
  return row;
}
