import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import { db } from "../../db/client";
import { administradores, adminSessions } from "../../db/schema";

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
