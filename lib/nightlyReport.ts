import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText, normalizePhoneNumber } from './whatsapp.js';

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

  const exceptionLines = exceptions.length > 0
    ? exceptions.map((e: any) => `  ⚠️ ${e.employee_name}: ${e.risk_reason || e.user_note}`).join('\n')
    : '  ✅ 全天无司机报障或车辆异常事故';

  // 5. Fetch Low Stock Alert from live_stock
  const { data: lowStock } = await supabase
    .from('live_stock')
    .select('item_id, quantity, factory_id')
    .lt('quantity', 50)
    .limit(5);

  const lowStockLines = (lowStock && lowStock.length > 0)
    ? lowStock.map((s: any) => `  ⚠️ ${s.item_id}: 剩余 ${s.quantity} (${s.factory_id || 'Taiping'})`).join('\n')
    : '  ✅ 原材料与成品库存充足';

  // 6. Format Executive Report Text
  const reportText = `🌙 *Packsecure OS 运营晚报 / Laporan Harian*\n` +
    `📅 日期: ${todayStr} (22:00 MYT)\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🚚 *一、 物流与派送战报 (Fleet)*\n` +
    `• 今日订单: *${totalOrders}* 票 (已送达 *${deliveredOrders}* 票, 完成率 *${deliveryRate}%*)\n` +
    `• 发车总趟数: *${totalTrips}* 趟 (已回厂 *${completedTrips}* 趟)\n` +
    `${driverDetails.length > 0 ? driverDetails.join('\n') : '  • 今日暂无发车记录'}\n\n` +
    `🛠️ *二、 现场与车辆异常 (Exceptions)*\n` +
    `${exceptionLines}\n\n` +
    `📦 *三、 仓储与物料预警 (Inventory)*\n` +
    `${lowStockLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 系统自动汇总生成于 Vercel Cron。回复【查看配方】或输入查询获取更多细节。`;

  return {
    reportText,
    summaryData: {
      totalOrders,
      deliveredOrders,
      deliveryRate,
      totalTrips,
      completedTrips,
      exceptionsCount: exceptions.length,
    }
  };
}
