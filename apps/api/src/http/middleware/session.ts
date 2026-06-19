import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import { env } from "../../config/env";
import { getSessionByHash } from "../../modules/auth/auth.repository";
import { HttpError } from "../../shared/http-error";
import { hashSessionToken } from "../../shared/security";

export type AdminSessionContext = NonNullable<Awaited<ReturnType<typeof getSessionByHash>>>;

export async function resolveAdminSession(c: Parameters<MiddlewareHandler>[0]) {
  const sessionToken = getCookie(c, env.SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw new HttpError(401, "SESSION_REQUIRED", "A valid session is required.");
  }

  const sessionHash = hashSessionToken(sessionToken);
  const session = await getSessionByHash(sessionHash);

  if (!session) {
    throw new HttpError(401, "SESSION_INVALID", "The session is invalid or expired.");
  }

  c.set("sessionToken", sessionToken);
  c.set("sessionHash", sessionHash);
  c.set("adminSession", session);

  return session;
}

export const requireAdminSession: MiddlewareHandler = async (c, next) => {
  await resolveAdminSession(c);
  await next();
};

export function requireAdminRole(role: "admin" | "super_admin"): MiddlewareHandler {
  return async (c, next) => {
    const session = await resolveAdminSession(c);

    if (role === "super_admin" && session.role !== "super_admin") {
      throw new HttpError(403, "SUPER_ADMIN_REQUIRED", "A super administrator session is required.");
    }

    await next();
  };
}

export const requireSession = requireAdminSession;

export function getAdminSession(c: Parameters<MiddlewareHandler>[0]) {
  const session = c.get("adminSession") as AdminSessionContext | undefined;

  if (!session) {
    throw new HttpError(401, "SESSION_REQUIRED", "A valid session is required.");
  }

  return session;
}

export function getActorMetadata(c: Parameters<MiddlewareHandler>[0]) {
  const session = c.get("adminSession") as AdminSessionContext | undefined;

  return {
    actorAdminId: session?.adminId,
    ipAddress: c.req.header("x-forwarded-for") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined
  };
}
