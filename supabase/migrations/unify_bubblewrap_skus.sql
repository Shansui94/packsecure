-- ============================================================
-- Unify Bubble Wrap SKUs in master_items_v2 + all referencing tables
-- Run in Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. Add nickname column to master_items_v2 (stores old human-readable name)
ALTER TABLE master_items_v2 ADD COLUMN IF NOT EXISTS nickname TEXT;

-- 2. Drop ALL FKs that reference master_items_v2(sku) across all tables
ALTER TABLE stock_ledger_v2       DROP CONSTRAINT IF EXISTS stock_ledger_v2_sku_fkey;
ALTER TABLE sales_order_items_v2  DROP CONSTRAINT IF EXISTS sales_order_items_v2_sku_fkey;
ALTER TABLE machine_active_products DROP CONSTRAINT IF EXISTS machine_active_products_product_sku_fkey;

-- ── 3. Update master_items_v2: nickname = old SKU, rename SKU ──

-- DL-CLR series (Double Layer Clear)
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-CLR-100Mx20CMx5ROLL-BLU'  WHERE sku = 'DL-20CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-CLR-100Mx25CMx4ROLL-BLU'  WHERE sku = 'DL-25CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-CLR-100Mx33CMx3ROLL-BLU'  WHERE sku = 'DL-33CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-CLR-100Mx100CMx1ROLL-YEL' WHERE sku = 'DL-FULL';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-CLR-100Mx50CMx2ROLL-BLU'  WHERE sku = 'DL-HALF';

-- DL-BLK series (Double Layer Black)
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-BLK-100Mx20CMx5ROLL-RED'  WHERE sku = 'DL-HITAM-20CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-BLK-100Mx25CMx4ROLL-RED'  WHERE sku = 'DL-HITAM-25CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-BLK-100Mx33CMx3ROLL-RED'  WHERE sku = 'DL-HITAM-33CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED' WHERE sku = 'DL-HITAM-FULL';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-DL-BLK-100Mx50CMx2ROLL-GRN'  WHERE sku = 'DL-HITAM-HALF';

-- SL-BLK series (Single Layer Black — no SL/DL prefix = default Single)
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-BLK-100Mx20CMx5ROLL-GRN'  WHERE sku = 'HITAM-20CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-BLK-100Mx25CMx4ROLL-GRN'  WHERE sku = 'HITAM-25CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-BLK-100Mx33CMx3ROLL-GRN'  WHERE sku = 'HITAM-33CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-BLK-100Mx100CMx1ROLL-GRN' WHERE sku = 'HITAM-FULL';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-BLK-100Mx50CMx2ROLL-RED'  WHERE sku = 'HITAM-HALF';

-- Color-specific products
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED' WHERE sku = 'MERAH';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-CLR-100Mx100CMx1ROLL-ORN' WHERE sku = 'OREN';

-- Silver-Grey
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-SLV-100Mx100CMx1ROLL'     WHERE sku = 'SILVER-GREY';

-- SL-CLR series (Single Layer Clear)
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-CLR-100Mx20CMx5ROLL-GRN'  WHERE sku = 'SL-20CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'  WHERE sku = 'SL-25CM';
UPDATE master_items_v2 SET nickname = sku, sku = 'BW-SL-CLR-100Mx33CMx3ROLL-GRN'  WHERE sku = 'SL-33CM';

