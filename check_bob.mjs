import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkBob() {
    const { data: users, error } = await s
        .from('sys_users_v2')
        .select('*')
        .ilike('name', '%bob%');

    console.log("Bob records:", users);
    if (error) console.error(error);
}

checkBob();
