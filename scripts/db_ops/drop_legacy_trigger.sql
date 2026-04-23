-- ==========================================
-- Fix Double Deduction in Sales Orders
-- Purpose: Drop the legacy trigger that was double deducting stock
-- ==========================================

DROP TRIGGER IF EXISTS auto_deduct_stock_on_order ON public.sales_orders;
DROP FUNCTION IF EXISTS public.deduct_stock_on_order();

-- Note: The new trigger "on_sales_order_sync" which uses "public.sync_order_inventory()" will remain active.
