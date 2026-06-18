import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { administradores, adminSessions, auditLog } from "../../db/schema";

export function listAdmins() {
  return db.select({
    id: administradores.id,
    username: administradores.username,
    displayName: administradores.displayName,
    email: administradores.email,
    role: administradores.role,
    status: administradores.status,
    mustChangePassword: administradores.mustChangePassword,
    lastLoginAt: administradores.lastLoginAt,
    createdAt: administradores.createdAt,
    updatedAt: administradores.updatedAt
  }).from(administradores).orderBy(asc(administradores.displayName));
}

export async function createAdmin(input: typeof administradores.$inferInsert) {
  const [row] = await db.insert(administradores).values(input).returning();
  return row;
}

export async function updateAdmin(id: string, input: Partial<typeof administradores.$inferInsert>) {
  const [row] = await db.update(administradores).set({ ...input, updatedAt: new Date() }).where(eq(administradores.id, id)).returning();
  return row;
}

export function listAdminSessions(adminId?: string) {
  return db.select().from(adminSessions)
    .where(adminId ? eq(adminSessions.adminId, adminId) : undefined)
    .orderBy(asc(adminSessions.expiresAt))
    .limit(100);
}

export function listAuditLog() {
  return db.select().from(auditLog).orderBy(asc(auditLog.createdAt)).limit(100);
}
