import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function verifyProduction() {
    // Check logs since 2026-03-27 01:40 UTC (09:40 MYT when rollback finished)
    const cutoffDate = '2026-03-27T01:40:00+00:00';
    console.log(`=== Checking Production since Rollback (${cutoffDate} UTC) ===\n`);

    const { data: v1Logs } = await supabase
        .from('production_logs')
        .select('*')
        .gte('created_at', cutoffDate)
        .order('created_at', { ascending: false });

    console.log(`[1] New 'production_logs' (v1) Pulses: ${v1Logs?.length || 0}`);
    if (v1Logs && v1Logs.length > 0) {
        console.log("    Latest 3 pulses:");
        v1Logs.slice(0, 3).forEach(l => {
            console.log(`    - ${l.machine_id}: ${l.alarm_count} qty (SKU: ${l.product_sku}) @ ${l.created_at}`);
        });
    }

    const { data: stockLogs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Production')
        .gte('timestamp', cutoffDate)
        .order('timestamp', { ascending: false });

    console.log(`\n[2] New 'stock_ledger_v2' Production entries: ${stockLogs?.length || 0}`);
    if (stockLogs && stockLogs.length > 0) {
        console.log("    Latest 3 stock increments:");
        stockLogs.slice(0, 3).forEach(s => {
            console.log(`    - SKU: ${s.sku} | Change: +${s.change_qty} | Ref: ${s.ref_doc} @ ${s.timestamp}`);
        });
    }

    if (v1Logs?.length && stockLogs?.length && v1Logs.length > 0 && stockLogs.length > 0) {
        console.log("\n✅ CONCLUSION: Machines are logging data AND entering stock correctly!");
    } else if (v1Logs?.length && v1Logs.length > 0 && (!stockLogs || stockLogs.length === 0)) {
        console.log("\n❌ CONCLUSION: Machines are sending data, but stock ledger is not updating (Trigger failing).");
    } else {
        console.log("\n⏳ CONCLUSION: No new pulses have arrived since the rollback. Wait for machines to print more rolls.");
    }
}

verifyProduction().catch(console.error);
