const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function findCreator() {
    const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .like('details', '%DO-Mahadi-260209-003%')
        .limit(5);
        
    console.log("Logs:", logs);
}

findCreator();
