import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyAdminCors } from './lib/cors.js';
import { getServiceRoleClient, requireStaffAuth, sendAuthError } from './lib/admin-auth.js';
import { normalizeFourDigitPin, pinToAuthPassword } from './lib/pin-auth.js';

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
        const { name, employeeId } = req.body;

        if (!name || !employeeId) {
            return res.status(400).json({ error: 'Missing required fields: name, employeeId' });
        }

        const pin = normalizeFourDigitPin(String(employeeId));
        if (!pin) {
            return res.status(400).json({ error: 'Employee ID must be exactly 4 digits (used as login PIN)' });
        }

        const cleanName = name.toLowerCase().replace(/\s/g, '');
        const email = `${cleanName}.${pin}@packsecure.com`;
        const authPassword = pinToAuthPassword(pin);

        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: authPassword,
            email_confirm: true,
            user_metadata: {
                full_name: name,
                employee_id: pin,
            },
        });

        if (createError) {
            if (createError.message.includes('already been registered')) {
                return res.status(409).json({
                    error: `Driver with ID ${pin} already exists (email: ${email})`,
                });
            }
            throw createError;
        }

        const uid = authData.user.id;

        const { error: profileError } = await supabaseAdmin.from('users_public').upsert({
            id: uid,
            email,
            name,
            employee_id: pin,
            role: 'Driver',
            status: 'Active',
        });

        if (profileError) throw profileError;

        const { error: v2Error } = await supabaseAdmin.from('sys_users_v2').upsert(
            {
                auth_user_id: uid,
                employee_id: pin,
                pin_code: pin,
                name,
                email,
                role: 'Driver',
                status: 'active',
                pay_type: 'driver',
            },
            { onConflict: 'auth_user_id' }
        );

        if (v2Error) {
            console.warn('sys_users_v2 upsert for driver:', v2Error.message);
        }

        return res.status(200).json({
            success: true,
            driver: {
                uid,
                name,
                email,
                employeeId: pin,
                role: 'Driver',
                pin,
            },
        });
    } catch (e: any) {
        console.error('Create Driver Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to create driver' });
    }
}
