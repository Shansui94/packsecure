import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Machine Layout Config ────────────────────────────────────────────────────
// Define how many fixed lanes each machine has and their IDs.
// Single-lane machines use ['Single'], dual-lane uses ['Lane1', 'Lane2'], etc.
const MACHINE_LANES: Record<string, string[]> = {
    'T1.2-M01': ['Lane1', 'Lane2'],  // 200cm → 2 fixed lanes
    'N1-M01': ['Single'],
    'N2-M02': ['Single'],
    'T1.3-M02': ['Single'],
};
const DEFAULT_LANES = ['Single'];

// Server-side dedup REMOVED (2026-03-09):
// The ESP32 firmware already enforces a 270s debounce at the hardware level,
// so real duplicate pulses are physically impossible. The old 10s dedup window
// was ACTIVELY HARMFUL: when WiFi recovered after an outage, the ESP32 would
// replay its buffered queue at 3s intervals, and the dedup killed all of them
// except the first — causing permanent data loss during downtime windows.

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
        // IMPORTANT: We IGNORE the firmware's alarm_count for quantity calculation.
        // The firmware batches queued pulses (e.g. 2 pending → sends alarm_count=2),
        // but we always use the DB yield config as the source of truth for quantity.
        // alarm_count=0 is a special reboot signal — the only case where we use it.
        const isReboot = (alarm_count === 0);
        const insertRows = lanes.map((laneId: string) => {
            // Look up this specific lane's active product only — no cross-lane fallback.
            // For single-lane machines that were configured under 'Single', also check that key.
            const laneData = activeLaneMap[laneId] ?? activeLaneMap['Single'] ?? null;

            const row: any = {
                machine_id,
                lane_id: laneId,
                // ALWAYS use DB yield — never firmware alarm_count (could be batched)
                alarm_count: isReboot ? 0 : (laneData?.yield ?? 1),
            };
            // Assign SKU: use lane's active product, or fall back to UNKNOWN-BUBBLEWRAP
            // so that production counts are never silently dropped from the stock ledger.
            const resolvedSku = (laneData?.sku && laneData.sku !== 'UNKNOWN')
                ? laneData.sku
                : 'UNKNOWN-BUBBLEWRAP';
            row.product_sku = resolvedSku;
            return row;
        });

        console.log(`Inserting ${insertRows.length} log(s):`, JSON.stringify(insertRows));

        const { error: v1Error } = await supabase.from('production_logs').insert(insertRows);
        if (v1Error) {
            console.error('V1 Insert Error:', v1Error);
            throw v1Error;
        }

        return res.status(200).json({
            status: 'ok',
            message: `Logged ${insertRows.length} lane(s)`,
            lanes: insertRows.map((r: any) => ({ lane: r.lane_id, sku: r.product_sku || 'none', count: r.alarm_count })),
        });

    } catch (e: any) {
        console.error('Alarm Log Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to log alarm' });
    }
}
