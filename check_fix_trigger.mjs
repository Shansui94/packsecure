import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFix() {
    console.log("Checking if the trigger actually exists on production_logs_v2...");
    const { data: d1 } = await s.rpc('execute_sql', {
        sql_query: "SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table = 'production_logs_v2'"
    }).catch(e => ({ data: e.message }));
    console.log("Trigger status:", d1);

    // Let's test inserting a fake row into v2 to see if it makes a ledger entry
    const { data: q1, error: e1 } = await s.from('production_logs_v2').insert({
        machine_id: 'N1-M01',
        sku: 'UNKNOWN',
        output_qty: 1,
        note: 'TEST LIVE STOCK'
    }).select('log_id').single();

    if (e1) {
        console.log("Failed to insert v2 test log:", e1);
    } else {
        console.log("Inserted test log:", q1.log_id);
        const { data: ledgerRows } = await s.from('stock_ledger_v2')
            .select('*')
            .eq('ref_doc', q1.log_id)
            .limit(1);
        console.log("Resulting ledger row from trigger:", ledgerRows);

        // cleanup
        await s.from('production_logs_v2').delete().eq('log_id', q1.log_id);
    }
}
checkFix();
