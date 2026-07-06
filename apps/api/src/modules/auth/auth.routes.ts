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
  updateAdminLastLogin,
  updateAdminPassword
} from "./auth.repository";

const loginMinimumDurationMs = 450;
const loginDurationJitterMs = 120;
const dummyPasswordHash = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8B6qJkbqN.zZCfR8nSNu4eLTl0yT/e";

const loginSchema = z.object({
  identity: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(128)
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
    sessionId: row.sessionId,
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

function clientIp(c: Context) {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")
    || undefined;
}

async function waitForLoginBuffer(startedAt: number) {
  const target = loginMinimumDurationMs + Math.floor(Math.random() * loginDurationJitterMs);
  const elapsed = performance.now() - startedAt;
  if (elapsed < target) {
    await new Promise((resolve) => setTimeout(resolve, target - elapsed));
  }
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
  const startedAt = performance.now();

  try {
    const ipAddress = clientIp(c);
    const userAgent = c.req.header("user-agent") ?? undefined;
    let rateLimitKey: string;
    try {
      rateLimitKey = await assertLoginNotRateLimited("admin", input.identity, ipAddress);
    } catch (error) {
      await recordAudit({
        action: "admin.login_failed",
        entityType: "admin_session",
        ipAddress,
        userAgent,
        metadata: { identity: input.identity, reason: "rate_limited" }
      });
      throw error;
    }
    const admin = await findAdminForLogin(input.identity);
    const passwordHash = admin?.passwordHash ?? dummyPasswordHash;
    const passwordOk = await Bun.password.verify(input.password, passwordHash);

    if (!admin || admin.status !== "active" || !passwordOk) {
      const failure = await recordLoginFailure(rateLimitKey);
      await recordAudit({
        actorAdminId: admin?.id,
        action: "admin.login_failed",
        entityType: "admin_session",
        ipAddress,
        userAgent,
        metadata: {
          identity: input.identity,
          reason: !admin || admin.status !== "active" ? "not_found_or_disabled" : "bad_password",
          attempts: failure.count,
          remainingAttempts: failure.remaining,
          lockedUntil: failure.lockedUntil?.toISOString()
        }
      });
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.", {
        attempts: failure.count,
        remainingAttempts: failure.remaining
      });
    }

    await clearLoginFailures(rateLimitKey);

    const token = issueSessionToken();
    const sessionHash = hashSessionToken(token);
    const loggedInAt = new Date();
    const expiresAt = new Date(loggedInAt.getTime() + 1000 * 60 * 60 * 12);

    const adminSession = await createAdminSession({
      adminId: admin.id,
      sessionHash,
      ipAddress,
      userAgent,
      expiresAt
    });
    if (!adminSession) {
      throw new HttpError(500, "SESSION_CREATE_FAILED", "Could not create admin session.");
    }
    await updateAdminLastLogin(admin.id, loggedInAt);

    await recordAudit({
      actorAdminId: admin.id,
      action: "admin.login_success",
      entityType: "admin_session",
      ipAddress,
      userAgent,
      metadata: { username: admin.username, attemptsReset: true }
    });

    setCookie(c, env.SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
    const response = c.json({
      data: {
        sessionId: adminSession.id,
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
    await waitForLoginBuffer(startedAt);
    return response;
  } catch (error) {
    await waitForLoginBuffer(startedAt);
    throw error;
  }
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
      ipAddress: clientIp(c),
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
      ipAddress: clientIp(c),
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
    ipAddress: clientIp(c),
    userAgent: c.req.header("user-agent") ?? undefined
  });

  return c.json({ data: { ok: true } });
});
