import { supabase } from '../services/supabase';

// In-memory cache for resolved operator system IDs to reduce redundant DB queries
const operatorIdCache = new Map<string, string>();

/**
 * Resolves any operator identifier (operatorId, auth_user_id, employee_id, pin, name, or user object)
 * into a valid `sys_users_v2.id` UUID that satisfies the database foreign key constraint:
 * `production_logs_v2_operator_id_fkey REFERENCES sys_users_v2(id)`.
 * 
 * Returns null if no valid sys_users_v2 row can be matched (since operator_id is nullable).
 * NEVER returns invalid non-UUID strings like 'OP-AUTO' or unmapped auth_user_id.
 */
export async function resolveOperatorSysId(params: {
    operatorId?: string | null;
    employeeId?: string | null;
    operatorName?: string | null;
    user?: any;
}): Promise<string | null> {
    const { operatorId, employeeId, operatorName, user } = params;

    const cacheKey = `${operatorId || ''}|${employeeId || ''}|${user?.uid || ''}|${user?.employeeId || ''}`;
    if (cacheKey !== '|||' && operatorIdCache.has(cacheKey)) {
        return operatorIdCache.get(cacheKey)!;
    }

    try {
        const isUuid = (val: string | null | undefined): val is string =>
            typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        // 1. If operatorId is a UUID, check if it directly matches sys_users_v2.id
        if (isUuid(operatorId)) {
            const { data: byId } = await supabase
                .from('sys_users_v2')
                .select('id')
                .eq('id', operatorId)
                .maybeSingle();

            if (byId?.id) {
                operatorIdCache.set(cacheKey, byId.id);
                return byId.id;
            }

            // 2. If it's a UUID but not sys_users_v2.id, check if it matches auth_user_id
            const { data: byAuth } = await supabase
                .from('sys_users_v2')
                .select('id')
                .eq('auth_user_id', operatorId)
                .maybeSingle();

            if (byAuth?.id) {
                operatorIdCache.set(cacheKey, byAuth.id);
                return byAuth.id;
            }
        }

        // 3. Try matching by employeeId / user?.employeeId / non-UUID operatorId
        const targetEmpId = employeeId || user?.employeeId || (operatorId && !isUuid(operatorId) ? operatorId : null);
        if (targetEmpId && targetEmpId !== 'OP-AUTO' && targetEmpId !== 'unknown') {
            const { data: byEmp } = await supabase
                .from('sys_users_v2')
                .select('id')
                .eq('employee_id', targetEmpId)
                .maybeSingle();

            if (byEmp?.id) {
                operatorIdCache.set(cacheKey, byEmp.id);
                return byEmp.id;
            }
        }

        // 4. Try matching by user?.uid (Supabase Auth UID)
        if (isUuid(user?.uid)) {
            const { data: byUserAuth } = await supabase
                .from('sys_users_v2')
                .select('id')
                .eq('auth_user_id', user.uid)
                .maybeSingle();

            if (byUserAuth?.id) {
                operatorIdCache.set(cacheKey, byUserAuth.id);
                return byUserAuth.id;
            }
        }

        // 5. Try matching by operatorName / user?.name
        const targetName = operatorName || user?.name;
        if (targetName && targetName !== '当前员工' && targetName !== 'OP' && targetName !== 'Unknown Operator') {
            const { data: byName } = await supabase
                .from('sys_users_v2')
                .select('id')
                .ilike('name', targetName.trim())
                .maybeSingle();

            if (byName?.id) {
                operatorIdCache.set(cacheKey, byName.id);
                return byName.id;
            }
        }
    } catch (err) {
        console.warn('resolveOperatorSysId error:', err);
    }

    return null;
}
