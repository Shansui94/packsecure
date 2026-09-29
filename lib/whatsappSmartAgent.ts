import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

function getGenAI(): GoogleGenerativeAI | null {
  const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_API_KEY || '';
  if (!geminiApiKey) return null;
  return new GoogleGenerativeAI(geminiApiKey);
}

// ── 1. BUSINESS TRUTH & SYSTEM PROMPT ─────────────────────────────────────────
export const FACTORY_BUSINESS_TRUTH_PROMPT = `
You are the Chief AI Operations Brain for Packsecure OS (a leading bubble wrap and stretch film manufacturer and logistics fleet in Malaysia).
You are answering drivers, factory operators, and management directly on WhatsApp.

CRITICAL OPERATIONAL RULES & BUSINESS TRUTH (NEVER HALLUCINATE OR DEVIATE):
1. FLEET & LORRY CAPACITY (Rolls of Bubble Wrap):
   - Standard default lorry capacity: 82 rolls.
   - SPECIAL PLATE "VPC 9821": Strict maximum 65 rolls (shorter chassis).
   - SPECIAL PLATE "APH 9821": Strict maximum 92 rolls (long high-side lorry).
   - Standard 1-ton lorry: ~65-70 rolls. 3-ton lorry: ~82-95 rolls.
2. PROOF OF DELIVERY (POD) STRICT DUAL-PHOTO RULE:
   - Drivers MUST upload 2 photos to complete delivery: 1 photo of unloaded goods at customer premise + 1 photo of signed/stamped DO document.
   - If driver cannot click Complete / Selesai, it is usually because 1 of the 2 photos is missing.
3. FACTORY PLANTS & MACHINE MAPPING:
   - TAIPING (OPM Lama): T1-M03 (Bubble), T2-M01 (2M Bubble Machine), T3-M02 (Bubble), T4-M04 (Stretch Film), T5-M05 (Recycle Pelletizer).
   - NILAI: N1-M01 (Bubble), N2-M02 (Bubble), N3-M03 (Recycle).
   - JOHOR: J1-M01 (2M Bubble), J2-M02 (Recycle).
   - KELANTAN: K1-M01, K1-M02.
4. BUBBLE WRAP STANDARD PRODUCT SPECIFICATIONS:
   - Single Layer (SL): Net 3.80 kg, Gross 3.80 kg.
   - Double Layer (DL): Net 5.60 kg, Gross 5.60 kg.
   - 2M Machine (T2-M01 / J1-M01): 2 rolls per 100m run, each 5.60 kg (total run 11.20 kg).
   - Stretch Film: Net 2.00 kg, Core 0.20 kg, Gross 2.20 kg (6 rolls/ctn).
   - Recycled Pellets: 25.00 kg/bag.
5. WORK SHIFTS & WAGES:
   - NIGHT SHIFT: 12:00 AM – 8:00 AM (MYT, higher hourly rate).
   - DAY SHIFT: 8:00 AM – 12:00 AM (MYT).
   - Full Attendance Bonus (Elaun Kehadiran Penuh): RM 300.00 / month (0 unapproved absence, approved MC/leave does NOT deduct).
6. LANGUAGE & TONE:
   - If user asks in Chinese, answer in sharp, concise, professional Chinese (带必要的高管 bullet points 与 emoji).
   - If user asks in Malay / Manglish (e.g. "xleh", "sangkut", "rosak", "naik barang", "dah smpi"), answer in natural, friendly, respectful Malaysian Malay.
   - Be extremely helpful, clear, and data-backed. Never give generic boilerplate like "Please contact the system administrator" if you can check the live database using your tools.
`;

// ── 2. TOOLS DEFINITION FOR GEMINI ───────────────────────────────────────────
const AGENT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'query_trip',
        description: 'Look up real-time or recent trip details, driver delivery progress, vehicle plate, or trip status.',
        parameters: {
          type: 'OBJECT' as any,
          properties: {
            keyword: {
              type: 'STRING' as any,
              description: 'Driver name (e.g. yan, SHAH, Bob, Ameer), vehicle plate (e.g. 9821, VPC 9821), or trip number.'
            }
          }
        }
      },
      {
        name: 'query_sales_order',
        description: 'Look up sales order status, customer name, delivery location, items count, or POD delivery timestamp.',
        parameters: {
          type: 'OBJECT' as any,
          properties: {
            keyword: {
              type: 'STRING' as any,
              description: 'Order number (e.g. OPM2609-1012, DO-016953) or customer name.'
            }
          }
        }
      },
      {
        name: 'query_machine_status',
        description: 'Check workshop machine operation, today downtime logs, defect/scrap photos, or active product running.',
        parameters: {
          type: 'OBJECT' as any,
          properties: {
            machine_id: {
              type: 'STRING' as any,
              description: 'Machine identifier, e.g. T1-M03, T2-M01, N1-M01, N2-M02, or plant name.'
            }
          }
        }
      },
      {
        name: 'query_stock_and_recipe',
        description: 'Check factory stock balances or official recipe material formulas and roll weights.',
        parameters: {
          type: 'OBJECT' as any,
          properties: {
            keyword: {
              type: 'STRING' as any,
              description: 'SKU or raw material code (e.g. C1802, 7042, 500, SL, DL, Recycle, 2426H).'
            }
          }
        }
      }
    ]
  }
];

