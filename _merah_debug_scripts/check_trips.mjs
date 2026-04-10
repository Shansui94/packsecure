import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrips() {
    const targetDate = '2026-03-31';
    
    // Fetch users mapped by ID
    const { data: usersResponse } = await supabase.from('users_public').select('id, name');
    const usersMap = {};
    if (usersResponse) {
        usersResponse.forEach(u => usersMap[u.id] = (u.name || '').toLowerCase());
    }

    // Since users might create DO yesterday for today, we check both order_date and deadline
    // Actually, let's just fetch everything delivered today or created in the last 2 days
    const { data: orders, error } = await supabase.from('sales_orders')
        .select('*')
        .gte('created_at', '2026-03-29T00:00:00.000Z')
        .neq('status', 'Cancelled');

    let report = '';
    
    if (orders) {
        // We only care about orders related to these specific names
        const targetNames = ['yashin', 'ameer', 'dean', 'alif', 'wan', 'taufik', 'faizal'];
        
        let driverTrips = {};

        orders.forEach(o => {
            const driverName = usersMap[o.driver_id] || 'unknown';
            let matchedName = targetNames.find(n => driverName.includes(n));
            
            // The message says "31/3 tue". So either created on 31/3, or deadline 31/3, or order_date 31/3
            // Also some might be 30/3 night trips
            if (matchedName && (o.order_date?.includes('03-31') || o.order_date?.includes('03-30') || o.deadline?.includes('03-31') || o.created_at.includes('03-31'))) {
                if (!driverTrips[matchedName]) driverTrips[matchedName] = [];
                driverTrips[matchedName].push(o);
            }
        });

        Object.keys(driverTrips).forEach(name => {
            report += `\n====== DRIVER: ${name.toUpperCase()} ======\n`;
            driverTrips[name].forEach(t => {
                report += `[DO: ${t.order_number}] (Status: ${t.status}) Date: ${t.order_date} | Dest: ${t.delivery_address} / ${t.zone}\n`;
                if (t.items) {
                    t.items.forEach(i => {
                         report += `    ${i.product} (SKU: ${i.sku}): ${i.quantity}\n`;
                    });
                }
            });
        });
    }

    fs.writeFileSync('manual_vs_system.txt', report);
}

checkTrips();
