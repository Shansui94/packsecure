import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAuthUsers() {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
        console.error(error);
        return;
    }
    users.forEach(u => console.log(u.email, u.last_sign_in_at));
}
checkAuthUsers();
