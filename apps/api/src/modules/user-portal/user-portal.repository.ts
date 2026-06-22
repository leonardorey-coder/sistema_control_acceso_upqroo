import { and, desc, eq, gt, isNull, max, ne, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  asistenciasPotenciales,
  personas,
  qrTokens,
  registrosAcceso,
  temporaryDailyQrTokens,
  userAccounts,
  userDeviceChallenges,
  userDeviceKeys,
  userSessions
} from "../../db/schema";

export async function findUserAccountForLogin(identity: string) {
  const [row] = await db.select({
    id: userAccounts.id,
    personId: userAccounts.personId,
    email: userAccounts.email,
    passwordHash: userAccounts.passwordHash,
    status: userAccounts.status,
    mustChangePassword: userAccounts.mustChangePassword,
    matricula: personas.matricula,
    nombres: personas.nombres,
    apellidos: personas.apellidos,
    tipoPersona: personas.tipoPersona,
    estado: personas.estado
  })
    .from(userAccounts)
    .innerJoin(personas, eq(userAccounts.personId, personas.id))
    .where(eq(userAccounts.email, identity))
    .limit(1);

  return row;
}

export async function createUserSession(input: typeof userSessions.$inferInsert) {
  const [row] = await db.insert(userSessions).values(input).returning();
  return row!;
}

export function getUserAccountCredentialsById(id: string) {
  return db.query.userAccounts.findFirst({
    where: eq(userAccounts.id, id)
  });
}

export async function updateUserPassword(id: string, passwordHash: string) {
  const [row] = await db
    .update(userAccounts)
    .set({
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date()
    })
    .where(eq(userAccounts.id, id))
    .returning();

  return row;
}

export async function revokeOtherUserSessions(accountId: string, currentSessionHash: string) {
  return db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(userSessions.accountId, accountId),
      ne(userSessions.sessionHash, currentSessionHash),
      isNull(userSessions.revokedAt)
    ))
    .returning();
}

export async function getUserSessionByHash(sessionHash: string) {
  const [row] = await db
    .select({
      sessionId: userSessions.id,
      accountId: userAccounts.id,
      personId: personas.id,
      email: userAccounts.email,
      status: userAccounts.status,
      mustChangePassword: userAccounts.mustChangePassword,
      matricula: personas.matricula,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      tipoPersona: personas.tipoPersona,
      estado: personas.estado,
      expiresAt: userSessions.expiresAt
    })
    .from(userSessions)
    .innerJoin(userAccounts, eq(userSessions.accountId, userAccounts.id))
    .innerJoin(personas, eq(userAccounts.personId, personas.id))
    .where(and(
      eq(userSessions.sessionHash, sessionHash),
      isNull(userSessions.revokedAt),
      eq(userAccounts.status, "active"),
      gt(userSessions.expiresAt, new Date())
    ))
    .limit(1);

  return row;
}

export async function touchUserSession(sessionHash: string) {
  const [row] = await db
    .update(userSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(userSessions.sessionHash, sessionHash))
    .returning();

  return row;
}

export async function revokeUserSession(sessionHash: string) {
  const [row] = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.sessionHash, sessionHash))
    .returning();

  return row;
}

export function listPortalAccess(personId: string) {
  return db.select({
    id: registrosAcceso.id,
    entradaAt: registrosAcceso.entradaAt,
    salidaAt: registrosAcceso.salidaAt,
    status: registrosAcceso.status,
    accessMode: registrosAcceso.accessMode,
    credentialType: registrosAcceso.credentialType,
    vehicleId: registrosAcceso.vehicleId
  })
    .from(registrosAcceso)
    .where(eq(registrosAcceso.personId, personId))
    .orderBy(desc(registrosAcceso.entradaAt))
    .limit(20);
}

export function listPortalAttendance(personId: string) {
  return db.select({
    id: asistenciasPotenciales.id,
    fechaClase: asistenciasPotenciales.fechaClase,
    horaInicio: asistenciasPotenciales.horaInicio,
    horaFin: asistenciasPotenciales.horaFin,
    aula: asistenciasPotenciales.aula,
    estado: asistenciasPotenciales.estado,
    porcentaje: asistenciasPotenciales.porcentaje
  })
    .from(asistenciasPotenciales)
    .where(eq(asistenciasPotenciales.personId, personId))
    .orderBy(desc(asistenciasPotenciales.fechaClase), desc(asistenciasPotenciales.horaInicio))
    .limit(20);
}

export function getActivePortalQr(personId: string) {
  return db.select({
    id: qrTokens.id,
    personId: qrTokens.personId,
    status: qrTokens.status,
    issuedAt: qrTokens.issuedAt,
    expiresAt: qrTokens.expiresAt,
    lastUsedAt: qrTokens.lastUsedAt,
    tokenVersion: qrTokens.tokenVersion
  })
    .from(qrTokens)
    .where(and(
      eq(qrTokens.personId, personId),
      eq(qrTokens.status, "active"),
      gt(qrTokens.expiresAt, new Date())
    ))
    .orderBy(desc(qrTokens.issuedAt))
    .limit(1);
}

