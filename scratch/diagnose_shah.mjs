import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShah() {
    console.log('=== Checking user/driver SHAH ===');
    
    // 1. Search in users_public
    const { data: users, error: uErr } = await supabase
        .from('users_public')
        .select('*')
        .ilike('name', '%shah%');
    console.log('users_public matches:', users, uErr);

    // 2. Search in sys_users_v2
    const { data: v2Users, error: v2Err } = await supabase
        .from('sys_users_v2')
        .select('*')
        .ilike('name', '%shah%');
    console.log('sys_users_v2 matches:', v2Users, v2Err);

    // 3. Search in lorries / vehicles
    const { data: lorries, error: lorryErr } = await supabase
        .from('sys_lorries_v2')
        .select('*')
        .ilike('driver_name', '%shah%');
    console.log('sys_lorries_v2 matches:', lorries, lorryErr);

    // 4. Search in sales_orders for driver name or notes with shah
    const { data: ordersByName, error: obnErr } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer, status, driver_id, zone, trip_origin, notes, created_at')
        .or('notes.ilike.%shah%,customer.ilike.%shah%')
        .order('created_at', { ascending: false })
        .limit(20);
    console.log('sales_orders containing "shah" in notes/customer:', ordersByName, obnErr);

    if (users && users.length > 0) {
        for (const shah of users) {
            console.log('\n----------------------------------------');
            console.log('Diagnosing user:', shah.id, shah.name, shah.email, shah.role, shah.status, 'base_location:', shah.base_location, 'factoryId:', shah.factoryId, 'employee_id:', shah.employee_id);

            // Check orders assigned to shah.id or shah.employee_id
            const { data: shahOrders, error: soErr } = await supabase
                .from('sales_orders')
                .select('*')
                .eq('driver_id', shah.id);
            console.log(`Orders with driver_id === ${shah.id}:`, shahOrders?.length, soErr);
            if (shahOrders && shahOrders.length > 0) {
                console.log('Shah Orders details:', shahOrders.map(o => ({
                    id: o.id,
                    order_number: o.order_number,
                    customer: o.customer,
                    status: o.status,
                    zone: o.zone,
                    trip_origin: o.trip_origin,
                    delivery_address: o.delivery_address,
                    pod_timestamp: o.pod_timestamp,
                    pod_signature_url: !!o.pod_signature_url,
                    proof_of_load_url: !!o.proof_of_load_url,
                    preparation_photo_url: !!o.preparation_photo_url
                })));
            }

            // Check activity logs
            const { data: logs, error: lErr } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('user_id', shah.id)
                .order('created_at', { ascending: false })
                .limit(20);
            console.log('Shah Activity Logs:', logs, lErr);

            // Check audit logs
            const { data: audit, error: aErr } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('user_id', shah.id)
                .order('created_at', { ascending: false })
                .limit(20);
            console.log('Shah Audit Logs:', audit, aErr);
        }
    }
}

checkShah();
