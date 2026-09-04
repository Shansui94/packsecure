-- Migration: Add photo_url to master_items_v2
-- Purpose: Store global standard packaging photo for Raw Materials and Finished Goods (Poka-Yoke Anti-error)

ALTER TABLE IF EXISTS public.master_items_v2 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.master_items_v2.photo_url IS 'Standard packaging or item photo URL for anti-error verification (Poka-Yoke)';
