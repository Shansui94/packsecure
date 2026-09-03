import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

// PackSecure OS Domain Knowledge & Factory Context
const PACKSECURE_DOMAIN_KNOWLEDGE = `
[PackSecure 厂区与核心机台档案]
1. Taiping 太平厂区 (T1):
   - T1.1-M03: Stretch Film (拉伸膜/缠绕膜生产线)
   - T1.2-M01: 2M Double Layer Bubblewrap (2米双层气泡膜机)
   - T1.3-M02: 1M Single Layer Bubblewrap (1米单层气泡膜机)
2. Nilai 汝来厂区 (N1, N2):
   - N1-M01: 1M Double Layer Bubblewrap (1米双层气泡膜机)
   - N2-M02: 1M Single Layer Bubblewrap (1米单层气泡膜机)
3. 造粒与混料 (Material Recycling & Extrusion):
   - 多螺杆混料机、再生料破碎与造粒机、母粒与回料配比控制。

[PackSecure OS 系统模块映射]
- scanner: 生产控制台 (操作工扫机台二维码、开工计数、报工、停机异常上报)
- raw_material_mobile: 混料与多螺杆 (原料称重、回料投入比例与批次追踪)
- livestock: 实时成品与半成品库存看板
- inventory: 全局库存主表
- stock-movement: 库位转移与物料调拨
- stock-audit: 仓库月度/季度实物盘点
- delivery-driver: 司机端移动门户 (开工扫卡车QR绑定、到达客户点拍送货单DO+货物双照片、回厂扫车上QR还车解绑)
- delivery: 调度中心出货排单与派车管理
- order-summary: 每日备货与配货看板
- lorry-service: 车队保养与维修记录
- leave-calendar: 员工请假日历与请假提交
- hr: HR 人事控制中心 (员工入职、考勤假期审核、报销核验)
- machine-schedule: 生产排程与机台计划
- machine-labels: 机器二维码标签打印与张贴
- floor-plan: 车间平面布局图

[角色分类 (Roles)]
- SuperAdmin: 系统超级管理员
- Admin: 系统管理员
- Manager: 生产厂长 / 车间主管 / 物流主管
- Operator: 一线生产操作工 / 混料工
- Driver: 配送卡车司机
- HR: 人事行政主管
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const {
            action = 'generate', // 'generate' | 'polish' | 'safety_alerts' | 'translate' | 'checklist'
            topic = '',
            existingContent = '',
            language = 'zh', // 'zh' | 'zh-bm' | 'zh-en'
            sopType = 'standard', // 'standard' | 'troubleshooting' | 'safety' | 'delivery'
            category = 'production',
            targetRoles = [],
            pageId = ''
        } = req.body;

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Google Gemini API Key not configured on server.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const candidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

        let systemInstruction = `
你是一位专精于包装制造业（气泡膜 Bubblewrap、拉伸膜 Stretch Film、原料再生造粒）与车间数字化的资深工业工程 (IE) 专家和精益生产总监。
你正在协助 PackSecure OS 系统的工厂高管（厂长、生产总监、物流经理、HR）撰写高标准、符合工厂实际落地的标准作业规程 (SOP)。

${PACKSECURE_DOMAIN_KNOWLEDGE}

[核心输出准则]
1. 语言模式：
   - 当 language 为 'zh' 时：采用严谨、易读、专业的中文。
   - 当 language 为 'zh-bm' 时：生成中马双语对照（中文标题/说明，下方附带马来文斜体或并列对照，如 "步骤一：开机准备 / Langkah 1: Persediaan Memulakan Mesin"），极适合马来西亚一线工人与外籍劳工。
   - 当 language 为 'zh-en' 时：生成中英双语对照。
2. 排版规范：
   - 必须使用标准 Markdown。
   - 适当运用 GitHub 风格警示块：
     > [!NOTE] 背景或目的说明
     > [!TIP] 老师傅操作技巧或防呆提示
     > [!IMPORTANT] 关键工艺参数或核心必检项
     > [!WARNING] 设备易损点或易漏操作
     > [!CAUTION] 人身安全高危点、急停按钮使用、防护装备(PPE)要求
   - 步骤必须层次清晰（1. 2. 3. 或 ### 步骤），操作要点具体可执行。
   - 如涉及设备、检查点或数据记录，使用 Markdown 表格呈现。
