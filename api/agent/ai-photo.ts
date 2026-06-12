import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image data required' });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server AI Key not configured' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `你是工厂管理系统的 AI 助手。请分析这张工厂/工作场景照片。

返回严格的 JSON 格式（不要包含 markdown 标记）：
{
  "description": "用中文简短描述照片中的工作场景和内容（30字以内）",
  "category": "production 或 maintenance 或 safety 或 logistics 或 cleaning 或 other",
  "tags": ["最多5个中文标签"],
  "risk_flag": false,
  "risk_reason": ""
}

分类说明：
- production = 生产相关（机器运行、产品加工、包装等）
- maintenance = 设备维修维护
- safety = 安全检查、安全隐患
- logistics = 物流、搬运、装卸
- cleaning = 清洁卫生
- other = 其他

风险检测：
- 如果看到未戴安全帽、地面湿滑、电线外露、物品堆放不安全等，设 risk_flag=true
- risk_reason 用中文简述原因

只返回 JSON，不要有其他文字。`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
        ]);

        const response = await result.response;
        const text = response.text();

        if (!text) throw new Error("No data returned from AI");

        const cleanJson = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        return res.status(200).json(parsed);

    } catch (e: any) {
        console.error("AI Photo Analysis Error:", e);
        return res.status(500).json({ error: e.message || "Photo analysis failed" });
    }
}
