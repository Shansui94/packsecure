const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log("=== Fetching records to verify before update ===");
    const { data: records, error: fetchErr } = await supabase
        .from('stock_ledger_v2')
        .select('txn_id, notes')
        .eq('ref_doc', 'AUDIT-20260624')
        .eq('loc_id', 'SPD');

    if (fetchErr) {
        console.error("Fetch error:", fetchErr);
        return;
    }

    console.log(`Found ${records.length} records to update.`);
    if (records.length === 0) {
        console.log("No records found. Already updated?");
        return;
    }

    let successCount = 0;
    for (const r of records) {
        const newNotes = r.notes ? r.notes.replace('[SPD]', '[OPM Lama]') : r.notes;
        const { data, error } = await supabase
            .from('stock_ledger_v2')
            .update({
                loc_id: 'OPM Lama',
                notes: newNotes
            })
            .eq('txn_id', r.txn_id)
            .select();

        if (error) {
            console.error(`Failed to update txn_id ${r.txn_id}:`, error.message);
        } else {
            successCount++;
        }
    }

    console.log(`Successfully updated ${successCount} out of ${records.length} records in stock_ledger_v2.`);
}

main().catch(console.error);
