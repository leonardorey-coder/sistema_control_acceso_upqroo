import pool from '../lib/db.js';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    // CORS
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

    const form = formidable();

    try {
        const [fields, files] = await form.parse(req);

        const matriculaOriginal = fields.matricula_original?.[0];
        const matricula = fields.matricula?.[0];
        const nombres = fields.nombres?.[0];
        const apellidos = fields.apellidos?.[0];
        const curp = (fields.curp?.[0] || '').toUpperCase();
        const tipopersona = fields.tipo_persona?.[0];
        const estado = fields.estado?.[0];
        const idCarrera = fields.id_carrera?.[0] ? parseInt(fields.id_carrera[0]) : null;

        if (!matriculaOriginal || !matricula || !nombres || !apellidos || !curp || !tipopersona || !estado) {
            throw new Error('Faltan datos requeridos');
        }

        if (!/^\d{9}$/.test(matricula)) throw new Error('La matrícula debe tener exactamente 9 dígitos');
        if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9]{2}$/.test(curp)) throw new Error('El CURP no tiene el formato correcto');

        if (tipopersona === 'estudiante' && !idCarrera) throw new Error('Debe seleccionar una carrera para estudiantes');

        // Check existence
        const [exists] = await pool.execute("SELECT matricula FROM personas WHERE matricula = $1", [matriculaOriginal]);
        if (exists.length === 0) throw new Error('La persona no existe en el sistema');

        // Check duplicate matricula
        if (matricula !== matriculaOriginal) {
            const [dup] = await pool.execute("SELECT matricula FROM personas WHERE matricula = $1", [matricula]);
            if (dup.length > 0) throw new Error('La nueva matrícula ya está registrada');
        }

        // Check duplicate CURP
        if (curp) {
            const [dupCurp] = await pool.execute("SELECT matricula FROM personas WHERE curp = $1 AND matricula != $2", [curp, matriculaOriginal]);
            if (dupCurp.length > 0) throw new Error('El CURP ya está registrado para otra persona');
        }

        let fotoPerfil = null;
        let updateFoto = false;

        if (files.foto_perfil) {
            const file = files.foto_perfil[0];
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file.mimetype)) throw new Error('Tipo de archivo no permitido');
            if (file.size > 5 * 1024 * 1024) throw new Error('La imagen es demasiado grande. Tamaño máximo: 5MB');

            fotoPerfil = fs.readFileSync(file.filepath);
            updateFoto = true;
        }

        let sql, params;
        if (updateFoto) {
            sql = `UPDATE personas SET 
               matricula = $1, nombres = $2, apellidos = $3, curp = $4, 
               tipo_persona = $5, id_carrera = $6, estado = $7, foto_perfil = $8 
               WHERE matricula = $9`;
            params = [matricula, nombres, apellidos, curp, tipopersona, idCarrera, estado, fotoPerfil, matriculaOriginal];
        } else {
            sql = `UPDATE personas SET 
               matricula = $1, nombres = $2, apellidos = $3, curp = $4, 
               tipo_persona = $5, id_carrera = $6, estado = $7 
               WHERE matricula = $8`;
            params = [matricula, nombres, apellidos, curp, tipopersona, idCarrera, estado, matriculaOriginal];
        }

        await pool.execute(sql, params);

        if (matricula !== matriculaOriginal) {
            await pool.execute("UPDATE registros_acceso SET matricula = $1 WHERE matricula = $2", [matricula, matriculaOriginal]);
        }

        return res.status(200).json({ success: true, message: 'Persona actualizada exitosamente' });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
