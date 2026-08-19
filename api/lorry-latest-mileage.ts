import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const lorryId = (req.query.lorry_id || req.body?.lorry_id) as string;
        if (!lorryId) {
            return res.status(400).json({ error: 'lorry_id is required' });
        }

        const { data, error } = await supabase
            .from('lorry_mileage_logs')
            .select('id, mileage, created_at, log_type, driver_id')
            .eq('lorry_id', lorryId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        return res.status(200).json({
            success: true,
            data: data || null,
            mileage: data?.mileage ?? null
        });
    } catch (error: any) {
        console.error('Error fetching latest lorry mileage:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
