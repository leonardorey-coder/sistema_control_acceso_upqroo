import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import { z } from "zod";
import { env } from "../../config/env";
import { recordAudit } from "../../shared/audit";
import { HttpError } from "../../shared/http-error";
import { withoutUndefined } from "../../shared/object";
import { assertLoginNotRateLimited, clearLoginFailures, recordLoginFailure } from "../../shared/rate-limit";
import { hashSessionToken, issueSessionToken } from "../../shared/security";
import {
  createAdminClient,
  createAdminClientChallenge,
  createAdminSession,
  findAdminForLogin,
  getAdminCredentialsById,
  getSessionByHash,
  listAdminClients,
  revokeAdminClient,
  revokeOtherAdminSessions,
  revokeSession,
  touchSession,
  updateAdminLastLogin,
  updateAdminPassword
} from "./auth.repository";
import { adminClientAuthRequired, buildAdminClientLoginMessage, verifyAdminClientProof } from "./admin-clients.service";

const loginMinimumDurationMs = 450;
const loginDurationJitterMs = 120;
const dummyPasswordHash = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8B6qJkbqN.zZCfR8nSNu4eLTl0yT/e";

const loginSchema = z.object({
  identity: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(128),
  adminClientId: z.string().uuid().optional(),
  adminClientChallengeId: z.string().uuid().optional(),
  adminClientSignature: z.string().trim().min(1).optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
});

const publicJwkSchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().min(1),
  y: z.string().min(1),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional()
}).passthrough();

const adminClientRegisterSchema = z.object({
  publicKeyJwk: publicJwkSchema,
  label: z.string().trim().min(1).max(160).optional()
}).strict();

const adminClientChallengeSchema = z.object({
  adminClientId: z.string().uuid()
}).strict();

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

async function requireCurrentSuperAdminSession(c: Context) {
  const current = await requireCurrentSession(c);
  if (current.session.role !== "super_admin") {
    throw new HttpError(403, "SUPER_ADMIN_REQUIRED", "A super administrator session is required.");
  }
  return current;
}

export const authRoutes = new Hono();

authRoutes.post("/admin-clients/challenge", async (c) => {
  const input = adminClientChallengeSchema.parse(await c.req.json().catch(() => ({})));
  const challenge = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60);
  const row = await createAdminClientChallenge({
    clientId: input.adminClientId,
    challenge,
    expiresAt
  });

  if (!row) {
    throw new HttpError(404, "ADMIN_CLIENT_NOT_FOUND", "The administrative browser is not authorized.");
  }

  return c.json({
    data: {
      id: row.id,
      challenge: row.challenge,
      expiresAt: row.expiresAt,
      message: buildAdminClientLoginMessage({
        adminId: row.adminId,
        adminClientId: input.adminClientId,
        challenge: row.challenge
      })
    }
  }, 201);
});

authRoutes.get("/admin-clients", async (c) => {
  await requireCurrentSuperAdminSession(c);
  const rows = await listAdminClients();
  return c.json({ data: { rows } });
});

authRoutes.post("/admin-clients", async (c) => {
  const { session } = await requireCurrentSuperAdminSession(c);
  const input = adminClientRegisterSchema.parse(await c.req.json().catch(() => ({})));
  const row = await createAdminClient({
    adminId: session.adminId,
    publicKeyJwk: input.publicKeyJwk,
    algorithm: "ES256",
    label: input.label
  });

  if (!row) {
    throw new HttpError(500, "ADMIN_CLIENT_CREATE_FAILED", "Could not authorize administrative browser.");
  }

  await recordAudit({
    actorAdminId: session.adminId,
    action: "admin_client.authorized",
    entityType: "admin_client",
    entityId: row.id,
    ipAddress: clientIp(c),
    userAgent: c.req.header("user-agent") ?? undefined,
    metadata: { label: row.label, algorithm: row.algorithm }
  });

  return c.json({
    data: {
      client: {
        id: row.id,
        adminId: row.adminId,
        label: row.label,
        algorithm: row.algorithm,
        status: row.status,
        lastUsedAt: row.lastUsedAt,
        createdAt: row.createdAt
      }
    }
  }, 201);
});

authRoutes.delete("/admin-clients/:id", async (c) => {
  const { session } = await requireCurrentSuperAdminSession(c);
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await revokeAdminClient(id);

  if (!row) {
    throw new HttpError(404, "ADMIN_CLIENT_NOT_FOUND", "The administrative browser was not found.");
  }

  await recordAudit({
    actorAdminId: session.adminId,
    action: "admin_client.revoked",
    entityType: "admin_client",
    entityId: row.id,
    ipAddress: clientIp(c),
    userAgent: c.req.header("user-agent") ?? undefined,
    metadata: { adminId: row.adminId, status: row.status }
  });

  return c.json({ data: { ok: true } });
});

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

    if (await adminClientAuthRequired(admin.role)) {
      try {
        await verifyAdminClientProof({
          adminId: admin.id,
          role: admin.role,
          ...withoutUndefined({
            adminClientId: input.adminClientId,
            adminClientChallengeId: input.adminClientChallengeId,
            adminClientSignature: input.adminClientSignature
          })
        });
      } catch (error) {
        const failure = await recordLoginFailure(rateLimitKey);
        await recordAudit({
          actorAdminId: admin.id,
          action: "admin.login_failed",
          entityType: "admin_session",
          ipAddress,
          userAgent,
          metadata: {
            identity: input.identity,
            reason: error instanceof HttpError ? error.code : "ADMIN_CLIENT_INVALID",
            attempts: failure.count,
            remainingAttempts: failure.remaining,
            lockedUntil: failure.lockedUntil?.toISOString()
          }
        });
        throw error;
      }
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
