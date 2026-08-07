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

        // Update status of order DO-Taufik-260611-001 to 'Loaded'
        const updateRes = await client.query(`
            UPDATE sales_orders 
            SET status = 'Loaded' 
            WHERE order_number = 'DO-Taufik-260611-001'
            RETURNING id, order_number, status, updated_at;
        `);

        if (updateRes.rows.length === 0) {
            console.log("Order not found or not updated.");
            return;
        }

        console.log("\n=== Update Result ===");
        console.log(`Order Number: ${updateRes.rows[0].order_number}`);
        console.log(`New Status: ${updateRes.rows[0].status}`);
        console.log(`Updated At: ${updateRes.rows[0].updated_at}`);

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
