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

        // Update DO-Ameer-260612-001 status back to Loaded, clear pod_timestamp
        const res = await client.query(`
            UPDATE sales_orders 
            SET status = 'Loaded', pod_timestamp = NULL 
            WHERE order_number = 'DO-Ameer-260612-001'
            RETURNING id, order_number, status, pod_timestamp;
        `);

        if (res.rows.length === 0) {
            console.log("Order not found.");
            return;
        }

        const o = res.rows[0];
        console.log("\n=== Reverted Order Details ===");
        console.log(`Order Number: ${o.order_number}`);
        console.log(`Status: ${o.status}`);
        console.log(`POD Timestamp: ${o.pod_timestamp}`);

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
