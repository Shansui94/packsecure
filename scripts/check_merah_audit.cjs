const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAudit() {
    const { data: audits } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama')
        .eq('event_type', 'Audit Adjustment')
        .gte('timestamp', '2026-04-25T00:00:00Z')
        .order('timestamp', { ascending: false });
        
    console.log("Audits since April 25 for MERAH at OPM Lama:");
    if (audits && audits.length > 0) {
        audits.forEach(a => console.log(`${a.timestamp} | ${a.change_qty} | ${a.notes} | ${a.ref_doc}`));
    } else {
        console.log("No audit adjustments found.");
    }
}

checkAudit();
