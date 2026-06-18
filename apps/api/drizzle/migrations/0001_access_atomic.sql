CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
ALTER TABLE "hot_qr_tokens" ADD COLUMN IF NOT EXISTS "token_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "temporary_daily_qr_tokens" ADD COLUMN IF NOT EXISTS "token_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
INSERT INTO "operational_config" ("key", "value", "description")
VALUES (
  'scanner',
  '{"retryEnabled":true,"retryDelayMs":1200,"cameraEnabled":true,"manualEntryEnabled":true,"soundsEnabled":true,"autoExitEnabled":true}'::jsonb,
  'Scanner and access operation defaults'
)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION access_scan_v1(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := now();
  v_token text := nullif(payload->>'token', '');
  v_manual_matricula text := nullif(payload->>'manualMatricula', '');
  v_admin_id uuid := nullif(payload->>'adminId', '')::uuid;
  v_token_hash text;
  v_person_id uuid;
  v_vehicle_id uuid;
  v_vehicle_permit_id uuid;
  v_qr_token_id uuid;
  v_vehicle_qr_id uuid;
  v_temp_qr_id uuid;
  v_hot_qr_id uuid;
  v_person_status text;
  v_matricula text;
  v_nombres text;
  v_apellidos text;
  v_tipo_persona text;
  v_carrera text;
  v_vehicle_plate text;
  v_visitor_name text;
  v_credential_type credential_type := 'manual_override';
  v_access_mode access_mode := 'manual';
  v_subject_type access_subject_type := 'person';
  v_open registros_acceso%ROWTYPE;
  v_record registros_acceso%ROWTYPE;
  v_hash_anterior text;
  v_hash_registro text;
  v_minutes integer;
  v_percentage integer;
  v_reason text := 'ACCEPTED';
  v_display jsonb;
BEGIN
  IF v_manual_matricula IS NULL AND v_token IS NULL THEN
    INSERT INTO access_scan_events (credential_type, access_mode, accepted, reason_code, metadata)
    VALUES ('manual_override', 'manual', false, 'MISSING_CREDENTIAL', payload);
    RETURN jsonb_build_object('accepted', false, 'reasonCode', 'MISSING_CREDENTIAL', 'scannedAt', v_now);
  END IF;

  IF v_manual_matricula IS NOT NULL THEN
    SELECT p.id, p.estado::text, p.matricula, p.nombres, p.apellidos, p.tipo_persona, c.nombre
    INTO v_person_id, v_person_status, v_matricula, v_nombres, v_apellidos, v_tipo_persona, v_carrera
    FROM personas p
    LEFT JOIN carreras c ON c.id = p.carrera_id
    WHERE p.matricula = v_manual_matricula
    LIMIT 1;

    v_credential_type := 'manual_override';
    v_access_mode := 'manual';
    v_subject_type := 'person';
  ELSE
    v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

    SELECT p.id, p.estado::text, p.matricula, p.nombres, p.apellidos, p.tipo_persona, c.nombre, q.id
    INTO v_person_id, v_person_status, v_matricula, v_nombres, v_apellidos, v_tipo_persona, v_carrera, v_qr_token_id
    FROM qr_tokens q
    INNER JOIN personas p ON p.id = q.person_id
    LEFT JOIN carreras c ON c.id = p.carrera_id
    WHERE q.token_hash = v_token_hash
      AND q.status = 'active'
      AND q.expires_at > v_now
    LIMIT 1;

    IF v_person_id IS NOT NULL THEN
      v_credential_type := 'person_qr';
      v_access_mode := 'pedestrian';
      v_subject_type := 'person';
    END IF;

    IF v_person_id IS NULL THEN
      SELECT p.id, p.estado::text, p.matricula, p.nombres, p.apellidos, p.tipo_persona, c.nombre, t.id
      INTO v_person_id, v_person_status, v_matricula, v_nombres, v_apellidos, v_tipo_persona, v_carrera, v_temp_qr_id
      FROM temporary_daily_qr_tokens t
      INNER JOIN personas p ON p.id = t.person_id
      LEFT JOIN carreras c ON c.id = p.carrera_id
      WHERE t.token_hash = v_token_hash
        AND t.status = 'active'
        AND t.valid_until > v_now
        AND t.operational_date = v_now::date
        AND t.use_count < t.max_uses
      LIMIT 1;

      IF v_person_id IS NOT NULL THEN
        v_credential_type := 'temporary_daily_qr';
        v_access_mode := 'pedestrian';
        v_subject_type := 'exception';
      END IF;
    END IF;

    IF v_person_id IS NULL THEN
      SELECT p.id, p.estado::text, p.matricula, p.nombres, p.apellidos, p.tipo_persona, c.nombre,
             v.id, v.plate, vp.id, vq.id
      INTO v_person_id, v_person_status, v_matricula, v_nombres, v_apellidos, v_tipo_persona, v_carrera,
           v_vehicle_id, v_vehicle_plate, v_vehicle_permit_id, v_vehicle_qr_id
      FROM vehicle_permit_qr_tokens vq
      INNER JOIN vehicle_permits vp ON vp.id = vq.vehicle_permit_id
      INNER JOIN vehicles v ON v.id = vp.vehicle_id
      INNER JOIN personas p ON p.id = vp.person_id
      LEFT JOIN carreras c ON c.id = p.carrera_id
      WHERE vq.token_hash = v_token_hash
        AND vq.status = 'active'
        AND vq.expires_at > v_now
        AND vp.status = 'active'
        AND (vp.valid_until IS NULL OR vp.valid_until > v_now)
        AND v.status = 'active'
      LIMIT 1;

      IF v_person_id IS NOT NULL THEN
        v_credential_type := 'vehicle_permit_qr';
        v_access_mode := 'vehicle';
        v_subject_type := 'vehicle_permit';
      END IF;
    END IF;

    IF v_person_id IS NULL THEN
      SELECT h.id, h.visitor_name
      INTO v_hot_qr_id, v_visitor_name
      FROM hot_qr_tokens h
      WHERE h.token_hash = v_token_hash
        AND h.status = 'active'
        AND h.valid_from <= v_now
        AND h.valid_until > v_now
        AND h.use_count < h.max_uses
      LIMIT 1;

      IF v_hot_qr_id IS NOT NULL THEN
        v_credential_type := 'hot_qr';
        v_access_mode := 'visitor';
        v_subject_type := 'visitor';
      END IF;
    END IF;
  END IF;

  IF v_person_id IS NULL AND v_hot_qr_id IS NULL THEN
    INSERT INTO access_scan_events (credential_type, access_mode, accepted, reason_code, metadata)
    VALUES (v_credential_type, v_access_mode, false, 'CREDENTIAL_NOT_FOUND_OR_EXPIRED', payload);
    RETURN jsonb_build_object('accepted', false, 'reasonCode', 'CREDENTIAL_NOT_FOUND_OR_EXPIRED', 'scannedAt', v_now);
  END IF;

  IF v_person_id IS NOT NULL AND v_person_status <> 'activo' THEN
    INSERT INTO access_scan_events (person_id, credential_type, access_mode, accepted, reason_code, metadata)
    VALUES (v_person_id, v_credential_type, v_access_mode, false, 'PERSON_NOT_ACTIVE', payload);
    RETURN jsonb_build_object('accepted', false, 'reasonCode', 'PERSON_NOT_ACTIVE', 'personId', v_person_id, 'scannedAt', v_now);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('access:' || coalesce(v_vehicle_id::text, v_person_id::text, v_hot_qr_id::text)));

  IF v_hot_qr_id IS NOT NULL THEN
    UPDATE hot_qr_tokens
    SET use_count = use_count + 1,
        status = CASE WHEN use_count + 1 >= max_uses THEN 'used'::hot_qr_status ELSE status END,
        used_at = v_now
    WHERE id = v_hot_qr_id;

    INSERT INTO registros_acceso (
      hot_qr_token_id, visitor_name, entrada_at, salida_at, status, access_mode, subject_type,
      credential_type, credential_origin, hash_anterior, metadata
    )
    VALUES (
      v_hot_qr_id, v_visitor_name, v_now, v_now, 'completed', v_access_mode, v_subject_type,
      v_credential_type, 'hot_qr', NULL, payload
    )
    RETURNING * INTO v_record;

    v_hash_registro := encode(digest(concat_ws('|', v_record.id::text, '', '', v_record.entrada_at::text, ''), 'sha256'), 'hex');
    UPDATE registros_acceso SET hash_registro = v_hash_registro WHERE id = v_record.id;

    v_display := jsonb_build_object(
      'accepted', true,
      'action', 'visitor_access',
      'reasonCode', v_reason,
      'registroId', v_record.id,
      'visitorName', v_visitor_name,
      'credentialType', v_credential_type,
      'accessMode', v_access_mode,
      'timestamp', v_now
    );

    INSERT INTO access_scan_events (registro_acceso_id, credential_type, access_mode, accepted, reason_code, display_payload, metadata)
    VALUES (v_record.id, v_credential_type, v_access_mode, true, v_reason, v_display, payload);
    RETURN v_display;
  END IF;

  SELECT *
  INTO v_open
  FROM registros_acceso
  WHERE salida_at IS NULL
    AND status = 'in_progress'
    AND (
      (v_vehicle_id IS NOT NULL AND vehicle_id = v_vehicle_id)
      OR (v_vehicle_id IS NULL AND person_id = v_person_id)
    )
  ORDER BY entrada_at DESC
  LIMIT 1;

  IF v_open.id IS NOT NULL THEN
    UPDATE registros_acceso
    SET salida_at = v_now,
        status = 'completed',
        admin_salida_id = v_admin_id
    WHERE id = v_open.id
    RETURNING * INTO v_record;

    UPDATE asistencias_potenciales
    SET minutos_asistidos = LEAST(minutos_totales, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_record.entrada_at)) / 60)::integer)),
        porcentaje = CASE
          WHEN minutos_totales <= 0 THEN 0
          ELSE LEAST(100, FLOOR((LEAST(minutos_totales, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_record.entrada_at)) / 60)::integer))::numeric / minutos_totales::numeric) * 100)::integer)
        END,
        estado = CASE
          WHEN minutos_totales <= 0 THEN 'unverified'::attendance_status
          WHEN LEAST(minutos_totales, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_record.entrada_at)) / 60)::integer)) >= CEIL(minutos_totales * 0.8) THEN 'confirmed'::attendance_status
          WHEN LEAST(minutos_totales, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_record.entrada_at)) / 60)::integer)) > 0 THEN 'partial'::attendance_status
          ELSE 'unverified'::attendance_status
        END,
        confirmed_at = v_now,
        updated_at = v_now
    WHERE registro_acceso_id = v_record.id
      AND estado = 'in_progress';

    v_display := jsonb_build_object(
      'accepted', true,
      'action', 'exit',
      'reasonCode', v_reason,
      'registroId', v_record.id,
      'personId', v_person_id,
      'matricula', v_matricula,
      'fullName', trim(coalesce(v_nombres, '') || ' ' || coalesce(v_apellidos, '')),
      'personType', v_tipo_persona,
      'career', v_carrera,
      'vehicleId', v_vehicle_id,
      'vehiclePlate', v_vehicle_plate,
      'credentialType', v_credential_type,
      'accessMode', v_access_mode,
      'timestamp', v_now
    );

    INSERT INTO access_scan_events (registro_acceso_id, person_id, vehicle_id, credential_type, access_mode, accepted, reason_code, display_payload, metadata)
    VALUES (v_record.id, v_person_id, v_vehicle_id, v_credential_type, v_access_mode, true, v_reason, v_display, payload);

    RETURN v_display;
  END IF;

  SELECT hash_registro
  INTO v_hash_anterior
  FROM registros_acceso
  WHERE hash_registro IS NOT NULL
  ORDER BY entrada_at DESC
  LIMIT 1;

  INSERT INTO registros_acceso (
    person_id, vehicle_id, vehicle_permit_id, matricula_legacy, entrada_at, status, access_mode,
    subject_type, credential_type, credential_origin, qr_token_id, vehicle_permit_qr_token_id,
    temporary_daily_qr_token_id, is_exception_access, admin_entrada_id, hash_anterior, metadata
  )
  VALUES (
    v_person_id, v_vehicle_id, v_vehicle_permit_id, v_matricula, v_now, 'in_progress', v_access_mode,
    v_subject_type, v_credential_type, v_credential_type::text, v_qr_token_id, v_vehicle_qr_id,
    v_temp_qr_id, v_credential_type IN ('temporary_daily_qr', 'manual_override'), v_admin_id,
    v_hash_anterior, payload
  )
  RETURNING * INTO v_record;

  v_hash_registro := encode(digest(concat_ws('|', v_record.id::text, coalesce(v_person_id::text, ''), coalesce(v_vehicle_id::text, ''), v_record.entrada_at::text, coalesce(v_hash_anterior, '')), 'sha256'), 'hex');
  UPDATE registros_acceso SET hash_registro = v_hash_registro WHERE id = v_record.id;

  IF v_qr_token_id IS NOT NULL THEN
    UPDATE qr_tokens SET last_used_at = v_now WHERE id = v_qr_token_id;
  END IF;

  IF v_vehicle_qr_id IS NOT NULL THEN
    UPDATE vehicle_permit_qr_tokens SET last_used_at = v_now WHERE id = v_vehicle_qr_id;
  END IF;

  IF v_temp_qr_id IS NOT NULL THEN
    UPDATE temporary_daily_qr_tokens SET use_count = use_count + 1 WHERE id = v_temp_qr_id;
  END IF;

  INSERT INTO asistencias_potenciales (
    person_id, schedule_id, subject_id, fecha_clase, hora_inicio, hora_fin, aula, estado,
    minutos_totales, registro_acceso_id
  )
  SELECT s.person_id, s.id, s.subject_id, v_now::date, s.hora_inicio, s.hora_fin, s.aula,
         'in_progress',
         GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((s.hora_fin::time - s.hora_inicio::time))) / 60)::integer),
         v_record.id
  FROM schedules s
  INNER JOIN personas p ON p.id = s.person_id
  INNER JOIN person_types pt ON pt.code = p.tipo_persona
  WHERE s.person_id = v_person_id
    AND s.active = true
    AND s.weekday = EXTRACT(DOW FROM v_now)::integer
    AND s.valid_from <= v_now::date
    AND (s.valid_until IS NULL OR s.valid_until >= v_now::date)
    AND pt.generates_attendance = true;

  v_display := jsonb_build_object(
    'accepted', true,
    'action', 'entry',
    'reasonCode', v_reason,
    'registroId', v_record.id,
    'personId', v_person_id,
    'matricula', v_matricula,
    'fullName', trim(coalesce(v_nombres, '') || ' ' || coalesce(v_apellidos, '')),
    'personType', v_tipo_persona,
    'career', v_carrera,
    'vehicleId', v_vehicle_id,
    'vehiclePlate', v_vehicle_plate,
    'credentialType', v_credential_type,
    'accessMode', v_access_mode,
    'timestamp', v_now
  );

  INSERT INTO access_scan_events (registro_acceso_id, person_id, vehicle_id, credential_type, access_mode, accepted, reason_code, display_payload, metadata)
  VALUES (v_record.id, v_person_id, v_vehicle_id, v_credential_type, v_access_mode, true, v_reason, v_display, payload);

  RETURN v_display;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION auto_close_access_v1(target_date date DEFAULT (CURRENT_DATE - 1))
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_closed integer := 0;
BEGIN
  WITH closed AS (
    UPDATE registros_acceso
    SET salida_at = (target_date::timestamp + time '23:59:59') AT TIME ZONE current_setting('TIMEZONE'),
        salida_automatica = true,
        status = 'auto_closed'
    WHERE salida_at IS NULL
      AND status = 'in_progress'
      AND entrada_at < (target_date::timestamp + interval '1 day')
    RETURNING id
  ),
  assumed AS (
    UPDATE asistencias_potenciales ap
    SET estado = 'assumed',
        updated_at = now()
    FROM closed c
    WHERE ap.registro_acceso_id = c.id
      AND ap.estado = 'in_progress'
    RETURNING ap.id
  )
  SELECT count(*) INTO v_closed FROM closed;

  RETURN jsonb_build_object('ok', true, 'targetDate', target_date, 'closed', v_closed);
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION verify_access_chain_v1(from_at timestamptz DEFAULT NULL, to_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_row registros_acceso%ROWTYPE;
  v_expected text;
  v_previous text := NULL;
  v_checked integer := 0;
BEGIN
  FOR v_row IN
    SELECT *
    FROM registros_acceso
    WHERE hash_registro IS NOT NULL
      AND (from_at IS NULL OR entrada_at >= from_at)
      AND (to_at IS NULL OR entrada_at <= to_at)
    ORDER BY entrada_at ASC, id ASC
  LOOP
    IF v_checked > 0 AND v_row.hash_anterior IS DISTINCT FROM v_previous THEN
      RETURN jsonb_build_object('valid', false, 'checked', v_checked, 'brokenAt', v_row.id, 'reason', 'PREVIOUS_HASH_MISMATCH');
    END IF;

    v_expected := encode(digest(concat_ws('|', v_row.id::text, coalesce(v_row.person_id::text, ''), coalesce(v_row.vehicle_id::text, ''), v_row.entrada_at::text, coalesce(v_row.hash_anterior, '')), 'sha256'), 'hex');

    IF v_expected <> v_row.hash_registro THEN
      RETURN jsonb_build_object('valid', false, 'checked', v_checked, 'brokenAt', v_row.id, 'reason', 'ROW_HASH_MISMATCH');
    END IF;

    v_previous := v_row.hash_registro;
    v_checked := v_checked + 1;
  END LOOP;

  RETURN jsonb_build_object('valid', true, 'checked', v_checked);
END;
$$;
