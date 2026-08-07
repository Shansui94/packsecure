import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    console.log("=== Columns and values of T1.1-M03 ===");
    const res = await client.query(`
        SELECT * 
        FROM public.sys_machines_v2 
        WHERE machine_id = 'T1.1-M03';
    `);
    console.log(res.rows[0]);

    await client.end();
}
run();
