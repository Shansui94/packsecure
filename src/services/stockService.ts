export interface StockLedgerEntry {
    sku: string;
    loc_id: string;
    change_qty: number;
    event_type: string;
    ref_doc: string;
    notes?: string;
}

export const normalizeLocation = (loc?: string): string => {
    if (!loc) return 'OPM Lama';
    const upper = loc.toUpperCase().trim();
    if (upper === 'TAIPING' || upper === 'OPM_LAMA' || upper === 'OPM LAMA' || upper === 'T1' || upper === 'T2' || upper === 'T3' || upper === 'T4' || upper === 'T5') return 'OPM Lama';
    if (upper === 'OPM CORNER' || upper === 'OPM_CORNER') return 'OPM Corner';
    if (upper === 'OPM ALI' || upper === 'OPM_ALI') return 'OPM Ali';
    if (upper === 'NILAI') return 'Nilai';
    if (upper === 'JOHOR') return 'Johor';
    if (upper === 'KELANTAN') return 'Kelantan';
    if (upper === 'SPD') return 'SPD';
    return loc.trim();
};

/**
 * 1. Deduct stock immediately when order is Loaded (Naik Barang)
 * Note: Database trigger sync_order_inventory on sales_orders handles SSOT deduction.
 * This function is kept for backward-compatibility as a safe no-op to prevent double deductions.
 */
export const deductStockForOrder = async (order: {
    id?: string;
    order_number?: string;
    trip_origin?: string;
    items?: any[];
    driver_name?: string;
}): Promise<void> => {
    // Managed automatically by database trigger sync_order_inventory (SSOT)
    console.info(`[stockService] deductStockForOrder delegating to DB trigger for: ${order.order_number || order.id}`);
};

/**
 * 2. Reverse / Return stock when order is Cancelled or partial cargo returned
 * Note: Database trigger sync_order_inventory handles auto-refund on status transition (e.g. to Cancelled).
 */
export const reverseStockForOrder = async (order: {
    id?: string;
    order_number?: string;
    trip_origin?: string;
    items?: any[];
    reason?: string;
}): Promise<void> => {
    // Managed automatically by database trigger sync_order_inventory (SSOT)
    console.info(`[stockService] reverseStockForOrder delegating to DB trigger for: ${order.order_number || order.id}`);
};

/**
 * 3. Adjust stock when quantities changed between driver load and admin approval
 * Note: Database trigger sync_order_inventory handles auto-correction when items change.
 */
export const adjustStockForOrderDelta = async (
    orderNumber: string,
    _origin?: string,
    _previousItems?: any[],
    _newItems?: any[]
): Promise<void> => {
    // Managed automatically by database trigger sync_order_inventory (SSOT)
    console.info(`[stockService] adjustStockForOrderDelta delegating to DB trigger for: ${orderNumber}`);
};
