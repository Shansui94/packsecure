
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function countPins() {
    const { count, error } = await supabase
        .from('sys_users_v2')
        .select('*', { count: 'exact', head: true })
        .eq('pin_code', '1234')
        .eq('status', 'Active');

    if (error) console.error("Error:", error);
    else console.log(`Active users with PIN 1234: ${count}`);
}

countPins();
