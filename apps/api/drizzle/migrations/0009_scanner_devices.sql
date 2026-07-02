CREATE TYPE "public"."scanner_device_status" AS ENUM('pending', 'active', 'disabled', 'revoked');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "scanner_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(120) NOT NULL,
  "label" varchar(160) NOT NULL,
  "public_key_jwk" jsonb,
  "algorithm" varchar(20) NOT NULL DEFAULT 'ES256',
  "status" "scanner_device_status" NOT NULL DEFAULT 'pending',
  "created_by_admin_id" uuid REFERENCES "administradores"("id"),
  "requested_by_admin_id" uuid REFERENCES "administradores"("id"),
  "registered_by_admin_id" uuid REFERENCES "administradores"("id"),
  "approved_by_admin_id" uuid REFERENCES "administradores"("id"),
  "revoked_by_admin_id" uuid REFERENCES "administradores"("id"),
  "last_seen_at" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "registered_at" timestamptz,
  "approved_at" timestamptz,
  "revoked_at" timestamptz,
  CONSTRAINT "scanner_devices_algorithm_check" CHECK ("algorithm" IN ('ES256'))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "scanner_devices_code_unique"
ON "scanner_devices" ("code");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "scanner_devices_status_idx"
ON "scanner_devices" ("status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "scanner_device_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "device_id" uuid NOT NULL REFERENCES "scanner_devices"("id"),
  "admin_id" uuid NOT NULL REFERENCES "administradores"("id"),
  "challenge" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "scanner_device_challenges_challenge_unique"
ON "scanner_device_challenges" ("challenge");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "scanner_device_challenges_device_idx"
ON "scanner_device_challenges" ("device_id", "expires_at");--> statement-breakpoint

INSERT INTO "operational_config" ("key", "value", "description")
VALUES (
  'scanner_devices',
  '{}'::jsonb,
  'Scanner device authentication settings'
)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
