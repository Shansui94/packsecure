import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function check() {
    // Check if it's in master_items_v2
    const { data: item } = await supabaseAdmin.from('master_items_v2').select('*').eq('sku', 'DL-HITAM-FULL');
    console.log("In master_items_v2:", item);

    // Check if it's in v2_inventory_view
    const { data: view } = await supabaseAdmin.from('v2_inventory_view').select('*').eq('sku', 'DL-HITAM-FULL');
    console.log("In v2_inventory_view:", view);
}

check();
