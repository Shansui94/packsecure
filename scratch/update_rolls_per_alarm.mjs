import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    console.log("Updating rolls_per_alarm = 2 for T1.1-M03 and T1.4-M04 in sys_machines_v2...");
    try {
        const query = `
            UPDATE public.sys_machines_v2 
            SET rolls_per_alarm = 2 
            WHERE machine_id IN ('T1.1-M03', 'T1.4-M04');
        `;
        const res = await client.query(query);
        console.log("Update successful! Rows affected:", res.rowCount);
    } catch (err) {
        console.error("Update failed:", err);
    } finally {
        await client.end();
    }
}
run();
