-- =========================================================================
-- ROBUST INVENTORY TRIGGERS V3 (Strict Item Level Location)
-- =========================================================================

-- 1. Obliterate all known old triggers to prevent double-deductions
DROP TRIGGER IF EXISTS "auto_deduct_stock_on_order" ON public.sales_orders;
DROP TRIGGER IF EXISTS "auto_refund_stock_on_cancel" ON public.sales_orders;
DROP TRIGGER IF EXISTS "update_delivery_trigger" ON public.sales_orders;
DROP TRIGGER IF EXISTS "update_delivery_trigger_v2" ON public.sales_orders;

-- 2. Drop the old function so we can replace it cleanly
DROP FUNCTION IF EXISTS public.sync_order_inventory() CASCADE;

-- 3. Create the Strict function
CREATE OR REPLACE FUNCTION public.sync_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    item_sku TEXT;
    item_qty NUMERIC;
    item_loc TEXT;
    status_changed BOOLEAN;
BEGIN
    -- Only act on specific statuses
    IF TG_OP = 'INSERT' THEN
        IF NEW.status NOT IN ('New', 'Production', 'Ready', 'Delivered') THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        status_changed := (OLD.status IS DISTINCT FROM NEW.status);
    END IF;

    -- ==========================================
    -- LOGIC: DEDUCT STOCK
    -- ==========================================
    IF (TG_OP = 'INSERT' AND NEW.status IN ('New', 'Production', 'Ready', 'Delivered')) OR 
       (TG_OP = 'UPDATE' AND status_changed AND NEW.status IN ('New', 'Production', 'Ready', 'Delivered') AND OLD.status IN ('Cancelled', 'Unfulfilled')) 
    THEN
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                item_sku := REPLACE(item.value->>'sku', ' ', '-');
                item_qty := (item.value->>'quantity')::NUMERIC;
                
                -- STRICT LOCATION DETECTION: 绝对强制使用具体 Item 的 sourceLocation
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN
                    -- User specifically requested to default to 'no location'
                    item_loc := 'no location';
                END IF;

                IF item_sku IS NOT NULL AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 
                        'Transfer Out', 
                        item_sku, 
                        -item_qty, 
                        item_loc, 
                        'Auto-deduct', 
                        NEW.order_number
                    );
                END IF;
            END LOOP;
        END IF;

    -- ==========================================
    -- LOGIC: REFUND STOCK (When Cancelled/Deleted)
    -- ==========================================
    ELSIF (TG_OP = 'DELETE' AND OLD.status IN ('New', 'Production', 'Ready', 'Delivered')) OR 
          (TG_OP = 'UPDATE' AND status_changed AND NEW.status IN ('Cancelled', 'Unfulfilled') AND OLD.status IN ('New', 'Production', 'Ready', 'Delivered'))
    THEN
        -- We must reference the PREVIOUS items (OLD.items)
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                item_sku := REPLACE(item.value->>'sku', ' ', '-');
                item_qty := (item.value->>'quantity')::NUMERIC;
                
                -- STRICT LOCATION DETECTION: 绝对强制使用具体 Item 的 sourceLocation
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN
                    item_loc := 'no location';
                END IF;

                IF item_sku IS NOT NULL AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    INSERT INTO public.stock_ledger_v2 (
                        timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                    ) VALUES (
                        NOW(), 
                        'Transfer In', 
                        item_sku, 
                        item_qty, 
                        item_loc, 
                        'Auto-refund', 
                        OLD.order_number
                    );
                END IF;
            END LOOP;
        END IF;

    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. Re-attach the trigger
CREATE TRIGGER on_sales_order_sync
AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_inventory();
