-- ALIGN V2 SCHEMA WITH NEW LOGIC

-- 1. Remove the obsolete 'category' column
-- This resolves the "invalid input value for enum" error by stopping the usage of this column entirely.
ALTER TABLE master_items_v2 DROP COLUMN IF EXISTS category;

-- 2. Add the new 'supply_type' column for "Trading Goods" support
-- We default it to 'Manufactured' for safety, but existing Raw materials should probably be 'Purchased'.
-- We'll handle data patching in a second step if needed.
ALTER TABLE master_items_v2 ADD COLUMN IF NOT EXISTS supply_type text DEFAULT 'Manufactured';

-- 3. (Optional) Update existing RAW items to be 'Purchased'
UPDATE master_items_v2 
SET supply_type = 'Purchased' 
WHERE type = 'Raw';

-- 4. Clean up the enum type if no longer used (Optional, safe to keep)
-- DROP TYPE IF EXISTS v2_item_category; 
