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
    console.log("=== Completing Yan's second trip DO-yan-260618-002 ===");
    
    // 1. Fetch order
    const { data: order, error: queryError } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('order_number', 'DO-yan-260618-002')
        .maybeSingle();

    if (queryError) {
        console.error("Query error:", queryError);
        return;
    }

    if (!order) {
        console.log("Order DO-yan-260618-002 not found.");
        return;
    }

    console.log(`Current status: ${order.status}`);

    // 2. Update status to Delivered and set pod_timestamp
    const { data: updated, error: updateError } = await supabase
        .from('sales_orders')
        .update({
            status: 'Delivered',
            pod_timestamp: new Date('2026-06-19T06:00:00Z').toISOString(), // approximate completion time
            notes: (order.notes || '') + ' [Manual completion of trip 2]'
        })
        .eq('id', order.id)
        .select();

    if (updateError) {
        console.error("Update failed:", updateError.message);
    } else {
        console.log("✅ Order successfully completed!");
        console.log("Updated record:", updated[0]);
    }
}

main().catch(console.error);
