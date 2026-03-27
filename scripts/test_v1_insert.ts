import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function checkV1Trigger() {
    // We cannot use information_schema triggers easily via postgrest if we don't know the exact view.
    // Let's try to do a test insert into production_logs (v1) directly.
    console.log("=== Testing Insert into production_logs (v1) ===");
    
    // The columns from earlier: id, machine_id, alarm_count, created_at, product_sku, lane_id
    const testRow = {
        machine_id: 'T1.2-M01',
        lane_id: 'Lane1',
        alarm_count: 1,
        product_sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED',
        created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
        .from('production_logs')
        .insert(testRow)
        .select('*');

    if (error) {
        console.error("❌ INSERT INTO V1 FAILED:", error.message, error.details, error.hint);
    } else {
        console.log("✅ INSERT INTO V1 SUCCEEDED!");
        console.log(data);
        
        // Clean up
        if (data && data[0] && data[0].id) {
            await supabase.from('production_logs').delete().eq('id', data[0].id);
        }
    }
}

checkV1Trigger().catch(console.error);
