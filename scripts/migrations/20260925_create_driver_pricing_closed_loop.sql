-- =========================================================================
-- Packsecure OS: AI 司机送货价格自检闭环系统核心表结构
-- File: scripts/migrations/20260925_create_driver_pricing_closed_loop.sql
-- =========================================================================

-- 1. pricing_rulebooks (Markdown 规则版本库)
CREATE TABLE IF NOT EXISTS public.pricing_rulebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type TEXT NOT NULL DEFAULT 'DRIVER_DELIVERY', -- 规则分类
    version TEXT NOT NULL,                             -- 版本号，如 v1.0, v1.1
    title TEXT NOT NULL DEFAULT '司机运费与送货价格计费真理库',
    content_md TEXT NOT NULL,                          -- 完整 Markdown 规则内容
    is_active BOOLEAN DEFAULT false,                   -- 当前是否在生产环境中生效
    changelog TEXT,                                    -- 变更日志（例如：增加居林工业区补贴）
    created_by TEXT DEFAULT 'HR',                      -- 创建/更新人
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. trip_rate_audits (车次运费审计流水表)
CREATE TABLE IF NOT EXISTS public.trip_rate_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id TEXT,                                      -- 车次唯一标识 (或聚合 key)
    trip_number TEXT,                                  -- 车次编号 (如 TRIP-20260925-001)
    driver_id TEXT,                                    -- 关联司机 User ID
    driver_name TEXT,                                  -- 司机姓名
    lorry_plate TEXT,                                  -- 车牌 (如 VPC 9821, APH 9821)
    origin TEXT NOT NULL DEFAULT 'TAIPING',            -- 出发地工厂 (TAIPING, NILAI, KELANTAN, JOHOR)
    delivery_addresses JSONB DEFAULT '[]'::jsonb,      -- 经停送货地址列表
    raw_address_summary TEXT,                          -- 原始地址拼接摘要
    drop_count INT DEFAULT 1,                          -- 落点数量
    
    -- 双轨运费计算结果
    legacy_rate NUMERIC(10,2) DEFAULT 0.00,            -- 老系统查表硬算结果
    ai_rate NUMERIC(10,2) DEFAULT 0.00,                -- AI 结合 MD 规则计算结果
    diff_amount NUMERIC(10,2) DEFAULT 0.00,            -- 差额 (ai_rate - legacy_rate)
    
    -- AI 决策证据链
    standardized_location TEXT,                        -- AI 识别的标准城市/工业区
    ai_zone TEXT,                                      -- 命中的计费区域阶梯
    rule_citations JSONB DEFAULT '[]'::jsonb,          -- 引用的 MD 规则章节条目
    confidence_score NUMERIC(4,2) DEFAULT 1.00,        -- 置信度 (0.00 ~ 1.00)
    ai_reasoning TEXT,                                 -- AI 一句话推导理由
    
    -- 状态与审核
    discrepancy_level TEXT DEFAULT 'AUTO_MATCH',       -- AUTO_MATCH, AI_ENRICHED, MINOR_DRIFT, HIGH_DISCREPANCY
    audit_status TEXT DEFAULT 'PENDING',               -- PENDING (待核验), APPROVED (已批准), ADJUSTED (已修正)
    approved_amount NUMERIC(10,2),                     -- HR 最终批准确认的金额
    hr_note TEXT,                                      -- HR 审核意见/调价原因
    reviewed_by TEXT,                                  -- HR 审核人
    reviewed_at TIMESTAMPTZ,
    
    stage TEXT DEFAULT 'POST_DELIVERY',                -- PRE_DISPATCH (排单预估) 或 POST_DELIVERY (送达核销)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. rate_feedback_cases (HR 纠错沉淀案例库 - 反哺自进化)
CREATE TABLE IF NOT EXISTS public.rate_feedback_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID REFERENCES public.trip_rate_audits(id) ON DELETE SET NULL,
    trip_id TEXT,
    address_text TEXT NOT NULL,
    lorry_plate TEXT,
    ai_rate NUMERIC(10,2),
    hr_rate NUMERIC(10,2),
    diff_amount NUMERIC(10,2),
    diff_reason TEXT,                                  -- HR 纠错原因（如：两州交界实为近郊）
    status TEXT DEFAULT 'UNABSORBED',                  -- UNABSORBED (待吸纳), ABSORBED (已合并入新规则)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引加速
CREATE INDEX IF NOT EXISTS idx_trip_rate_audits_trip_id ON public.trip_rate_audits(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_rate_audits_driver_id ON public.trip_rate_audits(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_rate_audits_status ON public.trip_rate_audits(audit_status);
CREATE INDEX IF NOT EXISTS idx_trip_rate_audits_discrepancy ON public.trip_rate_audits(discrepancy_level);
CREATE INDEX IF NOT EXISTS idx_pricing_rulebooks_active ON public.pricing_rulebooks(rule_type, is_active);

-- 开启 RLS
ALTER TABLE public.pricing_rulebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_rate_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_feedback_cases ENABLE ROW LEVEL SECURITY;

-- 允许认证用户与服务密钥完全读写
DROP POLICY IF EXISTS "Allow authenticated full access to pricing_rulebooks" ON public.pricing_rulebooks;
CREATE POLICY "Allow authenticated full access to pricing_rulebooks" ON public.pricing_rulebooks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read active pricing_rulebooks" ON public.pricing_rulebooks;
CREATE POLICY "Allow anon read active pricing_rulebooks" ON public.pricing_rulebooks FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "Allow authenticated full access to trip_rate_audits" ON public.trip_rate_audits;
CREATE POLICY "Allow authenticated full access to trip_rate_audits" ON public.trip_rate_audits FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to rate_feedback_cases" ON public.rate_feedback_cases;
CREATE POLICY "Allow authenticated full access to rate_feedback_cases" ON public.rate_feedback_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);
