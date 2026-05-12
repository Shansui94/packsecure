const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function deleteGhost() {
    const txnIds = [
        'a6abba7e-7f1e-4f50-9c33-3472653f859f'
    ];
    const { error } = await supabase.from('stock_ledger_v2').delete().in('txn_id', txnIds);
    if (error) console.error(error);
    else console.log("Deleted the ghost record from 9927");
}

deleteGhost();
