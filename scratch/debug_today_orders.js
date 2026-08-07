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
        
        console.log("=== ORDERS UPDATED TODAY (2026-06-17) ===");
        const ordersRes = await client.query(`
            SELECT id, order_number, customer, status, driver_id, notes, updated_at, pod_timestamp
            FROM public.sales_orders
            WHERE updated_at >= '2026-06-17 00:00:00+08'
            ORDER BY updated_at DESC;
        `);
        console.log(`Found ${ordersRes.rows.length} orders updated today.`);
        ordersRes.rows.forEach(o => {
            console.log(`Order: ${o.order_number} | Cust: ${o.customer} | Status: ${o.status} | Driver: ${o.driver_id} | Updated: ${o.updated_at} | POD: ${o.pod_timestamp}`);
            console.log(`Notes: ${o.notes}\n`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
