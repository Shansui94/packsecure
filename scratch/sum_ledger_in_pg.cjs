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
        const sku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED';
        
        console.log("=== Query 1: Direct sum from stock_ledger_v2 in PG ===");
        const res1 = await client.query(`
            SELECT loc_id, SUM(change_qty) as total_qty
            FROM stock_ledger_v2
            WHERE sku = $1
            GROUP BY loc_id
        `, [sku]);
        console.log("Direct ledger sum by location:", res1.rows);

        console.log("\n=== Query 2: Sum from stock_ledger_v2 where timestamp <= NOW() ===");
        const res2 = await client.query(`
            SELECT loc_id, SUM(change_qty) as total_qty
            FROM stock_ledger_v2
            WHERE sku = $1 AND timestamp <= NOW()
            GROUP BY loc_id
        `, [sku]);
        console.log("Direct ledger sum (timestamp <= NOW()):", res2.rows);

        console.log("\n=== Query 3: Select from v2_inventory_view ===");
        const res3 = await client.query(`
            SELECT loc_id, current_stock, last_updated
            FROM v2_inventory_view
            WHERE sku = $1
        `, [sku]);
        console.log("v2_inventory_view rows:", res3.rows);

        console.log("\n=== Query 4: Check if there are future timestamp records ===");
        const res4 = await client.query(`
            SELECT txn_id, timestamp, change_qty, loc_id, notes
            FROM stock_ledger_v2
            WHERE sku = $1 AND timestamp > NOW()
        `, [sku]);
        console.log("Future timestamp records:", res4.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
