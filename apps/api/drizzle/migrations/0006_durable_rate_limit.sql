-- Durable login rate limiting for multi-process deployments.

CREATE TABLE IF NOT EXISTS "login_rate_limits" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "first_failed_at" timestamptz NOT NULL,
  "locked_until" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "login_rate_limits_locked_until_idx"
  ON "login_rate_limits" ("locked_until");

CREATE INDEX IF NOT EXISTS "login_rate_limits_updated_at_idx"
  ON "login_rate_limits" ("updated_at");
