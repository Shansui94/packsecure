-- Add base_location to users_public table for Trip Management location splitting
ALTER TABLE users_public 
ADD COLUMN IF NOT EXISTS base_location text DEFAULT 'Taiping';

-- Add a comment to the column for future reference
COMMENT ON COLUMN users_public.base_location IS 'Assigned location for the driver/user (e.g. Taiping, Nilai). Used for filtering in Trip Management.';
