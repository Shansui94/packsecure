-- FORCE FIX: Drop views, clean schema, rebuild views without 'category'

-- 1. DROP DEPENDENT VIEWS (CASCADE is implied if run manually, but explicit here is safer)
DROP VIEW IF EXISTS v2_inventory_snapshot CASCADE;
DROP VIEW IF EXISTS v2_inventory_view CASCADE;

-- 2. ALTER TABLE: Remove 'category' and add 'supply_type'
-- Now there are no dependencies blocking this.
ALTER TABLE master_items_v2 DROP COLUMN IF EXISTS category;
ALTER TABLE master_items_v2 ADD COLUMN IF NOT EXISTS supply_type text DEFAULT 'Manufactured';

-- Safety update for existing Raw materials
UPDATE master_items_v2 
SET supply_type = 'Purchased' 
WHERE type = 'Raw';

-- 3. RECREATE VIEWS (Inferred Logic)

-- Recreate v2_inventory_view
-- Join master items with stock ledger to get current balance
CREATE OR REPLACE VIEW v2_inventory_view AS
SELECT 
    i.sku,
    i.name,
    i.type,
    i.uom,
    i.min_stock_level,
    i.status,
    i.supply_type,
    COALESCE(SUM(l.change_qty), 0) as current_stock,
    MAX(l.timestamp) as last_updated
FROM master_items_v2 i
LEFT JOIN stock_ledger_v2 l ON i.sku = l.sku
GROUP BY i.sku, i.name, i.type, i.uom, i.min_stock_level, i.status, i.supply_type;

-- Recreate v2_inventory_snapshot (Often just a synonym or materialized version of the view)
-- Mapping to the same logic for simplicity and compatibility
CREATE OR REPLACE VIEW v2_inventory_snapshot AS
SELECT * FROM v2_inventory_view;

-- 4. GRANT PERMISSIONS (Just in case)
GRANT SELECT ON v2_inventory_view TO authenticated, anon;
GRANT SELECT ON v2_inventory_snapshot TO authenticated, anon;
