import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Machine Layout Config ────────────────────────────────────────────────────
// Define how many fixed lanes each machine has and their IDs.
// Single-lane machines use ['Single'], dual-lane uses ['Lane1', 'Lane2'], etc.
const MACHINE_LANES: Record<string, string[]> = {
    'T1.2-M01': ['Lane1', 'Lane2'],  // 200cm → 2 fixed lanes of 100cm each
    'N1-M01': ['Single'],
    'N2-M02': ['Single'],
    'T1.3-M02': ['Single'],
};
const DEFAULT_LANES = ['Single'];

// Server-side dedup guard: only reject exact network-retry duplicates (10 seconds)
// Kept short because ESP32 firmware already enforces the 4-minute production cooldown
const DEDUP_WINDOW_MS = 10 * 1000;

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

        // ── Dedup: reject if this machine logged within the last 10 seconds ──
        const deduCutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
        const { data: recentLog } = await supabase
            .from('production_logs')
            .select('created_at')
            .eq('machine_id', machine_id)
            .gte('created_at', deduCutoff)
            .limit(1)
            .maybeSingle();

        if (recentLog) {
            const diffSec = Math.round((Date.now() - new Date(recentLog.created_at).getTime()) / 1000);
            console.log(`Duplicate rejected for ${machine_id} (last log ${diffSec}s ago)`);
            return res.status(200).json({ status: 'duplicate', message: `Too soon (${diffSec}s ago), ignored` });
        }

        // ── Fetch all active products for this machine (all lanes) ──
        const { data: activeProducts } = await supabase
            .from('machine_active_products')
            .select('product_sku, lane_id, yield')
            .eq('machine_id', machine_id);

        // Build a map: lane_id → { product_sku, yield }
        const activeLaneMap: Record<string, { sku: string | null; yield: number }> = {};
        (activeProducts || []).forEach((p: any) => {
            activeLaneMap[p.lane_id] = {
                sku: p.product_sku || null,
                yield: p.yield || 1,
            };
        });

        // ── Build one log insert per lane ──
        // alarm_count=0 means reboot signal → preserve as 0 for all lanes
        const isReboot = (alarm_count === 0);
        const insertRows = lanes.map(laneId => {
            const laneData = activeLaneMap[laneId] || activeLaneMap['Single'] || null;
            const row: any = {
                machine_id,
                lane_id: laneId,
                alarm_count: isReboot ? 0 : (laneData?.yield ?? 1),
            };
            if (laneData?.sku) row.product_sku = laneData.sku;
            return row;
        });

        console.log(`Inserting ${insertRows.length} log(s):`, JSON.stringify(insertRows));

        const { error } = await supabase.from('production_logs').insert(insertRows);
        if (error) throw error;

        return res.status(200).json({
            status: 'ok',
            message: `Logged ${insertRows.length} lane(s)`,
            lanes: insertRows.map(r => ({ lane: r.lane_id, sku: r.product_sku || 'none', count: r.alarm_count })),
        });

    } catch (e: any) {
        console.error('Alarm Log Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to log alarm' });
    }
}
