const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkRpc() {
    const { data, error } = await supabase.rpc('get_live_stock_viewer');
    console.log("RPC Data sample:", data ? data.slice(0, 2) : error);
    
    // Get the function definition from postgres
    const { data: funcDef, error: funcErr } = await supabase.rpc('exec_sql', {
        query: "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_live_stock_viewer';"
    });
    console.log("Function Def:", funcDef || funcErr);
}

checkRpc();
