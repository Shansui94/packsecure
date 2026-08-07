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
    const { data: records, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'AUDIT-20260624')
        .eq('loc_id', 'SPD');

    if (error) {
        console.error(error);
    } else {
        console.log(`Found ${records.length} records matching ref_doc='AUDIT-20260624' and loc_id='SPD'`);
        if (records.length > 0) {
            console.log("Sample records:");
            console.log(records.slice(0, 3));
        }
    }
}

main().catch(console.error);
