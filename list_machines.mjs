import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function listMachines() {
    const { data, error } = await supabaseAdmin.from('master_machines_v2').select('machine_id, name, alias, loc_id');
    if (error) console.error("Error:", error);
    else {
        console.log("Machines:");
        data.forEach(d => console.log(`${d.machine_id} | ${d.name} | ${d.alias} | ${d.loc_id}`));
    }
}

listMachines();
