const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkNilai() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    
    // 1. Get Live Stock for Nilai
    const { data: stock } = await supabase
        .from('v2_inventory_view')
        .select('*')
        .eq('sku', sku)
        .eq('loc_id', 'Nilai');
        
    console.log("Live Stock for Nilai (MERAH):", stock);
    
    // 2. Get Ledger logs for Nilai
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .eq('loc_id', 'Nilai')
        .order('timestamp', { ascending: false })
        .limit(10);
        
    console.log("\nRecent Ledger Logs for Nilai (MERAH):");
    logs.forEach(l => {
        console.log(`[${l.timestamp}] ${l.event_type} | Qty: ${l.change_qty} | Ref: ${l.ref_doc} | Note: ${l.notes}`);
    });
    
    // 3. Summarize total in/out for Nilai
    const { data: allLogs } = await supabase
        .from('stock_ledger_v2')
        .select('change_qty')
        .eq('sku', sku)
        .eq('loc_id', 'Nilai');
        
    const total = allLogs.reduce((acc, l) => acc + Number(l.change_qty), 0);
    console.log("\nTotal Ledger Sum for Nilai (MERAH):", total);
}

checkNilai();
