import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { env } from "../../config/env";
import { recordAudit } from "../../shared/audit";
import { HttpError } from "../../shared/http-error";
import { assertLoginNotRateLimited, clearLoginFailures, recordLoginFailure } from "../../shared/rate-limit";
import { hashSessionToken, issueSessionToken } from "../../shared/security";
import {
  createAdminSession,
  findAdminForLogin,
  getAdminCredentialsById,
  getSessionByHash,
  revokeOtherAdminSessions,
  revokeSession,
  touchSession,
  updateAdminPassword
} from "./auth.repository";

const loginSchema = z.object({
  identity: z.string().trim().min(3),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
});

function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
    expires
  };
}

function publicSession(row: NonNullable<Awaited<ReturnType<typeof getSessionByHash>>>) {
  return {
    admin: {
      id: row.adminId,
      username: row.username,
      displayName: row.displayName,
      email: row.email,
      role: row.role,
      mustChangePassword: row.mustChangePassword
    },
    expiresAt: row.expiresAt
  };
}

async function requireCurrentSession(c: Context) {
  const token = getCookie(c, env.SESSION_COOKIE_NAME);

  if (!token) {
    throw new HttpError(401, "SESSION_REQUIRED", "A valid session is required.");
  }

  const sessionHash = hashSessionToken(token);
  const session = await getSessionByHash(sessionHash);

  if (!session) {
    throw new HttpError(401, "SESSION_INVALID", "The session is invalid or expired.");
  }

  return { token, sessionHash, session };
}

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  const input = loginSchema.parse(await c.req.json());
  const ipAddress = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? undefined;
  const rateLimitKey = await assertLoginNotRateLimited("admin", input.identity, ipAddress);
  const admin = await findAdminForLogin(input.identity);

  if (!admin || admin.status !== "active") {
    await recordLoginFailure(rateLimitKey);
    await recordAudit({
      action: "admin.login_failed",
      entityType: "admin_session",
      ipAddress,
      userAgent: c.req.header("user-agent") ?? undefined,
      metadata: { identity: input.identity, reason: "not_found_or_disabled" }
    });
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  const passwordOk = await Bun.password.verify(input.password, admin.passwordHash);

  if (!passwordOk) {
    await recordLoginFailure(rateLimitKey);
    await recordAudit({
      actorAdminId: admin.id,
      action: "admin.login_failed",
      entityType: "admin_session",
      ipAddress,
      userAgent: c.req.header("user-agent") ?? undefined,
      metadata: { identity: input.identity, reason: "bad_password" }
    });
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  await clearLoginFailures(rateLimitKey);

  const token = issueSessionToken();
  const sessionHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

  await createAdminSession({
    adminId: admin.id,
    sessionHash,
    ipAddress,
    userAgent: c.req.header("user-agent") ?? undefined,
    expiresAt
  });

  await recordAudit({
    actorAdminId: admin.id,
    action: "admin.login_success",
    entityType: "admin_session",
    ipAddress,
    userAgent: c.req.header("user-agent") ?? undefined,
    metadata: { username: admin.username }
  });

  setCookie(c, env.SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));

  return c.json({
    data: {
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        email: admin.email,
        role: admin.role,
        mustChangePassword: admin.mustChangePassword
      },
      expiresAt
    }
  });
});

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, env.SESSION_COOKIE_NAME);

  if (token) {
    const sessionHash = hashSessionToken(token);
    const session = await getSessionByHash(sessionHash);
    await revokeSession(sessionHash);
    await recordAudit({
      actorAdminId: session?.adminId,
      action: "admin.logout",
      entityType: "admin_session",
      entityId: session?.sessionId,
      ipAddress: c.req.header("x-forwarded-for") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined
    });
  }

  deleteCookie(c, env.SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ data: { ok: true } });
});

authRoutes.get("/me", async (c) => {
  const { session } = await requireCurrentSession(c);
  return c.json({ data: publicSession(session) });
});

authRoutes.post("/refresh", async (c) => {
  const { sessionHash, session } = await requireCurrentSession(c);
  await touchSession(sessionHash);
  return c.json({ data: publicSession(session) });
});

authRoutes.post("/change-password", async (c) => {
  const { sessionHash, session } = await requireCurrentSession(c);
  const input = changePasswordSchema.parse(await c.req.json());
  const admin = await getAdminCredentialsById(session.adminId);

  if (!admin || admin.status !== "active") {
    throw new HttpError(401, "SESSION_INVALID", "The session is invalid or expired.");
  }

  const passwordOk = await Bun.password.verify(input.currentPassword, admin.passwordHash);

  if (!passwordOk) {
    await recordAudit({
      actorAdminId: admin.id,
      action: "admin.change_password_failed",
      entityType: "admin",
      entityId: admin.id,
      ipAddress: c.req.header("x-forwarded-for") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
      metadata: { reason: "bad_current_password" }
    });
    throw new HttpError(401, "INVALID_CURRENT_PASSWORD", "The current password is incorrect.");
  }

  const passwordHash = await Bun.password.hash(input.newPassword, {
    algorithm: "bcrypt",
    cost: 10
  });

  await updateAdminPassword(admin.id, passwordHash);
  await revokeOtherAdminSessions(admin.id, sessionHash);
  await recordAudit({
    actorAdminId: admin.id,
    action: "admin.password_changed",
    entityType: "admin",
    entityId: admin.id,
    ipAddress: c.req.header("x-forwarded-for") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined
  });

  return c.json({ data: { ok: true } });
});
