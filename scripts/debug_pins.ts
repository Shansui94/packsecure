
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Load env from project root
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Use service role key if available for checking, otherwise anon might be restricted by RLS if not logged in
// But for this script we usually don't have service role in .env.local unless specified.
// Let's try anon first. If RLS blocks, we might need a different approach or SQL.

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPins() {
    console.log("Checking Users...");
    const { data, error } = await supabase
        .from('sys_users_v2')
        .select('id, name, email, status, pin_code');

    if (error) {
        console.error("Error fetching users:", error);
    } else {
        console.log("Found Users:", data?.length);
        data?.forEach(u => {
            console.log(`- [${u.name}] Status: ${u.status} | PIN: ${u.pin_code ? '****' : '(null)'} | Is 1234? ${u.pin_code === '1234'}`);
        });
    }
}

checkPins();
