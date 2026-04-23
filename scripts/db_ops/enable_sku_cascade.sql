-- Enable CASCADE ON UPDATE for the foreign key so if admin modifies SKU Identity, the ledger follows along.

ALTER TABLE public.stock_ledger_v2
DROP CONSTRAINT IF EXISTS stock_ledger_v2_sku_fkey;

ALTER TABLE public.stock_ledger_v2
ADD CONSTRAINT stock_ledger_v2_sku_fkey 
FOREIGN KEY (sku) 
REFERENCES public.master_items_v2(sku) 
ON UPDATE CASCADE 
ON DELETE RESTRICT;
