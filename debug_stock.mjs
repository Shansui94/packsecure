import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.kdahubyhwndgyloaljak',
  password: '$QNQ4rAW*#%294z',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to database.");

        // 1. Get view columns to understand structure
        const colsRes = await client.query(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_inventory_view'`
        );
        const cols = colsRes.rows.map(c => c.column_name);
        console.log("Columns of v2_inventory_view:", cols.join(', '));

        // 2. Fetch all entries from v2_inventory_view
        const allRes = await client.query(`SELECT * FROM public.v2_inventory_view`);
        
        // Find which column represents the stock quantity
        const qtyCol = cols.find(c => c === 'quantity' || c === 'qty_on_hand' || c === 'stock' || c === 'current_stock') || cols[cols.length - 1];
        console.log(`Using quantity column: '${qtyCol}'`);

        // Filter negative entries
        const negativeRows = allRes.rows.filter(r => Number(r[qtyCol]) < 0);
        console.log(`\n=== Found ${negativeRows.length} Negative Inventory Entries ===`);
        negativeRows.forEach(r => {
            console.log(`SKU: ${r.sku} | Loc: ${r.loc_id || r.location_name} | Qty: ${r[qtyCol]}`);
        });

        // 3. For each negative SKU, print its ledger history since 5:00 PM today (09:00 UTC)
        console.log("\n=== Ledger History for Negative SKUs since 17:00 (09:00 UTC) today ===");
        for (const neg of negativeRows) {
            console.log(`\nHistory for SKU: ${neg.sku} at Loc: ${neg.loc_id || neg.location_id}`);
            const ledgerRes = await client.query(
                `SELECT timestamp, event_type, change_qty, ref_doc, loc_id, notes 
                 FROM public.stock_ledger_v2 
                 WHERE sku = $1 AND timestamp >= '2026-06-10T09:00:00Z'::timestamptz
                 ORDER BY timestamp ASC`,
                [neg.sku]
            );
            
            ledgerRes.rows.forEach(x => {
                const localTime = new Date(x.timestamp).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
                console.log(`  - Local Time: ${localTime} | Event: ${x.event_type} | Change: ${x.change_qty} | Ref: ${x.ref_doc} | Loc: ${x.loc_id} | Notes: ${x.notes}`);
            });
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
