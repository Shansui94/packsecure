
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDropped() {
    let output = "--- Verifying Tables Dropped ---\n";

    // Check key tables
    const tables = ['inventory', 'lorries', 'sys_clients', 'suppliers', 'machines', 'recipes', 'bom_recipes', 'customers'];

    for (const t of tables) {
        const { error } = await supabase.from(t).select('*').limit(1);

        if (error) {
            output += `[GONE] Table '${t}': ${error.message} (Code: ${error.code})\n`;
        } else {
            output += `[EXIST] Table '${t}' STILL EXISTS!\n`;
        }
    }

    fs.writeFileSync('verify_dropped.log', output);
    console.log("Written to verify_dropped.log");
}

verifyDropped();
