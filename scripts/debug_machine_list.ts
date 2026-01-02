
import { supabase } from '../src/services/supabase';

async function listMachines() {
    console.log("Attempting to list machines from sys_machines_v2...");

    const { data, error } = await supabase
        .from('sys_machines_v2')
        .select('id, name, machine_id');

    if (error) {
        console.error("Error fetching machines:", error);
    } else {
        console.log(`Found ${data?.length} machines:`);
        data?.forEach(m => console.log(`- [${m.machine_id}] ${m.name}`));
    }
}

listMachines();
