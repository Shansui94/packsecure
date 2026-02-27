-- rename_oren_sku.sql
-- Run this in Supabase SQL Editor to safely rename the SKU.

BEGIN;

-- 1. Temporarily drop foreign keys that point to master_items_v2.sku
ALTER TABLE stock_ledger_v2 DROP CONSTRAINT IF EXISTS stock_ledger_v2_sku_fkey;
ALTER TABLE sales_order_items_v2 DROP CONSTRAINT IF EXISTS sales_order_items_v2_sku_fkey;
ALTER TABLE logistics_trips_items DROP CONSTRAINT IF EXISTS logistics_trips_items_product_sku_fkey; -- hypotheticals
ALTER TABLE master_bom_v2 DROP CONSTRAINT IF EXISTS master_bom_v2_product_sku_fkey;

-- 2. Update the parent (master_items_v2)
UPDATE master_items_v2
SET sku = 'BW-SL-CLR-100Mx100CMx2ROLL-ORN',
    name = 'BW-SL-CLR-100Mx100CMx2ROLL-ORN'
WHERE sku = 'BW-SL-CLR-100Mx100CMx1ROLL-ORN';

-- 3. Update the children
UPDATE stock_ledger_v2 SET sku = 'BW-SL-CLR-100Mx100CMx2ROLL-ORN' WHERE sku = 'BW-SL-CLR-100Mx100CMx1ROLL-ORN';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-CLR-100Mx100CMx2ROLL-ORN' WHERE sku = 'BW-SL-CLR-100Mx100CMx1ROLL-ORN';
-- add any other tables as necessary

-- 4. Re-add foreign keys with ON UPDATE CASCADE (good practice)
ALTER TABLE stock_ledger_v2 
ADD CONSTRAINT stock_ledger_v2_sku_fkey 
FOREIGN KEY (sku) REFERENCES master_items_v2(sku) ON UPDATE CASCADE;

ALTER TABLE sales_order_items_v2 
ADD CONSTRAINT sales_order_items_v2_sku_fkey 
FOREIGN KEY (sku) REFERENCES master_items_v2(sku) ON UPDATE CASCADE;

COMMIT;
