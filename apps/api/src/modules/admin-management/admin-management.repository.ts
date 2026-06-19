import { and, asc, count, desc, eq, isNull, ne, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { administradores, adminSessions, auditLog } from "../../db/schema";

const adminPublicColumns = {
  id: administradores.id,
  username: administradores.username,
  displayName: administradores.displayName,
  email: administradores.email,
  role: administradores.role,
  status: administradores.status,
  mustChangePassword: administradores.mustChangePassword,
  lastLoginAt: administradores.lastLoginAt,
  createdAt: administradores.createdAt,
  updatedAt: administradores.updatedAt,
  disabledAt: administradores.disabledAt
};

export function listAdmins() {
  return db.select(adminPublicColumns).from(administradores).orderBy(asc(administradores.displayName));
}

export async function getAdmin(id: string) {
  const [row] = await db.select(adminPublicColumns).from(administradores).where(eq(administradores.id, id)).limit(1);
  return row;
}

export async function createAdmin(input: typeof administradores.$inferInsert) {
  const [row] = await db.insert(administradores).values(input).returning(adminPublicColumns);
  return row!;
}

export async function updateAdmin(id: string, input: Partial<typeof administradores.$inferInsert>) {
  const [row] = await db
    .update(administradores)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(administradores.id, id))
    .returning(adminPublicColumns);

  return row;
}

export async function countActiveSuperAdmins(exceptAdminId?: string) {
  const predicates: SQL[] = [
    eq(administradores.role, "super_admin"),
    eq(administradores.status, "active")
  ];

  if (exceptAdminId) {
    predicates.push(ne(administradores.id, exceptAdminId));
  }

  const [row] = await db
    .select({ total: count() })
    .from(administradores)
    .where(and(...predicates));

  return row?.total ?? 0;
}

export async function revokeAdminSessions(adminId: string) {
  return db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminSessions.adminId, adminId), isNull(adminSessions.revokedAt)))
    .returning();
}

export function listAdminSessions(adminId?: string) {
  return db.select({
    id: adminSessions.id,
    adminId: adminSessions.adminId,
    ipAddress: adminSessions.ipAddress,
    userAgent: adminSessions.userAgent,
    expiresAt: adminSessions.expiresAt,
    revokedAt: adminSessions.revokedAt,
    lastUsedAt: adminSessions.lastUsedAt,
    createdAt: adminSessions.createdAt
  }).from(adminSessions)
    .where(adminId ? eq(adminSessions.adminId, adminId) : undefined)
    .orderBy(desc(adminSessions.createdAt))
    .limit(100);
}

export async function revokeAdminSession(adminId: string, sessionId: string) {
  const [row] = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminSessions.adminId, adminId), eq(adminSessions.id, sessionId)))
    .returning();

  return row;
}

export function listAuditLog(adminId?: string) {
  return db.select().from(auditLog)
    .where(adminId ? eq(auditLog.actorAdminId, adminId) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(100);
}
