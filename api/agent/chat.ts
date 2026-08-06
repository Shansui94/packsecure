import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Define Gemini Tool Function Declarations
const querySalesOrdersTool: any = {
    name: "querySalesOrders",
    description: "Query sales orders from the database to get logistics trips, delivery details, destination, status, or counts. In this system, logistics trips (行程/趟数/配送) are represented as sales orders in the 'sales_orders' table. Always use this tool to count trips or query delivery details for any date range or zone (leave zone empty to query all zones).",
    parameters: {
        type: "OBJECT",
        properties: {
            zone: { type: "STRING", description: "Filter by customer zone (e.g. Kelantan, Taiping, Johor, Selangor). Leave empty to query all zones." },
            status: { type: "STRING", description: "Filter by order status (e.g. Delivered, Planned, Shipped, New)" },
            startDate: { type: "STRING", description: "Filter by deadline date >= YYYY-MM-DD (e.g. '2026-05-01')" },
            endDate: { type: "STRING", description: "Filter by deadline date <= YYYY-MM-DD (e.g. '2026-05-31')" }
        }
    }
};

const queryLeavesTool: any = {
    name: "queryLeaves",
    description: "Query employee leaves to check who is away, pending leave count, or approved leave list.",
    parameters: {
        type: "OBJECT",
        properties: {
            status: { type: "STRING", description: "Filter by status (Pending, Approved, Rejected)" },
            startDate: { type: "STRING", description: "Filter by start_date >= YYYY-MM-DD" },
            endDate: { type: "STRING", description: "Filter by end_date <= YYYY-MM-DD" }
        }
    }
};

const queryClaimsTool: any = {
    name: "queryClaims",
    description: "Query employee expense claims to check pending claims, amounts, types, or monthly totals.",
    parameters: {
        type: "OBJECT",
        properties: {
            status: { type: "STRING", description: "Filter by status (Pending, Approved, Rejected)" },
            type: { type: "STRING", description: "Filter by type (Overtime, Medical, Transport, Meal, Other)" }
        }
    }
};

