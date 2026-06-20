import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { env } from "../../config/env";
import { recordAudit } from "../../shared/audit";
import { HttpError } from "../../shared/http-error";
import { hashSessionToken, issueOpaqueToken, issueSessionToken } from "../../shared/security";
import { stripSecretFields } from "../../shared/sanitize";
import {
  createPortalTemporaryDailyQr,
  createUserSession,
  findUserAccountForLogin,
  getActivePortalQr,
  getCurrentPortalTemporaryDailyQr,
  getUserSessionByHash,
  listPortalAccess,
  listPortalAttendance,
  listPortalTemporaryDailyQrHistory,
  revokeUserSession,
  rotatePortalQr,
  touchUserSession
} from "./user-portal.repository";

const loginSchema = z.object({
  identity: z.string().trim().email(),
  password: z.string().min(1)
});

const temporaryDailyRequestSchema = z.object({
  missingCredentialType: z.string().trim().min(1).max(80).default("personal_qr"),
  reasonCode: z.string().trim().min(1).max(80).default("credential_unavailable"),
  reasonText: z.string().trim().max(500).optional(),
  maxUses: z.number().int().min(1).max(10).default(1),
  validUntil: z.coerce.date().optional()
});

function userSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
    expires
  };
}

function publicPortalSession(row: NonNullable<Awaited<ReturnType<typeof getUserSessionByHash>>>) {
  return {
    user: {
      accountId: row.accountId,
      personId: row.personId,
      email: row.email,
      matricula: row.matricula,
      fullName: `${row.nombres} ${row.apellidos}`.trim(),
      personType: row.tipoPersona,
      status: row.estado,
      mustChangePassword: row.mustChangePassword
    },
    expiresAt: row.expiresAt
  };
}

async function requirePortalSession(c: Context) {
  const token = getCookie(c, env.USER_SESSION_COOKIE_NAME);

  if (!token) {
    throw new HttpError(401, "USER_SESSION_REQUIRED", "A valid user session is required.");
  }

  const sessionHash = hashSessionToken(token);
  const session = await getUserSessionByHash(sessionHash);

  if (!session) {
    throw new HttpError(401, "USER_SESSION_INVALID", "The user session is invalid or expired.");
  }

  return { token, sessionHash, session };
}

export const userPortalRoutes = new Hono();

function operationalDateToday() {
  return new Date().toISOString().slice(0, 10);
}

userPortalRoutes.post("/auth/login", async (c) => {
  const input = loginSchema.parse(await c.req.json());
  const account = await findUserAccountForLogin(input.identity);

  if (!account || account.status !== "active" || account.estado !== "activo") {
    await recordAudit({
      action: "user.login_failed",
      entityType: "user_session",
      ipAddress: c.req.header("x-forwarded-for") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
      metadata: { identity: input.identity, reason: "not_found_or_disabled" }
    });
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  const passwordOk = await Bun.password.verify(input.password, account.passwordHash);

  if (!passwordOk) {
    await recordAudit({
      actorAccountId: account.id,
      action: "user.login_failed",
      entityType: "user_session",
      ipAddress: c.req.header("x-forwarded-for") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
      metadata: { identity: input.identity, reason: "bad_password" }
    });
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  const token = issueSessionToken();
  const sessionHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

  await createUserSession({
    accountId: account.id,
    sessionHash,
    ipAddress: c.req.header("x-forwarded-for") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined,
    expiresAt
  });

  setCookie(c, env.USER_SESSION_COOKIE_NAME, token, userSessionCookieOptions(expiresAt));

  await recordAudit({
    actorAccountId: account.id,
    action: "user.login_success",
    entityType: "user_session",
    ipAddress: c.req.header("x-forwarded-for") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined
  });

  return c.json({
    data: {
      user: {
        accountId: account.id,
        personId: account.personId,
        email: account.email,
        matricula: account.matricula,
        fullName: `${account.nombres} ${account.apellidos}`.trim(),
        personType: account.tipoPersona,
        status: account.estado,
        mustChangePassword: account.mustChangePassword
      },
      expiresAt
    }
  });
});

userPortalRoutes.post("/auth/logout", async (c) => {
  const token = getCookie(c, env.USER_SESSION_COOKIE_NAME);

  if (token) {
    await revokeUserSession(hashSessionToken(token));
  }

  deleteCookie(c, env.USER_SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ data: { ok: true } });
});

userPortalRoutes.get("/me", async (c) => {
  const { sessionHash, session } = await requirePortalSession(c);
  await touchUserSession(sessionHash);
  return c.json({ data: publicPortalSession(session) });
});

userPortalRoutes.get("/qr", async (c) => {
  const { session } = await requirePortalSession(c);
  const [credential] = await getActivePortalQr(session.personId);
  return c.json({ data: { credential: credential ?? null } });
});

userPortalRoutes.post("/qr/rotate", async (c) => {
  const { session } = await requirePortalSession(c);
  const issued = issueOpaqueToken("person_qr");
  const row = await rotatePortalQr(
    session.personId,
    issued.tokenHash,
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  );

  await recordAudit({
    actorAccountId: session.accountId,
    action: "user.portal_qr_rotated",
    entityType: "qr_token",
    entityId: row.id,
    metadata: { personId: session.personId }
  });

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

userPortalRoutes.get("/access/recent", async (c) => {
  const { session } = await requirePortalSession(c);
  const rows = await listPortalAccess(session.personId);
  return c.json({ data: { rows } });
});

userPortalRoutes.get("/attendance/recent", async (c) => {
  const { session } = await requirePortalSession(c);
  const rows = await listPortalAttendance(session.personId);
  return c.json({ data: { rows } });
});

userPortalRoutes.get("/temporary-daily-qr/current", async (c) => {
  const { session } = await requirePortalSession(c);
  const [credential] = await getCurrentPortalTemporaryDailyQr(session.personId, operationalDateToday());
  return c.json({ data: { credential: credential ?? null } });
});

userPortalRoutes.post("/temporary-daily-qr/request", async (c) => {
  const { session } = await requirePortalSession(c);
  const input = temporaryDailyRequestSchema.parse(await c.req.json().catch(() => ({})));
  const issued = issueOpaqueToken("temporary_daily_qr");
  const operationalDate = operationalDateToday();
  const validUntil = input.validUntil ?? new Date(Date.now() + 1000 * 60 * 60 * 8);
  const row = await createPortalTemporaryDailyQr({
    personId: session.personId,
    tokenHash: issued.tokenHash,
    operationalDate,
    missingCredentialType: input.missingCredentialType,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    maxUses: input.maxUses,
    validUntil
  });

  await recordAudit({
    actorAccountId: session.accountId,
    action: "user.temporary_daily_qr_requested",
    entityType: "temporary_daily_qr",
    entityId: row.id,
    metadata: { personId: session.personId, operationalDate }
  });

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

userPortalRoutes.get("/temporary-daily-qr/history", async (c) => {
  const { session } = await requirePortalSession(c);
  const rows = await listPortalTemporaryDailyQrHistory(session.personId);
  return c.json({ data: { rows } });
});
