import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("=== Inspecting & Updating Drivers' Pay Type ===");

    // 1. Fetch drivers from sys_users_v2 using .eq('role', 'Driver')
    const { data: v2Drivers, error: v2Error } = await supabase
        .from('sys_users_v2')
        .select('id, auth_user_id, name, role, pay_type, status')
        .eq('role', 'Driver');

    if (v2Error) {
        console.error("Error fetching sys_users_v2 drivers:", v2Error);
        return;
    }

    console.log(`Found ${v2Drivers?.length || 0} drivers in sys_users_v2:`);
    v2Drivers?.forEach(d => {
        console.log(`  - [${d.name || 'No Name'}] (ID: ${d.id}, Auth: ${d.auth_user_id}) | Current pay_type: ${d.pay_type} | Status: ${d.status}`);
    });

    // Update sys_users_v2 pay_type = 'driver' for all role = 'Driver'
    const { data: updatedV2, error: updateV2Error } = await supabase
        .from('sys_users_v2')
        .update({ pay_type: 'driver' })
        .eq('role', 'Driver')
        .select('id, name, role, pay_type');

    if (updateV2Error) {
        console.error("Error updating sys_users_v2 pay_type:", updateV2Error);
    } else {
        console.log(`\n✅ Successfully updated ${updatedV2?.length || 0} drivers in sys_users_v2 to pay_type = 'driver':`);
        updatedV2?.forEach(d => {
            console.log(`  - Updated [${d.name}]: pay_type -> '${d.pay_type}'`);
        });
    }

    console.log("\n=== Execution Complete ===");
}

run();
