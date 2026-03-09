-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.sop_articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text DEFAULT '',
    content text DEFAULT '',
    video_url text DEFAULT '',
    page_id text DEFAULT '',
    target_roles text[] DEFAULT ARRAY[]::text[],
    sort_order int DEFAULT 0,
    is_published boolean DEFAULT true,
    created_by text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sop_articles ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read (the app filters by role in JS)
CREATE POLICY sop_read_all ON public.sop_articles FOR SELECT USING (true);
-- Allow inserts
CREATE POLICY sop_insert_all ON public.sop_articles FOR INSERT WITH CHECK (true);
-- Allow updates
CREATE POLICY sop_update_all ON public.sop_articles FOR UPDATE USING (true) WITH CHECK (true);
-- Allow deletes
CREATE POLICY sop_delete_all ON public.sop_articles FOR DELETE USING (true);
