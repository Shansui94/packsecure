
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

const pairs = [
    { legacy: 'lorries', v2: 'sys_vehicles', label: 'Vehicles' },
    { legacy: 'inventory', v2: 'master_items_v2', label: 'Items' },
    { legacy: 'customers', v2: 'sys_customers', label: 'Customers' },
    { legacy: 'sys_clients', v2: 'sys_customers', label: 'Clients' },
    { legacy: 'suppliers', v2: 'crm_partners_v2', label: 'Suppliers' },
    { legacy: 'machines', v2: 'sys_machines_v2', label: 'Machines' },
    { legacy: 'recipes', v2: 'bom_headers_v2', label: 'Recipes' },
    { legacy: 'bom_recipes', v2: 'bom_headers_v2', label: 'BOM Recipes' }
];

async function assess() {
    let output = "--- Start Assessment ---\n";
    for (const p of pairs) {
        const { count: lC, error: lE } = await supabase.from(p.legacy).select('*', { count: 'exact', head: true });
        const { count: v2C, error: v2E } = await supabase.from(p.v2).select('*', { count: 'exact', head: true });

        const line = `${p.label}: Legacy(${p.legacy})=${lE ? 'ERR' : lC} -> V2(${p.v2})=${v2E ? 'ERR' : v2C}`;
        console.log(line);
        output += line + "\n";
    }
    fs.writeFileSync('migration_assessment.txt', output);
    console.log("Written to migration_assessment.txt");
}

assess();
