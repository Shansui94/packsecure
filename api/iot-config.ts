import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8")!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handleMachines(_req: VercelRequest, res: VercelResponse) {
    try {
        const { data: machines, error: mError } = await supabase
            .from('sys_machines_v2')
            .select('*')
            .order('machine_id');

        if (mError) throw mError;

        const { data: iotConfigs, error: iError } = await supabase
            .from('iot_device_configs')
            .select('machine_id, last_heartbeat');

        if (iError) throw iError;

        const result = machines.map((m: any) => {
            const iot = iotConfigs.find((i: any) => i.machine_id === m.machine_id);
            return {
                ...m,
                last_heartbeat: iot ? iot.last_heartbeat : null
            };
        });

        return res.status(200).json(result);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

export async function handleAlarm(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { machine_id, alarm_count } = req.body || {};

        if (!machine_id) {
            return res.status(400).json({ error: 'machine_id is required' });
        }

        // Fetch machine rolls_per_alarm config
        const { data: machineInfo } = await supabase
            .from('sys_machines_v2')
            .select('rolls_per_alarm')
            .eq('machine_id', machine_id)
            .single();

        const rolls = machineInfo?.rolls_per_alarm || 1;
        const lanes = rolls > 1 ? Array.from({ length: rolls }, (_, i) => `Lane${i + 1}`) : ['Single'];

        console.log(`Alarm from ${machine_id} | alarm_count=${alarm_count} | rolls_per_alarm=${rolls} | lanes=${lanes.join(',')}`);

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
            throw v2Error;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { mac, action } = req.query;

    if (action === 'alarm' || req.body?.action === 'alarm' || (req.method === 'POST' && req.body?.machine_id && !mac)) {
        return handleAlarm(req, res);
    }

    if (action === 'machines' || (!mac && req.method === 'GET')) {
        return handleMachines(req, res);
    }

    if (!mac) {
        return res.status(400).json({ error: 'MAC address is required' });
    }

    try {
        // 1. 查询设备基础配置 (联合查询 sys_machines_v2 提取真实幅宽)
        const { data: device, error: deviceError } = await supabase
            .from('iot_device_configs')
            .select(`
                *,
                sys_machines_v2 ( base_width )
            `)
            .eq('mac_address', mac)
            .single();

        // 1.5 Update Heartbeat (New)
        if (device) {
            await supabase.from('iot_device_configs')
                .update({ last_heartbeat: new Date().toISOString() })
                .eq('mac_address', mac);
        }

        if (deviceError || !device) {
            // 2. 自动注册
            await supabase.from('iot_device_configs').upsert({
                mac_address: mac,
                notes: 'Auto-registered - Pending Assignment'
            }, { onConflict: 'mac_address' });

            return res.status(200).json({
                status: 'new_device',
                yield: 1,
                debounce: 240000,
                sku: 'UNKNOWN'
            });
        }

        // 3. 查询当前机器正在运行的产品
        const { data: activeProduct } = await supabase
            .from('machine_active_products')
            .select('*')
            .eq('machine_id', device.machine_id)
            .eq('lane_id', device.lane_id || 'Single')
            .single();

        // 4. 计算产量逻辑
        const machineId = device.machine_id;
        // 从关联查询的机器表中读取真实幅宽，默认为 100
        const baseWidth = device.sys_machines_v2?.base_width ?? 100;

        const cuttingSize = activeProduct?.cutting_size || device.cutting_size || 100;
        const activeSku = activeProduct?.product_sku || device.active_product_sku || 'UNKNOWN';

        let yieldCount = activeProduct?.yield || device.count_per_signal || 1;

        if (!activeProduct) {
            if (machineId === 'T1.1-M03') {
                yieldCount = 2;
            } else if (cuttingSize > 0) {
                yieldCount = Math.floor(baseWidth / cuttingSize);
                if (yieldCount < 1) yieldCount = 1;
            }
        }

        return res.status(200).json({
            machine_id: machineId,
            lane_id: device.lane_id,
            sku: activeSku,
            yield: yieldCount,
            debounce: device.debounce_ms,
            version: device.firmware_version,
            cutting_size: cuttingSize,
            // 远程升级配置
            latest_version: "3.3.0",
            download_url: "https://raw.githubusercontent.com/Shansui94/packsecure/main/firmware/factory_monitor/firmware.bin"
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
