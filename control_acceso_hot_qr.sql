-- Migracion: Sistema de Hot-QR para invitados rapidos
-- Los Hot-QR son codigos temporales que permiten entrada rapida sin registro completo

CREATE TABLE IF NOT EXISTS hot_qr_codes (
    id_hot_qr SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre_visitante VARCHAR(100) NOT NULL,
    motivo VARCHAR(255) DEFAULT NULL,
    id_admin_creador INT REFERENCES administradores(id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_uso TIMESTAMP DEFAULT NULL,
    id_admin_registro INT REFERENCES administradores(id),
    activo BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_hot_qr_codigo ON hot_qr_codes(codigo);
CREATE INDEX IF NOT EXISTS idx_hot_qr_expiracion ON hot_qr_codes(fecha_expiracion);
CREATE INDEX IF NOT EXISTS idx_hot_qr_activo ON hot_qr_codes(activo, usado);

-- Vista para hot-QR activos del dia
CREATE OR REPLACE VIEW hot_qr_hoy AS
SELECT 
    h.id_hot_qr,
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
FROM hot_qr_codes h
LEFT JOIN administradores a1 ON h.id_admin_creador = a1.id
LEFT JOIN administradores a2 ON h.id_admin_registro = a2.id
WHERE DATE(h.fecha_creacion) = CURRENT_DATE
ORDER BY h.fecha_creacion DESC;
