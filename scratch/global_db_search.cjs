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
  'delivery_orders',
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
  'trips',
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
  'factory_zone_layout_revisions',
  'payroll_records',
  'notes',
  'work_photos',
  'production_metrics_calibration',
  'production_material_inputs',
  'attendance',
  'recipes'
];

async function main() {
    console.log("=== STARTING GLOBAL SEARCH FOR 'spd' or 'SPD' or 'opm' ===");
    for (const tableName of tables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(200); // look at recent 200 rows of each table

            if (error) {
                // table might not exist or no permission
                continue;
            }

            if (!data || data.length === 0) continue;

            const matches = [];
            for (const row of data) {
                const rowStr = JSON.stringify(row).toLowerCase();
                // Check if row matches the keyword "spd" (and not part of another word if possible, but simple inclusion is fine)
                // Let's also check if it contains Baby's id or username if we want, but "spd" is very specific.
                if (rowStr.includes('"spd"') || rowStr.includes(': "spd"') || rowStr.includes('spd') || rowStr.includes('opm')) {
                    // Let's filter out long system fields or SOP articles unless they explicitly mention spd location
                    if (tableName === 'sop_articles' || tableName === 'dev_logs') continue;
                    matches.push(row);
                }
            }

            if (matches.length > 0) {
                console.log(`\n🔍 Found match in table "${tableName}":`);
                matches.forEach(m => {
                    console.log(JSON.stringify(m, null, 2));
                });
            }
        } catch (err) {
            // ignore
        }
    }
    console.log("\n=== SEARCH COMPLETED ===");
}

main().catch(console.error);
