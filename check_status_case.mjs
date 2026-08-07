import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking for users in sys_users_v2 with lowercase 'active' status...");
    const { data: users } = await supabase
        .from('sys_users_v2')
        .select('employee_id, name, role, status');

    const lowercaseActive = users.filter(u => u.status === 'active');
    console.log("Users with lowercase 'active' status:", lowercaseActive);
}

check();
