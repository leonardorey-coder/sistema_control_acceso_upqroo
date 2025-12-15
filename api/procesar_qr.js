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

function sanitizeOutput(persona) {
    // Handle BLOB/Buffer for foto_perfil
    if (persona.foto_perfil) {
        persona.foto_perfil = Buffer.from(persona.foto_perfil).toString('base64');
    } else {
        persona.foto_perfil = null;
    }
    return persona;
}

async function cerrarRegistrosPendientes() {
    const [pendientes] = await pool.execute(
        `SELECT id_registro, hora_entrada, id_admin_entrada FROM registros_acceso WHERE hora_salida IS NULL AND DATE(hora_entrada) < CURRENT_DATE`
    );

    for (const registro of pendientes) {
        const finDelDia = new Date(registro.hora_entrada);
        finDelDia.setHours(23, 59, 59, 0);
        await pool.execute(
            `UPDATE registros_acceso SET hora_salida = $1, id_admin_salida = COALESCE(id_admin_salida, $2) WHERE id_registro = $3`,
            [finDelDia, registro.id_admin_entrada, registro.id_registro]
        );
        await encadenarRegistro(registro.id_registro);
    }
}

async function obtenerHashAnteriorPara(idRegistro) {
    const [rows] = await pool.execute(
        'SELECT hash_registro FROM registros_acceso WHERE id_registro < $1 ORDER BY id_registro DESC LIMIT 1',
        [idRegistro]
    );
    return rows.length ? rows[0].hash_registro : 'GENESIS';
}

function construirHashRegistro(registro, hashAnterior) {
    const hash = crypto.createHash('sha256');
    const data = [
        registro.id_registro,
        registro.matricula,
        registro.hora_entrada,
        registro.hora_salida,
        registro.id_admin_entrada,
        registro.id_admin_salida,
        hashAnterior
    ].join('|');
    hash.update(data);
    return hash.digest('hex');
}

async function encadenarRegistro(idRegistro) {
    const [rows] = await pool.execute(
        'SELECT id_registro, matricula, hora_entrada, hora_salida, id_admin_entrada, id_admin_salida, hash_anterior FROM registros_acceso WHERE id_registro = $1',
        [idRegistro]
    );

    if (!rows.length) return;

    const registro = rows[0];
    const hashAnterior = registro.hash_anterior === 'GENESIS'
        ? await obtenerHashAnteriorPara(idRegistro)
        : registro.hash_anterior;
    const hashActual = construirHashRegistro(registro, hashAnterior);

    await pool.execute(
        'UPDATE registros_acceso SET hash_anterior = $1, hash_registro = $2 WHERE id_registro = $3',
        [hashAnterior, hashActual, idRegistro]
    );
}

async function registrarAsistenciasPotenciales(matricula, fechaEscaneo) {
    const diaSemana = fechaEscaneo.getDay();
    const minutosEscaneo = fechaEscaneo.getHours() * 60 + fechaEscaneo.getMinutes();
    const [horarios] = await pool.execute(
        'SELECT nombre_materia, hora_inicio, hora_fin FROM horarios_estudiante WHERE matricula = $1 AND dia_semana = $2',
        [matricula, diaSemana]
    );

    for (const horario of horarios) {
        const [inicioHoras, inicioMinutos] = horario.hora_inicio.split(':').map(Number);
        const [finHoras, finMinutos] = horario.hora_fin.split(':').map(Number);
        const inicio = inicioHoras * 60 + inicioMinutos;
        const fin = finHoras * 60 + finMinutos;

        const inicioReal = Math.max(inicio, minutosEscaneo);
        const minutosPotenciales = Math.max(0, fin - inicioReal);

        if (minutosPotenciales > 0) {
            await pool.execute(
                `INSERT INTO asistencias_estudiante (matricula, nombre_materia, fecha, hora_escaneo, minutos_potenciales, comentario)
                 VALUES ($1, $2, $3, $4, $5, 'Base para futuras graficaciones de asistencia')`,
                [matricula, horario.nombre_materia, fechaEscaneo, fechaEscaneo, minutosPotenciales]
            );
        }
    }
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
        await cerrarRegistrosPendientes();
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

        if (persona.qr_tiene_caducidad && persona.qr_fecha_caducidad && new Date(persona.qr_fecha_caducidad) <= new Date()) {
            return res.status(403).json({
                success: false,
                message: 'El código QR asociado está vencido',
                data: sanitizeOutput(persona)
            });
        }

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
             r.id_registro,
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
            await encadenarRegistro(u.id_registro);
            if (persona.tipo_persona === 'estudiante') {
                await registrarAsistenciasPotenciales(persona.matricula, new Date(u.hora_entrada || new Date()));
            }
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
