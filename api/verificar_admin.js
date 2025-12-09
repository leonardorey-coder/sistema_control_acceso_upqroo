import pool from '../lib/db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado'
        });
    }

    try {
        const [rows] = await pool.execute(
            "SELECT id, nombre, usuario, estado, ultimo_acceso FROM administradores WHERE token = $1 AND estado = 'activo'",
            [token]
        );

        if (rows.length > 0) {
            const admin = rows[0];

            // Update last access
            await pool.execute(
                "UPDATE administradores SET ultimo_acceso = NOW() WHERE id = $1",
                [admin.id]
            );

            return res.status(200).json({
                success: true,
                data: {
                    id: admin.id,
                    nombre: admin.nombre,
                    usuario: admin.usuario,
                    ultimo_acceso: admin.ultimo_acceso
                }
            });
        } else {
            return res.status(401).json({
                success: false,
                message: 'Sesión inválida o usuario inactivo'
            });
        }

    } catch (error) {
        console.error('Error verifying admin:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al verificar el administrador'
        });
    }
}
