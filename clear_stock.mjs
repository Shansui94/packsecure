import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function clearStock() {
    console.log("Clearing stock_ledger_v2...");
    const { error } = await supabaseAdmin.from('stock_ledger_v2').delete().not('sku', 'is', null);
    if (error) {
        console.error("Error clearing stock:", error);
    } else {
        console.log("Successfully cleared stock_ledger_v2!");
    }
}
clearStock();
