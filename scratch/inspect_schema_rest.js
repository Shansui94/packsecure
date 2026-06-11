import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    console.log("Querying all triggers on sales_orders from information_schema...");
    const { data: triggers, error: tErr } = await s
        .from('information_schema.triggers')
        .select('*')
        .eq('event_object_table', 'sales_orders');

    if (tErr) {
        console.error("Error fetching triggers:", tErr);
    } else {
        console.log(`Found ${triggers?.length || 0} triggers:`);
        triggers?.forEach(t => {
            console.log(`\nTrigger Name: ${t.trigger_name}`);
            console.log(`Action Orientation: ${t.action_orientation}`);
            console.log(`Action Timing: ${t.action_timing}`);
            console.log(`Event: ${t.event_manipulation}`);
            console.log(`Action Statement: ${t.action_statement}`);
        });
    }

    console.log("\nQuerying all triggers in the database to see if we missed anything...");
    const { data: allTriggers, error: allErr } = await s
        .from('information_schema.triggers')
        .select('trigger_name, event_object_table, event_manipulation, action_statement')
        .limit(100);

    if (allErr) {
        console.error("Error fetching all triggers:", allErr);
    } else {
        console.log(`Sample of all triggers:`);
        console.table(allTriggers);
    }
}

run();
