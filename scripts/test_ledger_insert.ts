import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testTrigger() {
    console.log("Inserting into production_logs_v2 (Service Role)...");
    const { data: logs, error: err1 } = await supabase.from('production_logs_v2').insert({
        machine_id: "N1-M01",
        output_qty: 999,
        sku: "BW-SL-CLR-100Mx100CMx1ROLL-RED"
    }).select();

    if (err1) {
        console.error("Failed to insert into production logs:", err1);
        return;
    }

    const logId = logs[0].log_id;
    console.log("Inserted with log_id:", logId);
    
    console.log("Checking if stock_ledger_v2 captured it...");
    await new Promise(r => setTimeout(r, 1000));
    
    const { data: stock, error: err2 } = await supabase.from('stock_ledger_v2').select('*').eq('ref_doc', logId);
    
    if (err2) {
        console.error("Error reading stock ledger:", err2);
    } else {
        if (stock && stock.length > 0) {
            console.log("TRIGGER WORKED! Stock ledger created:", stock[0]);
        } else {
            console.log("TRIGGER FAILED! No stock ledger entry found for ref_doc =", logId);
        }
    }
}

testTrigger().catch(console.error);
