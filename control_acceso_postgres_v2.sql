-- PostgreSQL Schema v2.0 for Control Acceso UPQROO
-- Nuevas funcionalidades:
-- - Tipo persona "invitado"
-- - Campo "notas" en personas
-- - Fecha de caducidad de QR
-- - Sistema blockchain-like para registros de acceso
-- - Horarios de estudiantes para registro de asistencias potenciales
-- - Tabla de asistencias potenciales a materias

-- =====================================================
-- MODIFICACIONES A TABLAS EXISTENTES
-- =====================================================

-- Agregar tipo 'invitado' al CHECK constraint de personas
-- Y agregar columnas: notas, fecha_caducidad_qr
ALTER TABLE personas 
DROP CONSTRAINT IF EXISTS personas_tipo_persona_check;

ALTER TABLE personas 
ADD CONSTRAINT personas_tipo_persona_check 
CHECK (tipo_persona IN ('estudiante', 'docente', 'administrativo', 'invitado', 'otro'));

-- Agregar nuevas columnas a personas
ALTER TABLE personas ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT NULL;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS fecha_caducidad_qr TIMESTAMP DEFAULT NULL;

-- Agregar columnas para sistema blockchain-like en registros_acceso
ALTER TABLE registros_acceso ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT NULL;
ALTER TABLE registros_acceso ADD COLUMN IF NOT EXISTS hash_registro VARCHAR(64) DEFAULT NULL;
ALTER TABLE registros_acceso ADD COLUMN IF NOT EXISTS hash_anterior VARCHAR(64) DEFAULT NULL;
ALTER TABLE registros_acceso ADD COLUMN IF NOT EXISTS salida_automatica BOOLEAN DEFAULT FALSE;

-- =====================================================
-- NUEVAS TABLAS
-- =====================================================

