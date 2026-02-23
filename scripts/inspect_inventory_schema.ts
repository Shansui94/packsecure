
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const result: any = {};

    // Legacy Inventory
    const { data: legacy, error: lErr } = await supabase.from('inventory').select('*').limit(1);
    if (lErr) result.legacyError = lErr.message;
    else if (legacy?.[0]) result.legacyKeys = Object.keys(legacy[0]);
    else result.legacy = "Empty";

    // V2 Items
    const { data: v2, error: v2Err } = await supabase.from('master_items_v2').select('*').limit(1);
    if (v2Err) result.v2Error = v2Err.message;
    else if (v2?.[0]) result.v2Keys = Object.keys(v2[0]);
    else result.v2 = "Empty (Keys unknown unless fetched schema directly or inferred)";

    // To infer keys if table empty, try inserting a dummy with returning * ? No, schema query better but complex.
    // For now assume emptiness means we rely on `types.ts` or known schema.

    fs.writeFileSync('schema_inspection.json', JSON.stringify(result, null, 2));
    console.log("Written to schema_inspection.json");
}

inspect();
