import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTriggerAndSchema() {
    // 1. Check if trigger exists on production_logs_v2
    console.log("=== 1. Triggers on production_logs_v2 ===");
    const { data: triggers, error: trigErr } = await supabase.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation, action_statement 
              FROM information_schema.triggers 
              WHERE event_object_table = 'production_logs_v2'`
    });
    if (trigErr) {
        console.log("  RPC exec_sql not available, trying raw query...");
        // Alternative: query pg_trigger
        const { data: t2, error: e2 } = await supabase
            .from('pg_trigger')
            .select('*')
            .limit(1);
        console.log("  pg_trigger:", e2?.message || JSON.stringify(t2));
    } else {
        console.log("  Triggers:", JSON.stringify(triggers));
    }

    // 2. stock_ledger_v2 schema
    console.log("\n=== 2. stock_ledger_v2 column schema ===");
    const { data: cols, error: colErr } = await supabase.rpc('exec_sql', {
        sql: `SELECT column_name, data_type, is_nullable 
              FROM information_schema.columns 
              WHERE table_name = 'stock_ledger_v2' 
              ORDER BY ordinal_position`
    });
    if (colErr) {
        console.log("  Error:", colErr.message);
        // Fallback: try inserting a test row to see the error
        console.log("  Attempting test insert to see schema...");
        const { error: insErr } = await supabase.from('stock_ledger_v2').insert({
            sku: '__TEST__',
            change_qty: 0,
            event_type: 'Test',
            ref_doc: 'test',
            notes: 'schema probe',
            timestamp: new Date().toISOString()
        });
        if (insErr) {
            console.log("  Insert error:", insErr.message, insErr.details, insErr.hint);
        } else {
            console.log("  ✅ Insert succeeded! Schema matches.");
            // Clean up
            await supabase.from('stock_ledger_v2').delete().eq('sku', '__TEST__');
        }
    } else {
        console.log("  Columns:", JSON.stringify(cols));
    }

    // 3. Try the trigger columns: production_logs_v2 has output_qty but trigger uses alarm_count
    console.log("\n=== 3. production_logs_v2 schema ===");
    const { data: v2Cols, error: v2Err } = await supabase.rpc('exec_sql', {
        sql: `SELECT column_name FROM information_schema.columns WHERE table_name = 'production_logs_v2'`
    });
    if (v2Err) {
        // Already know from earlier: log_id, job_id, sku, machine_id, operator_id, start_time, end_time, output_qty, reject_qty, batch_code, created_at, note
        console.log("  Known columns: log_id, job_id, sku, machine_id, operator_id, start_time, end_time, output_qty, reject_qty, batch_code, created_at, note");
        console.log("  ⚠️ The trigger uses NEW.alarm_count but v2 table has output_qty!");
        console.log("  ⚠️ The trigger uses NEW.id but v2 table has log_id!");
    }

    // 4. Check machine_active_products
    console.log("\n=== 4. machine_active_products ===");
    const { data: map, error: mapErr } = await supabase
        .from('machine_active_products')
        .select('*')
        .limit(10);
    if (mapErr) console.log("  Error:", mapErr.message);
    else {
        console.log(`  Found ${map?.length || 0} entries`);
        map?.forEach(m => console.log(`  ${JSON.stringify(m)}`));
    }

    // 5. How LiveStock.tsx reads data
    console.log("\n=== 5. Checking for v2_inventory_view ===");
    const { data: view, error: viewErr } = await supabase.from('v2_inventory_view').select('*').limit(3);
    if (viewErr) console.log("  v2_inventory_view:", viewErr.message);
    else console.log("  View data:", JSON.stringify(view));
}

checkTriggerAndSchema().catch(console.error);
