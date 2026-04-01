import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    console.log("=== 1. Searching for V1 Stock Audits for OPM Lama ===");
    // Find the latest stock audits in V1
    const { data: audits, error: e1 } = await supabase
        .from('stock_ledger')
        .select('*')
        .in('event_type', ['Stock Audit', 'Manual Adjustment', 'Initial Stock'])
        .eq('loc_id', 'OPM Lama')
        .order('timestamp', { ascending: false })
        .limit(50);
        
    if (e1) {
        console.error("Error fetching V1 audits:", e1);
    } else {
        console.log(`Found ${audits?.length || 0} historical audits.`);
        if (audits?.length) {
            console.log(audits.slice(0, 5));
        }
    }

    console.log("=== 2. Summarizing Missing V2 Production Logs ===");
    // Find logs in V2 that DON'T have a stock ledger entry
    const { data: logs, error: e2 } = await supabase
        .from('production_logs_v2')
        .select('log_id, sku, machine_id, output_qty, created_at')
        .order('created_at', { ascending: true });

    if (e2) {
        console.error("Error fetching V2 logs:", e2);
        return;
    }

    const { data: ledger } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc');
        
    const ledgerRefs = new Set(ledger?.map(l => l.ref_doc) || []);
    
    const missingLogs = logs?.filter(log => !ledgerRefs.has(log.log_id)) || [];
    console.log(`Total V2 Logs: ${logs?.length}, Orphaned Logs (missing from ledger): ${missingLogs.length}`);
    
    if (missingLogs.length > 0) {
        console.log(`Earliest orphaned log: ${missingLogs[0].created_at}`);
        console.log(`Latest orphaned log: ${missingLogs[missingLogs.length - 1].created_at}`);
    }
}

run().catch(console.error);
