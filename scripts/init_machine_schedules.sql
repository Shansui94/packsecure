-- Create the machine_schedules table
CREATE TABLE IF NOT EXISTS public.machine_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL, -- 'Morning', 'Night', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Establish basic indexing for frequent queries
CREATE INDEX IF NOT EXISTS idx_machine_schedules_date ON public.machine_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_machine_schedules_machine ON public.machine_schedules(machine_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.machine_schedules ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Allow anyone logged in to view schedules
CREATE POLICY "Enable read access for all authenticated users" 
ON public.machine_schedules FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users (Admin/Manager) to insert
CREATE POLICY "Enable insert for authenticated users" 
ON public.machine_schedules FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow authenticated users to update
CREATE POLICY "Enable update for authenticated users" 
ON public.machine_schedules FOR UPDATE 
TO authenticated 
USING (true);

-- Allow authenticated users to delete
CREATE POLICY "Enable delete for authenticated users" 
ON public.machine_schedules FOR DELETE 
TO authenticated 
USING (true);
