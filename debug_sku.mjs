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

        const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';

        console.log(`\n=== All-Time Grouped Events for ${sku} ===`);
        const groupRes = await client.query(
            `SELECT loc_id, event_type, SUM(change_qty) as total_change, COUNT(*) as count
             FROM public.stock_ledger_v2
             WHERE sku = $1
             GROUP BY loc_id, event_type
             ORDER BY loc_id, event_type`,
            [sku]
        );
        groupRes.rows.forEach(g => {
            console.log(`Loc: ${g.loc_id} | Event: ${g.event_type} | Total Change: ${g.total_change} | Count: ${g.count}`);
        });

        console.log(`\n=== Checking if any Audit has ever been done for ${sku} at Nilai ===`);
        const auditRes = await client.query(
            `SELECT timestamp, event_type, change_qty, ref_doc, loc_id, notes 
             FROM public.stock_ledger_v2 
             WHERE sku = $1 AND event_type LIKE '%Audit%' AND loc_id = 'Nilai'
             ORDER BY timestamp DESC`
        );
        console.log(`Found ${auditRes.rows.length} audits at Nilai:`);
        auditRes.rows.forEach(x => {
            console.log(`- Time: ${x.timestamp.toISOString()} | Qty: ${x.change_qty} | Ref: ${x.ref_doc} | Notes: ${x.notes}`);
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
