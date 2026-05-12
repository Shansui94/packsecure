const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkStock() {
    const skus = ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx50CMx2ROLL-ORN'];
    
    console.log("\nChecking Ledger History (last 50 entries)...");
    const { data: ledger, error: ledgerErr } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .in('sku', skus)
        .order('timestamp', { ascending: false })
        .limit(50);
        
    if (ledgerErr) {
        console.error("Ledger Error:", ledgerErr);
    } else {
        console.log("Ledger History:", JSON.stringify(ledger, null, 2));
    }
}

checkStock();
