import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { carreras, personas, personTypes, vehiclePermitQrTokens, vehiclePermits, vehicles } from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

export type VehicleFilters = {
  q?: string;
  status?: "active" | "inactive" | "blocked";
  ownerPersonId?: string;
};

function buildVehicleWhere(filters: VehicleFilters) {
  const where: SQL[] = [];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(
      ilike(vehicles.plate, q),
      ilike(vehicles.make, q),
      ilike(vehicles.model, q),
      ilike(vehicles.color, q)
    )!);
  }

  if (filters.status) {
    where.push(eq(vehicles.status, filters.status));
  }

  if (filters.ownerPersonId) {
    where.push(eq(vehicles.ownerPersonId, filters.ownerPersonId));
  }

  return where.length ? and(...where) : undefined;
}

export async function listVehicles(filters: VehicleFilters, pagination: Pagination) {
  const where = buildVehicleWhere(filters);
  const [rows, totalRows] = await Promise.all([
    db.select().from(vehicles)
      .where(where)
      .orderBy(asc(vehicles.plate))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(vehicles).where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export async function createVehicle(input: typeof vehicles.$inferInsert) {
  const [row] = await db.insert(vehicles).values(input).returning();
  return row!;
}

export async function updateVehicle(id: string, input: Partial<typeof vehicles.$inferInsert>) {
  const [row] = await db.update(vehicles).set({ ...input, updatedAt: new Date() }).where(eq(vehicles.id, id)).returning();
  return row;
}

export async function listVehiclePermits(pagination: Pagination) {
  const [rows, totalRows] = await Promise.all([
    db.select().from(vehiclePermits)
      .orderBy(asc(vehiclePermits.validFrom))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(vehiclePermits)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export async function getVehicle(id: string) {
  const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return row;
}

export async function createVehiclePermit(input: typeof vehiclePermits.$inferInsert) {
  const [row] = await db.insert(vehiclePermits).values(input).returning();
  return row!;
}

export async function getVehiclePermitEligibility(personId: string) {
  const [row] = await db.select({
    personId: personas.id,
    estado: personas.estado,
    tipoPersona: personas.tipoPersona,
    canHaveVehiclePermit: personTypes.canHaveVehiclePermit
  })
    .from(personas)
    .innerJoin(personTypes, eq(personas.tipoPersona, personTypes.code))
    .where(eq(personas.id, personId))
    .limit(1);

  return row;
}

export async function updateVehiclePermit(id: string, input: Partial<typeof vehiclePermits.$inferInsert>) {
  const [row] = await db.update(vehiclePermits).set({ ...input, updatedAt: new Date() }).where(eq(vehiclePermits.id, id)).returning();
  return row;
}

export async function createVehiclePermitQrToken(input: typeof vehiclePermitQrTokens.$inferInsert) {
  const [row] = await db.insert(vehiclePermitQrTokens).values(input).returning();
  return row!;
}

export async function rotateVehiclePermitQrTokens(permitId: string) {
  return db
    .update(vehiclePermitQrTokens)
    .set({ status: "rotated", revokedAt: new Date() })
    .where(eq(vehiclePermitQrTokens.vehiclePermitId, permitId))
    .returning();
}

export async function getVehiclePermitSigningContext(permitId: string) {
  const [row] = await db.select({
    permitId: vehiclePermits.id,
    personId: vehiclePermits.personId,
    vehicleId: vehiclePermits.vehicleId,
    permitStatus: vehiclePermits.status,
    validFrom: vehiclePermits.validFrom,
    validUntil: vehiclePermits.validUntil,
    matricula: personas.matricula,
    nombres: personas.nombres,
    apellidos: personas.apellidos,
    tipoPersona: personas.tipoPersona,
    estado: personas.estado,
    carrera: carreras.nombre,
    vehiclePlate: vehicles.plate,
    vehicleStatus: vehicles.status
  })
    .from(vehiclePermits)
    .innerJoin(personas, eq(vehiclePermits.personId, personas.id))
    .innerJoin(vehicles, eq(vehiclePermits.vehicleId, vehicles.id))
    .leftJoin(carreras, eq(personas.carreraId, carreras.id))
    .where(and(
      eq(vehiclePermits.id, permitId),
      eq(vehiclePermits.status, "active"),
      eq(personas.estado, "activo"),
      eq(vehicles.status, "active")
    ))
    .limit(1);

  if (!row) return null;
  if (row.validUntil && row.validUntil <= new Date()) return null;
  if (row.validFrom && row.validFrom > new Date()) return null;
  return row;
}
