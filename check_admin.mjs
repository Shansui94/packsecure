import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAdminAccount() {
    console.log("Checking admin@diyventure.com...");
    const { data: users, error } = await supabaseAdmin.from('users_public').select('*').eq('email', 'admin@diyventure.com');
    console.log(users || error);

    console.log("Checking boss@diyventure.com...");
    const { data: bossUsers } = await supabaseAdmin.from('users_public').select('*').eq('email', 'boss@diyventure.com');
    console.log(bossUsers);

    // Also what if he is weileong1994@gmail.com ?
    console.log("Checking weileong...");
    const { data: wei } = await supabaseAdmin.from('users_public').select('*').eq('email', 'weileong1994@gmail.com');
    console.log(wei);

}
checkAdminAccount();
