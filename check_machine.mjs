import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMachine() {
    const { data, error } = await supabaseAdmin.from('master_machines_v2').select('*').eq('alias', 'T1.2-M01');
    console.log("Machine:", data);
}

checkMachine();
