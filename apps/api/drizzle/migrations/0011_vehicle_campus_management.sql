DO $$ BEGIN
  CREATE TYPE "vehicle_type" AS ENUM (
    'car',
    'motorcycle',
    'bicycle',
    'electric_scooter',
    'truck',
    'official',
    'university_transport',
    'visitor',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "vehicle_approval_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "vehicle_permit_type" AS ENUM ('standard', 'temporary', 'official', 'visitor', 'provider', 'event', 'emergency');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "vehicle_visitor_permit_status" AS ENUM ('active', 'expired', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "vehicle_type" "vehicle_type" DEFAULT 'car' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "approval_status" "vehicle_approval_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "registered_by_admin_id" uuid REFERENCES "administradores"("id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "approved_by_admin_id" uuid REFERENCES "administradores"("id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "rejected_by_admin_id" uuid REFERENCES "administradores"("id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "vehicles"
SET "approval_status" = 'approved',
    "approved_at" = COALESCE("approved_at", "created_at")
WHERE "approval_status" = 'pending'
  AND "registered_by_admin_id" IS NULL
  AND "rejected_at" IS NULL;--> statement-breakpoint
ALTER TABLE "vehicle_permits" ADD COLUMN IF NOT EXISTS "permit_type" "vehicle_permit_type" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_approval_type_idx"
ON "vehicles" ("approval_status", "vehicle_type");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_visitor_permits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "hot_qr_token_id" uuid NOT NULL REFERENCES "hot_qr_tokens"("id"),
  "visitor_name" varchar(160) NOT NULL,
  "plate" varchar(20) NOT NULL,
  "vehicle_type" "vehicle_type" DEFAULT 'visitor' NOT NULL,
  "color" varchar(60),
  "reason" text NOT NULL,
  "status" "vehicle_visitor_permit_status" DEFAULT 'active' NOT NULL,
  "valid_from" timestamp with time zone DEFAULT now() NOT NULL,
  "valid_until" timestamp with time zone NOT NULL,
  "created_by_admin_id" uuid REFERENCES "administradores"("id"),
  "revoked_by_admin_id" uuid REFERENCES "administradores"("id"),
  "revoked_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_visitor_permits_hot_qr_unique"
ON "vehicle_visitor_permits" ("hot_qr_token_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_visitor_permits_plate_status_idx"
ON "vehicle_visitor_permits" ("plate", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_visitor_permits_valid_status_idx"
ON "vehicle_visitor_permits" ("valid_until", "status");--> statement-breakpoint
DO $$
DECLARE
  v_source text;
  v_validation text;
BEGIN
  SELECT pg_get_functiondef('access_scan_v1(jsonb)'::regprocedure) INTO v_source;

  IF position('vehicle_visitor_permits' in v_source) = 0 THEN
    v_source := replace(v_source,
      '      SELECT h.id, h.visitor_name
      INTO v_hot_qr_id, v_visitor_name
      FROM hot_qr_tokens h
      WHERE h.token_hash = v_token_hash
        AND h.status = ''active''
        AND h.valid_from <= v_now
        AND h.valid_until > v_now
        AND h.use_count < h.max_uses
      LIMIT 1;',
      '      SELECT h.id, h.visitor_name, vvp.plate
      INTO v_hot_qr_id, v_visitor_name, v_vehicle_plate
      FROM hot_qr_tokens h
      LEFT JOIN vehicle_visitor_permits vvp ON vvp.hot_qr_token_id = h.id
        AND vvp.status = ''active''
        AND vvp.valid_from <= v_now
        AND vvp.valid_until > v_now
      WHERE h.token_hash = v_token_hash
        AND h.status = ''active''
        AND h.valid_from <= v_now
        AND h.valid_until > v_now
        AND h.use_count < h.max_uses
      LIMIT 1;');

    v_source := replace(v_source,
      '        v_access_mode := ''visitor'';
        v_subject_type := ''visitor'';',
      '        v_access_mode := CASE WHEN v_vehicle_plate IS NOT NULL THEN ''vehicle''::access_mode ELSE ''visitor''::access_mode END;
        v_subject_type := ''visitor'';');
  END IF;

  IF position('VEHICLE_PENDING_APPROVAL' in v_source) = 0 THEN
    v_source := replace(v_source,
      '        AND vp.status = ''active''
        AND (vp.valid_until IS NULL OR vp.valid_until > v_now)
        AND vp.valid_from <= v_now
        AND v.status = ''active''',
      '');

    v_source := replace(v_source,
      '        AND vp.status = ''active''
        AND (vp.valid_until IS NULL OR vp.valid_until > v_now)
        AND v.status = ''active''',
      '');

    v_validation := $validation$

  IF v_credential_type = 'vehicle_permit_qr' THEN
    IF EXISTS (SELECT 1 FROM vehicle_permits vp WHERE vp.id = v_vehicle_permit_id AND vp.status <> 'active') THEN
      UPDATE qr_jti_consumptions SET rejected_reason = 'VEHICLE_PERMIT_NOT_ACTIVE' WHERE jti = v_pre_verified_jti;
      INSERT INTO access_scan_events (person_id, vehicle_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_person_id, v_vehicle_id, v_credential_type, v_access_mode, false, 'VEHICLE_PERMIT_NOT_ACTIVE',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'VEHICLE_PERMIT_NOT_ACTIVE',
        'personId', v_person_id, 'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate, 'scannedAt', v_now);
    END IF;

    IF EXISTS (SELECT 1 FROM vehicle_permits vp WHERE vp.id = v_vehicle_permit_id AND vp.valid_from > v_now) THEN
      UPDATE qr_jti_consumptions SET rejected_reason = 'VEHICLE_PERMIT_NOT_YET_VALID' WHERE jti = v_pre_verified_jti;
      INSERT INTO access_scan_events (person_id, vehicle_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_person_id, v_vehicle_id, v_credential_type, v_access_mode, false, 'VEHICLE_PERMIT_NOT_YET_VALID',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'VEHICLE_PERMIT_NOT_YET_VALID',
        'personId', v_person_id, 'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate, 'scannedAt', v_now);
    END IF;

    IF EXISTS (SELECT 1 FROM vehicle_permits vp WHERE vp.id = v_vehicle_permit_id AND vp.valid_until IS NOT NULL AND vp.valid_until <= v_now) THEN
      UPDATE qr_jti_consumptions SET rejected_reason = 'VEHICLE_PERMIT_EXPIRED' WHERE jti = v_pre_verified_jti;
      INSERT INTO access_scan_events (person_id, vehicle_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_person_id, v_vehicle_id, v_credential_type, v_access_mode, false, 'VEHICLE_PERMIT_EXPIRED',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'VEHICLE_PERMIT_EXPIRED',
        'personId', v_person_id, 'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate, 'scannedAt', v_now);
    END IF;

    IF EXISTS (SELECT 1 FROM vehicles v WHERE v.id = v_vehicle_id AND v.deleted_at IS NOT NULL) THEN
      UPDATE qr_jti_consumptions SET rejected_reason = 'VEHICLE_DELETED' WHERE jti = v_pre_verified_jti;
      INSERT INTO access_scan_events (person_id, vehicle_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_person_id, v_vehicle_id, v_credential_type, v_access_mode, false, 'VEHICLE_DELETED',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'VEHICLE_DELETED',
        'personId', v_person_id, 'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate, 'scannedAt', v_now);
    END IF;

    IF EXISTS (SELECT 1 FROM vehicles v WHERE v.id = v_vehicle_id AND v.status = 'blocked') THEN
      UPDATE qr_jti_consumptions SET rejected_reason = 'VEHICLE_BLOCKED' WHERE jti = v_pre_verified_jti;
      INSERT INTO access_scan_events (person_id, vehicle_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_person_id, v_vehicle_id, v_credential_type, v_access_mode, false, 'VEHICLE_BLOCKED',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'VEHICLE_BLOCKED',
        'personId', v_person_id, 'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate, 'scannedAt', v_now);
    END IF;

    IF EXISTS (SELECT 1 FROM vehicles v WHERE v.id = v_vehicle_id AND v.status <> 'active') THEN
      UPDATE qr_jti_consumptions SET rejected_reason = 'VEHICLE_NOT_ACTIVE' WHERE jti = v_pre_verified_jti;
      INSERT INTO access_scan_events (person_id, vehicle_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_person_id, v_vehicle_id, v_credential_type, v_access_mode, false, 'VEHICLE_NOT_ACTIVE',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'VEHICLE_NOT_ACTIVE',
        'personId', v_person_id, 'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate, 'scannedAt', v_now);
    END IF;

    IF EXISTS (SELECT 1 FROM vehicles v WHERE v.id = v_vehicle_id AND v.approval_status = 'pending') THEN
      UPDATE qr_jti_consumptions SET rejected_reason = 'VEHICLE_PENDING_APPROVAL' WHERE jti = v_pre_verified_jti;
      INSERT INTO access_scan_events (person_id, vehicle_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_person_id, v_vehicle_id, v_credential_type, v_access_mode, false, 'VEHICLE_PENDING_APPROVAL',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'VEHICLE_PENDING_APPROVAL',
        'personId', v_person_id, 'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate, 'scannedAt', v_now);
    END IF;

    IF EXISTS (SELECT 1 FROM vehicles v WHERE v.id = v_vehicle_id AND v.approval_status = 'rejected') THEN
      UPDATE qr_jti_consumptions SET rejected_reason = 'VEHICLE_REJECTED' WHERE jti = v_pre_verified_jti;
      INSERT INTO access_scan_events (person_id, vehicle_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_person_id, v_vehicle_id, v_credential_type, v_access_mode, false, 'VEHICLE_REJECTED',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'VEHICLE_REJECTED',
        'personId', v_person_id, 'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate, 'scannedAt', v_now);
    END IF;
  END IF;
$validation$;

    v_source := replace(v_source,
      '  IF v_person_id IS NOT NULL AND v_person_status <> ''activo'' THEN',
      v_validation || '
  IF v_person_id IS NOT NULL AND v_person_status <> ''activo'' THEN');
  END IF;

  EXECUTE v_source;
END $$;
