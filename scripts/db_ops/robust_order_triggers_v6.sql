-- ==========================================
-- V6: BULLETPROOF PHYSICAL INVENTORY SYSTEM
-- ==========================================
-- Handles edge cases: status reverting, manual item edits after delivery.

-- 1. Obliterate all known old triggers to prevent double-deductions 
DROP TRIGGER IF EXISTS "auto_deduct_stock_on_order" ON public.sales_orders;
DROP TRIGGER IF EXISTS auto_deduct_stock_on_order ON public.sales_orders;
DROP TRIGGER IF EXISTS "auto_refund_stock_on_cancel" ON public.sales_orders;
DROP TRIGGER IF EXISTS auto_refund_stock_on_cancel ON public.sales_orders;
DROP TRIGGER IF EXISTS "update_delivery_trigger" ON public.sales_orders;
DROP TRIGGER IF EXISTS update_delivery_trigger ON public.sales_orders;
DROP TRIGGER IF EXISTS "update_delivery_trigger_v2" ON public.sales_orders;
DROP TRIGGER IF EXISTS update_delivery_trigger_v2 ON public.sales_orders;
DROP TRIGGER IF EXISTS "sync_order_inventory_trigger" ON public.sales_orders;
DROP TRIGGER IF EXISTS sync_order_inventory_trigger ON public.sales_orders;
DROP TRIGGER IF EXISTS "trg_auto_deduct_stock" ON public.sales_orders;
DROP TRIGGER IF EXISTS trg_auto_deduct_stock ON public.sales_orders;
DROP TRIGGER IF EXISTS "trg_auto_refund_stock" ON public.sales_orders;
DROP TRIGGER IF EXISTS trg_auto_refund_stock ON public.sales_orders;

-- 2. Drop the old function
DROP FUNCTION IF EXISTS public.sync_order_inventory() CASCADE;
DROP FUNCTION IF EXISTS public.auto_deduct_stock_on_order() CASCADE;
DROP FUNCTION IF EXISTS public.auto_refund_stock_on_cancel() CASCADE;

-- 3. Create the Bulletproof function
CREATE OR REPLACE FUNCTION public.sync_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    item_sku TEXT;
    item_qty NUMERIC;
    item_loc TEXT;
    status_changed BOOLEAN := FALSE;
    items_changed BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        status_changed := (OLD.status IS DISTINCT FROM NEW.status);
        items_changed := (OLD.items IS DISTINCT FROM NEW.items);
    END IF;

    -- ==========================================
    -- LOGIC 1: PHYSICAL DEDUCTION (Entering 'Delivered')
    -- Triggered when a new order is inserted as Delivered, or updated to Delivered.
    -- ==========================================
    IF (TG_OP = 'INSERT' AND NEW.status = 'Delivered') OR 
       (TG_OP = 'UPDATE' AND status_changed AND NEW.status = 'Delivered') 
    THEN
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN item_loc := 'no location'; END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 'Transfer Out', item_sku, -item_qty, item_loc, 
                        'Auto-deduct: Order Delivered', NEW.order_number
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ==========================================
    -- LOGIC 2: ABSOLUTE REFUND (Leaving 'Delivered')
    -- Triggered if status changes FROM Delivered to ANYTHING else (Cancelled, Ready, New, etc.)
    -- ==========================================
    IF (TG_OP = 'UPDATE' AND status_changed AND OLD.status = 'Delivered' AND NEW.status != 'Delivered') THEN
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN item_loc := 'no location'; END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 'Transfer In', item_sku, item_qty, item_loc, 
                        'Auto-refund: Status Reverted from Delivered', OLD.order_number
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ==========================================
    -- LOGIC 3: ITEM MODIFICATION CORRECTION (While staying 'Delivered')
    -- If admin edits the items (quantity/sku) of an ALREADY Delivered order.
    -- We refund the old snapshot, and deduct the new snapshot.
    -- ==========================================
    IF (TG_OP = 'UPDATE' AND NOT status_changed AND NEW.status = 'Delivered' AND items_changed) THEN
        -- Step 3a: Refund all OLD items
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN item_loc := 'no location'; END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 'Transfer In', item_sku, item_qty, item_loc, 
                        'Correction: Refund Old Items', OLD.order_number
                    );
                END IF;
            END LOOP;
        END IF;

        -- Step 3b: Deduct all NEW items
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN item_loc := 'no location'; END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 'Transfer Out', item_sku, -item_qty, item_loc, 
                        'Correction: Deduct New Items', NEW.order_number
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the final trigger
CREATE TRIGGER sync_order_inventory_trigger
AFTER INSERT OR UPDATE OF status, items
ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_inventory();
