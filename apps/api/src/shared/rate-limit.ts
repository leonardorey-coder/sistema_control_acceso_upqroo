import { HttpError } from "./http-error";

type AttemptState = {
  count: number;
  firstFailedAt: number;
  lockedUntil?: number;
};

const attempts = new Map<string, AttemptState>();

const windowMs = 10 * 60 * 1000;
const lockMs = 15 * 60 * 1000;
const maxAttempts = 5;

function now() {
  return Date.now();
}

export function assertLoginNotRateLimited(scope: string, identity: string, ipAddress?: string) {
  const key = `${scope}:${identity.toLowerCase()}:${ipAddress ?? "unknown"}`;
  const state = attempts.get(key);

  if (!state) return key;

  const current = now();

  if (state.lockedUntil && state.lockedUntil > current) {
    throw new HttpError(429, "LOGIN_TEMPORARILY_LOCKED", "Too many failed login attempts. Try again later.", {
      retryAfterMs: state.lockedUntil - current
    });
  }

  if (current - state.firstFailedAt > windowMs) {
    attempts.delete(key);
  }

  return key;
}

export function recordLoginFailure(key: string) {
  const current = now();
  const existing = attempts.get(key);

  if (!existing || current - existing.firstFailedAt > windowMs) {
    attempts.set(key, { count: 1, firstFailedAt: current });
    return;
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
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
