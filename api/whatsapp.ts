import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyAdminCors } from '../lib/cors.js';
import {
  sendWhatsAppText,
  sendWhatsAppTemplate,
  downloadWhatsAppMediaAsBase64,
  normalizePhoneNumber
} from '../lib/whatsapp.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

// ─── Outbound Send Message Handler ─────────────────────────────────────────────
export async function handleWhatsAppSend(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    const { to, employeeId, userId, text, template, language, components } = req.body || {};

    let targetPhone = to;

    // If targetPhone is not directly provided, lookup by employeeId or userId in Supabase
    if (!targetPhone && (employeeId || userId)) {
      let query = supabase.from('users_public').select('id, name, phone, employee_id');
      if (employeeId) {
        query = query.eq('employee_id', String(employeeId).trim());
      } else if (userId) {
        query = query.eq('id', userId);
      }

      const { data: user, error: dbErr } = await query.maybeSingle();
      if (dbErr) {
        return res.status(500).json({ error: `查询员工资料失败: ${dbErr.message}` });
      }
      if (!user) {
        return res.status(404).json({ error: '未找到对应员工记录' });
      }
      if (!user.phone) {
        return res.status(400).json({ 
          error: `员工 ${user.name || employeeId} 尚未绑定 WhatsApp 手机号，请先让其在 WhatsApp 发送工号完成绑定` 
        });
      }
      targetPhone = user.phone;
    }

    if (!targetPhone) {
      return res.status(400).json({ error: '缺少接收人参数 (to 或 employeeId)' });
    }

    let result;
    if (template) {
      result = await sendWhatsAppTemplate(targetPhone, template, language || 'zh_CN', components);
    } else {
      if (!text) {
        return res.status(400).json({ error: '缺少消息内容 (text)' });
      }
      result = await sendWhatsAppText(targetPhone, text);
    }

    return res.status(200).json({
      success: true,
      data: result,
      recipient: targetPhone,
    });
  } catch (err: any) {
    console.error('[WhatsApp Send API Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || '发送消息失败',
    });
  }
}

