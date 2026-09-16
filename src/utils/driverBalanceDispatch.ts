import { DraftTrip, extractTownFromAddress } from './autoRouting';
import { calcTripEarnings, buildDeliveryRateMap, DeliveryRateRow } from './deliveryEarnings';
import { determineState } from './logistics';

export interface DispatchRuleConfig {
    minRestHours: number;           // 最小强制休息时间，默认 10 小时
    shortTripMaxRate: number;       // 短途基础运费界限（RM），默认 250
    maxShortTripsPerDay: number;    // 短途每日最大趟数，默认 2 趟
    maxDailyWorkHours: number;      // 每日最大驾驶/在岗工时，默认 10 小时
    returnBufferHoursLocal: number; // 本地未打卡返程缓冲，默认 1 小时
    returnBufferHoursLong: number;  // 外州未打卡返程缓冲，默认 3.5 小时
}

export const DEFAULT_DISPATCH_RULES: DispatchRuleConfig = {
    minRestHours: 10,
    shortTripMaxRate: 250,
    maxShortTripsPerDay: 2,
    maxDailyWorkHours: 10,
    returnBufferHoursLocal: 1,
    returnBufferHoursLong: 3.5
};

export const DISPATCH_RULES_STORAGE_KEY = 'packsecure_dispatch_rule_config';

export function loadDispatchRules(): DispatchRuleConfig {
    try {
        const raw = localStorage.getItem(DISPATCH_RULES_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_DISPATCH_RULES };
        const parsed = JSON.parse(raw);
        return {
            minRestHours: Number(parsed.minRestHours) > 0 ? Number(parsed.minRestHours) : DEFAULT_DISPATCH_RULES.minRestHours,
            shortTripMaxRate: Number(parsed.shortTripMaxRate) > 0 ? Number(parsed.shortTripMaxRate) : DEFAULT_DISPATCH_RULES.shortTripMaxRate,
            maxShortTripsPerDay: Number(parsed.maxShortTripsPerDay) > 0 ? Number(parsed.maxShortTripsPerDay) : DEFAULT_DISPATCH_RULES.maxShortTripsPerDay,
            maxDailyWorkHours: Number(parsed.maxDailyWorkHours) > 0 ? Number(parsed.maxDailyWorkHours) : DEFAULT_DISPATCH_RULES.maxDailyWorkHours,
            returnBufferHoursLocal: Number(parsed.returnBufferHoursLocal) >= 0 ? Number(parsed.returnBufferHoursLocal) : DEFAULT_DISPATCH_RULES.returnBufferHoursLocal,
            returnBufferHoursLong: Number(parsed.returnBufferHoursLong) >= 0 ? Number(parsed.returnBufferHoursLong) : DEFAULT_DISPATCH_RULES.returnBufferHoursLong,
        };
    } catch {
        return { ...DEFAULT_DISPATCH_RULES };
    }
}