export async function rotatePortalQr(personId: string, tokenHash: string, expiresAt: Date) {
  await db.update(qrTokens)
    .set({ status: "rotated", revokedAt: new Date() })
    .where(and(eq(qrTokens.personId, personId), eq(qrTokens.status, "active")));

  const [versionRow] = await db.select({ value: max(qrTokens.tokenVersion) })
    .from(qrTokens)
    .where(eq(qrTokens.personId, personId));

  const [row] = await db.insert(qrTokens).values({
    personId,
    tokenHash,
    expiresAt,
    tokenVersion: Number(versionRow?.value ?? 0) + 1
  }).returning();

  return row!;
}

export function getCurrentPortalTemporaryDailyQr(personId: string, operationalDate: string) {
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
  })
    .from(temporaryDailyQrTokens)
    .where(and(
      eq(temporaryDailyQrTokens.personId, personId),
      eq(temporaryDailyQrTokens.operationalDate, operationalDate),
      eq(temporaryDailyQrTokens.status, "active"),
      gt(temporaryDailyQrTokens.validUntil, new Date())
    ))
    .orderBy(desc(temporaryDailyQrTokens.createdAt))
    .limit(1);
}

export function listPortalTemporaryDailyQrHistory(personId: string) {
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
  })
    .from(temporaryDailyQrTokens)
    .where(eq(temporaryDailyQrTokens.personId, personId))
    .orderBy(desc(temporaryDailyQrTokens.operationalDate), desc(temporaryDailyQrTokens.createdAt))
    .limit(20);
}

export async function createPortalTemporaryDailyQr(input: typeof temporaryDailyQrTokens.$inferInsert) {
  const [row] = await db.insert(temporaryDailyQrTokens).values(input).returning();
  return row!;
}

export async function createUserDevice(input: typeof userDeviceKeys.$inferInsert) {
  const [row] = await db.insert(userDeviceKeys).values(input).returning({
    id: userDeviceKeys.id,
    accountId: userDeviceKeys.accountId,
    algorithm: userDeviceKeys.algorithm,
    label: userDeviceKeys.label,
    status: userDeviceKeys.status,
    createdAt: userDeviceKeys.createdAt
  });

  return row!;
}

export function listUserDevices(accountId: string) {
  return db.select({
    id: userDeviceKeys.id,
    algorithm: userDeviceKeys.algorithm,
    label: userDeviceKeys.label,
    status: userDeviceKeys.status,
    lastUsedAt: userDeviceKeys.lastUsedAt,
    createdAt: userDeviceKeys.createdAt
  })
    .from(userDeviceKeys)
    .where(eq(userDeviceKeys.accountId, accountId))
    .orderBy(desc(userDeviceKeys.createdAt));
}

export async function revokeUserDevice(accountId: string, deviceId: string) {
  const [row] = await db.update(userDeviceKeys)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(userDeviceKeys.accountId, accountId), eq(userDeviceKeys.id, deviceId)))
    .returning({
      id: userDeviceKeys.id,
      accountId: userDeviceKeys.accountId,
      status: userDeviceKeys.status,
      revokedAt: userDeviceKeys.revokedAt
    });

  return row;
}

export async function createUserDeviceChallenge(input: {
  accountId: string;
  deviceId: string;
  challenge: string;
  expiresAt: Date;
}) {
  const [row] = await db.execute<{
    id: string;
    challenge: string;
    expires_at: Date;
  }>(sql`
    INSERT INTO user_device_challenges (account_id, device_id, challenge, expires_at)
    SELECT ${input.accountId}, ${input.deviceId}, ${input.challenge}, ${input.expiresAt}
    FROM user_device_keys
    WHERE id = ${input.deviceId}
      AND account_id = ${input.accountId}
      AND status = 'active'
    RETURNING id, challenge, expires_at
  `);

  if (!row) return null;

  return {
    id: row.id,
    challenge: row.challenge,
    expiresAt: row.expires_at
  };
}

export async function consumeUserDeviceChallenge(input: {
  accountId: string;
  deviceId: string;
  challengeId: string;
}) {
  const [row] = await db.execute<{
    challenge_id: string;
    challenge: string;
    public_key_jwk: Record<string, unknown>;
    algorithm: string;
  }>(sql`
    WITH consumed AS (
      UPDATE user_device_challenges c
      SET used_at = now()
      FROM user_device_keys d
      WHERE c.id = ${input.challengeId}
        AND c.device_id = ${input.deviceId}
        AND c.account_id = ${input.accountId}
        AND c.used_at IS NULL
        AND c.expires_at > now()
        AND d.id = c.device_id
        AND d.account_id = c.account_id
        AND d.status = 'active'
      RETURNING c.id, c.challenge, d.public_key_jwk, d.algorithm
    )
    SELECT id as challenge_id, challenge, public_key_jwk, algorithm
    FROM consumed
  `);

  return row;
}

export async function markUserDeviceUsed(deviceId: string) {
  const [row] = await db.update(userDeviceKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(userDeviceKeys.id, deviceId))
    .returning();

  return row;
}
