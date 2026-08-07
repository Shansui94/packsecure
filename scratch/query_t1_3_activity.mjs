import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== Logs for 'hlan than' or operator '3412' ===");
    const { data: logs1, error: err1 } = await supabase
        .from('user_activity_logs')
        .select('*')
        .or('name.ilike.%hlan than%,email.ilike.%3412%')
        .order('created_at', { ascending: false })
        .limit(30);

    if (err1) console.error(err1);
    else console.log("Logs by user:", logs1);

    console.log("\n=== Any logs containing 'T1.3' ===");
    const { data: logs2, error: err2 } = await supabase
        .from('user_activity_logs')
        .select('*')
        .or('action.ilike.%T1.3%,details.cast.text.ilike.%T1.3%')
        .order('created_at', { ascending: false })
        .limit(30);

    if (err2) console.error(err2);
    else console.log("Logs by machine T1.3:", logs2);
}
run();
