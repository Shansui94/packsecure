-- ==========================================
-- Migration: 20260830_loaded_stock_deduction_trigger.sql
-- Purpose: Deduct inventory immediately when status changes to 'Loaded' (Naik Barang).
--          Prevent double deduction when transitioning from 'Loaded' to 'Delivered'.
--          Automatically reverse/restore stock when a loaded order is 'Cancelled'.
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_sales_order_stock_trigger()
RETURNS TRIGGER AS $$
DECLARE
    item_record jsonb;
    item_sku VARCHAR;
    item_qty NUMERIC;
    item_loc VARCHAR;
BEGIN
    -- 1. CASE: ORDER IS LOADED (Naik Barang) OR DIRECTLY DELIVERED FROM NEW/PENDING
    IF (NEW.status IN ('Loaded', 'Shipped', 'Delivered')) AND (OLD.status IS NULL OR OLD.status NOT IN ('Loaded', 'Shipped', 'Delivered')) THEN
        
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item_record IN SELECT * FROM jsonb_array_elements(NEW.items)
            LOOP
                item_sku := item_record ->> 'sku';
                item_qty := COALESCE((item_record ->> 'quantity')::NUMERIC, (item_record ->> 'qty')::NUMERIC, 0);
                
                -- Determine location: item sourceLocation > order trip_origin > fallback 'SPD'
                item_loc := COALESCE(
                    NULLIF(TRIM(item_record ->> 'sourceLocation'), ''),
                    NULLIF(TRIM(item_record ->> 'location'), ''),
                    NULLIF(TRIM(NEW.trip_origin), ''),
                    'SPD'
                );

                -- Standardize location name
                IF UPPER(item_loc) = 'TAIPING' THEN
                    item_loc := 'SPD';
                ELSIF UPPER(item_loc) = 'NILAI' THEN
                    item_loc := 'Nilai';
                ELSIF UPPER(item_loc) = 'JOHOR' THEN
                    item_loc := 'Johor';
                ELSIF UPPER(item_loc) = 'KELANTAN' THEN
                    item_loc := 'Kelantan';
                END IF;

                -- Insert deduction entry into stock_ledger_v2
                IF item_sku IS NOT NULL AND TRIM(item_sku) <> '' AND item_qty > 0 THEN
                    IF EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = item_sku) THEN
                        INSERT INTO public.stock_ledger_v2 (
                            sku,
                            loc_id,
                            change_qty,
                            event_type,
                            ref_doc,
                            notes,
                            timestamp
                        ) VALUES (
                            item_sku,
                            item_loc,
                            -item_qty, -- NEGATIVE Quantity for deduction
                            'Transfer Out',
                            COALESCE(NEW.order_number, 'DO-' || NEW.id::VARCHAR),
                            'Loaded (Naik Barang)',
                            NOW()
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;

    -- 2. CASE: ORDER IS CANCELLED AFTER BEING LOADED/DELIVERED -> REVERSE STOCK
    ELSIF (NEW.status = 'Cancelled') AND (OLD.status IN ('Loaded', 'Shipped', 'Delivered')) THEN

        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item_record IN SELECT * FROM jsonb_array_elements(OLD.items)
            LOOP
                item_sku := item_record ->> 'sku';
                item_qty := COALESCE((item_record ->> 'quantity')::NUMERIC, (item_record ->> 'qty')::NUMERIC, 0);
                
                item_loc := COALESCE(
                    NULLIF(TRIM(item_record ->> 'sourceLocation'), ''),
                    NULLIF(TRIM(item_record ->> 'location'), ''),
                    NULLIF(TRIM(OLD.trip_origin), ''),
                    'SPD'
                );

                IF UPPER(item_loc) = 'TAIPING' THEN
                    item_loc := 'SPD';
                ELSIF UPPER(item_loc) = 'NILAI' THEN
                    item_loc := 'Nilai';
                ELSIF UPPER(item_loc) = 'JOHOR' THEN
                    item_loc := 'Johor';
                ELSIF UPPER(item_loc) = 'KELANTAN' THEN
                    item_loc := 'Kelantan';
                END IF;

                IF item_sku IS NOT NULL AND TRIM(item_sku) <> '' AND item_qty > 0 THEN
                    IF EXISTS (SELECT 1 FROM public.master_items_v2 WHERE sku = item_sku) THEN
                        INSERT INTO public.stock_ledger_v2 (
                            sku,
                            loc_id,
                            change_qty,
                            event_type,
                            ref_doc,
                            notes,
                            timestamp
                        ) VALUES (
                            item_sku,
                            item_loc,
                            item_qty, -- POSITIVE Quantity for restoration
                            'Stock In',
                            COALESCE(NEW.order_number, 'DO-' || NEW.id::VARCHAR),
                            'Reversal on Cancel',
                            NOW()
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rebind trigger to sales_orders
DROP TRIGGER IF EXISTS on_delivery_completed ON public.sales_orders;
DROP TRIGGER IF EXISTS on_sales_order_stock_trigger ON public.sales_orders;

CREATE TRIGGER on_sales_order_stock_trigger
AFTER UPDATE OR INSERT ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_sales_order_stock_trigger();
