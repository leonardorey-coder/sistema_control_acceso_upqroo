import { and, desc, eq, gt, isNull, max } from "drizzle-orm";
import { db } from "../../db/client";
import {
  asistenciasPotenciales,
  personas,
  qrTokens,
  registrosAcceso,
  userAccounts,
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
