const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkOrphanRefunds() {
    console.log("Checking orphaned refunds...");
    // Find all refunds
    const { data: refunds } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Cancellation Refund');
        
    // Find all deductions (Transfer Out) for the same ref_doc
    const refDocs = [...new Set(refunds.map(r => r.ref_doc))];
    
    const { data: outs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .in('ref_doc', refDocs)
        .eq('event_type', 'Transfer Out');
        
    const outDocs = new Set(outs.map(o => o.ref_doc));
    
    const orphans = refunds.filter(r => !outDocs.has(r.ref_doc));
    
    console.log(`Found ${orphans.length} orphaned refunds!`);
    console.log("Orphaned Refund Ref Docs:", [...new Set(orphans.map(o => o.ref_doc))]);
    
    // Sum of orphaned refunds for MERAH
    const sumMerah = orphans.filter(o => o.sku === 'BW-SL-CLR-100Mx100CMx1ROLL-RED').reduce((acc, row) => acc + row.change_qty, 0);
    console.log("Total orphaned refund for MERAH:", sumMerah);
    
    // Sum of orphaned refunds for OREN
    const sumOren = orphans.filter(o => o.sku === 'BW-SL-CLR-100Mx50CMx2ROLL-ORN').reduce((acc, row) => acc + row.change_qty, 0);
    console.log("Total orphaned refund for OREN:", sumOren);
}

checkOrphanRefunds();
