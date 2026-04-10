import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const key = serviceKeyMatch[1].trim();
const supabase = createClient(supabaseUrl, key);

async function execute() {
    const data = JSON.parse(fs.readFileSync('scripts/pending_restore.json', 'utf8'));
    console.log(`Starting insertion of ${data.length} missing stock records individually...`);
    
    let successCount = 0;
    const failedSkus = new Set();
    
    // Process in chunks just to speed up parallel execution slightly
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (row) => {
            const { error } = await supabase.from('stock_ledger_v2').insert(row);
            if (error) {
                if (error.message.includes('stock_ledger_v2_sku_fkey')) {
                    failedSkus.add(row.sku);
                } else if (error.code === '23505') {
                    // unique constraint / duplicate? (we don't have unique constraint on these usually)
                } else {
                    console.error(`Other error for sku ${row.sku}:`, error.message);
                }
            } else {
                successCount++;
            }
        }));
        
        if (i % 200 === 0) {
            console.log(`Processed ${i}/${data.length}...`);
        }
    }
    
    console.log(`Restoration complete. Inserted ${successCount} out of ${data.length} records.`);
    console.log(`The following SKUs failed due to missing in V2 system (unmapped):`, Array.from(failedSkus));
}

execute();
