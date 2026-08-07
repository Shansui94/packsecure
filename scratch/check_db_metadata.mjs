import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    console.log("=== Triggers on operator_attendance ===");
    const res = await client.query(`
        SELECT trigger_name, event_manipulation, action_statement, action_timing
        FROM information_schema.triggers
        WHERE event_object_table = 'operator_attendance';
    `);
    console.log(res.rows);

    console.log("\n=== Checking record details for cfd9f170-6c80-4da5-bc92-0ca72b4d5119 ===");
    const res2 = await client.query(`
        SELECT * FROM operator_attendance WHERE id = 'cfd9f170-6c80-4da5-bc92-0ca72b4d5119';
    `);
    console.log(res2.rows);

    await client.end();
}
run();
