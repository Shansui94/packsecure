import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSku() {
    const { data, error } = await supabaseAdmin.from('master_items_v2').select('sku').like('sku', '%OR%');
    console.log("Orange SKUs:", data?.map(d => d.sku));
}

checkSku();
