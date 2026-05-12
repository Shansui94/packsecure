const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkLateAudits() {
    const { data: audits } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Audit Adjustment')
        .gte('timestamp', '2026-04-26T00:00:00Z')
        .order('timestamp', { ascending: false });
        
    console.log("All Audits since April 26th:");
    if (audits && audits.length > 0) {
        audits.forEach(a => console.log(`${a.timestamp} | ${a.sku} | ${a.loc_id} | ${a.change_qty} | ${a.notes} | ${a.ref_doc}`));
    } else {
        console.log("No audit adjustments found since April 26th at all.");
    }
}

checkLateAudits();
