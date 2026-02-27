import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function fixRoles() {
    await supabaseAdmin.from('users_public').update({ role: 'SuperAdmin' }).eq('email', 'khailoon94@gmail.com');
    await supabaseAdmin.from('users_public').update({ role: 'SuperAdmin' }).eq('email', 'admin@diyventure.com');
    await supabaseAdmin.from('users_public').update({ role: 'SuperAdmin' }).eq('email', 'boss@diyventure.com');
    await supabaseAdmin.from('users_public').update({ role: 'SuperAdmin', employee_id: '001' }).eq('email', 'weileong1994@gmail.com');
    console.log("Roles forced to SuperAdmin.");
}
fixRoles();
