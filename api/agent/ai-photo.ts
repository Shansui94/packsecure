import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { imageBase64, mode } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image data required' });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server AI Key not configured' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 1. Fetch Dynamic Prompt from Database based on mode (fallback to code defaults)
        let prompt = "";
        const targetMode = mode || 'default';

        try {
            const { data } = await supabase
                .from('ai_prompt_configs')
                .select('prompt_template')
                .eq('mode', targetMode)
                .maybeSingle();
            
            if (data && data.prompt_template) {
                prompt = data.prompt_template;
                console.log(`Using database custom prompt for mode: ${targetMode}`);
            }
        } catch (dbErr) {
            console.error("Failed to fetch custom prompt from DB, using fallback", dbErr);
        }

        // 2. Fallback default prompts if DB is empty or fails
        if (!prompt) {
                        if (targetMode === 'scale' || targetMode === 'recycle') {
                prompt = `You are an industrial vision AI specialized in reading digital weighing scales and electronic platform scales in manufacturing plants.

TASK:
1. Locate the digital screen / LED / LCD display of the electronic weighing scale in the photo.
2. Accurately read the weight reading displayed on the scale.
   - Look at the digits and decimal point very carefully (e.g., 0015.60, 14.85, 12.30, 20.00, 15.10, 9.80).
   - In 7-segment LED/LCD displays, don't confuse 5 and 6, or 8 and 0, or 1 and 7.
   - Check if there are leading unlit zeros (e.g. 0014.50 means 14.50 kg).
   - Identify the unit (usually kg / 公斤).
3. If there is a bag/material on the scale, identify its type/color (SF.W, SF.B, BW.W, BW.B, MIX).

Return ONLY valid JSON (no markdown ticks):
{
  "scale_detected": true,
  "weight": 14.50,
  "unit": "kg",
  "digits_raw_seen": "14.50",
  "material_type": "SF.W",
  "confidence": 0.95,
  "description": "电子秤读数为 14.50 公斤"
}`;
            } else if (targetMode === 'defect') {
                prompt = `你是工厂管理系统的 AI 助手。请分析这张放在电子称重器上的缺陷产品照片。
            
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

只返回 JSON，不要有其他任何文字。`;
            } else if (targetMode === 'odometer') {
                prompt = `You are a professional AI vision assistant. Analyze this truck dashboard photo and extract the current Odometer / Mileage reading.
If the photo is too blurry, or if it is not a dashboard, return null for mileage.
Only return pure numbers, do not include 'km' or other units.

You MUST return a JSON format like this:
{
  "mileage": 123456
}`;
            } else if (targetMode === 'do') {
                prompt = `你是物流系统的 AI 助手。请分析这张司机上传的送货单（DO / Consignment Note / Invoice）照片。
            
                你的任务是识别并提取出照片中的送货单号码（DO Number / Consignment Note Number / Invoice Number 等）。
                通常，这个号码在页面顶部或右上角，旁边常有 "DO", "Invoice No", "Consignment Note No", "No.", "DO号码" 等标识。
                请尽最大努力识别该号码（如果包含字母和数字，请全部保留。如果是手写号码，也请尽力识别）。
                
                返回严格的 JSON 格式（不要包含 markdown 标记）：
                {
                  "do_number": "提取出的送货单号码（如果没找到，请返回空字符串）"
                }
                
                只返回 JSON，不要有其他任何文字。`;
            } else if (targetMode === 'sales_order') {
                prompt = `你是物流系统的 AI 助手。请分析这张包含送货订单信息、WhatsApp 聊天截图、送货单或者是手写单子的照片。
            
                你需要识别并从中提取出送货订单（Sales Orders）。
                返回一个严格的 JSON 数组（不要包含 markdown 标记），数组中的每个对象代表一个提取出的订单，必须包含以下字段：
                - "customer": 客户名称（如果未提及，可以根据上下文推断或返回空字符串）
                - "deliveryAddress": 详细送货地址
                - "deadline": 送货截止日期（格式 YYYY-MM-DD，如果未提及，默认写明天）
                - "notes": 任何特别备注、包装标记、或者是附加说明
                - "items": 包含的产品清单数组，每个产品对象包含：
                  - "product": 产品名称（如 stretch film / 缠绕膜 / bubble wrap / 气泡膜 等）
                  - "quantity": 产品数量（必须是纯数字，不要带单位）
                  - "remark": 产品规格描述（如 2 layer, sl, 20cm, 黑 等）
                
                如果包含多个订单或送往不同地址，请在 JSON 数组中返回多个对象。
                只返回 JSON，不要有其他任何文字。`;
            } else if (targetMode === 'recipe') {
                prompt = `你是工厂管理系统的 AI 助手。请分析这张拉伸膜原料配方照片，或解析下面输入的配方文本。
            
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

只返回 JSON，不要有其他文字。`;
            } else if (targetMode === 'carton') {
                prompt = `你是工厂管理系统的 AI 助手。请分析成品拉伸膜纸箱上的唛头、贴纸、印章或手写标示。
            
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

只返回 JSON，不要有其他文字。`;
            } else {
                prompt = `你是工厂管理系统的 AI 助手。请分析这张工厂/工作场景照片。

返回严格的 JSON 格式（不要包含 markdown 标记）：
{
  "description": "用中文简短描述照片中的工作场景 and 内容（30字以内）",
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

只返回 JSON，不要有其他文字。`;
            }
        }

        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
        ]);

        const response = await result.response;
        const text = response.text();

        if (!text) throw new Error("No data returned from AI");

        // Clean JSON wrapping
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        return res.status(200).json(parsed);

    } catch (e: any) {
        console.error("AI Photo Analysis Error:", e);
        return res.status(500).json({ error: e.message || "Photo analysis failed" });
    }
}
