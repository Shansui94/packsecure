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

        // Query user_activity_logs for the order number in details JSONB
        console.log("\n=== Checking user_activity_logs ===");
        const uLogsRes = await client.query(`
            SELECT * 
            FROM user_activity_logs 
            WHERE details::text ILIKE '%DO-Ameer-260612-001%'
            ORDER BY created_at DESC;
        `);
        console.log(`Found ${uLogsRes.rows.length} records in user_activity_logs:`);
        uLogsRes.rows.forEach(r => {
            console.log(`- Time: ${r.created_at} | Action: ${r.action} | User: ${r.name} (${r.email}) | Role: ${r.role}`);
            console.log(`  Details: ${JSON.stringify(r.details)}`);
            console.log(`-----------------------------------------------`);
        });

        // 3. Query dev_logs for the order number
        console.log("\n=== Checking dev_logs ===");
        try {
            const devRes = await client.query(`
                SELECT * 
                FROM dev_logs 
                WHERE message ILIKE '%DO-Ameer-260612-001%'
                   OR payload::text ILIKE '%DO-Ameer-260612-001%'
                ORDER BY created_at DESC;
            `);
            console.log(`Found ${devRes.rows.length} records in dev_logs:`);
            devRes.rows.forEach(r => {
                console.log(`- Time: ${r.created_at} | Level: ${r.level} | Msg: ${r.message}`);
                console.log(`-----------------------------------------------`);
            });
        } catch (e) {
            console.log("Failed to query dev_logs:", e.message);
        }

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
