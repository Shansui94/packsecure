import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkMachines() {
    const { data: m } = await supabase.from('sys_machines_v2').select('machine_id, factory_id');
    console.log(m);
}

checkMachines().catch(console.error);
