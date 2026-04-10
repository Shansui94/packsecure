import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SKU_V2 = 'BW-SL-CLR-100Mx100CMx1ROLL-RED'; // Merah

async function run() {
    let report = "=== MERAH (BW-SL-CLR-100Mx100CMx1ROLL-RED) Live Stock ===\n";
    
    // 1. Get Live Stock
    const { data: stockData, error: stockErr } = await supabase
        .from('v2_inventory_view')
        .select('loc_id, current_stock')
        .eq('sku', SKU_V2);
        
    if (stockErr) {
        report += `Error fetching stock: ${stockErr.message}\n`;
    } else {
        let totalStock = 0;
        for (const row of stockData || []) {
            totalStock += row.current_stock;
            report += `- ${row.loc_id || 'Unassigned'}: ${row.current_stock}\n`;
        }
        report += `\n=> Total Live Stock: ${totalStock}\n\n`;
    }

    // 2. Get Recent Transactions
    const { data: ledger, error: ledgerErr } = await supabase
        .from('stock_ledger_v2')
        .select('event_type, change_qty, ref_doc, notes, timestamp')
        .eq('sku', SKU_V2)
        .order('timestamp', { ascending: false })
        .limit(20);
        
    if (ledgerErr) {
        report += `Error fetching ledger: ${ledgerErr.message}\n`;
    } else {
        report += "=== Recent Ledger Entries for MERAH ===\n";
        for (const l of ledger || []) {
            report += `[${l.timestamp}] ${l.event_type} | Qty: ${l.change_qty} | Ref: ${l.ref_doc} | Notes: ${l.notes}\n`;
        }
    }
    
    fs.writeFileSync('merah_report.txt', report, 'utf8');
}

run().catch(console.error);
