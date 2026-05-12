const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function deleteGhost() {
    const txnIds = [
        'd85f3e59-bac7-4774-a479-b427a8268878',
        '5761e061-a069-4e6e-b788-b6ea6c20dd76'
    ];
    const { error } = await supabase.from('stock_ledger_v2').delete().in('txn_id', txnIds);
    if (error) console.error(error);
    else console.log("Deleted the 2 ghost records from 3929");
}

deleteGhost();
