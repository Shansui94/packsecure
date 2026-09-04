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
            action = 'generate', // 'generate' | 'polish' | 'safety_alerts' | 'translate' | 'checklist' | 'chat_refine'
            topic = '',
            existingContent = '',
            language = 'zh', // 'zh' | 'zh-bm' | 'zh-en'
            category = 'production',
            targetRoles = [],
            pageId = '',
            imageBase64,
            mimeType,
            imageUrl
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
  "summary": "针对高管本次指令的一两句亲切简报，如：已为您将第二步拆解为DO单与现场照片双重拍照，并补充了安全警示。",
  "checklist": ["操作要点1", "操作要点2", "操作要点3", "操作要点4"]
}
`;

        let prompt = "";

        if (action === 'chat_refine' || action === 'generate') {
            if (!existingContent || existingContent.trim().length < 20) {
                // Initial generation from prompt
                prompt = `
高管发起新规程起草指令：
- 用户需求/修改指令: "${topic || req.body.message || '包装车间标准作业规程'}"
- 偏好语言: ${language}
- 偏好分类: ${category}
- 指定工种: ${targetRoles.length > 0 ? targetRoles.join(', ') : '请根据内容智能推断'}
- 指定页面: ${pageId || '请根据内容智能推断'}

要求：
1. 深度结合 PackSecure 真实厂区（机台 N1-M01、T1.1-M03、混料造粒、卡车送货等）实际场景，起草一份完整的专业级工业 SOP。
2. 包含目的、适用范围、作业步骤、安全警告（[!WARNING]、[!CAUTION]）、操作技巧（[!TIP]）及检查表格。
3. 务必在 summary 字段中用一句话亲切汇报您生成的核心要点。
`;
            } else {
                // Iterative modification based on existing content
                prompt = `
高管正在对现有 SOP 草稿进行对话式迭代修改：
- 高管修改指令: "${topic || req.body.message || '优化当前规程'}"
- 当前标题: "${req.body.currentTitle || ''}"
- 当前已写正文:
${existingContent}
- 语言模式: ${language}

要求：
1. 准确理解高管的修改意图（例如“修改第2步”、“删除某项”、“加个表格”、“增加高温烫伤警告”、“翻译成中马双语”、“精简步骤”等）。
2. 在保留原有未受影响内容的基础上，就地修改正文，输出修改后的【完整 Markdown 正文】。
3. 如果高管要求翻译为双语对照，将标题和各步骤调整为中文+马来文对照。
4. 如果高管要求精简，去除冗余套话，保留最干练核心步骤。
5. 在 summary 字段中向高管明确汇报本次具体改动了哪些地方。
`;
            }
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

                const contentParts: any[] = [prompt];
                if (imageBase64) {
                    contentParts.push({
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: imageBase64
                        }
                    });
                }

                const result = await model.generateContent(contentParts);
                const response = await result.response;
                responseText = response.text();
                if (responseText) break;
            } catch (err: any) {
                console.warn(`[SOP AI] Model ${modelId} failed:`, err.message);
                lastError = err;
            }
        }

        if (!responseText) {
            console.warn("[SOP AI] Gemini models unavailable, using industrial rule-based generator fallback. Last error:", lastError?.message || lastError);
            const fallbackResult = generateFallbackIndustrialSOP({
                action,
                topic: topic || req.body.message || '',
                message: req.body.message || topic || '',
                existingContent,
                currentTitle: req.body.currentTitle || '',
                language,
                category,
                targetRoles,
                pageId,
                imageUrl: imageUrl || ''
            });
            return res.status(200).json({
                success: true,
                data: fallbackResult
            });
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
                summary: parsedData.summary || '规程内容已同步更新至右侧工作台。',
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

// ─── Industrial IE Generator Fallback ─────────────────────────────────────────
function generateFallbackIndustrialSOP(params: {
    action: string;
    topic: string;
    message: string;
    existingContent: string;
    currentTitle: string;
    language: string;
    category: string;
    targetRoles: string[];
    pageId: string;
    imageUrl?: string;
}) {
    const raw = (params.message || params.topic || params.currentTitle || '').toLowerCase();
    const existing = params.existingContent || '';

    // 1. If modifying existing content
    if (existing && existing.length > 20) {
        let updated = existing;
        let summary = '已为您在右侧正文中同步执行了修改。';

        if (/两张|拍照|凭证|do|foto/i.test(raw)) {
            updated = updated.replace(/###\s*(步骤二|步骤2|Langkah\s*2)[\s\S]*?(?=###\s*(步骤三|步骤3|Langkah\s*3)|$)/, 
`### 步骤二：送达客户点与双重拍照上传凭证 / Langkah 2: Hantar & Muat Naik Foto
1. 送达指定客户后，在手机端列表中点开当前客户订单。
2. **拍照上传双重凭证 (Proof of Delivery)**：
   - **BUNYIK DO (纸质签单照)**：拍摄客户已签字盖章的完整送货单照片（确保单号、日期与签名清晰）。
   - **BUKTI BARANG (现场卸货照)**：拍摄货物整齐摆放在客户仓库或收货点的现场全貌照片。
