import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = "postgresql://postgres.kdahubyhwndgyloaljak:%24QNQ4rAW*%23%25294z@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

const sql = `
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
        old_has_left := (OLD.status IN ('Loaded', 'Delivered'));
        new_has_left := (NEW.status IN ('Loaded', 'Delivered'));
    ELSIF TG_OP = 'INSERT' THEN
        new_has_left := (NEW.status IN ('Loaded', 'Delivered'));
    END IF;

    -- ==========================================
    -- LOGIC 1: PHYSICAL DEDUCTION (Entering 'Loaded' or 'Delivered')
    -- ==========================================
    IF (TG_OP = 'INSERT' AND new_has_left) OR 
       (TG_OP = 'UPDATE' AND status_changed AND NOT old_has_left AND new_has_left) 
    THEN
        IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN item_loc := 'no location'; END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    BEGIN
                        INSERT INTO public.stock_ledger_v2 (
                            timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                        ) VALUES (
                            NOW(), 'Transfer Out', item_sku, -item_qty, item_loc, 
                            'Auto-deduct: Order ' || NEW.status, NEW.order_number
                        );
                    EXCEPTION WHEN OTHERS THEN
                        -- Fail-safe: do not block order loading / delivery if SKU is not in master_items or loc_id is invalid
                        RAISE WARNING 'Stock deduction skipped for SKU % (Loc %): %', item_sku, item_loc, SQLERRM;
                    END;
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ==========================================
    -- LOGIC 2: ABSOLUTE REFUND (Leaving 'Loaded'/'Delivered')
    -- ==========================================
    IF (TG_OP = 'UPDATE' AND status_changed AND old_has_left AND NOT new_has_left) THEN
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN item_loc := 'no location'; END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    BEGIN
                        INSERT INTO public.stock_ledger_v2 (
                            timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                        ) VALUES (
                            NOW(), 'Transfer In', item_sku, item_qty, item_loc, 
                            'Auto-refund: Status Reverted from ' || OLD.status, OLD.order_number
                        );
                    EXCEPTION WHEN OTHERS THEN
                        RAISE WARNING 'Stock refund skipped for SKU % (Loc %): %', item_sku, item_loc, SQLERRM;
                    END;
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ==========================================
    -- LOGIC 3: ITEM MODIFICATION CORRECTION (While staying 'Loaded'/'Delivered')
    -- ==========================================
    IF (TG_OP = 'UPDATE' AND old_has_left AND new_has_left AND items_changed) THEN
        -- Step 3a: Refund all OLD items
        IF OLD.items IS NOT NULL AND jsonb_typeof(OLD.items) = 'array' THEN
            FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
                item_sku := TRIM(item.value->>'sku');
                item_qty := (item.value->>'quantity')::NUMERIC;
                item_loc := NULLIF(TRIM(item.value->>'sourceLocation'), '');
                IF item_loc IS NULL OR item_loc = '' THEN item_loc := 'no location'; END IF;

                IF item_sku IS NOT NULL AND item_sku != '' AND item_qty IS NOT NULL AND item_qty > 0 THEN
                    BEGIN
                        INSERT INTO public.stock_ledger_v2 (
                            timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                        ) VALUES (
                            NOW(), 'Transfer In', item_sku, item_qty, item_loc, 
                            'Correction: Refund Old Items', OLD.order_number
                        );
                    EXCEPTION WHEN OTHERS THEN
                        RAISE WARNING 'Stock correction refund skipped for SKU % (Loc %): %', item_sku, item_loc, SQLERRM;
                    END;
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
                    BEGIN
                        INSERT INTO public.stock_ledger_v2 (
                            timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                        ) VALUES (
                            NOW(), 'Transfer Out', item_sku, -item_qty, item_loc, 
                            'Correction: Deduct New Items', NEW.order_number
                        );
                    EXCEPTION WHEN OTHERS THEN
                        RAISE WARNING 'Stock correction deduct skipped for SKU % (Loc %): %', item_sku, item_loc, SQLERRM;
                    END;
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

async function main() {
    const client = new pg.Client(connectionString);
    try {
        await client.connect();
        console.log("Connected to PostgreSQL successfully.");
        await client.query(sql);
        console.log("✅ Successfully updated public.sync_order_inventory() with resilient EXCEPTION handling!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

main();
