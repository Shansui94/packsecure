
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function prepare() {
    console.log("--- Preparing Migration Context ---");

    // 1. Check Factories
    let factoryId = '';
    const { data: factories, error: fErr } = await supabase.from('sys_factories_v2').select('id, name');
    if (fErr) console.log("Factory Error:", fErr.message);
    else if (factories && factories.length > 0) {
        console.log(`Found ${factories.length} factories. Using first:`, factories[0].name);
        factoryId = factories[0].id;
    } else {
        console.log("No factories found. Creating 'Main Factory'...");
        const { data: newF, error: createErr } = await supabase.from('sys_factories_v2').insert({
            name: 'Main Factory',
            type: 'Production',
            address: 'Default'
        }).select().single();

        if (createErr) console.log("Create Factory Failed:", createErr.message);
        else {
            console.log("Created Factory:", newF.id);
            factoryId = newF.id;
        }
    }

    // 2. Inspect Schemas (Keys Only)
    const { data: legacy } = await supabase.from('inventory').select('*').limit(1);
    const { data: fi } = await supabase.from('factory_inventory').select('*').limit(1);

    console.log("Legacy Keys:", legacy?.[0] ? Object.keys(legacy[0]) : "Empty");
    console.log("Factory Inv Keys:", fi?.[0] ? Object.keys(fi[0]) : "Empty");

    // 3. Inspect one Legacy Item to verify ID/SKU
    if (legacy?.[0]) {
        console.log("Sample ID:", legacy[0].id);
        console.log("Sample SKU_ID:", legacy[0].SKU_ID);
        console.log("Sample Raw_Material_ID:", legacy[0].Raw_Material_ID);
        console.log("Sample Qty:", legacy[0].qty || legacy[0].Stock_Kg);
    }
}

prepare();
