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
        console.log("Connected to PG database successfully!");

        // Query user_activity_logs around 05:07:47 UTC on 2026-06-13
        const uLogsRes = await client.query(`
            SELECT id, user_id, created_at, role, action, email, name, details 
            FROM user_activity_logs 
            WHERE created_at >= '2026-06-13T05:00:00+00:00'
              AND created_at <= '2026-06-13T05:20:00+00:00'
            ORDER BY created_at DESC;
        `);

        console.log(`\nFound ${uLogsRes.rows.length} activity records between 13:00 and 13:20 local time:`);
        uLogsRes.rows.forEach(r => {
            console.log(`- Time: ${r.created_at.toISOString()} | Action: ${r.action} | User: ${r.name} (${r.email}) | Role: ${r.role}`);
            console.log(`  Details: ${JSON.stringify(r.details)}`);
            console.log(`-----------------------------------------------`);
        });

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
