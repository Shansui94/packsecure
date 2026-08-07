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
    console.log("=== Searching for users matching 'Yan' ===");
    const { data: users, error: userErr } = await supabase
        .from('sys_users_v2')
        .select('*')
        .or('name.ilike.%yan%,employee_id.ilike.%yan%');
    console.log("sys_users_v2:", users);

    const { data: pubUsers, error: pubUserErr } = await supabase
        .from('users_public')
        .select('*')
        .or('name.ilike.%yan%,employee_id.ilike.%yan%');
    console.log("users_public:", pubUsers);

    // Let's get the list of unique Yan IDs
    const yanIds = new Set();
    if (users) users.forEach(u => yanIds.add(u.id));
    if (pubUsers) pubUsers.forEach(u => yanIds.add(u.id));

    console.log("\n=== Searching Sales Orders / Trips on 2026-06-18 ===");
    // Query sales orders with order_date = '2026-06-18' or deadline = '2026-06-18' or '2026-06-19'
    const { data: orders, error: orderErr } = await supabase
        .from('sales_orders')
        .select('*')
        .or('order_date.eq.2026-06-18,deadline.eq.2026-06-18')
        .order('created_at', { ascending: false });

    if (orderErr) {
        console.error("Order query error:", orderErr);
    } else {
        console.log(`Found ${orders.length} orders on 2026-06-18:`);
        orders.forEach(o => {
            const isYan = yanIds.has(o.driver_id);
            console.log(`- ID: ${o.id}, Order#: ${o.order_number}, Status: ${o.status}, DriverID: ${o.driver_id} (IsYan: ${isYan}), Deadline: ${o.deadline}, StopSeq: ${o.stop_sequence}, TripID: ${o.trip_id}`);
        });
    }
}

main().catch(console.error);
