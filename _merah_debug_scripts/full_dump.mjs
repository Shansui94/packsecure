import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function dump() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    const { data } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .gte('timestamp', '2026-03-30T00:00:00.000Z')
        .order('timestamp', { ascending: false });
    
    let report = '=== ALL EVENTS FOR MERAH ===\n';
    let negativeTotal = 0;

    // Track when the 'Audit' happened
    let auditTime = null;
    let afterAuditOut = 0;

    // We go backwards in time (descending), so the LAST item physically in the array is the OLDEST.
    // Let's reverse to process chronologically.
    const chronological = data.reverse();

    chronological.forEach(d => {
        const qty = d.change_qty !== null ? d.change_qty : d.quantity;
        const loc = d.location_name || d.location || 'UNKNOWN';
        
        // Is this an audit?
        if (d.event_type && d.event_type.toLowerCase().includes('audit')) {
            auditTime = d.timestamp;
            report += `\n>>>>> AUDIT AT ${d.timestamp} [Location: ${loc}] Set to: ${qty} <<<<<\n\n`;
            afterAuditOut = 0; // reset
        } else {
             if (qty < 0 || d.event_type === 'Transfer Out' || d.event_type === 'Stock Out') {
                  let deduction = Number(qty);
                  if (deduction > 0) deduction = -deduction;
                  
                  report += `[${d.timestamp}] TYPE: ${d.event_type} | QTY: ${deduction} | LOC: ${loc} | REF: ${d.reference_doc || d.reference || d.reference_id}\n`;
                  
                  if (auditTime) {
                      afterAuditOut += Math.abs(deduction);
                  }
             }
        }
    });

    report += `\nTOTAL OUT AFTER AUDIT: ${afterAuditOut}\n`;
    fs.writeFileSync('full_dump.txt', report);
}
dump();
