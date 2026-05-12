const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkGrn() {
    console.log("Analyzing BW-SL-CLR-100Mx25CMx4ROLL-GRN...");
    
    // Get view stock
    const { data: view } = await supabase
        .from('v2_inventory_view')
        .select('loc_id, current_stock')
        .eq('sku', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN');
    console.log("View Current Stock:", view);
        
    // Get ledger trace
    const { data: ledger } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, event_type, change_qty, loc_id, notes, ref_doc')
        .eq('sku', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN')
        .order('timestamp', { ascending: true });
        
    let summary = {};
    let sum = 0;
    
    if (ledger) {
        ledger.forEach(log => {
            sum += log.change_qty;
            const key = `${log.loc_id || 'null'} | ${log.event_type}`;
            if (!summary[key]) summary[key] = { count: 0, sum: 0 };
            summary[key].count++;
            summary[key].sum += log.change_qty;
        });
    }
    
    console.log("Total Raw Sum:", sum);
    console.log("Summary by Location & Event Type:");
    console.table(summary);
    
    // Look for Audit Adjustment
    const audits = ledger?.filter(l => l.event_type === 'Audit Adjustment') || [];
    console.log("Audit Adjustments found:", audits);
}

checkGrn();
