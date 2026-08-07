import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("=== Analyzing 114 manually completed orders ===");
    
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, created_at, deadline, proof_of_load_url, notes')
        .like('notes', '%[System Manual Complete]%');

    if (error) {
        console.error(error);
        return;
    }

    let noProofOfLoadCount = 0;
    let loadedBeforeCutoffCount = 0;
    let loadedAfterCutoffCount = 0;

    const cutOffUtc = '2026-07-09T08:00:00.000Z'; // 4 PM Local Time yesterday

    const listNoProof = [];
    const listLoadedAfter = [];

    orders.forEach(o => {
        if (!o.proof_of_load_url) {
            noProofOfLoadCount++;
            listNoProof.push(o);
            return;
        }

        const match = o.proof_of_load_url.match(/_(\d{13})\./);
        if (match) {
            const ms = parseInt(match[1], 10);
            const loadedAt = new Date(ms).toISOString();
            if (loadedAt < cutOffUtc) {
                loadedBeforeCutoffCount++;
            } else {
                loadedAfterCutoffCount++;
                listLoadedAfter.push({ order: o, loadedAt });
            }
        } else {
            // No timestamp in url, treat as before cutoff or check created_at?
            // Usually old urls might not have timestamp, but they were created months ago
            loadedBeforeCutoffCount++;
        }
    });

    console.log(`Results:`);
    console.log(`- No proof of load (never clicked Naik Barang): ${noProofOfLoadCount}`);
    console.log(`- Loaded before cutoff (4 PM yesterday): ${loadedBeforeCutoffCount}`);
    console.log(`- Loaded after cutoff: ${loadedAfterCutoffCount}`);

    console.log("\nSample No Proof Of Load orders (first 10):");
    listNoProof.slice(0, 10).forEach(o => {
        console.log(`  Order: ${o.order_number}, CreatedAt: ${o.created_at}, Deadline: ${o.deadline}`);
    });

    console.log("\nSample Loaded After Cutoff orders:");
    listLoadedAfter.forEach(l => {
        console.log(`  Order: ${l.order.order_number}, LoadedAt: ${l.loadedAt}, CreatedAt: ${l.order.created_at}, Deadline: ${l.order.deadline}`);
    });
}

check();
