import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAnon = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Testing UPDATE on operator_attendance using Anon Key...");
    
    // We try to update NAINE's shift (id: c264b3a5-d3b8-4cc2-9fa4-b92be12233ba)
    // to the same notes it already has, so we don't modify the data.
    const targetId = 'c264b3a5-d3b8-4cc2-9fa4-b92be12233ba';
    const notesValue = 'Auto-Logout: Kicked by Max Tan (8335)';
    
    const { data, error } = await supabaseAnon
        .from('operator_attendance')
        .update({ notes: notesValue })
        .eq('id', targetId)
        .select('*');
        
    if (error) {
        console.error("Update failed with error:", error);
    } else {
        console.log("Update result:", data);
        if (data && data.length === 0) {
            console.log("Update succeeded but returned 0 rows (common when RLS blocks the update silently).");
        } else {
            console.log("Update succeeded and returned rows!");
        }
    }
}

run();
