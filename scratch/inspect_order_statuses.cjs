const pg = require('pg');
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function main() {
    const client = new Client(config);
    await client.connect();
    try {
        console.log("=== Querying unique order statuses from the last 7 days ===");
        const res = await client.query(`
            SELECT DISTINCT status
            FROM sales_orders
            WHERE created_at >= NOW() - INTERVAL '7 days'
        `);
        console.log("Statuses found:", res.rows.map(r => r.status));

        console.log("\n=== Querying uncompleted orders created on or before June 24, 2026 (前天或之前) ===");
        // Local timezone is UTC+8. June 24, 2026 23:59:59 is 2026-06-24T15:59:59Z
        const res2 = await client.query(`
            SELECT so.id, so.order_number, so.status, so.created_at, u.name as driver_name, so.delivery_address
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.status NOT IN ('Delivered', 'Cancelled', 'tamat')
              AND so.created_at < '2026-06-24T16:00:00Z'
            ORDER BY so.created_at DESC
        `);
        console.log(`Found ${res2.rows.length} uncompleted orders from June 24 or before.`);
        console.table(res2.rows.map(r => ({
            ...r,
            created_at: r.created_at.toISOString()
        })));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
