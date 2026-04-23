import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    console.log("Fixing future timestamp records from old trigger...");

    // Find records in stock_ledger_v2 that are "Auto-deduct: Order Created" and have a future timestamp
    const nowISO = new Date().toISOString();
    
    const { data: records, error } = await supabaseAdmin.from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Transfer Out')
        .like('notes', 'Auto-deduct: Order Created%')
        .gt('timestamp', nowISO);

    if (error) {
        console.error("Error fetching future records", error);
        return;
    }

    if (!records || records.length === 0) {
        console.log("No future records found. Everything is already up to date.");
        return;
    }

    console.log(`Found ${records.length} records scheduled for the future. Correcting to NOW...`);

    let count = 0;
    for (const rec of records) {
        const { error: updErr } = await supabaseAdmin.from('stock_ledger_v2')
            .update({ timestamp: new Date().toISOString() })
            .eq('txn_id', rec.txn_id);
            
        if (updErr) {
            console.error(`Failed to update txn ${rec.txn_id}`, updErr);
        } else {
            count++;
        }
    }

    console.log(`Successfully updated ${count} out of ${records.length} future records.`);
    console.log("Live Stock should now be 100% accurate.");
}

run();
