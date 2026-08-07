import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    const id1 = '06198eb2-7902-4f25-999c-ce00ea0ed037';
    const id2 = 'c3eeab28-5960-4bef-b5d3-28d69dfa0b5d';

    console.log("=== Checking users ===");
    const { data: users, error } = await supabase
        .from('users_public')
        .select('*')
        .in('id', [id1, id2]);
        
    console.log(users);
}

run();
