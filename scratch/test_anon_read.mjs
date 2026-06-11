import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const anon = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== Testing anonymous read on sys_users_v2 ===");
    const { data: v2User, error: v2Error } = await anon
        .from('sys_users_v2')
        .select('email, status')
        .eq('employee_id', '3412')
        .maybeSingle();

    console.log("v2User:", v2User);
    console.log("v2Error:", v2Error ? v2Error.message : "None");

    console.log("\n=== Testing anonymous read on users_public ===");
    const { data: pubUser, error: pubError } = await anon
        .from('users_public')
        .select('email, status')
        .eq('employee_id', '3412')
        .maybeSingle();

    console.log("pubUser:", pubUser);
    console.log("pubError:", pubError ? pubError.message : "None");
}

run();
