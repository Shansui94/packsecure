import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const sql = "ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS extracted_do_number TEXT;";
    console.log("Applying migration query via exec_sql...");
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
        console.error("Migration failed:", error);
    } else {
        console.log("✅ Migration applied successfully! Result:", data);
    }
}

run();
