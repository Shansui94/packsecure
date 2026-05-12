const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function undoDisaster() {
    console.log("CRITICAL EMERGENCY: Undoing the fake restoration with SERVICE_ROLE_KEY...");
    
    const { data, error, count } = await supabase
        .from('stock_ledger_v2')
        .delete()
        .eq('notes', 'Auto-deduct: RESTORED')
        .select('*');
        
    if (error) {
        console.error("Failed to undo", error);
    } else {
        console.log(`✅ UNDO COMPLETE! Deleted ${data.length} fake restored records.`);
    }
}

undoDisaster();
