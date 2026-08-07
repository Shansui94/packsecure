import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSelect() {
    console.log("Simulating sign in for driver WAN (wan.2134@packsecure.com)...");
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'wan.2134@packsecure.com',
        password: '213400'
    });

    if (authError) {
        console.error("Sign in failed:", authError);
        return;
    }

    console.log("Sign in success! UID:", authData.user?.id);

    console.log("Querying 'lorries' table with driver's session...");
    const { data, error } = await supabase
        .from('lorries')
        .select('*')
        .order('plate_number');

    if (error) {
        console.error("Error performing select:", error);
    } else {
        console.log(`Select success! Returned ${data.length} rows.`);
        console.log("Lorries List for WAN:");
        data.forEach((l, idx) => {
            console.log(`${idx + 1}. Plate: "${l.plate_number}", Driver: "${l.driver_name}", ID: "${l.id}"`);
        });
    }
}

testSelect();
