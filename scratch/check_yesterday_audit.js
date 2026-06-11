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

        // Select all entries from stock_ledger_v2 on June 9, 2026 (UTC/local)
        // that are related to audits or adjustments
        console.log("\n--- Searching for yesterday's (June 9, 2026) audit entries ---");
        const query = `
            SELECT txn_id, timestamp, sku, change_qty, loc_id, event_type, notes, ref_doc, created_by_name
            FROM public.stock_ledger_v2
            WHERE (timestamp >= '2026-06-09 00:00:00+08' AND timestamp < '2026-06-10 00:00:00+08')
              AND (event_type IN ('Audit', 'Adjustment', 'Stock Take', 'Manual Adjustment', 'Audit Adjustment')
                   OR notes ILIKE '%audit%'
                   OR notes ILIKE '%adjust%')
            ORDER BY timestamp DESC;
        `;
        const res = await client.query(query);
        console.log(`Found ${res.rows.length} audit-related entries from yesterday:`);
        
        res.rows.forEach(r => {
            console.log(`\n- txn_id: ${r.txn_id}`);
            console.log(`  Timestamp: ${r.timestamp}`);
            console.log(`  SKU: ${r.sku}`);
            console.log(`  Location: ${r.loc_id}`);
            console.log(`  Event: ${r.event_type}`);
            console.log(`  Change Qty: ${r.change_qty}`);
            console.log(`  Notes: ${r.notes}`);
            console.log(`  Ref Doc: ${r.ref_doc}`);
            console.log(`  Created By: ${r.created_by_name}`);
        });

    } catch (e) {
        console.error("PG Connection/Query error", e);
    } finally {
        await client.end();
    }
}

run();
