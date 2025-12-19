-- PostgreSQL Schema v3.0 - Sistema Híbrido de Asistencias
-- Nuevas funcionalidades:
-- - Sistema híbrido: registra clases inmediatas + futuras como pendientes
-- - Estados de asistencia: confirmed, in_progress, assumed, partial, unverified
-- - Actualización automática al registrar salida

-- =====================================================
-- MODIFICACIONES A TABLA ASISTENCIAS_POTENCIALES
-- =====================================================

ALTER TABLE asistencias_potenciales 
ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'in_progress';

ALTER TABLE asistencias_potenciales 
ADD COLUMN IF NOT EXISTS hora_salida_registro TIMESTAMP DEFAULT NULL;

-- Eliminar constraint si existe
ALTER TABLE asistencias_potenciales
DROP CONSTRAINT IF EXISTS asistencias_estado_check;

-- Crear constraint
ALTER TABLE asistencias_potenciales
ADD CONSTRAINT asistencias_estado_check 
CHECK (estado IN ('confirmed', 'in_progress', 'assumed', 'partial', 'unverified'));

CREATE INDEX IF NOT EXISTS idx_asistencias_estado ON asistencias_potenciales(estado);

-- =====================================================
-- FUNCIÓN HÍBRIDA: REGISTRAR ASISTENCIAS POTENCIALES
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_asistencias_potenciales(
    p_id_registro INT,
    p_matricula VARCHAR,
    p_hora_entrada TIMESTAMP
) RETURNS INT AS $$
DECLARE
    v_dia_semana INT;
    v_hora_entrada TIME;
    v_fecha_clase DATE;
    v_count INT := 0;
    r RECORD;
    v_minutos_asistidos INT;
    v_minutos_totales INT;
    v_porcentaje DECIMAL(5,2);
    v_estado VARCHAR(20);
BEGIN
    v_dia_semana := EXTRACT(DOW FROM p_hora_entrada);
    v_hora_entrada := p_hora_entrada::TIME;
    v_fecha_clase := p_hora_entrada::DATE;
    
    FOR r IN 
        SELECT he.id_horario, he.id_materia, he.hora_inicio, he.hora_fin
        FROM horarios_estudiante he
        WHERE he.matricula = p_matricula 
        AND he.dia_semana = v_dia_semana
        AND he.activo = TRUE
        ORDER BY he.hora_inicio
    LOOP
        v_minutos_totales := EXTRACT(EPOCH FROM (r.hora_fin - r.hora_inicio)) / 60;
        
        IF v_hora_entrada > r.hora_fin THEN
            CONTINUE;
        ELSIF v_hora_entrada <= r.hora_inicio THEN
            v_minutos_asistidos := v_minutos_totales;
            v_estado := 'in_progress';
        ELSE
            v_minutos_asistidos := EXTRACT(EPOCH FROM (r.hora_fin - v_hora_entrada)) / 60;
            v_estado := 'in_progress';
        END IF;
        
        IF v_minutos_asistidos < 0 THEN
            v_minutos_asistidos := 0;
        END IF;
        
        v_porcentaje := (v_minutos_asistidos::DECIMAL / v_minutos_totales::DECIMAL) * 100;
        
        INSERT INTO asistencias_potenciales (
            id_registro, matricula, id_materia, id_horario,
            fecha_clase, hora_entrada_registro, hora_inicio_clase, hora_fin_clase,
            minutos_asistidos, minutos_totales_clase, porcentaje_asistencia, estado
        ) VALUES (
            p_id_registro, p_matricula, r.id_materia, r.id_horario,
            v_fecha_clase, p_hora_entrada, r.hora_inicio, r.hora_fin,
            v_minutos_asistidos, v_minutos_totales, v_porcentaje, v_estado
        );
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: ACTUALIZAR ASISTENCIAS AL SALIR
-- =====================================================

CREATE OR REPLACE FUNCTION actualizar_asistencias_al_salir(
    p_id_registro INT,
    p_hora_salida TIMESTAMP
) RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    r RECORD;
    v_hora_salida TIME;
    v_minutos_asistidos INT;
    v_minutos_totales INT;
    v_porcentaje DECIMAL(5,2);
    v_estado VARCHAR(20);
