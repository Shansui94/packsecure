import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Admin client with service role (server-side only)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { action, email, password, name, role, targetAuthId } = req.body;

        if (action === 'create') {
            if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
            
            const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { name: name || '', role: role || '' }
            });

            if (createError) throw createError;
            return res.status(200).json({ success: true, user: authData.user });
        } 
        
        else if (action === 'update_password') {
            if (!targetAuthId || !password) return res.status(400).json({ error: 'Missing target user or password' });
            
            const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(targetAuthId, {
                password: password
            });

            if (pwdErr) throw pwdErr;
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (e: any) {
        console.error('Manage Employee Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to manage auth user' });
    }
}
