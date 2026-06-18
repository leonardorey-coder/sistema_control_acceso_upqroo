import { Hono } from "hono";
import { z } from "zod";
import { withoutUndefined } from "../../shared/object";
import { createAdmin, listAdmins, listAdminSessions, listAuditLog, updateAdmin } from "./admin-management.repository";

const adminSchema = z.object({
  username: z.string().trim().min(3).max(80),
  displayName: z.string().trim().min(1).max(160),
  email: z.string().email().optional(),
  passwordHash: z.string().min(20),
  role: z.enum(["admin", "super_admin"]).default("admin"),
  status: z.enum(["active", "disabled"]).default("active"),
  mustChangePassword: z.boolean().default(true)
});

export const adminManagementRoutes = new Hono();

adminManagementRoutes.get("/", async (c) => {
  const rows = await listAdmins();
  return c.json({ data: { rows } });
});

adminManagementRoutes.post("/", async (c) => {
  const row = await createAdmin(adminSchema.parse(await c.req.json()));
  return c.json({ data: row }, 201);
});

adminManagementRoutes.get("/audit", async (c) => {
  const rows = await listAuditLog();
  return c.json({ data: { rows } });
});

adminManagementRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateAdmin(id, withoutUndefined(adminSchema.partial().parse(await c.req.json())));
  return row ? c.json({ data: row }) : c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
});

adminManagementRoutes.post("/:id/reset-password", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const body = z.object({ passwordHash: z.string().min(20) }).parse(await c.req.json());
  const row = await updateAdmin(id, { passwordHash: body.passwordHash, mustChangePassword: true });
  return row ? c.json({ data: row }) : c.json({ error: { code: "ADMIN_NOT_FOUND" } }, 404);
});

adminManagementRoutes.get("/:id/sessions", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const rows = await listAdminSessions(id);
  return c.json({ data: { rows } });
});
