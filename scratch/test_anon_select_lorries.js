import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Use anon key to simulate client-side query
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSelect() {
    console.log("Testing SELECT on lorries using ANON KEY...");
    
    const { data, error } = await supabase
        .from('lorries')
        .select('*');

    if (error) {
        console.error("Error performing select:", error);
    } else {
        console.log(`Select success! Returned ${data.length} rows.`);
        console.log("Plate numbers found:", data.map(l => l.plate_number));
    }
}

testSelect();
