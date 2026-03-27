--  ====================================================================
--  FINAL CLEANUP SCRIPT: DROP ALL UNUSED GHOST TABLES (V1 & V2)
--  ====================================================================
--  This script safely deletes all duplicate/ghost tables that have
--  zero references in the current production codebase stringing.
--  ====================================================================

-- 🗑️ 1. THESE ARE V1 TABLES THAT WERE SUCCESSFULLY REPLACED BY V2
-- The system strictly uses their `_v2` counterparts now.
DROP TABLE IF EXISTS public.bom_headers CASCADE;
DROP TABLE IF EXISTS public.bom_items CASCADE;
DROP TABLE IF EXISTS public.crm_partners CASCADE;
DROP TABLE IF EXISTS public.factories CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.factory_inventory CASCADE; -- <-- NEWLY ADDED

-- 🗑️ 2. THESE ARE V2 TABLES (AND VIEWS) THAT WERE NEVER DEPLOYED/USED
-- The system strictly uses their original V1 counterparts safely.
DROP TABLE IF EXISTS public.sales_orders_v2 CASCADE;
DROP TABLE IF EXISTS public.sales_order_items_v2 CASCADE;
DROP TABLE IF EXISTS public.job_orders_v2 CASCADE;
DROP TABLE IF EXISTS public.crm_price_lists_v2 CASCADE;
DROP TABLE IF EXISTS public.crm_partners_v2 CASCADE; -- <-- NEW: CRM module fully deprecated
DROP TABLE IF EXISTS public.sys_vehicles_v2 CASCADE; -- <-- NEW: The active table is `sys_vehicles`
DROP TABLE IF EXISTS public.sys_factories_v2 CASCADE; -- <-- NEW: The active table is `sys_locations_v2`
DROP TABLE IF EXISTS public.zone_trip_rates CASCADE; -- <-- NEW: The active table is `delivery_rates`

-- 🗑️ 3. ABANDONED LOGISTICS ARCHITECTURE (Replaced by `sales_orders`)
DROP TABLE IF EXISTS public.logistics_deliveries_v2 CASCADE;
DROP TABLE IF EXISTS public.logistics_delivery_orders CASCADE;
DROP TABLE IF EXISTS public.logistics_trips CASCADE;
DROP TABLE IF EXISTS public.delivery_items_v2 CASCADE; -- <-- NEW: Delivery items are stored as JSONB in `sales_orders`

-- 🗑️ 4. EXPERIMENTAL MACHINE LOGS
DROP TABLE IF EXISTS public.machine_live_output CASCADE; -- <-- NEW: 0 references in code
DROP TABLE IF EXISTS public.maintenance_logs CASCADE; -- <-- NEW: 0 references in code

DROP VIEW IF EXISTS public.v2_inventory_snapshot CASCADE; -- <-- The active view is `v2_inventory_view`
DROP VIEW IF EXISTS public.v2_reserved_stock CASCADE; -- <-- NEW: Unused draft view

-- Note: CASCADE ensures any remaining triggers or references linked 
-- to these ghost tables are also automatically deleted.