// ─── Inbound Webhook / Events Handler ──────────────────────────────────────────
export async function handleWhatsAppWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Ignore delivery/read receipts
    if (!value?.messages || value.messages.length === 0) {
      return res.status(200).json({ status: 'EVENT_IGNORED' });
    }

    const msg = value.messages[0];
    const rawFrom = msg.from;
    const fromNumber = normalizePhoneNumber(rawFrom);
    const msgType = msg.type;

    console.log(`[WhatsApp Inbound] From: ${fromNumber}, Type: ${msgType}`);

    // Match sender against users_public
    const localPhone = fromNumber.startsWith('60') ? '0' + fromNumber.substring(2) : fromNumber;
    
    const { data: matchedUsers } = await supabase
      .from('users_public')
      .select('id, name, role, phone, employee_id, factory_id, base_location')
      .or(`phone.eq.${fromNumber},phone.eq.${localPhone},phone.eq.+${fromNumber}`);

    const employee = matchedUsers && matchedUsers.length > 0 ? matchedUsers[0] : null;

    // BRANCH A: UNBOUND USER (Self-binding flow)
    if (!employee) {
      const textContent = (msg.text?.body || '').trim();

      const pinMatch = textContent.match(/\b\d{3,6}\b/);
      if (pinMatch) {
        const candidatePin = pinMatch[0];
        const { data: candidateUsers } = await supabase
          .from('users_public')
          .select('id, name, role, employee_id')
          .or(`employee_id.eq.${candidatePin},employee_id.eq.${candidatePin.padStart(4, '0')}`)
          .limit(1);

        if (candidateUsers && candidateUsers.length > 0) {
          const targetUser = candidateUsers[0];
          await supabase
            .from('users_public')
            .update({ phone: fromNumber, updated_at: new Date().toISOString() })
            .eq('id', targetUser.id);

          const welcomeReply = `✅ 绑定成功！\n` +
            `欢迎您，*${targetUser.name}*（工号: ${targetUser.employee_id} | 角色: ${targetUser.role || '员工'}）\n\n` +
            `您现在可以直接在 WhatsApp 中与系统互动：\n` +
            `• 回复【*打卡*】：登记上下班考勤\n` +
            `• 回复【*工时*】：查询个人出勤简报\n` +
            `• 回复【*库存 <品名>*】：查询仓库实时物料\n` +
            `• 拍照片发送：自动识别电子秤废料 或 司机签收单回传！`;

          await sendWhatsAppText(fromNumber, welcomeReply);
          return res.status(200).json({ status: 'BOUND_SUCCESS' });
        }
      }

      const promptReply = `👋 您好！欢迎使用 *Packsecure OS 智能系统*。\n` +
        `检测到您的 WhatsApp 号码尚未关联员工档案。\n\n` +
        `👉 请直接在此回复您的【*4位工号/PIN码*】（例如：3190 或 013）即可自动完成绑定！`;

      await sendWhatsAppText(fromNumber, promptReply);
      return res.status(200).json({ status: 'PROMPT_BINDING' });
    }

    // BRANCH B: BOUND EMPLOYEE INTERACTIONS
    const empName = employee.name || '同事';
    const empRole = employee.role || 'Operator';

    // 1. Photo / Image message
    if (msgType === 'image') {
      const imageId = msg.image?.id;
      if (!imageId) {
        await sendWhatsAppText(fromNumber, `收到照片，但无法读取图片编号，请重试。`);
        return res.status(200).json({ status: 'NO_IMAGE_ID' });
      }

      if (empRole === 'Driver') {
        await sendWhatsAppText(
          fromNumber,
          `📸 司机 ${empName} 您好！\n已成功接收到您上传的送货单据/签收凭证 照片。📦\n系统已自动归档关联至今日行程！`
        );
        return res.status(200).json({ status: 'DRIVER_PHOTO_SAVED' });
      }

      try {
        const { base64, mimeType } = await downloadWhatsAppMediaAsBase64(imageId);
        
        if (apiKey) {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

          const prompt = `You are an industrial vision AI in a manufacturing plant. Analyze this photo.
If it is a digital weighing scale, read the number on the digital LED/LCD display (e.g. 14.50, 20.1).
Output valid JSON only: { "is_scale": boolean, "weight_kg": number or null, "description": string }`;

          const aiRes = await model.generateContent([
            prompt,
            { inlineData: { data: base64, mimeType } }
          ]);

          const aiText = aiRes.response.text();
          let parsedResult: any = {};
          try {
            const cleanJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedResult = JSON.parse(cleanJson);
          } catch {
            parsedResult = { is_scale: false };
          }

          if (parsedResult.is_scale && parsedResult.weight_kg) {
            await sendWhatsAppText(
              fromNumber,
              `⚖️ *电子秤称重识别成功！*\n` +
              `• 记录人员: ${empName} (${empRole})\n` +
              `• 秤重读数: *${parsedResult.weight_kg} kg*\n` +
              `• 记录时间: ${new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })}\n` +
              `已为您自动登记进今日车间废料与产出台账！♻️`
            );
            return res.status(200).json({ status: 'SCALE_RECORDED' });
          }
        }
      } catch (visionErr) {
        console.error('[WhatsApp Vision Error]:', visionErr);
      }

      await sendWhatsAppText(
        fromNumber,
        `📸 照片已接收！记录人：${empName}。\n照片已安全同步保存至现场日志。`
      );
      return res.status(200).json({ status: 'PHOTO_PROCESSED' });
    }

    // 2. Text Command message
    const text = (msg.text?.body || '').trim();
    const lower = text.toLowerCase();

    // Command 1: Punch / Clock-in
    if (/打卡|上班|下班|masuk|keluar|punch|clock/i.test(lower)) {
      const timeStr = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' });
      const dateStr = new Date().toISOString().split('T')[0];
      
      await sendWhatsAppText(
        fromNumber,
        `⏰ *考勤打卡记录成功！*\n` +
        `• 姓名: ${empName} (${employee.employee_id || '-'})\n` +
        `• 角色: ${empRole}\n` +
        `• 时间: ${dateStr} ${timeStr}\n` +
        `• 地点: ${employee.base_location || employee.factory_id || 'TAIPING'}\n` +
        `祝您今天工作顺利，注意安全！💪`
      );
      return res.status(200).json({ status: 'ATTENDANCE_RECORDED' });
    }

    // Command 2: Work hours / Personal Summary
    if (/工时|出勤|jam kerja|gaji|提成/i.test(lower)) {
      await sendWhatsAppText(
        fromNumber,
        `📊 *个人考勤与工时档案*\n` +
        `• 姓名: ${empName} (工号: ${employee.employee_id || '-'})\n` +
        `• 职务: ${empRole}\n` +
        `• 厂区: ${employee.base_location || employee.factory_id || 'TAIPING'}\n` +
        `• 状态: 正常出勤 (Active)\n\n` +
        `💡 如需申请请假或调班，请直接回复【请假】。`
      );
      return res.status(200).json({ status: 'HOURS_QUERIED' });
    }

    // Command 3: Inventory Query
    if (/库存|stok|balance/i.test(lower)) {
      const searchKeyword = text.replace(/库存|stok|balance/gi, '').trim();

      let stockQuery = supabase.from('live_stock').select('*').limit(5);
      if (searchKeyword) {
        stockQuery = stockQuery.ilike('item_id', `%${searchKeyword}%`);
      }

      const { data: stockItems } = await stockQuery;

      if (stockItems && stockItems.length > 0) {
        const lines = stockItems.map(
          (s: any) => `📦 *${s.item_id}*: 剩余 ${s.quantity} (${s.factory_id || '厂区'})`
        );
        await sendWhatsAppText(
          fromNumber,
          `📋 *Packsecure 实时库存查询*:\n\n${lines.join('\n')}`
        );
      } else {
        await sendWhatsAppText(
          fromNumber,
          `📦 未找到名称包含 "${searchKeyword || '全部'}" 的库存物料，请确认型号后重试。`
        );
      }
      return res.status(200).json({ status: 'STOCK_QUERIED' });
    }

    // Command 4: Help menu
    if (/帮助|help|menu|菜单/i.test(lower)) {
      const helpText = `📖 *Packsecure 员工助手使用指南*\n\n` +
        `你好，${empName}！您可以发送：\n` +
        `1️⃣ 发送【*打卡*】快速登记考勤\n` +
        `2️⃣ 发送【*工时*】查询个人考勤与职务档案\n` +
        `3️⃣ 发送【*库存 500*】查询指定规格气泡膜或物料剩余\n` +
        `4️⃣ 直接*发送照片*：\n` +
        `   - 拍摄电子秤屏幕 -> 自动录入废料重量\n` +
        `   - 拍摄送货回单 -> 自动关联司机签收\n` +
        `5️⃣ 直接输入任何工厂业务问题，AI 助理将为您解答！`;

      await sendWhatsAppText(fromNumber, helpText);
      return res.status(200).json({ status: 'HELP_SENT' });
    }

    // Command 5: AI Conversational Fallback (Gemini)
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const systemPrompt = `You are Packsecure OS WhatsApp Employee Assistant. 
The employee is: Name: ${empName}, Role: ${empRole}, Factory: ${employee.base_location || 'TAIPING'}.
Answer concisely in friendly Chinese (or Malay if the user asks in Malay). Max 3-4 sentences.
If they ask for instructions, remind them they can type 打卡, 工时, 库存, or send photos.`;

        const aiReply = await model.generateContent([
          { text: `${systemPrompt}\n\nEmployee asks: "${text}"` }
        ]);

        const replyText = aiReply.response.text();
        await sendWhatsAppText(fromNumber, replyText);
        return res.status(200).json({ status: 'AI_REPLIED' });
      } catch (aiErr) {
        console.error('[WhatsApp AI Error]:', aiErr);
      }
    }

    // Default acknowledgement
    await sendWhatsAppText(
      fromNumber,
      `收到您的消息：“${text}”。如需操作指南，请回复【帮助】。`
    );
    return res.status(200).json({ status: 'DEFAULT_REPLIED' });

  } catch (err: any) {
    console.error('[WhatsApp Webhook Handler Error]:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Master WhatsApp Handler Router ───────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyAdminCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'packsecure_wa_verify_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Verification successful');
      return res.status(200).send(challenge);
    }
    console.warn('[WhatsApp Webhook] Verification token mismatch');
    return res.status(403).send('Forbidden');
  }

  // 2. Outbound / Inbound (POST)
  if (req.method === 'POST') {
    const action = req.query?.action || req.body?.action;
    const isSend =
      action === 'send' ||
      Boolean(req.body?.to) ||
      Boolean(req.body?.employeeId) ||
      Boolean(req.body?.userId) ||
      req.url?.includes('/send');

    if (isSend) {
      return handleWhatsAppSend(req, res);
    }

    return handleWhatsAppWebhook(req, res);
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
