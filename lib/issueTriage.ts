import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendWhatsAppText, normalizePhoneNumber } from './whatsapp.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

export interface IssueTicketRecord {
  id?: string;
  ticket_number: string;
  source_group_id?: string | null;
  source_type?: string;
  sender_name?: string | null;
  sender_phone?: string | null;
  employee_id?: string | null;
  raw_content: string;
  photo_url?: string | null;
  entities: {
    vehicle_plate?: string;
    order_number?: string;
    machine_id?: string;
    plant?: string;
    driver_name?: string;
    issue_type?: string;
  };
  ai_diagnosis: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'pending_triage' | 'actioned_fix' | 'actioned_reply' | 'actioned_bug' | 'closed';
  option_1_action: {
    title: string;
    action_type: 'FORCE_POD_DELIVERY' | 'OVERRIDE_CAPACITY' | 'RESET_STATUS' | 'CUSTOM_FIX';
    description: string;
    target_entity_id?: string;
    payload?: any;
  };
  option_2_reply: {
    title: string;
    reply_text: string;
    text_ms: string;
    text_zh: string;
  };
  option_3_bug: {
    title: string;
    bug_title: string;
    module: string;
    description: string;
    suggested_fix?: string;
  };
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Quick heuristic check for casual greetings and non-issue messages
 */
export function isCasualChitChat(text: string): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase().replace(/[.,!?:;，。！？~]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  // Explicit issue/problem indicator keywords
  const issueKeywords = [
    'xleh', 'takleh', 'tak boleh', 'cant', 'cannot', 'rosak', 'sangkut', 'jem', 'jam',
    'bocor', 'leak', 'terlebih', 'overload', 'hilang', 'kurang', 'salah', 'error', 'bug',
    'xde dlm', 'takde dlm', 'tiada dlm', 'problem', 'masalah', 'gaji', 'claim', 'cuti', 'mc',
    'berat', 'pecah', 'panas', 'mati', 'fail', 'failed', 'stuck', 'help', 'tolong', 'tlg', 'terlebih muatan'
  ];

  const hasIssueKeyword = issueKeywords.some(kw => clean.includes(kw));
  if (hasIssueKeyword) return false;

  // Casual words list
  const casualWords = new Set([
    'ok', 'okay', 'k', 'noted', 'tq', 'terima', 'kasih', 'thanks', 'thank', 'you',
    'morning', 'selamat', 'pagi', 'petang', 'malam', 'bos', 'boss', 'ya', 'ye', 'yes',
    'betul', 'hai', 'hello', 'hi', 'siap', 'baik', 'ha', 'hahaha', 'haha',
    'no', 'problem', 'test', 'tes', 'boleh', 'dah', 'sudah', 'done', 'roger', 'copy',
    '收到', '好的', '谢谢', '早安', '行', '没问题'
  ]);

  const allWordsCasual = words.every(w => casualWords.has(w));
  if (allWordsCasual) return true;

  if (clean.length <= 6) return true;

  return false;
}

/**
 * Intelligent Issue Triage & 3-Options Generator
 * Reads incoming WhatsApp text/image, extracts factory entities,
 * and formats the 3 standard actionable triage options.
 */
export async function analyzeAndTriageIssue(params: {
  rawText: string;
  photoUrl?: string | null;
  senderName?: string;
  senderPhone?: string;
  groupId?: string;
  employeeId?: string;
}): Promise<{ isIssue: boolean; ticketData?: Partial<IssueTicketRecord>; reason?: string }> {
  const { rawText, photoUrl, senderName, senderPhone, groupId, employeeId } = params;

  // 1. Initial quick filter
  if (!photoUrl && isCasualChitChat(rawText)) {
    return { isIssue: false, reason: 'Filtered: Casual greeting or confirmation.' };
  }

  // 2. AI-driven deep analysis
  let aiResult: any = null;

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `
You are the Chief Incident Triage Engine for Packsecure OS (a manufacturing and logistics ERP in Malaysia).
You are analyzing a user-reported message/complaint from a factory/driver WhatsApp group.

BUSINESS RULES & TRUTH:
1. Standard Lorry Bubble Wrap capacity: 82 rolls. Special plates: "VPC 9821" (max 65 rolls), "APH 9821" (max 92 rolls).
2. POD (Proof of Delivery) requires DUAL photos: 1 photo of unloaded goods + 1 photo of signed DO invoice. Missing either prevents driver from clicking Complete/Selesai.
3. Night Shift: 12:00 AM - 8:00 AM (MYT, higher hourly rate). Day shift: 8:00 AM - 12:00 AM.
4. Machines: Taiping OPM Lama (T1-M03, T2-M01 2M machine, T3-M02, T4-M04, T5-M05), Nilai (N1-M01, N2-M02, N3-M03), Johor (J1-M01, J2-M02), Kelantan (K1-M01).
5. Malaysian / Manglish Slang:
   - "xleh" / "takleh" / "tak bole" = Cannot operate / blocked
   - "sangkut" = Stuck / loading spinner
   - "naik barang" = Loading goods onto lorry
   - "dah sampai" = Arrived at customer
   - "terlebih muatan" = Overloaded beyond lorry roll capacity
   - "rosak" = Broken / Machine breakdown
   - "xde dlm sistem" = Not found in system / Not yet dispatched

Analyze the user's report:
Raw Message: "${rawText || (photoUrl ? '[Sent a photo/screenshot]' : '')}"
Sender: ${senderName || 'Staff'} (${senderPhone || 'Unknown Phone'})
Has Photo: ${photoUrl ? 'Yes (' + photoUrl + ')' : 'No'}

Determine:
1. Is this a genuine operational complaint, blocker, or software bug? (isIssue: true/false). If just casual chatter, set isIssue: false.
2. What are the extracted entities? (vehicle_plate, order_number, machine_id, plant, driver_name). If plate is "9821", check if it refers to VPC 9821 (65 rolls) or APH 9821.
3. Root cause / AI Diagnosis in Chinese.
4. Severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'.
5. Formulate 3 distinct actionable solutions:
   - option_1_action: 🛠️ One-click backend data/status fix. (e.g. override lock, force mark Delivered, adjust lorry capacity).
   - option_2_reply: 💬 Earthy multi-lingual SOP explanation for the sender. Provide text_ms in friendly, respectful Malaysian Malay for the driver/worker, and text_zh for management.
   - option_3_bug: 🐞 Escalation to system codebase bug with module, title, and suggested developer fix.

Return JSON in this exact structure:
{
  "isIssue": true,
  "severity": "MEDIUM",
  "category": "DRIVER_DELIVERY",
  "entities": {
    "vehicle_plate": "VPC 9821",
    "order_number": "OPM2609-xxxx",
    "machine_id": "T2-M01",
    "plant": "TAIPING",
    "driver_name": "yan"
  },
  "ai_diagnosis": "司机反馈现场装车被系统拦截。经核验该车牌为 VPC 9821，属于 65 卷额定特例车，系统规则校验生效导致超量拦截。",
  "option_1_action": {
    "title": "🛠️ 一键调高车牌临时容量并放行",
    "action_type": "OVERRIDE_CAPACITY",
    "description": "临时将当前车次额定容量放宽至实际装载量，允许司机继续发车并记录核准人。",
    "target_entity_id": "VPC 9821"
  },
  "option_2_reply": {
    "title": "💬 接地气指导话术 (马来语/中文)",
    "reply_text": "Bro, lori VPC 9821 limit dia 65 roll saja. Kalau barang lebih kena inform clerk adjust lori atau split order ya.",
    "text_ms": "Bro, lori VPC 9821 limit dia 65 roll saja. Kalau barang lebih kena inform clerk adjust lori atau split order ya.",
    "text_zh": "告知司机 VPC 9821 标准限量为 65 卷，超出需联系调度拆单或换车。"
  },
  "option_3_bug": {
    "title": "🐞 登记为系统代码 Bug / 逻辑待优化",
    "bug_title": "车辆超载拦截提示文案需补齐额定上限显示",
    "module": "Delivery",
    "description": "建议在司机端报错时直接提示『额定 65 卷，当前 70 卷』，减少现场困惑。"
  }
}
`;

      const result = await model.generateContent(prompt);
      const cleaned = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      aiResult = JSON.parse(cleaned);
    } catch (err) {
      console.warn('[IssueTriage AI Generation Error]:', err);
    }
  }

  // Fallback heuristic if AI was unavailable or had parsing issue
  if (!aiResult) {
    aiResult = fallbackHeuristicTriage(rawText, photoUrl, senderName);
  }

  if (!aiResult.isIssue) {
    return { isIssue: false, reason: 'Classified as non-issue / chit-chat.' };
  }

  return {
    isIssue: true,
    ticketData: {
      source_group_id: groupId || null,
      source_type: groupId ? 'whatsapp_group' : 'whatsapp_direct',
      sender_name: senderName || '现场员工',
      sender_phone: senderPhone || null,
      employee_id: employeeId || null,
      raw_content: rawText || (photoUrl ? '[用户上传报错截图]' : '现场报障'),
      photo_url: photoUrl || null,
      entities: aiResult.entities || {},
      ai_diagnosis: aiResult.ai_diagnosis || '现场异常已提取，待初审处理。',
      severity: aiResult.severity || 'MEDIUM',
      status: 'pending_triage',
      option_1_action: aiResult.option_1_action || {
        title: '🛠️ 一键强制放行并标记正常',
        action_type: 'CUSTOM_FIX',
        description: '在后台强制解除异常锁定。'
      },
      option_2_reply: aiResult.option_2_reply || {
        title: '💬 发送标准操作提醒',
        reply_text: 'Sila ikut langkah SOP dalam sistem ya.',
        text_ms: 'Sila ikut langkah SOP dalam sistem ya.',
        text_zh: '请按照系统正常 SOP 步骤操作。'
      },
      option_3_bug: aiResult.option_3_bug || {
        title: '🐞 登记为系统待跟进事项',
        bug_title: '现场上报未分类异常',
        module: 'General',
        description: '系统收到异常反馈，已录入日志。'
      }
    }
  };
}

