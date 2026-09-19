import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const config = {
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD || '$QNQ4rAW*#%294z',
    host: 'db.kdahubyhwndgyloaljak.supabase.co',
    port: 5432,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function run() {
    const migrationFile = path.resolve('supabase/migrations/20260920_cure_v2_debt_canonical_tables.sql');
    console.log(`🚀 Reading migration SQL from: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');

    const client = new Client(config);
    try {
        console.log("🔌 Connecting to PostgreSQL direct host...");
        await client.connect();
        console.log("✅ Connected. Executing V2 Migration transaction...");

        const startTime = Date.now();
        await client.query(sql);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`🎉 MIGRATION COMPLETED SUCCESSFULLY in ${duration}s!`);
        console.log("🔄 Schema cache notification sent to PostgREST.");
    } catch (err) {
        console.error("❌ MIGRATION FAILED:", err);
        try {
            await client.query('ROLLBACK;');
            console.log("⚠️ Transaction safely rolled back.");
        } catch (rbErr) {
            console.error("Rollback error:", rbErr);
        }
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
