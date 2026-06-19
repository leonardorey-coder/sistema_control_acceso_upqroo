import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { administradores, hotQrTokens } from "../../db/schema";
import type { Pagination } from "../../shared/pagination";

export type HotQrFilters = {
  q?: string;
  status?: "active" | "used" | "expired" | "revoked" | "disabled";
  creatorId?: string;
  from: Date;
  to: Date;
};

function buildHotQrWhere(filters: HotQrFilters) {
  const where: SQL[] = [
    gte(hotQrTokens.createdAt, filters.from),
    lte(hotQrTokens.createdAt, filters.to)
  ];

  if (filters.q) {
    const q = `%${filters.q}%`;
    where.push(or(
      ilike(hotQrTokens.visitorName, q),
      ilike(hotQrTokens.reason, q),
      ilike(administradores.displayName, q)
    )!);
  }

  if (filters.status) {
    where.push(eq(hotQrTokens.status, filters.status));
  }

  if (filters.creatorId) {
    where.push(eq(hotQrTokens.createdByAdminId, filters.creatorId));
  }

  return and(...where);
}

export async function listHotQrToday(filters: HotQrFilters, pagination: Pagination) {
  const where = buildHotQrWhere(filters);

  const [rows, totalRows] = await Promise.all([
    db.select({
      id: hotQrTokens.id,
      visitorName: hotQrTokens.visitorName,
      reason: hotQrTokens.reason,
      status: hotQrTokens.status,
      maxUses: hotQrTokens.maxUses,
      useCount: hotQrTokens.useCount,
      validFrom: hotQrTokens.validFrom,
      validUntil: hotQrTokens.validUntil,
      creator: administradores.displayName,
      usedAt: hotQrTokens.usedAt,
      revokedAt: hotQrTokens.revokedAt,
      createdAt: hotQrTokens.createdAt
    })
      .from(hotQrTokens)
      .leftJoin(administradores, eq(hotQrTokens.createdByAdminId, administradores.id))
      .where(where)
      .orderBy(desc(hotQrTokens.createdAt))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select({ total: count() })
      .from(hotQrTokens)
      .leftJoin(administradores, eq(hotQrTokens.createdByAdminId, administradores.id))
      .where(where)
  ]);

  return {
    rows,
    total: totalRows[0]?.total ?? 0
  };
}

export async function createHotQr(input: typeof hotQrTokens.$inferInsert) {
  const [row] = await db.insert(hotQrTokens).values(input).returning();
  return row!;
}

export async function revokeHotQr(id: string) {
  const [row] = await db
    .update(hotQrTokens)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(hotQrTokens.id, id))
    .returning();

  return row;
}
