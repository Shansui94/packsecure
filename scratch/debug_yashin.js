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
        
        console.log("=== YASHIN'S RECENT ORDERS (JUNE 2026) ===");
        const res = await client.query(`
            SELECT id, order_number, customer, status, driver_id, notes, updated_at, pod_timestamp, pod_photo_url, trip_drop_count
            FROM public.sales_orders
            WHERE driver_id = 'f1e0b372-4d34-46c2-a3ab-3497688f1899' AND updated_at >= '2026-06-01'
            ORDER BY updated_at DESC;
        `);
        console.log(`Found ${res.rows.length} orders.`);
        res.rows.forEach(o => {
            console.log(`Order: ${o.order_number} | Cust: ${o.customer} | Status: ${o.status} | Drops: ${o.trip_drop_count} | Updated: ${o.updated_at} | POD: ${o.pod_timestamp}`);
            console.log(`POD Photos: ${o.pod_photo_url}`);
            console.log(`Notes: ${o.notes}\n`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
