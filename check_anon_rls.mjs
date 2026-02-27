import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRLS() {
    // There is no easy way to query pg_policies through REST unless 'pg_policies' is exposed as a view.
    // However, since we did the CLI earlier wait I can just use a trick:
    // Try to select the row USING THE ANON KEY without auth token. If RLS blocks it, data will be empty!

    const anonClient = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY
    );

    const { data, error } = await anonClient.from('users_public').select('*').eq('email', 'khailoon94@gmail.com');
    console.log("Anon select result:", data, error);
}
checkRLS();
