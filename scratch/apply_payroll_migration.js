import pg from 'pg';
import fs from 'fs';
import path from 'path';

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

const { Client } = pg;
const client = new Client(config);

const sqlPath = path.resolve('supabase/migrations/20260611_restrict_payroll_policies.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
    try {
        console.log("Connecting to DB...");
        await client.connect();

        console.log("Applying RLS policy update migration...");
        await client.query(sql);
        console.log("✅ RLS policies updated successfully!");

        // Verify policies
        console.log("=== Verification ===");
        const { rows } = await client.query(`
            SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename IN ('payroll_records', 'salary_advances')
            ORDER BY tablename, policyname;
        `);
        rows.forEach(r => {
            console.log(`Table: ${r.tablename} | Policy: ${r.policyname} | Qual: ${r.qual}`);
        });

    } catch (err) {
        console.error("Database Error:", err);
    } finally {
        await client.end();
    }
}

run();
