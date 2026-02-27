import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkUser() {
    // try querying common user pattern
    const { data: users, error } = await supabaseAdmin.from('users').select('*').ilike('email', '%maxtan%').limit(5);
    console.log("users table:", users || error);

    // Check if there is a 'user_roles' table
    const { data: roles, error: rolesErr } = await supabaseAdmin.from('user_roles').select('*').limit(5);
    console.log("user_roles:", roles || rolesErr);
}
checkUser();
