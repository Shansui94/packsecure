export interface ProductionLogRow {
    log_id?: string;
    machine_id?: string;
    output_qty?: number;
    quantity_produced?: number;
    sku?: string;
    product_name?: string;
    created_at: string;
}

export interface ProductionGap {
    from: string;
    to: string;
    durationMins: number;
}

export function getOutputQty(log: ProductionLogRow): number {
    const qty = log.output_qty ?? log.quantity_produced;
    const n = Number(qty);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

export function aggregateQtyBySku(logs: ProductionLogRow[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    logs.forEach((log) => {
        const key = log.product_name || log.sku || 'Unknown';
        breakdown[key] = (breakdown[key] || 0) + getOutputQty(log);
    });
    return breakdown;
}

export function detectProductionGaps(
    logs: ProductionLogRow[],
    gapMinutesThreshold = 10
): ProductionGap[] {
    if (logs.length < 2) return [];

    const sorted = [...logs].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const gaps: ProductionGap[] = [];
    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].created_at);
        const curr = new Date(sorted[i].created_at);
        const diffMins = (curr.getTime() - prev.getTime()) / 60000;
        if (diffMins > gapMinutesThreshold) {
            gaps.push({
                from: sorted[i - 1].created_at,
                to: sorted[i].created_at,
                durationMins: Math.round(diffMins * 10) / 10,
            });
        }
    }
    return gaps;
}

export function plantTotals(logs: ProductionLogRow[]): {
    totalQty: number;
    activeMachineIds: Set<string>;
    logCount: number;
} {
    const activeMachineIds = new Set<string>();
    let totalQty = 0;
    logs.forEach((log) => {
        totalQty += getOutputQty(log);
        if (log.machine_id) activeMachineIds.add(log.machine_id);
    });
    return { totalQty, activeMachineIds, logCount: logs.length };
}
