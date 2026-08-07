import pg from 'pg';
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        
        console.log("=== DRIVER ACTIVITY LOGS (SINCE JUNE 10, EXCLUDING MAX) ===");
        const res = await client.query(`
            SELECT created_at, email, name, role, action, details
            FROM public.user_activity_logs
            WHERE created_at >= '2026-06-10T00:00:00+08'
              AND name != 'Max Tan'
              AND role = 'Driver'
            ORDER BY created_at DESC
            LIMIT 100;
        `);
        console.log(`Found ${res.rows.length} driver logs.`);
        res.rows.forEach(l => {
            console.log(`[${l.created_at}] ${l.name} (${l.role || 'no-role'}): ${l.action}`);
            console.log(`Details: ${JSON.stringify(l.details)}\n`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
