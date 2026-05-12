const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function checkDisaster() {
    const { count, error } = await supabase
        .from('stock_ledger_v2')
        .select('*', { count: 'exact', head: true })
        .in('notes', ['Auto-deduct: Order Created', 'Auto-deduct: Order Created/Updated']);
        
    console.log("Count of 'Auto-deduct: Order Created/Updated' in ledger:", count);
}

checkDisaster();
