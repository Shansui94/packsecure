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
        console.log("=== Finding Loaded orders created before June 29, 2026 16:00 +08:00 (08:00 UTC) ===");
        
        // Let's first inspect all columns of sales_orders to check for any other timestamp like loaded_at or transition times
        const colsRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sales_orders' AND table_schema = 'public'
        `);
        console.log("sales_orders columns:");
        colsRes.rows.forEach(c => {
            if (c.column_name.includes('time') || c.column_name.includes('date') || c.column_name.includes('at')) {
                console.log(`- ${c.column_name}: ${c.data_type}`);
            }
        });

        // Let's query loaded orders
        const res = await client.query(`
            SELECT so.id, so.order_number, so.status, so.created_at, u.name as driver_name, so.delivery_address
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.status = 'Loaded'
              AND so.created_at < '2026-06-29T08:00:00Z'
            ORDER BY so.created_at DESC
        `);

        console.log(`\nFound ${res.rows.length} loaded orders before June 29 16:00 +08:00:`);
        res.rows.forEach((r, idx) => {
            console.log(`${idx + 1}. Order: ${r.order_number} | Driver: ${r.driver_name} | Created: ${r.created_at.toISOString()} | Dest: ${r.delivery_address}`);
        });

        // Write to backup
        const fs = require('fs');
        fs.writeFileSync('scratch/backup_loaded_orders_before_june29_1600.json', JSON.stringify(res.rows, null, 2));
        console.log("\nWrote backup to scratch/backup_loaded_orders_before_june29_1600.json");

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
