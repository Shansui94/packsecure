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

        // Query Taufik's recent orders
        const res = await client.query(`
            SELECT id, order_number, status, created_at, order_date, deadline, pod_timestamp, pod_photo_url, proof_of_load_url, notes
            FROM sales_orders 
            WHERE (order_number = 'DO-Taufik-260612-001' OR order_number = 'DO-Taufik-260613-001')
            ORDER BY created_at DESC;
        `);

        console.log("\n=== Taufik's Recent Orders ===");
        res.rows.forEach(o => {
            console.log(`Order: ${o.order_number}`);
            console.log(`  Status: ${o.status}`);
            console.log(`  Created At: ${o.created_at}`);
            console.log(`  POD Timestamp: ${o.pod_timestamp}`);
            console.log(`  Notes: ${o.notes}`);
            console.log(`  Proof of Load: ${o.proof_of_load_url}`);
            console.log(`  POD Photo URL: ${o.pod_photo_url}`);
            console.log(`-----------------------------------------------`);
        });

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
