import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkLogicError() {
    console.log('=== Testing insert with machine_id="T1.2" ===');
    const { error } = await s.from('production_logs').insert({
        machine_id: 'T1.2',
        lane_id: 'Single',
        alarm_count: 1
    });
    console.log(error ? '❌ Insert Failed: ' + error.message : '✅ Insert Success');

    // Also fetch Vercel logs if possible? We can't easily.
}
checkLogicError();
