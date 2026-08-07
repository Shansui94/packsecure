import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
    console.log("=== Testing available rate tables ===");

    // Test delivery_rates
    const { data: dRates, error: dErr } = await supabase.from('delivery_rates').select('*').limit(1);
    console.log("delivery_rates accessible:", !dErr, dRates?.length);

    // Test if machine_rates table exists
    const { data: mRates, error: mErr } = await supabase.from('machine_rates').select('*').limit(1);
    console.log("machine_rates table exists:", !mErr);

    // Test system_settings table
    const { data: sSettings, error: sErr } = await supabase.from('system_settings').select('*').limit(1);
    console.log("system_settings table exists:", !sErr);
}

run();