// ── 3. TOOL IMPLEMENTATIONS ──────────────────────────────────────────────────
async function executeToolCall(name: string, args: any, supabase: SupabaseClient): Promise<any> {
  const todayStartIso = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';

  if (name === 'query_trip') {
    const kw = (args?.keyword || '').trim();
    let query = supabase
      .from('trips_v2')
      .select('id, trip_number, driver_id, status, started_at, completed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (kw) {
      // Find driver id if kw is driver name
      const { data: matchedDrivers } = await supabase
        .from('users_public')
        .select('id, name')
        .ilike('name', `%${kw}%`);

      const dIds = (matchedDrivers || []).map(d => d.id);
      if (dIds.length > 0) {
        query = query.in('driver_id', dIds);
      } else {
        query = query.ilike('trip_number', `%${kw}%`);
      }
    }

    const { data: trips } = await query;
    if (!trips || trips.length === 0) {
      return { found: false, message: `未找到与 "${kw}" 相关的车次记录。` };
    }

    // Enrich driver name and order stats
    const driverIds = Array.from(new Set(trips.map(t => t.driver_id).filter(Boolean)));
    const { data: drivers } = await supabase.from('users_public').select('id, name').in('id', driverIds);
    const dMap = new Map((drivers || []).map(d => [d.id, d.name]));

    const enriched = await Promise.all(trips.map(async t => {
      const dName = dMap.get(t.driver_id) || '待分配';
      const { data: orders } = await supabase
        .from('sales_orders')
        .select('order_number, customer, status')
        .eq('trip_id', t.id);

      const totalO = orders?.length || 0;
      const deliveredO = (orders || []).filter(o => o.status === 'Delivered').length;
      return {
        trip_number: t.trip_number,
        driver: dName,
        status: t.status,
        started_at: t.started_at,
        completed_at: t.completed_at,
        orders_count: totalO,
        delivered_count: deliveredO,
        sample_customers: (orders || []).slice(0, 3).map(o => o.customer)
      };
    }));

    return { found: true, count: enriched.length, trips: enriched };
  }

  if (name === 'query_sales_order') {
    const kw = (args?.keyword || '').trim();
    let query = supabase
      .from('sales_orders')
      .select('order_number, customer, status, delivery_method, created_at, pod_timestamp, driver_id')
      .order('created_at', { ascending: false })
      .limit(6);

    if (kw) {
      query = query.or(`order_number.ilike.%${kw}%,customer.ilike.%${kw}%`);
    }

    const { data: orders } = await query;
    if (!orders || orders.length === 0) {
      return { found: false, message: `未找到包含 "${kw}" 的销售订单。` };
    }

    return {
      found: true,
      orders: orders.map(o => ({
        order_number: o.order_number,
        customer: o.customer,
        status: o.status,
        pod_timestamp: o.pod_timestamp,
        created_at: o.created_at
      }))
    };
  }

  if (name === 'query_machine_status') {
    const mId = (args?.machine_id || '').toUpperCase().trim();
    // Query recent work photos (downtime, defects, inspection)
    let photoQuery = supabase
      .from('work_photos')
      .select('machine_id, employee_name, category, user_note, ai_description, created_at')
      .gte('created_at', todayStartIso)
      .order('created_at', { ascending: false })
      .limit(10);

    if (mId) {
      photoQuery = photoQuery.ilike('machine_id', `%${mId}%`);
    }

    const { data: logs } = await photoQuery;
    const downtimes = (logs || []).filter(l => l.category === 'downtime');
    const defects = (logs || []).filter(l => l.category === 'defect' || l.category === 'defect_scrap');

    return {
      searched_machine: mId || 'ALL',
      today_downtimes_count: downtimes.length,
      downtime_details: downtimes.map(d => ({
        time: d.created_at,
        machine: d.machine_id,
        note: d.user_note || d.ai_description
      })),
      today_defects_count: defects.length,
      defect_details: defects.slice(0, 3).map(df => ({
        machine: df.machine_id,
        note: df.user_note,
        staff: df.employee_name
      })),
      status_summary: downtimes.length === 0 ? '今日该机台运转正常，无停机报障。' : `今日有 ${downtimes.length} 次停机记录。`
    };
  }

  if (name === 'query_stock_and_recipe') {
    const kw = (args?.keyword || '').trim();
    let q = supabase.from('live_stock').select('*').limit(8);
    if (kw) {
      q = q.ilike('item_id', `%${kw}%`);
    }
    const { data: stock } = await q;

    // Standard recipe knowledge
    const recipeStandards = [
      { product: '单层气泡膜 (Single Layer SL)', roll_weight: '3.80 kg', core_weight: '0.00 kg' },
      { product: '双层气泡膜 (Double Layer DL)', roll_weight: '5.60 kg', core_weight: '0.00 kg' },
      { product: '2米大机气泡膜 (T2/J1)', roll_weight: '5.60 kg x 2卷 = 11.20 kg / 100m' },
      { product: '拉伸膜 (Stretch Film T4)', roll_weight: '净重 2.00 kg, 管芯 0.20 kg, 毛重 2.20 kg' },
      { product: '再生造粒料 (Pellets T5/N3)', roll_weight: '25.00 kg / 包' }
    ];

    return {
      matched_stock: (stock || []).map(s => ({ item: s.item_id, quantity: s.quantity, plant: s.factory_id })),
      recipe_standards: recipeStandards
    };
  }

  return { error: `未知的工具名称: ${name}` };
}

