const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    const babyUser = {
        id: '4477c368-c139-4cee-b30d-58dc7eba06c8',
        auth_user_id: '13827bb3-ff87-494c-aff4-c4a4e7152a69',
        employee_id: '0014'
    };

    console.log("=== Querying Sales Orders for Baby ===");
    // Let's check orders assigned to Baby (driver_id)
    const { data: babyOrders, error: err1 } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', babyUser.id)
        .order('created_at', { ascending: false });

    console.log(`Found ${babyOrders?.length || 0} orders with driver_id = ${babyUser.id}`);
    if (babyOrders) {
        babyOrders.forEach(o => {
            console.log(`- Order: ${o.order_number}, Status: ${o.status}, Factory: ${o.factory_id}, Items:`, JSON.stringify(o.items));
        });
    }

    console.log("\n=== Querying Sales Orders where items or factory has SPD/spd ===");
    const { data: allRecent, error: err2 } = await supabase
        .from('sales_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    const matches = [];
    if (allRecent) {
        allRecent.forEach(o => {
            const str = JSON.stringify(o).toLowerCase();
            if (str.includes('spd')) {
                matches.push(o);
            }
        });
    }

    console.log(`Found ${matches.length} recent orders containing 'spd':`);
    matches.forEach(o => {
        console.log(`- Order: ${o.order_number}, ID: ${o.id}, Status: ${o.status}, Driver: ${o.driver_id}, Factory: ${o.factory_id}, Items:`, JSON.stringify(o.items, null, 2));
    });
}

main().catch(console.error);
