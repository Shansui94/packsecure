import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  const supabase = createClient(url, serviceKey);

  console.log("Querying database constraints on sales_orders...");
  const { data, error } = await supabase.rpc('inspect_table_constraints', { table_name: 'sales_orders' });

  if (error) {
    console.log("inspect_table_constraints RPC not found. Executing generic SQL query via postgres check or rpc if available...");
    // Let's try to query pg_constraint using an RPC if one exists, or query a direct helper
    const { data: rawSqlRes, error: rawSqlErr } = await supabase.rpc('run_sql', { 
      sql_query: `
        SELECT conname, pg_get_constraintdef(c.oid) 
        FROM pg_constraint c 
        JOIN pg_class t ON t.oid = c.conrelid 
        WHERE t.relname = 'sales_orders'
      ` 
    });
    if (rawSqlErr) {
      console.error("RPC run_sql failed:", rawSqlErr);
      // Let's try attempting to insert a row with status 'Loaded' inside a transaction and rollback, or check if we get a status check constraint error
      console.log("Attempting a dummy insert with status = 'Loaded' to see if a constraint error is triggered...");
      const { data: insData, error: insErr } = await supabase
        .from('sales_orders')
        .insert({
          order_number: 'TEMP-TEST-LOADED',
          customer: 'Test',
          status: 'Loaded',
          items: []
        })
        .select();
      
      if (insErr) {
        console.log("Insert failed as expected if there is a constraint! Error details:", insErr);
      } else {
        console.log("Insert succeeded! That means 'Loaded' is allowed in the database schema. Inserted data:", insData);
        // Clean up the test row
        await supabase.from('sales_orders').delete().eq('order_number', 'TEMP-TEST-LOADED');
      }
    } else {
      console.log("Constraints:", rawSqlRes);
    }
  } else {
    console.log("Constraints:", data);
  }
}

run();
