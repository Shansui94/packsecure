import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
    console.log("=== Inspecting operator_attendance schema and rows ===");

    const { data: rows, error } = await supabase
        .from('operator_attendance')
        .select('*')
        .limit(10);

    if (error) {
        console.error("Error fetching operator_attendance:", error);
    } else {
        console.log(`Found ${rows?.length || 0} rows:`);
        if (rows && rows.length > 0) {
            console.log("Columns:", Object.keys(rows[0]));
            rows.forEach((r, i) => {
                console.log(`[${i}]`, JSON.stringify(r));
            });
        }
    }
}

run();
