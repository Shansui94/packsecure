-- FIX: ENABLE REALTIME REPLICATION FOR PRODUCTION LOGS V2
-- This is strictly required for the Production Control UI to automatically
-- update the "Recent Activity" and "Live Production Counter" without reloading.

ALTER PUBLICATION supabase_realtime ADD TABLE public.production_logs_v2;
