import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== user_activity_logs between 04:00 and 04:15 UTC ===");
    const { data, error } = await supabase
        .from('user_activity_logs')
        .select('*')
        .gte('created_at', '2026-06-17T04:00:00.000Z')
        .lte('created_at', '2026-06-17T04:15:00.000Z')
        .order('created_at', { ascending: true });

    if (error) console.error(error);
    else console.log(data);
}
run();
