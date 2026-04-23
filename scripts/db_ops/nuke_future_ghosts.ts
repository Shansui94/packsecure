import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    console.log(`\n=== Cleaning Up Future Ghost Ledger Entries ===\n`);

    // 1. Delete all ledger entries where timestamp is heavily in the future 
    // And notes contain 'Auto-'
    const { data, error } = await supabaseAdmin
        .from('stock_ledger_v2')
        .delete()
        .gte('timestamp', new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString()) // anything > 2 hours in future
        .like('notes', 'Auto-%')
        .select();

    if (error) {
        console.error("Failed to delete ghosts:", error);
    } else {
        console.log(`Successfully nuked ${data.length} ghost entries!`);
        data.forEach(d => console.log(`  🔥 Deleted: ${d.sku} | ${d.change_qty} | loc: ${d.loc_id} | time: ${d.timestamp}`));
    }
}

run();
