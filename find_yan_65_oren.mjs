import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(url, serviceKey);

  let output = "=== SEARCH FOR YAN 65 OREN ORDER ===\n\n";
  output += "Searching for orders since 2026-06-08...\n";
  
  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select('*')
    .gte('created_at', '2026-06-08T00:00:00Z')
    .order('created_at', { ascending: false });

  if (error) {
    output += `Error fetching orders: ${JSON.stringify(error)}\n`;
    fs.writeFileSync('find_yan_65_oren.txt', output);
    return;
  }

  output += `Found ${orders.length} recent orders in the database.\n`;

  const matches = [];

  orders.forEach(o => {
    // Check if it belongs to yan
    const isYan = o.driver_id === '06198eb2-7902-4f25-999c-ce00ea0ed037';
    
    // Check items for qty 65 or "oren"
    let has65 = false;
    let hasOren = false;
    let orenQty = 0;
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(item => {
        const productStr = String(item.product || item.sku || '').toLowerCase();
        const qty = Number(item.quantity);
        if (qty === 65) has65 = true;
        if (productStr.includes('oren') || productStr.includes('orange')) {
          hasOren = true;
          orenQty = qty;
        }
      });
    }

    if (isYan || has65 || hasOren) {
      matches.push({ order: o, isYan, has65, hasOren, orenQty });
    }
  });

  output += `\nFound ${matches.length} candidate matching orders:\n`;
  matches.forEach(({ order: o, isYan, has65, hasOren, orenQty }, index) => {
    output += `\n${index + 1}. Order: ${o.order_number}\n`;
    output += `   ID: ${o.id}\n`;
    output += `   Matches: Driver yan? ${isYan} | Has 65 Qty? ${has65} | Has Oren SKU? ${hasOren} (Qty: ${orenQty})\n`;
    output += `   Status: ${o.status}\n`;
    output += `   Origin: ${o.trip_origin} | Destination: ${o.trip_destination}\n`;
    output += `   Date: ${o.order_date} | Deadline: ${o.deadline}\n`;
    output += `   CreatedAt: ${o.created_at}\n`;
    output += `   Items: ${JSON.stringify(o.items)}\n`;
  });

  fs.writeFileSync('find_yan_65_oren.txt', output);
  console.log("Successfully wrote output to find_yan_65_oren.txt");
}

run();
