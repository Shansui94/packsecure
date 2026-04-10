import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    const sql = `
        ALTER TABLE sales_orders
        ADD COLUMN IF NOT EXISTS proof_of_load_url TEXT,
        ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'Delivery';

        UPDATE sales_orders SET job_type = 'Delivery' WHERE job_type IS NULL;
    `;

    console.log("Running migration...");
    // Often there's an exec_sql RPC, let's try
    const { error: rpcError } = await supabase.rpc('exec_sql', { query: sql }).catch(()=>({error: "rpc missing"}));
    
    if (rpcError) {
        console.log("RPC exec_sql failed or missing", rpcError);
        // Fallback: If no RPC, I can't run raw DDL via supabase-js easily.
        // Let's hope exec_sql exists. 
    } else {
        console.log("Migration successful!");
    }
}
run();
