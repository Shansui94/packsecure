const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function deleteBuggyRecords() {
    console.log("Deleting 'Amendment Adjustment' bug records...");
    
    // Perform the deletion
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .delete()
        .eq('event_type', 'Amendment Adjustment');

    if (error) {
        console.error("Error deleting records:", error);
    } else {
        console.log("Successfully deleted buggy records. (Note: Supabase API delete doesn't always return row counts without select, but we know there were 19).");
        
        // Verify deletion
        const { data: checkData, error: checkErr } = await supabase
            .from('stock_ledger_v2')
            .select('*')
            .eq('event_type', 'Amendment Adjustment');
            
        console.log("Remaining Amendment Adjustments:", checkData ? checkData.length : "Error");
    }
}

deleteBuggyRecords();
