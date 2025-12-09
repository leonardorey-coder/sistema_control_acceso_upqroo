import pool from '../lib/db.js';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { matricula } = req.query;

        if (!matricula) {
            return res.status(400).json({
                success: false,
                message: 'Matrícula no proporcionada'
            });
        }

        // Validate format
        if (!/^\d{9}$/.test(matricula)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de matrícula inválido'
            });
        }

        const [rows] = await pool.execute(`
      SELECT
        p.matricula,
        p.nombres,
        p.apellidos,
        p.curp,
        p.tipo_persona,
        p.estado,
        p.foto_perfil,
        p.id_carrera,
        c.nombre_carrera
      FROM personas p
      LEFT JOIN carreras c ON p.id_carrera = c.id_carrera
      WHERE p.matricula = $1
    `, [matricula]);

        if (rows.length > 0) {
            const persona = rows[0];
            // Also handle photo buffer to base64 if needed for verification view, though usually it's for 'editar'
            if (persona.foto_perfil) {
                persona.foto_perfil = Buffer.from(persona.foto_perfil).toString('base64');
            }
            return res.status(200).json({
                success: true,
                message: 'Persona encontrada',
                data: persona
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Persona no encontrada',
                data: null
            });
        }

    } catch (error) {
        console.error('Error verifying matricula:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al buscar la persona: ' + error.message
        });
    }
}
