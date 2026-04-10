import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findMerahGap() {
    const merahSku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    
    // Fetch all records for the last 3 days for Merah at OPM Lama to see what event deducted the 583
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('sku', merahSku)
        .eq('location_name', 'OPM Lama')
        .gte('timestamp', '2026-03-29T00:00:00.000Z');

    let totalOut = 0;
    let report = '==== ALL MERAH LEDGER SINCE MARCH 29 ====\n\n';

    if (ledger) {
        ledger.forEach(l => {
            const qtyStr = l.change_qty !== undefined ? l.change_qty : l.quantity;
            let qty = Number(qtyStr) || 0;
            if (qty < 0 || l.event_type === 'Transfer Out' || l.event_type === 'Manual Out') {
                 if (qty > 0) qty = -qty; // force negative for out events if they were stored positive
                 totalOut += qty;
                 report += `[${l.timestamp || l.created_at}] Event: ${l.event_type} | Ref: ${l.reference} | Qty: ${qty} | User: ${l.user_id}\n`;
            }
        });
    }
    
    report += `\nTOTAL DEDUCTED: ${totalOut}\n`;
    fs.writeFileSync('merah_gap.txt', report);
}

findMerahGap();
