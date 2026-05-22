import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyAdminCors } from './lib/cors';
import { requireStaffAuth, sendAuthError } from './lib/admin-auth';
import { normalizeFourDigitPin, pinToAuthPassword } from './lib/pin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyAdminCors(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const auth = await requireStaffAuth(req);
        if (!auth.ok) {
            sendAuthError(res, auth);
            return;
        }

        const { admin } = auth;
        const { action, email, password, name, role, targetAuthId, employeeId, pin } = req.body ?? {};

        if (action === 'create') {
            if (!email || !password) {
                return res.status(400).json({ error: 'Missing email or password' });
            }

            let authPassword = String(password);
            const pinFromBody = normalizeFourDigitPin(String(pin || employeeId || ''));
            if (pinFromBody) {
                try {
                    authPassword = pinToAuthPassword(pinFromBody);
                } catch {
                    /* use password from client as-is */
                }
            }

            const { data: authData, error: createError } = await admin.auth.admin.createUser({
                email: String(email).trim(),
                password: authPassword,
                email_confirm: true,
                user_metadata: {
                    name: name || '',
                    role: role || '',
                    employee_id: pinFromBody || employeeId || '',
                },
            });

            if (createError) {
                const msg = createError.message || 'Failed to create auth user';
                if (/already|registered|exists/i.test(msg)) {
                    return res.status(409).json({ error: msg });
                }
                return res.status(400).json({ error: msg });
            }

            const uid = authData.user?.id;
            if (!uid) {
                return res.status(500).json({ error: 'Auth user created but id missing' });
            }

            const profileRole = role || 'Operator';
            const { error: profileError } = await admin.from('users_public').upsert({
                id: uid,
                email: String(email).trim(),
                name: name || '',
                role: profileRole,
                employee_id: pinFromBody || employeeId || null,
                status: 'Active',
            });

            if (profileError) {
                console.error('users_public upsert:', profileError);
                return res.status(500).json({
                    error: `Auth user created but profile sync failed: ${profileError.message}`,
                });
            }

            return res.status(200).json({ success: true, user: authData.user });
        }

        if (action === 'update_password') {
            if (!targetAuthId || !password) {
                return res.status(400).json({ error: 'Missing target user or password' });
            }

            let authPassword = String(password);
            const pinFromBody = normalizeFourDigitPin(String(pin || ''));
            if (pinFromBody) {
                try {
                    authPassword = pinToAuthPassword(pinFromBody);
                } catch {
                    /* keep client password */
                }
            }

            const { error: pwdErr } = await admin.auth.admin.updateUserById(String(targetAuthId), {
                password: authPassword,
            });

            if (pwdErr) {
                return res.status(400).json({ error: pwdErr.message || 'Password update failed' });
            }
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal Server Error';
        console.error('Manage Employee Error:', e);
        if (!res.headersSent) {
            return res.status(500).json({ error: message });
        }
    }
}
