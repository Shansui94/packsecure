const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function clearSysCustomers() {
    console.log("Clearing sys_customers...");
    // A trick to delete all rows: neq an impossible UUID, or simply match anything.
    // For supabase, delete() without a filter throws an error. So we filter where id is not null.
    const { data, error } = await supabase
        .from('sys_customers')
        .delete()
        .not('id', 'is', null);

    if (error) {
        console.error("Error clearing sys_customers:", error);
    } else {
        console.log("Successfully cleared sys_customers table.");
        
        // Add one General Customer
        console.log("Adding General Customer...");
        const { error: insertError } = await supabase.from('sys_customers').insert({
            name: 'General Customer',
            zone: 'GENERAL',
            contact_person: 'Admin',
            address: 'Packsecure Logistics Route',
            phone: '-'
        });
        
        if (insertError) {
             console.error("Error inserting General Customer:", insertError);
        } else {
             console.log("Successfully added General Customer.");
        }
    }
}

clearSysCustomers();
