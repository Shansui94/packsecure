import { supabase } from './supabase';

export interface DailyReport {
    date: string;
    startTime: string | null;
    endTime: string | null;
    duration: string; // HH:MM:SS
    totalQuantity: number;
    productBreakdown: string; // "SKU1: 50, SKU2: 30"
    rawBreakdown: Record<string, number>;
}

export const reportService = {
    async getDailyStats(date: Date = new Date()): Promise<DailyReport> {
        // 1. Define time range for the given date (Local Time)
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // 2. Fetch logs
        const { data: logs, error } = await supabase
            .from('production_logs_v2')
            .select('*')
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!logs || logs.length === 0) {
            return {
                date: date.toLocaleDateString(),
                startTime: null,
                endTime: null,
                duration: '0h 0m',
                totalQuantity: 0,
                productBreakdown: 'No Production',
                rawBreakdown: {}
            };
        }

        // 3. Calculate Metrics
        const startTime = new Date(logs[0].created_at);
        const endTime = new Date(logs[logs.length - 1].created_at);

        // Duration in minutes
        const diffMs = endTime.getTime() - startTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        const duration = `${hours}h ${mins}m`;

        // Quantity & Breakdown
        let totalQuantity = 0;
        const breakdown: Record<string, number> = {};

        logs.forEach(log => {
            const qty = Number(log.output_qty || (log as any).quantity_produced) || 0;
            totalQuantity += qty;

            const key = log.sku || (log as any).product_name || 'Unknown';
            breakdown[key] = (breakdown[key] || 0) + qty;
        });

        const breakdownStr = Object.entries(breakdown)
            .map(([name, qty]) => `${name}: ${qty}`)
            .join(', ');

        return {
            date: date.toLocaleDateString(),
            startTime: startTime.toLocaleTimeString(),
            endTime: endTime.toLocaleTimeString(),
            duration,
            totalQuantity,
            productBreakdown: breakdownStr,
            rawBreakdown: breakdown
        };
    }
};
