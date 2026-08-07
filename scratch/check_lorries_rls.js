import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
    console.log("Checking RLS policies for 'lorries' table...");
    
    // Query pg_policies via RPC or raw query if we have service_role
    // Let's run a quick query to see policies
    const { data, error } = await supabase.rpc('execute_sql', {
        sql_query: `
            SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'lorries';
        `
    });

    if (error) {
        console.error("Error executing SQL:", error);
        // Fallback: Check if we can query it as normal user
        console.log("Fallback: checking raw table settings via query...");
        return;
    }

    console.log("RLS Policies for lorries:");
    console.log(JSON.stringify(data, null, 2));
}

checkRLS();
