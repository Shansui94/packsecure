import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import {
    calculateTripRate,
    recordHrCorrection,
    syncApprovedAmountToOrderNotes,
    getDiscrepancyBadge,
    resolveDeliveryRate,
    DiscrepancyLevel,
    AuditStatus
} from '../../utils/aiDriverPricing';

export interface AuditTripItem {
    id: string; // group key or trip_id
    tripNumber: string;
    driverName: string;
    driverId?: string;
    lorryPlate: string;
    date: string;
    orders: any[];
    addresses: string[];
    dropCount: number;
    baseRate: number;
    maxPlaces: number;
    extraRatePerPlace: number;
    extraDrops: number;
    extraEarnings: number;
    legacyRate: number;
    aiRate: number;
    diffAmount: number;
    discrepancyLevel: DiscrepancyLevel;
    auditStatus: AuditStatus;
    approvedAmount: number | null;
    standardizedLocation?: string;
    aiZone?: string;
    aiReasoning?: string;
    citations?: string[];
    confidenceScore?: number;
    auditRecordId?: string;
    hrNote?: string;
    isTest?: boolean;
}

export interface HRAuditWorkbenchProps {
    onOpenRulebook?: () => void;
}

export const HRAuditWorkbench: React.FC<HRAuditWorkbenchProps> = ({ onOpenRulebook }) => {
    const [trips, setTrips] = useState<AuditTripItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'green' | 'yellow' | 'red' | 'approved'>('pending');
    const [selectedTrip, setSelectedTrip] = useState<AuditTripItem | null>(null);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    
    // Custom adjustment state
    const [customAmount, setCustomAmount] = useState<string>('');
    const [customReason, setCustomReason] = useState<string>('');
    const [batchApproving, setBatchApproving] = useState<boolean>(false);

    useEffect(() => {
        fetchTripsForAudit();
    }, []);

    const fetchTripsForAudit = async () => {
        setLoading(true);
        try {
            // Fetch recent 60 sales orders that are not cancelled
            const { data: orders, error } = await supabase
                .from('sales_orders')
                .select('*')
                .neq('status', 'Cancelled')
                .not('delivery_address', 'is', null)
                .order('created_at', { ascending: false })
                .limit(60);

            if (error) throw error;

            // Fetch users for driver name mapping
            const { data: users } = await supabase.from('users_public').select('id, name');
            const driverMap: Record<string, string> = {};
            users?.forEach(u => {
                if (u.id && u.name) driverMap[u.id] = u.name;
            });

            // Fetch lorries for plate mapping
            const { data: lorries } = await supabase.from('lorries').select('id, plate_number, driver_id, driver_name');
            const lorryMap: Record<string, string> = {};
            const lorryIdMap: Record<string, string> = {};
            const lorryDriverMap: Record<string, string> = {};
            lorries?.forEach(l => {
                if (l.id && l.plate_number) lorryIdMap[l.id] = l.plate_number;
                if (l.driver_id && l.plate_number) lorryMap[l.driver_id] = l.plate_number;
                if (l.plate_number && l.driver_name) lorryDriverMap[l.plate_number] = l.driver_name;
            });

            // Fetch trips_v2 for real trip_number and assigned lorry_id
            const { data: tripsV2 } = await supabase.from('trips_v2').select('id, trip_number, lorry_id');
            const tripNumberMap: Record<string, string> = {};
            const tripLorryMap: Record<string, string> = {};
            tripsV2?.forEach(t => {
                if (t.id && t.trip_number) tripNumberMap[t.id] = t.trip_number;
                if (t.id && t.lorry_id) tripLorryMap[t.id] = t.lorry_id;
            });

            // Fetch official calibrated delivery rates from DB
            const { data: dbRates } = await supabase
                .from('delivery_rates')
                .select('origin, location_name, base_rate, max_places, extra_rate_per_place');

            const allRates = dbRates || [];

            // Group orders by trip_id or date + driver
            const grouped = new Map<string, any[]>();
            orders?.forEach(o => {
                const dateKey = (o.deadline || o.pod_timestamp || o.created_at || '').slice(0, 10);
                const groupKey = o.trip_id ? `trip_${o.trip_id}` : `daily_${o.driver_id || 'unassigned'}_${dateKey}`;
                if (!grouped.has(groupKey)) grouped.set(groupKey, []);
                grouped.get(groupKey)!.push(o);
            });

            const parsedTrips: AuditTripItem[] = [];

            for (const [key, groupOrders] of grouped.entries()) {
                const primary = groupOrders[0];
                const dateStr = (primary.deadline || primary.pod_timestamp || primary.created_at || '').slice(0, 10);
                const addresses = Array.from(new Set(groupOrders.map(o => (o.delivery_address || '').trim()).filter(Boolean)));
                const dropCount = Math.max(1, groupOrders.length);
                const driverId = primary.driver_id;
                
                // Real vehicle plate resolution (strictly no fictitious mock plates)
                const assignedLorryId = primary.trip_id && tripLorryMap[primary.trip_id];
                const plate = (assignedLorryId && lorryIdMap[assignedLorryId])
                    || (driverId && lorryMap[driverId]) 
                    || primary.lorry_plate 
                    || '待定车辆';

                const driverName = (driverId && driverMap[driverId]) || (plate && lorryDriverMap[plate]) || primary.driver_name || '待派司机';

                // Real trip number resolution (prioritize trips_v2.trip_number or first DO number)
                const realTripNumber = (primary.trip_id && tripNumberMap[primary.trip_id])
                    || (primary.order_number 
                        ? (groupOrders.length > 1 ? `${primary.order_number} (+${groupOrders.length - 1}单)` : primary.order_number)
                        : `TRIP-${dateStr.replace(/-/g, '')}`);

                // Detect if trip is a test run
                const isTest = groupOrders.some(o => 
                    (o.customer || '').toLowerCase().includes('general customer') || 
                    (o.order_number || '').toUpperCase().startsWith('TEST') ||
                    (o.order_number || '').toUpperCase().startsWith('DO-260928-01')
                );

                // Check existing approved amount in notes
                let existingApproved: number | null = null;
                for (const o of groupOrders) {
                    const m = o.notes?.match(/\[APPROVED_AMOUNT:\s*([\d.]+)\]/);
                    if (m) {
                        existingApproved = parseFloat(m[1]);
                        break;
                    }
                }

                // Official rate calculation using unified resolveDeliveryRate
                const origin = (primary.trip_origin || 'TAIPING').toUpperCase();
                const resolved = resolveDeliveryRate({
                    addresses,
                    dropCount,
                    origin,
                    lorryPlate: plate,
                    dbRates: allRates,
                    existingApprovedAmount: existingApproved
                });

                const baseRate = resolved.baseRate;
                const maxPlaces = resolved.maxPlaces;
                const extraRatePerPlace = resolved.extraRatePerPlace;
                const legacyRate = resolved.legacyRate;
                const extraDrops = resolved.extraDrops;
                const extraEarnings = resolved.extraEarnings;
                const aiRate = resolved.aiRate;
                const diff = resolved.diffAmount;
                const level = resolved.discrepancyLevel;
                const reasoning = resolved.reasoning;
                const zone = resolved.zone;
                const standardized = resolved.standardizedLocation;

                parsedTrips.push({
                    id: key,
                    tripNumber: realTripNumber,
                    driverName,
                    driverId,
                    lorryPlate: plate,
                    date: dateStr,
                    orders: groupOrders,
                    addresses,
                    dropCount,
                    baseRate,
                    maxPlaces,
                    extraRatePerPlace,
                    extraDrops,
                    extraEarnings,
                    legacyRate,
                    aiRate,
                    diffAmount: diff,
                    discrepancyLevel: level,
                    auditStatus: existingApproved !== null ? 'APPROVED' : 'PENDING',
                    approvedAmount: existingApproved !== null ? existingApproved : null,
                    standardizedLocation: standardized,
                    aiZone: zone,
                    aiReasoning: reasoning,
                    citations: ['《Packsecure 运费规则库 v2.1.0》', origin === 'NILAI' ? '汝来基地生效价目表' : (origin === 'JOHOR' ? '柔佛基地生效价目表' : '太平基地生效价目表'), '超点津贴计算规则 (Tambah Tempat)'],
                    confidenceScore: 0.98
                });
            }

            setTrips(parsedTrips);
        } catch (err: any) {
            console.error('fetchTripsForAudit error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filtered list
    const filteredTrips = trips.filter(t => {
        if (filterTab === 'pending') return t.auditStatus === 'PENDING';
        if (filterTab === 'approved') return t.auditStatus === 'APPROVED' || t.auditStatus === 'ADJUSTED';
        if (filterTab === 'green') return t.discrepancyLevel === 'AUTO_MATCH';
        if (filterTab === 'yellow') return t.discrepancyLevel === 'MINOR_DRIFT' || t.discrepancyLevel === 'AI_ENRICHED';
        if (filterTab === 'red') return t.discrepancyLevel === 'HIGH_DISCREPANCY';
        return true;
    });

    const pendingMatchesCount = trips.filter(t => t.discrepancyLevel === 'AUTO_MATCH' && t.auditStatus === 'PENDING').length;
    const minorDriftCount = trips.filter(t => t.discrepancyLevel === 'MINOR_DRIFT' || t.discrepancyLevel === 'AI_ENRICHED').length;
    const discrepancyCount = trips.filter(t => t.discrepancyLevel === 'HIGH_DISCREPANCY').length;
    const totalPending = trips.filter(t => t.auditStatus === 'PENDING').length;

    // Batch approve all matching green items
    const handleBatchApproveMatches = async () => {
        const greenMatches = trips.filter(t => t.discrepancyLevel === 'AUTO_MATCH' && t.auditStatus === 'PENDING');
        if (greenMatches.length === 0) {
            alert('当前没有待核准的规则合规项。');
            return;
        }

        if (!window.confirm(`确认一键批量核准 ${greenMatches.length} 趟规则合规单据？系统将自动将应发运费计入司机工资流水！`)) {
            return;
        }

        setBatchApproving(true);
        try {
            for (const trip of greenMatches) {
                // write to each order in group
                for (const o of trip.orders) {
                    await syncApprovedAmountToOrderNotes(o.id, o.notes, trip.aiRate);
                }
            }

            setTrips(prev => prev.map(t => {
                if (t.discrepancyLevel === 'AUTO_MATCH') {
                    return { ...t, auditStatus: 'APPROVED', approvedAmount: t.aiRate };
                }
                return t;
            }));

            alert(`✅ 成功批量核准 ${greenMatches.length} 趟行程！`);
        } catch (err: any) {
            alert('批量核准失败: ' + err.message);
        } finally {
            setBatchApproving(false);
        }
    };

    // Approve single trip with chosen amount
    const handleApproveTrip = async (trip: AuditTripItem, finalAmount: number, isAdjustment: boolean = false, reason?: string) => {
        setActionLoading(true);
        try {
            // 1. Sync to each sales_order's notes for 100% backward compatibility
            for (const o of trip.orders) {
                await syncApprovedAmountToOrderNotes(o.id, o.notes, finalAmount);
            }

            // 2. If HR adjusted with reason, record correction feedback loop
            if (isAdjustment) {
                await recordHrCorrection({
                    audit_id: trip.auditRecordId,
                    trip_id: trip.tripNumber,
                    address_text: trip.addresses.join(' | '),
                    lorry_plate: trip.lorryPlate,
                    ai_rate: trip.aiRate,
                    hr_rate: finalAmount,
                    diff_reason: reason || 'HR 手动调价',
                    reviewed_by: 'HR'
                });
            }

            // 3. Update local state
            setTrips(prev => prev.map(t => {
                if (t.id === trip.id) {
                    return {
                        ...t,
                        auditStatus: isAdjustment ? 'ADJUSTED' : 'APPROVED',
                        approvedAmount: finalAmount,
                        hrNote: reason
                    };
                }
                return t;
            }));

            setSelectedTrip(null);
            setCustomAmount('');
            setCustomReason('');
        } catch (err: any) {
            alert('核准保存失败: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-slate-500">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                正在检索待核验行程与运费流水...
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                    <span className="text-2xl">🚦</span>
                    <div>
                        <h2 className="text-lg font-bold text-slate-100">HR 运费自检与核验工作台 (Rate Audit Workbench)</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            双轨对比原系统与 AI 依据最新 Markdown 规则核算之差额，一键放行绿色项，穿透审查异常项。
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {onOpenRulebook && (
                        <button
                            onClick={onOpenRulebook}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
                        >
                            <span>📜</span>
                            <span>编辑运费规则库 (Markdown)</span>
                        </button>
                    )}

                    <button
                        onClick={handleBatchApproveMatches}
                        disabled={batchApproving || pendingMatchesCount === 0}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm ${
                            pendingMatchesCount > 0
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer ring-2 ring-emerald-400/50'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                    >
                        {batchApproving ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <span>⚡</span>
                        )}
                        <span>一键全选批准合规项 ({pendingMatchesCount} 笔)</span>
                    </button>

                    <button
                        onClick={fetchTripsForAudit}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                        title="刷新数据"
                    >
                        🔄 刷新
                    </button>
                </div>
            </div>

            {/* Traffic Light Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-200">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500">待核验行程总数</div>
                    <div className="text-2xl font-black text-slate-800 mt-1">{totalPending} 趟</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">待 HR 最终核准入账</div>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800">🟢 规则合规 (Auto Match)</span>
                        <span className="text-xs font-mono font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                            {pendingMatchesCount} 待批
                        </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-700 mt-1">{trips.filter(t => t.discrepancyLevel === 'AUTO_MATCH').length} 趟</div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">起步价与超点津贴精准合规，安全可靠</div>
                </div>

                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-800">🟡 待定微调 (Review)</span>
                        <span className="text-xs font-mono font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                            {minorDriftCount} 趟
                        </span>
                    </div>
                    <div className="text-2xl font-black text-amber-700 mt-1">{minorDriftCount} 趟</div>
                    <div className="text-[11px] text-amber-700 mt-0.5">未分配车牌、专属车型或超10点大单</div>
                </div>

                <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-800">🚨 异常拦截 (Anomalies)</span>
                        <span className="text-xs font-mono font-bold bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">
                            {discrepancyCount} 趟
                        </span>
                    </div>
                    <div className="text-2xl font-black text-rose-700 mt-1">{discrepancyCount} 趟</div>
                    <div className="text-[11px] text-rose-600 mt-0.5">地址未识别兜底、基准价为0或总额超限</div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-6 py-2 bg-white border-b border-slate-200 flex space-x-2 text-xs">
                <button
                    onClick={() => setFilterTab('pending')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                        filterTab === 'pending'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    待核验 ({totalPending})
                </button>
                <button
                    onClick={() => setFilterTab('green')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        filterTab === 'green'
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    🟢 规则合规 ({trips.filter(t => t.discrepancyLevel === 'AUTO_MATCH').length})
                </button>
                <button
                    onClick={() => setFilterTab('yellow')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        filterTab === 'yellow'
                            ? 'bg-amber-500 text-white font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    🟡 待定微调 ({minorDriftCount})
                </button>
                <button
                    onClick={() => setFilterTab('red')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        filterTab === 'red'
                            ? 'bg-rose-600 text-white font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    🚨 异常拦截 ({discrepancyCount})
                </button>
                <button
                    onClick={() => setFilterTab('approved')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        filterTab === 'approved'
                            ? 'bg-slate-800 text-white font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    已核准入账 ({trips.filter(t => t.auditStatus !== 'PENDING').length})
                </button>
                <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        filterTab === 'all'
                            ? 'bg-slate-800 text-white font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    全部 ({trips.length})
                </button>
            </div>

            {/* Trips List Table */}
            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                            <th className="p-3">自检状态</th>
                            <th className="p-3">车次 / 司机</th>
                            <th className="p-3">车辆</th>
                            <th className="p-3">送货目的地 (经停点)</th>
                            <th className="p-3">基准起步价</th>
                            <th className="p-3">超点津贴 (Tambah)</th>
                            <th className="p-3">应发总运费</th>
                            <th className="p-3">核准入账</th>
                            <th className="p-3 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredTrips.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-16 text-slate-400">
                                    暂无符合该分类的行程记录
                                </td>
                            </tr>
                        ) : (
                            filteredTrips.map(trip => {
                                const badge = getDiscrepancyBadge(trip.discrepancyLevel);
                                const isApproved = trip.auditStatus !== 'PENDING';

                                return (
                                    <tr
                                        key={trip.id}
                                        className={`hover:bg-indigo-50/40 transition cursor-pointer ${
                                            selectedTrip?.id === trip.id ? 'bg-indigo-50' : ''
                                        }`}
                                        onClick={() => setSelectedTrip(trip)}
                                    >
                                        <td className="p-3">
                                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full font-bold text-[11px] border ${badge.bg}`}>
                                                <span>{badge.icon}</span>
                                                <span>{badge.label}</span>
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-800 font-mono text-xs flex items-center gap-1.5" title={trip.tripNumber}>
                                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                                    {trip.tripNumber.startsWith('#') ? trip.tripNumber : `#${trip.tripNumber}`}
                                                </span>
                                                {trip.isTest && (
                                                    <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded border border-amber-300 font-bold">
                                                        测试单
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1">
                                                <span className="font-semibold text-slate-800">{trip.driverName}</span> · {trip.date}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`font-mono px-1.5 py-0.5 rounded border font-bold text-xs ${
                                                trip.lorryPlate === '待定车辆'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 border-dashed text-[11px]'
                                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                            }`}>
                                                {trip.lorryPlate}
                                            </span>
                                        </td>
                                        <td className="p-3 max-w-xs">
                                            <div className="font-medium text-slate-800 truncate" title={trip.addresses.join(' | ')}>
                                                {trip.standardizedLocation || trip.addresses[0]}
                                            </div>
                                            <div className="text-[11px] text-slate-400 truncate">
                                                共 {trip.dropCount} 个卸货点 ({trip.aiZone || '默认区域'})
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-700 font-mono text-xs">
                                                RM {trip.baseRate.toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                含 {trip.maxPlaces} 个免费点
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className={`font-bold font-mono text-xs ${trip.extraEarnings > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                {trip.extraEarnings > 0 ? `+RM ${trip.extraEarnings.toFixed(2)}` : 'RM 0.00'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {trip.extraDrops > 0 ? `超 ${trip.extraDrops} 点 (+RM ${trip.extraRatePerPlace}/点)` : '未超点'}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-black text-slate-900 font-mono text-sm">
                                                RM {trip.aiRate.toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                                                起步 + 津贴
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            {isApproved && trip.approvedAmount !== null ? (
                                                <span className="inline-flex items-center text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs font-mono">
                                                    ✅ RM {trip.approvedAmount.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-amber-600 font-medium text-[11px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                                    ⏳ 待核验
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right whitespace-nowrap">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedTrip(trip);
                                                }}
                                                className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold transition shadow-2xs whitespace-nowrap inline-flex items-center gap-1 cursor-pointer"
                                            >
                                                <span>审核核准</span>
                                                <span>→</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Inspection & Approval Drawer / Modal */}
            {selectedTrip && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-end p-0">
                    <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-slate-200">
                        {/* Drawer Header */}
                        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h3 className="text-base font-bold text-slate-100">{selectedTrip.tripNumber}</h3>
                                    <span className="bg-slate-800 text-slate-300 font-mono text-xs px-2 py-0.5 rounded">
                                        {selectedTrip.lorryPlate}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    司机: {selectedTrip.driverName} ｜ 配送日期: {selectedTrip.date} ｜ 经停: {selectedTrip.dropCount} 点
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedTrip(null)}
                                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="p-6 space-y-5 flex-1">
                            {/* Price Breakdown Card */}
                            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div className="border-r border-slate-200 pr-2">
                                    <div className="text-[11px] text-slate-500 font-semibold">基准起步价 (Base)</div>
                                    <div className="text-xl font-bold text-slate-700 font-mono mt-0.5">
                                        RM {selectedTrip.baseRate.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">含 {selectedTrip.maxPlaces} 个免费点</div>
                                </div>
                                <div className="border-r border-slate-200 pr-2">
                                    <div className="text-[11px] text-indigo-600 font-semibold">超点津贴 (Tambah)</div>
                                    <div className="text-xl font-bold text-indigo-600 font-mono mt-0.5">
                                        +{selectedTrip.extraEarnings.toFixed(2)} RM
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">超 {selectedTrip.extraDrops} 点 (+RM {selectedTrip.extraRatePerPlace}/点)</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-emerald-700 font-bold">应发总运费 (Total)</div>
                                    <div className="text-2xl font-black text-emerald-700 font-mono mt-0.5">
                                        RM {selectedTrip.aiRate.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-emerald-600 font-medium mt-1">起步基准 + 超点津贴</div>
                                </div>
                            </div>

                            {/* Address & AI Entity Resolution */}
                            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                                <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                                    <span>📍</span>
                                    <span>送货目的地与标准化地理识别</span>
                                </h4>

                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">AI 标准化位置:</span>
                                        <span className="font-bold text-slate-800">{selectedTrip.standardizedLocation}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">命中计费阶梯:</span>
                                        <span className="font-bold text-indigo-600">{selectedTrip.aiZone}</span>
                                    </div>
                                </div>

                                <div className="text-xs">
                                    <div className="font-semibold text-slate-600 mb-1">经停地址原文本清单:</div>
                                    <ul className="space-y-1">
                                        {selectedTrip.addresses.map((a, i) => (
                                            <li key={i} className="font-mono text-[11px] bg-slate-100 p-2 rounded text-slate-700 flex items-start space-x-1.5">
                                                <span className="text-indigo-600 font-bold">{i + 1}.</span>
                                                <span>{a}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Reasoning & Citations */}
                            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs">
                                <h4 className="font-bold text-indigo-900 mb-1 flex items-center space-x-1.5">
                                    <span>🧠</span>
                                    <span>AI 运费核算依据与逻辑解释</span>
                                </h4>
                                <p className="text-indigo-900/90 leading-relaxed mb-3">
                                    {selectedTrip.aiReasoning}
                                </p>
                                <div className="space-y-1">
                                    {selectedTrip.citations?.map((c, i) => (
                                        <div key={i} className="text-[11px] text-indigo-700 flex items-center space-x-1">
                                            <span>📌</span>
                                            <span>{c}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Adjustment Input */}
                            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                                <h4 className="text-xs font-bold text-slate-800">✍️ 自定义调整最终入账金额 (HR 人工复核)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">最终金额 (RM):</label>
                                        <input
                                            type="number"
                                            value={customAmount}
                                            onChange={(e) => setCustomAmount(e.target.value)}
                                            placeholder={selectedTrip.aiRate.toString()}
                                            className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">调整理由 / 纠错备注:</label>
                                        <input
                                            type="text"
                                            value={customReason}
                                            onChange={(e) => setCustomReason(e.target.value)}
                                            placeholder="如：两州交界实按近郊计费"
                                            className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    * HR 若输入不同于 AI 的金额，系统将自动把该案例记入纠错库，反哺 AI 提炼新 Markdown 补丁。
                                </p>
                            </div>
                        </div>

                        {/* Drawer Actions Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                            <button
                                onClick={() => handleApproveTrip(selectedTrip, selectedTrip.baseRate, false)}
                                disabled={actionLoading}
                                className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                                仅发起步价 (RM {selectedTrip.baseRate.toFixed(2)})
                            </button>

                            {customAmount && Number(customAmount) > 0 ? (
                                <button
                                    onClick={() => handleApproveTrip(selectedTrip, Number(customAmount), true, customReason)}
                                    disabled={actionLoading}
                                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                >
                                    确认修正为 RM {Number(customAmount).toFixed(2)}
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleApproveTrip(selectedTrip, selectedTrip.aiRate, false)}
                                    disabled={actionLoading}
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                >
                                    确认核准应发总额 (RM {selectedTrip.aiRate.toFixed(2)})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
