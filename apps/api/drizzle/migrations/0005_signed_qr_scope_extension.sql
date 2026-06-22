-- Extend signed dynamic QR resolution beyond person_qr.
-- Backend verifies the JWT and injects preVerifiedCredentialType plus the scoped
-- credential id. PostgreSQL remains the source of truth for revocation, expiry,
-- open-stay toggling, attendance and anti-replay.

CREATE OR REPLACE FUNCTION access_scan_v1(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := now();
  v_operational_timezone text := 'America/Cancun';
  v_operational_date date := (v_now AT TIME ZONE v_operational_timezone)::date;
  v_operational_dow integer := EXTRACT(DOW FROM (v_now AT TIME ZONE v_operational_timezone))::integer;
  v_token text := nullif(payload->>'token', '');
  v_manual_matricula text := nullif(payload->>'manualMatricula', '');
  v_admin_id uuid := nullif(payload->>'adminId', '')::uuid;
  v_pre_verified_person_id uuid := nullif(payload->>'preVerifiedPersonId', '')::uuid;
  v_pre_verified_jti uuid := nullif(payload->>'preVerifiedJti', '')::uuid;
  v_pre_verified_credential_type credential_type := coalesce(nullif(payload->>'preVerifiedCredentialType', '')::credential_type, 'person_qr');
  v_pre_verified_temp_qr_id uuid := nullif(payload->>'preVerifiedTemporaryDailyQrId', '')::uuid;
  v_pre_verified_vehicle_permit_id uuid := nullif(payload->>'preVerifiedVehiclePermitId', '')::uuid;
  v_signature_verified boolean := (payload->>'signatureVerified')::boolean;
  v_kid text := nullif(payload->>'kid', '');
  v_sig_alg text := nullif(payload->>'sigAlg', '');
  v_scanner_id text := nullif(payload->>'scannerId', '');
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
  v_reason text := 'ACCEPTED';
  v_display jsonb;
  v_safe_payload jsonb := payload - 'token' - 'signedQr';
  v_jti_consumed integer;
BEGIN
  IF v_pre_verified_person_id IS NOT NULL AND v_pre_verified_jti IS NOT NULL THEN
    INSERT INTO qr_jti_consumptions (
      jti, credential_type, person_id, vehicle_permit_id, temporary_daily_qr_id,
      scanner_id, issued_at, expires_at, metadata
    )
    SELECT
      v_pre_verified_jti,
      v_pre_verified_credential_type,
      v_pre_verified_person_id,
      CASE WHEN v_pre_verified_credential_type = 'vehicle_permit_qr' THEN v_pre_verified_vehicle_permit_id ELSE NULL END,
      CASE WHEN v_pre_verified_credential_type = 'temporary_daily_qr' THEN v_pre_verified_temp_qr_id ELSE NULL END,
      v_scanner_id,
      to_timestamp((payload->>'iat')::bigint),
      to_timestamp((payload->>'exp')::bigint),
      v_safe_payload
    WHERE NOT EXISTS (SELECT 1 FROM qr_jti_consumptions WHERE jti = v_pre_verified_jti);

    GET DIAGNOSTICS v_jti_consumed = ROW_COUNT;

    IF v_jti_consumed = 0 THEN
      INSERT INTO access_scan_events (person_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_pre_verified_person_id, v_pre_verified_credential_type,
        CASE WHEN v_pre_verified_credential_type = 'vehicle_permit_qr' THEN 'vehicle'::access_mode ELSE 'pedestrian'::access_mode END,
        false, 'JTI_ALREADY_CONSUMED',
        v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'JTI_ALREADY_CONSUMED',
        'personId', v_pre_verified_person_id, 'scannedAt', v_now);
    END IF;

    IF v_pre_verified_credential_type = 'person_qr' THEN
      SELECT p.id, p.estado::text, p.matricula, p.nombres, p.apellidos, p.tipo_persona, c.nombre
      INTO v_person_id, v_person_status, v_matricula, v_nombres, v_apellidos, v_tipo_persona, v_carrera
      FROM personas p
      LEFT JOIN carreras c ON c.id = p.carrera_id
      WHERE p.id = v_pre_verified_person_id
      LIMIT 1;

      v_credential_type := 'person_qr';
      v_access_mode := 'pedestrian';
      v_subject_type := 'person';
    ELSIF v_pre_verified_credential_type = 'temporary_daily_qr' THEN
      SELECT p.id, p.estado::text, p.matricula, p.nombres, p.apellidos, p.tipo_persona, c.nombre, t.id
      INTO v_person_id, v_person_status, v_matricula, v_nombres, v_apellidos, v_tipo_persona, v_carrera, v_temp_qr_id
      FROM temporary_daily_qr_tokens t
      INNER JOIN personas p ON p.id = t.person_id
      LEFT JOIN carreras c ON c.id = p.carrera_id
      WHERE t.id = v_pre_verified_temp_qr_id
        AND t.person_id = v_pre_verified_person_id
        AND t.status = 'active'
        AND t.valid_until > v_now
        AND t.operational_date = v_operational_date
        AND (
          t.use_count < t.max_uses
          OR EXISTS (
            SELECT 1
            FROM registros_acceso r
            WHERE r.person_id = t.person_id
              AND r.temporary_daily_qr_token_id = t.id
              AND r.status = 'in_progress'
              AND r.salida_at IS NULL
          )
        )
      LIMIT 1;

      v_credential_type := 'temporary_daily_qr';
      v_access_mode := 'pedestrian';
      v_subject_type := 'exception';
    ELSIF v_pre_verified_credential_type = 'vehicle_permit_qr' THEN
      SELECT p.id, p.estado::text, p.matricula, p.nombres, p.apellidos, p.tipo_persona, c.nombre,
             v.id, v.plate, vp.id
      INTO v_person_id, v_person_status, v_matricula, v_nombres, v_apellidos, v_tipo_persona, v_carrera,
           v_vehicle_id, v_vehicle_plate, v_vehicle_permit_id
      FROM vehicle_permits vp
      INNER JOIN vehicles v ON v.id = vp.vehicle_id
      INNER JOIN personas p ON p.id = vp.person_id
      LEFT JOIN carreras c ON c.id = p.carrera_id
      WHERE vp.id = v_pre_verified_vehicle_permit_id
        AND vp.person_id = v_pre_verified_person_id
        AND vp.status = 'active'
        AND (vp.valid_until IS NULL OR vp.valid_until > v_now)
        AND vp.valid_from <= v_now
        AND v.status = 'active'
      LIMIT 1;

      v_credential_type := 'vehicle_permit_qr';
      v_access_mode := 'vehicle';
      v_subject_type := 'vehicle_permit';
    ELSE
      INSERT INTO access_scan_events (person_id, credential_type, access_mode, accepted, reason_code,
        jti, kid, signature_alg, signature_verified, metadata)
      VALUES (v_pre_verified_person_id, v_pre_verified_credential_type, 'pedestrian', false,
        'SIGNED_QR_TYPE_UNSUPPORTED', v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
      RETURN jsonb_build_object('accepted', false, 'reasonCode', 'SIGNED_QR_TYPE_UNSUPPORTED',
        'personId', v_pre_verified_person_id, 'scannedAt', v_now);
    END IF;

  ELSIF v_manual_matricula IS NULL AND v_token IS NULL THEN
    INSERT INTO access_scan_events (credential_type, access_mode, accepted, reason_code, metadata)
    VALUES ('manual_override', 'manual', false, 'MISSING_CREDENTIAL', v_safe_payload);
    RETURN jsonb_build_object('accepted', false, 'reasonCode', 'MISSING_CREDENTIAL', 'scannedAt', v_now);

  ELSIF v_manual_matricula IS NOT NULL THEN
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
        AND t.operational_date = v_operational_date
        AND (
          t.use_count < t.max_uses
          OR EXISTS (
            SELECT 1
            FROM registros_acceso r
            WHERE r.person_id = t.person_id
              AND r.temporary_daily_qr_token_id = t.id
              AND r.status = 'in_progress'
              AND r.salida_at IS NULL
          )
        )
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
    INSERT INTO access_scan_events (credential_type, access_mode, accepted, reason_code,
      jti, kid, signature_alg, signature_verified, metadata)
    VALUES (v_credential_type, v_access_mode, false, 'CREDENTIAL_NOT_FOUND_OR_EXPIRED',
      v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
    RETURN jsonb_build_object('accepted', false, 'reasonCode', 'CREDENTIAL_NOT_FOUND_OR_EXPIRED', 'scannedAt', v_now);
  END IF;

  IF v_person_id IS NOT NULL AND v_person_status <> 'activo' THEN
    INSERT INTO access_scan_events (person_id, credential_type, access_mode, accepted, reason_code,
      jti, kid, signature_alg, signature_verified, metadata)
    VALUES (v_person_id, v_credential_type, v_access_mode, false, 'PERSON_NOT_ACTIVE',
      v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_safe_payload);
    RETURN jsonb_build_object('accepted', false, 'reasonCode', 'PERSON_NOT_ACTIVE',
      'personId', v_person_id, 'scannedAt', v_now);
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
      v_credential_type, 'hot_qr', NULL, v_safe_payload
    )
    RETURNING * INTO v_record;

    v_hash_registro := encode(digest(concat_ws('|', v_record.id::text, '', '', v_record.entrada_at::text, ''), 'sha256'), 'hex');
    UPDATE registros_acceso SET hash_registro = v_hash_registro WHERE id = v_record.id;

    v_display := jsonb_build_object(
      'accepted', true, 'action', 'visitor_access', 'reasonCode', v_reason,
      'registroId', v_record.id, 'visitorName', v_visitor_name,
      'credentialType', v_credential_type, 'accessMode', v_access_mode, 'timestamp', v_now
    );

    INSERT INTO access_scan_events (registro_acceso_id, credential_type, access_mode, accepted, reason_code,
      jti, kid, signature_alg, signature_verified, display_payload, metadata)
    VALUES (v_record.id, v_credential_type, v_access_mode, true, v_reason,
      v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_display, v_safe_payload);
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
      'accepted', true, 'action', 'exit', 'reasonCode', v_reason,
      'registroId', v_record.id, 'personId', v_person_id,
      'matricula', v_matricula,
      'fullName', trim(coalesce(v_nombres, '') || ' ' || coalesce(v_apellidos, '')),
      'personType', v_tipo_persona, 'career', v_carrera,
      'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate,
      'credentialType', v_credential_type, 'accessMode', v_access_mode, 'timestamp', v_now
    );

    INSERT INTO access_scan_events (registro_acceso_id, person_id, vehicle_id, credential_type, access_mode,
      accepted, reason_code, jti, kid, signature_alg, signature_verified, display_payload, metadata)
    VALUES (v_record.id, v_person_id, v_vehicle_id, v_credential_type, v_access_mode,
      true, v_reason, v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_display, v_safe_payload);

    IF v_pre_verified_jti IS NOT NULL THEN
      UPDATE qr_jti_consumptions SET access_record_id = v_record.id WHERE jti = v_pre_verified_jti;
    END IF;

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
    temporary_daily_qr_token_id, is_exception_access, scanned_token_jti, admin_entrada_id, hash_anterior, metadata
  )
  VALUES (
    v_person_id, v_vehicle_id, v_vehicle_permit_id, v_matricula, v_now, 'in_progress', v_access_mode,
    v_subject_type, v_credential_type, v_credential_type::text, v_qr_token_id, v_vehicle_qr_id,
    v_temp_qr_id, v_credential_type IN ('temporary_daily_qr', 'manual_override'), v_pre_verified_jti, v_admin_id,
    v_hash_anterior, v_safe_payload
  )
  RETURNING * INTO v_record;

  v_hash_registro := encode(digest(concat_ws('|', v_record.id::text, coalesce(v_person_id::text, ''), coalesce(v_vehicle_id::text, ''), v_record.entrada_at::text, coalesce(v_hash_anterior, '')), 'sha256'), 'hex');
  UPDATE registros_acceso SET hash_registro = v_hash_registro WHERE id = v_record.id;

  IF v_pre_verified_jti IS NOT NULL THEN
    UPDATE qr_jti_consumptions SET access_record_id = v_record.id WHERE jti = v_pre_verified_jti;
  END IF;

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
  SELECT s.person_id, s.id, s.subject_id, v_operational_date, s.hora_inicio, s.hora_fin, s.aula,
         'in_progress',
         GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((s.hora_fin::time - s.hora_inicio::time))) / 60)::integer),
         v_record.id
  FROM schedules s
  INNER JOIN personas p ON p.id = s.person_id
  INNER JOIN person_types pt ON pt.code = p.tipo_persona
  WHERE s.person_id = v_person_id
    AND s.active = true
    AND s.weekday = v_operational_dow
    AND s.valid_from <= v_operational_date
    AND (s.valid_until IS NULL OR s.valid_until >= v_operational_date)
    AND pt.generates_attendance = true;

  v_display := jsonb_build_object(
    'accepted', true, 'action', 'entry', 'reasonCode', v_reason,
    'registroId', v_record.id, 'personId', v_person_id,
    'matricula', v_matricula,
    'fullName', trim(coalesce(v_nombres, '') || ' ' || coalesce(v_apellidos, '')),
    'personType', v_tipo_persona, 'career', v_carrera,
    'vehicleId', v_vehicle_id, 'vehiclePlate', v_vehicle_plate,
    'credentialType', v_credential_type, 'accessMode', v_access_mode, 'timestamp', v_now
  );

  INSERT INTO access_scan_events (registro_acceso_id, person_id, vehicle_id, credential_type, access_mode,
    accepted, reason_code, jti, kid, signature_alg, signature_verified, display_payload, metadata)
    VALUES (v_record.id, v_person_id, v_vehicle_id, v_credential_type, v_access_mode,
    true, v_reason, v_pre_verified_jti, v_kid, v_sig_alg, v_signature_verified, v_display, v_safe_payload);

  RETURN v_display;
END;
$$;
