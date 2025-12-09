-- PostgreSQL Schema for Control Acceso UPQROO

-- Create tables

CREATE TABLE administradores (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    ultimo_acceso TIMESTAMP DEFAULT NULL,
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    token VARCHAR(255) DEFAULT NULL
);

CREATE TABLE carreras (
    id_carrera SERIAL PRIMARY KEY,
    nombre_carrera VARCHAR(100) NOT NULL,
    clave_carrera VARCHAR(10) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE personas (
    matricula VARCHAR(10) PRIMARY KEY,
    nombres VARCHAR(50) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    curp VARCHAR(18) NOT NULL UNIQUE,
    id_carrera INT REFERENCES carreras(id_carrera),
    foto_perfil BYTEA DEFAULT NULL,
    tipo_persona VARCHAR(20) NOT NULL CHECK (tipo_persona IN ('estudiante', 'docente', 'administrativo', 'otro')),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE registros_acceso (
    id_registro SERIAL PRIMARY KEY,
    matricula VARCHAR(10) REFERENCES personas(matricula),
    hora_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hora_salida TIMESTAMP DEFAULT NULL,
    id_admin_entrada INT REFERENCES administradores(id),
    id_admin_salida INT REFERENCES administradores(id)
);

-- Stored Procedures / Functions

CREATE OR REPLACE PROCEDURE registrar_entrada(p_matricula VARCHAR, p_id_admin INT)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO registros_acceso (matricula, hora_entrada, id_admin_entrada)
    VALUES (p_matricula, NOW(), p_id_admin);
END;
$$;

CREATE OR REPLACE PROCEDURE registrar_salida(p_matricula VARCHAR, p_id_admin INT)
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

-- Views

CREATE OR REPLACE VIEW registros_hoy AS
SELECT 
    r.id_registro,
    r.matricula,
    p.nombres,
    p.apellidos,
    c.nombre_carrera,
    r.hora_entrada,
    r.hora_salida,
    a1.nombre AS admin_entrada,
    a2.nombre AS admin_salida
FROM registros_acceso r
JOIN personas p ON r.matricula = p.matricula
LEFT JOIN carreras c ON p.id_carrera = c.id_carrera
LEFT JOIN administradores a1 ON r.id_admin_entrada = a1.id
LEFT JOIN administradores a2 ON r.id_admin_salida = a2.id
WHERE DATE(r.hora_entrada) = CURRENT_DATE
ORDER BY r.hora_entrada DESC;

-- Seed Data

INSERT INTO administradores (usuario, password, nombre, ultimo_acceso, estado, fecha_creacion, token) VALUES
('root', '123', 'Martín', '2024-11-29 23:32:33', 'activo', '2024-11-26 06:14:59', 'e11f2266da8899a06a8e5a1bedb4d478cfef203b01e0ab37399d1065613c630a'),
('admin2', '$2y$10$1HDY7DoHcprYzkQEO5Rq1Oc0l/zqGzmhhGa.wjwgOyqcWXYVJuQre', 'Don Luis', '2025-02-27 04:53:29', 'activo', '2025-02-27 04:53:11', '66d3d039d34ee5706c8b30d0f92d8e8d5b26951e0fcc596e695a32ad3972106b'),
('admin1', '$2y$10$q59XGZK/tasnlDaOoGNd8OUFVqScaIZx3A6E7a/6zHZQvYCvMeDEW', 'Don Prestegui', '2025-10-30 00:17:52', 'activo', '2025-10-04 00:24:01', '8e78509da3d28010a5f92743b7dbf7f72d160d7b3f7d1d26bc6c6e9d0cb2f65a');

INSERT INTO carreras (id_carrera, nombre_carrera, clave_carrera, fecha_creacion) VALUES
(1, 'Licenciatura En Ingeniería En Software', 'LIS', '2024-11-23 03:32:32'),
(2, 'Licenciatura En Ingeniería Financiera', 'LIF', '2024-11-23 03:32:32'),
(3, 'Licenciatura En Ingeniería Biomédica', 'LIB', '2024-11-23 03:32:32'),
(4, 'Licenciatura En Ingeniería En Tecnologías De La Información E Innovación Digital', 'LETIID', '2024-11-23 03:32:32'),
(5, 'Licenciatura En Ingeniería En Biotecnología', 'LIBT', '2024-11-23 03:32:32'),
(6, 'Licenciatura En Terapia Física', 'LTF', '2024-11-23 03:32:32'),
(7, 'Licenciatura En Administración', 'LADM', '2024-11-23 03:32:32');

-- Note: Skipping binary data insert for 'personas' to avoid massive file bloat in this text representation. 
-- You can add test users via the application.