-- Tabla de materias
CREATE TABLE IF NOT EXISTS materias (
    id_materia SERIAL PRIMARY KEY,
    nombre_materia VARCHAR(150) NOT NULL,
    clave_materia VARCHAR(20) NOT NULL UNIQUE,
    id_carrera INT REFERENCES carreras(id_carrera),
    creditos INT DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de horarios (horarios de materias por estudiante)
CREATE TABLE IF NOT EXISTS horarios_estudiante (
    id_horario SERIAL PRIMARY KEY,
    matricula VARCHAR(10) REFERENCES personas(matricula) ON DELETE CASCADE,
    id_materia INT REFERENCES materias(id_materia) ON DELETE CASCADE,
    dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Domingo, 1=Lunes, ..., 6=Sábado
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    aula VARCHAR(20) DEFAULT NULL,
    periodo VARCHAR(50) DEFAULT NULL, -- Ej: "2025-1", "2025-2"
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(matricula, id_materia, dia_semana, hora_inicio)
);

-- Tabla de asistencias potenciales a materias
-- Registra las materias a las que un estudiante potencialmente asiste según su horario
CREATE TABLE IF NOT EXISTS asistencias_potenciales (
    id_asistencia SERIAL PRIMARY KEY,
    id_registro INT REFERENCES registros_acceso(id_registro) ON DELETE CASCADE,
    matricula VARCHAR(10) REFERENCES personas(matricula),
    id_materia INT REFERENCES materias(id_materia),
    id_horario INT REFERENCES horarios_estudiante(id_horario),
    fecha_clase DATE NOT NULL,
    hora_entrada_registro TIMESTAMP NOT NULL, -- Hora cuando se escaneó el QR
    hora_inicio_clase TIME NOT NULL,
    hora_fin_clase TIME NOT NULL,
    minutos_asistidos INT NOT NULL, -- Minutos potenciales de asistencia
    minutos_totales_clase INT NOT NULL, -- Duración total de la clase
    porcentaje_asistencia DECIMAL(5,2) NOT NULL, -- % de asistencia potencial
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    clave VARCHAR(50) PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INSERTAR CONFIGURACIONES POR DEFECTO
-- =====================================================

INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
('tiempo_auto_escaneo', '3000', 'Tiempo en milisegundos para volver a escanear automáticamente'),
('hora_cierre_automatico', '00:00:00', 'Hora para marcar salidas automáticas (medianoche)')
ON CONFLICT (clave) DO NOTHING;

-- =====================================================
-- ÍNDICES PARA MEJOR RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_registros_hash ON registros_acceso(hash_registro);
CREATE INDEX IF NOT EXISTS idx_registros_hash_anterior ON registros_acceso(hash_anterior);
CREATE INDEX IF NOT EXISTS idx_horarios_matricula ON horarios_estudiante(matricula);
CREATE INDEX IF NOT EXISTS idx_horarios_dia_hora ON horarios_estudiante(dia_semana, hora_inicio, hora_fin);
CREATE INDEX IF NOT EXISTS idx_asistencias_matricula ON asistencias_potenciales(matricula);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias_potenciales(fecha_clase);
CREATE INDEX IF NOT EXISTS idx_asistencias_registro ON asistencias_potenciales(id_registro);
CREATE INDEX IF NOT EXISTS idx_personas_caducidad ON personas(fecha_caducidad_qr);

-- =====================================================
-- FUNCIONES PARA SISTEMA BLOCKCHAIN-LIKE
-- =====================================================

-- Función para generar hash de un registro
CREATE OR REPLACE FUNCTION generar_hash_registro(
    p_id_registro INT,
    p_matricula VARCHAR,
    p_hora_entrada TIMESTAMP,
    p_hash_anterior VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
    v_data TEXT;
    v_hash VARCHAR;
BEGIN
    -- Concatenar datos del registro con el hash anterior
    v_data := COALESCE(p_id_registro::TEXT, '') || 
              COALESCE(p_matricula, '') || 
              COALESCE(p_hora_entrada::TEXT, '') || 
              COALESCE(p_hash_anterior, 'GENESIS');
    
    -- Generar hash SHA-256
    v_hash := encode(sha256(v_data::bytea), 'hex');
    
    RETURN v_hash;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener el último hash de la cadena
CREATE OR REPLACE FUNCTION obtener_ultimo_hash() RETURNS VARCHAR AS $$
DECLARE
    v_hash VARCHAR;
BEGIN
    SELECT hash_registro INTO v_hash
    FROM registros_acceso
    WHERE hash_registro IS NOT NULL
    ORDER BY id_registro DESC
    LIMIT 1;
    
    RETURN COALESCE(v_hash, 'GENESIS');
END;
$$ LANGUAGE plpgsql;

-- Función para verificar integridad de la cadena
CREATE OR REPLACE FUNCTION verificar_integridad_cadena() 
RETURNS TABLE(id_registro INT, matricula VARCHAR, hora_entrada TIMESTAMP, es_valido BOOLEAN, mensaje TEXT) AS $$
DECLARE
    r RECORD;
    v_hash_calculado VARCHAR;
    v_hash_anterior_esperado VARCHAR := 'GENESIS';
BEGIN
    FOR r IN 
        SELECT ra.id_registro, ra.matricula, ra.hora_entrada, ra.hash_registro, ra.hash_anterior
        FROM registros_acceso ra
        WHERE ra.hash_registro IS NOT NULL
        ORDER BY ra.id_registro ASC
    LOOP
        -- Verificar que el hash anterior coincida con el esperado
        IF r.hash_anterior != v_hash_anterior_esperado THEN
            id_registro := r.id_registro;
            matricula := r.matricula;
            hora_entrada := r.hora_entrada;
            es_valido := FALSE;
            mensaje := 'Hash anterior no coincide. Esperado: ' || v_hash_anterior_esperado || ', Encontrado: ' || r.hash_anterior;
            RETURN NEXT;
            CONTINUE;
        END IF;
        
        -- Verificar que el hash del registro sea correcto
        v_hash_calculado := generar_hash_registro(r.id_registro, r.matricula, r.hora_entrada, r.hash_anterior);
        
        IF r.hash_registro != v_hash_calculado THEN
            id_registro := r.id_registro;
            matricula := r.matricula;
            hora_entrada := r.hora_entrada;
            es_valido := FALSE;
            mensaje := 'Hash de registro no coincide. El registro pudo haber sido alterado.';
            RETURN NEXT;
        ELSE
            id_registro := r.id_registro;
            matricula := r.matricula;
            hora_entrada := r.hora_entrada;
            es_valido := TRUE;
            mensaje := 'Registro válido';
            RETURN NEXT;
        END IF;
        
        v_hash_anterior_esperado := r.hash_registro;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PROCEDIMIENTOS ACTUALIZADOS CON BLOCKCHAIN
-- =====================================================

-- Procedimiento actualizado para registrar entrada con blockchain
CREATE OR REPLACE PROCEDURE registrar_entrada_v2(
    p_matricula VARCHAR, 
    p_id_admin INT,
    p_notas TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_registro INT;
    v_hash_anterior VARCHAR;
    v_hash_nuevo VARCHAR;
    v_hora_entrada TIMESTAMP;
BEGIN
    -- Bloquear la tabla para prevenir race conditions en el blockchain
    LOCK TABLE registros_acceso IN EXCLUSIVE MODE;
    
    -- Obtener último hash
    v_hash_anterior := obtener_ultimo_hash();
    
    -- Insertar registro y capturar hora_entrada
    INSERT INTO registros_acceso (matricula, hora_entrada, id_admin_entrada, notas, hash_anterior)
    VALUES (p_matricula, NOW(), p_id_admin, p_notas, v_hash_anterior)
    RETURNING id_registro, hora_entrada INTO v_id_registro, v_hora_entrada;
    
    -- Generar y actualizar hash del nuevo registro usando la misma hora_entrada
    v_hash_nuevo := generar_hash_registro(v_id_registro, p_matricula, v_hora_entrada, v_hash_anterior);
    
    UPDATE registros_acceso 
    SET hash_registro = v_hash_nuevo
    WHERE id_registro = v_id_registro;
END;
$$;

-- Procedimiento para registrar salida (no modifica hash, solo actualiza hora_salida)
CREATE OR REPLACE PROCEDURE registrar_salida_v2(
    p_matricula VARCHAR, 
    p_id_admin INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE registros_acceso 
    SET hora_salida = NOW(),
        id_admin_salida = p_id_admin
    WHERE matricula = p_matricula 
    AND DATE(hora_entrada) = CURRENT_DATE 
    AND hora_salida IS NULL;
END;
$$;

-- Procedimiento para marcar salidas automáticas a medianoche
CREATE OR REPLACE PROCEDURE marcar_salidas_automaticas()
LANGUAGE plpgsql
AS $$
BEGIN
    -- Marcar todos los registros del día anterior sin hora de salida
    UPDATE registros_acceso 
    SET hora_salida = DATE(hora_entrada) + INTERVAL '23 hours 59 minutes 59 seconds',
        salida_automatica = TRUE
    WHERE DATE(hora_entrada) < CURRENT_DATE 
    AND hora_salida IS NULL;
END;
$$;

-- =====================================================
-- FUNCIÓN PARA CALCULAR ASISTENCIAS POTENCIALES
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
BEGIN
    -- Extraer día de la semana (0=Domingo) y hora
    v_dia_semana := EXTRACT(DOW FROM p_hora_entrada);
    v_hora_entrada := p_hora_entrada::TIME;
    v_fecha_clase := p_hora_entrada::DATE;
    
    -- Buscar todas las clases del estudiante para ese día
    FOR r IN 
        SELECT he.id_horario, he.id_materia, he.hora_inicio, he.hora_fin
        FROM horarios_estudiante he
        WHERE he.matricula = p_matricula 
        AND he.dia_semana = v_dia_semana
        AND he.activo = TRUE
        AND v_hora_entrada < he.hora_fin -- Solo si llegó antes de que termine la clase
    LOOP
        -- Calcular minutos totales de la clase
        v_minutos_totales := EXTRACT(EPOCH FROM (r.hora_fin - r.hora_inicio)) / 60;
        
        -- Calcular minutos asistidos (desde que llegó hasta el fin de la clase)
        IF v_hora_entrada <= r.hora_inicio THEN
            -- Llegó antes o a tiempo
            v_minutos_asistidos := v_minutos_totales;
        ELSE
            -- Llegó tarde
            v_minutos_asistidos := EXTRACT(EPOCH FROM (r.hora_fin - v_hora_entrada)) / 60;
        END IF;
        
        -- Asegurar que los minutos asistidos no sean negativos
        IF v_minutos_asistidos < 0 THEN
            v_minutos_asistidos := 0;
        END IF;
        
        -- Calcular porcentaje
        v_porcentaje := (v_minutos_asistidos::DECIMAL / v_minutos_totales::DECIMAL) * 100;
        
        -- Insertar asistencia potencial
        INSERT INTO asistencias_potenciales (
            id_registro, matricula, id_materia, id_horario,
            fecha_clase, hora_entrada_registro, hora_inicio_clase, hora_fin_clase,
            minutos_asistidos, minutos_totales_clase, porcentaje_asistencia
        ) VALUES (
            p_id_registro, p_matricula, r.id_materia, r.id_horario,
            v_fecha_clase, p_hora_entrada, r.hora_inicio, r.hora_fin,
            v_minutos_asistidos, v_minutos_totales, v_porcentaje
        );
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VISTA ACTUALIZADA PARA REGISTROS DE HOY
-- =====================================================

DROP VIEW IF EXISTS registros_hoy;

CREATE OR REPLACE VIEW registros_hoy AS
SELECT 
    r.id_registro,
    r.matricula,
    p.nombres,
    p.apellidos,
    p.tipo_persona,
    c.nombre_carrera,
    r.hora_entrada,
    r.hora_salida,
    r.notas,
    r.salida_automatica,
    r.hash_registro,
    a1.nombre AS admin_entrada,
    a2.nombre AS admin_salida
FROM registros_acceso r
JOIN personas p ON r.matricula = p.matricula
LEFT JOIN carreras c ON p.id_carrera = c.id_carrera
LEFT JOIN administradores a1 ON r.id_admin_entrada = a1.id
LEFT JOIN administradores a2 ON r.id_admin_salida = a2.id
WHERE DATE(r.hora_entrada) = CURRENT_DATE
ORDER BY r.hora_entrada DESC;

-- =====================================================
-- DATOS DE EJEMPLO PARA MATERIAS
-- =====================================================

INSERT INTO materias (nombre_materia, clave_materia, id_carrera, creditos) VALUES
('Programación I', 'PROG1', 1, 6),
('Programación II', 'PROG2', 1, 6),
('Base de Datos', 'BD01', 1, 6),
('Inglés I', 'ING1', NULL, 4),
('Inglés II', 'ING2', NULL, 4),
('Cálculo Diferencial', 'CALC1', NULL, 6),
('Álgebra Lineal', 'ALG1', NULL, 6),
('Física', 'FIS1', NULL, 6)
ON CONFLICT (clave_materia) DO NOTHING;

-- =====================================================
-- COMENTARIOS PARA FUTURAS MEJORAS
-- =====================================================

/*
 * FUTURAS MEJORAS DE GRAFICACIÓN DE ASISTENCIAS:
 * 
 * 1. Vista/Dashboard para visualizar asistencias por estudiante:
 *    - Gráfico de barras: % de asistencia por materia
 *    - Gráfico de líneas: tendencia de asistencia a lo largo del tiempo
 *    - Heatmap: asistencia por día de la semana y hora
 * 
 * 2. Reportes agregados:
 *    - Asistencia promedio por carrera
 *    - Materias con mayor/menor asistencia
 *    - Estudiantes con asistencia crítica (<70%)
 * 
 * 3. Alertas automáticas:
 *    - Notificar cuando un estudiante tenga baja asistencia
 *    - Generar reportes semanales/mensuales
 * 
 * 4. Exportación de datos:
 *    - PDF de reportes de asistencia
 *    - Excel con datos detallados
 *    - API para integración con sistemas académicos
 * 
 * 5. Predicción de asistencia:
 *    - Usar ML para predecir patrones de asistencia
 *    - Identificar estudiantes en riesgo de deserción
 */
