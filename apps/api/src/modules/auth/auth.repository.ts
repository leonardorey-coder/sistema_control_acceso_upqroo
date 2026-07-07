import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { administradores, adminClientChallenges, adminClientKeys, adminSessions } from "../../db/schema";

export function findAdminForLogin(identity: string) {
  return db.query.administradores.findFirst({
    where: or(
      eq(administradores.username, identity),
      eq(administradores.email, identity)
    )
  });
}

export async function createAdminSession(input: typeof adminSessions.$inferInsert) {
  const [row] = await db.insert(adminSessions).values(input).returning();
  return row;
}

export async function updateAdminLastLogin(id: string, lastLoginAt: Date) {
  const [row] = await db
    .update(administradores)
    .set({ lastLoginAt, updatedAt: lastLoginAt })
    .where(eq(administradores.id, id))
    .returning();

  return row;
}

export function getAdminCredentialsById(id: string) {
  return db.query.administradores.findFirst({
    where: eq(administradores.id, id)
  });
}

export async function updateAdminPassword(id: string, passwordHash: string) {
  const [row] = await db
    .update(administradores)
    .set({
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date()
    })
    .where(eq(administradores.id, id))
    .returning();

  return row;
}

export async function revokeOtherAdminSessions(adminId: string, currentSessionHash: string) {
  return db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(adminSessions.adminId, adminId),
      ne(adminSessions.sessionHash, currentSessionHash),
      isNull(adminSessions.revokedAt)
    ))
    .returning();
}

export async function getSessionByHash(sessionHash: string) {
  const [row] = await db
    .select({
      sessionId: adminSessions.id,
      adminId: administradores.id,
      username: administradores.username,
      displayName: administradores.displayName,
      email: administradores.email,
      role: administradores.role,
      status: administradores.status,
      mustChangePassword: administradores.mustChangePassword,
      expiresAt: adminSessions.expiresAt
    })
    .from(adminSessions)
    .innerJoin(administradores, eq(adminSessions.adminId, administradores.id))
    .where(and(
      eq(adminSessions.sessionHash, sessionHash),
      isNull(adminSessions.revokedAt),
      eq(administradores.status, "active"),
      gt(adminSessions.expiresAt, new Date())
    ))
    .limit(1);

  return row;
}

export async function touchSession(sessionHash: string) {
  const [row] = await db
    .update(adminSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(adminSessions.sessionHash, sessionHash))
    .returning();

  return row;
}

export async function revokeSession(sessionHash: string) {
  const [row] = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.sessionHash, sessionHash))
    .returning();

  return row;
}

export async function listAdminClients(adminId?: string) {
  return db
    .select({
      id: adminClientKeys.id,
      adminId: adminClientKeys.adminId,
      username: administradores.username,
      displayName: administradores.displayName,
      label: adminClientKeys.label,
      algorithm: adminClientKeys.algorithm,
      status: adminClientKeys.status,
      lastUsedAt: adminClientKeys.lastUsedAt,
      revokedAt: adminClientKeys.revokedAt,
      createdAt: adminClientKeys.createdAt
    })
    .from(adminClientKeys)
    .innerJoin(administradores, eq(adminClientKeys.adminId, administradores.id))
    .where(adminId ? eq(adminClientKeys.adminId, adminId) : undefined);
}

export async function createAdminClient(input: typeof adminClientKeys.$inferInsert) {
  const [row] = await db.insert(adminClientKeys).values(input).returning();
  return row;
}

export async function revokeAdminClient(id: string) {
  const [row] = await db
    .update(adminClientKeys)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(adminClientKeys.id, id))
    .returning();

  return row;
}

export async function createAdminClientChallenge(input: {
  clientId: string;
  challenge: string;
  expiresAt: Date;
}) {
  const [row] = await db.execute<{
    id: string;
    challenge: string;
    expires_at: Date;
    admin_id: string;
  }>(sql`
    INSERT INTO admin_client_challenges (client_id, admin_id, challenge, expires_at)
    SELECT ${input.clientId}, admin_id, ${input.challenge}, ${input.expiresAt.toISOString()}::timestamptz
    FROM admin_client_keys
    WHERE id = ${input.clientId}
      AND status = 'active'
    RETURNING id, challenge, expires_at, admin_id
  `);

  if (!row) return null;

  return {
    id: row.id,
    challenge: row.challenge,
    expiresAt: row.expires_at,
    adminId: row.admin_id
  };
}

export async function consumeAdminClientChallenge(input: {
  clientId: string;
  challengeId: string;
}) {
  const [row] = await db.execute<{
    challenge_id: string;
    challenge: string;
    admin_id: string;
    public_key_jwk: Record<string, unknown>;
    algorithm: string;
  }>(sql`
    WITH consumed AS (
      UPDATE admin_client_challenges c
      SET used_at = now()
      FROM admin_client_keys k
      WHERE c.id = ${input.challengeId}
        AND c.client_id = ${input.clientId}
        AND c.used_at IS NULL
        AND c.expires_at > now()
        AND k.id = c.client_id
        AND k.status = 'active'
      RETURNING c.id, c.challenge, c.admin_id, k.public_key_jwk, k.algorithm
    )
    SELECT id as challenge_id, challenge, admin_id, public_key_jwk, algorithm
    FROM consumed
  `);

  return row ?? null;
}

export async function markAdminClientUsed(clientId: string) {
  const [row] = await db
    .update(adminClientKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(adminClientKeys.id, clientId))
    .returning();

  return row;
}
