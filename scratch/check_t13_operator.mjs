import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    console.log("=== Active attendance records for machine_id starting with 'T1.3' ===");
    const res = await client.query(`
        SELECT id, operator_id, machine_id, clock_in, clock_out 
        FROM public.operator_attendance 
        WHERE machine_id LIKE 'T1.3%' 
        ORDER BY clock_in DESC 
        LIMIT 10;
    `);
    console.log(res.rows);

    await client.end();
}
run();
