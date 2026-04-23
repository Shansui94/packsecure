-- =========================================================================
-- ROBUST INVENTORY TRIGGERS V5 (Deduct ONLY on Delivered / Naik Barang)
-- =========================================================================

-- 1. Obliterate all known old triggers to prevent double-deductions
DROP TRIGGER IF EXISTS "auto_deduct_stock_on_order" ON public.sales_orders;
DROP TRIGGER IF EXISTS "auto_refund_stock_on_cancel" ON public.sales_orders;
DROP TRIGGER IF EXISTS "update_delivery_trigger" ON public.sales_orders;
DROP TRIGGER IF EXISTS "update_delivery_trigger_v2" ON public.sales_orders;

-- 2. Drop the old function so we can replace it cleanly
DROP FUNCTION IF EXISTS public.sync_order_inventory() CASCADE;

-- 3. Create the Strict function without aggressive SKU mutation
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
        -- Only deduct if inserted directly as Delivered (e.g. ad-hoc pick up)
        IF NEW.status != 'Delivered' THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        status_changed := (OLD.status IS DISTINCT FROM NEW.status);
    END IF;

    -- ==========================================
    -- LOGIC: DEDUCT STOCK (Only when Delivered)
    -- ==========================================
    IF (TG_OP = 'INSERT' AND NEW.status = 'Delivered') OR 
       (TG_OP = 'UPDATE' AND status_changed AND NEW.status = 'Delivered' AND OLD.status != 'Delivered') 
    THEN
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                -- EXACT SKU CAPTURE
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                
                -- STRICT LOCATION DETECTION
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
                        'Auto-deduct: Order Delivered/Naik Barang', 
                        NEW.order_number
                    );
                END IF;
            END LOOP;
        END IF;

    -- ==========================================
    -- LOGIC: REFUND STOCK (When Delivered is reverted to anything else)
    -- ==========================================
    ELSIF (TG_OP = 'DELETE' AND OLD.status = 'Delivered') OR 
          (TG_OP = 'UPDATE' AND status_changed AND NEW.status != 'Delivered' AND OLD.status = 'Delivered')
    THEN
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                -- EXACT SKU CAPTURE
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                
                -- STRICT LOCATION DETECTION
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
                        'Auto-refund: Delivery Cancelled/Reverted', 
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
