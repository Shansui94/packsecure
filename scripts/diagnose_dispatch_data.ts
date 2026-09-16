import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { buildDeliveryRateMap, calcTripEarnings } from '../src/utils/deliveryEarnings';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error('❌ Missing Supabase key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("==================================================");
    console.log("🔍 智能排单系统实机数据库（Live DB）深度体检探针");
    console.log("==================================================\n");

    // 1. 检查 Drivers 数据
    console.log("--- 1. 司机用户数据检查 (Drivers) ---");
    const { data: driversPublic, error: dpErr } = await supabase
        .from('users_public')
        .select('id, name, email, role, status, base_location')
        .eq('role', 'Driver');

    if (dpErr) {
        console.error("❌ 查询 users_public 失败:", dpErr.message);
    } else {
        console.log(`在 users_public 中找到 ${driversPublic?.length || 0} 位司机:`);
        driversPublic?.forEach(d => {
            console.log(`  - [ID: ${d.id.slice(0, 8)}...] 姓名: ${d.name || d.email} | 状态: ${d.status} | 基地: ${d.base_location || '⚠️ NULL (未分配基地)'}`);
        });
    }

    const { data: sysDrivers, error: sdErr } = await supabase
        .from('sys_users_v2')
        .select('id, auth_user_id, name, role, status')
        .eq('role', 'Driver');
    if (!sdErr) {
        console.log(`在 sys_users_v2 中找到 ${sysDrivers?.length || 0} 位司机.`);
    }

    // 2. 检查 Delivery Rates 数据
    console.log("\n--- 2. 运费费率表检查 (delivery_rates) ---");
    const { data: rates, error: rateErr } = await supabase
        .from('delivery_rates')
        .select('*');

    if (rateErr) {
        console.error("❌ 查询 delivery_rates 失败:", rateErr.message);
    } else {
        console.log(`共配置了 ${rates?.length || 0} 条运费费率记录:`);
        const origins = Array.from(new Set(rates?.map(r => (r.origin || '').toLowerCase())));
        console.log(`  - 涉及出发地 Origin:`, origins);
        console.log(`  - 样例费率（前 5 条）:`);
        rates?.slice(0, 5).forEach(r => {
            console.log(`    * [${r.origin}] -> [${r.location_name}]: Base RM ${r.base_rate}, MaxDrops: ${r.max_places}, ExtraDrop: RM ${r.extra_rate_per_place}`);
        });
    }

    // 3. 检查 Sales Orders 数据及匹配率
    console.log("\n--- 3. 出货单数据与费率匹配率检查 (sales_orders) ---");
    const { data: orders, error: oErr } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer, status, driver_id, deadline, trip_origin, zone, delivery_address, trip_drop_count')
        .order('created_at', { ascending: false })
        .limit(100);

    if (oErr) {
        console.error("❌ 查询 sales_orders 失败:", oErr.message);
    } else {
        console.log(`检查最近 ${orders?.length || 0} 条订单:`);
        const unassigned = orders?.filter(o => !o.driver_id && o.status !== 'Delivered' && o.status !== 'Cancelled') || [];
        console.log(`  - 待分配订单数 (Unassigned & Active): ${unassigned.length}`);
        console.log(`  - 样例订单数据（前 5 条）:`);
        orders?.slice(0, 5).forEach(o => {
            console.log(`    * [${o.order_number}] 客户: ${o.customer} | 区域: [${o.zone}] | 基地: [${o.trip_origin}]`);
            console.log(`      地址: "${o.delivery_address}"`);
        });
        
        const rateMap = buildDeliveryRateMap(rates || []);
        let matchedCount = 0;
        let zeroCount = 0;
        const unmatchedZones = new Set<string>();

        orders?.forEach(o => {
            const earning = calcTripEarnings({
                trip_origin: o.trip_origin,
                zone: o.zone,
                delivery_address: o.delivery_address,
                delivery_zone: o.zone,
                trip_drop_count: o.trip_drop_count || 1
            }, rateMap);

            if (earning > 0) {
                matchedCount++;
            } else {
                zeroCount++;
                if (o.zone) unmatchedZones.add(`${o.trip_origin || 'Default'} -> ${o.zone}`);
            }
        });

        console.log(`  - 运费匹配率: ${matchedCount}/${orders?.length} 匹配成功 (${((matchedCount / (orders?.length || 1)) * 100).toFixed(1)}%)`);
        if (unmatchedZones.size > 0) {
            console.log(`  - ⚠️ 以下出发地->目的地在 delivery_rates 中未匹配到规则（运费算为 0）:`, Array.from(unmatchedZones).slice(0, 8));
        }
    }

    // 4. 检查 交车日志 lorry_mileage_logs 与 考勤 operator_attendance
    console.log("\n--- 4. 交车与考勤记录检查 (lorry_mileage_logs & operator_attendance) ---");
    const { data: mileageLogs, error: mlErr } = await supabase
        .from('lorry_mileage_logs')
        .select('id, driver_id, log_type, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (mlErr) {
        console.error("❌ 查询 lorry_mileage_logs 失败:", mlErr.message);
    } else {
        const endLogs = mileageLogs?.filter(l => l.log_type === 'end') || [];
        console.log(`最近 20 条交车里程记录中，有 ${endLogs.length} 条交车解绑 (log_type='end') 记录。`);
        if (endLogs.length > 0) {
            console.log(`  - 最新交车时间: ${endLogs[0].created_at} (Driver: ${endLogs[0].driver_id})`);
        } else {
            console.log(`  - ⚠️ 近期暂无 end 交车日志，系统将通过【最后送达 POD + 返程缓冲】进行安全兜底。`);
        }
    }

    const { data: attendance, error: attErr } = await supabase
        .from('operator_attendance')
        .select('id, operator_id, date, clock_in, clock_out')
        .order('date', { ascending: false })
        .limit(20);

    if (attErr) {
        console.error("❌ 查询 operator_attendance 失败:", attErr.message);
    } else {
        const clockOuts = attendance?.filter(a => a.clock_out) || [];
        console.log(`最近 20 条考勤记录中，有 ${clockOuts.length} 条下班打卡 (clock_out) 记录。`);
    }

    console.log("\n==================================================");
    console.log("体检完成");
    console.log("==================================================");
}

checkData();
