import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function testInsert() {
    console.log("=== Testing Insert into production_logs_v2 ===");
    const testRow = {
        sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED',
        machine_id: 'T1.2-M01',
        output_qty: 1,
        created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
        .from('production_logs_v2')
        .insert(testRow)
        .select('*');

    if (error) {
        console.error("❌ INSERT FAILED:", error.message, error.details, error.hint);
    } else {
        console.log("✅ INSERT SUCCEEDED!");
        console.log(data);
        
        // Clean up
        if (data && data[0] && data[0].log_id) {
            await supabase.from('production_logs_v2').delete().eq('log_id', data[0].log_id);
            await supabase.from('stock_ledger_v2').delete().eq('ref_doc', data[0].log_id);
        }
    }
}

testInsert().catch(console.error);
