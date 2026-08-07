import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAnon = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Querying operator_attendance using Anon Key...");
    const { data: anonData, error: anonError } = await supabaseAnon
        .from('operator_attendance')
        .select('*')
        .limit(5);
        
    console.log("Anon Result:", anonData ? `Success (Count: ${anonData.length})` : `Error: ${anonError?.message}`);
    if (anonData) console.log("Anon Rows:", anonData);

    console.log("\nQuerying operator_attendance using Admin Service Role Key...");
    const { data: adminData, error: adminError } = await supabaseAdmin
        .from('operator_attendance')
        .select('*')
        .limit(5);
        
    console.log("Admin Result:", adminData ? `Success (Count: ${adminData.length})` : `Error: ${adminError?.message}`);
}

run();
