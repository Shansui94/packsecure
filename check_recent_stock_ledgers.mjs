import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
    console.log("Fetching recent stock_ledger_v2 entries...");
    const { data, error } = await s.from('stock_ledger_v2')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(30);

    if (error) {
        console.error("Error fetching ledgers:", error);
    } else {
        console.log("Recent entries count:", data?.length);
        data.forEach(x => {
            console.log(`TS: ${x.timestamp} | Event: ${x.event_type} | SKU: ${x.sku} | Qty: ${x.change_qty} | Ref: ${x.ref_doc} | Loc: ${x.loc_id} | Notes: ${x.notes}`);
        });
    }
}

check();
