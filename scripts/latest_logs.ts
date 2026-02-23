// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!url || !key) {
    console.warn("Missing Supabase credentials in environment variables.");
}

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.from('production_logs').select('machine_id, created_at').order('created_at', { ascending: false }).limit(5);
    if (error) console.error(error);
    else console.log(`Latest 5 logs:`, JSON.stringify(data, null, 2));
}
run();
