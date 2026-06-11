-- Floor Plan: layout revision history + publish markers (optional)
-- Run in Supabase SQL Editor once. Safe to re-run (IF NOT EXISTS).

ALTER TABLE factory_zones
  ADD COLUMN IF NOT EXISTS layout_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_revision integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS factory_zone_layout_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id text NOT NULL REFERENCES factory_zones(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zone_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_factory_zone_layout_revisions_zone
  ON factory_zone_layout_revisions (zone_id, created_at DESC);
