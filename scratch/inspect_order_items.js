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
        const res = await client.query(`
            SELECT order_number, items 
            FROM sales_orders 
            WHERE items IS NOT NULL AND jsonb_array_length(items) > 0
            LIMIT 5;
        `);
        console.log("Sample order items:");
        res.rows.forEach(r => {
            console.log(`Order: ${r.order_number}`);
            console.log(JSON.stringify(r.items, null, 2));
        });
    } catch (e) {
        console.error("PG Connection/Query error", e);
    } finally {
        await client.end();
    }
}

run();
