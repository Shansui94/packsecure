import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    const { data } = await supabaseAdmin.from('master_items_v2').select('sku, type').ilike('sku', '%HITAM%');
    console.log("Types:", data);

    const { data: q1 } = await supabaseAdmin.from('master_items_v2').select('sku, type').ilike('sku', 'DL%');
    console.log("Types DL:", q1);

    // Let's update DL-HITAM-FULL to Bubble Wrap
    const { error } = await supabaseAdmin.from('master_items_v2').update({ type: 'Bubble Wrap' }).eq('sku', 'DL-HITAM-FULL');
    console.log("Update DL-HITAM-FULL result:", error || "Success");
}
run();
