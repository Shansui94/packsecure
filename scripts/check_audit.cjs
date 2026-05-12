const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAudit() {
    const skus = ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx50CMx2ROLL-ORN'];
    const { data: audit, error: auditErr } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Audit Adjustment')
        .in('sku', skus)
        .order('timestamp', { ascending: false });
        
    console.log("Audits for SKUs:", audit);
}

checkAudit();