export function saveDispatchRules(rules: DispatchRuleConfig): void {
    try {
        localStorage.setItem(DISPATCH_RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch (e) {
        console.error('Failed to save dispatch rules', e);
    }
}

export function resetDispatchRules(): DispatchRuleConfig {
    saveDispatchRules(DEFAULT_DISPATCH_RULES);
    return { ...DEFAULT_DISPATCH_RULES };
}

export interface DriverStats {
    driverId: string;
    driverName: string;
    baseLocation: string;
    lorryPlate?: string;
    currentMtdEarnings: number;       // 本月累计运费（RM）
    projectedEarnings: number;        // 分配后预计运费（RM）
    completedTripsCount: number;      // 本月已完成车次数
    assignedNewTripsCount: number;    // 本次分配的新车次数
    lastWorkEndTime: Date | null;     // 最近一次工作结束时间
    restHoursFromLastWork: number;    // 距离上次下班已休息小时数
    restStatusText: string;           // 休息状态文字
    isRestSufficient: boolean;        // 是否达标（>= minRestHours）
    hasFatigueRisk: boolean;          // 是否有疲劳风险
    dailyTripCountOnTargetDate: number; // 目标发车日已有趟数
    dailyEstimatedHoursOnTargetDate: number; // 目标发车日累计工时
}

export interface BalancedTripDraft extends DraftTrip {
    estimatedEarnings: number;        // 该车次预估运费 (RM)
    isShortTrip: boolean;             // 是否短途
    targetDate: string;               // 发车/送达日期 YYYY-MM-DD
    recommendationReason: string;     // 推荐理由
    recommendationBadgeColor: 'emerald' | 'blue' | 'amber' | 'purple' | 'red';
    hasFatigueWarning: boolean;       // 是否有疲劳警示
    fatigueWarningDetail?: string;    // 疲劳警示细节
    destinationsSummary: string;      // 目的地汇总
    originWarehouse: string;          // 出发地
    dropCount: number;                // drop 数量
}

export interface DispatchResult {
    trips: BalancedTripDraft[];
    driverStatsMap: Record<string, DriverStats>;
    unassignedTripsCount: number;
    rules: DispatchRuleConfig;
    groupAverageEarnings: number;
}

/**
 * 判断指定车次是否属于短途（同省/邻近或者基础运费 <= 阈值）
 */
export function isShortDistanceTrip(
    origin: string,
    zoneOrAddress: string,
    baseRate: number,
    thresholdRate: number = 250
): boolean {
    if (baseRate > 0 && baseRate <= thresholdRate) {
        return true;
    }
    const o = (origin || '').toLowerCase();
    const destState = determineState(zoneOrAddress).toLowerCase();

    // Taiping / SPD 发往 Perak, Penang, Kedah 视为本地/邻近短途
    if ((o.includes('taiping') || o.includes('spd') || o === 't1') &&
        (destState.includes('perak') || destState.includes('penang') || destState.includes('kedah'))) {
        return true;
    }
    // Nilai 发往 Selangor, KL, N.Sembilan, Melaka 视为本地短途
    if ((o.includes('nilai') || o === 'n1') &&
        (destState.includes('selangor') || destState.includes('k. lumpur') || destState.includes('n. sembilan') || destState.includes('melaka'))) {
        return true;
    }
    return false;
}

/**
 * 计算司机的最后一次工作结束时间
 * 优先级：
 * 1. 司机交车解绑日志 (lorry_mileage_logs, log_type='end')
 * 2. 考勤打卡下班时间 (operator_attendance, clock_out)
 * 3. 兜底：最后送达 POD 时间 + 返程路程缓冲时间 (本地/外州)
 */
export function calcDriverLastWorkEndTime(
    driverId: string,
    shiftLogs: any[],
    attendanceLogs: any[],
    recentDeliveredOrders: any[],
    rules: DispatchRuleConfig,
    refDate: Date = new Date()
): { workEndTime: Date | null; source: 'shift_log' | 'clock_out' | 'pod_fallback' | 'none' } {
    let latestTime: Date | null = null;
    let source: 'shift_log' | 'clock_out' | 'pod_fallback' | 'none' = 'none';

    // 1. 查找交车日志 (log_type === 'end')
    const endLogs = (shiftLogs || [])
        .filter(l => (l.driver_id === driverId || l.user_id === driverId) && (l.log_type === 'end' || l.type === 'end') && l.created_at)
        .map(l => new Date(l.created_at))
        .filter(d => !isNaN(d.getTime()) && d <= refDate);

    if (endLogs.length > 0) {
        endLogs.sort((a, b) => b.getTime() - a.getTime());
        latestTime = endLogs[0];
        source = 'shift_log';
    }

    // 2. 查找考勤下班时间 (clock_out)
    const clockOuts = (attendanceLogs || [])
        .filter(a => (a.user_id === driverId || a.employee_id === driverId) && a.clock_out)
        .map(a => new Date(a.clock_out))
        .filter(d => !isNaN(d.getTime()) && d <= refDate);

    if (clockOuts.length > 0) {
        clockOuts.sort((a, b) => b.getTime() - a.getTime());
        if (!latestTime || clockOuts[0] > latestTime) {
            latestTime = clockOuts[0];
            source = 'clock_out';
        }
    }

    // 3. 兜底：最近送达订单 POD 时间 + 返程缓冲
    if (!latestTime) {
        const driverOrders = (recentDeliveredOrders || [])
            .filter(o => o.driver_id === driverId || o.driverId === driverId)
            .filter(o => o.pod_timestamp || o.deadline || o.created_at);

        if (driverOrders.length > 0) {
            const parsedDates = driverOrders.map(o => {
                const podTs = o.pod_timestamp ? new Date(o.pod_timestamp) : null;
                const dateCandidate = podTs && !isNaN(podTs.getTime()) ? podTs : new Date(o.deadline || o.created_at);
                if (isNaN(dateCandidate.getTime())) return null;

                const dest = o.delivery_address || o.deliveryAddress || o.zone || '';
                const origin = o.trip_origin || o.tripOrigin || 'TAIPING';
                const isShort = isShortDistanceTrip(origin, dest, 0, rules.shortTripMaxRate);
                const bufferHours = isShort ? rules.returnBufferHoursLocal : rules.returnBufferHoursLong;

                const estimatedBack = new Date(dateCandidate.getTime() + bufferHours * 3600 * 1000);
                return estimatedBack <= refDate ? estimatedBack : refDate;
            }).filter(Boolean) as Date[];

            if (parsedDates.length > 0) {
                parsedDates.sort((a, b) => b.getTime() - a.getTime());
                latestTime = parsedDates[0];
                source = 'pod_fallback';
            }
        }
    }

    return { workEndTime: latestTime, source };
}

/**
 * 校验司机在目标发车日是否满足休息要求与趟次上限
 */
export function checkDriverRestEligibility(
    driverId: string,
    targetDateStr: string,
    isShortTrip: boolean,
    lastWorkEndTime: Date | null,
    existingTripsOnTargetDate: { isShort: boolean }[],
    leaves: any[],
    rules: DispatchRuleConfig,
    now: Date = new Date()
): { eligible: boolean; restHours: number; reason: string; hasFatigueWarning: boolean } {
    // 1. 检查是否有请假记录 (Approved leave)
    const isOnLeave = (leaves || []).some(l => {
        const empMatch = l.employee_id === driverId || l.user_id === driverId;
        const statusMatch = (l.status || '').toLowerCase() === 'approved';
        if (!empMatch || !statusMatch) return false;
        const start = (l.start_date || '').split('T')[0];
        const end = (l.end_date || '').split('T')[0];
        return targetDateStr >= start && targetDateStr <= end;
    });

    if (isOnLeave) {
        return {
            eligible: false,
            restHours: 0,
            reason: '该司机在此日期已请假审批通过 (On Leave)',
            hasFatigueWarning: false
        };
    }

    // 2. 检查当天已有趟数与工时
    const longTripCount = existingTripsOnTargetDate.filter(t => !t.isShort).length;
    const shortTripCount = existingTripsOnTargetDate.filter(t => t.isShort).length;

    if (!isShortTrip) {
        // 当前为长途车次
        if (longTripCount >= 1) {
            return {
                eligible: false,
                restHours: 0,
                reason: '外州长途单日严格限制最多 1 趟，该司机当天已排长途',
                hasFatigueWarning: true
            };
        }
        if (shortTripCount >= 1) {
            return {
                eligible: false,
                restHours: 0,
                reason: '该司机当天已有短途配送，不建议同日再接外州长途',
                hasFatigueWarning: true
            };
        }
    } else {
        // 当前为短途车次
        if (longTripCount >= 1) {
            return {
                eligible: false,
                restHours: 0,
                reason: '该司机当天已有长途出车任务，无法再安排短途',
                hasFatigueWarning: true
            };
        }
        if (shortTripCount >= rules.maxShortTripsPerDay) {
            return {
                eligible: false,
                restHours: 0,
                reason: `短途单日最多允许 ${rules.maxShortTripsPerDay} 趟，已达到单日上限`,
                hasFatigueWarning: true
            };
        }
        const estimatedWorkHours = (shortTripCount * 3.5) + 3.5;
        if (estimatedWorkHours > rules.maxDailyWorkHours) {
            return {
                eligible: false,
                restHours: 0,
                reason: `安排此趟后单日累计工时约 ${estimatedWorkHours}h，超出日上限 ${rules.maxDailyWorkHours}h`,
                hasFatigueWarning: true
            };
        }
    }

    // 3. 检查距上次工作结束的大休息时间 (10 小时限制)
    if (!lastWorkEndTime) {
        // 过去 7 天无工作记录，视为状态良好已充分休息
        return {
            eligible: true,
            restHours: 99,
            reason: '近期待命充足，无疲劳风险',
            hasFatigueWarning: false
        };
    }

    // 计算预计发车时间点：
    // 若 targetDate 是今天，则以当前时间点或今日清晨起算
    // 若 targetDate 是未来日期（如明天），假设上午 08:00 发车
    const targetDeparture = new Date(`${targetDateStr}T08:00:00+08:00`);
    const departureTime = targetDeparture > now ? targetDeparture : now;

    const restDiffMs = departureTime.getTime() - lastWorkEndTime.getTime();
    const restHours = Math.max(0, restDiffMs / (3600 * 1000));

    // 如果是今天已经跑完第一趟短途，正在准备接第二趟短途：
    // 短途之间的周转不要求 10h 大休息，只需间隔至少 45 分钟
    if (isShortTrip && shortTripCount > 0) {
        if (restHours < 0.75) {
            return {
                eligible: false,
                restHours,
                reason: `距上一趟回厂仅 ${(restHours * 60).toFixed(0)} 分钟，需留出基本周转与装车时间`,
                hasFatigueWarning: true
            };
        }
        return {
            eligible: true,
            restHours,
            reason: `短途第 ${shortTripCount + 1} 趟，工时在安全范围内`,
            hasFatigueWarning: false
        };
    }

    // 跨班次/大出车的大休息检查
    if (restHours < rules.minRestHours) {
        return {
            eligible: false,
            restHours,
            reason: `连续休息不足！下班至今仅休 ${restHours.toFixed(1)}h（规定需满 ${rules.minRestHours}h）`,
            hasFatigueWarning: true
        };
    }

    return {
        eligible: true,
        restHours,
        reason: `已连续休息 ${restHours.toFixed(1)}h（达标）`,
        hasFatigueWarning: false
    };
}

/**
 * 智能分配司机核心引擎
 * 结合：同厂区运力、本月已产生累计运费、工作结束与10h休息校验、单日长短途控制、贪心收益拉平
 */
export function generateBalancedDriverAssignments(
    trips: DraftTrip[],
    drivers: any[],
    allMonthlyOrders: any[],
    deliveryRates: DeliveryRateRow[],
    shiftLogs: any[],
    attendanceLogs: any[],
    leaveRecords: any[],
    activeWarehouse: string,
    customRules?: DispatchRuleConfig
): DispatchResult {
    const rules = customRules || loadDispatchRules();
    const rateMap = buildDeliveryRateMap(deliveryRates || []);

    // 1. 过滤当前仓库活跃司机
    const warehouseDrivers = (drivers || []).filter(d => {
        const loc = (d.base_location || 'Taiping').toLowerCase();
        return loc === activeWarehouse.toLowerCase();
    });

    // 2. 初始化司机月累计收益与状态
    const driverStatsMap: Record<string, DriverStats> = {};
    const driverDailyTrips: Record<string, Record<string, { isShort: boolean }[]>> = {};

    warehouseDrivers.forEach(d => {
        const dId = d.uid || d.id;
        const dName = d.name || d.email?.split('@')[0] || 'Driver';

        // 计算当月已由该司机送达或已指派的运费 (RM)
        let mtd = 0;
        let compCount = 0;

        (allMonthlyOrders || []).forEach(ord => {
            if (ord.driver_id === dId || ord.driverId === dId) {
                const earning = calcTripEarnings({
                    trip_origin: ord.trip_origin || ord.tripOrigin || activeWarehouse,
                    zone: ord.zone,
                    delivery_address: ord.delivery_address || ord.deliveryAddress,
                    delivery_zone: ord.delivery_zone,
                    trip_drop_count: ord.trip_drop_count || ord.tripDropCount || 1
                }, rateMap);
                mtd += earning;
                if (ord.status === 'Delivered') {
                    compCount += 1;
                }
            }
        });

        const { workEndTime } = calcDriverLastWorkEndTime(
            dId,
            shiftLogs || [],
            attendanceLogs || [],
            allMonthlyOrders || [],
            rules
        );

        const now = new Date();
        const restHrs = workEndTime ? Math.max(0, (now.getTime() - workEndTime.getTime()) / (3600 * 1000)) : 99;

        driverStatsMap[dId] = {
            driverId: dId,
            driverName: dName,
            baseLocation: d.base_location || activeWarehouse,
            currentMtdEarnings: mtd,
            projectedEarnings: mtd,
            completedTripsCount: compCount,
            assignedNewTripsCount: 0,
            lastWorkEndTime: workEndTime,
            restHoursFromLastWork: restHrs,
            restStatusText: restHrs >= 90 ? '近期未出车（已充分休息）' : `已休息 ${restHrs.toFixed(1)} 小时`,
            isRestSufficient: restHrs >= rules.minRestHours,
            hasFatigueRisk: restHrs < rules.minRestHours,
            dailyTripCountOnTargetDate: 0,
            dailyEstimatedHoursOnTargetDate: 0
        };

        driverDailyTrips[dId] = {};
    });

    // 3. 预先计算每趟车次的金额、短途属性与日期
    const nowStr = new Date().toISOString().split('T')[0];
    const enrichedTrips: BalancedTripDraft[] = trips.map(t => {
        const firstOrder = t.orders?.[0] || {};
        const targetDate = (firstOrder.deadline || firstOrder.deliveryDate || nowStr).split('T')[0];
        const origin = t.factoryId || firstOrder.trip_origin || activeWarehouse;
        const zone = t.zone || firstOrder.zone || 'Other';
        const destAddr = firstOrder.deliveryAddress || firstOrder.delivery_address || zone;
        const dropCount = t.orders?.reduce((acc, o) => acc + (o.trip_drop_count || 1), 0) || t.orders?.length || 1;

        const estEarning = calcTripEarnings({
            trip_origin: origin,
            zone,
            delivery_address: destAddr,
            delivery_zone: zone,
            trip_drop_count: dropCount
        }, rateMap);

        const isShort = isShortDistanceTrip(origin, destAddr, estEarning, rules.shortTripMaxRate);

        const townCounts: Record<string, number> = {};
        (t.orders || []).forEach(o => {
            const raw = o.deliveryAddress || o.delivery_address || '';
            const town = extractTownFromAddress(raw) || o.zone || 'Other';
            townCounts[town] = (townCounts[town] || 0) + (o.trip_drop_count || 1);
        });
        const destSummary = Object.keys(townCounts).length > 0
            ? Object.entries(townCounts).map(([tName, cnt]) => `${tName} (${cnt}点)`).join(', ')
            : zone;

        return {
            ...t,
            estimatedEarnings: estEarning,
            isShortTrip: isShort,
            targetDate,
            destinationsSummary: destSummary,
            originWarehouse: origin,
            dropCount,
            recommendationReason: '',
            recommendationBadgeColor: 'blue',
            hasFatigueWarning: false
        };
    });

    // 4. 车次排序：高单价/长途车次优先分配（以便率先把长途大单分配给收益最落后的司机，达到更快的收敛平衡）
    enrichedTrips.sort((a, b) => b.estimatedEarnings - a.estimatedEarnings);

    // 计算当前全厂平均累计运费
    const driverList = Object.values(driverStatsMap);
    const avgEarnings = driverList.length > 0
        ? driverList.reduce((acc, d) => acc + d.currentMtdEarnings, 0) / driverList.length
        : 0;

    let unassignedCount = 0;

    // 5. 贪心注水算法依次匹配司机
    enrichedTrips.forEach(trip => {
        const targetDate = trip.targetDate;

        // 收集所有候选司机并评估休息与工时资格
        const candidates = warehouseDrivers.map(d => {
            const dId = d.uid || d.id;
            const stats = driverStatsMap[dId];
            const existingTrips = driverDailyTrips[dId]?.[targetDate] || [];

            const eligibility = checkDriverRestEligibility(
                dId,
                targetDate,
                trip.isShortTrip,
                stats.lastWorkEndTime,
                existingTrips,
                leaveRecords || [],
                rules
            );

            return {
                driverId: dId,
                stats,
                eligibility
            };
        });

        // 优先在完全合规（休息达标且未超限）的司机中选择
        const fullyEligible = candidates.filter(c => c.eligibility.eligible);

        let chosenCandidate: (typeof candidates)[0] | null = null;
        let isCompromise = false;

        if (fullyEligible.length > 0) {
            // 核心平衡策略：优先选分配后【预估本月总运费最少】的司机！
            fullyEligible.sort((a, b) => a.stats.projectedEarnings - b.stats.projectedEarnings);
            chosenCandidate = fullyEligible[0];
        } else {
            // 全员不完全符合（例如均已跑满或均休假），选择请假之外、休息时间最长且收入最低的司机兜底，并给予疲劳警告
            const nonLeaveCandidates = candidates.filter(c => !c.eligibility.reason.includes('请假'));
            if (nonLeaveCandidates.length > 0) {
                nonLeaveCandidates.sort((a, b) => {
                    // 优先看休息时长，再看工钱
                    if (Math.abs(a.stats.restHoursFromLastWork - b.stats.restHoursFromLastWork) > 2) {
                        return b.stats.restHoursFromLastWork - a.stats.restHoursFromLastWork;
                    }
                    return a.stats.projectedEarnings - b.stats.projectedEarnings;
                });
                chosenCandidate = nonLeaveCandidates[0];
                isCompromise = true;
            }
        }

        if (chosenCandidate) {
            const cId = chosenCandidate.driverId;
            const cStats = chosenCandidate.stats;

            // 绑定到 Trip
            trip.recommendedDriverId = cId;
            trip.recommendedDriverName = cStats.driverName;

            // 生成理由标签
            const diffFromAvg = avgEarnings - cStats.projectedEarnings;
            if (isCompromise) {
                trip.recommendationReason = `⚠️ 妥协调度：全员紧张，${chosenCandidate.eligibility.reason}`;
                trip.recommendationBadgeColor = 'red';
                trip.hasFatigueWarning = true;
                trip.fatigueWarningDetail = chosenCandidate.eligibility.reason;
            } else if (diffFromAvg > 100) {
                trip.recommendationReason = `【收入拉平优先】当月落后均值 RM ${Math.round(diffFromAvg)}，优先补齐`;
                trip.recommendationBadgeColor = 'emerald';
            } else if (trip.isShortTrip && (driverDailyTrips[cId]?.[targetDate]?.length || 0) > 0) {
                const tripNum = (driverDailyTrips[cId]?.[targetDate]?.length || 0) + 1;
                trip.recommendationReason = `【短途连跑第${tripNum}趟】今日工时充足，安排同日短途`;
                trip.recommendationBadgeColor = 'purple';
            } else {
                trip.recommendationReason = `【工时充足】已休 ${cStats.restHoursFromLastWork.toFixed(1)}h，收益均衡推荐`;
                trip.recommendationBadgeColor = 'blue';
            }

            // 更新司机的预估数值与当日趟次记录（供下一趟分配感知）
            cStats.projectedEarnings += trip.estimatedEarnings;
            cStats.assignedNewTripsCount += 1;
            cStats.dailyTripCountOnTargetDate += 1;
            cStats.dailyEstimatedHoursOnTargetDate += (trip.isShortTrip ? 3.5 : 7.5);

            if (!driverDailyTrips[cId][targetDate]) {
                driverDailyTrips[cId][targetDate] = [];
            }
            driverDailyTrips[cId][targetDate].push({ isShort: trip.isShortTrip });
        } else {
            trip.recommendedDriverId = null;
            trip.recommendedDriverName = '暂无可指派司机';
            trip.recommendationReason = '无可符合休息与出车条件的司机';
            trip.recommendationBadgeColor = 'red';
            trip.hasFatigueWarning = true;
            unassignedCount += 1;
        }
    });

    return {
        trips: enrichedTrips,
        driverStatsMap,
        unassignedTripsCount: unassignedCount,
        rules,
        groupAverageEarnings: avgEarnings
    };
}

/**
 * 校验调度员手动更换司机时的合规性（连续休息、单日外州长途限制、单日短途限制）
 */
export function validateManualDriverAssignment(
    driverId: string,
    targetDate: string,
    targetTrip: BalancedTripDraft,
    allTrips: BalancedTripDraft[],
    driverStatsMap: Record<string, DriverStats>,
    rules: DispatchRuleConfig
): { isValid: boolean; reason: string; severity: 'red' | 'amber' | 'blue' } {
    if (!driverId) {
        return { isValid: true, reason: '未指派司机', severity: 'blue' };
    }

    const stat = driverStatsMap[driverId];
    // 1. 检查连续休息时间
    if (stat && stat.restHoursFromLastWork < rules.minRestHours) {
        return {
            isValid: false,
            reason: `⚠️ 疲劳驾驶风险：该司机下班至今仅休息 ${stat.restHoursFromLastWork.toFixed(1)}h（规定需满 ${rules.minRestHours}h）`,
            severity: 'red'
        };
    }

    // 2. 检查当天该司机已经被指派的其它车次
    const otherTripsOnDate = (allTrips || []).filter(t => 
        t.id !== targetTrip.id && 
        t.recommendedDriverId === driverId && 
        t.targetDate === targetDate
    );

    const longTripsCount = otherTripsOnDate.filter(t => !t.isShortTrip).length;
    const shortTripsCount = otherTripsOnDate.filter(t => t.isShortTrip).length;

    if (!targetTrip.isShortTrip) {
        // 当前为外州长途
        if (longTripsCount >= 1) {
            return {
                isValid: false,
                reason: `🚨 严重违规：外州长途单日严格限 1 趟，该司机当天已排长途！`,
                severity: 'red'
            };
        }
        if (shortTripsCount >= 1) {
            return {
                isValid: false,
                reason: `⚠️ 规则提醒：该司机当天已有短途配送，不建议同日跨州长途`,
                severity: 'amber'
            };
        }
    } else {
        // 当前为短途
        if (longTripsCount >= 1) {
            return {
                isValid: false,
                reason: `🚨 规则超限：该司机当天已有外州长途，无法同日再安排短途！`,
                severity: 'red'
            };
        }
        if (shortTripsCount >= rules.maxShortTripsPerDay) {
            return {
                isValid: false,
                reason: `⚠️ 趟次超限：该司机当天短途已达上限（${rules.maxShortTripsPerDay} 趟）`,
                severity: 'amber'
            };
        }
    }

    return {
        isValid: true,
        reason: `【手动指派】符合出车与休息条件`,
        severity: 'blue'
    };
}

