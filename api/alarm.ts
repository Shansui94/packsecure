import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Machine Layout Config ────────────────────────────────────────────────────
const MACHINE_LANES: Record<string, string[]> = {
    'T1.2-M01': ['Lane1', 'Lane2'],
    'T2-M01': ['Lane1', 'Lane2'],
    'N1-M01': ['Single'],
    'N2-M02': ['Single'],
    'T1.3-M02': ['Single'],
    'T3-M02': ['Single'],
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

        // Resolve operator_id values to sys_users_v2.id (primary key)
        // operator_id from frontend might be auth_user_id (which fails the FK on production_logs_v2.operator_id)
        const opIds = Array.from(
            new Set(
                (activeProducts || [])
                    .map((p: any) => p.operator_id)
                    .filter((id): id is string => !!id)
            )
        );

        const opIdMap: Record<string, string> = {};
        if (opIds.length > 0) {
            const idList = opIds.map(id => `"${id}"`).join(',');
            const { data: resolvedOps } = await supabase
                .from('sys_users_v2')
                .select('id, auth_user_id')
                .or(`id.in.(${idList}),auth_user_id.in.(${idList})`);

            if (resolvedOps) {
                resolvedOps.forEach((op: any) => {
                    if (op.id) {
                        opIdMap[op.id] = op.id;
                    }
                    if (op.auth_user_id) {
                        opIdMap[op.auth_user_id] = op.id;
                    }
                });
            }
        }

        const isReboot = (alarm_count === 0);
        
        // --- 1. NATIVE V2 INSERTION ---
        const insertRowsV2 = lanes.map((laneId: string) => {
            const laneData = activeLaneMap[laneId] ?? activeLaneMap['Single'] ?? null;
            const resolvedSku = (laneData?.sku && laneData.sku !== 'UNKNOWN') ? laneData.sku : 'UNKNOWN-BUBBLEWRAP';
            
            const rawOpId = laneData?.operator_id;
            const resolvedOpId = rawOpId ? (opIdMap[rawOpId] || null) : null;

            return {
                machine_id,
                output_qty: isReboot ? 0 : (laneData?.yield ?? 1),
                sku: resolvedSku,
                operator_id: resolvedOpId,
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