-- ── 4. Sync stock_ledger_v2 ──
UPDATE stock_ledger_v2 SET sku = 'BW-DL-CLR-100Mx20CMx5ROLL-BLU'  WHERE sku = 'DL-20CM';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-CLR-100Mx25CMx4ROLL-BLU'  WHERE sku = 'DL-25CM';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-CLR-100Mx33CMx3ROLL-BLU'  WHERE sku = 'DL-33CM';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-CLR-100Mx100CMx1ROLL-YEL' WHERE sku = 'DL-FULL';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-CLR-100Mx50CMx2ROLL-BLU'  WHERE sku = 'DL-HALF';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-BLK-100Mx20CMx5ROLL-RED'  WHERE sku = 'DL-HITAM-20CM';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-BLK-100Mx25CMx4ROLL-RED'  WHERE sku = 'DL-HITAM-25CM';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-BLK-100Mx33CMx3ROLL-RED'  WHERE sku = 'DL-HITAM-33CM';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED' WHERE sku = 'DL-HITAM-FULL';
UPDATE stock_ledger_v2 SET sku = 'BW-DL-BLK-100Mx50CMx2ROLL-GRN'  WHERE sku = 'DL-HITAM-HALF';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-BLK-100Mx20CMx5ROLL-GRN'  WHERE sku = 'HITAM-20CM';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-BLK-100Mx25CMx4ROLL-GRN'  WHERE sku = 'HITAM-25CM';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-BLK-100Mx33CMx3ROLL-GRN'  WHERE sku = 'HITAM-33CM';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-BLK-100Mx100CMx1ROLL-GRN' WHERE sku = 'HITAM-FULL';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-BLK-100Mx50CMx2ROLL-RED'  WHERE sku = 'HITAM-HALF';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED' WHERE sku = 'MERAH';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-CLR-100Mx100CMx1ROLL-ORN' WHERE sku = 'OREN';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-SLV-100Mx100CMx1ROLL'     WHERE sku = 'SILVER-GREY';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-CLR-100Mx20CMx5ROLL-GRN'  WHERE sku = 'SL-20CM';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'  WHERE sku = 'SL-25CM';
UPDATE stock_ledger_v2 SET sku = 'BW-SL-CLR-100Mx33CMx3ROLL-GRN'  WHERE sku = 'SL-33CM';

-- ── 5. Sync sales_order_items_v2 ──
UPDATE sales_order_items_v2 SET sku = 'BW-DL-CLR-100Mx20CMx5ROLL-BLU'  WHERE sku = 'DL-20CM';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-CLR-100Mx25CMx4ROLL-BLU'  WHERE sku = 'DL-25CM';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-CLR-100Mx33CMx3ROLL-BLU'  WHERE sku = 'DL-33CM';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-CLR-100Mx100CMx1ROLL-YEL' WHERE sku = 'DL-FULL';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-CLR-100Mx50CMx2ROLL-BLU'  WHERE sku = 'DL-HALF';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-BLK-100Mx20CMx5ROLL-RED'  WHERE sku = 'DL-HITAM-20CM';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-BLK-100Mx25CMx4ROLL-RED'  WHERE sku = 'DL-HITAM-25CM';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-BLK-100Mx33CMx3ROLL-RED'  WHERE sku = 'DL-HITAM-33CM';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED' WHERE sku = 'DL-HITAM-FULL';
UPDATE sales_order_items_v2 SET sku = 'BW-DL-BLK-100Mx50CMx2ROLL-GRN'  WHERE sku = 'DL-HITAM-HALF';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-BLK-100Mx20CMx5ROLL-GRN'  WHERE sku = 'HITAM-20CM';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-BLK-100Mx25CMx4ROLL-GRN'  WHERE sku = 'HITAM-25CM';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-BLK-100Mx33CMx3ROLL-GRN'  WHERE sku = 'HITAM-33CM';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-BLK-100Mx100CMx1ROLL-GRN' WHERE sku = 'HITAM-FULL';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-BLK-100Mx50CMx2ROLL-RED'  WHERE sku = 'HITAM-HALF';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED' WHERE sku = 'MERAH';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-CLR-100Mx100CMx1ROLL-ORN' WHERE sku = 'OREN';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-SLV-100Mx100CMx1ROLL'     WHERE sku = 'SILVER-GREY';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-CLR-100Mx20CMx5ROLL-GRN'  WHERE sku = 'SL-20CM';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'  WHERE sku = 'SL-25CM';
UPDATE sales_order_items_v2 SET sku = 'BW-SL-CLR-100Mx33CMx3ROLL-GRN'  WHERE sku = 'SL-33CM';

