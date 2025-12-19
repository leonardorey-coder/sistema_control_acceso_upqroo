import pool from '../lib/db.js';
import crypto from 'crypto';

function generarCodigoHotQR() {
    const prefijo = 'HQR';
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefijo}${random}`;
}

async function obtenerIdAdmin(token) {
    const [rows] = await pool.execute(
        "SELECT id, nombre FROM administradores WHERE token = $1 AND estado = 'activo'",
        [token]
    );
    if (rows.length === 0) {
        throw new Error('Sesion de administrador no valida');
    }
    return rows[0];
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // GET: obtener hot-QR del dia
    if (req.method === 'GET') {
        try {
            const [hotQRs] = await pool.execute(`
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
                ORDER BY h.fecha_creacion DESC
            `);

            return res.status(200).json({
                success: true,
                data: hotQRs
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // POST: crear nuevo hot-QR
    if (req.method === 'POST') {
        try {
            const { nombre_visitante, motivo, duracion_minutos, admin_token } = req.body;

            if (!nombre_visitante || !admin_token) {
                throw new Error('Nombre del visitante y token de admin son requeridos');
            }

            const admin = await obtenerIdAdmin(admin_token);
            const codigo = generarCodigoHotQR();
            const duracion = parseInt(duracion_minutos) || 60;
            const fechaExpiracion = new Date(Date.now() + duracion * 60 * 1000);

            const [result] = await pool.execute(`
                INSERT INTO hot_qr_codes (codigo, nombre_visitante, motivo, id_admin_creador, fecha_expiracion)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id_hot_qr, codigo, fecha_creacion, fecha_expiracion
            `, [codigo, nombre_visitante, motivo || null, admin.id, fechaExpiracion]);

            return res.status(200).json({
                success: true,
                message: 'Hot-QR creado exitosamente',
                data: {
                    id_hot_qr: result[0].id_hot_qr,
                    codigo: codigo,
                    nombre_visitante: nombre_visitante,
                    motivo: motivo,
                    fecha_creacion: result[0].fecha_creacion,
                    fecha_expiracion: fechaExpiracion,
                    duracion_minutos: duracion,
                    admin_creador: admin.nombre
                }
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    return res.status(405).json({ success: false, message: 'Metodo no permitido' });
}
