-- LogisticsCoordinator: DB-driven menu (replaces Vivian email hardcoding)
-- Run in Supabase SQL Editor, then assign users in HR Portal → Permissions / user role.

INSERT INTO role_permissions (role_name, page_id, allowed) VALUES
  ('LogisticsCoordinator', 'profile', true),
  ('LogisticsCoordinator', 'construction', true),
  ('LogisticsCoordinator', 'dashboard', true),
  ('LogisticsCoordinator', 'livestock', true),
  ('LogisticsCoordinator', 'delivery', true),
  ('LogisticsCoordinator', 'order-summary', true),
  ('LogisticsCoordinator', 'products', true),
  ('LogisticsCoordinator', 'maintenance', true),
  ('LogisticsCoordinator', 'driver-management', true),
  ('LogisticsCoordinator', 'leave-calendar', true),
  ('LogisticsCoordinator', 'personal-report', true),
  ('LogisticsCoordinator', 'activity-logs', true)
ON CONFLICT (role_name, page_id) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Or run: node scripts/db_ops/apply_logistics_coordinator.mjs

-- Manual assign (uncomment if not using the script):
-- UPDATE users_public SET role = 'LogisticsCoordinator' WHERE email = 'diyadmin1111@gmail.com';
-- UPDATE sys_users_v2 SET role = 'LogisticsCoordinator' WHERE email = 'diyadmin1111@gmail.com';
