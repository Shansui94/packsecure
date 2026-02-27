import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkIds() {
    const email = 'khailoon94@gmail.com';
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);
    console.log("Auth User ID:", authUser?.id);

    const { data: pubUsers } = await supabaseAdmin.from('users_public').select('id, email, role');
    const pubUser = pubUsers.find(u => u.email === email);
    console.log("Public User ID:", pubUser?.id, "Role:", pubUser?.role);
}
checkIds();
