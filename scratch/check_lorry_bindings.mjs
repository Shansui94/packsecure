import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Checking current lorries bindings ===");
    const { data: lorries, error: lError } = await s
        .from('lorries')
        .select('*');

    if (lError) {
        console.error("Error fetching lorries:", lError.message);
        return;
    }

    console.log(`Found ${lorries.length} lorries in total:`);
    console.log(JSON.stringify(lorries, null, 2));
}

run();
