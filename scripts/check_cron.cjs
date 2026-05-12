const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkCron() {
    const { data: createRPC, error: rpcErr } = await supabase.rpc('execute_sql', {
        query: `
            SELECT jobname, schedule, command 
            FROM cron.job;
        `
    });
    console.log("Cron check error:", rpcErr?.message);
}

checkCron();
