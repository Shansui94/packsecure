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
            SELECT id, order_number, status, created_at, updated_at
            FROM sales_orders 
            WHERE order_number = 'DO-Ameer-260612-001';
        `);

        if (res.rows.length === 0) {
            console.log("Order not found.");
            return;
        }

        const o = res.rows[0];
        console.log("\n=== Exact Timestamps ===");
        console.log(`Order Number: ${o.order_number}`);
        console.log(`Status: ${o.status}`);
        console.log(`Created At (ISO): ${o.created_at.toISOString()}`);
        console.log(`Updated At (ISO): ${o.updated_at.toISOString()}`);
        console.log(`Are they identical? ${o.created_at.getTime() === o.updated_at.getTime()}`);

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
