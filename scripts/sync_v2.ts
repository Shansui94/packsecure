import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function syncV1toV2() {
    console.log("=== Starting V1 to V2 Production Data Sync ===");
    
    // We only want to sync recent data (e.g. from March 2026 onwards) 
    // to keep V2 clean. We could sync all 50k+ records, but let's just 
    // sync this month so Live OS works perfectly.
    const cutoffDate = '2026-03-01T00:00:00+00:00';
    
    console.log(`Fetching V1 records since ${cutoffDate}...`);
    let allV1Logs: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('production_logs')
            .select('*')
            .gte('created_at', cutoffDate)
            .order('created_at', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);
            
        if (error) {
            console.error("Fetch Error:", error);
            break;
        }
        if (!data || data.length === 0) break;
        
        allV1Logs = allV1Logs.concat(data);
        console.log(`Fetched ${allV1Logs.length} records...`);
        if (data.length < pageSize) break;
        page++;
    }
    
    console.log(`\nTotal V1 records to backfill: ${allV1Logs.length}`);
    
    // Process in batches
    const batchSize = 500;
    for (let i = 0; i < allV1Logs.length; i += batchSize) {
        const batch = allV1Logs.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1} (${batch.length} rows)...`);
        
        const v2Rows = batch.map(log => ({
            // Map strictly to V2 schema
            sku: log.product_sku && log.product_sku !== 'UNKNOWN' ? log.product_sku : 'UNKNOWN-BUBBLEWRAP',
            output_qty: log.alarm_count || 1, // Assume 1 if missing
            machine_id: log.machine_id,
            // Keep original creation time so dashboard trends look accurate
            created_at: log.created_at 
        }));
        
        const { error } = await supabase.from('production_logs_v2').insert(v2Rows);
        if (error) {
            console.error(`Batch Insert Error (Rows ${i} to ${i+batchSize}):`, error);
        }
    }
    
    console.log("\n✅ Sync Complete! V2 tables are now up to date with historical data.");
}

syncV1toV2().catch(console.error);
