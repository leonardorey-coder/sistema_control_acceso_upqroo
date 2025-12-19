--
-- PostgreSQL database dump
--

\restrict qVDcXDLh9bZbqCAvtBwPMmieeWOYxCIBx4weEf46LaXRk7BLslmOBemSz2AgBJP

-- Dumped from database version 16.11 (Homebrew)
-- Dumped by pg_dump version 16.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: actualizar_asistencias_al_salir(integer, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.actualizar_asistencias_al_salir(p_id_registro integer, p_hora_salida timestamp without time zone) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: actualizar_asistencias_asumidas(integer, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.actualizar_asistencias_asumidas(p_id_registro integer, p_hora_salida_automatica timestamp without time zone) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: generar_hash_registro(integer, character varying, timestamp without time zone, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generar_hash_registro(p_id_registro integer, p_matricula character varying, p_hora_entrada timestamp without time zone, p_hash_anterior character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: marcar_salidas_automaticas(); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.marcar_salidas_automaticas()
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


--
-- Name: obtener_ultimo_hash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.obtener_ultimo_hash() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: registrar_asistencias_potenciales(integer, character varying, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_asistencias_potenciales(p_id_registro integer, p_matricula character varying, p_hora_entrada timestamp without time zone) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: registrar_entrada(character varying, integer); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.registrar_entrada(IN p_matricula character varying, IN p_id_admin integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO registros_acceso (matricula, hora_entrada, id_admin_entrada)
    VALUES (p_matricula, NOW(), p_id_admin);
END;
$$;


--
-- Name: registrar_entrada_v2(character varying, integer, text); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.registrar_entrada_v2(IN p_matricula character varying, IN p_id_admin integer, IN p_notas text DEFAULT NULL::text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_registro INT;
    v_hash_anterior VARCHAR;
    v_hash_nuevo VARCHAR;
    v_hora_actual TIMESTAMP := NOW();
BEGIN
    -- Bloquear la tabla para prevenir race conditions en el blockchain
    LOCK TABLE registros_acceso IN EXCLUSIVE MODE;
    
    -- Obtener último hash
    v_hash_anterior := obtener_ultimo_hash();
    
    -- Insertar registro
    INSERT INTO registros_acceso (matricula, hora_entrada, id_admin_entrada, notas, hash_anterior)
    VALUES (p_matricula, v_hora_actual, p_id_admin, p_notas, v_hash_anterior)
    RETURNING id_registro INTO v_id_registro;
    
    -- Generar y actualizar hash del nuevo registro
    v_hash_nuevo := generar_hash_registro(v_id_registro, p_matricula, v_hora_actual, v_hash_anterior);
    
    UPDATE registros_acceso 
    SET hash_registro = v_hash_nuevo
    WHERE id_registro = v_id_registro;
END;
$$;


--
-- Name: registrar_salida(character varying, integer); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.registrar_salida(IN p_matricula character varying, IN p_id_admin integer)
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


--
-- Name: registrar_salida_v2(character varying, integer); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.registrar_salida_v2(IN p_matricula character varying, IN p_id_admin integer)
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


--
-- Name: registrar_salida_v3(character varying, integer); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.registrar_salida_v3(IN p_matricula character varying, IN p_id_admin integer)
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


--
-- Name: verificar_integridad_cadena(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verificar_integridad_cadena() RETURNS TABLE(id_registro integer, matricula character varying, hora_entrada timestamp without time zone, es_valido boolean, mensaje text)
    LANGUAGE plpgsql
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: administradores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.administradores (
    id integer NOT NULL,
    usuario character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    nombre character varying(100) NOT NULL,
    ultimo_acceso timestamp without time zone,
    estado character varying(20) DEFAULT 'activo'::character varying,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    token character varying(255) DEFAULT NULL::character varying,
    CONSTRAINT administradores_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: administradores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.administradores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: administradores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.administradores_id_seq OWNED BY public.administradores.id;


--
-- Name: asistencias_potenciales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asistencias_potenciales (
    id_asistencia integer NOT NULL,
    id_registro integer,
    matricula character varying(10),
    id_materia integer,
    id_horario integer,
    fecha_clase date NOT NULL,
    hora_entrada_registro timestamp without time zone NOT NULL,
    hora_inicio_clase time without time zone NOT NULL,
    hora_fin_clase time without time zone NOT NULL,
    minutos_asistidos integer NOT NULL,
    minutos_totales_clase integer NOT NULL,
    porcentaje_asistencia numeric(5,2) NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado character varying(20) DEFAULT 'in_progress'::character varying,
    hora_salida_registro timestamp without time zone,
    CONSTRAINT asistencias_estado_check CHECK (((estado)::text = ANY ((ARRAY['confirmed'::character varying, 'in_progress'::character varying, 'assumed'::character varying, 'partial'::character varying, 'unverified'::character varying])::text[])))
);


--
-- Name: asistencias_potenciales_id_asistencia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asistencias_potenciales_id_asistencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asistencias_potenciales_id_asistencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asistencias_potenciales_id_asistencia_seq OWNED BY public.asistencias_potenciales.id_asistencia;


--
-- Name: carreras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carreras (
    id_carrera integer NOT NULL,
    nombre_carrera character varying(100) NOT NULL,
    clave_carrera character varying(10) NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: carreras_id_carrera_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carreras_id_carrera_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carreras_id_carrera_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carreras_id_carrera_seq OWNED BY public.carreras.id_carrera;


--
-- Name: configuracion_sistema; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_sistema (
    clave character varying(50) NOT NULL,
    valor text NOT NULL,
    descripcion text,
    fecha_modificacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: horarios_estudiante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios_estudiante (
    id_horario integer NOT NULL,
    matricula character varying(10),
    id_materia integer,
    dia_semana integer NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    aula character varying(20) DEFAULT NULL::character varying,
    periodo character varying(50) DEFAULT NULL::character varying,
    activo boolean DEFAULT true,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT horarios_estudiante_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)))
);


--
-- Name: horarios_estudiante_id_horario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.horarios_estudiante_id_horario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: horarios_estudiante_id_horario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.horarios_estudiante_id_horario_seq OWNED BY public.horarios_estudiante.id_horario;


--
-- Name: hot_qr_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hot_qr_codes (
    id_hot_qr integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre_visitante character varying(100) NOT NULL,
    motivo character varying(255) DEFAULT NULL::character varying,
    id_admin_creador integer,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion timestamp without time zone NOT NULL,
    usado boolean DEFAULT false,
    fecha_uso timestamp without time zone,
    id_admin_registro integer,
    activo boolean DEFAULT true
);


--
-- Name: hot_qr_codes_id_hot_qr_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hot_qr_codes_id_hot_qr_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hot_qr_codes_id_hot_qr_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hot_qr_codes_id_hot_qr_seq OWNED BY public.hot_qr_codes.id_hot_qr;


--
-- Name: hot_qr_hoy; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.hot_qr_hoy AS
 SELECT h.id_hot_qr,
    h.codigo,
    h.nombre_visitante,
    h.motivo,
    h.fecha_creacion,
    h.fecha_expiracion,
    h.usado,
    h.fecha_uso,
    h.activo,
    a1.nombre AS admin_creador,
    a2.nombre AS admin_registro
   FROM ((public.hot_qr_codes h
     LEFT JOIN public.administradores a1 ON ((h.id_admin_creador = a1.id)))
     LEFT JOIN public.administradores a2 ON ((h.id_admin_registro = a2.id)))
  WHERE (date(h.fecha_creacion) = CURRENT_DATE)
  ORDER BY h.fecha_creacion DESC;


--
-- Name: materias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materias (
    id_materia integer NOT NULL,
    nombre_materia character varying(150) NOT NULL,
    clave_materia character varying(20) NOT NULL,
    id_carrera integer,
    creditos integer DEFAULT 0,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: materias_id_materia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.materias_id_materia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: materias_id_materia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.materias_id_materia_seq OWNED BY public.materias.id_materia;


--
-- Name: personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personas (
    matricula character varying(10) NOT NULL,
    nombres character varying(50) NOT NULL,
    apellidos character varying(100) NOT NULL,
    curp character varying(18) NOT NULL,
    id_carrera integer,
    foto_perfil bytea,
    tipo_persona character varying(20) NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notas text,
    fecha_caducidad_qr timestamp without time zone,
    CONSTRAINT personas_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[]))),
    CONSTRAINT personas_tipo_persona_check CHECK (((tipo_persona)::text = ANY ((ARRAY['estudiante'::character varying, 'docente'::character varying, 'administrativo'::character varying, 'invitado'::character varying, 'aspirante'::character varying, 'otro'::character varying])::text[])))
);


--
-- Name: registros_acceso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registros_acceso (
    id_registro integer NOT NULL,
    matricula character varying(10),
    hora_entrada timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    hora_salida timestamp without time zone,
    id_admin_entrada integer,
    id_admin_salida integer,
    notas text,
    hash_registro character varying(64) DEFAULT NULL::character varying,
    hash_anterior character varying(64) DEFAULT NULL::character varying,
    salida_automatica boolean DEFAULT false
);


--
-- Name: registros_acceso_id_registro_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registros_acceso_id_registro_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: registros_acceso_id_registro_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registros_acceso_id_registro_seq OWNED BY public.registros_acceso.id_registro;


--
-- Name: registros_hoy; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.registros_hoy AS
 SELECT r.id_registro,
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
   FROM ((((public.registros_acceso r
     JOIN public.personas p ON (((r.matricula)::text = (p.matricula)::text)))
     LEFT JOIN public.carreras c ON ((p.id_carrera = c.id_carrera)))
     LEFT JOIN public.administradores a1 ON ((r.id_admin_entrada = a1.id)))
     LEFT JOIN public.administradores a2 ON ((r.id_admin_salida = a2.id)))
  WHERE (date(r.hora_entrada) = CURRENT_DATE)
  ORDER BY r.hora_entrada DESC;


--
-- Name: vista_asistencias_con_estado; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vista_asistencias_con_estado AS
 SELECT ap.id_asistencia,
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
            WHEN ((ap.estado)::text = 'confirmed'::text) THEN 'Confirmada'::text
            WHEN ((ap.estado)::text = 'in_progress'::text) THEN 'En curso'::text
            WHEN ((ap.estado)::text = 'assumed'::text) THEN 'Asumida'::text
            WHEN ((ap.estado)::text = 'partial'::text) THEN 'Parcial'::text
            WHEN ((ap.estado)::text = 'unverified'::text) THEN 'Sin verificar'::text
            ELSE NULL::text
        END AS estado_descripcion,
    r.salida_automatica
   FROM (((public.asistencias_potenciales ap
     JOIN public.personas p ON (((ap.matricula)::text = (p.matricula)::text)))
     JOIN public.materias m ON ((ap.id_materia = m.id_materia)))
     JOIN public.registros_acceso r ON ((ap.id_registro = r.id_registro)))
  ORDER BY ap.fecha_clase DESC, ap.hora_inicio_clase;


--
-- Name: administradores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.administradores ALTER COLUMN id SET DEFAULT nextval('public.administradores_id_seq'::regclass);


--
-- Name: asistencias_potenciales id_asistencia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_potenciales ALTER COLUMN id_asistencia SET DEFAULT nextval('public.asistencias_potenciales_id_asistencia_seq'::regclass);


--
-- Name: carreras id_carrera; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carreras ALTER COLUMN id_carrera SET DEFAULT nextval('public.carreras_id_carrera_seq'::regclass);


--
-- Name: horarios_estudiante id_horario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_estudiante ALTER COLUMN id_horario SET DEFAULT nextval('public.horarios_estudiante_id_horario_seq'::regclass);


--
-- Name: hot_qr_codes id_hot_qr; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_qr_codes ALTER COLUMN id_hot_qr SET DEFAULT nextval('public.hot_qr_codes_id_hot_qr_seq'::regclass);


--
-- Name: materias id_materia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materias ALTER COLUMN id_materia SET DEFAULT nextval('public.materias_id_materia_seq'::regclass);


--
-- Name: registros_acceso id_registro; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_acceso ALTER COLUMN id_registro SET DEFAULT nextval('public.registros_acceso_id_registro_seq'::regclass);


--
-- Name: administradores administradores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.administradores
    ADD CONSTRAINT administradores_pkey PRIMARY KEY (id);


--
-- Name: administradores administradores_usuario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.administradores
    ADD CONSTRAINT administradores_usuario_key UNIQUE (usuario);


--
-- Name: asistencias_potenciales asistencias_potenciales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_potenciales
    ADD CONSTRAINT asistencias_potenciales_pkey PRIMARY KEY (id_asistencia);


--
-- Name: carreras carreras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carreras
    ADD CONSTRAINT carreras_pkey PRIMARY KEY (id_carrera);


--
-- Name: configuracion_sistema configuracion_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_sistema
    ADD CONSTRAINT configuracion_sistema_pkey PRIMARY KEY (clave);


--
-- Name: horarios_estudiante horarios_estudiante_matricula_id_materia_dia_semana_hora_in_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_estudiante
    ADD CONSTRAINT horarios_estudiante_matricula_id_materia_dia_semana_hora_in_key UNIQUE (matricula, id_materia, dia_semana, hora_inicio);


--
-- Name: horarios_estudiante horarios_estudiante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_estudiante
    ADD CONSTRAINT horarios_estudiante_pkey PRIMARY KEY (id_horario);


--
-- Name: hot_qr_codes hot_qr_codes_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_qr_codes
    ADD CONSTRAINT hot_qr_codes_codigo_key UNIQUE (codigo);


--
-- Name: hot_qr_codes hot_qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_qr_codes
    ADD CONSTRAINT hot_qr_codes_pkey PRIMARY KEY (id_hot_qr);


--
-- Name: materias materias_clave_materia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_clave_materia_key UNIQUE (clave_materia);


--
-- Name: materias materias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_pkey PRIMARY KEY (id_materia);


--
-- Name: personas personas_curp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personas
    ADD CONSTRAINT personas_curp_key UNIQUE (curp);


--
-- Name: personas personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personas
    ADD CONSTRAINT personas_pkey PRIMARY KEY (matricula);


--
-- Name: registros_acceso registros_acceso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_acceso
    ADD CONSTRAINT registros_acceso_pkey PRIMARY KEY (id_registro);


--
-- Name: idx_asistencias_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asistencias_estado ON public.asistencias_potenciales USING btree (estado);


--
-- Name: idx_asistencias_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asistencias_fecha ON public.asistencias_potenciales USING btree (fecha_clase);


--
-- Name: idx_asistencias_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asistencias_matricula ON public.asistencias_potenciales USING btree (matricula);


--
-- Name: idx_asistencias_registro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asistencias_registro ON public.asistencias_potenciales USING btree (id_registro);


--
-- Name: idx_horarios_dia_hora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_horarios_dia_hora ON public.horarios_estudiante USING btree (dia_semana, hora_inicio, hora_fin);


--
-- Name: idx_horarios_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_horarios_matricula ON public.horarios_estudiante USING btree (matricula);


--
-- Name: idx_hot_qr_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hot_qr_activo ON public.hot_qr_codes USING btree (activo, usado);


--
-- Name: idx_hot_qr_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hot_qr_codigo ON public.hot_qr_codes USING btree (codigo);


--
-- Name: idx_hot_qr_expiracion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hot_qr_expiracion ON public.hot_qr_codes USING btree (fecha_expiracion);


--
-- Name: idx_personas_caducidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personas_caducidad ON public.personas USING btree (fecha_caducidad_qr);


--
-- Name: idx_registros_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registros_hash ON public.registros_acceso USING btree (hash_registro);


--
-- Name: idx_registros_hash_anterior; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registros_hash_anterior ON public.registros_acceso USING btree (hash_anterior);


--
-- Name: asistencias_potenciales asistencias_potenciales_id_horario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_potenciales
    ADD CONSTRAINT asistencias_potenciales_id_horario_fkey FOREIGN KEY (id_horario) REFERENCES public.horarios_estudiante(id_horario);


--
-- Name: asistencias_potenciales asistencias_potenciales_id_materia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_potenciales
    ADD CONSTRAINT asistencias_potenciales_id_materia_fkey FOREIGN KEY (id_materia) REFERENCES public.materias(id_materia);


--
-- Name: asistencias_potenciales asistencias_potenciales_id_registro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_potenciales
    ADD CONSTRAINT asistencias_potenciales_id_registro_fkey FOREIGN KEY (id_registro) REFERENCES public.registros_acceso(id_registro) ON DELETE CASCADE;


--
-- Name: asistencias_potenciales asistencias_potenciales_matricula_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias_potenciales
    ADD CONSTRAINT asistencias_potenciales_matricula_fkey FOREIGN KEY (matricula) REFERENCES public.personas(matricula);


--
-- Name: horarios_estudiante horarios_estudiante_id_materia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_estudiante
    ADD CONSTRAINT horarios_estudiante_id_materia_fkey FOREIGN KEY (id_materia) REFERENCES public.materias(id_materia) ON DELETE CASCADE;


--
-- Name: horarios_estudiante horarios_estudiante_matricula_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_estudiante
    ADD CONSTRAINT horarios_estudiante_matricula_fkey FOREIGN KEY (matricula) REFERENCES public.personas(matricula) ON DELETE CASCADE;


--
-- Name: hot_qr_codes hot_qr_codes_id_admin_creador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_qr_codes
    ADD CONSTRAINT hot_qr_codes_id_admin_creador_fkey FOREIGN KEY (id_admin_creador) REFERENCES public.administradores(id);


--
-- Name: hot_qr_codes hot_qr_codes_id_admin_registro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_qr_codes
    ADD CONSTRAINT hot_qr_codes_id_admin_registro_fkey FOREIGN KEY (id_admin_registro) REFERENCES public.administradores(id);


--
-- Name: materias materias_id_carrera_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_id_carrera_fkey FOREIGN KEY (id_carrera) REFERENCES public.carreras(id_carrera);


--
-- Name: personas personas_id_carrera_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personas
    ADD CONSTRAINT personas_id_carrera_fkey FOREIGN KEY (id_carrera) REFERENCES public.carreras(id_carrera);


--
-- Name: registros_acceso registros_acceso_id_admin_entrada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_acceso
    ADD CONSTRAINT registros_acceso_id_admin_entrada_fkey FOREIGN KEY (id_admin_entrada) REFERENCES public.administradores(id);


--
-- Name: registros_acceso registros_acceso_id_admin_salida_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_acceso
    ADD CONSTRAINT registros_acceso_id_admin_salida_fkey FOREIGN KEY (id_admin_salida) REFERENCES public.administradores(id);


--
-- Name: registros_acceso registros_acceso_matricula_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_acceso
    ADD CONSTRAINT registros_acceso_matricula_fkey FOREIGN KEY (matricula) REFERENCES public.personas(matricula);


--
-- PostgreSQL database dump complete
--

\unrestrict qVDcXDLh9bZbqCAvtBwPMmieeWOYxCIBx4weEf46LaXRk7BLslmOBemSz2AgBJP

