-- ==========================================
-- Migration: 20260904_update_order_sync_trigger.sql
-- Purpose: Unified Single Source of Truth (SSOT) for Order Inventory Deductions
--          1. Includes 'Pending Approval', 'Loaded', 'In-Transit', 'Delivered' in has_left.
--          2. Strictly respects item sourceLocation/location without TAIPING->SPD fallback.
--          3. Automatically reverses stock on Cancelled or reset to New.
--          4. Adjusts deltas when driver amends quantities while remaining in has_left.
-- ==========================================

-- 1. Drop old triggers to prevent double-deductions
DROP TRIGGER IF EXISTS sync_order_inventory_trigger ON public.sales_orders;
DROP TRIGGER IF EXISTS on_sales_order_stock_trigger ON public.sales_orders;
DROP TRIGGER IF EXISTS on_delivery_completed ON public.sales_orders;

-- 2. Drop old functions
DROP FUNCTION IF EXISTS public.sync_order_inventory() CASCADE;
DROP FUNCTION IF EXISTS public.handle_sales_order_stock_trigger() CASCADE;

-- 3. Create the updated Bulletproof function
CREATE OR REPLACE FUNCTION public.sync_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    item_sku TEXT;
    item_qty NUMERIC;
    item_loc TEXT;
    status_changed BOOLEAN := FALSE;
    items_changed BOOLEAN := FALSE;
    old_has_left BOOLEAN := FALSE;
    new_has_left BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        status_changed := (OLD.status IS DISTINCT FROM NEW.status);
        items_changed := (OLD.items IS DISTINCT FROM NEW.items);
        old_has_left := (OLD.status IN ('Loaded', 'Pending Approval', 'In-Transit', 'Delivered'));
        new_has_left := (NEW.status IN ('Loaded', 'Pending Approval', 'In-Transit', 'Delivered'));
    ELSIF TG_OP = 'INSERT' THEN
        new_has_left := (NEW.status IN ('Loaded', 'Pending Approval', 'In-Transit', 'Delivered'));
    END IF;

    -- ==========================================
    -- LOGIC 1: PHYSICAL DEDUCTION (Entering Loaded/Pending Approval/Delivered)
    -- Triggered when an order transitions from NOT left to HAS left.
    -- ==========================================
    IF (TG_OP = 'INSERT' AND new_has_left) OR 
       (TG_OP = 'UPDATE' AND status_changed AND NOT old_has_left AND new_has_left) 
    THEN
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := COALESCE((item.value->>'quantity')::NUMERIC, (item.value->>'qty')::NUMERIC, 0);
                
                -- Determine location strictly: sourceLocation > location > 'Unassigned'
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN 
                    item_loc := NULLIF(TRIM(item.value->>'location'), ''); 
                END IF;
                IF item_loc IS NULL OR item_loc = '' THEN 
                    item_loc := 'Unassigned'; 
                END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 'Transfer Out', item_sku, -item_qty, item_loc, 
                        'Auto-deduct: Order ' || NEW.status, COALESCE(NEW.order_number, 'DO-' || NEW.id::TEXT)
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ==========================================
    -- LOGIC 2: ABSOLUTE REFUND (Leaving Loaded/Pending Approval/Delivered)
    -- Triggered if status changes from HAS left to NOT left (e.g. Cancelled, New).
    -- ==========================================
    IF (TG_OP = 'UPDATE' AND status_changed AND old_has_left AND NOT new_has_left) THEN
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := COALESCE((item.value->>'quantity')::NUMERIC, (item.value->>'qty')::NUMERIC, 0);
                
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN 
                    item_loc := NULLIF(TRIM(item.value->>'location'), ''); 
                END IF;
                IF item_loc IS NULL OR item_loc = '' THEN 
                    item_loc := 'Unassigned'; 
                END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 'Transfer In', item_sku, item_qty, item_loc, 
                        'Auto-refund: Status Reverted from ' || OLD.status, COALESCE(OLD.order_number, 'DO-' || OLD.id::TEXT)
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ==========================================
    -- LOGIC 3: ITEM MODIFICATION CORRECTION (While staying in has_left)
    -- If items (quantity/sku) are updated while the order has already left.
    -- We refund the old snapshot, and deduct the new snapshot.
    -- ==========================================
    IF (TG_OP = 'UPDATE' AND old_has_left AND new_has_left AND items_changed) THEN
        -- Step 3a: Refund all OLD items
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := COALESCE((item.value->>'quantity')::NUMERIC, (item.value->>'qty')::NUMERIC, 0);
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN 
                    item_loc := NULLIF(TRIM(item.value->>'location'), ''); 
                END IF;
                IF item_loc IS NULL OR item_loc = '' THEN 
                    item_loc := 'Unassigned'; 
                END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 'Transfer In', item_sku, item_qty, item_loc, 
                        'Correction: Refund Old Items', COALESCE(OLD.order_number, 'DO-' || OLD.id::TEXT)
                    );
                END IF;
            END LOOP;
        END IF;

        -- Step 3b: Deduct all NEW items
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := COALESCE((item.value->>'quantity')::NUMERIC, (item.value->>'qty')::NUMERIC, 0);
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN 
                    item_loc := NULLIF(TRIM(item.value->>'location'), ''); 
                END IF;
                IF item_loc IS NULL OR item_loc = '' THEN 
                    item_loc := 'Unassigned'; 
                END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 'Transfer Out', item_sku, -item_qty, item_loc, 
                        'Correction: Deduct New Items', COALESCE(NEW.order_number, 'DO-' || NEW.id::TEXT)
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the final trigger
CREATE TRIGGER sync_order_inventory_trigger
AFTER INSERT OR UPDATE OF status, items
ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_inventory();