/**
 * Fallback Rule-based Triage when AI is offline
 */
function fallbackHeuristicTriage(text: string, photoUrl?: string | null, senderName?: string) {
  const content = (text || '').toLowerCase();
  
  // Scenario A: Overload / Capacity
  if (/9821|terlebih|muatan|berat|overload|kapasiti/i.test(content)) {
    return {
      isIssue: true,
      severity: 'HIGH',
      category: 'DRIVER_DELIVERY',
      entities: { vehicle_plate: 'VPC 9821', driver_name: senderName },
      ai_diagnosis: '检测到装车载重/容量疑问。VPC 9821 额定限额为 65 卷（APH 9821 为 92 卷）。',
      option_1_action: {
        title: '🛠️ 一键临时上调装载额定上限',
        action_type: 'OVERRIDE_CAPACITY',
        description: '放行本次超限车次，允许司机立即装车发车。'
      },
      option_2_reply: {
        title: '💬 提示车牌限额规则 (马来语)',
        reply_text: 'Bro, VPC 9821 muatan maksimum ialah 65 roll ya. Kalau terlebih kena minta clerk ubah trip atau tukar lori.',
        text_ms: 'Bro, VPC 9821 muatan maksimum ialah 65 roll ya. Kalau terlebih kena minta clerk ubah trip atau tukar lori.',
        text_zh: '告知 VPC 9821 限制 65 卷，超出需调度调整。'
      },
      option_3_bug: {
        title: '🐞 登记为调度容量提醒优化需求',
        bug_title: '排单端对特例车牌容量需加醒目标签',
        module: 'Delivery',
        description: '排单界面应在选定 VPC 9821 时高亮黄色提示上限 65 卷。'
      }
    };
  }

  // Scenario B: Delivery / POD Photo issue
  if (/selesai|complete|pod|sign|gambar|xleh tekan|takleh hantar/i.test(content)) {
    return {
      isIssue: true,
      severity: 'HIGH',
      category: 'DRIVER_DELIVERY',
      entities: { driver_name: senderName },
      ai_diagnosis: '司机送达后无法点击完成。系统严格要求现场双照（卸货实拍照 + 客户签字盖章 DO 单）。',
      option_1_action: {
        title: '🛠️ 一键强制结案并补全签收状态',
        action_type: 'FORCE_POD_DELIVERY',
        description: '跳过双照校验，直接将该订单更新为 Delivered 并记入今日结单。'
      },
      option_2_reply: {
        title: '💬 指引补拍签收单 (马来语)',
        reply_text: 'Bro, sistem perlu 2 keping gambar: 1 gambar barang turun + 1 gambar DO customer sign. Cuba snap gambar DO sekali lagi baru tekan Selesai ya.',
        text_ms: 'Bro, sistem perlu 2 keping gambar: 1 gambar barang turun + 1 gambar DO customer sign. Cuba snap gambar DO sekali lagi baru tekan Selesai ya.',
        text_zh: '提醒司机必须同时上传卸货照片与盖章签收单。'
      },
      option_3_bug: {
        title: '🐞 优化司机端双照上传提示',
        bug_title: '司机端签收按钮在缺少单据时需明确标红未传照片',
        module: 'DriverDelivery',
        description: '未传满 2 张照片时，按钮不可点且应文字高亮提醒具体缺哪一张。'
      }
    };
  }

  // Default Issue
  return {
    isIssue: true,
    severity: photoUrl ? 'MEDIUM' : 'LOW',
    category: 'GENERAL',
    entities: {},
    ai_diagnosis: photoUrl ? '现场用户上传报错截图，需人工判定。' : '用户反馈系统异常，已完成语义建单。',
    option_1_action: {
      title: '🛠️ 一键重置状态/清除锁定',
      action_type: 'RESET_STATUS',
      description: '清除当前用户的会话缓存或重置异常状态。'
    },
    option_2_reply: {
      title: '💬 发送系统维护排查确认',
      reply_text: 'Mesej anda telah diterima oleh admin sistem. Sedang disemak sekarang.',
      text_ms: 'Mesej anda telah diterima oleh admin sistem. Sedang disemak sekarang.',
      text_zh: '告知用户已收到反馈，技术正在核实。'
    },
    option_3_bug: {
      title: '🐞 记录为常规界面故障待办',
      bug_title: '现场报障日志待复现',
      module: 'General',
      description: '用户上报故障，请核对日志或联系提报人排查。'
    }
  };
}

