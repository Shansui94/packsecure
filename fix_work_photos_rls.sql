-- Quick fix: disable RLS on work_photos to allow all operations
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE work_photos DISABLE ROW LEVEL SECURITY;
