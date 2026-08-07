import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const backupFilePath = 'scratch/backup_update_orders_20260803.json';
    if (!fs.existsSync(backupFilePath)) {
        console.error("Backup file not found!");
        return;
    }
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    const orderIds = backupData.orders.map(o => o.id);

    console.log(`Starting to complete ${orderIds.length} orders...`);

    const { data, error } = await supabase
        .from('sales_orders')
        .update({ status: 'Delivered' })
        .in('id', orderIds)
        .select('id, order_number');

    if (error) {
        console.error("Update failed:", error);
    } else {
        console.log(`Successfully completed ${data.length} orders to Delivered!`);
    }
}
run();
