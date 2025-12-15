import pool from '../lib/db.js';
import crypto from 'crypto';

async function obtenerIdAdmin(token) {
    const [rows] = await pool.execute(
        "SELECT id FROM administradores WHERE token = $1 AND estado = 'activo'",
        [token]
    );

    if (rows.length === 0) {
        throw new Error('Sesión de administrador no válida');
    }

    return rows[0].id;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    try {
        const { admin_token, nombre_visitante, motivo, duracion_minutos } = req.body || {};

        if (!admin_token || !nombre_visitante) {
            return res.status(400).json({
                success: false,
                message: 'El token de administrador y el nombre del visitante son obligatorios'
            });
        }

        const idAdmin = await obtenerIdAdmin(admin_token);

        const duracion = Number.isFinite(Number(duracion_minutos)) ? Number(duracion_minutos) : 240;
        const expiraEn = new Date(Date.now() + duracion * 60 * 1000);

        const codigo = `HOT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        await pool.execute(
            `INSERT INTO hot_qr (codigo, nombre_visitante, motivo, creado_por, expira_en)
             VALUES ($1, $2, $3, $4, $5)`,
            [codigo, nombre_visitante, motivo || null, idAdmin, expiraEn]
        );

        return res.status(200).json({
            success: true,
            data: {
                codigo,
                nombre_visitante,
                motivo: motivo || null,
                expira_en: expiraEn,
                duracion_minutos: duracion
            }
        });
    } catch (error) {
        console.error('Error al generar hot-QR:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'No fue posible generar el hot-QR'
        });
    }
}
