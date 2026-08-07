import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    const { data: lorries, error: err1 } = await supabase
        .from('lorries')
        .select('*')
        .order('plate_number');

    if (err1) {
        console.error(err1);
        return;
    }
    console.log("All Lorries in database:");
    console.log(JSON.stringify(lorries, null, 2));

    const { data: users, error: err2 } = await supabase
        .from('users_public')
        .select('id, name, email, role')
        .eq('role', 'Driver');

    if (err2) {
        console.error(err2);
        return;
    }
    console.log("\nAll Drivers in users_public:");
    console.log(JSON.stringify(users, null, 2));
}

debug();
