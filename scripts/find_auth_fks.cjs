// Find all foreign key constraints referencing auth.users(id)
// Usage: node scripts/find_auth_fks.cjs

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    const { data, error } = await supabase.rpc('find_auth_user_fks');
    if (error) {
        // RPC not available, try direct query via REST
        console.log('RPC not found, trying another approach...');

        // List all tables with possible driver references by checking known tables
        const tables = ['driver_leave', 'lorry_service_requests', 'lorries', 'sales_orders', 'claims', 'users_public'];
        for (const table of tables) {
            const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
            console.log(`${table}: ${count} rows`);
        }
        return;
    }
    console.log('FK Constraints referencing auth.users:', data);
}

main().catch(console.error);
