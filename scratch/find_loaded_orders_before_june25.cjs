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
        console.log("=== Finding all sales_orders in 'Loaded' status created on or before June 24, 2026 (UTC) ===");
        const res = await client.query(`
            SELECT so.id, so.order_number, so.status, so.created_at, u.name as driver_name, so.delivery_address
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.status = 'Loaded'
              AND so.created_at < '2026-06-24T16:00:00Z'
            ORDER BY so.created_at DESC
        `);

        console.log(`Found ${res.rows.length} loaded orders from June 24 or before to update.`);
        res.rows.forEach((r, idx) => {
            console.log(`${idx + 1}. Order: ${r.order_number} | Driver: ${r.driver_name} | Created: ${r.created_at.toISOString()} | Dest: ${r.delivery_address}`);
        });

        // Write IDs and original info to backup file for reversibility
        const fs = require('fs');
        fs.writeFileSync('scratch/backup_loaded_orders_to_update.json', JSON.stringify(res.rows, null, 2));
        console.log("Wrote backup of targeted orders to scratch/backup_loaded_orders_to_update.json");

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
