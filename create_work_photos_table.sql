-- Work Photos Table
CREATE TABLE IF NOT EXISTS work_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  ai_description TEXT,
  user_note TEXT,
  category TEXT DEFAULT 'other',
  ai_tags TEXT[] DEFAULT '{}',
  risk_flag BOOLEAN DEFAULT FALSE,
  risk_reason TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE work_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read" ON work_photos FOR SELECT USING (true);
CREATE POLICY "Allow service insert" ON work_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON work_photos FOR UPDATE USING (true);
CREATE POLICY "Allow service delete" ON work_photos FOR DELETE USING (true);

-- Index for timeline queries
CREATE INDEX idx_work_photos_created ON work_photos(created_at DESC);
CREATE INDEX idx_work_photos_category ON work_photos(category);
