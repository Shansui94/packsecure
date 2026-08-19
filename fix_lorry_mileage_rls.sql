-- Drop existing SELECT policies on lorry_mileage_logs to prevent conflicts
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.lorry_mileage_logs;
DROP POLICY IF EXISTS "Drivers can view own logs" ON public.lorry_mileage_logs;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.lorry_mileage_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.lorry_mileage_logs;
DROP POLICY IF EXISTS "Drivers can insert logs" ON public.lorry_mileage_logs;

-- Re-create a policy that allows ALL authenticated users to SELECT any mileage log.
-- This allows a new driver scanning a lorry to fetch the absolute latest mileage 
-- left by the PREVIOUS driver, fixing the false "huge jump" discrepancies.
CREATE POLICY "Enable read for authenticated users" 
ON public.lorry_mileage_logs
FOR SELECT 
TO authenticated 
USING (true);

-- Ensure drivers can still INSERT logs
CREATE POLICY "Enable insert for authenticated users" 
ON public.lorry_mileage_logs
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Ensure admin/management can UPDATE if necessary
CREATE POLICY "Enable update for authenticated users"
ON public.lorry_mileage_logs
FOR UPDATE
TO authenticated
USING (true);
