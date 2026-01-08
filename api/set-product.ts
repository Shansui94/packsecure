import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { machine_id, product_sku } = req.body;
        if (!machine_id || !product_sku) return res.status(400).json({ error: 'Missing params' });

        const { error } = await supabase.from('machine_active_products').upsert({
            machine_id,
            product_sku,
            updated_at: new Date()
        });

        if (error) throw error;
        res.json({ status: 'ok', active_sku: product_sku });

    } catch (e: any) {
        console.error("Set Product Error", e);
        res.status(500).json({ error: e.message });
    }
}
