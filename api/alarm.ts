import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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
        // Initialize Supabase INSIDE handler to catch errors
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error(`Missing Supabase Env Vars: URL=${!!supabaseUrl}, KEY=${!!supabaseKey}`);
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { machine_id, alarm_count } = req.body;

        if (!machine_id) {
            return res.status(400).json({ error: 'machine_id is required' });
        }

        console.log(`[Cloud] Received alarm from ${machine_id}, count: ${alarm_count || 1}`);

        // Resolve Active Product
        let productSku = 'UNKNOWN'; // Default
        const { data: activeProduct, error: fetchError } = await supabase
            .from('machine_active_products')
            .select('product_sku')
            .eq('machine_id', machine_id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "Row not found"
            console.error("Fetch Product Error:", fetchError);
        }

        if (activeProduct) {
            productSku = activeProduct.product_sku;
        }

        console.log(`[Cloud ALARM] Machine: ${machine_id}, ActiveSKU: ${productSku}, Count: 2`);

        // Always use 2 for Dual Lane logic
        const { error: insertError } = await supabase.from('production_logs').insert({
            machine_id,
            alarm_count: 2, // Hardcoded per user request
            product_sku: productSku
        });

        if (insertError) throw insertError;

        res.status(200).json({ status: 'ok', message: 'Logged successfully (Cloud)', product: productSku });

    } catch (e: any) {
        console.error("Cloud Alarm Log Error:", e);
        // RETURN ERROR IN JSON so we see it
        res.status(500).json({
            error: e.message || "Failed to log alarm",
            stack: e.stack,
            env_check: {
                has_url: !!process.env.VITE_SUPABASE_URL,
                has_key: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)
            }
        });
    }
}
