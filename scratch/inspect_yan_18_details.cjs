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
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('*')
        .ilike('order_number', '%DO-yan-260618%');

    if (error) {
        console.error(error);
    } else {
        console.log("Yan's June 18th orders details:", JSON.stringify(orders, null, 2));
    }
}

main().catch(console.error);
