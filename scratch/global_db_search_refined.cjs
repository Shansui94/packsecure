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

const tables = [
  'sop_articles',
  'user_activity_logs',
  'machine_active_products',
  'production_logs',
  'sales_orders',
  'employee_leave',
  'sys_users_v2',
  'claims',
  'product_aliases_v2',
  'production_logs_v2',
  'iot_device_configs',
  'users_public',
  'sys_machines_v2',
  'salary_advances',
  'machine_schedules',
  'master_items_v2',
  'stock_ledger_v2',
  'sys_locations_v2',
  'users',
  'user_roles',
  'role_permissions',
  'lorry_mileage_logs',
  'operator_attendance',
  'master_machines_v2',
  'lorry_service_requests',
  'driver_leave',
  'lorries',
  'sys_customers',
  'sales_order_items_v2',
  'machines',
  'machine_rates',
  'payroll_drafts',
  'inventory',
  'job_orders',
  'sys_vehicles',
  'simple_stock',
  'production_schedule',
  'bom_headers_v2',
  'bom_items_v2',
  'sys_factories_v2',
  'factory_inventory',
  'sys_locations',
  'locations',
  'profiles',
  'sys_users',
  'sys_clients',
  'stock_ledger',
  'delivery_rates',
  'driver_shifts',
  'sys_user_modules',
  'items',
  'master_items',
  'sys_machines',
  'tasks',
  'receipts',
  'dev_logs',
  'lorry_mileage_alerts',
  'management_reports',
  'factory_zones',
  'factory_zone_items',
  'payroll_records',
  'notes',
  'work_photos',
  'production_metrics_calibration',
  'production_material_inputs',
  'attendance',
  'recipes'
];

async function main() {
    console.log("=== STARTING REFINED GLOBAL SEARCH ===");
    for (const tableName of tables) {
        try {
            // Find recent rows (up to 500)
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(500);

            if (error) continue;
            if (!data || data.length === 0) continue;

            const matches = [];
            for (const row of data) {
                const rowStr = JSON.stringify(row).toLowerCase();
                // We want to find cases where it has "spd" (like location 'spd' or 'SPD')
                // and "baby" (operator_id = '0014' / '4477c368-c139-4cee-b30d-58dc7eba06c8' / name 'Baby' or similar)
                if (rowStr.includes('spd') && (rowStr.includes('baby') || rowStr.includes('0014') || rowStr.includes('13827bb3') || rowStr.includes('4477c368'))) {
                    matches.push(row);
                } else if (rowStr.includes('spd') && tableName === 'operator_attendance') {
                    matches.push(row);
                }
            }

            if (matches.length > 0) {
                console.log(`\n🔍 Found match in table "${tableName}":`);
                console.log(JSON.stringify(matches, null, 2));
            }
        } catch (err) {
            // ignore
        }
    }
    console.log("\n=== REFINED SEARCH COMPLETED ===");
}

main().catch(console.error);
