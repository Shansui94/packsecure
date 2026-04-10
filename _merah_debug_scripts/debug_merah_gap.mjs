import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching ledger...");
    const { data, error } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('location_name', 'OPM Lama')
        .lt('change_qty', 0)
        .order('timestamp', { ascending: false })
        .limit(20);
        
    let report = 'NEGATIVES FOR MERAH:\n';
    let sum = 0;
    if (data) {
        data.forEach(d => {
            report += `[${d.timestamp}] ${d.event_type} | Ref: ${d.reference_id || d.reference_doc || '?'} | Qty: ${d.change_qty}\n`;
            sum += Math.abs(d.change_qty);
        });
    }
    report += `TOTAL (last 20): ${sum}`;
    console.log(report);
}
run();
