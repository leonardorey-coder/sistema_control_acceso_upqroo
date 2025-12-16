import pool from '../lib/db.js';

/**
 * API para verificar la integridad de la cadena blockchain de registros de acceso
 * Permite detectar si algún registro ha sido modificado manualmente
 */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Llamar a la función de verificación de integridad
        const [resultado] = await pool.query(`
            SELECT * FROM verificar_integridad_cadena()
        `);

        if (resultado.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No hay registros para verificar',
                data: {
                    integridad_valida: true,
                    total_registros: 0,
                    registros_invalidos: []
                }
            });
        }

        // La función devuelve registros con problemas de integridad
        const registrosInvalidos = resultado.filter(r => !r.hash_valido);
        const integridadValida = registrosInvalidos.length === 0;

        return res.status(200).json({
            success: true,
            message: integridadValida 
                ? 'Todos los registros mantienen su integridad' 
                : `Se encontraron ${registrosInvalidos.length} registro(s) con problemas de integridad`,
            data: {
                integridad_valida: integridadValida,
                total_registros: resultado.length,
                registros_invalidos: registrosInvalidos.map(r => ({
                    id_registro: r.id_registro,
                    matricula: r.matricula,
                    hora_entrada: r.hora_entrada,
                    mensaje: 'El hash del registro no coincide con el calculado'
                }))
            }
        });

    } catch (error) {
        console.error('Error al verificar integridad:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al verificar integridad de registros: ' + error.message 
        });
    }
}
