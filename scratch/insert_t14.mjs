import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    console.log("Inserting machine T1.4-M04 into sys_machines_v2...");
    try {
        const query = `
            INSERT INTO public.sys_machines_v2 (
                machine_id, name, type, status, factory_id, base_width, rolls_per_alarm
            ) VALUES (
                'T1.4-M04', 'Stretch Film (T1.4)', 'Extruder', 'Idle', 'T1', 50, 1
            )
            ON CONFLICT (machine_id) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                status = EXCLUDED.status,
                factory_id = EXCLUDED.factory_id,
                base_width = EXCLUDED.base_width,
                rolls_per_alarm = EXCLUDED.rolls_per_alarm;
        `;
        const res = await client.query(query);
        console.log("Insert successful! Rows affected:", res.rowCount);
    } catch (err) {
        console.error("Insert failed:", err);
    } finally {
        await client.end();
    }
}
run();
