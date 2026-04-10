import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const key = serviceKeyMatch[1].trim();
const supabase = createClient(supabaseUrl, key);

const LEGACY_SKU_MAP = {
    'DL-20CM': 'BW-DL-CLR-100Mx20CMx5ROLL-BLU',
    'DL-25CM': 'BW-DL-CLR-100Mx25CMx4ROLL-BLU',
    'DL-33CM': 'BW-DL-CLR-100Mx33CMx3ROLL-BLU',
    'DL-FULL': 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    'DL-HALF': 'BW-DL-CLR-100Mx50CMx2ROLL-BLU',
    'DL-HITAM-20CM': 'BW-DL-BLK-100Mx20CMx5ROLL-RED',
    'DL-HITAM-25CM': 'BW-DL-BLK-100Mx25CMx4ROLL-RED',
    'DL-HITAM-33CM': 'BW-DL-BLK-100Mx33CMx3ROLL-RED',
    'DL-HITAM-FULL': 'BW-DL-BLK-100Mx100CMx1ROLL-RED',
    'DL-HITAM-HALF': 'BW-DL-BLK-100Mx50CMx2ROLL-GRN',
    'HITAM-20CM': 'BW-SL-BLK-100Mx20CMx5ROLL-GRN',
    'HITAM-25CM': 'BW-SL-BLK-100Mx25CMx4ROLL-GRN',
    'HITAM-33CM': 'BW-SL-BLK-100Mx33CMx3ROLL-GRN',
    'HITAM-FULL': 'BW-SL-BLK-100Mx100CMx1ROLL-GRN',
    'HITAM-HALF': 'BW-SL-BLK-100Mx50CMx2ROLL-RED',
    'MERAH': 'BW-SL-CLR-100Mx100CMx1ROLL-RED',
    'OREN': 'BW-SL-CLR-100Mx100CMx1ROLL-ORN',
    'SILVER-GREY': 'BW-SL-SLV-100Mx100CMx1ROLL',
    'SL-20CM': 'BW-SL-CLR-100Mx20CMx5ROLL-GRN',
    'SL-25CM': 'BW-SL-CLR-100Mx25CMx4ROLL-GRN',
    'SL-33CM': 'BW-SL-CLR-100Mx33CMx3ROLL-GRN'
};

async function previewRestore() {
    console.log("Analyzing Delivered orders to find missing ledger entries...");
    
    // 1. Fetch all delivered DOs
    const { data: deliveredDos, error: doError } = await supabase
        .from('sales_orders')
        .select('order_number, items, deadline, order_date, customer, pod_timestamp')
        .eq('status', 'Delivered');
        
    if (doError) { console.error(doError); return; }
    
    // 2. Fetch all Outward stock ledgers
    const { data: outwardLedgers, error: ledgerError } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc, sku, change_qty')
        .lt('change_qty', 0);
        
    if (ledgerError) { console.error(ledgerError); return; }
    
    // Group ledgers by ref_doc
    const ledgerMap = {};
    for (const l of outwardLedgers) {
        if (l.ref_doc) {
            if (!ledgerMap[l.ref_doc]) ledgerMap[l.ref_doc] = [];
            ledgerMap[l.ref_doc].push(l);
        }
    }
    
    let totalMissing = 0;
    const toInsert = [];
    
    for (const order of deliveredDos) {
        const orderNum = order.order_number;
        const items = order.items || [];
        const existingOutwards = ledgerMap[orderNum] || [];
        
        let hasMissing = false;
        
        for (const item of items) {
            // Find valid sku
            let sku = item.sku;
            if (LEGACY_SKU_MAP[sku]) sku = LEGACY_SKU_MAP[sku];
            
            const qty = item.confirmedQty || item.quantity;
            if (!qty || qty <= 0) continue;
            
            // Check if this SKU was deducted for this DO
            const found = existingOutwards.find(l => l.sku === sku && l.change_qty === -qty);
            
            if (!found) {
                hasMissing = true;
                
                let targetDate = order.deadline || order.order_date;
                let transactionDate = new Date().toISOString();
                if (targetDate) {
                    try {
                        const baseDate = new Date(targetDate);
                        baseDate.setUTCHours(12, 0, 0, 0);
                        transactionDate = baseDate.toISOString();
                    } catch (e) {}
                } else if (order.pod_timestamp) {
                    transactionDate = order.pod_timestamp;
                }
                
                let loc = item.sourceLocation;
                if (!loc && item.remark && item.remark.includes('Loc:')) {
                    const match = item.remark.match(/Loc:\s*([^)\n\r,]+)/);
                    if (match) loc = match[1].trim();
                }
                if (!loc || loc === 'Unassigned') loc = 'OPM Lama';
                
                toInsert.push({
                    timestamp: transactionDate,
                    sku: sku,
                    change_qty: -qty,
                    event_type: 'Transfer Out',
                    loc_id: loc,
                    ref_doc: orderNum,
                    notes: `System Auto-Restored DO Delivery`
                });
            }
        }
    }
    
    console.log(`Found ${toInsert.length} missing inventory deductions across all past Delivered DOs!`);
    console.log("Here's a preview of the first 5 records to be restored:");
    console.log(toInsert.slice(0, 5));
    
    // Save to a file for execution
    fs.writeFileSync('scripts/pending_restore.json', JSON.stringify(toInsert, null, 2));
    console.log("Restoration data saved to scripts/pending_restore.json.");
}

previewRestore();