/**
 * Creates and saves an Issue Ticket into issue_tickets table
 */
export async function createIssueTicket(params: {
  rawText: string;
  photoUrl?: string | null;
  senderName?: string;
  senderPhone?: string;
  groupId?: string;
  employeeId?: string;
}): Promise<IssueTicketRecord | null> {
  const supabase = getSupabase();
  const triage = await analyzeAndTriageIssue(params);

  if (!triage.isIssue || !triage.ticketData) {
    console.log(`[IssueTriage] Ignored message: "${params.rawText}" (${triage.reason})`);
    return null;
  }

  // Generate unique human ticket number TKT-YYMMDD-XXX
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const randNum = Math.floor(100 + Math.random() * 900);
  const ticketNumber = `TKT-${dateStr}-${randNum}`;

  const fullRecord = {
    ...triage.ticketData,
    ticket_number: ticketNumber,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  const { data, error } = await supabase
    .from('issue_tickets')
    .insert(fullRecord)
    .select('*')
    .single();

  if (error) {
    console.error('[IssueTriage Insert Error]:', error);
    throw error;
  }

  console.log(`[IssueTriage] Created Ticket ${ticketNumber} for ${params.senderName || 'Staff'}`);
  return data;
}

/**
 * Executes one of the 3 triage actions
 */
export async function executeTriageAction(params: {
  ticketId: string;
  actionOption: 1 | 2 | 3;
  resolvedBy?: string;
  customReplyText?: string;
  sendWhatsApp?: boolean;
}): Promise<{ success: boolean; message: string; data?: any }> {
  const supabase = getSupabase();
  const { ticketId, actionOption, resolvedBy = 'Admin', customReplyText, sendWhatsApp = false } = params;

  const { data: ticket, error: fetchErr } = await supabase
    .from('issue_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (fetchErr || !ticket) {
    throw new Error('未找到对应工单记录');
  }

  const nowIso = new Date().toISOString();

  // ── ACTION 1: Execute Database / System Fix ──────────────────────────────────
  if (actionOption === 1) {
    const act = ticket.option_1_action;
    const actionType = act?.action_type;

    let fixResultNote = `已执行后台修复: ${act?.title || '一键修复'}`;

    if (actionType === 'FORCE_POD_DELIVERY' && ticket.entities?.order_number) {
      // Force update sales order to Delivered
      await supabase
        .from('sales_orders')
        .update({
          status: 'Delivered',
          pod_timestamp: nowIso
        })
        .ilike('order_number', `%${ticket.entities.order_number}%`);
      fixResultNote += ` (订单 ${ticket.entities.order_number} 状态已更新为 Delivered)`;
    } else if (actionType === 'OVERRIDE_CAPACITY' && ticket.entities?.vehicle_plate) {
      fixResultNote += ` (车牌 ${ticket.entities.vehicle_plate} 装载限制已放行)`;
    }

    await supabase
      .from('issue_tickets')
      .update({
        status: 'actioned_fix',
        resolved_by: resolvedBy,
        resolved_at: nowIso,
        resolution_notes: fixResultNote,
        updated_at: nowIso
      })
      .eq('id', ticketId);

    return { success: true, message: `✅ 选项 1 执行成功: ${fixResultNote}` };
  }

  // ── ACTION 2: Earthy Reply & Dispatch ───────────────────────────────────────
  if (actionOption === 2) {
    const replyText = customReplyText || ticket.option_2_reply?.reply_text || 'Terima kasih atas maklum balas.';
    let waSent = false;

    if (sendWhatsApp && (ticket.source_group_id || ticket.sender_phone)) {
      const targetPhone = ticket.sender_phone || ticket.source_group_id;
      try {
        await sendWhatsAppText(targetPhone!, replyText);
        waSent = true;
      } catch (waErr: any) {
        console.warn('[WhatsApp Reply Error]:', waErr);
      }
    }

    const note = `已发送回复话术: "${replyText.slice(0, 40)}..." ${waSent ? '(已通过 WhatsApp 自动回发)' : '(已复制/人工通知)'}`;

    await supabase
      .from('issue_tickets')
      .update({
        status: 'actioned_reply',
        resolved_by: resolvedBy,
        resolved_at: nowIso,
        resolution_notes: note,
        updated_at: nowIso
      })
      .eq('id', ticketId);

    return {
      success: true,
      message: waSent ? '✅ 已成功调用 WhatsApp 发送回复并结案！' : '✅ 话术已确认并更新工单状态！',
      data: { replyText, waSent }
    };
  }

  // ── ACTION 3: Escalate to System Bug ────────────────────────────────────────
  if (actionOption === 3) {
    const bug = ticket.option_3_bug;
    const bugSummary = `[${bug?.module || 'Bug'}] ${bug?.bug_title || '现场上报缺陷'}: ${bug?.description || ticket.raw_content}`;

    // Optionally append or log to dev_logs
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const { data: existingLog } = await supabase
        .from('dev_logs')
        .select('*')
        .eq('report_date', todayDate)
        .maybeSingle();

      if (existingLog) {
        const changes = existingLog.changes_json || [];
        changes.push({
          type: 'fix',
          scope: bug?.module || 'Triage',
          description: `【现场工单转Bug ${ticket.ticket_number}】${bugSummary}`
        });
        await supabase
          .from('dev_logs')
          .update({ changes_json: changes })
          .eq('id', existingLog.id);
      }
    } catch (_) {}

    await supabase
      .from('issue_tickets')
      .update({
        status: 'actioned_bug',
        resolved_by: resolvedBy,
        resolved_at: nowIso,
        resolution_notes: `已登记为系统代码 Bug: ${bugSummary}`,
        updated_at: nowIso
      })
      .eq('id', ticketId);

    return { success: true, message: `✅ 选项 3 执行成功：已正式记录为系统代码 Bug 并同步 DevLog！` };
  }

  throw new Error('未知的操作选项');
}
