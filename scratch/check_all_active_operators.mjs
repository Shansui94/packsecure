import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    console.log("=== Active attendance records (clock_out IS NULL) ===");
    const res = await client.query(`
        SELECT id, operator_id, machine_id, clock_in 
        FROM public.operator_attendance 
        WHERE clock_out IS NULL 
        ORDER BY clock_in DESC;
    `);
    console.log(res.rows);

    await client.end();
}
run();
