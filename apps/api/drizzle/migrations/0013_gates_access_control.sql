DO $$ BEGIN
  CREATE TYPE "gate_type" AS ENUM (
    'pedestrian', 'vehicle', 'mixed', 'visitors', 'staff', 'providers', 'emergency', 'events'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "gate_status" AS ENUM (
    'active', 'inactive', 'maintenance', 'entry_only', 'exit_only', 'blocked', 'emergency'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "gate_scanner_status" AS ENUM ('active', 'inactive', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "gates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(160) NOT NULL,
  "type" "gate_type" DEFAULT 'mixed' NOT NULL,
  "location" varchar(240),
  "status" "gate_status" DEFAULT 'active' NOT NULL,
  "schedule" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text,
  "created_by_admin_id" uuid REFERENCES "administradores"("id"),
  "updated_by_admin_id" uuid REFERENCES "administradores"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gates_code_unique" ON "gates" ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gates_status_type_idx" ON "gates" ("status", "type");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "gate_scanners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gate_id" uuid NOT NULL REFERENCES "gates"("id") ON DELETE CASCADE,
  "scanner_device_id" uuid REFERENCES "scanner_devices"("id"),
  "scanner_id" varchar(120) NOT NULL,
  "label" varchar(160) NOT NULL,
  "status" "gate_scanner_status" DEFAULT 'active' NOT NULL,
  "last_seen_at" timestamptz,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gate_scanners_scanner_id_unique" ON "gate_scanners" ("scanner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gate_scanners_scanner_device_unique" ON "gate_scanners" ("scanner_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gate_scanners_gate_status_idx" ON "gate_scanners" ("gate_id", "status");--> statement-breakpoint

ALTER TABLE "registros_acceso" ADD COLUMN IF NOT EXISTS "gate_id" uuid REFERENCES "gates"("id");--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD COLUMN IF NOT EXISTS "exit_gate_id" uuid REFERENCES "gates"("id");--> statement-breakpoint
ALTER TABLE "access_scan_events" ADD COLUMN IF NOT EXISTS "gate_id" uuid REFERENCES "gates"("id");--> statement-breakpoint
ALTER TABLE "qr_jti_consumptions" ADD COLUMN IF NOT EXISTS "gate_id" uuid REFERENCES "gates"("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registros_acceso_gate_entrada_idx" ON "registros_acceso" ("gate_id", "entrada_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registros_acceso_exit_gate_salida_idx" ON "registros_acceso" ("exit_gate_id", "salida_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_scan_events_gate_scanned_idx" ON "access_scan_events" ("gate_id", "scanned_at");--> statement-breakpoint

CREATE OR REPLACE FUNCTION gate_schedule_allows_v1(schedule jsonb, checked_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_timezone text := coalesce(nullif(schedule->>'timezone', ''), 'America/Cancun');
  v_local timestamp;
  v_day text;
  v_time time;
BEGIN
  IF schedule IS NULL OR schedule = '{}'::jsonb OR NOT (schedule ? 'weekly') THEN
    RETURN true;
  END IF;

  v_local := checked_at AT TIME ZONE v_timezone;
  v_day := EXTRACT(DOW FROM v_local)::integer::text;
  v_time := v_local::time;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(schedule->'weekly'->v_day, '[]'::jsonb)) slot
    WHERE CASE
      WHEN (slot->>'start')::time <= (slot->>'end')::time
        THEN v_time >= (slot->>'start')::time AND v_time <= (slot->>'end')::time
      ELSE v_time >= (slot->>'start')::time OR v_time <= (slot->>'end')::time
    END
  );
EXCEPTION WHEN invalid_parameter_value OR datetime_field_overflow THEN
  RETURN false;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION access_scan_gate_v1(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := now();
  v_scanner_id text := coalesce(nullif(payload->>'scannerCode', ''), nullif(payload->>'scannerId', ''));
  v_gate_id uuid := nullif(payload->>'gateId', '')::uuid;
  v_gate_code text;
  v_gate_name text;
  v_gate_type gate_type;
  v_gate_status gate_status;
  v_gate_schedule jsonb;
  v_gate_rules jsonb;
  v_gate_scanner_id uuid;
  v_result jsonb;
  v_reason text;
  v_action text;
  v_mode text;
  v_person_type text;
  v_record_id uuid;
  v_credential credential_type := CASE
    WHEN payload ? 'preVerifiedCredentialType' THEN (payload->>'preVerifiedCredentialType')::credential_type
    WHEN payload ? 'manualMatricula' THEN 'manual_override'::credential_type
    ELSE 'person_qr'::credential_type
  END;
  v_rejection_mode access_mode := CASE
    WHEN payload->>'preVerifiedCredentialType' = 'vehicle_permit_qr' THEN 'vehicle'::access_mode
    WHEN payload ? 'manualMatricula' THEN 'manual'::access_mode
    ELSE 'pedestrian'::access_mode
  END;
BEGIN
  SELECT gs.id, g.id, g.code, g.name, g.type, g.status, g.schedule, g.rules
  INTO v_gate_scanner_id, v_gate_id, v_gate_code, v_gate_name, v_gate_type, v_gate_status, v_gate_schedule, v_gate_rules
  FROM gate_scanners gs
  INNER JOIN gates g ON g.id = gs.gate_id
  WHERE gs.status = 'active'
    AND (gs.scanner_id = v_scanner_id OR (v_gate_id IS NOT NULL AND g.id = v_gate_id AND gs.scanner_id = v_scanner_id))
  LIMIT 1;

  IF v_gate_id IS NULL OR v_gate_scanner_id IS NULL THEN
    INSERT INTO access_scan_events (credential_type, access_mode, accepted, reason_code, metadata)
    VALUES (v_credential, v_rejection_mode, false, 'GATE_NOT_FOUND', payload - 'token' - 'signedQr');
    RETURN jsonb_build_object('accepted', false, 'reasonCode', 'GATE_NOT_FOUND', 'scannerId', v_scanner_id, 'scannedAt', v_now);
  END IF;

  v_reason := CASE v_gate_status
    WHEN 'inactive' THEN 'GATE_INACTIVE'
    WHEN 'maintenance' THEN 'GATE_MAINTENANCE'
    WHEN 'blocked' THEN 'GATE_BLOCKED'
    ELSE NULL
  END;

  IF v_reason IS NULL AND v_gate_status <> 'emergency' AND NOT gate_schedule_allows_v1(v_gate_schedule, v_now) THEN
    v_reason := 'GATE_SCHEDULE_CLOSED';
  END IF;

  IF v_reason IS NOT NULL THEN
    INSERT INTO access_scan_events (gate_id, credential_type, access_mode, accepted, reason_code, metadata)
    VALUES (v_gate_id, v_credential, v_rejection_mode, false, v_reason, payload - 'token' - 'signedQr');
    RETURN jsonb_build_object(
      'accepted', false, 'reasonCode', v_reason, 'gateId', v_gate_id,
      'gateCode', v_gate_code, 'gateName', v_gate_name, 'scannerId', v_scanner_id, 'scannedAt', v_now
    );
  END IF;

  BEGIN
    v_result := access_scan_v1(payload || jsonb_build_object('gateId', v_gate_id, 'scannerId', v_scanner_id));
    v_action := v_result->>'action';
    v_mode := coalesce(v_result->>'accessMode', v_rejection_mode::text);
    v_person_type := v_result->>'personType';

    IF coalesce((v_result->>'accepted')::boolean, false) AND v_gate_status <> 'emergency' THEN
      IF (v_gate_status = 'entry_only' AND v_action = 'exit') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GATE_ENTRY_ONLY';
      ELSIF (v_gate_status = 'exit_only' AND v_action IN ('entry', 'visitor_access')) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GATE_EXIT_ONLY';
      END IF;

      IF v_mode <> 'manual' AND NOT (
        v_gate_type = 'mixed'
        OR v_gate_type = 'emergency'
        OR (v_gate_type = 'vehicle' AND v_mode = 'vehicle')
        OR (v_gate_type = 'pedestrian' AND v_mode = 'pedestrian')
        OR (v_gate_type = 'visitors' AND v_mode = 'visitor')
        OR (v_gate_type IN ('staff', 'providers', 'events') AND v_mode IN ('pedestrian', 'visitor'))
      ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GATE_MODE_NOT_ALLOWED';
      END IF;

      IF jsonb_typeof(v_gate_rules->'allowedAccessModes') = 'array'
        AND NOT (v_gate_rules->'allowedAccessModes' ? v_mode) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GATE_MODE_NOT_ALLOWED';
      END IF;

      IF v_person_type IS NOT NULL
        AND jsonb_typeof(v_gate_rules->'allowedPersonTypes') = 'array'
        AND NOT (v_gate_rules->'allowedPersonTypes' ? v_person_type) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GATE_PERSON_TYPE_NOT_ALLOWED';
      END IF;
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    v_reason := SQLERRM;
    INSERT INTO access_scan_events (
      person_id, vehicle_id, gate_id, credential_type, access_mode, accepted, reason_code,
      jti, signature_verified, display_payload, metadata
    ) VALUES (
      nullif(v_result->>'personId', '')::uuid,
      nullif(v_result->>'vehicleId', '')::uuid,
      v_gate_id,
      coalesce(nullif(v_result->>'credentialType', '')::credential_type, v_credential),
      coalesce(nullif(v_result->>'accessMode', '')::access_mode, v_rejection_mode),
      false,
      v_reason,
      nullif(payload->>'preVerifiedJti', '')::uuid,
      (payload->>'signatureVerified')::boolean,
      coalesce(v_result, '{}'::jsonb) || jsonb_build_object('accepted', false, 'reasonCode', v_reason),
      payload - 'token' - 'signedQr'
    );
    RETURN coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
      'accepted', false, 'action', 'rejected', 'reasonCode', v_reason,
      'gateId', v_gate_id, 'gateCode', v_gate_code, 'gateName', v_gate_name,
      'scannerId', v_scanner_id, 'scannedAt', v_now
    );
  END;

  UPDATE gate_scanners SET last_seen_at = v_now, updated_at = v_now WHERE id = v_gate_scanner_id;

  IF coalesce((v_result->>'accepted')::boolean, false) THEN
    v_record_id := nullif(v_result->>'registroId', '')::uuid;
    IF v_action = 'exit' THEN
      UPDATE registros_acceso SET exit_gate_id = v_gate_id WHERE id = v_record_id;
    ELSE
      UPDATE registros_acceso SET gate_id = v_gate_id WHERE id = v_record_id;
    END IF;
    UPDATE access_scan_events SET gate_id = v_gate_id
    WHERE id = (
      SELECT id FROM access_scan_events WHERE registro_acceso_id = v_record_id ORDER BY scanned_at DESC, id DESC LIMIT 1
    );
    UPDATE qr_jti_consumptions SET gate_id = v_gate_id
    WHERE jti = nullif(payload->>'preVerifiedJti', '')::uuid;
  ELSE
    UPDATE access_scan_events SET gate_id = v_gate_id
    WHERE id = (
      SELECT id FROM access_scan_events
      WHERE gate_id IS NULL AND metadata->>'gateId' = v_gate_id::text
      ORDER BY scanned_at DESC, id DESC LIMIT 1
    );
  END IF;

  RETURN v_result || jsonb_build_object(
    'gateId', v_gate_id, 'gateCode', v_gate_code, 'gateName', v_gate_name, 'scannerId', v_scanner_id
  );
END;
$$;
