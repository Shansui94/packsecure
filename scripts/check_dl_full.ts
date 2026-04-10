import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TARGET_DATE = '2026-04-08';
const SKU_V2 = 'BW-DL-CLR-100Mx100CMx1ROLL-YEL';
const LEGACY_SKU = 'DL-FULL';

async function run() {
    let report = `=== Analysis for ${LEGACY_SKU} (${SKU_V2}) on ${TARGET_DATE} ===\n\n`;

    // 1. Fetch Sales Orders for Today
    const { data: orders } = await supabase
        .from('sales_orders')
        .select('order_number, status, deadline, items')
        .eq('deadline', TARGET_DATE);

    let reqTotal = 0;
    report += "--- Sales Orders requiring DL-FULL for today ---\n";
    for (const order of orders || []) {
        if (order.status === 'Cancelled') continue;
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
            if (item.sku === LEGACY_SKU || item.sku === SKU_V2) {
                const qty = parseInt(item.quantity || '0');
                reqTotal += qty;
                report += `[${order.order_number}] Status: ${order.status} | Qty: ${qty}\n`;
            }
        }
    }
    report += `\n>> Total Requested (Req): ${reqTotal}\n\n`;

    // 2. Fetch Ledger Transfer Out for Today
    const { data: ledger } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc, change_qty, timestamp, notes')
        .eq('sku', SKU_V2)
        .eq('event_type', 'Transfer Out')
        .gte('timestamp', `${TARGET_DATE}T00:00:00+08:00`)
        .lt('timestamp', `${TARGET_DATE}T23:59:59+08:00`);

    let outTotal = 0;
    report += "--- Ledger Transfer Out for DL-FULL today ---\n";
    for (const l of ledger || []) {
        outTotal += Math.abs(l.change_qty);
        report += `[${l.ref_doc}] Qty: ${l.change_qty} | Time: ${l.timestamp} | Notes: ${l.notes}\n`;
    }
    report += `\n>> Total Transfer Out: ${outTotal}\n`;
    
    // Also check previous days just in case
    const { data: oddLedger } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc, change_qty, timestamp, notes')
        .eq('sku', SKU_V2)
        .eq('event_type', 'Transfer Out')
        .lt('timestamp', `${TARGET_DATE}T00:00:00+08:00`)
        .order('timestamp', { ascending: false })
        .limit(10);
    
    report += "\n--- Recent past Transfer Outs (just checking for overlaps) ---\n";
    for(const l of oddLedger || []) {
        report += `[${l.ref_doc}] Qty: ${l.change_qty} | Time: ${l.timestamp} | Notes: ${l.notes}\n`;
    }

    fs.writeFileSync('dl_full_analysis.txt', report);
    console.log("Analysis saved to dl_full_analysis.txt");
}

run().catch(console.error);
