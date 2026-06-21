import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import {
  administradores,
  carreras,
  personas,
  registrosAcceso,
  storedFiles,
  vehicles
} from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

export type AccessTodayFilters = {
  q?: string;
  personType?: string;
  accessMode?: "pedestrian" | "vehicle" | "visitor" | "manual";
  status?: "in_progress" | "completed" | "auto_closed" | "rejected";
  from: Date;
  to: Date;
};

function buildAccessWhere(filters: AccessTodayFilters) {
  const where: SQL[] = [
    gte(registrosAcceso.entradaAt, filters.from),
    lte(registrosAcceso.entradaAt, filters.to)
  ];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(
      ilike(personas.matricula, q),
      ilike(personas.nombres, q),
      ilike(personas.apellidos, q),
      ilike(registrosAcceso.matriculaLegacy, q),
      ilike(vehicles.plate, q),
      ilike(registrosAcceso.visitorName, q)
    )!);
  }

  if (filters.personType) {
    where.push(eq(personas.tipoPersona, filters.personType));
  }

  if (filters.accessMode) {
    where.push(eq(registrosAcceso.accessMode, filters.accessMode));
  }

  if (filters.status) {
    where.push(eq(registrosAcceso.status, filters.status));
  }

  return and(...where);
}

export async function listAccessToday(filters: AccessTodayFilters, pagination: Pagination) {
  const where = buildAccessWhere(filters);

  const [rows, totalRows] = await Promise.all([
    db.select({
      id: registrosAcceso.id,
      matricula: personas.matricula,
      matriculaLegacy: registrosAcceso.matriculaLegacy,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      tipoPersona: personas.tipoPersona,
      carrera: carreras.nombre,
      entradaAt: registrosAcceso.entradaAt,
      salidaAt: registrosAcceso.salidaAt,
      adminEntrada: administradores.displayName,
      adminSalidaId: registrosAcceso.adminSalidaId,
      status: registrosAcceso.status,
      accessMode: registrosAcceso.accessMode,
      credentialType: registrosAcceso.credentialType,
      vehiclePlate: vehicles.plate,
      visitorName: registrosAcceso.visitorName,
      hashRegistro: registrosAcceso.hashRegistro,
      hashAnterior: registrosAcceso.hashAnterior
    })
      .from(registrosAcceso)
      .leftJoin(personas, eq(registrosAcceso.personId, personas.id))
      .leftJoin(carreras, eq(personas.carreraId, carreras.id))
      .leftJoin(vehicles, eq(registrosAcceso.vehicleId, vehicles.id))
      .leftJoin(administradores, eq(registrosAcceso.adminEntradaId, administradores.id))
      .where(where)
      .orderBy(desc(registrosAcceso.entradaAt))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() })
      .from(registrosAcceso)
      .leftJoin(personas, eq(registrosAcceso.personId, personas.id))
      .leftJoin(vehicles, eq(registrosAcceso.vehicleId, vehicles.id))
      .where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export type AccessScanPayload = {
  token?: string;
  manualMatricula?: string;
  adminId?: string;
  scannerId?: string;
  preVerifiedPersonId?: string;
  preVerifiedJti?: string;
  preVerifiedCredentialType?: "person_qr" | "temporary_daily_qr" | "vehicle_permit_qr";
  preVerifiedTemporaryDailyQrId?: string;
  preVerifiedVehiclePermitId?: string;
  signatureVerified?: boolean;
  kid?: string;
  sigAlg?: string;
  iat?: number;
  exp?: number;
};

export async function runAccessScan(payload: AccessScanPayload) {
  const [row] = await db.execute<{ result: unknown }>(
    sql`select access_scan_v1(${JSON.stringify(payload)}::jsonb) as result`
  );

  return row?.result;
}

export async function getPersonProfileFileUrl(personId: string) {
  const [row] = await db
    .select({
      objectKey: storedFiles.objectKey,
      legacyPhoto: personas.fotoPerfilLegacy
    })
    .from(personas)
    .leftJoin(storedFiles, eq(personas.profileFileId, storedFiles.id))
    .where(eq(personas.id, personId))
    .limit(1);

  if (!row) return null;

  if (row.objectKey) {
    return `/api/v1/files/${encodeURIComponent(row.objectKey)}`;
  }

  return row.legacyPhoto ?? null;
}

export async function runAutoExits(targetDate?: string) {
  const [row] = await db.execute<{ result: unknown }>(
    targetDate
      ? sql`select auto_close_access_v1(${targetDate}::date) as result`
      : sql`select auto_close_access_v1() as result`
  );

  return row?.result;
}
