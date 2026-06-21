import { db } from "../db/client";
import { auditLog } from "../db/schema";

export type AuditEvent = {
  actorAdminId?: string | undefined;
  actorAccountId?: string | undefined;
  action: string;
  entityType: string;
  entityId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(event: AuditEvent) {
  try {
    await db.insert(auditLog).values({
      actorAdminId: event.actorAdminId,
      actorAccountId: event.actorAccountId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: event.metadata ?? {}
    });
  } catch (error) {
    console.error("Audit write failed", error);
  }
}
