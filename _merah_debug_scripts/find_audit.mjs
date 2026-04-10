import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findAudit() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    const { data } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .eq('location_name', 'OPM Lama')
        .gte('timestamp', '2026-03-30T00:00:00.000Z')
        .order('timestamp', { ascending: false });
    
    let report = '=== ALL AUDIT/NON-PROD EVENTS ===\n';
    if(data) {
        data.forEach(d => {
            if (d.event_type !== 'Production' && d.event_type !== 'Transfer Out') {
                 report += `[${d.timestamp}] TYPE: ${d.event_type} | QTY: ${d.change_qty} | REF: ${d.reference_id || d.reference}\n`;
            }
        });
    }
    fs.writeFileSync('audit_dump.txt', report);
}
findAudit();
