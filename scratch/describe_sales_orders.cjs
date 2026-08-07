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
    const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (error) console.error(error);
    else {
        console.log("Sales Order structure:", Object.keys(data[0]));
        console.log("Recent Sales Order sample:", JSON.stringify(data[0], null, 2));
    }
}

main().catch(console.error);
