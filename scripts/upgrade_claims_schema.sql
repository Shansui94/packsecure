-- Add financial fields to claims table
ALTER TABLE claims 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS invoice_no TEXT,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MYR',
ADD COLUMN IF NOT EXISTS receipt_date DATE;

-- Comment on columns for clarity
COMMENT ON COLUMN claims.company_name IS 'Merchant or Supplier Name from Receipt';
COMMENT ON COLUMN claims.invoice_no IS 'Invoice or Receipt Number for auditing';
COMMENT ON COLUMN claims.tax_amount IS 'Tax amount (SST/GST) extracted from receipt';
COMMENT ON COLUMN claims.receipt_date IS 'Actual date printed on the receipt';
