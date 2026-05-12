const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkOldPremature() {
    console.log("Checking premature deductions...");
    const { data } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .like('notes', '%Order Created%');
        
    console.log("Found:", data?.length);
}

checkOldPremature();
