-- Migration to add extracted_do_number to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS extracted_do_number TEXT;
