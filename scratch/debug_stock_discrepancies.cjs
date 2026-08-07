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
        // Let's query the 19 items from AUDIT-20260624 and show their current stock in v2_inventory_view
        const res = await client.query(`
            SELECT sku, loc_id, current_stock
            FROM v2_inventory_view
            WHERE sku IN (
                SELECT DISTINCT sku
                FROM stock_ledger_v2
                WHERE ref_doc = 'AUDIT-20260624'
            )
            ORDER BY sku, loc_id;
        `);

        console.log("=== Stock in v2_inventory_view ===");
        res.rows.forEach(r => {
            console.log(`SKU: ${r.sku} | Loc: ${r.loc_id} | Stock: ${r.current_stock}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
