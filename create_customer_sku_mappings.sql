-- 创建客户 SKU 别名映射记忆表
CREATE TABLE IF NOT EXISTS public.customer_sku_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    raw_product_name TEXT NOT NULL,
    mapped_sku TEXT NOT NULL,
    mapped_product_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT customer_sku_mappings_unique UNIQUE (customer_name, raw_product_name)
);

-- 开启 RLS
ALTER TABLE public.customer_sku_mappings ENABLE ROW LEVEL SECURITY;

-- 允许匿名与已认证的所有操作（由于是内网辅助记忆，这里设为完全开放）
CREATE POLICY "Allow all access to customer_sku_mappings" ON public.customer_sku_mappings
    FOR ALL USING (true) WITH CHECK (true);
