import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Analyzing all historical audit adjustments in database (in-memory grouping)...");
    
    const { data: allAuditRows, error: err2 } = await s.from('stock_ledger_v2')
        .select('loc_id, timestamp, sku')
        .eq('event_type', 'Audit Adjustment');

    if (err2) {
        console.error("Error fetching rows:", err2);
        return;
    }

    const counts = {};
    allAuditRows.forEach(row => {
        const loc = row.loc_id || 'Unassigned';
        counts[loc] = (counts[loc] || 0) + 1;
    });

    console.log("Audit counts by location:");
    console.log(counts);

    const latestAudits = {};
    allAuditRows.forEach(row => {
        const loc = row.loc_id || 'Unassigned';
        const t = row.timestamp;
        if (!latestAudits[loc] || t > latestAudits[loc]) {
            latestAudits[loc] = t;
        }
    });

    console.log("\nLatest audit timestamp by location:");
    console.log(latestAudits);
}

run();
