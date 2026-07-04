import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import {
  carreras,
  hotQrTokens,
  personas,
  personTypes,
  vehiclePermitQrTokens,
  vehiclePermits,
  vehicles,
  vehicleVisitorPermits
} from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

export type VehicleFilters = {
  q?: string;
  status?: "active" | "inactive" | "blocked";
  approvalStatus?: "pending" | "approved" | "rejected";
  vehicleType?: "car" | "motorcycle" | "bicycle" | "electric_scooter" | "truck" | "official" | "university_transport" | "visitor" | "other";
  ownerPersonId?: string;
};

export type VehiclePermitFilters = {
  q?: string;
  status?: "active" | "expired" | "revoked" | "suspended";
  permitType?: "standard" | "temporary" | "official" | "visitor" | "provider" | "event" | "emergency";
  personId?: string;
  vehicleId?: string;
};

export type VehicleVisitorPermitFilters = {
  q?: string;
  status?: "active" | "expired" | "revoked";
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

  if (filters.approvalStatus) {
    where.push(eq(vehicles.approvalStatus, filters.approvalStatus));
  }

  if (filters.vehicleType) {
    where.push(eq(vehicles.vehicleType, filters.vehicleType));
  }

  if (filters.ownerPersonId) {
    where.push(eq(vehicles.ownerPersonId, filters.ownerPersonId));
  }

  return where.length ? and(...where) : undefined;
}

export async function listVehicles(filters: VehicleFilters, pagination: Pagination) {
  const where = buildVehicleWhere(filters);
  const [rows, totalRows] = await Promise.all([
    db.select({
      id: vehicles.id,
      ownerPersonId: vehicles.ownerPersonId,
      plate: vehicles.plate,
      vehicleType: vehicles.vehicleType,
      make: vehicles.make,
      model: vehicles.model,
      color: vehicles.color,
      status: vehicles.status,
      approvalStatus: vehicles.approvalStatus,
      registeredByAdminId: vehicles.registeredByAdminId,
      approvedByAdminId: vehicles.approvedByAdminId,
      approvedAt: vehicles.approvedAt,
      rejectedByAdminId: vehicles.rejectedByAdminId,
      rejectedAt: vehicles.rejectedAt,
      rejectionReason: vehicles.rejectionReason,
      deletedAt: vehicles.deletedAt,
      notes: vehicles.notes,
      createdAt: vehicles.createdAt,
      updatedAt: vehicles.updatedAt,
      matricula: personas.matricula,
      ownerName: sql<string>`trim(coalesce(${personas.nombres}, '') || ' ' || coalesce(${personas.apellidos}, ''))`
    }).from(vehicles)
      .innerJoin(personas, eq(vehicles.ownerPersonId, personas.id))
      .where(where)
      .orderBy(asc(vehicles.plate))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(vehicles)
      .innerJoin(personas, eq(vehicles.ownerPersonId, personas.id))
      .where(where)
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

function buildVehiclePermitWhere(filters: VehiclePermitFilters) {
  const where: SQL[] = [];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(
      ilike(personas.matricula, q),
      ilike(personas.nombres, q),
      ilike(personas.apellidos, q),
      ilike(vehicles.plate, q)
    )!);
  }

  if (filters.status) {
    where.push(eq(vehiclePermits.status, filters.status));
  }

  if (filters.permitType) {
    where.push(eq(vehiclePermits.permitType, filters.permitType));
  }

  if (filters.personId) {
    where.push(eq(vehiclePermits.personId, filters.personId));
  }

  if (filters.vehicleId) {
    where.push(eq(vehiclePermits.vehicleId, filters.vehicleId));
  }

  return where.length ? and(...where) : undefined;
}

export async function listVehiclePermits(filters: VehiclePermitFilters, pagination: Pagination) {
  const where = buildVehiclePermitWhere(filters);
  const [rows, totalRows] = await Promise.all([
    db.select({
      id: vehiclePermits.id,
      personId: vehiclePermits.personId,
      vehicleId: vehiclePermits.vehicleId,
      status: vehiclePermits.status,
      permitType: vehiclePermits.permitType,
      validFrom: vehiclePermits.validFrom,
      validUntil: vehiclePermits.validUntil,
      revokedAt: vehiclePermits.revokedAt,
      createdAt: vehiclePermits.createdAt,
      updatedAt: vehiclePermits.updatedAt,
      matricula: personas.matricula,
      personName: sql<string>`trim(coalesce(${personas.nombres}, '') || ' ' || coalesce(${personas.apellidos}, ''))`,
      vehiclePlate: vehicles.plate
    }).from(vehiclePermits)
      .innerJoin(personas, eq(vehiclePermits.personId, personas.id))
      .innerJoin(vehicles, eq(vehiclePermits.vehicleId, vehicles.id))
      .where(where)
      .orderBy(asc(vehiclePermits.validFrom))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(vehiclePermits)
      .innerJoin(personas, eq(vehiclePermits.personId, personas.id))
      .innerJoin(vehicles, eq(vehiclePermits.vehicleId, vehicles.id))
      .where(where)
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

export async function getVehiclePermitPrerequisites(personId: string, vehicleId: string) {
  const [row] = await db.select({
    personId: personas.id,
    estado: personas.estado,
    tipoPersona: personas.tipoPersona,
    canHaveVehiclePermit: personTypes.canHaveVehiclePermit,
    vehicleId: vehicles.id,
    ownerPersonId: vehicles.ownerPersonId,
    vehicleStatus: vehicles.status,
    approvalStatus: vehicles.approvalStatus,
    deletedAt: vehicles.deletedAt
  })
    .from(personas)
    .innerJoin(personTypes, eq(personas.tipoPersona, personTypes.code))
    .innerJoin(vehicles, eq(vehicles.id, vehicleId))
    .where(eq(personas.id, personId))
    .limit(1);

  return row;
}

export async function createVehiclePermit(input: typeof vehiclePermits.$inferInsert) {
  const [row] = await db.insert(vehiclePermits).values(input).returning();
  return row!;
}

export async function getVehiclePermit(id: string) {
  const [row] = await db.select().from(vehiclePermits).where(eq(vehiclePermits.id, id)).limit(1);
  return row;
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
    vehicleStatus: vehicles.status,
    approvalStatus: vehicles.approvalStatus,
    deletedAt: vehicles.deletedAt
  })
    .from(vehiclePermits)
    .innerJoin(personas, eq(vehiclePermits.personId, personas.id))
    .innerJoin(vehicles, eq(vehiclePermits.vehicleId, vehicles.id))
    .leftJoin(carreras, eq(personas.carreraId, carreras.id))
    .where(and(
      eq(vehiclePermits.id, permitId),
      eq(vehiclePermits.status, "active"),
      eq(personas.estado, "activo"),
      eq(vehicles.status, "active"),
      eq(vehicles.approvalStatus, "approved"),
      sql`${vehicles.deletedAt} is null`
    ))
    .limit(1);

  if (!row) return null;
  if (row.validUntil && row.validUntil <= new Date()) return null;
  if (row.validFrom && row.validFrom > new Date()) return null;
  return row;
}

function buildVehicleVisitorPermitWhere(filters: VehicleVisitorPermitFilters) {
  const where: SQL[] = [];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(
      ilike(vehicleVisitorPermits.visitorName, q),
      ilike(vehicleVisitorPermits.plate, q),
      ilike(vehicleVisitorPermits.reason, q)
    )!);
  }

  if (filters.status) {
    where.push(eq(vehicleVisitorPermits.status, filters.status));
  }

  return where.length ? and(...where) : undefined;
}

