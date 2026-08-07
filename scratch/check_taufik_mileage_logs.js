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

        const res = await client.query(`
            SELECT id, lorry_id, driver_id, mileage, log_type, created_at
            FROM lorry_mileage_logs 
            WHERE driver_id = '33309909-7102-41da-adc7-44606fdcb09a'
              AND created_at >= '2026-06-12T00:00:00+00:00'
            ORDER BY created_at DESC;
        `);

        console.log(`\nFound ${res.rows.length} mileage logs for Taufik since June 12:`);
        res.rows.forEach(l => {
            console.log(`- Time: ${l.created_at} | Lorry ID: ${l.lorry_id} | Log Type: ${l.log_type} | Mileage: ${l.mileage}`);
        });

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
