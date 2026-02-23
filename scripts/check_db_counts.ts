
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLorries() {
    console.log("Checking lorries table...");
    try {
        const { count, error } = await supabase.from('lorries').select('*', { count: 'exact', head: true });
        if (error) {
            console.error("Error:", error.message);
        } else {
            console.log(`Lorries count: ${count}`);
        }
    } catch (e: any) {
        console.error("Exception:", e.message);
    }
}

checkLorries();
