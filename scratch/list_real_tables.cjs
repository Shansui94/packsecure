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
    console.log("=== CHECKING TABLE EXISTENCE AND ROW COUNT ===");
    for (const t of tables) {
        try {
            const { count, error } = await supabase
                .from(t)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                // Table does not exist or permission denied
            } else {
                console.log(`Table: ${t} -> Count: ${count}`);
            }
        } catch (err) {
            // ignore
        }
    }
}

main().catch(console.error);
