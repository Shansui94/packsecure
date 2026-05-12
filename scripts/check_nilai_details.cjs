const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkNilaiDetails() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    
    // Check if there are Stock Audit records for Nilai
    const { data: audits } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .eq('loc_id', 'Nilai')
        .eq('event_type', 'Audit Adjustment')
        .order('timestamp', { ascending: false });
        
    console.log("Audits for Nilai:", audits);
    
    // Check if there are any Production (Transfer In) records for Nilai
    const { data: ins } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .eq('loc_id', 'Nilai')
        .eq('event_type', 'Transfer In')
        .order('timestamp', { ascending: false });
        
    console.log("Transfer Ins for Nilai:", ins.length, ins.slice(0, 2));
}

checkNilaiDetails();
