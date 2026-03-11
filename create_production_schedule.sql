-- Production Schedule: Manager → Operator Task Dispatch
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS production_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    target_qty INT NOT NULL DEFAULT 100,
    scheduled_time TIMESTAMPTZ,
    notes TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In-Progress', 'Done', 'Cancelled')),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE production_schedule ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write
CREATE POLICY "All users can manage production_schedule"
ON production_schedule FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE production_schedule;
