import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    console.log("Fetching ledger for", sku);
    
    const { data: ledger, error } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .order('timestamp', { ascending: false })
        .limit(100);
        
    let report = '=== RECENT LEDGER ENTRIES FOR MERAH ===\n';
    let negativeSumSinceAudit = 0;
    let foundAudit = false;
    
    if (error) {
        console.error(error);
        return;
    }

    if (ledger) {
        ledger.forEach(l => {
            let qty = l.change_qty !== null ? l.change_qty : l.quantity; // handles v1/v2 schema weirdness
            report += `[${l.timestamp}] Event: ${l.event_type || l.transaction_type} | Ref: ${l.reference || l.reference_id} | Qty: ${qty} | Location: ${l.location_name}\n`;
            
            if (!foundAudit) {
                if (qty < 0) {
                    negativeSumSinceAudit += Number(qty);
                }
                if (l.event_type === 'Audit Adjustment' || l.transaction_type === 'Audit') {
                    foundAudit = true;
                    report += `--- AUDIT FOUND HERE ---\n`;
                }
            }
        });
    }
    
    report += `\nNegative sum after latest audit: ${negativeSumSinceAudit}\n`;
    fs.writeFileSync('ledger_dump.txt', report);
}
run();
