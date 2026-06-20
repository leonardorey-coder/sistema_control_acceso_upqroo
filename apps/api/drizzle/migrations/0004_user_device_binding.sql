CREATE TABLE IF NOT EXISTS "user_device_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "user_accounts"("id"),
  "public_key_jwk" jsonb NOT NULL,
  "algorithm" varchar(20) NOT NULL DEFAULT 'ES256',
  "label" varchar(120),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "last_used_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_device_keys_algorithm_check" CHECK ("algorithm" IN ('ES256')),
  CONSTRAINT "user_device_keys_status_check" CHECK ("status" IN ('active', 'revoked', 'disabled'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_device_keys_account_status_idx"
ON "user_device_keys" ("account_id", "status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_device_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "device_id" uuid NOT NULL REFERENCES "user_device_keys"("id"),
  "account_id" uuid NOT NULL REFERENCES "user_accounts"("id"),
  "challenge" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_device_challenges_challenge_unique"
ON "user_device_challenges" ("challenge");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_device_challenges_device_idx"
ON "user_device_challenges" ("device_id", "expires_at");--> statement-breakpoint

UPDATE "operational_config"
SET "value" = "value" || '{"requireDeviceBinding":false}'::jsonb
WHERE "key" = 'signed_qr';--> statement-breakpoint
