-- Add delivery_method column to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'Company Delivery';

-- Optional: For existing orders that have 'Customer Pick Up' in driver_id (if any were created),
-- update their delivery_method and set driver_id to null
-- Since driver_id is UUID, 'Customer Pick Up' wouldn't have been inserted.
