import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
    console.log("=== Adding hourly_rate Column to sys_machines_v2 ===");

    const { data: machines, error: fetchErr } = await supabase
        .from('sys_machines_v2')
        .select('*')
        .limit(1);

    if (fetchErr) {
        console.error("Error fetching sys_machines_v2:", fetchErr);
        return;
    }

    if (machines && machines.length > 0) {
        const columns = Object.keys(machines[0]);
        if (columns.includes('hourly_rate')) {
            console.log("✅ Column 'hourly_rate' already exists in sys_machines_v2.");
        } else {
            console.log("Testing update with hourly_rate column...");
            const firstId = machines[0].machine_id;
            const { error: updateErr } = await supabase
                .from('sys_machines_v2')
                .update({ hourly_rate: 0 } as any)
                .eq('machine_id', firstId);

            if (updateErr) {
                console.log("Column does not exist yet. Error message:", updateErr.message);
                console.log("Trying rpc exec_sql...");
                try {
                    const { error: rpcErr } = await supabase.rpc('exec_sql', {
                        query: 'ALTER TABLE sys_machines_v2 ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0;'
                    });
                    if (rpcErr) console.log("RPC Error:", rpcErr.message);
                    else console.log("✅ Column added via exec_sql!");
                } catch (err: any) {
                    console.log("RPC failed:", err.message);
                }
            } else {
                console.log("✅ Column 'hourly_rate' confirmed available in sys_machines_v2!");
            }
        }
    }

    // Verify all machines
    const { data: allMachines, error: finalErr } = await supabase
        .from('sys_machines_v2')
        .select('machine_id, name, type, factory_id, hourly_rate');

    if (finalErr) {
        console.error("Error verifying machines:", finalErr.message);
    } else {
        console.log(`\nCurrent Machines in sys_machines_v2 (${allMachines?.length || 0}):`);
        allMachines?.forEach(m => {
            console.log(`  - [${m.machine_id}] ${m.name} (${m.factory_id}) | Hourly Rate: RM${(m as any).hourly_rate ?? 0}`);
        });
    }
}

run();
