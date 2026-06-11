import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Querying ledger events for today (2026-06-10)...");
    
    // Query all Audit Adjustments for today
    const { data: audits, error: auditErr } = await s.from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Audit Adjustment')
        .gte('timestamp', '2026-06-10T00:00:00.000Z')
        .order('timestamp', { ascending: false });

    if (auditErr) {
        console.error("Error fetching audits:", auditErr);
    } else {
        console.log(`\n--- Audit Adjustments today (${audits.length} total) ---`);
        audits.forEach(row => {
            console.log(`- ${row.timestamp}: [${row.loc_id}] SKU: ${row.sku}, change: ${row.change_qty}, notes: "${row.notes}"`);
        });
    }

    // Query other transactions (production, delivery, etc.) that happened since 2026-06-10T10:00:00.000Z (which is 6 PM in GMT+8)
    const { data: afterSixTxns, error: txnsErr } = await s.from('stock_ledger_v2')
        .select('*')
        .neq('event_type', 'Audit Adjustment')
        .gte('timestamp', '2026-06-10T10:00:00.000Z') // 10:00:00Z is 18:00:00 (6 PM) GMT+8
        .order('timestamp', { ascending: true });

    if (txnsErr) {
        console.error("Error fetching post-6pm transactions:", txnsErr);
    } else {
        console.log(`\n--- Transactions after 6:00 PM (18:00:00 GMT+8) (${afterSixTxns.length} total) ---`);
        afterSixTxns.forEach(row => {
            console.log(`- ${row.timestamp}: [${row.loc_id}] [${row.event_type}] SKU: ${row.sku}, change: ${row.change_qty}, notes: "${row.notes}"`);
        });
    }
}

run();