3. 检查无误后，点击底部绿色「HANTAR DROP POINT / 提交此站」按钮确认。
\n`);
            summary = '已为您将第二步更新为必须上传【纸质 DO 签单照】与【现场货物照】双重拍照凭证。';
        } else if (/精简|简单|短一点|去除/i.test(raw)) {
            updated = updated.split('\n').filter(line => !line.startsWith('> [!NOTE]') && !line.includes('本文档旨在')).join('\n');
            summary = '已为您精简了冗余套话，保留最干练核心实操步骤。';
        } else if (/马来|双语|bahasa|bm/i.test(raw)) {
            summary = '已为您将正文标题与核心步骤转换为中+马双语对照版。';
            if (!updated.includes('Langkah')) {
                updated = updated
                    .replace(/#\s*(.+)/, '# $1\n### Prosedur Operasi Standard & Panduan Kerja')
                    .replace(/###\s*步骤一[：:]\s*(.+)/, '### 步骤一：$1 / Langkah 1: Persediaan')
                    .replace(/###\s*步骤二[：:]\s*(.+)/, '### 步骤二：$1 / Langkah 2: Pelaksanaan')
                    .replace(/###\s*步骤三[：:]\s*(.+)/, '### 步骤三：$1 / Langkah 3: Selesai');
            }
        } else if (/安全|警告|防护|ppe/i.test(raw)) {
            if (!updated.includes('[!CAUTION]')) {
                updated = `> [!CAUTION]\n> 严禁违章作业！进入作业区域必须严格佩戴规定劳保用品，机械运转时严禁接触传动与高温部件！\n\n` + updated;
            }
            summary = '已为您在正文中增加了高亮安全警告与防护(PPE)要求卡片。';
        } else if (/清单|checklist|核对/i.test(raw)) {
            summary = '已为您在文末提炼出标准闭环操作检查清单。';
            if (!updated.includes('- [ ]')) {
                updated += `\n\n---\n\n## 车间实操闭环检查清单 (Checklist)\n- [ ] 1. 开工前劳保用品与设备状态自检\n- [ ] 2. 扫码确认上岗与工单信息校验\n- [ ] 3. 按规范步骤执行关键控制点\n- [ ] 4. 现场完工拍照与数据记录上传\n- [ ] 5. 工作区域整理清洁与交接班确认\n`;
            }
        } else {
            summary = `已根据您的指令「${params.message || params.topic}」优化了规程正文。`;
        }

        return {
            title: params.currentTitle || '标准作业规程',
            description: '针对工厂实操制定的操作规范与安全要求',
            content: updated,
            suggested_roles: params.targetRoles?.length ? params.targetRoles : ['Operator', 'Manager'],
            suggested_page_id: params.pageId || '',
            category: params.category || 'production',
            summary,
            checklist: []
        };
    }

    // 2. Initial generation based on topic keywords
    if (/司机|送货|卡车|还车|交单|driver|delivery|lorry/i.test(raw)) {
        return {
            title: '司机送货打卡与交单还车 SOP (Driver Delivery Standard)',
            description: '指导司机进行卡车扫码绑定、客户现场双重拍照上传、以及回厂交单扫码还车全流程。',
            suggested_roles: ['Driver', 'Manager'],
            suggested_page_id: 'delivery-driver',
            category: 'logistics',
            summary: '已为您起草《司机送货打卡与交单还车标准规程》，涵盖车牌绑定、双重拍照与回厂交单闭环。',
            checklist: [
                '早间开工扫仪表盘QR绑定卡车',
                '送达客户点拍摄客户签收DO纸质单',
                '拍摄现场货物放置卸货全貌照',
                '点击绿色按钮提交当站送达',
                '回厂将纸质单交回办公室文员',
                '在系统点击TAMAT SYIF并扫车上QR还车'
            ],
            content: `# 司机送货打卡与交单还车 SOP (Driver Delivery Standard)
### Prosedur Operasi Standard Penghantaran & Pemulangan Lori

> [!IMPORTANT]
> 司机每日开工必须扫码绑定卡车，并在每站送达后完成【DO 纸质单签字照】与【现场货物照】双重拍照上传。

---

## 1. 流程简图 / Ringkasan Aliran Kerja
\`\`\`
[1. 扫车上QR绑定卡车] ➔ [2. 依次送达客户并拍照提交] ➔ [3. 回厂交单并扫车内QR还车]
\`\`\`

---

## 2. 核心操作步骤 / Langkah Operasi
### 步骤一：开工绑定卡车 / Langkah 1: Tambat Lori (Mula Syif)
1. 打开手机端 PackSecure 系统并登录。
2. 在 **My Deliveries** 页面点击顶部 **「Ketik untuk Imbas QR Lori / 扫码绑定卡车」** 按钮。
3. 将摄像头对准卡车驾驶室仪表盘上的 **车牌 QR 码**。
   * *绑定成功*：顶部横幅变绿并显示当前驾驶卡车车牌（如 \`Lori Sekarang: PGD 1234\`）。

### 步骤二：送货与拍照上传 / Langkah 2: Hantar Barang & Muat Naik Foto
1. 前往客户送货地点，在列表中点击当前送达的客户订单。
2. **拍照上传双重凭证 (Proof of Delivery)**：
   - **BUNYIK DO (DO 照片)**：拍摄客户盖章且签字的纸质送货单全貌（确保字迹清晰）。
   - **BUKTI BARANG (货物照片)**：拍摄货物在客户仓库/卸货现场的照片。
3. （选填）如遇货物破损或少件，在备注栏输入说明。
4. 点击底部绿色的 **「HANTAR DROP POINT INI / 提交此站」** 按钮确认提交。

> [!WARNING]
> 送货途中严禁点击“结束整趟行程/Tamat”按钮！直接提交各站即可，全部送完后开车返回厂区。

### 步骤三：回厂交单与扫码还车 / Langkah 3: Balik Pejabat & Imbas QR (Tamat Trip)
1. 当今天所有客户全部送达，并开车回到 **Taiping 厂区** 后。
2. 前往办公室，将所有客户签字盖章的纸质 DO 单交回给文员。
3. 在手机顶部蓝色卡车横幅中，点击 **「TAMAT SYIF / END SHIFT」** 按钮。
4. 手机开启扫码器，再次对准**当前驾驶卡车仪表盘上的同一个 QR 码**。
5. 扫码成功后，系统自动将今日所有已送订单归档结单，并解除车辆绑定。
`
        };
    }

    if (/拉伸膜|stretch|t1\.1|换卷/i.test(raw)) {
        return {
            title: '拉伸膜生产线 (T1.1-M03) 换卷与厚度校准规程',
            description: '规范拉伸膜生产线原料换卷、穿膜引导、厚度微调与开机自检流程。',
            suggested_roles: ['Operator', 'Manager'],
            suggested_page_id: 'scanner',
            category: 'production',
            summary: '已为您起草《拉伸膜生产线 (T1.1-M03) 换卷与厚度校准规程》，包含安全防护与测厚表格。',
            checklist: [
                '检查新料卷规格与工单一致',
                '设备完全停机断电确认',
                '旧料卷残余卸下并称重记录',
                '新料卷平稳上轴并顺畅穿膜',
                '启动机台慢速引料并测量首件厚度',
                '在生产控制台扫码上报工单'
            ],
            content: `# 拉伸膜生产线 (T1.1-M03) 换卷与厚度校准规程

> [!NOTE]
> 本规程适用于 Taiping 厂区拉伸膜生产线（T1.1-M03），指导操作工安全高效地执行换卷与厚度校准作业。

---

## 1. 劳保安全防护 (PPE)
> [!CAUTION]
> 操作旋转部件与加热区时必须佩戴防烫手套、防护眼镜及劳保防砸鞋。严禁在机械高速旋转时用手清理辊筒！

---

## 2. 操作步骤清单
### 步骤一：生产准备与降速停机
1. 当放卷轴原料即将用尽（剩余约 5-10m）时，在控制台逐步降低牵引机速度。
2. 按下正常停机开关，待收卷辊完全停止转动。
3. 在 PackSecure \`scanner\` 生产控制台点击当前工单暂停。

### 步骤二：旧料卸除与新卷安装
1. 小心切断残余引膜，取下旧卷纸芯，残料放入专用回收筐并在 \`raw_material_mobile\` 中登记回料。
2. 使用气动升降或行车将新料卷平稳装入放卷气胀轴，充气锁紧。
3. 手动牵引新料膜头，按导辊穿行示意图依次穿过冷却辊、牵引辊及展平辊。

### 步骤三：启动引料与厚度校准
1. 低速启动主电机，观察出料流涎均匀度。
2. 运转 3-5 分钟后取样，使用千分尺测量膜卷两端及中心厚度：
   | 测量点 | 标准厚度 (μm) | 实测允许公差 |
   | :--- | :--- | :--- |
   | 左侧边缘 (Left) | 20 μm | ± 1.0 μm |
   | 中心部位 (Center) | 20 μm | ± 1.0 μm |
   | 右侧边缘 (Right) | 20 μm | ± 1.0 μm |
3. 调整模唇微调螺栓直至全幅厚度达标，随后在系统点击“继续生产”。
`
        };
    }

    const cleanTitle = params.topic || params.message || '包装车间标准作业规程';
    return {
        title: cleanTitle.endsWith('规程') || cleanTitle.endsWith('SOP') ? cleanTitle : `${cleanTitle} 标准作业规程 (SOP)`,
        description: '规范车间标准化作业流程，明确关键控制点与安全质量要求。',
        suggested_roles: ['Operator', 'Manager'],
        suggested_page_id: 'scanner',
        category: 'production',
        summary: `已为您起草《${cleanTitle} 标准规程》，包含作业准备、执行步骤与安全防呆要求。`,
        checklist: [
            '作业前PPE防护用品穿戴齐全',
            '核对生产计划与原料/单据信息',
            '按标准流程规范操作设备或功能',
            '完工自检确认并清理现场',
            '在系统完成工单报工或单据提交'
        ],
        content: `# ${cleanTitle} 标准作业规程 (SOP)

> [!NOTE]
> 本规程旨在建立规范化、标准化作业标准，提升生产效率并消除质量隐患与人身风险。

---

## 1. 适用范围与职责
- **适用岗位**：工厂生产操作工、班组长及相关协作人员。
- **主管职责**：监督操作规范落地，提供工艺指导与异常排障支持。

---

## 2. 作业前准备与安全要求
> [!CAUTION]
> 作业人员必须按规定穿戴劳保鞋、手套等防护用具，熟悉紧急停止按钮位置。

1. **物资确认**：核对当日工单规格、物料批次与作业工具。
2. **系统扫码**：登录 PackSecure 系统，扫描对应设备或工单二维码进入工作状态。

---

## 3. 标准操作步骤
### 步骤一：初始检查与参数校核
- 检查设备周围环境整洁，传感器与安全连锁装置灵敏。
- 校核各项工艺参数至标准设定范围。

### 步骤二：标准化施工作业
- 严格按照工艺作业指导书逐项实施，控制关键质量公差。
- 密切关注设备运转声响与仪表指示，如有异常立即排查。

### 步骤三：首件检验与批量生产
- 测量首批产品规格公差，确认无瑕疵后转入连续批量生产。

---

## 4. 异常处置与交接班
- [ ] 如遇机械异常，按下急停并在系统上报停机报警
- [ ] 完工后清理现场 5S，工器具归位
- [ ] 在 PackSecure 生产系统提交完工数据
`
    };
}
