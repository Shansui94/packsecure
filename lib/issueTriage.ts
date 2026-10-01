import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendWhatsAppText, normalizePhoneNumber } from './whatsapp.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

function getGenAI(): GoogleGenerativeAI | null {
  const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_API_KEY || '';
  if (!geminiApiKey) return null;
  return new GoogleGenerativeAI(geminiApiKey);
}

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
  task_id?: string | null;
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
  status: 'pending_triage' | 'actioned_task' | 'actioned_fix' | 'actioned_reply' | 'actioned_bug' | 'closed';
  option_1_action: {
    title: string;
    action_type: string;
    description: string;
    recommended_task_title?: string;
    priority?: 'High' | 'Normal' | 'Low';
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

  // Words that indicate an issue / complaint
  const hasIssueKeyword = /rosak|takleh|xleh|tak boleh|error|bug|bocor|terlebih|overload|stuck|sangkut|pancit|kemalangan|crash|problem|masalah|故障|报错|卡死|无法|崩溃|不能|损坏|退回|漏气/i.test(text);
  if (hasIssueKeyword) return false;

  // Casual words list
  const casualWords = new Set([
    'ok', 'okay', 'k', 'noted', 'tq', 'terima', 'kasih', 'thanks', 'thank', 'you',
    'morning', 'selamat', 'pagi', 'petang', 'malam', 'bos', 'boss', 'ya', 'ye', 'yes',
    'betul', 'hai', 'hello', 'hi', 'siap', 'baik', 'ha', 'hahaha', 'haha',
    'no', 'problem', 'test', 'tes', 'boleh', 'dah', 'sudah', 'done', 'roger', 'copy',
    '收到', '好的', '谢谢', '早安', '行', '没问题', '打卡', '晚报', '日报', '查单', '库存'
  ]);

  const allWordsCasual = words.every(w => casualWords.has(w));
  if (allWordsCasual) return true;

  if (clean.length <= 5) return true;

  return false;
}

