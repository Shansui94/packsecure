-- ==========================================
-- Migration: 20260914_safe_inventory_trigger_fkey_protection.sql
-- Purpose: Protect driver app & sales orders from foreign key constraint violations on stock_ledger_v2
--          1. Validates that item_sku exists in master_items_v2 before inserting into stock_ledger_v2.
--          2. Ensures SF-BABYROLL is present in master_items_v2.
--          3. Logs warning instead of aborting the driver's delivery/loading transaction if an unmapped SKU is encountered.
-- ==========================================

-- 1. Ensure SF-BABYROLL is in master_items_v2
INSERT INTO public.master_items_v2 (sku, name, type, supply_type, uom, status)
VALUES ('SF-BABYROLL', 'SF-BABYROLL', 'FG', 'Manufactured', 'Unit', 'Active')
ON CONFLICT (sku) DO UPDATE SET status = 'Active';

-- 2. Drop existing trigger and recreate function with FKEY check
DROP TRIGGER IF EXISTS sync_order_inventory_trigger ON public.sales_orders;

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
    resolved_sku TEXT;
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
                    -- Foreign Key Safety Check
                    resolved_sku := item_sku;
                    IF NOT EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = resolved_sku) THEN
                        -- Fallback alias checks
                        IF resolved_sku = 'SF-BABYROLL' THEN
                            resolved_sku := 'SF-BABYROLL-CLEAR';
                        END IF;
                    END IF;

                    IF EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = resolved_sku) THEN
                        INSERT INTO public.stock_ledger_v2 (
                            timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                        ) VALUES (
                            NOW(), 'Transfer Out', resolved_sku, -item_qty, item_loc, 
                            'Auto-deduct: Order ' || NEW.status, COALESCE(NEW.order_number, 'DO-' || NEW.id::TEXT)
                        );
                    ELSE
                        RAISE WARNING 'SKU "%" does not exist in master_items_v2. Skipped stock_ledger_v2 insert for order %', item_sku, COALESCE(NEW.order_number, NEW.id::TEXT);
                    END IF;
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
                    resolved_sku := item_sku;
                    IF NOT EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = resolved_sku) THEN
                        IF resolved_sku = 'SF-BABYROLL' THEN
                            resolved_sku := 'SF-BABYROLL-CLEAR';
                        END IF;
                    END IF;

                    IF EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = resolved_sku) THEN
                        INSERT INTO public.stock_ledger_v2 (
                            timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                        ) VALUES (
                            NOW(), 'Transfer In', resolved_sku, item_qty, item_loc, 
                            'Auto-refund: Status Reverted from ' || OLD.status, COALESCE(OLD.order_number, 'DO-' || OLD.id::TEXT)
                        );
                    ELSE
                        RAISE WARNING 'SKU "%" does not exist in master_items_v2. Skipped stock_ledger_v2 refund for order %', item_sku, COALESCE(OLD.order_number, OLD.id::TEXT);
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ==========================================
    -- LOGIC 3: ITEM MODIFICATION CORRECTION (While staying in has_left)
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
                    resolved_sku := item_sku;
                    IF NOT EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = resolved_sku) THEN
                        IF resolved_sku = 'SF-BABYROLL' THEN
                            resolved_sku := 'SF-BABYROLL-CLEAR';
                        END IF;
                    END IF;

                    IF EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = resolved_sku) THEN
                        INSERT INTO public.stock_ledger_v2 (
                            timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                        ) VALUES (
                            NOW(), 'Transfer In', resolved_sku, item_qty, item_loc, 
                            'Correction: Refund Old Items', COALESCE(OLD.order_number, 'DO-' || OLD.id::TEXT)
                        );
                    ELSE
                        RAISE WARNING 'SKU "%" does not exist in master_items_v2. Skipped stock_ledger_v2 refund for order %', item_sku, COALESCE(OLD.order_number, OLD.id::TEXT);
                    END IF;
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
                    resolved_sku := item_sku;
                    IF NOT EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = resolved_sku) THEN
                        IF resolved_sku = 'SF-BABYROLL' THEN
                            resolved_sku := 'SF-BABYROLL-CLEAR';
                        END IF;
                    END IF;

                    IF EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = resolved_sku) THEN
                        INSERT INTO public.stock_ledger_v2 (
                            timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                        ) VALUES (
                            NOW(), 'Transfer Out', resolved_sku, -item_qty, item_loc, 
                            'Correction: Deduct New Items', COALESCE(NEW.order_number, 'DO-' || NEW.id::TEXT)
                        );
                    ELSE
                        RAISE WARNING 'SKU "%" does not exist in master_items_v2. Skipped stock_ledger_v2 insert for order %', item_sku, COALESCE(NEW.order_number, NEW.id::TEXT);
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the final trigger
CREATE TRIGGER sync_order_inventory_trigger
AFTER INSERT OR UPDATE OF status, items
ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_inventory();
