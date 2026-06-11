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

        // Query view definition
        console.log("\n=== Checking View Definition ===");
        const viewDefRes = await client.query(
            `SELECT pg_get_viewdef('public.v2_inventory_view'::regclass, true) as def`
        );
        console.log(viewDefRes.rows[0]?.def);

        console.log("\n=== Checking Columns of v2_inventory_view ===");
        const colsRes = await client.query(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_inventory_view'`
        );
        colsRes.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));

        console.log("\n=== Checking Negative Stock in v2_inventory_view ===");
        // We will run this dynamically once we know the column name, but let's query where the value is < 0 using a SELECT * first and filter in JS
        const negRes = await client.query(
            `SELECT * FROM public.v2_inventory_view`
        );
        const negativeRows = negRes.rows.filter(r => {
            const keys = Object.keys(r);
            return keys.some(k => typeof r[k] === 'number' && r[k] < 0);
        });
        console.log(`Found ${negativeRows.length} negative entries:`);
        negativeRows.forEach(r => {
            console.log(JSON.stringify(r));
        });

        console.log("\n=== Checking stock_ledger_v2 entries after 17:30 local time (2026-06-10 09:30 UTC) ===");
        const ledgerRes = await client.query(
            `SELECT timestamp, event_type, sku, change_qty, ref_doc, loc_id, notes 
             FROM public.stock_ledger_v2 
             WHERE timestamp >= '2026-06-10T09:30:00Z'::timestamptz 
             ORDER BY timestamp ASC`
        );
        console.log(`Found ${ledgerRes.rows.length} entries:`);
        ledgerRes.rows.forEach(x => {
            console.log(`- TS: ${x.timestamp.toISOString()} | Event: ${x.event_type} | SKU: ${x.sku} | Qty: ${x.change_qty} | Ref: ${x.ref_doc} | Loc: ${x.loc_id} | Notes: ${x.notes}`);
        });

    } catch (err) {
        console.error("Error during execution:", err);
    } finally {
        await client.end();
    }
}

run();
