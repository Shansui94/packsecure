-- Support View for App.tsx (Inventory Dashboard)
-- Aggregates stock_ledger_v2 per SKU per location with item metadata.
-- Synced to match the live Supabase definition on 2026-05-24.

DROP VIEW IF EXISTS v2_inventory_view;

CREATE OR REPLACE VIEW v2_inventory_view AS
SELECT 
    m.sku,
    m.name,
    m.type,
    m.uom,
    l.loc_id,
    COALESCE(SUM(l.change_qty), 0::numeric) AS current_stock,
    MAX(l."timestamp") AS last_updated
FROM master_items_v2 m
    LEFT JOIN stock_ledger_v2 l ON m.sku::text = l.sku::text AND l."timestamp" <= CURRENT_TIMESTAMP
GROUP BY m.sku, m.name, m.type, m.uom, l.loc_id;
