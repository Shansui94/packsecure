const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
    const { data: fetchRes, error: fetchErr } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc, created_by_name')
        .like('ref_doc', 'AUDIT-20260331%')
        
    if (fetchErr) {
        console.error("error fetching", fetchErr);
        return;
    }
    console.log(`Found ${fetchRes.length} logs for AUDIT-20260331...`);
    
    if (fetchRes.length > 0) {
        const { error: updateErr } = await supabase
            .from('stock_ledger_v2')
            .update({ created_by_name: 'Baby' })
            .like('ref_doc', 'AUDIT-20260331%');
            
        if (updateErr) {
            console.error(updateErr);
        } else {
            console.log("Restored AUDIT-20260331 logs to 'Baby'!");
        }
    }
}

run();
