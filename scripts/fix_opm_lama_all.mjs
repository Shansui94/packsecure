import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

// Audit time: 5/4/2026 4:56:30 AM MYT (UTC+8) = 2026-04-04T20:56:30Z
const AUDIT_TIME = '2026-04-04T20:56:30Z';
const LOC = 'OPM Lama';

// Audit data from the user's spreadsheet (Actual Qty on April 4th)
// NOTE: First SKU in audit is SLR but production uses CLR - will handle both
const auditData = {
    'BW-SL-SLR-100Mx100CMx1ROLL-RED': 122,
    'BW-DL-CLR-100Mx100CMx1ROLL-YEL': 66,
    'BW-SL-BLK-100Mx100CMx1ROLL-BLU': 97,
    'BW-SL-CLR-100Mx50CMx2ROLL-ORN': 36,
    'BW-SL-CLR-100Mx25CMx4ROLL-GRN': 36,
    'BW-DL-BLK-100Mx50CMx2ROLL-RED': 48,
    'BW-DL-CLR-100Mx50CMx2ROLL-BLU': 69,
    'BW-SL-BLK-100Mx50CMx2ROLL-RED': 100,
    'BW-DL-BLK-100Mx100CMx1ROLL-RED': 103,
    'BW-SL-BLK-100Mx20CMx5ROLL-GRN': 15,
    'BW-DL-CLR-100Mx20CMx5ROLL-BLU': 22,
    'BW-DL-BLK-100Mx25CMx4ROLL-RED': 33,
    'BW-SL-CLR-100Mx20CMx5ROLL-GRN': 13,
    'BW-DL-CLR-100Mx33CMx3ROLL-BLU': 63,
    'BW-SL-BLK-100Mx33CMx3ROLL-GRN': 18,
    'BW-DL-BLK-100Mx33CMx3ROLL-RED': 27,
    'BW-DL-CLR-100Mx50CMx2ROLL-GRN': 48,
    'BW-DL-CLR-100Mx25CMx4ROLL-BLU': 63,
};

// MERAH: audit uses SLR, production uses CLR. Map it.
auditData['BW-SL-CLR-100Mx100CMx1ROLL-RED'] = 122;

async function paginatedSum(sku, filter) {
    let total = 0;
    let page = 0;
    while (true) {
        let q = supabase.from('stock_ledger_v2')
            .select('change_qty')
            .eq('sku', sku)
            .eq('loc_id', LOC)
            .gt('timestamp', AUDIT_TIME)
            .range(page * 1000, (page + 1) * 1000 - 1);
        
        if (filter) {
            q = q.in('event_type', filter);
        }
            
        const { data, error } = await q;
        if (error) { console.error('Query error:', error); break; }
        if (!data || data.length === 0) break;
        total += data.reduce((s, r) => s + Number(r.change_qty), 0);
        page++;
        if (data.length < 1000) break;
    }
    return total;
}

async function main() {
    // 1. Clean up ALL previous adjustment attempts
    const { data: junk } = await supabase.from('stock_ledger_v2')
        .select('txn_id')
        .eq('loc_id', LOC)
        .in('ref_doc', [
            'SYS-AUDIT-CALIBRATION', 'SYS-APRIL-4-RESET', 
            'SYS-USER-FORMULA', 'ALIGNED-BASIS', 'TRUE-BASE-APR4',
            'APR4-FINAL-BASE', 'APR4-COMPREHENSIVE-FIX'
        ]);
    
    if (junk && junk.length > 0) {
        console.log(`Deleting ${junk.length} old adjustment records...`);
        // Delete in batches of 100
        for (let i = 0; i < junk.length; i += 100) {
            const batch = junk.slice(i, i + 100).map(r => r.txn_id);
            await supabase.from('stock_ledger_v2').delete().in('txn_id', batch);
        }
    }

    // 2. Get ALL unique SKUs at OPM Lama from v2_inventory_view
    const { data: allSkus } = await supabase.from('v2_inventory_view')
        .select('sku, current_stock')
        .eq('loc_id', LOC);
    
    console.log(`Found ${allSkus.length} SKUs at OPM Lama`);
    
    const inserts = [];

    for (const row of allSkus) {
        const sku = row.sku;
        const currentTotal = Number(row.current_stock);
        
        // Get sum of ALL records AFTER audit time (these are the "real" post-audit movements)
        const postAuditSum = await paginatedSum(sku);
        
        // What's the audit base for this SKU?
        const auditQty = auditData[sku] !== undefined ? auditData[sku] : 0;
        
        // Expected current stock = audit base + post-audit movements
        const expected = auditQty + postAuditSum;
        
        // Offset needed
        const offset = expected - currentTotal;
        
        if (offset !== 0) {
            console.log(`[${sku}] Audit: ${auditQty}, PostAudit: ${postAuditSum}, Expected: ${expected}, Current: ${currentTotal}, Offset: ${offset}`);
            inserts.push({
                sku,
                loc_id: LOC,
                change_qty: offset,
                event_type: 'Audit Adjustment',
                notes: `System Alignment: Apr 4 Audit Base = ${auditQty}. Formula: ${auditQty} + postAudit(${postAuditSum}) = ${expected}`,
                ref_doc: 'APR4-COMPREHENSIVE-FIX',
                timestamp: AUDIT_TIME
            });
        } else {
            console.log(`[${sku}] Already correct at ${currentTotal}`);
        }
    }
    
    // 3. Insert all adjustments
    if (inserts.length > 0) {
        console.log(`\nInserting ${inserts.length} adjustment records...`);
        for (let i = 0; i < inserts.length; i += 50) {
            const batch = inserts.slice(i, i + 50);
            const { error } = await supabase.from('stock_ledger_v2').insert(batch);
            if (error) console.error('Insert error:', error);
        }
        console.log('Done!');
    }
    
    // 4. Verify
    console.log('\n=== VERIFICATION ===');
    const { data: final } = await supabase.from('v2_inventory_view')
        .select('sku, current_stock')
        .eq('loc_id', LOC)
        .order('sku');
    
    for (const r of final) {
        if (Number(r.current_stock) !== 0) {
            console.log(`${r.sku}: ${r.current_stock}`);
        }
    }
}

main().catch(console.error);