export async function listVehicleVisitorPermits(filters: VehicleVisitorPermitFilters, pagination: Pagination) {
  const where = buildVehicleVisitorPermitWhere(filters);
  const [rows, totalRows] = await Promise.all([
    db.select({
      id: vehicleVisitorPermits.id,
      hotQrTokenId: vehicleVisitorPermits.hotQrTokenId,
      visitorName: vehicleVisitorPermits.visitorName,
      plate: vehicleVisitorPermits.plate,
      vehicleType: vehicleVisitorPermits.vehicleType,
      color: vehicleVisitorPermits.color,
      reason: vehicleVisitorPermits.reason,
      status: vehicleVisitorPermits.status,
      validFrom: vehicleVisitorPermits.validFrom,
      validUntil: vehicleVisitorPermits.validUntil,
      revokedAt: vehicleVisitorPermits.revokedAt,
      createdAt: vehicleVisitorPermits.createdAt,
      updatedAt: vehicleVisitorPermits.updatedAt,
      hotQrStatus: hotQrTokens.status
    }).from(vehicleVisitorPermits)
      .innerJoin(hotQrTokens, eq(vehicleVisitorPermits.hotQrTokenId, hotQrTokens.id))
      .where(where)
      .orderBy(desc(vehicleVisitorPermits.createdAt))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(vehicleVisitorPermits).where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export async function createVehicleVisitorPermit(input: typeof vehicleVisitorPermits.$inferInsert) {
  const [row] = await db.insert(vehicleVisitorPermits).values(input).returning();
  return row!;
}

export async function revokeVehicleVisitorPermit(id: string, adminId: string) {
  const [row] = await db
    .update(vehicleVisitorPermits)
    .set({ status: "revoked", revokedByAdminId: adminId, revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(vehicleVisitorPermits.id, id))
    .returning();

  return row;
}
