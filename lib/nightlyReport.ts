import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText, normalizePhoneNumber } from './whatsapp.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

export async function generateNightlyReport(): Promise<{ reportText: string; summaryData: any }> {
  const supabase = getSupabase();
  const now = new Date();

  // Malaysia Time (MYT, UTC+8) full day window
  const mytDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(now); // YYYY-MM-DD
  const todayDisplay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }).format(now); // DD/MM/YYYY
  const mytStartIso = `${mytDateStr}T00:00:00+08:00`;

  // ── 1. REAL ORDERS BREAKDOWN (sales_orders) ───────────────────────────────────
  const { data: rawOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, status, driver_id, created_at, pod_timestamp')
    .gte('created_at', mytStartIso);

  const orders = rawOrders || [];
  const deliveredCount = orders.filter((o: any) => o.status === 'Delivered').length;
  const loadedCount = orders.filter((o: any) => o.status === 'Loaded').length;
  const plannedCount = orders.filter((o: any) => o.status === 'Planned').length;
  const cancelledOrdersCount = orders.filter((o: any) => o.status === 'Cancelled').length;

  // Real active dispatched orders for today = delivered + loaded
  const activeDispatchedOrders = deliveredCount + loadedCount;
  const realDeliveryRate = activeDispatchedOrders > 0 
    ? Math.round((deliveredCount / activeDispatchedOrders) * 100) 
    : 100;

  // ── 2. REAL TRIPS STATUS BREAKDOWN (trips_v2) ─────────────────────────────────
  const { data: rawTrips } = await supabase
    .from('trips_v2')
    .select('id, trip_number, driver_id, status, lorry_id, started_at, created_at')
    .gte('created_at', mytStartIso)
    .order('created_at', { ascending: false });

  // Filter out cancelled trips and test trips (e.g. TRIP-260925-TEST)
  const validTrips = (rawTrips || []).filter((t: any) => 
    !t.trip_number.toUpperCase().includes('TEST') && t.status !== 'Cancelled'
  );

  const completedTrips = validTrips.filter((t: any) => t.status === 'Completed');
  const inTransitTrips = validTrips.filter((t: any) => t.status === 'In Transit');
  const preparedTrips = validTrips.filter((t: any) => t.status === 'Prepared');
  const planningTrips = validTrips.filter((t: any) => t.status === 'Planning');

  // Fetch Driver Names for trips
  const driverIds = Array.from(new Set(validTrips.map((t: any) => t.driver_id).filter(Boolean)));
  const { data: drivers } = await supabase
    .from('users_public')
    .select('id, name')
    .in('id', driverIds);

  const driverMap = new Map((drivers || []).map((d: any) => [d.id, d.name]));

  // In-transit trip details (detect over 6 hours without completion)
  const inTransitLines: string[] = [];
  inTransitTrips.forEach((t: any) => {
    const dName = driverMap.get(t.driver_id) || '未指派';
    let timeNote = '';
    if (t.started_at) {
      const startTime = new Date(t.started_at);
      const startMYT = startTime.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' });
      const elapsedHours = (now.getTime() - startTime.getTime()) / (1000 * 3600);
      if (elapsedHours > 6) {
        timeNote = ` (${startMYT} 发车, ⚠️ 已在途超 ${Math.floor(elapsedHours)}h, 疑已回厂漏点完成)`;
      } else {
        timeNote = ` (${startMYT} 发车)`;
      }
    }
    inTransitLines.push(`  • ${t.trip_number} (${dName}): 🚚 派送中${timeNote}`);
  });

  const completedLines: string[] = completedTrips.map((t: any) => {
    const dName = driverMap.get(t.driver_id) || '司机';
    return `  • ${t.trip_number} (${dName}): ✅ 已回厂结案`;
  });

  // ── 3. SHOPFLOOR DEFECTS, DOWNTIME & FLEET EXCEPTIONS (work_photos) ────────────
  const { data: photos } = await supabase
    .from('work_photos')
    .select('employee_name, machine_id, category, user_note, ai_description, risk_reason, location, created_at')
    .gte('created_at', mytStartIso);

  const allPhotos = photos || [];

  // A. Shopfloor Machine Downtime
  const downtimePhotos = allPhotos.filter((p: any) => p.category === 'downtime');
  const downtimeByMachine: Record<string, { count: number; workers: Set<string>; desc: string }> = {};
  downtimePhotos.forEach((p: any) => {
    const mId = p.machine_id || '车间设备';
    if (!downtimeByMachine[mId]) {
      downtimeByMachine[mId] = { count: 0, workers: new Set(), desc: p.ai_description || p.user_note || '停机' };
    }
    downtimeByMachine[mId].count += 1;
    if (p.employee_name) downtimeByMachine[mId].workers.add(p.employee_name);
  });

  const downtimeLines = Object.entries(downtimeByMachine).map(([mId, info]) => 
    `  ⚠️ *机台停机*: [${mId}] 累计上报 *${info.count}次* 停机记录 (${Array.from(info.workers).join(', ')})`
  );

  // B. Shopfloor Defects & Scrap
  const defectPhotos = allPhotos.filter((p: any) => p.category === 'defect' || p.category === 'defect_scrap');
  const defectLines = defectPhotos.length > 0
    ? [`  ⚠️ *次品/废料*: 车间累计记录 *${defectPhotos.length}次* 称重与报废（涉及员工: ${Array.from(new Set(defectPhotos.map((p: any) => p.employee_name))).join(', ')}）`]
    : [];

  // C. Driver / Fleet Exceptions (Exclude factory downtime and defects)
  const fleetExceptions = allPhotos.filter((p: any) => 
    (p.category === 'EXCEPTION' || p.category === 'LORRY_SERVICE') || 
    (Boolean(p.risk_reason) && p.category !== 'defect' && p.category !== 'defect_scrap' && p.category !== 'downtime')
  );
  const fleetLines = fleetExceptions.length > 0
    ? fleetExceptions.map((e: any) => `  ⚠️ *车辆/现场报障*: ${e.employee_name}: ${e.risk_reason || e.user_note}`)
    : [];

  const allExceptionLines = [...downtimeLines, ...defectLines, ...fleetLines];
  const exceptionSummaryText = allExceptionLines.length > 0 
    ? allExceptionLines.join('\n')
    : '  ✅ 今日全厂机台正常运转，无车辆报障事故';

  // ── 4. LOW STOCK ALERT (live_stock) ──────────────────────────────────────────
  const { data: lowStock } = await supabase
    .from('live_stock')
    .select('item_id, quantity, factory_id')
    .lt('quantity', 50)
    .limit(5);

  const lowStockLines = (lowStock && lowStock.length > 0)
    ? lowStock.map((s: any) => `  ⚠️ ${s.item_id}: 剩余 ${s.quantity} (${s.factory_id || 'Taiping'})`).join('\n')
    : '  ✅ 原材料与成品库存充足';

  // ── 5. FORMAT EXECUTIVE NIGHTLY REPORT TEXT ──────────────────────────────────
  const reportText = `🌙 *Packsecure OS 运营晚报 / Laporan Harian*\n` +
    `📅 日期: ${todayDisplay} (22:00 MYT)\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🚚 *一、 物流派送与车次执行 (Fleet & Delivery)*\n` +
    `• 今日出货送达率: *${realDeliveryRate}%* (实际装车出库 *${activeDispatchedOrders}* 票, 已送达 *${deliveredCount}* 票, 派送中 *${loadedCount}* 票)\n` +
    `• 今日新增排单: *${plannedCount}* 票 (备货待安排)${cancelledOrdersCount > 0 ? ` • 取消: ${cancelledOrdersCount} 票` : ''}\n` +
    `• 车次总计: *${validTrips.length}* 趟 (已回厂 *${completedTrips.length}* 趟, 实际在途 *${inTransitTrips.length}* 趟, 备货待发 *${preparedTrips.length}* 趟, 排程中 *${planningTrips.length}* 趟)\n\n` +
    `📋 *当前在途与完成车次明细:*\n` +
    `${inTransitLines.length > 0 ? inTransitLines.join('\n') : '  • 当前无实际在途车次'}\n` +
    `${completedLines.length > 0 ? completedLines.join('\n') : ''}\n\n` +
    `🏭 *二、 车间机台与现场异常 (Shopfloor & Exceptions)*\n` +
    `${exceptionSummaryText}\n\n` +
    `📦 *三、 仓储与物料预警 (Inventory)*\n` +
    `${lowStockLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 系统真实数据审计引擎自动生成。回复【查看配方】或输入问题即时查阅。`;

  return {
    reportText,
    summaryData: {
      activeDispatchedOrders,
      deliveredCount,
      loadedCount,
      plannedCount,
      realDeliveryRate,
      totalValidTrips: validTrips.length,
      completedTrips: completedTrips.length,
      inTransitTrips: inTransitTrips.length,
      preparedTrips: preparedTrips.length,
      planningTrips: planningTrips.length,
      downtimeCount: downtimePhotos.length,
      defectCount: defectPhotos.length,
      fleetExceptionCount: fleetExceptions.length
    }
  };
}
