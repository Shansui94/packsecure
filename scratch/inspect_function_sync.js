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

        // Fetch definition of handle_order_inventory_sync function
        console.log("\n=== Definition of handle_order_inventory_sync ===");
        const funcRes = await client.query(`
            SELECT pg_get_functiondef(oid) as definition
            FROM pg_proc 
            WHERE proname = 'handle_order_inventory_sync';
        `);
        if (funcRes.rows.length > 0) {
            console.log(funcRes.rows[0].definition);
        } else {
            console.log("Function handle_order_inventory_sync not found.");
        }

    } catch (e) {
        console.error("PG Connection/Query error", e);
    } finally {
        await client.end();
    }
}

run();
