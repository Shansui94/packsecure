
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugDriverData() {
    console.log('--- Debugging Driver Data for maxtan ---');

    // 1. Get User ID
    const { data: users, error: userError } = await supabase
        .from('sys_users_v2')
        .select('id, auth_user_id, name, email')
        .ilike('name', '%maxtan%');

    if (userError) {
        console.error('Error finding user:', userError);
        return;
    }

    if (!users || users.length === 0) {
        console.log('User maxtan not found.');
        return;
    }

    const user = users[0];
    console.log(`User Found: ${user.name}`);
    console.log(`Sys ID: ${user.id}`);
    console.log(`Auth ID: ${user.auth_user_id}`);

    // 2. Fetch Orders (Try both IDs to be sure)
    console.log('\nChecking orders with Auth ID...');
    const { data: ordersAuth, error: errorAuth } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', user.auth_user_id)
        .neq('status', 'Cancelled');

    console.log(`Orders with Auth ID: ${ordersAuth?.length}`);
    if (errorAuth) console.error("Auth Query Error:", errorAuth);

    console.log('\nChecking orders with Sys ID...');
    const { data: ordersSys, error: errorSys } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', user.id)
        .neq('status', 'Cancelled');

    console.log(`Orders with Sys ID: ${ordersSys?.length}`);
    if (errorSys) console.error("Sys Query Error:", errorSys);

    const orders = (ordersAuth?.length ? ordersAuth : (ordersSys || []));

    if (orders && orders.length > 0) {
        orders.forEach((o, index) => {
            console.log(`\n[Order ${index + 1}] ID: ${o.id}`);
            console.log(`Status: ${o.status}`);
            console.log(`Items Raw Length: ${o.items?.length}`);
            console.log(`Items JSON:`, JSON.stringify(o.items, null, 2));
        });
    } else {
        console.log("No orders found for either ID.");
    }
}

debugDriverData();