/**
 * Intelligent Issue Triage & 3-Options Generator
 * Reads incoming WhatsApp text/image, extracts factory entities,
 * and formats the 3 standard actionable triage options using Gemini 3.1 Pro (with Flash fallback).
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
    return { isIssue: false, reason: 'Filtered: Casual greeting, command, or confirmation.' };
  }

  // 2. AI-driven deep analysis (Gemini 3.1 Pro Preview with Gemini 2.5 Flash Fallback)
  let aiResult: any = null;
  const genAI = getGenAI();

  if (genAI) {
    const prompt = `
You are the Chief Incident Triage Engine for Packsecure OS (a manufacturing and logistics ERP in Malaysia).
You are analyzing a user-reported message or complaint from a factory/driver WhatsApp group.

BUSINESS RULES & TRUTH:
1. Standard Lorry Bubble Wrap capacity: 82 rolls. Special plates: "VPC 9821" (max 65 rolls, short chassis), "APH 9821" (max 92 rolls, long high-side).
2. POD (Proof of Delivery) requires DUAL photos: 1 photo of unloaded goods at customer premise + 1 photo of signed DO invoice. Missing either prevents driver from clicking Complete/Selesai.
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
1. Is this a genuine operational complaint, blocker, malfunction, or software bug? (isIssue: true/false).
   CRITICAL: If it is an ordinary inquiry, instruction, daily report request, or casual chat, set "isIssue": false.
2. What are the extracted entities? (vehicle_plate, order_number, machine_id, plant, driver_name). If plate is "9821", check if it refers to VPC 9821 (65 rolls) or APH 9821.
3. Root cause / AI Diagnosis in sharp, professional Chinese (AI 3.1 Pro 深度因果诊断).
4. Severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'.
5. Formulate 3 distinct actionable solutions:
   - option_1_action: 🛠️ 1-Click Task Creation for Team Kanban. Recommended task title, priority ('High'|'Normal'|'Low'), and exact action plan.
   - option_2_reply: 💬 Earthy multi-lingual SOP explanation for the sender. Provide text_ms in friendly, respectful Malaysian Malay for the driver/worker, and text_zh for management.
   - option_3_bug: 🐞 Escalation details: bug title, module ('Delivery' | 'Production' | 'DriverApp' | 'HR'), and description.

Return strictly valid JSON in this exact structure:
{
  "isIssue": boolean,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "category": "DRIVER_DELIVERY" | "MACHINE_PRODUCTION" | "APP_BUG" | "HR_PAYROLL" | "GENERAL",
  "entities": {
    "vehicle_plate": string or null,
    "order_number": string or null,
    "machine_id": string or null,
    "plant": string or null,
    "driver_name": string or null
  },
  "ai_diagnosis": "清晰说明问题根因与涉及的规则",
  "option_1_action": {
    "title": "转为待办任务并跟踪排查",
    "recommended_task_title": "简明任务标题",
    "action_type": "CREATE_TASK",
    "description": "任务执行要点与指派建议",
    "priority": "High"
  },
  "option_2_reply": {
    "title": "一键回复现场话术 (马来语/中文)",
    "reply_text": "现场安抚与操作指导话术",
    "text_ms": "Friendly Malay / Manglish instruction for the worker",
    "text_zh": "中文指导说明"
  },
  "option_3_bug": {
    "title": "登记为系统代码 Bug / 现场误会归档",
    "bug_title": "软件缺陷或规则优化点",
    "module": "Delivery",
    "description": "技术复现与改进建议"
  }
}
`;

    try {
      // Primary: Gemini 3.1 Pro Preview
      let model = genAI.getGenerativeModel({
        model: 'gemini-3.1-pro-preview',
        generationConfig: { responseMimeType: 'application/json' }
      });

      try {
        const result = await model.generateContent(prompt);
        const cleaned = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        aiResult = JSON.parse(cleaned);
      } catch (proErr) {
        console.warn('[IssueTriage Pro Error, Falling back to Flash]:', proErr);
        // Fallback: Gemini 2.5 Flash
        model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { responseMimeType: 'application/json' }
        });
        const result = await model.generateContent(prompt);
        const cleaned = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        aiResult = JSON.parse(cleaned);
      }
    } catch (err) {
      console.warn('[IssueTriage AI Generation Error]:', err);
    }
  }

  // Fallback heuristic if AI was unavailable or had parsing issue
  if (!aiResult) {
    aiResult = fallbackHeuristicTriage(rawText, photoUrl, senderName);
  }

  if (!aiResult.isIssue) {
    return { isIssue: false, reason: 'Classified as non-issue / chit-chat / general query.' };
  }

  return {
    isIssue: true,
    ticketData: {
      source_group_id: groupId || null,
      source_type: groupId ? 'whatsapp_group' : 'whatsapp_direct',
      sender_name: senderName || '现场员工',
      sender_phone: senderPhone || null,
      employee_id: employeeId || null,
      raw_content: rawText,
      photo_url: photoUrl || null,
      entities: aiResult.entities || {},
      ai_diagnosis: aiResult.ai_diagnosis || '现场异常待处理',
      severity: aiResult.severity || 'MEDIUM',
      status: 'pending_triage',
      option_1_action: aiResult.option_1_action || {
        title: '转为待办任务并跟踪排查',
        recommended_task_title: `现场报障: ${rawText.slice(0, 20)}`,
        action_type: 'CREATE_TASK',
        description: '跟进处理现场提报问题',
        priority: 'Normal'
      },
      option_2_reply: aiResult.option_2_reply || {
        title: '一键回复现场话术',
        reply_text: 'Terima kasih. Makluman telah diterima dan sedang disemak.',
        text_ms: 'Terima kasih. Makluman telah diterima dan sedang disemak.',
        text_zh: '已收到现场反馈，正在处理。'
      },
      option_3_bug: aiResult.option_3_bug || {
        title: '登记为系统代码 Bug / 现场误会归档',
        bug_title: '现场报障待复现',
        module: 'General',
        description: '用户上报故障，请核对日志或联系提报人排查。'
      }
    }
  };
}

/**
 * Fallback Rule-based Triage when AI is offline
 */
