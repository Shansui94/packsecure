import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const action = req.body?.action || req.query?.action || 'suggest';

        // =========================================================================
        // ACTION: RECORD CORRECTION (When HR manually edits price)
        // =========================================================================
        if (action === 'record-correction') {
            const {
                audit_id,
                trip_id,
                address_text,
                lorry_plate,
                ai_rate,
                hr_rate,
                diff_reason,
                reviewed_by = 'HR'
            } = req.body;

            if (!address_text || hr_rate === undefined) {
                return res.status(400).json({ error: 'address_text and hr_rate are required' });
            }

            const diffAmount = Number(hr_rate) - Number(ai_rate || 0);

            let caseId = null;
            try {
                const { data, error } = await supabase
                    .from('rate_feedback_cases')
                    .insert({
                        audit_id: audit_id || null,
                        trip_id: trip_id || null,
                        address_text,
                        lorry_plate: lorry_plate || null,
                        ai_rate: Number(ai_rate) || 0,
                        hr_rate: Number(hr_rate),
                        diff_amount: diffAmount,
                        diff_reason: diff_reason || 'HR人工复核修正',
                        status: 'UNABSORBED'
                    })
                    .select('id')
                    .maybeSingle();

                if (!error && data) caseId = data.id;
            } catch (ignore) {}

            // Also update trip_rate_audits if audit_id provided
            if (audit_id) {
                try {
                    await supabase
                        .from('trip_rate_audits')
                        .update({
                            audit_status: 'ADJUSTED',
                            approved_amount: Number(hr_rate),
                            hr_note: diff_reason,
                            reviewed_by,
                            reviewed_at: new Date().toISOString()
                        })
                        .eq('id', audit_id);
                } catch (ignore) {}
            }

            return res.status(200).json({
                success: true,
                caseId,
                message: '纠错案例已成功记入自检反馈库'
            });
        }

        // =========================================================================
        // ACTION: SUGGEST PATCH (Synthesize rules from unabsorbed cases)
        // =========================================================================
        let cases: any[] = [];
        try {
            const { data } = await supabase
                .from('rate_feedback_cases')
                .select('*')
                .eq('status', 'UNABSORBED')
                .order('created_at', { ascending: false })
                .limit(20);

            if (data && data.length > 0) {
                cases = data;
            }
        } catch (ignore) {}

        // If no DB cases, accept candidate cases from body if provided
        if (cases.length === 0 && Array.isArray(req.body?.customCases) && req.body.customCases.length > 0) {
            cases = req.body.customCases;
        }

        if (cases.length === 0) {
            return res.status(200).json({
                success: true,
                hasSuggestions: false,
                message: '当前暂无未吸纳的 HR 人工纠错记录，现有 Markdown 规则运行平稳。',
                suggestions: []
            });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                success: true,
                hasSuggestions: true,
                suggestions: [
                    {
                        title: '待吸纳纠错提示',
                        markdownPatch: `- 检测到 ${cases.length} 笔人工调价记录，请参阅反馈历史手动补充对应条款。`,
                        affectedCasesCount: cases.length
                    }
                ]
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.2,
                topP: 0.9
            }
        });

        const caseSummaries = cases.map((c, i) =>
            `${i + 1}. 地址: "${c.address_text}" | 车牌: ${c.lorry_plate || '标准'} | AI初核: RM${c.ai_rate} -> HR纠正为: RM${c.hr_rate} | 原因: "${c.diff_reason || '无备注'}"`
        ).join('\n');

        const prompt = `你是 Packsecure 运费真理库的 AI 优化顾问。
近期 HR 在日常核对运费时，对 AI 的自动计算结果进行了以下人工修正 (Badcases)：

${caseSummaries}

请分析这些人工修正案例的共性模式（例如：某些新工业区边界、特定小车费率、常去客户的约定特惠价），并提炼出 1 至 3 条规范、简练且可直接追加到《Driver_Pricing_Rules.md》中的 Markdown 条款补丁。

必须返回纯 JSON 格式（不得带有任何 markdown 代码块标识如 \`\`\`json 或 \`\`\`）：
{
  "hasSuggestions": true,
  "summary": "分析摘要（例如：发现 3 笔纠错均集中在居林高科技园四期，HR 认为离主干道较近应按 RM 150 计算）",
  "suggestions": [
    {
      "title": "规则补丁标题",
      "targetSection": "建议插入的章节（例如：第 2.3 节 或 第 4 节地名消歧）",
      "markdownPatch": "- **Kulim Hi-Tech Park Phase 4 / 居林四期**：基准价调整为 RM 150，免费落点 3 点（靠近高速主干道特惠）。",
      "explanation": "解释为什么添加该条款及解决的问题"
    }
  ]
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);

        return res.status(200).json({
            success: true,
            unabsorbedCount: cases.length,
            caseIds: cases.map(c => c.id).filter(Boolean),
            ...parsed
        });

    } catch (e: any) {
        console.error('[suggest-rule-patch] Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to generate rule patches' });
    }
}
