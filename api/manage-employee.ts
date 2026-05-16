import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyAdminCors } from './lib/cors';
import { requireStaffAuth, sendAuthError } from './lib/admin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyAdminCors(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const auth = await requireStaffAuth(req);
    if (!auth.ok) {
        sendAuthError(res, auth);
        return;
    }

    const { admin } = auth;

    try {
        const { action, email, password, name, role, targetAuthId } = req.body;

        if (action === 'create') {
            if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

            const { data: authData, error: createError } = await admin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { name: name || '', role: role || '' },
            });

            if (createError) throw createError;
            return res.status(200).json({ success: true, user: authData.user });
        }

        if (action === 'update_password') {
            if (!targetAuthId || !password) {
                return res.status(400).json({ error: 'Missing target user or password' });
            }

            const { error: pwdErr } = await admin.auth.admin.updateUserById(targetAuthId, {
                password,
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
