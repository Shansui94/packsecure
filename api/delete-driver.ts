import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !caller) return res.status(401).json({ error: 'Unauthorized' });

        const { data: callerProfile } = await supabaseAdmin
            .from('users_public').select('role').eq('id', caller.id).single();

        const allowedRoles = ['Admin', 'SuperAdmin', 'Manager'];
        const isVivian = caller.email === 'diyadmin1111@gmail.com';
        if (!callerProfile || (!allowedRoles.includes(callerProfile.role) && !isVivian)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { uid } = req.body;
        if (!uid) return res.status(400).json({ error: 'Missing uid' });

        // Use database-level RPC to handle all FK cleanup + auth.users deletion
        const { error: rpcError } = await supabaseAdmin.rpc('delete_driver_user', { target_uid: uid });
        if (rpcError) throw rpcError;

        return res.status(200).json({ success: true });
    } catch (e: any) {
        console.error('Delete Driver Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to delete driver' });
    }
}
