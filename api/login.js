import pool from '../lib/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    try {
        const { usuario, password } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        }

        const [rows] = await pool.execute(
            "SELECT * FROM administradores WHERE usuario = $1 AND estado = 'activo'",
            [usuario]
        );

        const admin = rows[0];

        // Note: PHP password_verify works with bcrypt hashes. bcryptjs.compare should be compatible.
        if (admin && (await bcrypt.compare(password, admin.password))) {
            const token = crypto.randomBytes(32).toString('hex');

            await pool.execute(
                "UPDATE administradores SET token = $1, ultimo_acceso = NOW() WHERE id = $2",
                [token, admin.id]
            );

            return res.status(200).json({
                success: true,
                token,
                nombre: admin.nombre,
                usuario: admin.usuario
            });
        } else {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
}
