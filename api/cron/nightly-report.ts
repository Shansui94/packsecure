import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText, normalizePhoneNumber } from '../../lib/whatsapp.js';
import { generateNightlyReport } from '../../lib/nightlyReport.js';

export { generateNightlyReport };

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    const { reportText, summaryData } = await generateNightlyReport();

    // Find all SuperAdmins who have a bound phone number
    const { data: superAdmins, error: adminErr } = await supabase
      .from('users_public')
      .select('id, name, phone, email, role')
      .eq('role', 'SuperAdmin')
      .not('phone', 'is', null);

    if (adminErr) {
      console.error('[Nightly Report] SuperAdmin lookup error:', adminErr);
    }

    const recipients = (superAdmins || [])
      .map((a: any) => a.phone)
      .filter((p: string) => Boolean(p && p.trim()));

    // Fallback: Always ensure Max Tan's phone is included if present
    if (recipients.length === 0) {
      recipients.push('60102328335');
    }

    const uniquePhones = Array.from(new Set(recipients.map((p: string) => normalizePhoneNumber(p))));
    const results = [];

    for (const phone of uniquePhones) {
      try {
        const sendRes = await sendWhatsAppText(phone, reportText);
        results.push({ phone, success: true, result: sendRes });
      } catch (sendErr: any) {
        console.error(`[Nightly Report] Failed to send to ${phone}:`, sendErr.message);
        results.push({ phone, success: false, error: sendErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      deliveredTo: uniquePhones,
      results,
      summary: summaryData,
      reportPreview: reportText,
    });
  } catch (err: any) {
    console.error('[Nightly Report Handler Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || '生成或推送晚报失败',
    });
  }
}
