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
    const yanDriverId = '06198eb2-7902-4f25-999c-ce00ea0ed037';
    console.log("=== Querying ALL Sales Orders for Driver 'yan' (employee_id 9826) ===");
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', yanDriverId)
        .order('deadline', { ascending: false });

    if (error) {
        console.error(error);
    } else {
        console.log(`Found ${orders.length} orders for Yan:`);
        orders.forEach(o => {
            console.log(JSON.stringify({
                id: o.id,
                order_number: o.order_number,
                status: o.status,
                deadline: o.deadline,
                created_at: o.created_at,
                trip_id: o.trip_id,
                customer: o.customer,
                delivery_address: o.delivery_address,
                items: o.items
            }, null, 2));
        });
    }
}

main().catch(console.error);
