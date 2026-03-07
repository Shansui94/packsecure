import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8")!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

    const { mac } = req.query;

    if (!mac) {
        return res.status(400).json({ error: 'MAC address is required' });
    }

    try {
        // 1. 查询设备基础配置
        const { data: device, error: deviceError } = await supabase
            .from('iot_device_configs')
            .select('*')
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
        const machineWidthMap: Record<string, number> = {
            'N1-M01': 100,
            'N2-M02': 100,
            'T1.3-M02': 100,
            'T1.2-M01': 200,   // 2M double-layer machine → always yields 2x per signal
            'T1.1-M03': 0
        };

        const machineId = device.machine_id;
        const baseWidth = machineWidthMap[machineId] || 100;

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
