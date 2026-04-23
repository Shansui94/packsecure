import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function restoreSku() {
    const skuToRestore = 'DL-HITAM-FULL';
    
    console.log(`[RESTORE] Checking if ${skuToRestore} exists...`);
    const { data: existing } = await supabaseAdmin.from('master_items_v2').select('sku').eq('sku', skuToRestore).maybeSingle();
    
    if (existing) {
        console.log(`✅ ${skuToRestore} already exists in the database.`);
        return;
    }
    
    console.log(`[RESTORE] Re-inserting ${skuToRestore}...`);
    const { data, error } = await supabaseAdmin.from('master_items_v2').insert({
        sku: skuToRestore,
        name: skuToRestore,
        type: 'FG',
        supply_type: 'Manufactured',
        uom: 'Roll',
        status: 'Active'
    }).select().single();
    
    if (error) {
        console.error("❌ Error restoring SKU:", error);
    } else {
        console.log(`✅ Successfully restored SKU:`, data);
    }
}

restoreSku();
