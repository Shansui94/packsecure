const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function undoDisaster() {
    console.log("CRITICAL EMERGENCY: Undoing the fake restoration...");
    
    const { error } = await supabase
        .from('stock_ledger_v2')
        .delete()
        .eq('notes', 'Auto-deduct: RESTORED');
        
    if (error) {
        console.error("Failed to undo", error);
    } else {
        console.log("✅ UNDO COMPLETE! The fake restored records are gone.");
    }
}

undoDisaster();
