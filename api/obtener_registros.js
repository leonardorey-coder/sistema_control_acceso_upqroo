import pool from '../lib/db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Vista actualizada que incluye tipo_persona y salida_automatica
        const [rows] = await pool.query(`
            SELECT 
                r.matricula,
                p.nombres,
                p.apellidos,
                p.tipo_persona,
                COALESCE(c.nombre_carrera, 'N/A') as nombre_carrera,
                r.hora_entrada,
                r.hora_salida,
                r.salida_automatica,
                r.notas,
                a1.nombre as admin_entrada,
                a2.nombre as admin_salida
            FROM registros_acceso r
            JOIN personas p ON r.matricula = p.matricula
            LEFT JOIN carreras c ON p.id_carrera = c.id_carrera
            LEFT JOIN administradores a1 ON r.id_admin_entrada = a1.id
            LEFT JOIN administradores a2 ON r.id_admin_salida = a2.id
            WHERE DATE(r.hora_entrada) = CURRENT_DATE
            ORDER BY r.hora_entrada DESC
        `);

        const registros = rows.map(row => ({
            matricula: row.matricula,
            nombres: row.nombres,
            apellidos: row.apellidos,
            tipo_persona: row.tipo_persona,
            nombre_carrera: row.nombre_carrera || 'N/A',
            hora_entrada: row.hora_entrada ? new Date(row.hora_entrada).toLocaleTimeString('es-MX', { hour12: false }) : null,
            hora_salida: row.hora_salida ? new Date(row.hora_salida).toLocaleTimeString('es-MX', { hour12: false }) : null,
            salida_automatica: row.salida_automatica || false,
            notas: row.notas,
            admin_entrada: row.admin_entrada,
            admin_salida: row.admin_salida
        }));

        if (registros.length > 0) {
            return res.status(200).json({ success: true, data: registros });
        } else {
            return res.status(200).json({ success: false, message: 'No hay registros para el día de hoy' });
        }

    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener los registros: ' + error.message });
    }
}
