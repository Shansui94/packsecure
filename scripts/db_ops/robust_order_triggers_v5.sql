-- ==========================================
-- V5: PHYSICAL REALITY INVENTORY SYSTEM
-- ==========================================
-- This trigger strictly manages the physical ledger (stock_ledger_v2).
-- Stock is ONLY deducted when an order is marked as 'Delivered' (Loaded).
-- Pending orders (New, Production, Ready) are IGNORED by this trigger.
-- They will be handled virtually by the frontend to prevent overselling.

-- 1. Obliterate all known old triggers to prevent double-deductions 
DROP TRIGGER IF EXISTS "auto_deduct_stock_on_order" ON public.sales_orders;
DROP TRIGGER IF EXISTS auto_deduct_stock_on_order ON public.sales_orders;
DROP TRIGGER IF EXISTS "auto_refund_stock_on_cancel" ON public.sales_orders;
DROP TRIGGER IF EXISTS auto_refund_stock_on_cancel ON public.sales_orders;
DROP TRIGGER IF EXISTS "update_delivery_trigger" ON public.sales_orders;
DROP TRIGGER IF EXISTS update_delivery_trigger ON public.sales_orders;
DROP TRIGGER IF EXISTS "update_delivery_trigger_v2" ON public.sales_orders;
DROP TRIGGER IF EXISTS update_delivery_trigger_v2 ON public.sales_orders;
-- Drop V4 triggers if they exist with custom names
DROP TRIGGER IF EXISTS "sync_order_inventory_trigger" ON public.sales_orders;
DROP TRIGGER IF EXISTS sync_order_inventory_trigger ON public.sales_orders;

-- 2. Drop the old function so we can replace it cleanly
DROP FUNCTION IF EXISTS public.sync_order_inventory() CASCADE;

-- 3. Create the Physical-Only function
CREATE OR REPLACE FUNCTION public.sync_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    item_sku TEXT;
    item_qty NUMERIC;
    item_loc TEXT;
    status_changed BOOLEAN;
BEGIN
    -- Determine if status actually changed during an update
    IF TG_OP = 'UPDATE' THEN
        status_changed := (OLD.status IS DISTINCT FROM NEW.status);
    END IF;

    -- ==========================================
    -- LOGIC 1: PHYSICAL DEDUCTION (Loaded / Delivered)
    -- ==========================================
    -- Only deduct when the goods physically leave the warehouse
    IF (TG_OP = 'INSERT' AND NEW.status = 'Delivered') OR 
       (TG_OP = 'UPDATE' AND status_changed AND NEW.status = 'Delivered') 
    THEN
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN
                    item_loc := 'no location';
                END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 
                        'Transfer Out', 
                        item_sku, 
                        -item_qty, 
                        item_loc, 
                        'Auto-deduct: Order Delivered', 
                        NEW.order_number
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ==========================================
    -- LOGIC 2: REFUND CANCELLATION (If it was already Delivered)
    -- ==========================================
    -- If goods were already Delivered (deducted) but then cancelled/unfulfilled, we must refund them physically
    IF (TG_OP = 'UPDATE' AND status_changed AND NEW.status IN ('Cancelled', 'Unfulfilled') AND OLD.status = 'Delivered') THEN
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN
                    item_loc := 'no location';
                END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 
                        'Transfer In', 
                        item_sku, 
                        item_qty, 
                        item_loc, 
                        'Auto-refund: Order Cancelled', 
                        OLD.order_number
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- Return NEW for normal operations
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the final clean trigger
CREATE TRIGGER sync_order_inventory_trigger
AFTER INSERT OR UPDATE OF status, items
ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_inventory();
