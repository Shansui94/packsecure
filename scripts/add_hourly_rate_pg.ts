import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log("=== Checking Postgres Connection ===");
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
    
    if (dbUrl) {
        console.log("Found database connection string. Connecting...");
        const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();
            console.log("Connected to Postgres!");
            await client.query('ALTER TABLE sys_machines_v2 ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0;');
            console.log("✅ Successfully added hourly_rate column to sys_machines_v2 via Postgres!");
            await client.end();
            return;
        } catch (e: any) {
            console.error("Postgres query error:", e.message);
        }
    } else {
        console.log("No direct DATABASE_URL found in .env.");
    }

    console.log("Checking if we can store machine rates in a dedicated table or JSON...");
}

run();
