import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { withoutUndefined } from "../../shared/object";
import { issueTemporaryPassword } from "../../shared/security";
import {
  countActiveSuperAdmins,
  createAdmin,
  getAdmin,
  listAdmins,
  listAdminSessions,
  listAuditLog,
  revokeAdminSession,
  revokeAdminSessions,
  updateAdmin
} from "./admin-management.repository";

const adminCreateSchema = z.object({
  username: z.string().trim().min(3).max(80),
  displayName: z.string().trim().min(1).max(160),
  email: z.string().email().optional(),
  temporaryPassword: z.string().min(8).optional(),
  role: z.enum(["admin", "super_admin"]).default("admin"),
  status: z.enum(["active", "disabled"]).default("active"),
  mustChangePassword: z.boolean().default(true)
});

const adminPatchSchema = z.object({
  username: z.string().trim().min(3).max(80).optional(),
  displayName: z.string().trim().min(1).max(160).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "super_admin"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  mustChangePassword: z.boolean().optional()
});

export const adminManagementRoutes = new Hono();

adminManagementRoutes.get("/", async (c) => {
  const rows = await listAdmins();
  return c.json({ data: { rows } });
});

adminManagementRoutes.post("/", async (c) => {
  const input = adminCreateSchema.parse(await c.req.json());
  const temporaryPassword = input.temporaryPassword ?? issueTemporaryPassword();
  const passwordHash = await Bun.password.hash(temporaryPassword, {
    algorithm: "bcrypt",
    cost: 10
  });

  const row = await createAdmin({
    username: input.username,
    displayName: input.displayName,
    email: input.email,
    role: input.role,
    status: input.status,
    mustChangePassword: input.mustChangePassword,
    passwordHash
  });

  const actor = getActorMetadata(c);
  await recordAudit({
    ...actor,
    action: "admin.created",
    entityType: "admin",
    entityId: row.id,
    metadata: { username: row.username, role: row.role }
  });

  return c.json({ data: { ...row, temporaryPassword } }, 201);
});

adminManagementRoutes.get("/audit", async (c) => {
  const rows = await listAuditLog();
  return c.json({ data: { rows } });
});

adminManagementRoutes.get("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await getAdmin(id);
  return row ? c.json({ data: row }) : c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
});

adminManagementRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const input = withoutUndefined(adminPatchSchema.parse(await c.req.json()));
  const current = await getAdmin(id);

  if (!current) {
    return c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
  }

  if (
    current.role === "super_admin" &&
    current.status === "active" &&
    (input.role === "admin" || input.status === "disabled") &&
    await countActiveSuperAdmins(id) === 0
  ) {
    return c.json({ error: { code: "LAST_SUPER_ADMIN_PROTECTED" } }, 409);
  }

  const row = await updateAdmin(id, input);
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "admin.updated",
      entityType: "admin",
      entityId: id,
      metadata: { changed: Object.keys(input) }
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
});

adminManagementRoutes.post("/:id/disable", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const current = await getAdmin(id);

  if (!current) {
    return c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
  }

  if (
    current.role === "super_admin" &&
    current.status === "active" &&
    await countActiveSuperAdmins(id) === 0
  ) {
    return c.json({ error: { code: "LAST_SUPER_ADMIN_PROTECTED" } }, 409);
  }

  const row = await updateAdmin(id, { status: "disabled", disabledAt: new Date() });
  await revokeAdminSessions(id);
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "admin.disabled",
      entityType: "admin",
      entityId: id
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
});

adminManagementRoutes.post("/:id/enable", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateAdmin(id, { status: "active", disabledAt: null });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "admin.enabled",
      entityType: "admin",
      entityId: id
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
});

adminManagementRoutes.post("/:id/reset-password", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const body = z.object({ temporaryPassword: z.string().min(8).optional() }).parse(await c.req.json().catch(() => ({})));
  const temporaryPassword = body.temporaryPassword ?? issueTemporaryPassword();
  const passwordHash = await Bun.password.hash(temporaryPassword, {
    algorithm: "bcrypt",
    cost: 10
  });
  const row = await updateAdmin(id, { passwordHash, mustChangePassword: true });
  await revokeAdminSessions(id);
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "admin.password_reset",
      entityType: "admin",
      entityId: id
    });
  }
  return row ? c.json({ data: { ...row, temporaryPassword } }) : c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
});

adminManagementRoutes.get("/:id/sessions", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const rows = await listAdminSessions(id);
  return c.json({ data: { rows } });
});

adminManagementRoutes.post("/:id/sessions/:sessionId/revoke", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const sessionId = z.string().uuid().parse(c.req.param("sessionId"));
  const row = await revokeAdminSession(id, sessionId);
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "admin.session_revoked",
      entityType: "admin_session",
      entityId: sessionId,
      metadata: { adminId: id }
    });
  }
  return row ? c.json({ data: { ok: true } }) : c.json({ error: { code: "SESSION_NOT_FOUND" } }, 404);
});

adminManagementRoutes.get("/:id/audit", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const rows = await listAuditLog(id);
  return c.json({ data: { rows } });
});
