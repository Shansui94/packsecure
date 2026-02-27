import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectDb() {
    const { data: p, error } = await supabaseAdmin.from('master_items_v2').select('*').limit(1);
    console.log("master_items_v2:", p?.[0], error);
}
inspectDb();
