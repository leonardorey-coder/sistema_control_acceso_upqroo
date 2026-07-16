import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { accessScanEvents, gateScanners, gates, scannerDevices } from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

export type GateFilters = {
  q?: string;
  type?: typeof gates.$inferSelect.type;
  status?: typeof gates.$inferSelect.status;
};

function buildGateWhere(filters: GateFilters) {
  const where: SQL[] = [];
  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(ilike(gates.code, q), ilike(gates.name, q), ilike(gates.location, q))!);
  }
  if (filters.type) where.push(eq(gates.type, filters.type));
  if (filters.status) where.push(eq(gates.status, filters.status));
  return where.length ? and(...where) : undefined;
}

export async function listGates(filters: GateFilters, pagination: Pagination) {
  const where = buildGateWhere(filters);
  const [rows, totalRows] = await Promise.all([
    db.select({
      id: gates.id,
      code: gates.code,
      name: gates.name,
      type: gates.type,
      location: gates.location,
      status: gates.status,
      schedule: gates.schedule,
      rules: gates.rules,
      notes: gates.notes,
      createdAt: gates.createdAt,
      updatedAt: gates.updatedAt,
      scannerCount: sql<number>`count(${gateScanners.id})::int`,
      activeScannerCount: sql<number>`count(${gateScanners.id}) filter (where ${gateScanners.status} = 'active')::int`,
      lastSeenAt: sql<Date | null>`max(${gateScanners.lastSeenAt})`
    }).from(gates)
      .leftJoin(gateScanners, eq(gateScanners.gateId, gates.id))
      .where(where)
      .groupBy(gates.id)
      .orderBy(asc(gates.name))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(gates).where(where)
  ]);
  return { rows, total: totalRows[0]?.total ?? 0 };
}

export async function getGate(id: string) {
  const [row] = await db.select().from(gates).where(eq(gates.id, id)).limit(1);
  return row;
}

export async function findGateByScannerId(scannerId: string) {
  const [row] = await db.select({
    gateId: gates.id,
    gateCode: gates.code,
    gateName: gates.name,
    gateStatus: gates.status,
    gateScannerId: gateScanners.id
  }).from(gateScanners)
    .innerJoin(gates, eq(gateScanners.gateId, gates.id))
    .where(and(eq(gateScanners.scannerId, scannerId), eq(gateScanners.status, "active")))
    .limit(1);
  return row;
}

export async function createGate(input: typeof gates.$inferInsert) {
  const [row] = await db.insert(gates).values(input).returning();
  return row!;
}

export async function updateGate(id: string, input: Partial<typeof gates.$inferInsert>) {
  const [row] = await db.update(gates)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(gates.id, id))
    .returning();
  return row;
}

export function listGateScanners(gateId: string) {
  return db.select({
    id: gateScanners.id,
    gateId: gateScanners.gateId,
    scannerDeviceId: gateScanners.scannerDeviceId,
    scannerId: gateScanners.scannerId,
    label: gateScanners.label,
    status: gateScanners.status,
    lastSeenAt: gateScanners.lastSeenAt,
    metadata: gateScanners.metadata,
    createdAt: gateScanners.createdAt,
    updatedAt: gateScanners.updatedAt,
    deviceStatus: scannerDevices.status,
    deviceLabel: scannerDevices.label
  }).from(gateScanners)
    .leftJoin(scannerDevices, eq(gateScanners.scannerDeviceId, scannerDevices.id))
    .where(eq(gateScanners.gateId, gateId))
    .orderBy(desc(gateScanners.createdAt));
}

export async function createGateScanner(input: typeof gateScanners.$inferInsert) {
  const [row] = await db.insert(gateScanners).values(input).returning();
  return row!;
}

export async function updateGateScanner(gateId: string, id: string, input: Partial<typeof gateScanners.$inferInsert>) {
  const [row] = await db.update(gateScanners)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(gateScanners.id, id), eq(gateScanners.gateId, gateId)))
    .returning();
  return row;
}

export async function summarizeGates(from: Date, to: Date) {
  return db.select({
    gateId: gates.id,
    gateCode: gates.code,
    gateName: gates.name,
    gateStatus: gates.status,
    accepted: sql<number>`count(${accessScanEvents.id}) filter (where ${accessScanEvents.accepted} = true)::int`,
    rejected: sql<number>`count(${accessScanEvents.id}) filter (where ${accessScanEvents.accepted} = false)::int`,
    total: sql<number>`count(${accessScanEvents.id})::int`,
    lastScanAt: sql<Date | null>`max(${accessScanEvents.scannedAt})`
  }).from(gates)
    .leftJoin(accessScanEvents, and(
      eq(accessScanEvents.gateId, gates.id),
      sql`${accessScanEvents.scannedAt} >= ${from}`,
      sql`${accessScanEvents.scannedAt} <= ${to}`
    ))
    .groupBy(gates.id)
    .orderBy(asc(gates.name));
}
