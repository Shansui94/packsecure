import { supabase } from './supabase';
import { mytRangeBoundsUtcIso, mytTodayYmd } from '../utils/mytDate';
import { aggregateQtyBySku, getOutputQty, plantTotals, type ProductionLogRow } from '../utils/productionAggregates';
import { buildDeliveryRateMap, calcTripEarnings, isOnTimeDelivery } from '../utils/deliveryEarnings';

export interface KpiSnapshot {
    period: { startYmd: string; endYmd: string };
    generatedAt: string;
    production: {
        totalQty: number;
        activeMachines: number;
        logCount: number;
        topSkus: { sku: string; qty: number }[];
    };
    logistics: {
        delivered: number;
        onTime: number;
        onTimePct: number;
        pending: number;
        unassigned: number;
        estEarningsRm: number;
    };
    inventory: {
        auditSessions: number;
        netVariance: number;
    };
    hr: {
        attendanceRecords: number;
        approvedLeaveDays: number;
    };
}

export async function fetchKpiSnapshot(
    startYmd?: string,
    endYmd?: string
): Promise<KpiSnapshot> {
    const end = endYmd || mytTodayYmd();
    const start = startYmd || end;
    const { start: rangeStart, end: rangeEnd } = mytRangeBoundsUtcIso(start, end);

    const [
        prodRes,
        ordersRes,
        ratesRes,
        auditRes,
        attendanceRes,
        leaveRes,
    ] = await Promise.all([
        supabase
            .from('production_logs_v2')
            .select('machine_id, output_qty, quantity_produced, sku, product_name, created_at')
            .gte('created_at', rangeStart)
            .lte('created_at', rangeEnd),
        supabase
            .from('sales_orders')
            .select(
                'id, status, driver_id, deadline, pod_timestamp, trip_origin, zone, delivery_zone, delivery_address, trip_drop_count'
            )
            .gte('deadline', start)
            .lte('deadline', end),
        supabase.from('delivery_rates').select('*'),
        supabase
            .from('stock_ledger_v2')
            .select('change_qty, ref_doc, timestamp')
            .eq('event_type', 'Audit Adjustment')
            .gte('timestamp', rangeStart)
            .lte('timestamp', rangeEnd),
        supabase
            .from('attendance')
            .select('id')
            .gte('date', start)
            .lte('date', end),
        supabase
            .from('employee_leave')
            .select('count_days')
            .eq('status', 'Approved')
            .lte('start_date', end)
            .gte('end_date', start),
    ]);

    const prodLogs = (prodRes.data || []) as ProductionLogRow[];
    const { totalQty, activeMachineIds, logCount } = plantTotals(prodLogs);
    const skuMap = aggregateQtyBySku(prodLogs);
    const topSkus = Object.entries(skuMap)
        .map(([sku, qty]) => ({ sku, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

    const orders = ordersRes.data || [];
    const rateMap = buildDeliveryRateMap(ratesRes.data || []);
    const delivered = orders.filter((o) => o.status === 'Delivered');
    const onTime = delivered.filter((o) => isOnTimeDelivery(o.pod_timestamp, o.deadline));
    const pending = orders.filter(
        (o) => o.status !== 'Delivered' && o.status !== 'Cancelled'
    ).length;
    const unassigned = orders.filter(
        (o) => !o.driver_id && o.status !== 'Delivered' && o.status !== 'Cancelled'
    ).length;
    const estEarningsRm = delivered.reduce(
        (sum, o) => sum + calcTripEarnings(o, rateMap),
        0
    );

    const auditRows = auditRes.data || [];
    const sessionIds = new Set(auditRows.map((r) => r.ref_doc).filter(Boolean));
    const netVariance = auditRows.reduce((s, r) => s + (Number(r.change_qty) || 0), 0);

    const approvedLeaveDays = (leaveRes.data || []).reduce(
        (s, l) => s + (Number(l.count_days) || 0),
        0
    );

    return {
        period: { startYmd: start, endYmd: end },
        generatedAt: new Date().toISOString(),
        production: {
            totalQty,
            activeMachines: activeMachineIds.size,
            logCount,
            topSkus,
        },
        logistics: {
            delivered: delivered.length,
            onTime: onTime.length,
            onTimePct: delivered.length > 0 ? Math.round((onTime.length / delivered.length) * 1000) / 10 : 0,
            pending,
            unassigned,
            estEarningsRm: Math.round(estEarningsRm * 100) / 100,
        },
        inventory: {
            auditSessions: sessionIds.size,
            netVariance: Math.round(netVariance * 100) / 100,
        },
        hr: {
            attendanceRecords: attendanceRes.data?.length || 0,
            approvedLeaveDays,
        },
    };
}

/** Today-only production total (legacy helper) */
export async function fetchTodayProductionQty(): Promise<number> {
    const today = mytTodayYmd();
    const { start, end } = mytRangeBoundsUtcIso(today, today);
    const { data } = await supabase
        .from('production_logs_v2')
        .select('output_qty, quantity_produced')
        .gte('created_at', start)
        .lte('created_at', end);
    return (data || []).reduce((sum, row) => sum + getOutputQty(row as ProductionLogRow), 0);
}
