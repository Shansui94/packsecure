-- Migration: 20260830_william_dashboard_pipeline.sql
-- Description: Sets up William's Document Ingestion, Routing, AI Extraction, and 12-Month Executive Dashboard Metrics Tables

-- 1. Document Manifest Entities (Expense & Operational Metric Categories)
CREATE TABLE IF NOT EXISTS public.document_manifest_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_key TEXT UNIQUE NOT NULL,
    section TEXT NOT NULL, -- 'FLEET' | 'COMPANY' | 'PRODUCTION' | 'SALES'
    owner TEXT NOT NULL,   -- 'AMY' | 'WINNIE' | 'MAX TAN' | 'YUAN YUAN'
    folder_slug TEXT NOT NULL,
    aliases JSONB DEFAULT '[]'::jsonb,
    data_source TEXT DEFAULT 'PDF_EXTRACT', -- 'PDF_EXTRACT' | 'SYSTEM_LIVE' | 'MANUAL'
    unit TEXT DEFAULT 'RM',
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Extracted Documents (Header Information)
CREATE TABLE IF NOT EXISTS public.extracted_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    category_key TEXT,
    entity_name TEXT,
    owner TEXT,
    doc_type TEXT DEFAULT 'INVOICE',
    doc_number TEXT,
    doc_date DATE,
    period_year INT,
    period_month INT,
    currency TEXT DEFAULT 'MYR',
    subtotal_amount NUMERIC,
    tax_amount NUMERIC,
    total_amount NUMERIC,
    payment_terms TEXT,
    notes TEXT,
    confidence_score NUMERIC DEFAULT 1.0,
    status TEXT DEFAULT 'Uploaded',
    raw_ai_response JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Extracted Document Items (Line Items)
CREATE TABLE IF NOT EXISTS public.extracted_document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.extracted_documents(id) ON DELETE CASCADE,
    line_number INT DEFAULT 1,
    item_description TEXT,
    sku_match TEXT,
    quantity NUMERIC DEFAULT 1,
    uom TEXT,
    unit_price NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. William Dashboard 12-Month Metrics (Aggregated Matrix Snapshots)
CREATE TABLE IF NOT EXISTS public.william_dashboard_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    category_key TEXT NOT NULL,
    metric_value NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'RM',
    source_type TEXT DEFAULT 'AUTO_EXTRACTED',
    document_id UUID,
    file_url TEXT,
    notes TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(year, month, category_key)
);

-- 5. Document Processing Logs (Pipeline Audit Trail)
CREATE TABLE IF NOT EXISTS public.document_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID,
    file_name TEXT,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    execution_time_ms INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable Row Level Security
ALTER TABLE public.document_manifest_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.william_dashboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_processing_logs ENABLE ROW LEVEL SECURITY;

-- 7. Create Policies
DROP POLICY IF EXISTS "manifest_entities_policy" ON public.document_manifest_entities;
CREATE POLICY "manifest_entities_policy" ON public.document_manifest_entities FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "extracted_documents_policy" ON public.extracted_documents;
CREATE POLICY "extracted_documents_policy" ON public.extracted_documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "extracted_items_policy" ON public.extracted_document_items;
CREATE POLICY "extracted_items_policy" ON public.extracted_document_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "william_metrics_policy" ON public.william_dashboard_metrics;
CREATE POLICY "william_metrics_policy" ON public.william_dashboard_metrics FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "processing_logs_policy" ON public.document_processing_logs;
CREATE POLICY "processing_logs_policy" ON public.document_processing_logs FOR ALL USING (true) WITH CHECK (true);

