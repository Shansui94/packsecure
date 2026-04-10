-- migration to add driver photo and pick up job tracking
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS proof_of_load_url TEXT,
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'Delivery';

UPDATE sales_orders SET job_type = 'Delivery' WHERE job_type IS NULL;
