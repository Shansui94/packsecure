-- 1. Create AI Prompt Configuration Table
CREATE TABLE IF NOT EXISTS public.ai_prompt_configs (
    mode TEXT PRIMARY KEY,
    prompt_template TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT
);

-- Seed Default Prompt Templates
INSERT INTO public.ai_prompt_configs (mode, prompt_template) VALUES
('default', '你是工厂管理系统的 AI 助手。请分析这张工厂/工作场景照片。

返回严格的 JSON 格式（不要包含 markdown 标记）：
{
  "description": "用中文简短描述照片中的工作场景和内容（30字以内）",
  "category": "qc 或 defect 或 downtime 或 startup 或 other",
  "tags": ["最多5个中文标签"],
  "risk_flag": false,
  "risk_reason": ""
}

分类说明：
- qc = 质检相关（质量检查、QC巡检、首件确认等）
- defect = 次品、不良品、有缺陷的产品或废料
- downtime = 设备停机、待料、设备异常中断或保养暂停等
- startup = 开机运行、启动设备、正常生产运转等
- other = 其他非生产性的常规工作或场景

风险检测：
- 如果看到未戴安全帽、地面湿滑、电线外露、物品堆放不安全等，设 risk_flag=true
- risk_reason 用中文简述原因

只返回 JSON，不要有其他文字。'),

('defect', '你是工厂管理系统的 AI 助手。请分析这张放在电子称重器上的缺陷产品照片。
            
你需要重点定位照片中的电子秤屏幕，读取并提取其显示的数字重量值（必须是一个数字，例如 10.90，不要带单位。如果读不出来，返回 0），并诊断或识别产品的缺陷原因。

返回严格的 JSON 格式（不要包含 markdown 标记）：
{
  "description": "用英文简短描述照片中的产品和缺陷（30字以内）",
  "category": "defect",
  "tags": ["最多5个英文标签"],
  "risk_flag": true,
  "risk_reason": "Defect product recorded",
  "weight": 10.90,
  "defect_reason": "underweight 或 deformation 或 damage 或 other"
}

缺陷原因分类说明：
- underweight = 重量不足/克重不足
- deformation = 变形/几何尺寸不符
- damage = 破损/划伤/污染
- other = 其他缺陷

只返回 JSON，不要有其他任何文字。'),

('recipe', '你是工厂管理系统的 AI 助手。请分析这张拉伸膜原料配方照片，或解析下面输入的配方文本。
            
你需要从原料袋子上的标识或者文本中，识别并提取配方名称与原材料清单：
- 配方名称（如 Sf(clear), Sf(black) 等）
- 原材料代码和数量。如果只写了代码和等于号数字（如 C1802=10, Oren=5），通常代表投料袋数，其默认单位为袋（bag），袋装原料标准单重是 25kg。
- 如果写了重量（如 Glus=1.5kg），则代表实际公斤重，单位为 kg。
- 自动计算投入总重量（kg）：总重 = 树脂袋数 * 25 + 胶水及其他实际重量。

返回严格的 JSON 格式（不要包含 markdown 标记）：
{
  "recipe_name": "Sf(clear)",
  "materials": [
    { "code": "C1802", "quantity": 10, "unit": "bag" },
    { "code": "Oren", "quantity": 5, "unit": "bag" },
    { "code": "Glus", "quantity": 1.5, "unit": "kg" }
  ],
  "total_input_weight_kg": 376.5
}

只返回 JSON，不要有其他文字。'),

('carton', '你是工厂管理系统的 AI 助手。请分析成品拉伸膜纸箱上的唛头、贴纸、印章或手写标示。
            
你需要从中识别并提取以下成品包装信息：
- 产品规格或 SKU（例如 500mm x 150m, SF-500-150-18-CLR 等）
- 每箱包含的卷数（例如 6 Rolls, 6卷 等）
- 纸箱毛重 Gross Weight（数字，单位 kg）
- 纸箱净重 Net Weight（数字，单位 kg，即不含外纸箱的净重）
- 产品颜色（如 Clear 或 Black）

返回严格的 JSON 格式（不要包含 markdown 标记）：
{
  "sku": "SF-500-150-18-CLR",
  "rolls_per_carton": 6,
  "gross_weight": 14.5,
  "net_weight": 12.3,
  "color": "Clear"
}

只返回 JSON，不要有其他文字。')
ON CONFLICT (mode) DO UPDATE SET prompt_template = EXCLUDED.prompt_template;


-- 2. Create Raw Material Inputs Table
CREATE TABLE IF NOT EXISTS public.production_material_inputs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    machine_id TEXT NOT NULL REFERENCES public.sys_machines_v2(machine_id),
    operator_id TEXT,
    operator_name TEXT,
    recipe_name TEXT NOT NULL,
    materials JSONB NOT NULL,
    total_weight NUMERIC NOT NULL,
    photo_url TEXT,
    user_note TEXT
);


-- 3. Create Production Metrics Calibration Table
CREATE TABLE IF NOT EXISTS public.production_metrics_calibration (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    machine_id TEXT NOT NULL REFERENCES public.sys_machines_v2(machine_id),
    operator_id TEXT,
    operator_name TEXT,
    sku TEXT NOT NULL,
    set_length NUMERIC NOT NULL,
    producing_speed NUMERIC,
    temp_zone1 NUMERIC,
    temp_zone2 NUMERIC,
    gross_weight NUMERIC NOT NULL,
    net_weight NUMERIC NOT NULL,
    rolls_count INT DEFAULT 1,
    is_outlier BOOLEAN DEFAULT false,
    deviation_percent NUMERIC,
    photo_url TEXT,
    ai_raw_json JSONB,
    final_submitted_weight NUMERIC
);


-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ai_prompt_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_material_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics_calibration ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Policies (matching work_photos)
DROP POLICY IF EXISTS "Allow public read ai_prompt_configs" ON public.ai_prompt_configs;
CREATE POLICY "Allow public read ai_prompt_configs" ON public.ai_prompt_configs 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert update ai_prompt_configs" ON public.ai_prompt_configs;
CREATE POLICY "Allow public insert update ai_prompt_configs" ON public.ai_prompt_configs 
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read production_material_inputs" ON public.production_material_inputs;
CREATE POLICY "Allow public read production_material_inputs" ON public.production_material_inputs 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert production_material_inputs" ON public.production_material_inputs;
CREATE POLICY "Allow public insert production_material_inputs" ON public.production_material_inputs 
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read production_metrics_calibration" ON public.production_metrics_calibration;
CREATE POLICY "Allow public read production_metrics_calibration" ON public.production_metrics_calibration 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert production_metrics_calibration" ON public.production_metrics_calibration;
CREATE POLICY "Allow public insert production_metrics_calibration" ON public.production_metrics_calibration 
    FOR ALL USING (true) WITH CHECK (true);