3. 必须以严格的 JSON 格式输出，不要包含任何 markdown 代码包裹外壳（如 \`\`\`json ）。输出格式必须是合法的单个 JSON 对象：
{
  "title": "规程完整标题",
  "description": "一句话精炼说明（30字以内）",
  "content": "完整的 Markdown 正文内容",
  "suggested_roles": ["建议适用角色，如 Operator, Manager 等"],
  "suggested_page_id": "建议关联的系统 page_id（如 scanner, driver-delivery, leave-calendar 等）",
  "category": "建议分类（production, equipment, logistics, inventory, hr, safety）",
  "checklist": ["操作要点1", "操作要点2", "操作要点3", "操作要点4"]
}
`;

        let prompt = "";

        if (action === 'generate') {
            prompt = `
请根据以下高管提出的需求，起草一份完整的专业级工业 SOP：
- 主题/需求要点: ${topic || '包装制造业通用规程'}
- 规程类型: ${sopType}
- 偏好分类: ${category}
- 目标语言模式: ${language}
- 指定适用角色: ${targetRoles.length > 0 ? targetRoles.join(', ') : '请根据内容智能推荐'}
- 指定关联页面: ${pageId || '请根据内容智能推荐'}

请综合 PackSecure 厂区与机台特征（若涉及气泡膜、拉伸膜、混料或卡车送货，务必结合本厂真实流程），输出完整、结构严谨的 SOP JSON。
`;
        } else if (action === 'polish') {
            prompt = `
请对以下高管当前编写的 SOP 内容进行专业工业级排版美化与术语润色：
- 当前内容:
${existingContent}
- 语言模式: ${language}

要求：
1. 纠正错别字、使语病通顺，使语言符合工业工程 SOP 规范。
2. 整理段落层级，合理加入步骤标号、表格与 GitHub 警示卡片（[!WARNING], [!TIP] 等）。
3. 保持原作者的核心逻辑，补充疏漏的操作细节。
4. 返回格式必须为完整的指定 JSON。
`;
        } else if (action === 'safety_alerts') {
            prompt = `
请审查以下 SOP 内容中的安全隐患、设备保护与人身伤害风险，并在正文中强化补充规范的安全警示卡片：
- 当前内容:
${existingContent}
- 语言模式: ${language}

要求：
1. 识别高温烫伤、卷入伤害、电击、高空掉落、卡车倒车盲区、叉车碰撞等风险。
2. 在相应步骤前精准插入 [!WARNING] 或 [!CAUTION] 警示块，标明劳保用品(PPE)佩戴及紧急停机应对。
3. 返回更新后的完整 JSON 对象。
`;
        } else if (action === 'translate') {
            prompt = `
请将以下 SOP 内容翻译/转换为 ${language === 'zh-bm' ? '中马双语对照 (Bahasa Melayu & Chinese)' : language === 'zh-en' ? '中英双语对照 (English & Chinese)' : '纯中文'} 版本：
- 原内容:
${existingContent}

要求：
1. 专有名词（如机台、系统功能、出货单DO）保持准确。
2. 格式与排版完美保留。
3. 返回格式必须为完整的指定 JSON。
`;
        } else if (action === 'checklist') {
            prompt = `
请从以下 SOP 正文中提炼出一线员工在作业现场可逐项打勾核对的【实操检查清单 (Checklist)】：
- 原内容:
${existingContent}

要求：
1. 提炼出 5-10 项精简易执行的闭环检查项。
2. 保持 content 中在开头或结尾包含一个优雅的任务清单格式（- [ ] 项）。
3. checklist 数组中包含每一项的纯文本描述。
4. 返回格式必须为指定 JSON。
`;
        }

        let responseText = "";
        let lastError: any = null;

        for (const modelId of candidates) {
            try {
                console.log(`[SOP AI] Trying model ${modelId} for action: ${action}...`);
                const model = genAI.getGenerativeModel({
                    model: modelId,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.3,
                    }
                });

                const result = await model.generateContent(prompt);
                const response = await result.response;
                responseText = response.text();
                if (responseText) break;
            } catch (err: any) {
                console.warn(`[SOP AI] Model ${modelId} failed:`, err.message);
                lastError = err;
            }
        }

        if (!responseText) {
            throw lastError || new Error("Failed to generate response from Gemini");
        }

        const safeParseJson = (raw: string): any => {
            let cleaned = raw.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            cleaned = cleaned.trim();

            // 1. Try standard JSON.parse
            try {
                return JSON.parse(cleaned);
            } catch (e1) {
                // 2. Fix invalid backslash escapes in Markdown (e.g., \* \_ \  which break JSON.parse)
                try {
                    const fixedEscapes = cleaned.replace(/\\([^"\\\/bfnrtu])/g, '$1');
                    return JSON.parse(fixedEscapes);
                } catch (e2) {
                    // 3. Try double-escaping backslashes
                    try {
                        const doubleEscaped = cleaned.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
                        return JSON.parse(doubleEscaped);
                    } catch (e3) {
                        // 4. Regex extraction fallback
                        const titleMatch = cleaned.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        const descMatch = cleaned.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        const contentMatch = cleaned.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        const pageMatch = cleaned.match(/"suggested_page_id"\s*:\s*"([^"]*)"/);
                        const catMatch = cleaned.match(/"category"\s*:\s*"([^"]*)"/);

                        const unescapeStr = (s: string) => {
                            try {
                                return JSON.parse(`"${s}"`);
                            } catch {
                                return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                            }
                        };

                        if (titleMatch || contentMatch) {
                            return {
                                title: titleMatch ? unescapeStr(titleMatch[1]) : topic || '未命名规程',
                                description: descMatch ? unescapeStr(descMatch[1]) : '',
                                content: contentMatch ? unescapeStr(contentMatch[1]) : '',
                                suggested_page_id: pageMatch ? pageMatch[1] : pageId || '',
                                category: catMatch ? catMatch[1] : category || 'production',
                                suggested_roles: ['Operator', 'Manager'],
                                checklist: []
                            };
                        }
                        throw e1;
                    }
                }
            }
        };

        const parsedData = safeParseJson(responseText);

        return res.status(200).json({
            success: true,
            data: {
                title: parsedData.title || topic || '未命名 SOP 规程',
                description: parsedData.description || '',
                content: parsedData.content || '',
                suggested_roles: Array.isArray(parsedData.suggested_roles) ? parsedData.suggested_roles : ['Operator', 'Manager'],
                suggested_page_id: parsedData.suggested_page_id || pageId || '',
                category: parsedData.category || category || 'production',
                checklist: Array.isArray(parsedData.checklist) ? parsedData.checklist : []
            }
        });

    } catch (error: any) {
        console.error('[SOP AI Assistant Error]:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'AI processing failed'
        });
    }
}
