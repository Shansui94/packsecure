const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAudits() {
    const { data: audits, error } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, sku, change_qty, loc_id')
        .eq('event_type', 'Audit Adjustment')
        .order('timestamp', { ascending: false });
        
    if (error) {
        console.error("Error fetching audits:", error);
    } else {
        console.log(`Found ${audits.length} audit adjustments.`);
        if (audits.length > 0) {
            console.log("Most recent audits:");
            for (let i = 0; i < Math.min(10, audits.length); i++) {
                console.log(`  ${audits[i].timestamp} | SKU: ${audits[i].sku} | Qty: ${audits[i].change_qty}`);
            }
        }
    }
}

checkAudits();
