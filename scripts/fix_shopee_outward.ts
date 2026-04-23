import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    console.log("Fetching matching records...");
    const { data: records, error: fetchError } = await supabaseAdmin
        .from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'Shopee 1st 2nd 3rd')
        .eq('event_type', 'Stock In');

    if (fetchError) {
        console.error("Fetch Error:", fetchError);
        return;
    }

    if (!records || records.length === 0) {
        console.log("No records found to update.");
        return;
    }

    console.log(`Found ${records.length} records. Updating...`);

    let successCount = 0;
    for (const rec of records) {
        const { error: updateError } = await supabaseAdmin
            .from('stock_ledger_v2')
            .update({
                event_type: 'Transfer Out',
                change_qty: -Math.abs(rec.change_qty)
            })
            .eq('txn_id', rec.txn_id);

        if (updateError) {
            console.error(`Error updating txn_id ${rec.txn_id}:`, updateError);
        } else {
            successCount++;
        }
    }

    console.log(`Successfully updated ${successCount} records.`);
}
run();
