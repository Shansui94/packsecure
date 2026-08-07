import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    // Look for connection string in env
    const connectionString = process.env.DATABASE_URL || 
                             process.env.SUPABASE_DB_URL || 
                             process.env.SUPABASE_CONNECTION_STRING ||
                             process.env.DIRECT_URL;
                             
    if (!connectionString) {
        console.error("No PostgreSQL connection string found in .env keys:", Object.keys(process.env).filter(k => k.toLowerCase().includes('db') || k.toLowerCase().includes('url') || k.toLowerCase().includes('conn')));
        return;
    }

    console.log("Connecting to PostgreSQL...");
    const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected successfully!");

        // 1. Query if RLS is enabled on operator_attendance
        const rlsRes = await client.query(`
            SELECT relname, relrowsecurity 
            FROM pg_class 
            WHERE relname = 'operator_attendance';
        `);
        console.log("\nRLS Status for operator_attendance:");
        console.log(rlsRes.rows);

        // 2. Query policies on operator_attendance
        const policiesRes = await client.query(`
            SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'operator_attendance';
        `);
        console.log("\nPolicies defined on operator_attendance:");
        console.log(policiesRes.rows);

    } catch (err) {
        console.error("Database query failed:", err);
    } finally {
        await client.end();
    }
}

run();
