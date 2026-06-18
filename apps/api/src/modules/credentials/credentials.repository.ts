import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { qrTokens, temporaryDailyQrTokens } from "../../db/schema";

export function listPersonQrTokens(personId: string) {
  return db.select().from(qrTokens).where(eq(qrTokens.personId, personId)).limit(20);
}

export async function createPersonQrToken(input: typeof qrTokens.$inferInsert) {
  const [row] = await db.insert(qrTokens).values(input).returning();
  return row;
}

export async function createTemporaryDailyQr(input: typeof temporaryDailyQrTokens.$inferInsert) {
  const [row] = await db.insert(temporaryDailyQrTokens).values(input).returning();
  return row;
}
