import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkLedger() {
    console.log("Checking if there's any ledger entry for UNKNOWN sku...");
    const { data: latestLedgers } = await s.from('stock_ledger_v2')
        .select('*')
        .eq('sku', 'UNKNOWN')
        .order('timestamp', { ascending: false })
        .limit(3);
    console.log('Latest UNKNOWN ledgers:', JSON.stringify(latestLedgers, null, 2));
}

checkLedger();
