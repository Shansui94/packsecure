const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function analyzeRestored() {
    const { data: restored, error } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, change_qty, ref_doc')
        .eq('notes', 'Auto-deduct: RESTORED');
        
    if (error) {
        console.error("Error", error);
        return;
    }
    
    let totalDeducted = 0;
    const dateCounts = {};
    
    for (const r of restored) {
        totalDeducted += r.change_qty;
        const date = r.timestamp.split('T')[0];
        dateCounts[date] = (dateCounts[date] || 0) + 1;
    }
    
    console.log(`Total RESTORED records: ${restored.length}`);
    console.log(`Total Quantity Deducted: ${totalDeducted}`);
    console.log("Distribution by Date:");
    const dates = Object.keys(dateCounts).sort();
    for (const d of dates) {
        console.log(`  ${d}: ${dateCounts[d]} records`);
    }
}

analyzeRestored();
