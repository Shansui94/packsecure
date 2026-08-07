import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    console.log("=== Machines in legacy machines table ===");
    const res = await client.query(`
        SELECT machine_id, name, type, status 
        FROM public.machines 
        ORDER BY machine_id;
    `);
    console.log(res.rows);

    await client.end();
}
run();
