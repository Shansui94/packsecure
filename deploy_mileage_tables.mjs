import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG database successfully!");

        console.log("Reading 20260612_lorry_mileage.sql...");
        const sql = fs.readFileSync('supabase/migrations/20260612_lorry_mileage.sql', 'utf8');

        console.log("Executing SQL migration...");
        await client.query(sql);
        console.log("Migration executed successfully! Lorry mileage tables created.");

    } catch (e) {
        console.error("Migration execution error:", e);
    } finally {
        await client.end();
    }
}

run();
