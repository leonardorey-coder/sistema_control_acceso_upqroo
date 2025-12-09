import bcrypt from 'bcryptjs';
import pool from '../lib/db.js';

const usuario = process.argv[2] || 'admin1';
const password = process.argv[3] || '123';
const nombre = process.argv[4] || 'Don Prestegui';

async function crearAdmin() {
    try {
        console.log(`Checking if user '${usuario}' exists...`);
        const [rows] = await pool.execute("SELECT id FROM administradores WHERE usuario = $1", [usuario]);

        if (rows.length > 0) {
            console.log(`El usuario '${usuario}' ya existe en la base de datos.`);
        } else {
            const hash = await bcrypt.hash(password, 10);

            await pool.execute(
                "INSERT INTO administradores (usuario, password, nombre) VALUES ($1, $2, $3)",
                [usuario, hash, nombre]
            );

            console.log("Administrador creado exitosamente");
            console.log("Usuario:", usuario);
            console.log("Contraseña:", password);
            console.log("Hash generado:", hash);
        }
    } catch (error) {
        console.error("Error al crear el administrador:", error);
    } finally {
        process.exit();
    }
}

crearAdmin();
