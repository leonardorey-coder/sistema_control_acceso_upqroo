import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { operationalConfig } from "../../db/schema";

export async function getOperationalConfig(key = "scanner") {
  return db.select().from(operationalConfig).where(eq(operationalConfig.key, key)).limit(1);
}

export async function upsertOperationalConfig(input: typeof operationalConfig.$inferInsert) {
  const [row] = await db
    .insert(operationalConfig)
    .values(input)
    .onConflictDoUpdate({
      target: operationalConfig.key,
      set: {
        value: input.value,
        description: input.description,
        updatedByAdminId: input.updatedByAdminId,
        updatedAt: new Date()
      }
    })
    .returning();

  return row;
}
