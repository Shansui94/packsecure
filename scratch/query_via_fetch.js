import dotenv from 'dotenv';
dotenv.config();

const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
    console.log("Calling exec_sql via fetch directly...");
    const query = `
        SELECT 
            tgname as trigger_name,
            tgenabled as enabled,
            pg_get_triggerdef(oid) as trigger_definition
        FROM pg_trigger 
        WHERE tgrelid = 'public.sales_orders'::regclass;
    `;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'apikey': key,
        },
        body: JSON.stringify({
            sql: query
        })
    });

    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text);
}

run();
