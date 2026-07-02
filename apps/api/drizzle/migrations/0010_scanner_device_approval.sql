ALTER TABLE "scanner_devices"
  ADD COLUMN IF NOT EXISTS "requested_by_admin_id" uuid REFERENCES "administradores"("id"),
  ADD COLUMN IF NOT EXISTS "approved_by_admin_id" uuid REFERENCES "administradores"("id"),
  ADD COLUMN IF NOT EXISTS "approved_at" timestamptz;--> statement-breakpoint
