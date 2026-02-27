import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkUser() {
    const { data: users, error } = await supabaseAdmin.from('users_public').select('*');
    if (error) {
        console.error("users_public error:", error);
        return;
    }

    console.log("Users in users_public:");
    users.forEach(u => console.log(u.email, u.role, u.name));

    // Find max or boss and ensure they are Manager or Admin
    for (const u of users) {
        if (u.email && (u.email.includes('maxtan') || u.email.includes('max'))) {
            console.log(`Updating ${u.email} to SuperAdmin`);
            await supabaseAdmin.from('users_public').update({ role: 'SuperAdmin' }).eq('id', u.id);
        }
    }
}
checkUser();
