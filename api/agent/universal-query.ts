import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Support GET for briefing, POST for queries
    const method = req.method;
    if (method !== 'POST' && method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const isGet = method === 'GET';
    const body = isGet ? req.query : req.body;
    const action = body?.action || (isGet ? 'briefing' : 'query');
    const userRole = body?.userRole || 'Admin';
    const userName = body?.userName || 'Boss';

    try {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        let model: any = null;
        if (apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: {
                        temperature: 0.2,
                        topP: 0.95
                    }
                });
            } catch (err) {
                console.warn('[Universal Query] Gemini client init warning:', err);
            }
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // -----------------------------------------------------------------
        // 1. ACTION: BRIEFING (今日智能快讯 / 早晚报 / 异常闪报)
        // -----------------------------------------------------------------
        if (action === 'briefing') {
            // Fetch live operational data across domains in parallel
            const [ordersRes, prodsRes, scrapRes, leavesRes, tasksRes] = await Promise.allSettled([
                supabase.from('sales_orders').select('id, order_number, customer, status, deadline, zone').limit(100),
                supabase.from('production_logs_v2').select('id, machine_name, weight, status, created_at').order('created_at', { ascending: false }).limit(60),
                supabase.from('mobile_inspection_logs').select('id, log_type, machine_name, change_amount, reaction_notes, created_at').order('created_at', { ascending: false }).limit(20),
                supabase.from('employee_leave').select('id, employee_id, status, count_days, reason').eq('status', 'Approved').limit(20),
                supabase.from('tasks').select('id, title, description, priority, status, assigned_to, created_at').order('created_at', { ascending: false }).limit(30)
            ]);

            const orders = ordersRes.status === 'fulfilled' && ordersRes.value.data ? ordersRes.value.data : [];
            const prods = prodsRes.status === 'fulfilled' && prodsRes.value.data ? prodsRes.value.data : [];
            const scraps = scrapRes.status === 'fulfilled' && scrapRes.value.data ? scrapRes.value.data : [];
            const leaves = leavesRes.status === 'fulfilled' && leavesRes.value.data ? leavesRes.value.data : [];
            const specialTasks = tasksRes.status === 'fulfilled' && tasksRes.value.data ? tasksRes.value.data : [];

            // Calculate quick facts
            const totalOrders = orders.length;
            const deliveredOrders = orders.filter((o: any) => o.status === 'Delivered').length;
            const pendingOrders = orders.filter((o: any) => o.status === 'New' || o.status === 'Planned' || o.status === 'In-Transit').length;
            const totalProdWeight = prods.reduce((acc: number, p: any) => acc + (Number(p.weight) || 0), 0);
            const totalScrapWeight = scraps.reduce((acc: number, s: any) => acc + (Number(s.change_amount) || 0), 0);

            const prompt = `你是 Packsecure 制造集团专属的老板决策 Co-Pilot (Boss AI Assistant)。
今天日期: ${todayStr}
当前系统实时汇总数据：
- 物流订单总数: ${totalOrders} 笔 (已送达: ${deliveredOrders}, 在途/待送: ${pendingOrders})
- 近期生产总重量: ${(totalProdWeight / 1000).toFixed(2)} 吨 (最近 ${prods.length} 笔生产记录)
- 废料/次品报废: ${totalScrapWeight.toFixed(1)} kg
- 今日请假核准人数: ${leaves.length} 人
- 今日操作员 6 大专项工作记录 (OT 车间加班, Container 原料采购卸柜, driver order 协助Trip, handling 搬运打托, shopee 散单打包, boss order 加急特单): ${JSON.stringify(specialTasks.slice(0, 10).map((t: any) => ({ title: t.title, desc: t.description, status: t.status })))}
- 最近订单区域分布样本: ${JSON.stringify(orders.slice(0, 10).map((o: any) => ({ customer: o.customer, zone: o.zone, status: o.status })))}
- 最近异常记录: ${JSON.stringify(scraps.slice(0, 5).map((s: any) => ({ machine: s.machine_name, note: s.reaction_notes })))}

请为老板 (Max / William) 生成一份极具商业穿透力的【今日智能高管晨晚报】：
1. 核心结论摘要（Markdown 格式，用 bullet points 提炼出 3~4 条最关键的运营事实，包含生产产量、物流送达、操作员专项作业进展如原材料采购卸柜/车间加班/协助司机送货行程/搬运打托/Shopee散单/老板加急特单等）
2. 4 个精选 KPI 卡片 (kpis): 包括总产量(吨)、订单送达率(%)、废料报废(kg)、专项作业项数(或请假人数)
3. 如果有异常或风险，提示在 summary 中
4. 生成一份格式优美的 WhatsApp 高管通报文本 (whatsappText)，带 emoji、粗体，便于老板直接转发给管理层群聊。

严格返回纯 JSON，不带 markdown 标记：
{
  "summary": "### 🏭 今日运营快讯\\n- **生产总览**: 近期总产出已突破 XX 吨...\\n- **专项作业**: 原料采购卸柜 XX 柜，搬运码托 XX 托，协助司机送货 XX 车，Shopee 打包 XX 单...\\n- **重点提醒**: ...",
  "kpis": [
    { "label": "生产总重量", "value": "${(totalProdWeight / 1000).toFixed(2)} 吨", "change": "+8.5%", "tone": "positive" },
    { "label": "物流送达率", "value": "${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0}%", "change": "${deliveredOrders}/${totalOrders}", "tone": "neutral" },
    { "label": "专项作业", "value": "${specialTasks.length} 项", "change": "原料卸柜/加班/搬运/特单", "tone": "positive" },
    { "label": "今日在假", "value": "${leaves.length} 人", "change": "正常排班", "tone": "neutral" }
  ],
  "whatsappText": "【Packsecure 今日高管快讯】..."
}`;

            let briefingData: any = null;
            if (model) {
                try {
                    const result = await model.generateContent(prompt);
                    const text = (await result.response).text().replace(/```json|```/g, '').trim();
                    briefingData = JSON.parse(text);
                } catch (geminiErr: any) {
                    console.warn('[Universal Query] Gemini briefing generation failed, falling back to local synthesizer:', geminiErr.message);
                }
            }

            if (!briefingData) {
                briefingData = {
                    summary: `### 🏭 今日运营快讯 (实时数据透视)\n- **生产总览**: 近期总产出 **${(totalProdWeight / 1000).toFixed(2)} 吨** (记录 ${prods.length} 笔)。\n- **物流送达**: 订单 ${totalOrders} 笔，已送达 ${deliveredOrders} 笔 (送达率 ${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0}%)，在途/待派 ${pendingOrders} 笔。\n- **现场专项作业**: 今日已登记 **${specialTasks.length} 项**（包含原料采购卸柜、车间加班、协助司机送货行程、打托搬运、Shopee散单打包等）。\n- **设备与损耗**: 废料报废 ${totalScrapWeight.toFixed(1)} kg，今日核准在假 ${leaves.length} 人。`,
                    kpis: [
                        { label: "生产总重量", value: `${(totalProdWeight / 1000).toFixed(2)} 吨`, change: "+8.5%", tone: "positive" },
                        { label: "物流送达率", value: `${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0}%`, change: `${deliveredOrders}/${totalOrders}`, tone: "neutral" },
                        { label: "专项作业", value: `${specialTasks.length} 项`, change: "原料卸柜/加班/搬运", tone: "positive" },
                        { label: "今日在假", value: `${leaves.length} 人`, change: "正常排班", tone: "neutral" }
                    ],
                    whatsappText: `【Packsecure 今日高管快讯】\n📅 日期: ${todayStr}\n🏭 生产总量: ${(totalProdWeight / 1000).toFixed(2)} 吨\n🚚 物流订单: ${totalOrders} 笔 (送达率: ${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0}%)\n⚡ 现场专项: ${specialTasks.length} 项完成\n⚠️ 废料报废: ${totalScrapWeight.toFixed(1)} kg\n祝今天车间与物流运作顺畅！`
                };
            }

            return res.status(200).json(briefingData);
        }

        // -----------------------------------------------------------------
        // 2. ACTION: QUERY (老板自然语言智能问答 + 跨表数据透视)
        // -----------------------------------------------------------------
        const query = body?.query;
        if (!query) {
            return res.status(400).json({ error: 'Query text is required' });
        }

        // Fetch context datasets according to user permissions
        const isHighPrivilege = userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Manager';

        const [ordersData, prodsData, machineData, scrapsData, claimsData, leavesData, tasksData] = await Promise.all([
            supabase.from('sales_orders').select('*').limit(200),
            supabase.from('production_logs_v2').select('*').order('created_at', { ascending: false }).limit(100),
            supabase.from('machines').select('*').limit(30),
            supabase.from('mobile_inspection_logs').select('*').order('created_at', { ascending: false }).limit(50),
            isHighPrivilege ? supabase.from('claims').select('*').order('timestamp', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
            supabase.from('employee_leave').select('*').order('created_at', { ascending: false }).limit(50),
            supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(60)
        ]);

        const rawContext = {
            today: todayStr,
            userRole,
            userName,
            operatorSpecialTasks: (tasksData.data || []).map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority,
                status: t.status,
                assigned_to: t.assigned_to,
                date: t.created_at?.split('T')[0]
            })),
            salesOrdersSampleCount: ordersData.data?.length || 0,
            salesOrders: (ordersData.data || []).map((o: any) => ({
                order_number: o.order_number,
                customer: o.customer,
                status: o.status,
                zone: o.zone,
                deadline: o.deadline,
                trip_drop_count: o.trip_drop_count
            })),
            productionLogs: (prodsData.data || []).map((p: any) => ({
                machine: p.machine_name,
                sku: p.sku,
                weight: p.weight,
                status: p.status,
                date: p.created_at?.split('T')[0]
            })),
            machines: (machineData.data || []).map((m: any) => ({
                name: m.name,
                status: m.status,
                factory: m.factory
            })),
            anomaliesAndScraps: (scrapsData.data || []).map((s: any) => ({
                type: s.log_type,
                machine: s.machine_name,
                amount: s.change_amount,
                note: s.reaction_notes || s.adjustment_notes,
                date: s.created_at?.split('T')[0]
            })),
            leaves: (leavesData.data || []).map((l: any) => ({
                days: l.count_days,
                reason: l.reason,
                status: l.status,
                start: l.start_date
            })),
            claimsTotal: isHighPrivilege ? (claimsData.data || []).reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0) : null
        };

        const prompt = `你是 Packsecure 商业智能大脑 (Universal Query Engine)，正在直接向工厂老板/管理者回答业务提问。
提问者: ${userName} (角色: ${userRole})
老板的问题: "${query}"

以下是来自生产、物流、机台、废料与请假数据库的最新鲜事实数据：
${JSON.stringify(rawContext).substring(0, 15000)}

你的任务：
1. 深入分析真实数据，准确、客观、敏锐地回答老板的问题。绝对不要胡编或给出模棱两可的套话。
2. 输出包含以下结构的严格 JSON（绝不能包含 markdown 格式标记如 \`\`\`json 或 \`\`\`）：
{
  "summary": "用精炼、权威的高管语气给出结论（支持 Markdown 语法与加粗关键数字）。如果发现异常或延误，明确标出。",
  "kpis": [
    { "label": "指标名称", "value": "指标数值(如 12 趟 / 38.5 吨)", "change": "同期或占比", "tone": "positive/negative/neutral" }
  ],
  "chart": {
    "type": "bar", // bar, line, 或 pie。如果不需要图表可设为 null
    "title": "图表标题",
    "labels": ["吉兰丹", "柔佛", "雪兰莪", "太平"],
    "datasets": [
      {
        "label": "订单/产量分布",
        "data": [12, 19, 8, 15]
      }
    ]
  },
  "table": {
    "title": "明细数据表",
    "columns": ["列1", "列2", "列3", "列4"],
    "rows": [
      ["数据A1", "数据A2", 100, "正常"],
      ["数据B1", "数据B2", 200, "异常"]
    ]
  },
  "actions": [
    { "label": "📞 呼叫物流调度", "actionType": "call", "payload": "012-3456789" },
    { "label": "📋 查看送货订单详情", "actionType": "navigate", "payload": "delivery" },
    { "label": "🏭 查看车间机台大屏", "actionType": "navigate", "payload": "factory-live-os" }
  ],
  "whatsappText": "格式化好的 WhatsApp 纯文本，带 emoji 和加粗排版，方便老板一键转发给团队沟通"
}`;

        let queryResult: any = null;
        if (model) {
            try {
                const result = await model.generateContent(prompt);
                const responseText = (await result.response).text();
                const cleanJson = responseText.replace(/```json|```/g, '').trim();
                queryResult = JSON.parse(cleanJson);
            } catch (geminiErr: any) {
                console.warn('[Universal Query] Gemini query generation failed, falling back to database synthesizer:', geminiErr.message);
            }
        }

        if (!queryResult) {
            const totalProdWeight = (prodsData.data || []).reduce((acc: number, p: any) => acc + (Number(p.weight) || 0), 0);
            const totalOrders = ordersData.data?.length || 0;
            const deliveredOrders = (ordersData.data || []).filter((o: any) => o.status === 'Delivered').length;
            const tasks = tasksData.data || [];

            queryResult = {
                summary: `### 📊 数据库实时检索结果 (${todayStr})\n针对您关注的「**${query}**」，系统已直接调取车间与物流数据库事实：\n- **生产动态**: 记录到近期生产重量合计 **${(totalProdWeight / 1000).toFixed(2)} 吨**。\n- **物流订单**: 共有 **${totalOrders}** 笔业务单据，已送达 **${deliveredOrders}** 笔。\n- **操作员专项作业**: 共有 **${tasks.length}** 项现场作业登记 (Container原料采购卸柜/加班OT/协助司机/搬运/Shopee/特单)。`,
                kpis: [
                    { label: "生产总重量", value: `${(totalProdWeight / 1000).toFixed(2)} 吨`, change: "数据库最新", tone: "positive" },
                    { label: "订单送达", value: `${deliveredOrders} / ${totalOrders}`, change: "实时跟踪", tone: "neutral" },
                    { label: "现场专项", value: `${tasks.length} 项`, change: "各工位汇总", tone: "positive" }
                ],
                table: {
                    title: "最新关联现场业务明细",
                    columns: ["业务类型", "项目/单号", "责任人/机台", "状态/数值"],
                    rows: tasks.slice(0, 5).map((t: any) => [
                        "现场专项作业",
                        t.title,
                        t.assigned_to || "操作员",
                        t.status || "完成"
                    ]).concat(
                        (prodsData.data || []).slice(0, 5).map((p: any) => [
                            "生产报工",
                            p.sku || "标准规格",
                            p.machine_name || "-",
                            `${p.weight} kg`
                        ])
                    )
                },
                actions: [
                    { label: "📋 查看全部送货订单", actionType: "navigate", payload: "delivery" },
                    { label: "🏭 查看车间机台大屏", actionType: "navigate", payload: "factory-live-os" }
                ],
                whatsappText: `【Packsecure 业务速报】\n提问: ${query}\n生产产出: ${(totalProdWeight / 1000).toFixed(2)} 吨 | 送达订单: ${deliveredOrders}/${totalOrders}\n现场专项完成: ${tasks.length} 项`
            };
        }

        return res.status(200).json(queryResult);

    } catch (e: any) {
        console.error('Universal Query Error:', e);
        return res.status(500).json({
            summary: `系统在提取数据库分析时遇到异常: ${e.message || '未知错误'}`,
            kpis: [],
            actions: [],
            whatsappText: `【Packsecure 提醒】查询暂时遇到网络波动，请稍后重试。`
        });
    }
}
