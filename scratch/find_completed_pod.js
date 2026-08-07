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
        
        console.log("=== DELIVERED ORDERS BY POD_TIMESTAMP (SINCE JUNE 16) ===");
        const res = await client.query(`
            SELECT id, order_number, customer, status, driver_id, notes, updated_at, pod_timestamp
            FROM public.sales_orders
            WHERE status = 'Delivered' AND pod_timestamp >= '2026-06-16T00:00:00'
            ORDER BY pod_timestamp DESC;
        `);
        console.log(`Found ${res.rows.length} orders.`);
        res.rows.forEach(o => {
            console.log(`Order: ${o.order_number} | Cust: ${o.customer} | Driver: ${o.driver_id} | Updated: ${o.updated_at} | POD: ${o.pod_timestamp}`);
            console.log(`Notes: ${o.notes}\n`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
