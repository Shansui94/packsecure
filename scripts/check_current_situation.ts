import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkCurrentSituation() {
  console.log('========================================================');
  console.log('  CHECKING SITUATION FOR TODAY (2026-09-26, 14:00 MYT)   ');
  console.log('========================================================\n');

  // Start of today in MYT (2026-09-25T16:00:00Z is 2026-09-26 00:00:00 MYT)
  const mytStartOfToday = '2026-09-25T16:00:00.000Z';

  // 1. Trips today
  const { data: trips } = await supabase
    .from('trips_v2')
    .select('trip_number, driver_id, status, started_at, created_at')
    .gte('created_at', mytStartOfToday)
    .order('created_at', { ascending: false });

  const driverIds = Array.from(new Set((trips || []).map(t => t.driver_id).filter(Boolean)));
  const { data: drivers } = await supabase.from('users_public').select('id, name').in('id', driverIds);
  const driverMap = new Map((drivers || []).map(d => [d.id, d.name]));

  console.log(`[1] 今日车次情况 (共 ${trips?.length || 0} 趟):`);
  const tripStatusCount: Record<string, number> = {};
  trips?.forEach(t => {
    tripStatusCount[t.status] = (tripStatusCount[t.status] || 0) + 1;
    const dName = driverMap.get(t.driver_id) || '未知';
    const started = t.started_at ? new Date(t.started_at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' }) : '未启程';
    console.log(`  • ${t.trip_number} (${dName}): ${t.status} | 发车: ${started}`);
  });
  console.log('车次状态汇总:', tripStatusCount);
  console.log('');

  // 2. Orders today
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('order_number, customer, status, created_at, pod_timestamp')
    .gte('created_at', mytStartOfToday);

  console.log(`[2] 今日订单录入/流转 (共 ${orders?.length || 0} 票):`);
  const orderStatusCount: Record<string, number> = {};
  orders?.forEach(o => {
    orderStatusCount[o.status] = (orderStatusCount[o.status] || 0) + 1;
  });
  console.log('订单状态分布:', orderStatusCount);

  // Delivered today regardless of created_at
  const { data: deliveredToday } = await supabase
    .from('sales_orders')
    .select('order_number, customer, pod_timestamp')
    .gte('pod_timestamp', mytStartOfToday);
  console.log(`今日签收完成 (POD) 票数: ${deliveredToday?.length || 0} 票`);
  console.log('');

  // 3. Shopfloor Photos & Machine logs today
  const { data: photos } = await supabase
    .from('work_photos')
    .select('employee_name, machine_id, category, user_note, ai_description, created_at')
    .gte('created_at', mytStartOfToday)
    .order('created_at', { ascending: false });

  console.log(`[3] 车间操作与异常拍照日志 (共 ${photos?.length || 0} 条):`);
  const photoCatCount: Record<string, number> = {};
  photos?.forEach(p => {
    photoCatCount[p.category] = (photoCatCount[p.category] || 0) + 1;
  });
  console.log('照片分类统计:', photoCatCount);

  // Check if any downtime or defect today
  const downtimes = photos?.filter(p => p.category === 'downtime');
  const defects = photos?.filter(p => p.category === 'defect' || p.category === 'defect_scrap');
  const exceptions = photos?.filter(p => p.category === 'EXCEPTION');
  console.log(`  • 停机 (Downtime): ${downtimes?.length || 0} 条`);
  downtimes?.forEach(d => {
    const time = new Date(d.created_at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' });
    console.log(`    - [${time}] 机台: ${d.machine_id} | 员工: ${d.employee_name} | AI: ${d.ai_description}`);
  });
  console.log(`  • 次品/废料 (Defect): ${defects?.length || 0} 条`);
  console.log(`  • 现场报障 (Exception): ${exceptions?.length || 0} 条`);
  console.log('');

  // 4. Check status of yesterday's hanging trips (TRIP-260925-626, TRIP-260925-840)
  const { data: oldTrips } = await supabase
    .from('trips_v2')
    .select('trip_number, status, started_at')
    .in('trip_number', ['TRIP-260925-626', 'TRIP-260925-840', 'TRIP-260925-TEST']);
  console.log('[4] 昨日遗留车次当前状态:');
  console.log(oldTrips);
}

checkCurrentSituation().catch(console.error);