// Define System Prompts per Role
const SYSTEM_PROMPTS: Record<string, string> = {
    SuperAdmin: `
Role: You are JARVIS, the Senior Systems Architect and Database Administrator for Packsecure, serving the System Developer/Super Admin (Max Tan).
Tone: Professional, expert, helpful, and concise.
Focus: Database structures, system metadata, user activities, and data analysis reports.
Static Knowledge of Database Schema:
- Table "sales_orders" (销售订单/行程): order_number (Text, 订单号), customer (Text, 客户), status (Text, 状态: New/Planned/Shipped/Delivered), order_date (Date, 下单日期), deadline (Date, 截止/配送日期), notes (Text, 备注), zone (Text, 配送区域), trip_drop_count (Integer, 配送点数).
  NOTE: In this system, logistics "trips" (行程/趟数/配送) are represented as sales orders and stored in the "sales_orders" table. There is NO "trips" or "deliveries" table. Always use the "querySalesOrders" tool when queried about logistics trips, delivery numbers, or trip counts.
- Table "employee_leave" (员工请假): employee_id (UUID, 关联用户), start_date (Date, 开始日期), end_date (Date, 结束日期), count_days (Integer, 请假天数), reason (Text, 原因), status (Text, 状态: Pending/Approved/Rejected), reviewed_by (UUID), reviewed_at (TIMESTAMPTZ).
- Table "claims" (费用报销): userId (UUID, 关联用户), userName (Text, 用户姓名), type (Text, 类型: Overtime/Medical/Transport/Meal/Other), amount (Numeric, 报销金额), description (Text, 描述), status (Text, 状态: Pending/Approved/Rejected), timestamp (TIMESTAMPTZ).
- Table "users_public" (用户配置): id (UUID, 主键), email (Text, 邮箱), name (Text, 姓名), role (Text, 角色: SuperAdmin/Admin/Manager/Operator/Driver/HR/Finance/Sales), phone (Text, 电话), employee_id (Text, 工号), status (Text, 状态: Pending/Approved/Active).

Guidelines:
1. When asked for table schemas or structures (e.g., "🔍 查主表 Schema"), DO NOT return raw SQL "CREATE TABLE" DDL code blocks. Instead, present the schema using neat Markdown tables in Chinese (with headers: 字段名, 类型, 说明).
2. For logistics "trips" (行程) queries, always use the "querySalesOrders" tool to fetch real data. DO NOT say the data is not in the context or suggest hypothetical SQL queries on a "trips" or "deliveries" table. If the user asks for trip count of a period (e.g., "上个月"), invoke the tool with corresponding startDate and endDate.
3. For query results, summarize them in clear, direct Chinese (e.g., "5月份送往吉兰丹的订单一共是有 28 笔。"), followed by structured markdown tables or bulleted lists if details are requested.
4. Avoid code/SQL dumps unless the user explicitly requests raw code or SQL scripts (e.g., "给我写个 SQL" or "编写 SQL 迁移脚本").
5. When referencing pages, append action triggers like [ACTION:navigate:data-v2] or [ACTION:navigate:activity-logs] at the end.
    `,
    Admin: `
Role: You are JARVIS, the Operations Co-Pilot and System Administrator for Packsecure. You are talking to the System Administrator.
Tone: Professional, Data-Driven, Prompt, Informative.
Focus: Master items, fleet management, customer regions, database schemas, and active machines.
Static Knowledge of Database Schema:
- Table "sales_orders" (销售订单/行程): order_number, customer, status, order_date, deadline, notes, zone, trip_drop_count.
  NOTE: Logistics "trips" (行程/趟数/配送) are represented as sales orders and stored in the "sales_orders" table. Always use "querySalesOrders" tool for any trips or delivery count inquiries. Do not assume "trips" or "deliveries" table exists.
- Table "employee_leave" (员工请假): employee_id, start_date, end_date, count_days, reason, status.
- Table "claims" (费用报销): userId, userName, type, amount, description, status, timestamp.
- Table "users_public" (用户配置): id, email, name, role, phone, employee_id, status.

Guidelines:
1. When asked for table schemas or structures (e.g., "🔍 查主表 Schema"), present the schema using neat Markdown tables in Chinese (with headers: 字段名, 类型, 说明) rather than raw SQL "CREATE TABLE" statements.
2. For logistics "trips" (行程) queries, always use the "querySalesOrders" tool to fetch real data. DO NOT suggest hypothetical SQL queries on "trips" or "deliveries" tables.
3. Answer inquiries in clear Chinese with user-friendly summaries and reports. Avoid code/SQL dumps unless requested.
4. When referencing pages, include action triggers such as [ACTION:navigate:data-v2] or [ACTION:navigate:users] at the end.
    `,
    Manager: `
Role: You are 'Titan', the Senior Production Manager for Packsecure. You are talking to the Factory Manager.
Tone: Business-like, Analytical, Insightful, Direct.
Focus: Production targets, downtime gaps, bottlenecks, leaves, and cost/claims approvals.
Goal: Summarize output efficiency. Use query tools to check pending leave/claims and logistics data. When referencing pages, you can include action triggers such as [ACTION:navigate:hr] or [ACTION:navigate:delivery] or [ACTION:navigate:maintenance] at the end.
    `,
    Operator: `
Role: You are 'Titan', the Technical Production Supervisor. You are talking to a Machine Operator.
Tone: Supportive, Instructional, Technical, Clear.
Focus: Active production jobs, target counts, machine cycles, and step-by-step operating guidelines (SOPs).
Goal: Provide direct instructions on how to operate machines, cycle efficiency, and troubleshooting instructions based on the SOP context provided. When referencing pages, you can include action triggers such as [ACTION:navigate:scanner] or [ACTION:navigate:leave-calendar] at the end.
    `,
    Driver: `
Role: You are the 'Logistics & Route Navigator'. You are talking to a Lorry Driver.
Tone: Concise, Helpful, Road-friendly, Direct.
Focus: Assigned delivery orders, delivery zones, claims rules, and salary advance limits.
Goal: Use tools to check active deliveries or calculate salary advance limits for the driver. Keep answers brief so they are easy to read. When referencing pages, you can include action triggers such as [ACTION:navigate:delivery-driver] or [ACTION:navigate:leave-calendar] or [ACTION:navigate:lorry-service] at the end.
    `,
    HR: `
Role: You are the 'HR Policy Advisor'. You are talking to the HR Officer.
Tone: Professional, Personable, Organised, Objective.
Focus: Leaves history, leave applications, payroll entries, and employee registries.
Goal: Use query tools to fetch employee leave requests or pending payroll, and help manage staff payroll records. When referencing pages, you can include action triggers such as [ACTION:navigate:hr] or [ACTION:navigate:leave-calendar] at the end.
    `,
    Finance: `
Role: You are the 'Financial Controller Advisor'. You are talking to the Finance Officer.
Tone: Analytical, Detail-oriented, Audit-compliant, Precise.
Focus: Expenses, claims auditing, invoice verification, and monthly payroll drafts.
Goal: Use query tools to audit claims and invoices. Guide claims processing. When referencing pages, you can include action triggers such as [ACTION:navigate:hr] or [ACTION:navigate:personal-report] at the end.
    `,
    Sales: `
Role: You are the 'Order Delivery Analyst'. You are talking to the Sales Executive.
Tone: Customer-centric, Informative, Prompt, Proactive.
Focus: Sales order statuses, customer zones, and shipment tracking.
Goal: Give immediate status updates on client orders, forecast delivery dates based on production state, and confirm customer delivery zones using query tools. When referencing pages, you can include action triggers such as [ACTION:navigate:order-summary] or [ACTION:navigate:delivery] at the end.
    `
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { query, userContext, history, canvas_document, canvas_tasks, imageBase64, mimeType } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        // Default role to Operator if user context is missing
        const role = userContext?.role || 'Operator';
        const rawUid = userContext?.uid;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uid = uuidRegex.test(rawUid || '') ? rawUid : '00000000-0000-0000-0000-000000000000';
        const name = userContext?.name || 'Colleague';
        const email = userContext?.email;

        // Force Asia/Singapore Timezone (UTC+8)
        const now = new Date();
        const sgTimeOption = { timeZone: "Asia/Singapore" };
        const sgNow = new Date(now.toLocaleString("en-US", sgTimeOption));
        
        const sgTodayStart = new Date(sgNow);
        sgTodayStart.setHours(0, 0, 0, 0);
        const queryDate = sgTodayStart.toISOString();

        // --- CONCURRENT DATA FETCHING FOR STATIC CONTEXT ---
        let contextData: Record<string, any> = {};
        const promises: any[] = [];

        // 1. SOP Search (Available to all roles for technical/guideline queries)
        let sopArticles: any[] = [];
        const isSopQuery = /how|操作|流程|怎么|SOP|步骤|规范|故障|说明|规则|修|开机|预支/i.test(query);
        if (isSopQuery) {
            promises.push(
                supabase
                    .from('sop_articles')
                    .select('title, description, content')
                    .eq('is_published', true)
                    .limit(5)
                    .then(({ data }) => {
                        sopArticles = data || [];
                    })
            );
        }

        // 2. Static role-specific context queries (fallback or complementary data)
        if (role === 'SuperAdmin' || role === 'Admin') {
            promises.push(
                supabase
                    .from('user_activity_logs')
                    .select('created_at, email, role, action, details')
                    .order('created_at', { ascending: false })
                    .limit(10)
                    .then(({ data }) => {
                        contextData.recentUserActivity = data || [];
                    })
            );
        }

        if (role === 'Manager' || role === 'Admin' || role === 'SuperAdmin') {
            promises.push(
                supabase.from('machine_active_products').select('*').then(({ data }) => {
                    contextData.activeMachines = data || [];
                })
            );
            
            promises.push(
                supabase
                    .from('production_logs')
                    .select('*')
                    .gte('created_at', queryDate)
                    .order('created_at', { ascending: false })
                    .limit(20)
                    .then(({ data }) => {
                        contextData.recentProductionPulses = data?.map(log => ({
                            Timestamp: new Date(log.created_at).toLocaleTimeString("en-US", sgTimeOption),
                            Machine: log.machine_id,
                            Produced_Units: log.alarm_count
                        })) || [];
                    })
            );

            promises.push(
                supabase
                    .from('production_logs')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', queryDate)
                    .then(({ count }) => {
                        contextData.totalProductionToday = count || 0;
                    })
            );
        }

        // Wait for static queries to complete
        await Promise.all(promises);

        // Debugging logs for prompt size and contents
        console.log(`[Chat Debug] Request payload size: ${JSON.stringify(req.body).length}`);
        console.log(`[Chat Debug] query length: ${query?.length || 0}`);
        console.log(`[Chat Debug] userContext keys: ${Object.keys(userContext || {})}`);
        console.log(`[Chat Debug] role: ${role}`);
        console.log(`[Chat Debug] contextData length: ${JSON.stringify(contextData).length}`);
        console.log(`[Chat Debug] sopArticles length: ${JSON.stringify(sopArticles).length}`);


        // --- CONSTRUCT SYSTEM PROMPTS AND TEMPLATES ---
        const systemPersona = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS.Operator;

        let historyText = "None (This is the start of the conversation).";
        if (history && Array.isArray(history) && history.length > 0) {
            historyText = history.map((msg: any) => `[${msg.sender_name} (${msg.sender_role})]: ${msg.content}${msg.image_url ? ` [Attached Image URL: ${msg.image_url}]` : ''}`).join('\n');
        }

        let canvasTasksText = "None.";
        if (canvas_tasks && Array.isArray(canvas_tasks) && canvas_tasks.length > 0) {
            canvasTasksText = canvas_tasks.map((t: any) => `- [${t.status}] ${t.title}${t.assigned_name ? ` (Assigned to: ${t.assigned_name})` : ''}`).join('\n');
        }

        const prompt = `
${systemPersona}

**CURRENT USER DETAILS:**
- Name: ${name}
- Email: ${email || "N/A"}
- Role: ${role}
- ID/Employee ID: ${userContext?.employeeId || "N/A"}

**CURRENT SG TIME:**
- Time: ${sgNow.toLocaleTimeString("en-US", { timeZone: "Asia/Singapore" })}
- Date: ${sgNow.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })} (Singapore Time)

**CHAT HISTORY IN THIS THREAD (CONTEXT):**
${historyText}

**CURRENT CANVAS DOCUMENT:**
${canvas_document || "Empty"}

**CURRENT CANVAS TASKS:**
${canvasTasksText}

**STATIC CONTEXT DATA (STATICALLY LOADED):**
${JSON.stringify(contextData)}

**KNOWLEDGE BASE (SOP ARTICLES):**
${sopArticles.length > 0 ? sopArticles.map(a => `Title: ${a.title}\nDesc: ${a.description}\nContent: ${a.content}`).join("\n---\n") : "None relevant matched."}

**USER QUESTION:** "${query}"

**INSTRUCTIONS FOR ANSWERING & CANVAS MANIPULATION:**
1. **Direct Answer**: Address the query immediately.
2. **Language Matching**: Always reply in the **SAME LANGUAGE** as the user asked (Chinese if Chinese, English if English).
3. **Modify Canvas Document**: If the user requests to write, update, draft, or refine a document (like a test record, safety guidelines, SOP, or report), you can write the full content of the document. To update the canvas document, you MUST wrap the complete document inside XML-style tags at the end of your response:
   "[update_doc]\n   (full markdown document content here)\n   [/update_doc]"
   This will overwrite the canvas document with the new content. Make sure to output the complete document inside these tags, not just the changes. Do not repeat the entire document outside these tags in the chat response; simply provide a brief confirmation to the user.
4. **Manage Tasks**: If the user asks to assign a task (e.g. "指派张三去洗厕所", "让 Winnie 讨论 marketing"), or if a task is explicitly mentioned in the conversation, you can add a task. To add a task, wrap it in a special XML-style tag:
   "[add_task]任务标题:指派员工姓名或工号或unassigned[/add_task]"
   For example: "[add_task]洗厕所:张三[/add_task]" or "[add_task]讨论营销进展:Winnie[/add_task]". You can include multiple task tags if needed.
5. **Structured Navigation Actions**: Append routing code strictly at the end of the text if the user needs to visit a specific page: '[ACTION:navigate:page_id]' where page_id can be: 'scanner', 'delivery-driver', 'leave-calendar', 'hr', 'personal-report', 'lorry-service', 'order-summary', 'data-v2', 'activity-logs'.
        `;

        // Initialize Gemini model with tools
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
            throw new Error("Server API key not configured.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const candidates = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

        let lastError;
        for (const modelId of candidates) {
            try {
                console.log(`[Gemini API] Requesting ${modelId} with prompt length ${prompt.length}...`);
                const model = genAI.getGenerativeModel({ 
                    model: modelId,
                    tools: [{
                        functionDeclarations: [querySalesOrdersTool, queryLeavesTool, queryClaimsTool]
                    }]
                });
                
                let result;
                if (imageBase64) {
                    result = await model.generateContent([
                        prompt,
                        { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } }
                    ]);
                } else {
                    result = await model.generateContent(prompt);
                }
                const response = await result.response;
                const calls = response.functionCalls();

                // If model requests a tool call, execute it and feed back
                if (calls && calls.length > 0) {
                    const call = calls[0];
                    console.log(`[Gemini Tool] Executing tool: ${call.name} with args:`, JSON.stringify(call.args));
                    
                    let queryResult: any = null;

                    try {
                        if (call.name === 'querySalesOrders') {
                            const { zone, status, startDate, endDate } = call.args as any;
                            let queryBuilder = supabase.from('sales_orders').select('order_number, customer, status, deadline, zone, trip_drop_count');
                            
                            // Security Rule: Drivers can only query their own orders
                            if (role === 'Driver' && uid) {
                                queryBuilder = queryBuilder.eq('driver_id', uid);
                            }
                            
                            if (zone) queryBuilder = queryBuilder.ilike('zone', `%${zone}%`);
                            if (status) queryBuilder = queryBuilder.eq('status', status);
                            if (startDate) queryBuilder = queryBuilder.gte('deadline', startDate);
                            if (endDate) queryBuilder = queryBuilder.lte('deadline', endDate);
                            
                            const { data, error } = await queryBuilder.limit(50);
                            if (error) throw error;
                            queryResult = data || [];
                        } else if (call.name === 'queryLeaves') {
                            const { status, startDate, endDate } = call.args as any;
                            let queryBuilder = supabase.from('employee_leave').select('id, employee_id, start_date, end_date, count_days, reason, status');
                            
                            // Security Rule: Operators & Drivers can only query their own leaves
                            if ((role === 'Driver' || role === 'Operator') && uid) {
                                queryBuilder = queryBuilder.eq('employee_id', uid);
                            }
                            
                            if (status) queryBuilder = queryBuilder.eq('status', status);
                            if (startDate) queryBuilder = queryBuilder.gte('start_date', startDate);
                            if (endDate) queryBuilder = queryBuilder.lte('end_date', endDate);
                            
                            const { data, error } = await queryBuilder.limit(50);
                            if (error) throw error;
                            
                            // Enrich with user name
                            if (data && data.length > 0) {
                                const userIds = [...new Set(data.map(l => l.employee_id))];
                                const { data: users } = await supabase.from('sys_users_v2').select('auth_user_id, name').in('auth_user_id', userIds);
                                const userMap = (users || []).reduce((acc: any, u: any) => {
                                    acc[u.auth_user_id] = u.name;
                                    return acc;
                                }, {});
                                queryResult = data.map(l => ({ ...l, employee_name: userMap[l.employee_id] || 'Unknown' }));
                            } else {
                                queryResult = [];
                            }
                        } else if (call.name === 'queryClaims') {
                            const { status, type } = call.args as any;
                            let queryBuilder = supabase.from('claims').select('id, "userName", type, amount, description, status, timestamp');
                            
                            // Security Rule: Operators & Drivers can only query their own claims
                            if ((role === 'Driver' || role === 'Operator') && uid) {
                                queryBuilder = queryBuilder.eq('userId', uid);
                            }
                            
                            if (status) queryBuilder = queryBuilder.eq('status', status);
                            if (type) queryBuilder = queryBuilder.eq('type', type);
                            
                            const { data, error } = await queryBuilder.limit(50);
                            if (error) throw error;
                            queryResult = data || [];
                        }
                    } catch (err: any) {
                        console.error(`[Gemini Tool] Error in ${call.name}:`, err);
                        queryResult = { error: err.message || "Query failed." };
                    }

                    // Feed results back into a chat thread to get final parsed text
                    const userParts: any[] = [{ text: prompt }];
                    if (imageBase64) {
                        userParts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } });
                    }
                    const chat = model.startChat({
                        history: [
                            { role: "user", parts: userParts },
                            { role: "model", parts: [{ functionCall: call }] }
                        ]
                    });

                    const finalResult = await chat.sendMessage([
                        {
                            functionResponse: {
                                name: call.name,
                                response: { result: queryResult }
                            }
                        }
                    ]);

                    const finalText = finalResult.response.text();
                    return res.status(200).json({ response: finalText });
                }

                // No tool call, return standard response text
                const text = response.text();
                if (text) {
                    return res.status(200).json({ response: text });
                }
            } catch (e: any) {
                console.warn(`[Gemini API] Model ${modelId} failed: ${e.message}`);
                lastError = e;
            }
        }

        throw lastError || new Error("All generative models failed to respond.");

    } catch (e: any) {
        console.error("AI Server handler error:", e);
        return res.status(500).json({ error: e.message || "Internal server error." });
    }
}
