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
        const [rows] = await pool.query("SELECT * FROM registros_hoy");

        // Format times if needed, or let frontend handle it.
        // PHP did date('H:i:s'). MySQL returns Date objects or strings depending on driver config.
        // mysql2 returns Date objects for datetime/timestamp usually.
        // Let's ensure we return what frontend expects.
        // The previous PHP code returned "H:i:s". 
        // We can format it here or in frontend. Frontend expects "HH:MM:SS".

        const registros = rows.map(row => ({
            matricula: row.matricula,
            nombres: row.nombres,
            apellidos: row.apellidos,
            nombre_carrera: row.nombre_carrera || 'N/A',
            hora_entrada: row.hora_entrada ? new Date(row.hora_entrada).toLocaleTimeString('es-MX', { hour12: false }) : null,
            hora_salida: row.hora_salida ? new Date(row.hora_salida).toLocaleTimeString('es-MX', { hour12: false }) : null,
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
