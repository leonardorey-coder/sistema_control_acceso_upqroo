import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { qrTokens, temporaryDailyQrTokens } from "../../db/schema";

export function listPersonQrTokens(personId: string) {
  return db.select({
    id: qrTokens.id,
    personId: qrTokens.personId,
    status: qrTokens.status,
    issuedAt: qrTokens.issuedAt,
    expiresAt: qrTokens.expiresAt,
    lastUsedAt: qrTokens.lastUsedAt,
    revokedAt: qrTokens.revokedAt
  }).from(qrTokens).where(eq(qrTokens.personId, personId)).limit(20);
}

export async function createPersonQrToken(input: typeof qrTokens.$inferInsert) {
  const [row] = await db.insert(qrTokens).values(input).returning();
  return row;
}

export async function createTemporaryDailyQr(input: typeof temporaryDailyQrTokens.$inferInsert) {
  const [row] = await db.insert(temporaryDailyQrTokens).values(input).returning();
  return row;
}

export function listTemporaryDailyQr() {
  return db.select({
    id: temporaryDailyQrTokens.id,
    personId: temporaryDailyQrTokens.personId,
    operationalDate: temporaryDailyQrTokens.operationalDate,
    missingCredentialType: temporaryDailyQrTokens.missingCredentialType,
    reasonCode: temporaryDailyQrTokens.reasonCode,
    reasonText: temporaryDailyQrTokens.reasonText,
    maxUses: temporaryDailyQrTokens.maxUses,
    useCount: temporaryDailyQrTokens.useCount,
    status: temporaryDailyQrTokens.status,
    validUntil: temporaryDailyQrTokens.validUntil,
    revokedAt: temporaryDailyQrTokens.revokedAt,
    createdAt: temporaryDailyQrTokens.createdAt
  }).from(temporaryDailyQrTokens).limit(100);
}

export async function revokeTemporaryDailyQr(id: string) {
  const [row] = await db
    .update(temporaryDailyQrTokens)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(temporaryDailyQrTokens.id, id))
    .returning({
      id: temporaryDailyQrTokens.id,
      personId: temporaryDailyQrTokens.personId,
      operationalDate: temporaryDailyQrTokens.operationalDate,
      status: temporaryDailyQrTokens.status,
      revokedAt: temporaryDailyQrTokens.revokedAt
    });

  return row;
}
