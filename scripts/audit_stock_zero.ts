import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching current stock levels...");
    const { data: inventory, error: invError } = await supabase
        .from('v2_inventory_view')
        .select('sku, loc_id, current_stock');
        
    if (invError) {
        console.error("Error fetching inventory:", invError);
        return;
    }

    const toReset = inventory.filter(row => row.loc_id !== 'OPM Lama' && row.current_stock !== 0);
    console.log(`Found ${toReset.length} SKUs across locations (excluding OPM Lama) that are non-zero.`);

    if (toReset.length === 0) {
        console.log("Everything is already 0.");
        return;
    }

    const timestamp = new Date().toISOString();
    const insertPayload = toReset.map(row => ({
        sku: row.sku,
        change_qty: -row.current_stock, // offset the current stock to exactly 0
        event_type: 'Audit',
        loc_id: row.loc_id,
        ref_doc: `AUDIT-WIPE-${Date.now()}`,
        notes: 'Manual audit to 0 via System Request',
        timestamp: timestamp,
        created_at: timestamp,
        created_by_name: 'Max Tan'
    }));

    // Insert batches of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < insertPayload.length; i += BATCH_SIZE) {
        const batch = insertPayload.slice(i, i + BATCH_SIZE);
        const { error: insErr } = await supabase.from('stock_ledger_v2').insert(batch);
        
        if (insErr) {
            console.error(`Error inserting batch ${i / BATCH_SIZE}:`, insErr);
        } else {
            console.log(`Inserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(insertPayload.length / BATCH_SIZE)} (${batch.length} rows)`);
        }
    }
    
    console.log("Auditing completed successfully!");
}

run();
