import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_STAFF_ROLES = ['Admin', 'SuperAdmin', 'Manager', 'LogisticsCoordinator', 'HR'] as const;

export function getServiceRoleClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error(
            'Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or VITE_SUPABASE_URL) on Vercel / in .env'
        );
    }
    return createClient(url, key);
}

export type StaffAuthResult =
    | { ok: true; caller: User; admin: SupabaseClient }
    | { ok: false; status: number; message: string };

export async function requireStaffAuth(
    req: VercelRequest,
    allowedRoles: readonly string[] = DEFAULT_STAFF_ROLES
): Promise<StaffAuthResult> {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
        return { ok: false, status: 401, message: 'Unauthorized: No token provided' };
    }

    let admin: SupabaseClient;
    try {
        admin = getServiceRoleClient();
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Server misconfigured';
        return { ok: false, status: 500, message };
    }

    const { data: { user: caller }, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller) {
        console.error('[requireStaffAuth] admin.auth.getUser failed:', authError?.message || 'No user associated with token');
        const reason = authError?.message ? ` (${authError.message})` : '';
        return { ok: false, status: 401, message: `Unauthorized: Invalid or expired token${reason}` };
    }

    let callerRole: string | null = null;
    const { data: publicProfile } = await admin
        .from('users_public')
        .select('role, email')
        .eq('id', caller.id)
        .maybeSingle();

    if (publicProfile?.role) {
        callerRole = publicProfile.role;
    } else {
        const { data: sysProfile } = await admin
            .from('sys_users_v2')
            .select('role, email')
            .eq('auth_user_id', caller.id)
            .maybeSingle();
        if (sysProfile?.role) callerRole = sysProfile.role;
    }

    if (!callerRole || !allowedRoles.includes(callerRole)) {
        return { ok: false, status: 403, message: 'Forbidden: HR/Admin access required' };
    }

    return { ok: true, caller, admin };
}

export function sendAuthError(res: VercelResponse, result: Extract<StaffAuthResult, { ok: false }>): void {
    res.status(result.status).json({ error: result.message });
}
