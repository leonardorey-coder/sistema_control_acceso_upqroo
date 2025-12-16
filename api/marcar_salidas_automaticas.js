import pool from '../lib/db.js';

/**
 * API para marcar salidas automáticas a medianoche
 * Debe ser llamada por un cron job o tarea programada
 * 
 * Ejemplo de configuración para Vercel Cron:
 * En vercel.json agregar:
 * {
 *   "crons": [{
 *     "path": "/api/marcar_salidas_automaticas",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Verificar autorización para llamadas manuales (opcional)
    // Los cron jobs de Vercel incluyen un header especial
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const authHeader = req.headers['authorization'];
    const expectedSecret = process.env.CRON_SECRET;

    // Permitir si es cron de Vercel, o si tiene el secret correcto
    if (!isVercelCron && expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
        return res.status(401).json({ 
            success: false, 
            message: 'No autorizado' 
        });
    }

    try {
        // Llamar al procedimiento almacenado que marca salidas automáticas
        // Este procedimiento:
        // 1. Encuentra registros de ayer sin hora de salida
        // 2. Los marca con hora de salida a las 23:59:59
        // 3. Establece salida_automatica = true
        // Nota: No modifica hashes blockchain ya que son registros de solo salida
        await pool.execute(`CALL marcar_salidas_automaticas()`);

        // Obtener cuántos registros fueron actualizados
        const [resultado] = await pool.query(`
            SELECT COUNT(*) as total 
            FROM registros_acceso 
            WHERE salida_automatica = true 
            AND DATE(hora_salida) = CURRENT_DATE - INTERVAL '1 day'
        `);

        const registrosActualizados = resultado[0]?.total || 0;

        return res.status(200).json({
            success: true,
            message: `Salidas automáticas procesadas correctamente`,
            data: {
                registros_actualizados: parseInt(registrosActualizados),
                fecha_procesamiento: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error al marcar salidas automáticas:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al procesar salidas automáticas: ' + error.message 
        });
    }
}