// ── 4. CONVERSATION HISTORY (PERSISTENT MEMORY) ───────────────────────────────
export async function getChatHistory(sessionId: string, limit: number = 8): Promise<any[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('whatsapp_chat_history')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    // Chronological order for Gemini API
    const chronological = [...data].reverse();
    return chronological.map(row => ({
      role: row.role === 'model' ? 'model' : 'user',
      parts: [{ text: row.content }]
    }));
  } catch (err) {
    console.warn('[getChatHistory Error]:', err);
    return [];
  }
}

export async function saveChatMessage(sessionId: string, role: 'user' | 'model', content: string, senderName?: string) {
  try {
    const supabase = getSupabase();
    await supabase.from('whatsapp_chat_history').insert({
      session_id: sessionId,
      role,
      content,
      sender_name: senderName || null,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[saveChatMessage Error]:', err);
  }
}

// ── 5. MAIN SMART AGENT ENTRYPOINT ───────────────────────────────────────────
export async function handleSmartAgentQuery(params: {
  sessionId: string;
  userText: string;
  senderName: string;
  senderRole: string;
  userPhone?: string;
  baseLocation?: string;
}): Promise<string> {
  const { sessionId, userText, senderName, senderRole, userPhone, baseLocation } = params;

  const genAI = getGenAI();
  if (!genAI) {
    return '⚠️ AI 服务未配置 API Key，请联系管理员。';
  }

  const supabase = getSupabase();

  try {
    // 1. Fetch persistent multi-turn history
    const history = await getChatHistory(sessionId, 6);

    // 2. Initialize Gemini with full factory tools & system prompt
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `${FACTORY_BUSINESS_TRUTH_PROMPT}\n\n[CURRENT CONVERSATION CONTEXT]:\n- Current User: ${senderName} (Role: ${senderRole}, Phone: ${userPhone || '-'}).\n- Plant/Location: ${baseLocation || 'TAIPING'}.\n- Session: ${sessionId}.`,
      tools: AGENT_TOOLS
    });

    const chat = model.startChat({ history });

    // 3. Save incoming user message
    await saveChatMessage(sessionId, 'user', userText, senderName);

    // 4. Send message to Gemini
    let response = await chat.sendMessage(userText);

    // 5. Tool Call Execution Loop (up to 3 consecutive tool calls)
    let loopCount = 0;
    while (response.response.functionCalls() && response.response.functionCalls()!.length > 0 && loopCount < 3) {
      loopCount++;
      const functionCalls = response.response.functionCalls()!;
      const toolCall = functionCalls[0];

      console.log(`[WhatsApp SmartAgent Tool]: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
      const toolResult = await executeToolCall(toolCall.name, toolCall.args, supabase);

      // Return tool result to model
      response = await chat.sendMessage([
        {
          functionResponse: {
            name: toolCall.name,
            response: toolResult
          }
        }
      ]);
    }

    const finalAnswer = response.response.text().trim();

    // 6. Save assistant answer to memory
    await saveChatMessage(sessionId, 'model', finalAnswer, 'Packsecure AI');

    return finalAnswer;
  } catch (err: any) {
    console.error('[handleSmartAgentQuery Error]:', err);
    return `抱歉，在处理您的查询时遇到网络波动：${err.message || '请稍后重试'}`;
  }
}
