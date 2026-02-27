import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function updateTrigger() {
    const sql = `
CREATE OR REPLACE FUNCTION public.distribute_production_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
  product_count INTEGER;
  qty_per_product NUMERIC;
  v_factory_id TEXT;
  v_loc_id TEXT;
BEGIN
  -- 1. Find the machine's factory_id
  SELECT factory_id INTO v_factory_id
  FROM public.sys_machines_v2
  WHERE machine_id = NEW.machine_id;

  -- 2. Map factory_id to warehouse loc_id
  IF v_factory_id = 'T1' THEN
      v_loc_id := 'OPM Lama';
  ELSIF v_factory_id = 'N1' OR v_factory_id = 'N2' THEN
      v_loc_id := 'Nilai';
  ELSE
      v_loc_id := 'Unknown';
  END IF;

  -- 3. Count how many active products this machine has
  SELECT COUNT(*) INTO product_count
  FROM public.machine_active_products
  WHERE machine_id = NEW.machine_id;

  -- 4. If no products, do nothing
  IF product_count = 0 THEN
    RETURN NEW;
  END IF;

  -- 5. Calculate quantity per product
  qty_per_product := NEW.alarm_count::NUMERIC / product_count;

  -- 6. Loop through ALL active products and update ledger
  FOR rec IN
    SELECT product_sku
    FROM public.machine_active_products
    WHERE machine_id = NEW.machine_id
  LOOP
    BEGIN
      INSERT INTO public.stock_ledger_v2 (
        sku,
        change_qty,
        loc_id,
        event_type,
        ref_doc,
        notes,
        timestamp
      ) VALUES (
        rec.product_sku,
        qty_per_product,
        v_loc_id,
        'Production',
        NEW.id::text,
        'Auto-Log: ' || NEW.machine_id || ' (Split ' || product_count || ')',
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'distribute_production_to_ledger: skipped sku=% for machine=% err=%',
        rec.product_sku, NEW.machine_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

    // We can't easily execute raw DDL from supabase-js without a custom RPC, 
    // so we'll output the query and instruct the user or use a backend hack.
    // Wait, I can run it via Supabase CLI locally since I have been doing it!
    console.log("SQL to run:");
    console.log(sql);
}

updateTrigger();
