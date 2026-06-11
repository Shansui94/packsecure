import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    console.log("Checking OPM Lama deductions...");
    const { data, error } = await s.from('stock_ledger_v2')
        .select('*')
        .eq('loc_id', 'OPM Lama')
        .eq('event_type', 'Transfer Out')
        .order('timestamp', { ascending: false });

    if (error) {
        console.error("Error fetching ledgers:", error);
        return;
    }

    console.log(`Found ${data.length} 'Transfer Out' entries at OPM Lama.`);
    
    // Group by ref_doc and sku
    const groups = {};
    data.forEach(row => {
        const key = `${row.ref_doc} | ${row.sku}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(row);
    });

    let duplicatesFound = false;
    Object.entries(groups).forEach(([key, rows]) => {
        if (rows.length > 1) {
            duplicatesFound = true;
            console.log(`\nDuplicate key: ${key}`);
            rows.forEach(r => {
                console.log(`  - txn_id: ${r.txn_id} | timestamp: ${r.timestamp} | change_qty: ${r.change_qty} | notes: ${r.notes}`);
            });
        }
    });

    if (!duplicatesFound) {
        console.log("No duplicate deductions found for OPM Lama in the query.");
    }
}

run();
