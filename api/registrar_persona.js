import pool from '../lib/db.js';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
    api: {
        bodyParser: false,
    },
};

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

    const form = formidable();

    try {
        const [fields, files] = await form.parse(req);

        const matricula = fields.matricula?.[0] || '';
        const nombres = fields.nombres?.[0] || '';
        const apellidos = fields.apellidos?.[0] || '';
        const curp = (fields.curp?.[0] || '').toUpperCase();
        const tipo_persona = fields.tipo_persona?.[0] || '';
        let id_carrera = fields.id_carrera?.[0] || null;

        if (!matricula || !nombres || !apellidos || !curp || !tipo_persona) {
            return res.status(400).json({ success: false, message: 'Todos los campos obligatorios deben ser completados' });
        }

        if (!/^\d{9}$/.test(matricula)) {
            return res.status(400).json({ success: false, message: 'La matrícula debe tener 9 dígitos' });
        }

        if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9]{2}$/.test(curp)) {
            return res.status(400).json({ success: false, message: 'El CURP no tiene el formato correcto' });
        }

        if (tipo_persona === 'estudiante' && !id_carrera) {
            return res.status(400).json({ success: false, message: 'Debe seleccionar una carrera para estudiantes' });
        }

        if (tipo_persona !== 'estudiante') {
            id_carrera = null;
        }

        const [existing] = await pool.execute("SELECT matricula FROM personas WHERE matricula = $1", [matricula]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'La matrícula ya está registrada en el sistema' });
        }

        let foto_perfil = null;
        if (files.foto_perfil) {
            const file = files.foto_perfil[0];
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({ success: false, message: 'Solo se permiten imágenes JPG o PNG' });
            }

            if (file.size > 2097152) { // 2MB
                return res.status(400).json({ success: false, message: 'La imagen no debe superar los 2MB' });
            }

            // Vercel temp paths work.
            foto_perfil = fs.readFileSync(file.filepath);
        }

        await pool.execute(
            "INSERT INTO personas (matricula, nombres, apellidos, curp, id_carrera, foto_perfil, tipo_persona, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')",
            [matricula, nombres, apellidos, curp, id_carrera, foto_perfil, tipo_persona]
        );

        return res.status(200).json({
            success: true,
            message: 'Persona registrada exitosamente',
            data: {
                matricula,
                nombres,
                apellidos,
                tipo_persona
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ success: false, message: 'Error al registrar la persona: ' + error.message });
    }
}
