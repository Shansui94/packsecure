-- Fix RLS: Allow Drivers to Insert Pick Up tracking records into sales_orders
CREATE POLICY "Enable insert for authenticated users" ON "public"."sales_orders"
FOR INSERT
TO authenticated
WITH CHECK (true);
