// Run: npx tsx scripts/create_production_schedule.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env from project root
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or key. Check .env / .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
    console.log('Creating production_schedule table...');

    const { error } = await supabase.rpc('exec_sql', {
        query: `
            CREATE TABLE IF NOT EXISTS production_schedule (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                machine_id TEXT NOT NULL,
                sku TEXT NOT NULL,
                target_qty INT NOT NULL DEFAULT 100,
                scheduled_time TIMESTAMPTZ,
                notes TEXT,
                status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In-Progress', 'Done', 'Cancelled')),
                created_by TEXT,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
        `
    });

    if (error) {
        // rpc might not exist, try direct insert to test if table exists
        console.log('RPC not available, testing table directly...');
        const { error: testError } = await supabase.from('production_schedule').select('id').limit(1);
        if (testError && testError.message.includes('does not exist')) {
            console.error('❌ Table does not exist. Please run the SQL in create_production_schedule.sql directly in Supabase Dashboard → SQL Editor.');
            console.log('\nSQL to run:');
            console.log(fs.readFileSync(path.resolve(__dirname, '..', 'create_production_schedule.sql'), 'utf-8'));
        } else if (testError) {
            console.error('Error:', testError.message);
        } else {
            console.log('✅ Table production_schedule already exists!');
        }
    } else {
        console.log('✅ Table created successfully!');
    }
}

main();
