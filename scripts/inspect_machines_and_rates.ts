import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
    console.log("=== Inspecting Machine Schema & Rates ===");

    // 1. Fetch machines from sys_machines_v2
    const { data: machines, error: mError } = await supabase
        .from('sys_machines_v2')
        .select('*');

    if (mError) {
        console.error("Error fetching sys_machines_v2:", mError);
    } else {
        console.log(`\nFound ${machines?.length || 0} machines in sys_machines_v2:`);
        if (machines && machines.length > 0) {
            console.log("Machine columns:", Object.keys(machines[0]));
            machines.forEach(m => {
                console.log(`  - Machine: ${m.name || m.machine_id} | ID: ${m.machine_id} | Raw Data:`, JSON.stringify(m));
            });
        }
    }

    // 2. Search for any table with 'rate' or 'pay' or 'machine' in name
    const { data: tables } = await supabase
        .rpc('get_tables_list')
        .catch(() => ({ data: null }));

    console.log("=== Check Complete ===");
}

run();
