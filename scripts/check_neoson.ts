import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Use the Management API to drop the FK constraint
// Supabase allows running SQL via the REST /rest/v1/rpc endpoint if we have a function
// Alternative: use the pg client with the connection string from env

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.VITE_SERVICE_ROLE_KEY!;

async function dropFK() {
    console.log('=== 通过 Supabase Management API 删除 FK 约束 ===');

    // Use the Supabase query endpoint directly
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
        },
        body: JSON.stringify({
            sql: 'ALTER TABLE machine_active_products DROP CONSTRAINT IF EXISTS machine_active_products_product_sku_fkey;'
        })
    });

    if (response.ok) {
        console.log('✅ FK 约束已删除！');
        return;
    }

    console.log('exec_sql 不可用，状态:', response.status);
    console.log('请在 Supabase SQL Editor 手动执行以下 SQL：');
    console.log('');
    console.log('ALTER TABLE machine_active_products DROP CONSTRAINT IF EXISTS machine_active_products_product_sku_fkey;');
    console.log('');
    console.log('网址：https://supabase.com/dashboard/project/kdahubyhwndgyloaljak/sql/new');
}

dropFK().catch(console.error);
