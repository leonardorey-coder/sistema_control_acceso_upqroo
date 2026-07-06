import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { db } from "../db/client";
import { loginRateLimits } from "../db/schema";
import { HttpError } from "./http-error";
import { sha256Hex } from "./security";

type AttemptState = {
  count: number;
  firstFailedAt: number;
  lockedUntil?: number;
};

export type LoginFailureState = {
  count: number;
  remaining: number;
  lockedUntil?: Date;
};

const attempts = new Map<string, AttemptState>();

const windowMs = 10 * 60 * 1000;
const lockMs = 15 * 60 * 1000;
const maxAttempts = 5;

function now() {
  return Date.now();
}

function buildKey(scope: string, identity: string, ipAddress?: string) {
  return sha256Hex(`${scope}:${identity.toLowerCase()}:${ipAddress ?? "unknown"}`);
}

function throwLocked(lockedUntil: number, current: number) {
  throw new HttpError(429, "LOGIN_TEMPORARILY_LOCKED", "Too many failed login attempts. Try again later.", {
    retryAfterMs: lockedUntil - current,
    maxAttempts,
    remaining: 0,
    lockedUntil: new Date(lockedUntil).toISOString()
  });
}

function assertMemoryLoginNotRateLimited(key: string) {
  const state = attempts.get(key);

  if (!state) return key;

  const current = now();

  if (state.lockedUntil && state.lockedUntil > current) {
    throwLocked(state.lockedUntil, current);
  }

  if (current - state.firstFailedAt > windowMs) {
    attempts.delete(key);
  }

  return key;
}

function recordMemoryLoginFailure(key: string): LoginFailureState {
  const current = now();
  const existing = attempts.get(key);

  if (!existing || current - existing.firstFailedAt > windowMs) {
    attempts.set(key, { count: 1, firstFailedAt: current });
    return { count: 1, remaining: maxAttempts - 1 };
  }

  const count = existing.count + 1;
  const next: AttemptState = {
    count,
    firstFailedAt: existing.firstFailedAt
  };

  if (count >= maxAttempts) {
    next.lockedUntil = current + lockMs;
  } else if (existing.lockedUntil) {
    next.lockedUntil = existing.lockedUntil;
  }

  attempts.set(key, next);
  const failure: LoginFailureState = {
    count,
    remaining: Math.max(maxAttempts - count, 0)
  };
  if (next.lockedUntil) failure.lockedUntil = new Date(next.lockedUntil);
  return failure;
}

function clearMemoryLoginFailures(key: string) {
  attempts.delete(key);
}

async function assertPostgresLoginNotRateLimited(key: string) {
  const [state] = await db
    .select()
    .from(loginRateLimits)
    .where(eq(loginRateLimits.key, key))
    .limit(1);

  if (!state) return key;

  const current = now();
  const lockedUntil = state.lockedUntil?.getTime();

  if (lockedUntil && lockedUntil > current) {
    throwLocked(lockedUntil, current);
  }

  if (current - state.firstFailedAt.getTime() > windowMs) {
    await db.delete(loginRateLimits).where(eq(loginRateLimits.key, key));
  }

  return key;
}

async function recordPostgresLoginFailure(key: string): Promise<LoginFailureState> {
  const current = new Date();
  const [existing] = await db
    .select()
    .from(loginRateLimits)
    .where(eq(loginRateLimits.key, key))
    .limit(1);

  if (!existing || current.getTime() - existing.firstFailedAt.getTime() > windowMs) {
    await db
      .insert(loginRateLimits)
      .values({ key, count: 1, firstFailedAt: current, updatedAt: current })
      .onConflictDoUpdate({
        target: loginRateLimits.key,
        set: {
          count: 1,
          firstFailedAt: current,
          lockedUntil: null,
          updatedAt: current
        }
      });
    return { count: 1, remaining: maxAttempts - 1 };
  }

  const count = existing.count + 1;
  const lockedUntil = count >= maxAttempts ? new Date(current.getTime() + lockMs) : existing.lockedUntil ?? undefined;
  await db
    .update(loginRateLimits)
    .set({
      count,
      lockedUntil,
      updatedAt: current
    })
    .where(eq(loginRateLimits.key, key));

  const failure: LoginFailureState = {
    count,
    remaining: Math.max(maxAttempts - count, 0)
  };
  if (lockedUntil) failure.lockedUntil = lockedUntil;
  return failure;
}

async function clearPostgresLoginFailures(key: string) {
  await db.delete(loginRateLimits).where(eq(loginRateLimits.key, key));
}

export async function assertLoginNotRateLimited(scope: string, identity: string, ipAddress?: string) {
  const key = buildKey(scope, identity, ipAddress);
  return env.RATE_LIMIT_DRIVER === "postgres"
    ? assertPostgresLoginNotRateLimited(key)
    : assertMemoryLoginNotRateLimited(key);
}

export async function recordLoginFailure(key: string): Promise<LoginFailureState> {
  if (env.RATE_LIMIT_DRIVER === "postgres") {
    return recordPostgresLoginFailure(key);
  } else {
    return recordMemoryLoginFailure(key);
  }
}

export async function clearLoginFailures(key: string) {
  if (env.RATE_LIMIT_DRIVER === "postgres") {
    await clearPostgresLoginFailures(key);
  } else {
    clearMemoryLoginFailures(key);
  }
}
