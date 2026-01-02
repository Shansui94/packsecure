
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing credentials in .env");
    process.exit(1);
}

const supabase = createClient(url, key);

async function listMachines() {
    console.log(`Connecting to ${url}...`);
    const { data, error } = await supabase
        .from('sys_machines_v2')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching machines:", error);
    } else {
        if (data && data.length > 0) {
            console.log("Columns found:", Object.keys(data[0]));
            // console.log("First Row:", data[0]);
        } else {
            console.log("Table is empty.");
        }
    }
}

listMachines();
