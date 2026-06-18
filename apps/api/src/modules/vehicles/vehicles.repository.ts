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

export async function createVehiclePermit(input: typeof vehiclePermits.$inferInsert) {
  const [row] = await db.insert(vehiclePermits).values(input).returning();
  return row;
}

export async function createVehiclePermitQrToken(input: typeof vehiclePermitQrTokens.$inferInsert) {
  const [row] = await db.insert(vehiclePermitQrTokens).values(input).returning();
  return row;
}