-- 8. Seed Default 14 Categories for William's Dashboard
INSERT INTO public.document_manifest_entities (name, category_key, section, owner, folder_slug, aliases, data_source, unit, notes)
VALUES
  ('Petrol History (油费支出)', 'PETROL_FLEET', 'FLEET', 'AMY', 'fleet/petrol', '["Petronas", "Shell", "Caltex", "Petron", "Fleet Card", "Diesel", "Petrol", "Minyak", "SmartPay"]'::jsonb, 'PDF_EXTRACT', 'RM', 'Petrol history from jan - dec'),
  ('TnGo History (过路费支出)', 'TNGO_TOLL', 'FLEET', 'AMY', 'fleet/tngo', '["Touch ''n Go", "TnG", "RFID", "PLUS", "Toll", "Kad Touch ''n Go", "TNG Digital", "Tag RFID"]'::jsonb, 'PDF_EXTRACT', 'RM', 'Tngo history from jan-dec'),
  ('Service Cost (保养维修)', 'LORRY_SERVICE', 'FLEET', 'AMY', 'fleet/lorry_service', '["Workshop", "Service", "Tyre", "Tayar", "Lorry Repair", "Spare Parts", "Minyak Hitam", "Invois Bengkel", "Bengkel", "Pusat Servis"]'::jsonb, 'PDF_EXTRACT', 'RM', 'Service cost from jan - dec'),
  ('Puspakom & Insurance (验车保费)', 'PUSPAKOM_INSURANCE', 'FLEET', 'AMY', 'fleet/puspakom_insurance', '["Puspakom", "Insurans", "Insurance", "Roadtax", "Cukai Jalan", "Kurnia", "Allianz", "Etiqa", "Takaful", "Polisi"]'::jsonb, 'PDF_EXTRACT', 'RM', 'Puspakom & insurance cost from jan - dec'),
  
  ('Total AutoCount Sales (销售总额)', 'AUTOCOUNT_SALES', 'COMPANY', 'WINNIE', 'sales/autocount', '["AutoCount", "Sales Summary", "Monthly Sales Listing", "Sales Invoice Batch", "Sales Report"]'::jsonb, 'PDF_EXTRACT', 'RM', 'Total Auto Count Sales from AutoCount software'),
  ('Shopee Sales (Shopee 销售额)', 'SHOPEE_SALES', 'COMPANY', 'WINNIE', 'sales/shopee', '["Shopee", "Shopee Order Report", "Income Statement Shopee", "Shopee Seller", "Shopee Pay"]'::jsonb, 'PDF_EXTRACT', 'RM', 'Shopee e-commerce monthly sales'),
  ('Stock Balance Analysis (库存结存分析)', 'STOCK_BALANCE', 'COMPANY', 'WINNIE', 'inventory/stock_balance', '["Stock Balance", "Inventory Balance", "Stok Semasa"]'::jsonb, 'SYSTEM_LIVE', 'Rolls', 'Auto-calculated from live_stock & factory_inventory'),
  ('Trip By States (各州出车班次)', 'TRIP_BY_STATES', 'COMPANY', 'MAX TAN', 'logistics/trip_by_states', '["Trip by States", "Lorry Trips", "Trip Report"]'::jsonb, 'SYSTEM_LIVE', 'Trips', 'Auto-calculated from logistics_trips & sales_orders'),
  
  ('Recycle Amount (回收造粒量)', 'RECYCLE_AMOUNT', 'PRODUCTION', 'MAX TAN', 'production/recycle', '["Recycle Machine", "Recycle Output", "Biji Recycle", "T5", "N3"]'::jsonb, 'SYSTEM_LIVE', 'kg', 'Auto-aggregated from T5 & N3 machine production logs'),
  ('SF Defect Amount (缠绕膜废料损耗)', 'SF_DEFECT_AMOUNT', 'PRODUCTION', 'MAX TAN', 'production/sf_defect', '["SF Defect", "Stretch Film Defect", "Scrap", "Waste", "Bahan Rosak"]'::jsonb, 'SYSTEM_LIVE', 'kg', 'Auto-aggregated from stretch film machine scrap logs'),
  ('Electricity Bill (TNB 电费)', 'ELECTRICITY_BILL', 'PRODUCTION', 'WINNIE', 'utilities/electricity', '["Tenaga Nasional", "TNB", "Electricity", "Elektrik", "Bil Elektrik", "Tarif Industri", "KWh"]'::jsonb, 'PDF_EXTRACT', 'RM', 'yuan yuan - update monthly'),
  ('Water Bill (水费账单)', 'WATER_BILL', 'PRODUCTION', 'WINNIE', 'utilities/water', '["Lembaga Air Perak", "LAP", "Air Selangor", "SAMB", "SAJ", "Air Kelantan", "Bil Air", "Water Bill"]'::jsonb, 'PDF_EXTRACT', 'RM', 'yuan yuan - update monthly'),
  ('Myanmar Salary Analysis (外劳薪资)', 'MYANMAR_SALARY', 'PRODUCTION', 'AMY', 'payroll/myanmar_salary', '["Myanmar Salary", "Gaji Pekerja Asing", "Worker Payroll", "Hostel Allowance", "Foreign Workers", "Gaji Myanmar"]'::jsonb, 'PDF_EXTRACT', 'RM', 'yuan yuan - update monthly'),
  ('Machine Expenses (机台维修备件)', 'MACHINE_EXPENSES', 'PRODUCTION', 'AMY', 'production/machine_expenses', '["Extruder", "Machine Part", "Screw Barrel", "Heater Band", "Gearbox", "Inverter", "Die Head", "Sparepart Mesin"]'::jsonb, 'PDF_EXTRACT', 'RM', 'yuan yuan - update monthly')
ON CONFLICT (category_key) DO UPDATE SET
  name = EXCLUDED.name,
  section = EXCLUDED.section,
  owner = EXCLUDED.owner,
  folder_slug = EXCLUDED.folder_slug,
  aliases = EXCLUDED.aliases,
  data_source = EXCLUDED.data_source,
  unit = EXCLUDED.unit,
  notes = EXCLUDED.notes;
