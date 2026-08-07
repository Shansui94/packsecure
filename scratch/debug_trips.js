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
        
        console.log("=== RECENTLY UPDATED SALES ORDERS ===");
        const ordersRes = await client.query(`
            SELECT id, order_number, customer, status, driver_id, notes, updated_at, pod_timestamp
            FROM public.sales_orders
            ORDER BY updated_at DESC
            LIMIT 20;
        `);
        ordersRes.rows.forEach(o => {
            console.log(`Order: ${o.order_number} | Cust: ${o.customer} | Status: ${o.status} | Driver: ${o.driver_id} | Updated: ${o.updated_at} | POD: ${o.pod_timestamp}`);
            console.log(`Notes: ${o.notes}\n`);
        });

        console.log("\n=== RECENT USER ACTIVITY LOGS ===");
        const logsRes = await client.query(`
            SELECT created_at, email, name, role, action, details
            FROM public.user_activity_logs
            ORDER BY created_at DESC
            LIMIT 30;
        `);
        logsRes.rows.forEach(l => {
            console.log(`[${l.created_at}] ${l.name} (${l.role || 'no-role'}): ${l.action}`);
            console.log(`Details: ${JSON.stringify(l.details)}\n`);
        });

        console.log("\n=== RECENT LORRY MILEAGE LOGS ===");
        const mileageRes = await client.query(`
            SELECT created_at, lorry_id, driver_id, mileage, log_type
            FROM public.lorry_mileage_logs
            ORDER BY created_at DESC
            LIMIT 20;
        `);
        mileageRes.rows.forEach(m => {
            console.log(`[${m.created_at}] Lorry: ${m.lorry_id} | Driver: ${m.driver_id} | Mileage: ${m.mileage} | Type: ${m.log_type}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
