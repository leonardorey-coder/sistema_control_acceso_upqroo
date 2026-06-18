import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { carreras, personas, personTypes } from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

export type PeopleFilters = {
  q?: string;
  personType?: string;
  status?: string;
  careerId?: string;
};

function buildPeopleWhere(filters: PeopleFilters) {
  const where: SQL[] = [];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(
      ilike(personas.matricula, q),
      ilike(personas.nombres, q),
      ilike(personas.apellidos, q),
      ilike(personas.curp, q)
    )!);
  }

  if (filters.personType) {
    where.push(eq(personas.tipoPersona, filters.personType));
  }

  if (filters.status) {
    where.push(eq(personas.estado, filters.status as "activo"));
  }

  if (filters.careerId) {
    where.push(eq(personas.carreraId, filters.careerId));
  }

  return where.length ? and(...where) : undefined;
}

export async function listPeople(filters: PeopleFilters, pagination: Pagination) {
  const where = buildPeopleWhere(filters);

  const [rows, totalRows] = await Promise.all([
    db.select({
      id: personas.id,
      matricula: personas.matricula,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      curp: personas.curp,
      tipoPersona: personas.tipoPersona,
      tipoPersonaLabel: personTypes.label,
      estado: personas.estado,
      carreraId: personas.carreraId,
      carrera: carreras.nombre,
      notas: personas.notas,
      profileFileId: personas.profileFileId,
      createdAt: personas.createdAt,
      updatedAt: personas.updatedAt
    })
      .from(personas)
      .leftJoin(personTypes, eq(personas.tipoPersona, personTypes.code))
      .leftJoin(carreras, eq(personas.carreraId, carreras.id))
      .where(where)
      .orderBy(asc(personas.apellidos), asc(personas.nombres), asc(personas.matricula))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(personas).where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export function findPersonByMatricula(matricula: string) {
  return db.query.personas.findFirst({
    where: eq(personas.matricula, matricula)
  });
}

export function findPersonById(id: string) {
  return db.query.personas.findFirst({
    where: eq(personas.id, id)
  });
}

export async function createPerson(input: typeof personas.$inferInsert) {
  const [row] = await db.insert(personas).values(input).returning();
  return row;
}

export async function updatePerson(id: string, input: Partial<typeof personas.$inferInsert>) {
  const [row] = await db
    .update(personas)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(personas.id, id))
    .returning();

  return row;
}
