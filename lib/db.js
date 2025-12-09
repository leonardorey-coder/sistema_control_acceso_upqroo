import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'leonardocruz',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'control_acceso',
    port: process.env.DB_PORT || 5432,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Helper for single query execution matching mysql2/promise interface partially
// mysql2: const [rows, fields] = await pool.execute(sql, [params]);
// pg: const res = await pool.query(sql, [params]); res.rows
// We will wrap it to ease migration
const queryWrapper = {
    execute: async (text, params) => {
        const res = await pool.query(text, params);
        return [res.rows, res.fields]; // emulate mysql2 return structure largely
    },
    query: async (text, params) => {
        const res = await pool.query(text, params);
        return [res.rows, res.fields];
    }
};

export default queryWrapper;
