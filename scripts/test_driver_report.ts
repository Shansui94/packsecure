import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testDriver() {
    const { data: users, error: userErr } = await supabase
        .from('sys_users_v2')
        .select('*')
        .ilike('name', '%Ayam%');
    
    if (userErr) return console.error(userErr);
    if (!users || users.length === 0) return console.log("No user named Ayam found.");

    const ayam = users[0];
    const results = {
        ayamInfo: ayam,
        withAuthCount: 0,
        withEmpCount: 0,
        withNameCount: 0,
        sample: []
    };

    const { data: o1 } = await supabase.from('sales_orders').select('id, driver_id').eq('driver_id', ayam.auth_user_id);
    results.withAuthCount = o1?.length || 0;

    const { data: o2 } = await supabase.from('sales_orders').select('id, driver_id').eq('driver_id', ayam.employee_id);
    results.withEmpCount = o2?.length || 0;

    const { data: o3 } = await supabase.from('sales_orders').select('id, driver_id').ilike('driver_id', '%Ayam%');
    results.withNameCount = o3?.length || 0;

    if (o1 && o1.length > 0) results.sample = o1.slice(0, 3);
    else if (o2 && o2.length > 0) results.sample = o2.slice(0, 3);
    else if (o3 && o3.length > 0) results.sample = o3.slice(0, 3);

    // Let's also check distinct driver_id in sales_orders
    const { data: distinct } = await supabase.rpc('get_unique_drivers') || await supabase.from('sales_orders').select('driver_id').limit(10);
    
    fs.writeFileSync('test_out.json', JSON.stringify({ ...results, test10: distinct }, null, 2));
}

testDriver();
