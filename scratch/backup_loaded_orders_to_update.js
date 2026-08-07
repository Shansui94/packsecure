import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function backup() {
    const cutOffTime = '2026-07-28T04:00:00.000Z'; // 2026-07-28 12:00:00+08:00

    console.log(`Backing up Loaded orders with updated_at < ${cutOffTime}...`);

    const { data: loadedOrders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, driver_id, status, updated_at')
        .eq('status', 'Loaded')
        .lt('updated_at', cutOffTime)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Backup query failed:", error);
        return;
    }

    const backupData = {
        generated_at: new Date().toISOString(),
        cut_off_time: cutOffTime,
        orders_count: loadedOrders.length,
        orders: loadedOrders.map(o => ({
            id: o.id,
            order_number: o.order_number,
            driver_id: o.driver_id,
            original_status: o.status,
            updated_at: o.updated_at
        }))
    };

    const filePath = 'scratch/backup_update_orders_20260728.json';
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    console.log(`Backup saved to ${filePath}`);
    console.log(`Total orders backed up: ${loadedOrders.length}`);
}

backup();
