CREATE TABLE IF NOT EXISTS "admin_client_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "admin_id" uuid NOT NULL REFERENCES "administradores"("id"),
  "public_key_jwk" jsonb NOT NULL,
  "algorithm" varchar(20) NOT NULL DEFAULT 'ES256',
  "label" varchar(160),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "last_used_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "admin_client_keys_algorithm_check" CHECK ("algorithm" IN ('ES256')),
  CONSTRAINT "admin_client_keys_status_check" CHECK ("status" IN ('active', 'revoked', 'disabled'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_client_keys_admin_status_idx"
ON "admin_client_keys" ("admin_id", "status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "admin_client_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "admin_client_keys"("id"),
  "admin_id" uuid NOT NULL REFERENCES "administradores"("id"),
  "challenge" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_client_challenges_challenge_unique"
ON "admin_client_challenges" ("challenge");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_client_challenges_client_idx"
ON "admin_client_challenges" ("client_id", "expires_at");--> statement-breakpoint

INSERT INTO "operational_config" ("key", "value", "description")
VALUES ('admin_clients', '{"required":false}'::jsonb, 'Authorized administrative browser settings')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
