import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    const result: any = {};

    const { data: active } = await supabase
        .from('machine_active_products')
        .select('lane_id, product_sku, yield, updated_at')
        .eq('machine_id', 'T1.2-M01')
        .order('lane_id');
    result.active_lanes = active;

    const skuChecks: any[] = [];
    for (const r of (active || [])) {
        if (!r.product_sku) { skuChecks.push({ sku: null, found: false }); continue; }
        const { data: item } = await supabase.from('master_items_v2').select('sku,name,status').eq('sku', r.product_sku).maybeSingle();
        skuChecks.push({ sku: r.product_sku, found: !!item, name: item?.name, status: item?.status });
    }
    result.sku_checks = skuChecks;

    const { data: ub } = await supabase.from('master_items_v2').select('sku').eq('sku', 'UNKNOWN-BUBBLEWRAP').maybeSingle();
    result.unknown_bubblewrap_exists = !!ub;

    const { data: logs } = await supabase
        .from('production_logs')
        .select('lane_id, product_sku, alarm_count, created_at')
        .eq('machine_id', 'T1.2-M01')
        .order('created_at', { ascending: false })
        .limit(5);
    result.recent_logs = logs;

    const out = JSON.stringify(result, null, 2);
    fs.writeFileSync('scripts/_sku_result.json', out, 'utf8');
    process.stdout.write(out + '\n');
}

run().catch(e => { console.error(e); process.exit(1); });
