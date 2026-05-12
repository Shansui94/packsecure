const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function findDuplicates() {
    const { data: duplicates, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('notes', 'Auto-deduct: Order Created')
        .gte('timestamp', new Date().toISOString().split('T')[0]); // created today or future
        
    console.log("Found", duplicates?.length || 0, "duplicate 'Auto-deduct: Order Created' entries that need deletion.");
}

findDuplicates();
