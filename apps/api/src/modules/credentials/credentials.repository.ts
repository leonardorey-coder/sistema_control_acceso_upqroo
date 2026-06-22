import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { carreras, personas, qrTokens, registrosAcceso, temporaryDailyQrTokens } from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

export async function listPersonQrTokens(personId: string, pagination: Pagination) {
  const where = eq(qrTokens.personId, personId);
  const [rows, totalRows] = await Promise.all([
    db.select({
      id: qrTokens.id,
      personId: qrTokens.personId,
      status: qrTokens.status,
      issuedAt: qrTokens.issuedAt,
      expiresAt: qrTokens.expiresAt,
      lastUsedAt: qrTokens.lastUsedAt,
      revokedAt: qrTokens.revokedAt,
      tokenVersion: qrTokens.tokenVersion
    })
      .from(qrTokens)
      .where(where)
      .orderBy(desc(qrTokens.issuedAt))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(qrTokens).where(where)
  ]);

  return { rows, total: totalRows[0]?.total ?? 0 };
}

export async function createPersonQrToken(input: typeof qrTokens.$inferInsert) {
  const [row] = await db.insert(qrTokens).values(input).returning();
  return row!;
}

export async function revokeActivePersonQrTokens(personId: string) {
  return db
    .update(qrTokens)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(qrTokens.personId, personId), eq(qrTokens.status, "active")))
    .returning({
      id: qrTokens.id,
      personId: qrTokens.personId,
      status: qrTokens.status,
      revokedAt: qrTokens.revokedAt
    });
}

export async function createTemporaryDailyQr(input: typeof temporaryDailyQrTokens.$inferInsert) {
  const [row] = await db.insert(temporaryDailyQrTokens).values(input).returning();
  return row!;
}

export async function listTemporaryDailyQr(pagination: Pagination) {
  const [rows, totalRows] = await Promise.all([
    db.select({
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
    })
      .from(temporaryDailyQrTokens)
      .orderBy(desc(temporaryDailyQrTokens.createdAt))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() }).from(temporaryDailyQrTokens)
  ]);

  return { rows, total: totalRows[0]?.total ?? 0 };
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

export async function getTemporaryDailyQrSigningContext(id: string) {
  const [row] = await db.select({
    id: temporaryDailyQrTokens.id,
    personId: temporaryDailyQrTokens.personId,
    operationalDate: temporaryDailyQrTokens.operationalDate,
    status: temporaryDailyQrTokens.status,
    validUntil: temporaryDailyQrTokens.validUntil,
    useCount: temporaryDailyQrTokens.useCount,
    maxUses: temporaryDailyQrTokens.maxUses,
    matricula: personas.matricula,
    nombres: personas.nombres,
    apellidos: personas.apellidos,
    tipoPersona: personas.tipoPersona,
    estado: personas.estado,
    carrera: carreras.nombre,
    hasOpenAccess: sql<boolean>`exists (
      select 1
      from ${registrosAcceso}
      where ${registrosAcceso.personId} = ${temporaryDailyQrTokens.personId}
        and ${registrosAcceso.temporaryDailyQrTokenId} = ${temporaryDailyQrTokens.id}
        and ${registrosAcceso.status} = 'in_progress'
        and ${registrosAcceso.salidaAt} is null
    )`
  })
    .from(temporaryDailyQrTokens)
    .innerJoin(personas, eq(temporaryDailyQrTokens.personId, personas.id))
    .leftJoin(carreras, eq(personas.carreraId, carreras.id))
    .where(and(
      eq(temporaryDailyQrTokens.id, id),
      eq(temporaryDailyQrTokens.status, "active"),
      gt(temporaryDailyQrTokens.validUntil, new Date()),
      eq(personas.estado, "activo")
    ))
    .limit(1);

  if (!row || (row.useCount >= row.maxUses && !row.hasOpenAccess)) return null;
  return row;
}
