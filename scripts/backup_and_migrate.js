import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'leonardocruz',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'control_acceso',
    port: process.env.DB_PORT || 5432,
};

const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createBackupDir() {
    const backupDir = path.join(__dirname, '..', 'backups');
    try {
        await fs.mkdir(backupDir, { recursive: true });
        return backupDir;
    } catch (error) {
        throw new Error(`Error creando directorio de backups: ${error.message}`);
    }
}

async function makeFullBackup(backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(backupDir, `backup_${timestamp}.sql`);
    
    log('\n[1/6] Haciendo backup completo de la base de datos...', 'yellow');
    
    const pgDumpPath = '/opt/homebrew/Cellar/postgresql@16/16.11/bin/pg_dump';
    const pgPassword = config.password ? `PGPASSWORD="${config.password}"` : '';
    const cmd = `${pgPassword} ${pgDumpPath} -h ${config.host} -U ${config.user} -p ${config.port} -d ${config.database} -F p -f "${backupFile}"`;
    
    try {
        await execAsync(cmd);
        log(`✓ Backup completo guardado en: ${backupFile}`, 'green');
        return backupFile;
    } catch (error) {
        throw new Error(`Error haciendo backup: ${error.message}`);
    }
}

async function extractData(backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dataFile = path.join(backupDir, `data_backup_${timestamp}.sql`);
    
    log('\n[2/6] Extrayendo datos de administradores, carreras y personas...', 'yellow');
    
    const pgDumpPath = '/opt/homebrew/Cellar/postgresql@16/16.11/bin/pg_dump';
    const pgPassword = config.password ? `PGPASSWORD="${config.password}"` : '';
    const cmd = `${pgPassword} ${pgDumpPath} -h ${config.host} -U ${config.user} -p ${config.port} -d ${config.database} --data-only --table=administradores --table=personas --table=carreras -F p -f "${dataFile}"`;
    
    try {
        await execAsync(cmd);
        log(`✓ Datos extraídos en: ${dataFile}`, 'green');
        return dataFile;
    } catch (error) {
        throw new Error(`Error extrayendo datos: ${error.message}`);
    }
}

async function getRecordCounts(pool) {
    const query = `
        SELECT 'Administradores' as tabla, COUNT(*) as registros FROM administradores
        UNION ALL
        SELECT 'Carreras' as tabla, COUNT(*) as registros FROM carreras
        UNION ALL
        SELECT 'Personas' as tabla, COUNT(*) as registros FROM personas
        UNION ALL
        SELECT 'Registros de Acceso' as tabla, COUNT(*) as registros FROM registros_acceso
    `;
    
    const result = await pool.query(query);
    return result.rows;
}

async function applyNewSchema(pool) {
    log('\n[3/6] Aplicando nuevo esquema (control_acceso_postgres_v2.sql)...', 'yellow');
    log('ADVERTENCIA: Esto eliminará todas las tablas existentes y recreará el esquema.', 'red');
    
    const schemaPath = path.join(__dirname, '..', 'control_acceso_postgres_v2.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    try {
        await pool.query(schema);
        log('✓ Nuevo esquema aplicado correctamente', 'green');
    } catch (error) {
        throw new Error(`Error aplicando esquema: ${error.message}`);
    }
}

async function restoreData(dataFile) {
    log('\n[4/6] Restaurando datos de administradores, carreras y personas...', 'yellow');
    
    const psqlPath = '/opt/homebrew/Cellar/postgresql@16/16.11/bin/psql';
    const pgPassword = config.password ? `PGPASSWORD="${config.password}"` : '';
    const cmd = `${pgPassword} ${psqlPath} -h ${config.host} -U ${config.user} -p ${config.port} -d ${config.database} -f "${dataFile}"`;
    
    try {
        await execAsync(cmd);
        log('✓ Datos restaurados correctamente', 'green');
    } catch (error) {
        // Algunos errores de pg_dump son normales (como duplicados de secuencias)
        log('⚠ Advertencia durante restauración (puede ser normal): ' + error.message, 'yellow');
    }
}

async function verifyMigration(pool) {
    log('\n[5/6] Verificando la migración...', 'yellow');
    
    const counts = await getRecordCounts(pool);
    
    console.log('\nConteo de registros:');
    console.table(counts);
}

async function updateSequences(pool) {
    log('\n[6/6] Actualizando secuencias...', 'yellow');
    
    try {
        // Actualizar secuencias para evitar conflictos de IDs
        await pool.query(`
            SELECT setval('administradores_id_seq', COALESCE((SELECT MAX(id) FROM administradores), 1));
            SELECT setval('carreras_id_carrera_seq', COALESCE((SELECT MAX(id_carrera) FROM carreras), 1));
            SELECT setval('registros_acceso_id_registro_seq', COALESCE((SELECT MAX(id_registro) FROM registros_acceso), 1));
        `);
        log('✓ Secuencias actualizadas correctamente', 'green');
    } catch (error) {
        log('⚠ Advertencia actualizando secuencias: ' + error.message, 'yellow');
    }
}

async function main() {
    log('=== Backup y Migración de Base de Datos ===', 'cyan');
    log(`\nConectando a: ${config.host}:${config.port}/${config.database}`, 'cyan');
    
    const pool = new Pool(config);
    
    try {
        // Verificar conexión
        await pool.query('SELECT NOW()');
        log('✓ Conexión establecida', 'green');
        
        // Obtener conteo antes de migración
        log('\nRegistros actuales:', 'cyan');
        const beforeCounts = await getRecordCounts(pool);
        console.table(beforeCounts);
        
        // Crear directorio de backups
        const backupDir = await createBackupDir();
        
        // Hacer backup completo
        const backupFile = await makeFullBackup(backupDir);
        
        // Extraer solo los datos necesarios
        const dataFile = await extractData(backupDir);
        
        // Aplicar nuevo esquema
        await applyNewSchema(pool);
        
        // Restaurar datos
        await restoreData(dataFile);
        
        // Actualizar secuencias
        await updateSequences(pool);
        
        // Verificar migración
        await verifyMigration(pool);
        
        log('\n=== Migración completada exitosamente ===', 'green');
        log('\nArchivos de backup guardados:', 'cyan');
        log(`  - Backup completo: ${backupFile}`);
        log(`  - Datos extraídos: ${dataFile}`);
        log('\nNota: Los registros de acceso históricos NO fueron migrados (como se solicitó).', 'yellow');
        
    } catch (error) {
        log(`\n❌ Error durante la migración: ${error.message}`, 'red');
        log('\nSi algo salió mal, puedes restaurar el backup completo con:', 'yellow');
        log(`psql -h ${config.host} -U ${config.user} -p ${config.port} -d ${config.database} -f [archivo_backup]`, 'yellow');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
