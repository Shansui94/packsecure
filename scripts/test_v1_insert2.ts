import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function testV1Insert() {
    console.log("=== Testing Manual V1 Insert (To Catch Trigger Errors) ===");
    
    const testRow = {
        machine_id: 'T1.2-M01',
        lane_id: 'Lane1',
        alarm_count: 1,
        product_sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED',
        created_at: new Date().toISOString()
    };
    
    console.log("Attempting insert:", testRow);
    const { data, error } = await supabase
        .from('production_logs')
        .insert(testRow)
        .select('*');

    if (error) {
        console.error("\n❌ ERROR: System is rejecting V1 inserts!");
        console.error("Details:", error.message, error.details, error.hint);
    } else {
        console.log("\n✅ SUCCESS: V1 Insert worked!");
        console.log(data);
        if (data && data[0] && data[0].id) {
            await supabase.from('production_logs').delete().eq('id', data[0].id);
        }
    }
}

testV1Insert().catch(console.error);
