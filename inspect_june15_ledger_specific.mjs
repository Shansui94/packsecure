import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log("=== Querying stock_ledger_v2 on 2026-06-15 between 10:00 UTC and 13:00 UTC for T1.3-M02 ===");
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .gte('timestamp', '2026-06-15T10:00:00.000Z')
        .lte('timestamp', '2026-06-15T13:00:00.000Z')
        .like('notes', '%T1.3-M02%')
        .order('timestamp', { ascending: true });
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data?.length || 0} records.`);
        console.table(data.map(r => ({
            txn_id: r.txn_id,
            timestamp: r.timestamp,
            sku: r.sku,
            loc_id: r.loc_id,
            change_qty: r.change_qty,
            event_type: r.event_type,
            notes: r.notes
        })));
    }
}

run();
