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
  createUserSession,
  findUserAccountForLogin,
  getActivePortalQr,
  getUserSessionByHash,
  listPortalAccess,
  listPortalAttendance,
  revokeUserSession,
  rotatePortalQr,
  touchUserSession
} from "./user-portal.repository";

const loginSchema = z.object({
  identity: z.string().trim().email(),
  password: z.string().min(1)
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
