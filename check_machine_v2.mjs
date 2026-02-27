import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMachineV2() {
    const { data, error } = await supabaseAdmin
        .from('sys_machines_v2')
        .select('machine_id, name, type, factory_id, status')
        .ilike('machine_id', '%T1.2%');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Found machines:", data);
    }
}

checkMachineV2();
