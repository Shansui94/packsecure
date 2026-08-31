-- ==========================================
-- Migration: Create Driver Locations Table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.driver_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(driver_id) -- 每个司机只保留最新的一条记录（UPSERT）
);

-- 设置行级安全 (RLS)
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- 允许所有通过身份验证的用户查看位置（例如调度员）
CREATE POLICY "Enable read access for all authenticated users" ON public.driver_locations
    FOR SELECT USING (auth.role() = 'authenticated');

-- 允许司机插入和更新自己的位置
CREATE POLICY "Enable insert for users based on user_id" ON public.driver_locations
    FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Enable update for users based on user_id" ON public.driver_locations
    FOR UPDATE USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

-- 将表加入 Supabase 实时监听 (Realtime)
-- REPLICA IDENTITY FULL 确保 UPDATE 时触发器能拿到完整数据
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;

-- (注: 必须在 Supabase Dashboard 开启表的 Realtime, 或者运行 supabase 提供的内置函数开启)
BEGIN;
  -- 添加 driver_locations 到 supabase_realtime publication
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'driver_locations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
    END IF;
  END
  $$;
COMMIT;
