import fs from 'fs';
import readline from 'readline';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'leonardocruz',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'control_acceso',
    port: process.env.DB_PORT || 5432,
});

async function migrate() {
    const adminClient = await pool.connect();

    try {
        console.log('Connected to PostgreSQL.');

        // Clear existing personas
        console.log('Clearing existing personas...');
        await adminClient.query('TRUNCATE personas CASCADE');

        const fileStream = fs.createReadStream('control_acceso.sql');

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let count = 0;
        let buffer = '';
        let inInsert = false;

        for await (const line of rl) {
            const trimmedLine = line.trim();

            if (line.startsWith("INSERT INTO `personas`")) {
                inInsert = true;
                const valuesIndex = line.indexOf('VALUES');
                if (valuesIndex !== -1) {
                    buffer += line.substring(valuesIndex + 6).trim();
                }
            } else if (inInsert) {
                buffer += " " + trimmedLine;
            }

            if (inInsert && trimmedLine.endsWith(';')) {
                inInsert = false;
                console.log(`Processing buffered insert statement (length: ${buffer.length})...`);

                let cleanedLine = buffer;
                if (cleanedLine.endsWith(';')) cleanedLine = cleanedLine.slice(0, -1);

                const records = cleanedLine.split(/\),\s*\(/);

                console.log(`Found ${records.length} records in statement.`);

                for (let i = 0; i < records.length; i++) {
                    let record = records[i];

                    if (i === 0) {
                        if (!record.endsWith(')')) record += ')';
                        record = record.trim();
                    } else if (i === records.length - 1) {
                        if (!record.startsWith('(')) record = '(' + record;
                    } else {
                        if (!record.startsWith('(')) record = '(' + record;
                        if (!record.endsWith(')')) record += ')';
                    }

                    // Remove outer parens
                    const content = record.slice(1, -1);

                    // Split fields by comma, respecting quotes
                    const args = [];
                    let currentArg = '';
                    let inQuote = false;

                    for (let j = 0; j < content.length; j++) {
                        const char = content[j];
                        if (char === "'" && (j === 0 || content[j - 1] !== '\\')) {
                            inQuote = !inQuote;
                            currentArg += char;
                        } else if (char === ',' && !inQuote) {
                            args.push(currentArg.trim());
                            currentArg = '';
                        } else {
                            currentArg += char;
                        }
                    }
                    if (currentArg) args.push(currentArg.trim());

                    const clean = (s) => {
                        if (s === undefined || s === null) return '';
                        return s.startsWith("'") && s.endsWith("'") ? s.slice(1, -1) : s;
                    };

                    if (args.length < 9) {
                        if (record.length > 5)
                            console.log('Skipping malformed record (args length ' + args.length + '):', record.substring(0, 50) + '...');
                        continue;
                    }

                    const matricula = clean(args[0]);
                    const nombres = clean(args[1]);
                    const apellidos = clean(args[2]);
                    const curp = clean(args[3]);
                    const id_carrera = args[4] === 'NULL' ? null : parseInt(args[4]);

                    let foto_perfil = args[5];
                    if (foto_perfil && foto_perfil.startsWith('0x')) {
                        foto_perfil = '\\x' + foto_perfil.substring(2);
                    } else if (foto_perfil === 'NULL') {
                        foto_perfil = null;
                    }

                    const tipo_persona = clean(args[6]);
                    const estado = clean(args[7]);
                    const fecha_registro = clean(args[8]);

                    try {
                        await adminClient.query(
                            `INSERT INTO personas (matricula, nombres, apellidos, curp, id_carrera, foto_perfil, tipo_persona, estado, fecha_registro) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (matricula) DO NOTHING`,
                            [matricula, nombres, apellidos, curp, id_carrera, foto_perfil, tipo_persona, estado, fecha_registro]
                        );
                        count++;
                        if (count % 100 === 0) console.log(`Migrated ${count} personas...`);
                    } catch (err) {
                        console.error(`Error inserting ${matricula}:`, err.message);
                    }
                }
                buffer = '';
            }
        }

        console.log(`Migration complete. Imported ${count} records.`);

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        adminClient.release();
        await pool.end();
    }
}

migrate();
