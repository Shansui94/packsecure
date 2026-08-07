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
        
        console.log("=== CHECKING TRIP_DROP_COUNT ON RECENT ORDERS ===");
        const res = await client.query(`
            SELECT order_number, status, driver_id, trip_drop_count, created_at
            FROM public.sales_orders
            WHERE created_at >= '2026-06-12T00:00:00+08'
            ORDER BY created_at DESC;
        `);
        console.log(`Found ${res.rows.length} orders since June 12.`);
        res.rows.forEach(o => {
            console.log(`Order: ${o.order_number} | Status: ${o.status} | Driver: ${o.driver_id} | Drops: ${o.trip_drop_count} | Created: ${o.created_at}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
