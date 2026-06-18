import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http-error";

export const requireSession: MiddlewareHandler = async (c, next) => {
  const sessionToken = getCookie(c, env.SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw new HttpError(401, "SESSION_REQUIRED", "A valid session is required.");
  }

  c.set("sessionToken", sessionToken);
  await next();
};
