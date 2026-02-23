
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDropped() {
    console.log("--- Verifying Tables Dropped ---");

    const tables = ['inventory', 'lorries', 'sys_clients', 'suppliers', 'machines', 'recipes', 'bom_recipes', 'customers'];

    for (const t of tables) {
        // Try to select from the table. If it's gone, it should error with 404 or "relation does not exist"
        const { error } = await supabase.from(t).select('*').limit(1);

        if (error) {
            // "42P01" is PostgreSQL code for "undefined_table"
            // Supabase client might return a specific message.
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                console.log(`[OK] Table '${t}' does not exist.`);
            } else {
                console.log(`[?] Table '${t}' error: ${error.message} (Code: ${error.code})`);
            }
        } else {
            console.log(`[FAIL] Table '${t}' STILL EXISTS!`);
        }
    }
}

verifyDropped();
