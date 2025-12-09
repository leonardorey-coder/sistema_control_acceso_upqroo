import pool from '../lib/db.js';

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

function sanitizeOutput(persona) {
    // Handle BLOB/Buffer for foto_perfil
    if (persona.foto_perfil) {
        persona.foto_perfil = Buffer.from(persona.foto_perfil).toString('base64');
    } else {
        persona.foto_perfil = null;
    }
    return persona;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    try {
        const { matricula, admin_token } = req.body;

        if (!matricula || !admin_token) {
            throw new Error('No se recibió matrícula o ID de administrador');
        }

        const idAdmin = await obtenerIdAdmin(admin_token);

        const [personas] = await pool.execute(`
      SELECT p.*, c.nombre_carrera 
      FROM personas p 
      LEFT JOIN carreras c ON p.id_carrera = c.id_carrera 
      WHERE p.matricula = $1
    `, [matricula]);

        if (personas.length === 0) {
            throw new Error('Matrícula no encontrada');
        }

        const persona = personas[0];

        if (persona.estado === 'inactivo') {
            return res.status(403).json({
                success: false,
                message: 'Matrícula inactiva. Acceso denegado.',
                data: sanitizeOutput(persona)
            });
        }

        const [checks] = await pool.execute(`
      SELECT id_registro, hora_entrada 
      FROM registros_acceso 
      WHERE matricula = $1 
      AND DATE(hora_entrada) = CURRENT_DATE 
      AND hora_salida IS NULL
    `, [matricula]);

        let procedureName, tipoRegistro;
        if (checks.length > 0) {
            procedureName = 'registrar_salida';
            tipoRegistro = 'salida';
            persona.tipo_registro = 'salida';
        } else {
            procedureName = 'registrar_entrada';
            tipoRegistro = 'entrada';
            persona.tipo_registro = 'entrada';
        }

        // Call stored procedure
        // Note: pg uses CALL for procedures
        await pool.execute(`CALL ${procedureName}($1, $2)`, [matricula, idAdmin]);

        // Get latest record details
        const [lastRecords] = await pool.execute(`
      SELECT r.hora_entrada, r.hora_salida,
             a1.nombre as nombre_admin_entrada,
             a2.nombre as nombre_admin_salida
      FROM registros_acceso r
      LEFT JOIN administradores a1 ON r.id_admin_entrada = a1.id
      LEFT JOIN administradores a2 ON r.id_admin_salida = a2.id
      WHERE r.matricula = $1
      ORDER BY r.id_registro DESC
      LIMIT 1
    `, [matricula]);

        if (lastRecords.length > 0) {
            const u = lastRecords[0];
            persona.hora_entrada = u.hora_entrada;
            persona.hora_salida = u.hora_salida;
            persona.admin_entrada = u.nombre_admin_entrada;
            persona.admin_salida = u.nombre_admin_salida;
        }

        return res.status(200).json({
            success: true,
            data: sanitizeOutput(persona)
        });

    } catch (error) {
        // console.error(error); // Optional logging
        return res.status(500).json({ success: false, message: error.message });
    }
}
