const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkBugs() {
    console.log("Checking Amendment Adjustments...");
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Amendment Adjustment');
        
    console.log("Count:", data?.length);
    console.log("Records:", data);
}

checkBugs();
