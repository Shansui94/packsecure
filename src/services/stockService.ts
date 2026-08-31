import { supabase } from './supabase';

export interface StockLedgerEntry {
    sku: string;
    loc_id: string;
    change_qty: number;
    event_type: string;
    ref_doc: string;
    notes?: string;
}

export const normalizeLocation = (loc?: string): string => {
    if (!loc) return 'SPD';
    const upper = loc.toUpperCase().trim();
    if (upper === 'TAIPING') return 'SPD';
    if (upper === 'NILAI') return 'Nilai';
    if (upper === 'JOHOR') return 'Johor';
    if (upper === 'KELANTAN') return 'Kelantan';
    return loc;
};

/**
 * 1. Deduct stock immediately when order is Loaded (Naik Barang)
 */
export const deductStockForOrder = async (order: {
    id?: string;
    order_number?: string;
    trip_origin?: string;
    items?: any[];
    driver_name?: string;
}): Promise<void> => {
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) return;

    const entries: StockLedgerEntry[] = [];
    const fallbackLoc = normalizeLocation(order.trip_origin);

    for (const item of order.items) {
        const sku = item.sku || item.item_sku;
        const qty = Number(item.quantity || item.qty) || 0;
        const loc = normalizeLocation(item.sourceLocation || item.location || fallbackLoc);

        if (sku && qty > 0) {
            entries.push({
                sku,
                loc_id: loc,
                change_qty: -qty, // Negative for deduction
                event_type: 'Transfer Out',
                ref_doc: order.order_number || `DO-${order.id || 'ORDER'}`,
                notes: `Loaded (Naik Barang)${order.driver_name ? ` by ${order.driver_name}` : ''}`
            });
        }
    }

    if (entries.length > 0) {
        try {
            const { error } = await supabase.from('stock_ledger_v2').insert(entries);
            if (error) {
                console.warn('Failed to insert stock deduction entries into stock_ledger_v2:', error.message);
            }
        } catch (e: any) {
            console.warn('Exception during stock deduction:', e.message);
        }
    }
};

/**
 * 2. Reverse / Return stock when order is Cancelled or partial cargo returned
 */
export const reverseStockForOrder = async (order: {
    id?: string;
    order_number?: string;
    trip_origin?: string;
    items?: any[];
    reason?: string;
}): Promise<void> => {
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) return;

    const entries: StockLedgerEntry[] = [];
    const fallbackLoc = normalizeLocation(order.trip_origin);

    for (const item of order.items) {
        const sku = item.sku || item.item_sku;
        const qty = Number(item.quantity || item.qty) || 0;
        const loc = normalizeLocation(item.sourceLocation || item.location || fallbackLoc);

        if (sku && qty > 0) {
            entries.push({
                sku,
                loc_id: loc,
                change_qty: qty, // Positive for restoration
                event_type: 'Stock In',
                ref_doc: order.order_number || `DO-${order.id || 'ORDER'}`,
                notes: order.reason || 'Reversal / Return to Base'
            });
        }
    }

    if (entries.length > 0) {
        try {
            const { error } = await supabase.from('stock_ledger_v2').insert(entries);
            if (error) {
                console.warn('Failed to insert stock reversal entries:', error.message);
            }
        } catch (e: any) {
            console.warn('Exception during stock reversal:', e.message);
        }
    }
};

/**
 * 3. Adjust stock when quantities changed between driver load and admin approval
 */
export const adjustStockForOrderDelta = async (
    orderNumber: string,
    origin: string,
    previousItems: any[],
    newItems: any[]
): Promise<void> => {
    const fallbackLoc = normalizeLocation(origin);
    const prevMap = new Map<string, number>();
    (previousItems || []).forEach(i => {
        const sku = i.sku || i.item_sku;
        if (sku) prevMap.set(sku, Number(i.quantity || i.qty) || 0);
    });

    const entries: StockLedgerEntry[] = [];
    (newItems || []).forEach(i => {
        const sku = i.sku || i.item_sku;
        const newQty = Number(i.quantity || i.qty) || 0;
        const oldQty = prevMap.get(sku) || 0;
        const delta = oldQty - newQty;
        const loc = normalizeLocation(i.sourceLocation || i.location || fallbackLoc);

        if (sku && delta !== 0) {
            entries.push({
                sku,
                loc_id: loc,
                change_qty: delta,
                event_type: delta > 0 ? 'Stock In' : 'Transfer Out',
                ref_doc: orderNumber,
                notes: `Adjustment on Approval (Old: ${oldQty}, New: ${newQty})`
            });
        }
    });

    if (entries.length > 0) {
        try {
            const { error } = await supabase.from('stock_ledger_v2').insert(entries);
            if (error) {
                console.warn('Failed to insert adjustment entries:', error.message);
            }
        } catch (e: any) {
            console.warn('Exception during stock adjustment:', e.message);
        }
    }
};
