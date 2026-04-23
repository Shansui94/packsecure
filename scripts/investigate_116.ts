import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    // 1. Get sum of stock ledger for OPM Lama for HITAM FULL
    const { data: ledger, error } = await supabaseAdmin.from('stock_ledger_v2')
        .select('change_qty, timestamp, event_type')
        .eq('sku', 'BW-SL-BLK-100Mx100CMx1ROLL-GRN')
        .eq('loc_id', 'OPM Lama');
        
    if (error) {
        console.log("Error", error); return;
    }
    
    let total = 0;
    let totalPast = 0;
    let totalFuture = 0;
    const now = new Date();
    
    ledger.forEach(l => {
        const qty = Number(l.change_qty) || 0;
        total += qty;
        const ts = new Date(l.timestamp);
        if (ts > now) totalFuture += qty;
        else totalPast += qty;
    });
    
    console.log(`Manual Sum for OPM Lama HITAM FULL:`);
    console.log(`Total: ${total}`);
    console.log(`Total Past: ${totalPast}`);
    console.log(`Total Future: ${totalFuture}`);
    
    // 2. Fetch the view result
    const { data: view } = await supabaseAdmin.from('v2_inventory_view')
        .select('current_stock, loc_id')
        .eq('sku', 'BW-SL-BLK-100Mx100CMx1ROLL-GRN')
        .eq('loc_id', 'OPM Lama');
        
    console.log(`View Result for OPM Lama:`, view);
}

run();
