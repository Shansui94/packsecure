import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

// MYT 06:35 = UTC 22:35 (previous day, March 26)
const cutoff = '2026-03-26T22:35:00+00:00';
console.log(`Checking since: ${cutoff} (= MYT 06:35 27-Mar)`);

async function liveCheck() {
    // 1. New production_logs_v2 after SQL fix
    const { count: newProd } = await supabase
        .from('production_logs_v2')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', cutoff);
    
    // 2. New stock_ledger_v2 Production after SQL fix
    const { count: newStock } = await supabase
        .from('stock_ledger_v2')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'Production')
        .gte('timestamp', cutoff);

    console.log(`\nNew production_logs_v2 after fix: ${newProd}`);
    console.log(`New stock_ledger_v2 Production after fix: ${newStock}`);

    // 3. Show latest production_logs_v2 
    const { data: latestProd } = await supabase
        .from('production_logs_v2')
        .select('log_id, sku, machine_id, output_qty, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    
    console.log("\nLatest 5 production_logs_v2 rows:");
    latestProd?.forEach(r => console.log(`  ${r.log_id} | ${r.sku} | qty: ${r.output_qty} | ${r.created_at}`));

    // 4. Show latest stock_ledger_v2 Production entries
    const { data: latestStock } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Production')
        .order('timestamp', { ascending: false })
        .limit(5);
    
    console.log("\nLatest 5 stock_ledger_v2 Production entries:");
    latestStock?.forEach(r => console.log(`  ${r.ref_doc} | ${r.sku} | qty: ${r.change_qty} | ${r.timestamp}`));

    // 5. Check if production_logs (v1) has new entries (maybe LiveStock reads from here)
    const { count: v1Count } = await supabase
        .from('production_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', cutoff);
    console.log(`\nNew production_logs (v1) after fix: ${v1Count}`);

    // Conclusion
    const newProdN = newProd || 0;
    const newStockN = newStock || 0;
    if (newProdN > 0 && newStockN === 0) {
        console.log("\n❌ TRIGGER STILL NOT FIRING for new production!");
    } else if (newProdN > 0 && newStockN > 0) {
        console.log(`\n✅ TRIGGER WORKING! ${newStockN}/${newProdN} production rows made it to stock.`);
    } else {
        console.log("\n⚠️ No new production_logs_v2 rows — machines may not be running.");
    }
}

liveCheck().catch(console.error);