-- ── 6. Sync machine_active_products ──
UPDATE machine_active_products SET product_sku = 'BW-DL-CLR-100Mx20CMx5ROLL-BLU'  WHERE product_sku = 'DL-20CM';
UPDATE machine_active_products SET product_sku = 'BW-DL-CLR-100Mx25CMx4ROLL-BLU'  WHERE product_sku = 'DL-25CM';
UPDATE machine_active_products SET product_sku = 'BW-DL-CLR-100Mx33CMx3ROLL-BLU'  WHERE product_sku = 'DL-33CM';
UPDATE machine_active_products SET product_sku = 'BW-DL-CLR-100Mx100CMx1ROLL-YEL' WHERE product_sku = 'DL-FULL';
UPDATE machine_active_products SET product_sku = 'BW-DL-CLR-100Mx50CMx2ROLL-BLU'  WHERE product_sku = 'DL-HALF';
UPDATE machine_active_products SET product_sku = 'BW-DL-BLK-100Mx20CMx5ROLL-RED'  WHERE product_sku = 'DL-HITAM-20CM';
UPDATE machine_active_products SET product_sku = 'BW-DL-BLK-100Mx25CMx4ROLL-RED'  WHERE product_sku = 'DL-HITAM-25CM';
UPDATE machine_active_products SET product_sku = 'BW-DL-BLK-100Mx33CMx3ROLL-RED'  WHERE product_sku = 'DL-HITAM-33CM';
UPDATE machine_active_products SET product_sku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED' WHERE product_sku = 'DL-HITAM-FULL';
UPDATE machine_active_products SET product_sku = 'BW-DL-BLK-100Mx50CMx2ROLL-GRN'  WHERE product_sku = 'DL-HITAM-HALF';
UPDATE machine_active_products SET product_sku = 'BW-SL-BLK-100Mx20CMx5ROLL-GRN'  WHERE product_sku = 'HITAM-20CM';
UPDATE machine_active_products SET product_sku = 'BW-SL-BLK-100Mx25CMx4ROLL-GRN'  WHERE product_sku = 'HITAM-25CM';
UPDATE machine_active_products SET product_sku = 'BW-SL-BLK-100Mx33CMx3ROLL-GRN'  WHERE product_sku = 'HITAM-33CM';
UPDATE machine_active_products SET product_sku = 'BW-SL-BLK-100Mx100CMx1ROLL-GRN' WHERE product_sku = 'HITAM-FULL';
UPDATE machine_active_products SET product_sku = 'BW-SL-BLK-100Mx50CMx2ROLL-RED'  WHERE product_sku = 'HITAM-HALF';
UPDATE machine_active_products SET product_sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED' WHERE product_sku = 'MERAH';
UPDATE machine_active_products SET product_sku = 'BW-SL-CLR-100Mx100CMx1ROLL-ORN' WHERE product_sku = 'OREN';
UPDATE machine_active_products SET product_sku = 'BW-SL-SLV-100Mx100CMx1ROLL'     WHERE product_sku = 'SILVER-GREY';
UPDATE machine_active_products SET product_sku = 'BW-SL-CLR-100Mx20CMx5ROLL-GRN'  WHERE product_sku = 'SL-20CM';
UPDATE machine_active_products SET product_sku = 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'  WHERE product_sku = 'SL-25CM';
UPDATE machine_active_products SET product_sku = 'BW-SL-CLR-100Mx33CMx3ROLL-GRN'  WHERE product_sku = 'SL-33CM';

-- ── 7. Clean up stale/invalid SKUs in machine_active_products ──
-- These are old-format SKUs from previous getBubbleWrapSku() that have no mapping
DELETE FROM machine_active_products
WHERE product_sku NOT IN (SELECT sku FROM master_items_v2)
  AND product_sku IS NOT NULL;

-- ── 8. Restore all FK constraints ──
ALTER TABLE stock_ledger_v2
    ADD CONSTRAINT stock_ledger_v2_sku_fkey
    FOREIGN KEY (sku) REFERENCES master_items_v2(sku);

ALTER TABLE sales_order_items_v2
    ADD CONSTRAINT sales_order_items_v2_sku_fkey
    FOREIGN KEY (sku) REFERENCES master_items_v2(sku);

ALTER TABLE machine_active_products
    ADD CONSTRAINT machine_active_products_product_sku_fkey
    FOREIGN KEY (product_sku) REFERENCES master_items_v2(sku);

COMMIT;
