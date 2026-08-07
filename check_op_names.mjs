import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: op8138 } = await supabase
        .from('sys_users_v2')
        .select('*')
        .eq('employee_id', '8138')
        .maybeSingle();

    const { data: op2275 } = await supabase
        .from('sys_users_v2')
        .select('*')
        .eq('employee_id', '2275')
        .maybeSingle();

    console.log("Operator 8138:", op8138);
    console.log("Operator 2275:", op2275);
}

check();
