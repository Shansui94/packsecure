import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function investigate() {
    console.log("=== Looking up drivers: Dean & Ameer ===");
    const { data: users } = await supabase
        .from('sys_users_v2')
        .select('name, auth_user_id, employee_id, role')
        .or('name.ilike.%dean%,name.ilike.%ameer%');

    if (!users || users.length === 0) { console.log("No users found."); return; }
    users.forEach(u => console.log(`  ${u.name} | EID: ${u.employee_id} | UID: ${u.auth_user_id}`));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split('T')[0];

    for (const driver of users) {
        if (!driver.auth_user_id) continue;
        console.log(`\n=== Orders for ${driver.name} (since ${cutoff}) ===`);
        
        const { data: orders, error } = await supabase
            .from('sales_orders')
            .select('id, order_number, status, order_date, created_at, delivery_address, zone, trip_origin, driver_id, customer')
            .eq('driver_id', driver.auth_user_id)
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false });

        if (error) { console.error("Query error:", error); continue; }
        
        console.log(`  Found ${orders?.length || 0} orders:`);
        orders?.forEach((o, i) => {
            console.log(`  ${i+1}. [${o.order_number}] Status: ${o.status} | Customer: ${o.customer} | OrderDate: ${o.order_date} | Dest: ${o.zone || o.delivery_address || 'null'} | Created: ${o.created_at}`);
        });
    }

    // Check for cancelled/deleted orders in last 3 days
    console.log("\n=== All CANCELLED orders in last 7 days ===");
    const { data: cancelled } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, customer, driver_id, created_at, order_date')
        .eq('status', 'Cancelled')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });
    
    const driverMap: Record<string, string> = {};
    users.forEach(u => { if (u.auth_user_id) driverMap[u.auth_user_id] = u.name; });

    console.log(`  Found ${cancelled?.length || 0} cancelled orders:`);
    cancelled?.forEach((o, i) => {
        const dName = driverMap[o.driver_id] || o.driver_id?.substring(0, 8) || 'UNKNOWN';
        console.log(`  ${i+1}. [${o.order_number}] Customer: ${o.customer} | Driver: ${dName} | Created: ${o.created_at}`);
    });

    // Check today's orders
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n=== All orders created TODAY (${today}) ===`);
    const { data: todayOrders } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, customer, driver_id, created_at, order_date, zone, trip_origin')
        .gte('created_at', today)
        .order('created_at', { ascending: false });
    
    // Get all driver names for today's orders
    const allDriverIds = [...new Set((todayOrders || []).map(o => o.driver_id).filter(Boolean))];
    const { data: allDrivers } = await supabase.from('sys_users_v2').select('name, auth_user_id').in('auth_user_id', allDriverIds);
    const fullDriverMap: Record<string, string> = {};
    allDrivers?.forEach(d => { if (d.auth_user_id) fullDriverMap[d.auth_user_id] = d.name; });
    
    console.log(`  Found ${todayOrders?.length || 0} orders created today:`);
    todayOrders?.forEach((o, i) => {
        const dName = fullDriverMap[o.driver_id] || o.driver_id?.substring(0, 8) || 'NO DRIVER';
        console.log(`  ${i+1}. [${o.order_number}] Status: ${o.status} | Customer: ${o.customer} | Driver: ${dName} | Origin: ${o.trip_origin || 'null'} | Dest: ${o.zone || 'null'} | Created: ${o.created_at}`);
    });
}

investigate().catch(console.error);
