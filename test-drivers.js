import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching Drivers from sys_users_v2...");
    const { data: v2Drivers } = await supabase.from('sys_users_v2').select('name, role').eq('role', 'Driver');
    console.log("V2 Drivers:", v2Drivers?.length || 0);

    console.log("Fetching Drivers from users_public...");
    const { data: pubDrivers } = await supabase.from('users_public').select('name, role').eq('role', 'Driver');
    console.log("Public Drivers:", pubDrivers?.length || 0);
}
run();
