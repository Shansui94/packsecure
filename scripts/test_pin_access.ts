
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load Env
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPinAccess() {
    console.log("Testing PIN Access with ANON KEY...");
    const { data, error } = await supabase
        .from('sys_users_v2')
        .select('id, name, status, pin_code')
        .eq('pin_code', '1234')
        .eq('status', 'Active')
        .limit(1);

    if (error) {
        console.error("❌ Error accessing table:", error);
    } else {
        console.log("✅ Access Successful. Rows found:", data?.length);
        if (data && data.length > 0) {
            console.log("Sample User:", data[0]);
        } else {
            console.warn("⚠️ No users found with PIN 1234, but access was allowed.");
        }
    }
}

testPinAccess();
