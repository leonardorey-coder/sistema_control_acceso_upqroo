ALTER TABLE "qr_tokens" ADD COLUMN IF NOT EXISTS "token_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_permit_qr_tokens" ADD COLUMN IF NOT EXISTS "token_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "ip_address" varchar(80);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "user_account_status" AS ENUM ('active', 'disabled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN IF NOT EXISTS "status" "user_account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "user_accounts"("id"),
  "session_hash" text NOT NULL,
  "ip_address" varchar(80),
  "user_agent" text,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_hash_unique"
ON "user_sessions" ("session_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_account_idx"
ON "user_sessions" ("account_id", "expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_active_idx"
ON "user_sessions" ("account_id", "expires_at")
WHERE "revoked_at" IS NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "temporary_daily_qr_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "temporary_daily_qr_unique"
ON "temporary_daily_qr_tokens" ("person_id", "operational_date")
WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qr_tokens_active_person_idx"
ON "qr_tokens" ("person_id", "expires_at")
WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_permit_qr_active_idx"
ON "vehicle_permit_qr_tokens" ("vehicle_permit_id", "expires_at")
WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "temporary_daily_qr_active_idx"
ON "temporary_daily_qr_tokens" ("person_id", "operational_date", "valid_until")
WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_sessions_active_idx"
ON "admin_sessions" ("admin_id", "expires_at")
WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_today_table_idx"
ON "registros_acceso" ("entrada_at" DESC, "status", "access_mode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_today_table_idx"
ON "asistencias_potenciales" ("fecha_clase" DESC, "estado", "subject_id");
