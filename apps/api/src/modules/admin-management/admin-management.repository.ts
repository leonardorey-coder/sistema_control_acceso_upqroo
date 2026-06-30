import { and, asc, count, desc, eq, gte, ilike, isNull, lte, ne, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { administradores, adminSessions, auditLog } from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

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

export type AuditLogFilters = {
  adminId?: string;
  action?: string;
  entityType?: string;
  q?: string;
  from?: Date;
  to?: Date;
};

export async function listAuditLog(filters: AuditLogFilters = {}, pagination?: Pagination) {
  const predicates: SQL[] = [];

  if (filters.adminId) {
    predicates.push(eq(auditLog.actorAdminId, filters.adminId));
  }

  if (filters.action) {
    predicates.push(ilike(auditLog.action, `%${filters.action}%`));
  }

  if (filters.entityType) {
    predicates.push(eq(auditLog.entityType, filters.entityType));
  }

  if (filters.q) {
    predicates.push(or(
      ilike(auditLog.action, `%${filters.q}%`),
      ilike(auditLog.entityType, `%${filters.q}%`)
    )!);
  }

  if (filters.from) {
    predicates.push(gte(auditLog.createdAt, filters.from));
  }

  if (filters.to) {
    predicates.push(lte(auditLog.createdAt, filters.to));
  }

  const where = predicates.length ? and(...predicates) : undefined;
  const rowsQuery = db.select().from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt));

  const [rows, totalRows] = await Promise.all([
    pagination ? rowsQuery.limit(pagination.pageSize).offset(pagination.offset) : rowsQuery.limit(100),
    db.select({ total: count() }).from(auditLog).where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}
