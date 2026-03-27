import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Machine Layout Config ────────────────────────────────────────────────────
const MACHINE_LANES: Record<string, string[]> = {
    'T1.2-M01': ['Lane1', 'Lane2'],  // 200cm → 2 fixed lanes
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
        console.log(`[V2] Alarm from ${machine_id} | alarm_count=${alarm_count} | lanes=${lanes.join(',')}`);

        // Fetch all active products for this machine (from master)
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

        // Build one log insert per lane explicitly mapping to V2 Columns.
        const isReboot = (alarm_count === 0);
        const insertRows = lanes.map((laneId: string) => {
            const laneData = activeLaneMap[laneId] ?? activeLaneMap['Single'] ?? null;
            
            // V2 uses `output_qty` and `sku`
            const row: any = {
                machine_id,
                output_qty: isReboot ? 0 : (laneData?.yield ?? 1),
            };

            const resolvedSku = (laneData?.sku && laneData.sku !== 'UNKNOWN')
                ? laneData.sku
                : 'UNKNOWN-BUBBLEWRAP';
            row.sku = resolvedSku;

            return row;
        });

        console.log(`[V2] Inserting ${insertRows.length} log(s):`, JSON.stringify(insertRows));

        const { error: v2Error } = await supabase.from('production_logs_v2').insert(insertRows);
        if (v2Error) {
            console.error('[V2] Insert Error:', v2Error);
            throw v2Error;
        }

        return res.status(200).json({
            status: 'ok',
            message: `[V2] Logged ${insertRows.length} lane(s)`,
            lanes: insertRows.map((r: any) => ({ sku: r.sku || 'none', output_qty: r.output_qty })),
        });

    } catch (e: any) {
        console.error('[V2] Alarm Log Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to log alarm' });
    }
}
