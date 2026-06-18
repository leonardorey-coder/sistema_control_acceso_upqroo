import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http-error";
import { hashSessionToken, issueSessionToken } from "../../shared/security";
import {
  createAdminSession,
  findAdminForLogin,
  getSessionByHash,
  revokeSession,
  touchSession
} from "./auth.repository";

const loginSchema = z.object({
  identity: z.string().trim().min(3),
  password: z.string().min(1)
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
  const admin = await findAdminForLogin(input.identity);

  if (!admin || admin.status !== "active") {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  const passwordOk = await Bun.password.verify(input.password, admin.passwordHash);

  if (!passwordOk) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  const token = issueSessionToken();
  const sessionHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

  await createAdminSession({
    adminId: admin.id,
    sessionHash,
    ipAddress: c.req.header("x-forwarded-for") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined,
    expiresAt
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
    await revokeSession(hashSessionToken(token));
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
