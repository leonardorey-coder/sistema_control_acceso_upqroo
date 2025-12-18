import pool from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrarV3() {
    console.log('Iniciando migración a v3 (Sistema Híbrido de Asistencias)...\n');

    try {
        const sqlFilePath = path.join(__dirname, '..', 'control_acceso_postgres_v3_hibrido.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf-8');
        
        console.log('1. Aplicando cambios a la base de datos...');
        await pool.query(sql);
        console.log('   ✓ Cambios aplicados exitosamente\n');

        console.log('2. Verificando estructura de tabla asistencias_potenciales...');
        const [columns] = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'asistencias_potenciales'
            AND column_name IN ('estado', 'hora_salida_registro')
            ORDER BY ordinal_position
        `);
        
        if (columns.length === 2) {
            console.log('   ✓ Columnas agregadas correctamente:');
            columns.forEach(col => {
                console.log(`     - ${col.column_name} (${col.data_type})`);
            });
        } else {
            throw new Error('No se agregaron todas las columnas necesarias');
        }
        console.log('');

        console.log('3. Verificando funciones creadas...');
        const [functions] = await pool.query(`
            SELECT proname as nombre_funcion
            FROM pg_proc
            WHERE proname IN (
                'registrar_asistencias_potenciales',
                'actualizar_asistencias_al_salir',
                'actualizar_asistencias_asumidas'
            )
        `);
        console.log(`   ✓ ${functions.length} funciones actualizadas/creadas\n`);

        console.log('4. Verificando procedimientos...');
        const [procedures] = await pool.query(`
            SELECT proname as nombre_procedimiento
            FROM pg_proc
            WHERE proname IN (
                'marcar_salidas_automaticas',
                'registrar_salida_v3'
            )
        `);
        console.log(`   ✓ ${procedures.length} procedimientos actualizados/creados\n`);

        console.log('5. Migrando datos existentes...');
        const result = await pool.query(`
            UPDATE asistencias_potenciales
            SET estado = 'in_progress'
            WHERE estado IS NULL
        `);
        const rowCount = result.affectedRows || 0;
        console.log(`   ✓ ${rowCount} registros actualizados con estado inicial\n`);

        console.log('6. Verificando vista creada...');
        const [views] = await pool.query(`
            SELECT table_name
            FROM information_schema.views
            WHERE table_name = 'vista_asistencias_con_estado'
        `);
        if (views.length > 0) {
            console.log('   ✓ Vista vista_asistencias_con_estado creada\n');
        }

        console.log('========================================');
        console.log('MIGRACIÓN COMPLETADA EXITOSAMENTE');
        console.log('========================================\n');
        
        console.log('Estados disponibles:');
        console.log('  - confirmed: Entrada y salida registradas manualmente');
        console.log('  - in_progress: Solo entrada registrada, clase aún no termina');
        console.log('  - assumed: Salida automática - asistencia asumida pero no verificada');
        console.log('  - partial: Salida registrada antes de terminar la clase');
        console.log('  - unverified: Salida automática + clase posterior a hora de salida\n');

        console.log('Nuevas funcionalidades:');
        console.log('  1. Sistema híbrido: registra todas las clases del día al entrar');
        console.log('  2. Actualización automática de asistencias al registrar salida');
        console.log('  3. Estados de asistencia para auditoría y reportes');
        console.log('  4. Cálculo preciso de porcentajes según tiempo real\n');

    } catch (error) {
        console.error('\n❌ ERROR durante la migración:');
        console.error(error.message);
        console.error('\nDetalles:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrarV3();
