const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function analyzeDrift() {
    console.log("Analyzing drift since last audit...");
    const skus = ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx50CMx2ROLL-ORN'];
    
    const { data: ledger } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .in('sku', skus)
        .eq('loc_id', 'OPM Lama')
        .gt('timestamp', '2026-04-23T16:39:32.809369+00:00'); // After audit
        
    const summary = {};
    ledger.forEach(row => {
        if (!summary[row.sku]) summary[row.sku] = {};
        if (!summary[row.sku][row.event_type]) summary[row.sku][row.event_type] = { count: 0, qty: 0 };
        
        summary[row.sku][row.event_type].count += 1;
        summary[row.sku][row.event_type].qty += row.change_qty;
    });
    
    console.log("Drift Summary:", JSON.stringify(summary, null, 2));
}

analyzeDrift();
