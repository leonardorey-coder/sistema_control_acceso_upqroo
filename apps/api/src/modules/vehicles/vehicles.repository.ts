import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { vehiclePermitQrTokens, vehiclePermits, vehicles } from "../../db/schema";

export function listVehicles() {
  return db.select().from(vehicles).orderBy(asc(vehicles.plate)).limit(100);
}

export async function createVehicle(input: typeof vehicles.$inferInsert) {
  const [row] = await db.insert(vehicles).values(input).returning();
  return row;
}

export async function updateVehicle(id: string, input: Partial<typeof vehicles.$inferInsert>) {
  const [row] = await db.update(vehicles).set({ ...input, updatedAt: new Date() }).where(eq(vehicles.id, id)).returning();
  return row;
}

export function listVehiclePermits() {
  return db.select().from(vehiclePermits).orderBy(asc(vehiclePermits.validFrom)).limit(100);
}

export async function getVehicle(id: string) {
  const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return row;
}

export async function createVehiclePermit(input: typeof vehiclePermits.$inferInsert) {
  const [row] = await db.insert(vehiclePermits).values(input).returning();
  return row;
}

export async function updateVehiclePermit(id: string, input: Partial<typeof vehiclePermits.$inferInsert>) {
  const [row] = await db.update(vehiclePermits).set({ ...input, updatedAt: new Date() }).where(eq(vehiclePermits.id, id)).returning();
  return row;
}

export async function createVehiclePermitQrToken(input: typeof vehiclePermitQrTokens.$inferInsert) {
  const [row] = await db.insert(vehiclePermitQrTokens).values(input).returning();
  return row;
}

export async function rotateVehiclePermitQrTokens(permitId: string) {
  return db
    .update(vehiclePermitQrTokens)
    .set({ status: "rotated", revokedAt: new Date() })
    .where(eq(vehiclePermitQrTokens.vehiclePermitId, permitId))
    .returning();
}
