import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    const { data: inv, error } = await supabase.from('inventory').select('*').limit(10);
    if (error) {
        console.error("Inventory error:", error);
    } else {
        console.log("Found inventory records:", inv?.length);
        if (inv?.length) console.log(inv[0]);
    }
}

run().catch(console.error);
