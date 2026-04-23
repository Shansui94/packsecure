-- ==========================================
-- Robust Sales Order Inventory Sync Trigger
-- Purpose: Safely deduct and refund inventory on INSERT, UPDATE, DELETE 
-- and handle location/item modifications & cancellations.
-- ==========================================

CREATE OR REPLACE FUNCTION public.sync_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
    item_record jsonb;
    item_sku VARCHAR;
    item_qty NUMERIC;
BEGIN
    -- ---------------------------------------------------------
    -- 1. ROLLBACK OLD INVENTORY (For UPDATE and DELETE)
    -- ---------------------------------------------------------
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        -- Only rollback if the order wasn't previously cancelled 
        -- (meaning it was previously deducted)
        IF OLD.status != 'Cancelled' THEN
            IF OLD.items IS NOT NULL THEN
                FOR item_record IN SELECT * FROM jsonb_array_elements(OLD.items)
                LOOP
                    item_sku := item_record ->> 'sku';
                    item_qty := (item_record ->> 'quantity')::NUMERIC;

                    IF item_sku IS NOT NULL AND item_qty > 0 AND OLD.factory_id IS NOT NULL THEN
                        INSERT INTO public.stock_ledger_v2 (
                            sku,
                            change_qty,
                            event_type,
                            loc_id,
                            ref_doc,
                            notes,
                            timestamp
                        ) VALUES (
                            item_sku,
                            item_qty, -- POSITIVE to refund
                            'Transfer In',
                            OLD.factory_id,
                            OLD.order_number,
                            'Auto-refund: Order Updated/Deleted',
                            NOW()
                        );
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END IF;

    -- ---------------------------------------------------------
    -- 2. APPLY NEW DEDUCTIONS (For INSERT and UPDATE)
    -- ---------------------------------------------------------
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Only deduct if the new status is NOT Cancelled
        IF NEW.status != 'Cancelled' THEN
            IF NEW.items IS NOT NULL THEN
                FOR item_record IN SELECT * FROM jsonb_array_elements(NEW.items)
                LOOP
                    item_sku := item_record ->> 'sku';
                    item_qty := (item_record ->> 'quantity')::NUMERIC;

                    IF item_sku IS NOT NULL AND item_qty > 0 AND NEW.factory_id IS NOT NULL THEN
                        INSERT INTO public.stock_ledger_v2 (
                            sku,
                            change_qty,
                            event_type,
                            loc_id,
                            ref_doc,
                            notes,
                            timestamp
                        ) VALUES (
                            item_sku,
                            -item_qty, -- NEGATIVE to deduct
                            'Transfer Out',
                            NEW.factory_id,
                            NEW.order_number,
                            'Auto-deduct: Order Created/Updated',
                            NOW()
                        );
                    END IF;
                END LOOP;
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;

    RETURN OLD; -- For DELETE
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------
-- Bind the Trigger to Sales Orders Table
-- ---------------------------------------------------------
DROP TRIGGER IF EXISTS on_sales_order_sync ON public.sales_orders;
-- Also drop any older triggers that might be doing the same job 
-- (like the one that currently deducts on creation)
DROP TRIGGER IF EXISTS auto_deduct_stock_on_order ON public.sales_orders;

CREATE TRIGGER on_sales_order_sync
AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_inventory();
