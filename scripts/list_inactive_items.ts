
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listInactive() {
    console.log("--- Listing Inactive Items ---");

    const { data: items, error } = await supabase
        .from('master_items_v2')
        .select('sku, name, status, created_at')
        .neq('status', 'Active')
        .order('sku');

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    if (!items || items.length === 0) {
        console.log("No inactive items found.");
        return;
    }

    let content = `Total Inactive Items: ${items.length}\n\n`;
    content += `SKU | Name | Status | Created At\n`;
    content += `--- | --- | --- | ---\n`;

    items.forEach(i => {
        content += `${i.sku} | ${i.name} | ${i.status} | ${i.created_at}\n`;
    });

    fs.writeFileSync('inactive_items_list.txt', content);
    console.log(`List written to inactive_items_list.txt (${items.length} items)`);
}

listInactive();
