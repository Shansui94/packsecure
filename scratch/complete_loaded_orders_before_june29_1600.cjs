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
        console.log("=== Batch Updating 'Loaded' sales_orders created before June 29, 2026 16:00 (local) to 'Delivered' ===");
        
        const res = await client.query(`
            UPDATE sales_orders
            SET status = 'Delivered',
                pod_timestamp = NOW(),
                notes = CASE 
                    WHEN notes IS NULL OR notes = '' THEN 'Backend auto-delivered: June 29 16:00 before Loaded order.'
                    ELSE notes || E'\nBackend auto-delivered: June 29 16:00 before Loaded order.'
                END
            WHERE status = 'Loaded'
              AND created_at < '2026-06-29T08:00:00Z'
            RETURNING id, order_number, status;
        `);

        console.log(`Successfully updated ${res.rows.length} sales orders.`);
        res.rows.forEach((r, idx) => {
            console.log(`${idx + 1}. Order: ${r.order_number} (ID: ${r.id}) -> New Status: ${r.status}`);
        });

    } catch (e) {
        console.error("Error during update:", e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