BEGIN
    v_hora_salida := p_hora_salida::TIME;
    
    FOR r IN 
        SELECT ap.id_asistencia, ap.hora_inicio_clase, ap.hora_fin_clase, 
               ap.hora_entrada_registro, ap.minutos_totales_clase
        FROM asistencias_potenciales ap
        WHERE ap.id_registro = p_id_registro
        AND ap.estado = 'in_progress'
    LOOP
        v_minutos_totales := r.minutos_totales_clase;
        
        IF v_hora_salida <= r.hora_inicio_clase THEN
            v_minutos_asistidos := 0;
            v_porcentaje := 0;
            v_estado := 'unverified';
        ELSIF v_hora_salida >= r.hora_fin_clase THEN
            IF (r.hora_entrada_registro::TIME) <= r.hora_inicio_clase THEN
                v_minutos_asistidos := v_minutos_totales;
            ELSE
                v_minutos_asistidos := EXTRACT(EPOCH FROM (r.hora_fin_clase - (r.hora_entrada_registro::TIME))) / 60;
            END IF;
            v_porcentaje := (v_minutos_asistidos::DECIMAL / v_minutos_totales::DECIMAL) * 100;
            v_estado := 'confirmed';
        ELSE
            IF (r.hora_entrada_registro::TIME) <= r.hora_inicio_clase THEN
                v_minutos_asistidos := EXTRACT(EPOCH FROM (v_hora_salida - r.hora_inicio_clase)) / 60;
            ELSE
                v_minutos_asistidos := EXTRACT(EPOCH FROM (v_hora_salida - (r.hora_entrada_registro::TIME))) / 60;
            END IF;
            v_porcentaje := (v_minutos_asistidos::DECIMAL / v_minutos_totales::DECIMAL) * 100;
            v_estado := 'partial';
        END IF;
        
        IF v_minutos_asistidos < 0 THEN
            v_minutos_asistidos := 0;
            v_porcentaje := 0;
        END IF;
        
        UPDATE asistencias_potenciales
        SET minutos_asistidos = v_minutos_asistidos,
            porcentaje_asistencia = v_porcentaje,
            estado = v_estado,
            hora_salida_registro = p_hora_salida
        WHERE id_asistencia = r.id_asistencia;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: ACTUALIZAR ASISTENCIAS A ESTADO ASUMIDO
-- =====================================================

CREATE OR REPLACE FUNCTION actualizar_asistencias_asumidas(
    p_id_registro INT,
    p_hora_salida_automatica TIMESTAMP
) RETURNS INT AS $$
DECLARE
    v_count INT := 0;
BEGIN
    UPDATE asistencias_potenciales
    SET estado = 'assumed',
        hora_salida_registro = p_hora_salida_automatica
    WHERE id_registro = p_id_registro
    AND estado = 'in_progress';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PROCEDIMIENTO: MARCAR SALIDAS AUTOMÁTICAS V2
-- =====================================================

CREATE OR REPLACE PROCEDURE marcar_salidas_automaticas()
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
    v_hora_salida TIMESTAMP;
BEGIN
    FOR r IN 
        SELECT id_registro, hora_entrada
        FROM registros_acceso 
        WHERE DATE(hora_entrada) < CURRENT_DATE 
        AND hora_salida IS NULL
    LOOP
        v_hora_salida := DATE(r.hora_entrada) + INTERVAL '23 hours 59 minutes 59 seconds';
        
        UPDATE registros_acceso 
        SET hora_salida = v_hora_salida,
            salida_automatica = TRUE
        WHERE id_registro = r.id_registro;
        
        PERFORM actualizar_asistencias_asumidas(r.id_registro, v_hora_salida);
    END LOOP;
END;
$$;

-- =====================================================
-- PROCEDIMIENTO: REGISTRAR SALIDA V3 CON ASISTENCIAS
-- =====================================================

CREATE OR REPLACE PROCEDURE registrar_salida_v3(
    p_matricula VARCHAR, 
    p_id_admin INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_registro INT;
    v_hora_salida TIMESTAMP := NOW();
BEGIN
    SELECT id_registro INTO v_id_registro
    FROM registros_acceso
    WHERE matricula = p_matricula 
    AND DATE(hora_entrada) = CURRENT_DATE 
    AND hora_salida IS NULL;
    
    IF v_id_registro IS NOT NULL THEN
        UPDATE registros_acceso 
        SET hora_salida = v_hora_salida,
            id_admin_salida = p_id_admin
        WHERE id_registro = v_id_registro;
        
        PERFORM actualizar_asistencias_al_salir(v_id_registro, v_hora_salida);
    END IF;
END;
$$;

-- =====================================================
-- VISTA: ASISTENCIAS CON ESTADO
-- =====================================================

CREATE OR REPLACE VIEW vista_asistencias_con_estado AS
SELECT 
    ap.id_asistencia,
    ap.id_registro,
    ap.matricula,
    p.nombres,
    p.apellidos,
    m.nombre_materia,
    m.clave_materia,
    ap.fecha_clase,
    ap.hora_inicio_clase,
    ap.hora_fin_clase,
    ap.hora_entrada_registro,
    ap.hora_salida_registro,
    ap.minutos_asistidos,
    ap.minutos_totales_clase,
    ap.porcentaje_asistencia,
    ap.estado,
    CASE 
        WHEN ap.estado = 'confirmed' THEN 'Confirmada'
        WHEN ap.estado = 'in_progress' THEN 'En curso'
        WHEN ap.estado = 'assumed' THEN 'Asumida'
        WHEN ap.estado = 'partial' THEN 'Parcial'
        WHEN ap.estado = 'unverified' THEN 'Sin verificar'
    END as estado_descripcion,
    r.salida_automatica
FROM asistencias_potenciales ap
JOIN personas p ON ap.matricula = p.matricula
JOIN materias m ON ap.id_materia = m.id_materia
JOIN registros_acceso r ON ap.id_registro = r.id_registro
ORDER BY ap.fecha_clase DESC, ap.hora_inicio_clase;

-- =====================================================
-- MIGRAR DATOS EXISTENTES
-- =====================================================

UPDATE asistencias_potenciales
SET estado = 'in_progress'
WHERE estado IS NULL;
