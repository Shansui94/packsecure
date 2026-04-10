import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDO() {
    const doNumber = 'DO-2026-0265';
    let report = `Checking DO: ${doNumber}\n`;
    
    const { data: orderData } = await supabase.from('sales_orders')
        .select('*')
        .eq('order_number', doNumber)
        .single();
        
    if (orderData) {
        report += `\n=== SALES ORDER ===\n`;
        report += `Created At: ${new Date(orderData.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })}\n`;
        report += `Order Date: ${orderData.order_date}\n`;
        report += `Driver ID: ${orderData.driver_id}\n`;
        report += `Status: ${orderData.status}\n`;
        report += `Delivery Address: ${orderData.delivery_address}\n`;
        if (orderData.pod_timestamp) {
            report += `POD (Delivered) Timestamp: ${new Date(orderData.pod_timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })}\n`;
        }
    } else {
        report += 'Order not found in sales_orders\n';
    }

    fs.writeFileSync('do_0265_details.txt', report);
}

checkDO();
