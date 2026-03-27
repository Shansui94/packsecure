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
            .select('product_sku, lane_id, yield')
            .eq('machine_id', machine_id);

        const activeLaneMap: Record<string, { sku: string | null; yield: number }> = {};
        (activeProducts || []).forEach((p: any) => {
            activeLaneMap[p.lane_id] = {
                sku: p.product_sku || null,
                yield: p.yield || 1,
            };
        });

        const isReboot = (alarm_count === 0);
        
        // --- 1. BUILD V1 ROWS ---
        const insertRowsV1 = lanes.map((laneId: string) => {
            const laneData = activeLaneMap[laneId] ?? activeLaneMap['Single'] ?? null;
            const resolvedSku = (laneData?.sku && laneData.sku !== 'UNKNOWN') ? laneData.sku : 'UNKNOWN-BUBBLEWRAP';
            return {
                machine_id,
                lane_id: laneId,
                alarm_count: isReboot ? 0 : (laneData?.yield ?? 1),
                product_sku: resolvedSku,
            };
        });

        // --- 2. BUILD V2 ROWS ---
        const insertRowsV2 = lanes.map((laneId: string) => {
            const laneData = activeLaneMap[laneId] ?? activeLaneMap['Single'] ?? null;
            const resolvedSku = (laneData?.sku && laneData.sku !== 'UNKNOWN') ? laneData.sku : 'UNKNOWN-BUBBLEWRAP';
            return {
                machine_id,
                output_qty: isReboot ? 0 : (laneData?.yield ?? 1),
                sku: resolvedSku,
            };
        });

        // --- 3. DUAL WRITE (Safe parallel execution) ---
        // We write to both independently so that V2's Live Stock Dashboard updates in real time,
        // while preserving V1's operational stability. If V2 fails, V1 still succeeds.
        const [v1Res, v2Res] = await Promise.allSettled([
            supabase.from('production_logs').insert(insertRowsV1),
            supabase.from('production_logs_v2').insert(insertRowsV2)
        ]);

        let v1Error = null;
        if (v1Res.status === 'rejected') v1Error = v1Res.reason;
        else if (v1Res.value.error) v1Error = v1Res.value.error;

        let v2Error = null;
        if (v2Res.status === 'rejected') v2Error = v2Res.reason;
        else if (v2Res.value.error) v2Error = v2Res.value.error;

        if (v1Error) {
            console.error('CRITICAL: V1 Insert Error:', v1Error);
            throw v1Error; // Must throw to let ESP32 retry if V1 fails
        }
        
        if (v2Error) {
            // Soft fail: log it, but don't crash the ESP32 pulse
            console.error('Warning: V2 Insert Error (Non-fatal):', v2Error);
        }

        return res.status(200).json({
            status: 'ok',
            message: `Logged to V1 & V2`,
            lanes: insertRowsV1,
        });

    } catch (e: any) {
        console.error('Alarm Log Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to log alarm' });
    }
}
