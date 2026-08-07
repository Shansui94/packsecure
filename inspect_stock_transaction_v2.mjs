import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    const txnId = '5de4d8a6-7c4c-49d2-8489-98f00312f43d';
    console.log(`=== Querying stock_ledger_v2 for txn_id = '${txnId}' ===`);
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('txn_id', txnId);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Transaction details:", data);
    }
}

run();
