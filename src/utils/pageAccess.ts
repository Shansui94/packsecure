import type { UserRole } from '../types';

/** Always reachable when authenticated */
export const ESSENTIAL_PAGE_IDS = ['profile', 'login', 'construction', 'dashboard', 'raw_material_mobile'] as const;

export function mergeAllowedPages(
    role: UserRole,
    hardcodedForRole: string[],
    dbAllowedPages: Set<string> | null,
    roleModules?: string[]
): string[] {
    if (role === 'SuperAdmin') return ['*'];

    const modules = roleModules ?? [];
    if (dbAllowedPages && dbAllowedPages.size > 0) {
        return [...new Set([...ESSENTIAL_PAGE_IDS, ...dbAllowedPages, ...modules])];
    }
    return [...new Set([...hardcodedForRole, ...modules, ...ESSENTIAL_PAGE_IDS])];
}

export function canAccessPage(
    pageId: string,
    opts: {
        userRole?: string;
        navRoles?: string[];
        dbAllowedPages: Set<string> | null;
        roleModules?: string[];
        isSuperAdmin?: boolean;
    }
): boolean {
    if (opts.isSuperAdmin) return true;

    const { userRole, navRoles, dbAllowedPages, roleModules } = opts;

    if (dbAllowedPages && dbAllowedPages.size > 0) {
        return (
            dbAllowedPages.has(pageId) ||
            (roleModules?.includes(pageId) ?? false) ||
            (ESSENTIAL_PAGE_IDS as readonly string[]).includes(pageId)
        );
    }

    const hasHardcoded = Boolean(userRole && navRoles?.includes(userRole));
    return hasHardcoded || (roleModules?.includes(pageId) ?? false);
}
