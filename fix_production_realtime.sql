-- Enable Supabase Realtime for production_logs table
-- Run this in Supabase SQL Editor if the Live Production counter is not updating

-- 1. Enable realtime on production_logs
ALTER PUBLICATION supabase_realtime ADD TABLE production_logs;

-- 2. Make sure RLS doesn't block realtime (allow select for authenticated users)
-- If RLS is enabled and no SELECT policy exists for authenticated users, add one:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'production_logs'
        AND cmd = 'SELECT'
        AND roles::text LIKE '%authenticated%'
    ) THEN
        EXECUTE 'CREATE POLICY "Allow authenticated users to read production_logs"
            ON production_logs FOR SELECT
            TO authenticated
            USING (true)';
    END IF;
END $$;