function fallbackHeuristicTriage(text: string, photoUrl?: string | null, senderName?: string) {
  const content = (text || '').toLowerCase();

  // Strictly require distress / bug / complaint keywords. NEVER default to isIssue: true!
  const hasDistressWord = /rosak|takleh|xleh|tak boleh|error|bug|rusak|bocor|terlebih|overload|stuck|sangkut|pancit|kemalangan|crash|problem|masalah|故障|报错|卡死|无法|崩溃|不能|损坏/i.test(content);
  if (!hasDistressWord && !photoUrl) {
    return { isIssue: false, reason: 'No distress or problem keywords detected in heuristic fallback.' };
  }

  // Scenario A: Overload / Capacity
  if (/9821|terlebih|muatan|berat|overload|kapasiti/i.test(content)) {
    return {
      isIssue: true,
      severity: 'HIGH',
      category: 'DRIVER_DELIVERY',
      entities: { vehicle_plate: 'VPC 9821', driver_name: senderName },
      ai_diagnosis: '检测到装车载重/容量疑问。VPC 9821 额定限额为 65 卷（APH 9821 为 92 卷）。',
      option_1_action: {
        title: '转为待办任务',
        recommended_task_title: '核验 VPC 9821 车次装载拆单或换车',
        action_type: 'CREATE_TASK',
        description: '排查车辆容量限制，必要时通知调度拆单或调配高栏货车。',
        priority: 'High'
      },
      option_2_reply: {
        title: '提示车牌限额规则 (马来语)',
        reply_text: 'Bro, VPC 9821 muatan maksimum ialah 65 roll ya. Jangan paksa loading, saya dah maklumkan clerk untuk adjust trip ya.',
        text_ms: 'Bro, VPC 9821 muatan maksimum ialah 65 roll ya. Jangan paksa loading, saya dah maklumkan clerk untuk adjust trip ya.',
        text_zh: '告知 VPC 9821 限制 65 卷，超出需调度调整。'
      },
      option_3_bug: {
        title: '登记为调度容量提醒优化需求',
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
        title: '转为待办任务',
        recommended_task_title: `排查司机 ${senderName || 'Pemandu'} 送达签收阻断`,
        action_type: 'CREATE_TASK',
        description: '核实客户现场是否签收，或协助司机上传盖章 DO 证明。',
        priority: 'Normal'
      },
      option_2_reply: {
        title: '指引补拍签收单 (马来语)',
        reply_text: 'Bro, sistem perlu 2 keping gambar: 1 gambar barang turun + 1 gambar DO customer cop sign. Cuba snap gambar DO sekali lagi baru tekan Selesai ya.',
        text_ms: 'Bro, sistem perlu 2 keping gambar: 1 gambar barang turun + 1 gambar DO customer cop sign. Cuba snap gambar DO sekali lagi baru tekan Selesai ya.',
        text_zh: '提醒司机必须同时上传卸货照片与盖章签收单。'
      },
      option_3_bug: {
        title: '优化司机端双照上传提示',
        bug_title: '司机端签收按钮在缺少单据时需明确标红未传照片',
        module: 'DriverDelivery',
        description: '未传满 2 张照片时，按钮不可点且应文字高亮提醒具体缺哪一张。'
      }
    };
  }

  // General Issue
  return {
    isIssue: true,
    severity: photoUrl ? 'MEDIUM' : 'LOW',
    category: 'GENERAL',
    entities: {},
    ai_diagnosis: photoUrl ? '现场用户上传报错截图，需人工判定排查。' : '用户反馈系统异常，已完成语义建单。',
    option_1_action: {
      title: '转为待办任务',
      recommended_task_title: `跟进现场反馈: ${text.slice(0, 20)}`,
      action_type: 'CREATE_TASK',
      description: '排查现场上报的异常情况。',
      priority: 'Normal'
    },
    option_2_reply: {
      title: '发送处理中确认',
      reply_text: 'Mesej anda telah diterima oleh pihak pengurusan. Sedang disemak sekarang ya.',
      text_ms: 'Mesej anda telah diterima oleh pihak pengurusan. Sedang disemak sekarang ya.',
      text_zh: '告知用户已收到反馈，技术正在核实。'
    },
    option_3_bug: {
      title: '记录为常规界面故障待办',
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
    console.log(`[IssueTriage] Ignored non-issue message: "${params.rawText}" (${triage.reason})`);
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
 * Executes one of the 3 triage actions (Commander Decision Closed-Loop)
 */
export async function executeTriageAction(params: {
  ticketId: string;
  actionOption: 1 | 2 | 3 | 'create_task' | 'reply' | 'close';
  resolvedBy?: string;
  customReplyText?: string;
  sendWhatsApp?: boolean;
  taskTitle?: string;
  taskDescription?: string;
  assignedTo?: string;
  priority?: 'High' | 'Normal' | 'Low';
  userId?: string;
  resolutionNotes?: string;
}): Promise<{ success: boolean; message: string; data?: any; task?: any }> {
  const supabase = getSupabase();
  const {
    ticketId,
    actionOption,
    resolvedBy = 'Admin',
    customReplyText,
    sendWhatsApp = false,
    taskTitle,
    taskDescription,
    assignedTo,
    priority,
    userId,
    resolutionNotes
  } = params;

  const { data: ticket, error: fetchErr } = await supabase
    .from('issue_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (fetchErr || !ticket) {
    throw new Error('未找到对应工单记录');
  }

  const nowIso = new Date().toISOString();

  // ── ACTION 1: 1-Click Convert to Real Task in 'tasks' table ──────────────────
  if (actionOption === 1 || actionOption === 'create_task') {
    const finalTaskTitle = taskTitle ||
      `[现场报障] ${ticket.ticket_number} - ${ticket.option_1_action?.recommended_task_title || ticket.option_3_bug?.bug_title || ticket.raw_content.slice(0, 30)}`;

    const finalDescription = taskDescription || [
      `🚨 现场报障详情 (${ticket.ticket_number}):`,
      `• 提报人: ${ticket.sender_name || '员工'} (${ticket.sender_phone || '-'})`,
      `• 来源渠道: ${ticket.source_type === 'whatsapp_group' ? 'WhatsApp 现场群' : 'WhatsApp 私聊'}`,
      `• 原始反馈: "${ticket.raw_content}"`,
      `• AI 3.1 Pro 深度诊断: ${ticket.ai_diagnosis}`,
      ticket.entities?.vehicle_plate ? `• 涉及车牌: ${ticket.entities.vehicle_plate}` : '',
      ticket.entities?.order_number ? `• 涉及单号: ${ticket.entities.order_number}` : '',
      ticket.entities?.machine_id ? `• 涉及机台: ${ticket.entities.machine_id}` : '',
      `• 处置建议: ${ticket.option_1_action?.description || '-'}`
    ].filter(Boolean).join('\n');

    const finalPriority = priority || ticket.option_1_action?.priority || (ticket.severity === 'CRITICAL' || ticket.severity === 'HIGH' ? 'High' : 'Normal');

    // 1. Insert directly into public.tasks table
    const { data: createdTask, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        title: finalTaskTitle,
        description: finalDescription,
        priority: finalPriority,
        status: 'To Do',
        assigned_to: assignedTo || null,
        created_by: userId || null,
        created_at: nowIso
      })
      .select('id, title, priority')
      .single();

    if (taskErr) {
      console.error('[Create Task from Ticket Error]:', taskErr);
      throw new Error(`创建待办任务失败: ${taskErr.message}`);
    }

    // 2. Link task_id to issue_tickets & update status
    await supabase
      .from('issue_tickets')
      .update({
        status: 'actioned_task',
        task_id: createdTask.id,
        resolved_by: resolvedBy,
        resolved_at: nowIso,
        resolution_notes: `已转为系统待办任务: "${createdTask.title}" (ID: ${createdTask.id})`,
        updated_at: nowIso
      })
      .eq('id', ticketId);

    return {
      success: true,
      message: `✅ 选项 1 执行成功：已正式生成待办任务「${createdTask.title}」，已同步至【待办任务 (Tasks)】列表！`,
      task: createdTask
    };
  }

  // ── ACTION 2: Earthy Reply & 1-Click WhatsApp Dispatch ──────────────────────
  if (actionOption === 2 || actionOption === 'reply') {
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

    const note = `已发送答复话术: "${replyText.slice(0, 40)}..." ${waSent ? '(已通过 WhatsApp 自动下发提报人)' : '(已标记为已答复)'}`;

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
      message: waSent ? '✅ 已成功调用 WhatsApp 发送地道答复并标记已处理！' : '✅ 话术已确认，工单状态已更新为已答复！',
      data: { replyText, waSent }
    };
  }

  // ── ACTION 3: Close / Archive / False Alarm ─────────────────────────────────
  if (actionOption === 3 || actionOption === 'close') {
    const note = resolutionNotes || '现场误操作/已口头解决，正常归档销案。';
    await supabase
      .from('issue_tickets')
      .update({
        status: 'closed',
        resolved_by: resolvedBy,
        resolved_at: nowIso,
        resolution_notes: note,
        updated_at: nowIso
      })
      .eq('id', ticketId);

    return {
      success: true,
      message: `✅ 工单已结案归档。`
    };
  }

  throw new Error('未知的操作选项');
}
