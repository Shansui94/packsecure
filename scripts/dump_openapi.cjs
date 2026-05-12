const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function dumpOpenApi() {
    const res = await fetch(process.env.VITE_SUPABASE_URL + '/rest/v1/', {
        headers: {
            'apikey': process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
        }
    });
    const data = await res.json();
    console.log("Found v2_inventory_view in OpenAPI?", !!data.definitions.v2_inventory_view);
    if (data.definitions.v2_inventory_view) {
        console.log(data.definitions.v2_inventory_view.description);
    }
}

dumpOpenApi();
