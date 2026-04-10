import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const key = serviceKeyMatch[1].trim();
const supabase = createClient(supabaseUrl, key);

async function calibrate() {
    const { data: audits } = await supabase
        .from('stock_ledger_v2')
        .select('sku, notes, timestamp')
        .eq('loc_id', 'OPM Lama')
        .eq('event_type', 'Audit Adjustment')
        .order('timestamp', { ascending: false });

    // 1. Group by SKU to find their most recent audit
    const latestAudits = {};
    for (const a of audits) {
        if (!latestAudits[a.sku]) {
            latestAudits[a.sku] = a;
        }
    }

    console.log(`Found ${Object.keys(latestAudits).length} unique SKUs recently audited at OPM Lama.`);
    const toInsert = [];

    // 2. Compute balancing sum for each SKU
    for (const sku in latestAudits) {
        const audit = latestAudits[sku];
        
        // Match "Actual: 135" or "Actual: 0"
        const match = audit.notes?.match(/Actual:\s*(-?\d+)/);
        if (!match) continue;

        const actualPhysical = parseInt(match[1], 10);
        
        // Sum everything BEFORE and INCLUDING the audit timestamp
        const { data: records } = await supabase
            .from('stock_ledger_v2')
            .select('change_qty')
            .eq('sku', sku)
            .eq('loc_id', 'OPM Lama')
            .lte('timestamp', audit.timestamp);

        const currentSum = records.reduce((sum, r) => sum + Number(r.change_qty), 0);
        
        const discrepancy = actualPhysical - currentSum;

        if (discrepancy !== 0) {
            console.log(`[${sku}] Target: ${actualPhysical}, Current Sum: ${currentSum}, Deficit: ${discrepancy}`);
            
            // We want to insert exactly 1 ms AFTER the audit timestamp
            const exactTimestamp = new Date(new Date(audit.timestamp).getTime() + 1000).toISOString();
            
            toInsert.push({
                sku: sku,
                loc_id: 'OPM Lama',
                change_qty: discrepancy,
                event_type: 'Adjustment',
                ref_doc: 'SYS-AUDIT-CALIBRATION',
                notes: `System Auto-Calibration to restore Audit baseline (${actualPhysical})`,
                timestamp: exactTimestamp
            });
        } else {
             // console.log(`[${sku}] Already perfectly balanced.`);
        }
    }

    // 3. Insert calibration adjustments
    if (toInsert.length > 0) {
        console.log(`Inserting ${toInsert.length} balancing rows...`);
        const { error } = await supabase.from('stock_ledger_v2').insert(toInsert);
        if (error) console.error("Error inserting:", error);
        else console.log("Success! Baseline restored.");
    } else {
        console.log("No balances needed correction.");
    }
}

calibrate();
