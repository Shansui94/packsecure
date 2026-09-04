import { 
    MODULE_REGISTRY, 
    ESSENTIAL_PAGE_IDS, 
    getDefaultRolePermissionsMap,
    UserRole
} from '../config/modules';

export { ESSENTIAL_PAGE_IDS };

export interface PermissionContext {
    userRole?: string;
    navRoles?: string[];
    dbAllowedPages?: Set<string> | null;
    roleModules?: string[];
    isSuperAdmin?: boolean;
}

/**
 * Computes full effective permission Set for a user:
 * Effective = SuperAdmin ? [*] : (Role Baseline + User Addon role_modules + Essential Pages)
 */
export function computeEffectivePermissions(opts: {
    role?: string;
    isSuperAdmin?: boolean;
    dbRoleAllowedPages?: Set<string> | null;
    userRoleModules?: string[];
}): Set<string> {
    if (opts.isSuperAdmin || opts.role === 'SuperAdmin') {
        return new Set(['*', ...MODULE_REGISTRY.map(m => m.id), ...ESSENTIAL_PAGE_IDS]);
    }

    const permissions = new Set<string>(ESSENTIAL_PAGE_IDS);

    // 1. Role Baseline (from DB role_permissions if present, else fallback to standard defaults)
    if (opts.dbRoleAllowedPages && opts.dbRoleAllowedPages.size > 0) {
        opts.dbRoleAllowedPages.forEach(p => permissions.add(p));
    } else if (opts.role) {
        const defaultMap = getDefaultRolePermissionsMap();
        const defaultAllowed = defaultMap[opts.role];
        if (defaultAllowed) {
            defaultAllowed.forEach(p => permissions.add(p));
        }
    }

    // 2. User-specific Addon Unlocks (role_modules)
    if (opts.userRoleModules && opts.userRoleModules.length > 0) {
        opts.userRoleModules.forEach(p => permissions.add(p));
    }

    return permissions;
}

/**
 * Backward-compatible helper for App.tsx router guard
 */
export function mergeAllowedPages(
    role: UserRole | string,
    hardcodedForRole: string[],
    dbAllowedPages: Set<string> | null,
    roleModules?: string[]
): string[] {
    if (role === 'SuperAdmin') return ['*'];

    const effective = computeEffectivePermissions({
        role,
        isSuperAdmin: role === 'SuperAdmin',
        dbRoleAllowedPages: dbAllowedPages,
        userRoleModules: roleModules
    });

    if (hardcodedForRole && hardcodedForRole.length > 0) {
        hardcodedForRole.forEach(p => effective.add(p));
    }

    return Array.from(effective);
}

/**
 * Check if current user has access to a specific page or action
 * Supports both page ID (e.g. 'stock-movement') and fine-grained action format (e.g. 'stock-movement:edit')
 */
export function canAccessPage(
    pageId: string,
    opts: PermissionContext
): boolean {
    if (opts.isSuperAdmin || opts.userRole === 'SuperAdmin') return true;

    const { userRole, navRoles, dbAllowedPages, roleModules } = opts;

    // 1. Core essential pages are always accessible
    if ((ESSENTIAL_PAGE_IDS as readonly string[]).includes(pageId as any)) {
        return true;
    }

    // 2. Explicit user addon overrides take top priority
    if (roleModules && roleModules.includes(pageId)) {
        return true;
    }

    // 3. Database configured role permissions
    if (dbAllowedPages && dbAllowedPages.size > 0) {
        return dbAllowedPages.has(pageId);
    }

    // 4. Fallback to navRoles or standard default role registry
    if (userRole && navRoles && navRoles.includes(userRole)) {
        return true;
    }

    if (userRole) {
        const defaultMap = getDefaultRolePermissionsMap();
        return defaultMap[userRole]?.has(pageId) ?? false;
    }

    return false;
}

