import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Machine Layout Config ────────────────────────────────────────────────────
const MACHINE_LANES: Record<string, string[]> = {
    'T1.2-M01': ['Lane1', 'Lane2'],
    'N1-M01': ['Single'],
    'N2-M02': ['Single'],
    'T1.3-M02': ['Single'],
};
const DEFAULT_LANES = ['Single'];

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { machine_id, alarm_count } = req.body;

        if (!machine_id) {
            return res.status(400).json({ error: 'machine_id is required' });
        }

        const lanes = MACHINE_LANES[machine_id] || DEFAULT_LANES;
        console.log(`Alarm from ${machine_id} | alarm_count=${alarm_count} | lanes=${lanes.join(',')}`);

        const { data: activeProducts } = await supabase
            .from('machine_active_products')
            .select('product_sku, lane_id, yield, operator_id')
            .eq('machine_id', machine_id);

        const activeLaneMap: Record<string, { sku: string | null; yield: number; operator_id: string | null }> = {};
        (activeProducts || []).forEach((p: any) => {
            activeLaneMap[p.lane_id] = {
                sku: p.product_sku || null,
                yield: p.yield || 1,
                operator_id: p.operator_id || null,
            };
        });

        const isReboot = (alarm_count === 0);
        
        // --- 1. NATIVE V2 INSERTION ---
        const insertRowsV2 = lanes.map((laneId: string) => {
            const laneData = activeLaneMap[laneId] ?? activeLaneMap['Single'] ?? null;
            const resolvedSku = (laneData?.sku && laneData.sku !== 'UNKNOWN') ? laneData.sku : 'UNKNOWN-BUBBLEWRAP';
            return {
                machine_id,
                output_qty: isReboot ? 0 : (laneData?.yield ?? 1),
                sku: resolvedSku,
                operator_id: laneData?.operator_id || null,
            };
        });

        const { error: v2Error } = await supabase.from('production_logs_v2').insert(insertRowsV2);

        if (v2Error) {
            console.error('CRITICAL: V2 Insert Error:', v2Error);
            throw v2Error; // Must throw to let ESP32 retry if it fails
        }

        return res.status(200).json({
            status: 'ok',
            message: `Logged to V2 Native`,
            lanes: insertRowsV2,
        });

    } catch (e: any) {
        console.error('Alarm Log Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to log alarm' });
    }
}
