import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    console.log("Applying manual fix for DO-2026-2754 stock ledger entries...");

    // 1. Refund 5 units to SPD
    const { error: err1 } = await supabaseAdmin.from('stock_ledger_v2').insert({
        sku: 'BW-SL-BLK-100Mx100CMx1ROLL-GRN',
        change_qty: 5,
        event_type: 'Transfer In',
        loc_id: 'SPD',
        ref_doc: 'DO-2026-2754',
        notes: 'Manual Fix: Refund SPD due to location edit',
        timestamp: new Date().toISOString()
    });

    if (err1) {
        console.error("Error refunding SPD:", err1);
        return;
    }
    console.log("✅ Refunded 5 units to SPD");

    // 2. Deduct 5 units from OPM Lama
    const { error: err2 } = await supabaseAdmin.from('stock_ledger_v2').insert({
        sku: 'BW-SL-BLK-100Mx100CMx1ROLL-GRN',
        change_qty: -5,
        event_type: 'Transfer Out',
        loc_id: 'OPM Lama',
        ref_doc: 'DO-2026-2754',
        notes: 'Manual Fix: Deduct OPM Lama due to location edit',
        timestamp: new Date().toISOString()
    });

    if (err2) {
        console.error("Error deducting OPM Lama:", err2);
        return;
    }
    console.log("✅ Deducted 5 units from OPM Lama");

    console.log("Stock successfully re-aligned for DO-2026-2754");
}

run();
