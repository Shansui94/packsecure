import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. 获取 sales_orders 的一条记录，查看其所有的 keys 
    const { data: record, error } = await supabase
        .from('sales_orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching sales_orders sample:", error);
    } else {
        console.log("sales_orders columns:", Object.keys(record[0]));
        console.log("Sample sales_orders record:", record[0]);
    }
}

run();
