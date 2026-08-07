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
        console.log("=== Fetching all audit records for AUDIT-20260625 ===");
        const res = await client.query(`
            SELECT sku, loc_id, change_qty, notes, timestamp
            FROM stock_ledger_v2
            WHERE ref_doc = 'AUDIT-20260625'
            ORDER BY sku ASC
        `);

        console.log(`Found ${res.rows.length} audit records in AUDIT-20260625:`);
        res.rows.forEach(r => {
            console.log(`SKU: "${r.sku}" | Loc: "${r.loc_id}" | Qty: ${r.change_qty} | Notes: "${r.notes}" | Timestamp: ${r.timestamp.toISOString()}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
