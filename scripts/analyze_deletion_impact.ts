
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
    let output = "--- Deletion Impact Analysis ---\n";

    // 1. Get Inactive SKUs
    const { data: inactiveItems } = await supabase
        .from('master_items_v2')
        .select('sku')
        .neq('status', 'Active');

    if (!inactiveItems || inactiveItems.length === 0) {
        console.log("No inactive items found.");
        return;
    }
    const skus = inactiveItems.map(i => i.sku);

    // 2. Aggregate Production Logs
    // Supabase JS doesn't do GROUP BY easily without RPC. 
    // We'll fetch relevant rows (IDs and SKUs) and aggregate in JS. 
    // 2000 rows is small enough for JS aggregation.

    // Fetch Logs
    const { data: logs } = await supabase
        .from('production_logs_v2')
        .select('sku')
        .in('sku', skus);

    // Fetch Ledger
    const { data: ledger } = await supabase
        .from('stock_ledger_v2')
        .select('sku')
        .in('sku', skus);

    // 3. Aggregate
    const impactMap: Record<string, { logs: number, ledger: number }> = {};

    logs?.forEach((l: any) => {
        if (!impactMap[l.sku]) impactMap[l.sku] = { logs: 0, ledger: 0 };
        impactMap[l.sku].logs++;
    });

    ledger?.forEach((l: any) => {
        if (!impactMap[l.sku]) impactMap[l.sku] = { logs: 0, ledger: 0 };
        impactMap[l.sku].ledger++;
    });

    // 4. Format Output
    output += `Total Inactive SKUs with History: ${Object.keys(impactMap).length}\n\n`;
    output += `SKU | Production Logs | Stock Ledger\n`;
    output += `--- | --- | ---\n`;

    // Sort by total activity desc
    const sorted = Object.entries(impactMap).sort((a, b) => {
        const totalA = a[1].logs + a[1].ledger;
        const totalB = b[1].logs + b[1].ledger;
        return totalB - totalA;
    });

    sorted.forEach(([sku, counts]) => {
        output += `${sku} | ${counts.logs} | ${counts.ledger}\n`;
    });

    fs.writeFileSync('impact_analysis.txt', output);
    console.log("Written to impact_analysis.txt");
}

analyze();
