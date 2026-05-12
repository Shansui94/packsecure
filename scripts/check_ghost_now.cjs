const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkGhostNow() {
    const tenMinsAgo = new Date(Date.now() - 20 * 60000).toISOString();
    const { data: ghosts } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .gte('timestamp', tenMinsAgo)
        .like('notes', '%Order Created%');
        
    console.log("Recent Ghost:", ghosts);
}

checkGhostNow();
