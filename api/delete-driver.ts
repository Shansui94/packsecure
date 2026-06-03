import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyAdminCors } from './lib/cors.js';
import { getServiceRoleClient, requireStaffAuth, sendAuthError } from './lib/admin-auth.js';

const DRIVER_MANAGER_ROLES = ['Admin', 'SuperAdmin', 'Manager'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyAdminCors(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const auth = await requireStaffAuth(req, DRIVER_MANAGER_ROLES);
    if (!auth.ok) {
        sendAuthError(res, auth);
        return;
    }

    try {
        const supabaseAdmin = getServiceRoleClient();
        const { uid } = req.body;
        if (!uid) return res.status(400).json({ error: 'Missing uid' });

        const { error: rpcError } = await supabaseAdmin.rpc('delete_driver_user', { target_uid: uid });
        if (rpcError) throw rpcError;

        return res.status(200).json({ success: true });
    } catch (e: any) {
        console.error('Delete Driver Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to delete driver' });
    }
}
