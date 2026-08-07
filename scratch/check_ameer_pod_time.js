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
            SELECT id, order_number, status, created_at, updated_at, pod_timestamp, pod_photo_url, proof_of_load_url, notes
            FROM sales_orders 
            WHERE order_number = 'DO-Ameer-260612-001';
        `);

        if (res.rows.length === 0) {
            console.log("Order not found.");
            return;
        }

        const o = res.rows[0];
        console.log("\n=== Timestamps & Status ===");
        console.log(`Order Number: ${o.order_number}`);
        console.log(`Status: ${o.status}`);
        console.log(`Created At: ${o.created_at ? o.created_at.toISOString() : 'null'}`);
        console.log(`Updated At: ${o.updated_at ? o.updated_at.toISOString() : 'null'}`);
        console.log(`POD Timestamp: ${o.pod_timestamp}`);
        console.log(`POD Photo URL: ${o.pod_photo_url}`);
        console.log(`Proof of Load: ${o.proof_of_load_url}`);
        console.log(`Notes: ${o.notes}`);

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
