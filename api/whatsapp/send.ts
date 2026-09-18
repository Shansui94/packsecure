import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyAdminCors } from '../../lib/cors.js';
import { sendWhatsAppText, sendWhatsAppTemplate } from '../../lib/whatsapp.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyAdminCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

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
