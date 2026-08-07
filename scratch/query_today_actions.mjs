import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== All non-view/non-login activity logs for 2026-06-17 ===");
    const { data, error } = await supabase
        .from('user_activity_logs')
        .select('*')
        .gte('created_at', '2026-06-17T00:00:00.000Z')
        .not('action', 'eq', 'PAGE_VIEW')
        .not('action', 'eq', 'LOGIN')
        .order('created_at', { ascending: true });

    if (error) console.error(error);
    else console.log(data);
}
run();
