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
        // Obtener asistencias potenciales del día con información de estudiante y materia
        const [rows] = await pool.query(`
            SELECT 
                ap.id_asistencia,
                ap.matricula,
                p.nombres,
                p.apellidos,
                p.tipo_persona,
                COALESCE(c.nombre_carrera, 'N/A') as nombre_carrera,
                m.nombre_materia,
                m.clave_materia,
                he.aula,
                ap.fecha_clase,
                ap.hora_entrada_registro,
                ap.hora_inicio_clase,
                ap.hora_fin_clase,
                ap.minutos_asistidos,
                ap.minutos_totales_clase,
                ap.porcentaje_asistencia,
                ra.hora_entrada,
                ra.hora_salida,
                ra.salida_automatica
            FROM asistencias_potenciales ap
            JOIN personas p ON ap.matricula = p.matricula
            JOIN materias m ON ap.id_materia = m.id_materia
            LEFT JOIN horarios_estudiante he ON ap.id_horario = he.id_horario
            LEFT JOIN carreras c ON p.id_carrera = c.id_carrera
            LEFT JOIN registros_acceso ra ON ap.id_registro = ra.id_registro
            WHERE ap.fecha_clase = CURRENT_DATE
            ORDER BY ap.hora_inicio_clase ASC, p.apellidos ASC
        `);

        const asistencias = rows.map(row => ({
            id_asistencia: row.id_asistencia,
            matricula: row.matricula,
            nombres: row.nombres,
            apellidos: row.apellidos,
            tipo_persona: row.tipo_persona,
            nombre_carrera: row.nombre_carrera || 'N/A',
            nombre_materia: row.nombre_materia,
            clave_materia: row.clave_materia,
            aula: row.aula || 'N/A',
            fecha_clase: row.fecha_clase,
            hora_entrada_registro: row.hora_entrada_registro
                ? new Date(row.hora_entrada_registro).toLocaleTimeString('es-MX', { hour12: false })
                : null,
            hora_inicio_clase: row.hora_inicio_clase,
            hora_fin_clase: row.hora_fin_clase,
            minutos_asistidos: row.minutos_asistidos,
            minutos_totales_clase: row.minutos_totales_clase,
            porcentaje_asistencia: parseFloat(row.porcentaje_asistencia) || 0,
            hora_entrada: row.hora_entrada
                ? new Date(row.hora_entrada).toLocaleTimeString('es-MX', { hour12: false })
                : null,
            hora_salida: row.hora_salida
                ? new Date(row.hora_salida).toLocaleTimeString('es-MX', { hour12: false })
                : null,
            salida_automatica: row.salida_automatica || false
        }));

        if (asistencias.length > 0) {
            return res.status(200).json({ success: true, data: asistencias });
        } else {
            return res.status(200).json({
                success: false,
                message: 'No hay asistencias a clases registradas para el día de hoy'
            });
        }

    } catch (error) {
        console.error('Error al obtener asistencias:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener las asistencias: ' + error.message
        });
    }
}
