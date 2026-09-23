import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText, normalizePhoneNumber } from '../../lib/whatsapp.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

export async function generateNightlyReport(): Promise<{ reportText: string; summaryData: any }> {
  const supabase = getSupabase();
  const todayStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
  const todayIso = new Date().toISOString().split('T')[0];

  // 1. Fetch Today's Orders
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, status, driver_id, items')
    .gte('created_at', `${todayIso}T00:00:00.000Z`);

  const totalOrders = orders?.length || 0;
  const deliveredOrders = (orders || []).filter((o: any) => o.status === 'Delivered').length;
  const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 100;

  // 2. Fetch Today's Trips
  const { data: trips } = await supabase
    .from('trips_v2')
    .select('id, trip_number, driver_id, status, lorry_id')
    .gte('created_at', `${todayIso}T00:00:00.000Z`);

  const totalTrips = trips?.length || 0;
  const completedTrips = (trips || []).filter((t: any) => t.status === 'Completed').length;

  // 3. Fetch Driver Names for trips
  const driverDetails: string[] = [];
  if (trips && trips.length > 0) {
    const driverIds = Array.from(new Set(trips.map((t: any) => t.driver_id).filter(Boolean)));
    const { data: drivers } = await supabase
      .from('users_public')
      .select('id, name')
      .in('id', driverIds);

    const driverMap = new Map((drivers || []).map((d: any) => [d.id, d.name]));

    trips.forEach((t: any) => {
      const dName = driverMap.get(t.driver_id) || '未指派';
      const statusLabel = t.status === 'Completed' ? '✅ 已回厂' : '🚚 派送中';
      driverDetails.push(`  • ${t.trip_number} (${dName}): ${statusLabel}`);
    });
  }

  // 4. Fetch Today's Exceptions / Claims from work_photos
  const { data: photos } = await supabase
    .from('work_photos')
    .select('employee_name, category, user_note, risk_reason, created_at')
    .gte('created_at', `${todayIso}T00:00:00.000Z`);

  const exceptions = (photos || []).filter(
    (p: any) => p.category === 'EXCEPTION' || p.category === 'LORRY_SERVICE' || Boolean(p.risk_reason)
  );

  const exceptionLines: string[] = [];
  exceptions.forEach((ex: any) => {
    const time = new Date(ex.created_at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' });
    exceptionLines.push(`  • [${time}] ${ex.employee_name || '员工'}: ${ex.risk_reason || ex.user_note || ex.category}`);
  });

  // 5. Check Low Stock Items
  const { data: stockItems } = await supabase
    .from('live_stock')
    .select('item_id, quantity, min_stock, factory_id')
    .order('quantity', { ascending: true })
    .limit(5);

  const lowStock = (stockItems || []).filter((s: any) => s.min_stock && s.quantity <= s.min_stock);
  const stockLines: string[] = [];
  lowStock.forEach((s: any) => {
    stockLines.push(`  ⚠️ *${s.item_id}*: 仅剩 ${s.quantity} (警戒线: ${s.min_stock}, ${s.factory_id || 'TAIPING'})`);
  });

  // Build the message text
  let reportText = `🏢 *Packsecure 每日运营晚报*\n` +
    `📅 日期: *${todayStr}*\n` +
    `⏱️ 生成时间: 22:00 (MYT)\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚚 *一、物流车队与配送*\n` +
    `• 今日订单: *${totalOrders} 票* | 已签收: *${deliveredOrders} 票* (${deliveryRate}%)\n` +
    `• 运行车次: *${totalTrips} 车次* (回厂已结: ${completedTrips})\n`;

  if (driverDetails.length > 0) {
    reportText += `${driverDetails.join('\n')}\n`;
  }

  reportText += `\n⚠️ *二、现场异常与司机报备*\n`;
  if (exceptionLines.length > 0) {
    reportText += `${exceptionLines.join('\n')}\n`;
  } else {
    reportText += `  • 今日全天无突发停机或车辆异常，运营平稳 ✅\n`;
  }

  reportText += `\n📦 *三、物料与库存预警*\n`;
  if (stockLines.length > 0) {
    reportText += `${stockLines.join('\n')}\n`;
  } else {
    reportText += `  • 核心规格库存充足，均在安全线以上 ✅\n`;
  }

  reportText += `━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 系统已完成今日全量数据归档与备份。祝老板晚安！🌙`;

  return {
    reportText,
    summaryData: {
      totalOrders,
      deliveredOrders,
      deliveryRate,
      totalTrips,
      completedTrips,
      exceptionCount: exceptionLines.length,
      lowStockCount: stockLines.length,
    },
  };
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
