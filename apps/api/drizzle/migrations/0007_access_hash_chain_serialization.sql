-- Serialize global access hash-chain assignment.
-- access_scan_v1 already serializes state changes per person/vehicle, but the
-- audit hash chain is global. Concurrent scans over different subjects can read
-- the same predecessor unless this narrow section is serialized.

CREATE OR REPLACE FUNCTION access_hash_chain_assign_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_hash_anterior text;
  v_previous_entrada timestamptz;
  v_chain_at timestamptz;
BEGIN
  IF OLD.hash_registro IS NOT NULL OR NEW.hash_registro IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('access:hash-chain'));

  SELECT hash_registro, entrada_at
  INTO v_hash_anterior, v_previous_entrada
  FROM registros_acceso
  WHERE hash_registro IS NOT NULL
    AND id <> NEW.id
  ORDER BY entrada_at DESC, id DESC
  LIMIT 1;

  v_chain_at := clock_timestamp();

  IF v_previous_entrada IS NOT NULL AND v_chain_at <= v_previous_entrada THEN
    v_chain_at := v_previous_entrada + interval '1 microsecond';
  END IF;

  NEW.entrada_at := v_chain_at;

  IF NEW.salida_at IS NOT NULL AND NEW.salida_at < NEW.entrada_at THEN
    NEW.salida_at := NEW.entrada_at;
  END IF;

  NEW.hash_anterior := v_hash_anterior;
  NEW.hash_registro := encode(digest(concat_ws(
    '|',
    NEW.id::text,
    coalesce(NEW.person_id::text, ''),
    coalesce(NEW.vehicle_id::text, ''),
    NEW.entrada_at::text,
    coalesce(NEW.hash_anterior, '')
  ), 'sha256'), 'hex');

  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS registros_acceso_hash_chain_assign
ON registros_acceso;--> statement-breakpoint

CREATE TRIGGER registros_acceso_hash_chain_assign
BEFORE UPDATE OF hash_registro ON registros_acceso
FOR EACH ROW
WHEN (OLD.hash_registro IS NULL AND NEW.hash_registro IS NOT NULL)
EXECUTE FUNCTION access_hash_chain_assign_v1();
