import { supabase } from '../services/supabase';
import { User } from '../types';

export type ActivityStatus = 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';

export interface ActivityLogPayload {
    action: string;
    module?: string;
    target?: string;
    status?: ActivityStatus;
    resultSummary?: string;
    changes?: { before?: any; after?: any };
    location?: string;
    details?: Record<string, any>;
}

// Sensitive field keys to automatically mask
const SENSITIVE_KEYS = new RegExp(
    '^(password|pin|pincode|icno|salary|token|secret|bankaccountno|bankaccount|auth_token|authorization)$',
    'i'
);

/**
 * Recursively masks sensitive fields inside details objects
 */
function maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => maskSensitiveData(item));
    }

    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_KEYS.test(key)) {
            masked[key] = '***';
        } else if (typeof value === 'object' && value !== null) {
            masked[key] = maskSensitiveData(value);
        } else {
            masked[key] = value;
        }
    }
    return masked;
}

/**
 * Detect client device context
 */
function getDeviceContext(): { type: 'Mobile' | 'Tablet' | 'Desktop'; screen: string; userAgent: string } {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return { type: 'Desktop', screen: 'unknown', userAgent: 'unknown' };
    }

    const ua = navigator.userAgent || '';
    const width = window.innerWidth || (typeof screen !== 'undefined' ? screen.width : 0) || 0;
    const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTablet = /iPad|Tablet/i.test(ua) || (isMobile && width >= 768);

    const type: 'Mobile' | 'Tablet' | 'Desktop' = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
    const screenRes = `${window.innerWidth || 0}x${window.innerHeight || 0}`;

    return { type, screen: screenRes, userAgent: ua };
}

// Debounce state for PAGE_VIEW events (1000ms window per page)
const recentPageViews: Map<string, number> = new Map();

/**
 * Logs a user's action to the database with full 5W1H metadata.
 * Supports both structured payload and legacy (user, action, details) arguments.
 * 
 * @param user The user performing the action
 * @param actionOrPayload Either action string (e.g. 'PAGE_VIEW') or full ActivityLogPayload
 * @param legacyDetails Optional details object when using legacy string action
 */
export const logActivity = async (
    user: User | null | undefined,
    actionOrPayload: string | ActivityLogPayload,
    legacyDetails?: Record<string, any>
): Promise<void> => {
    if (!user) {
        // Can't reliably log if user isn't authenticated or passed in
        return;
    }

    try {
        let action: string;
        let moduleName: string | undefined;
        let target: string | undefined;
        let status: ActivityStatus = 'SUCCESS';
        let resultSummary: string | undefined;
        let changes: { before?: any; after?: any } | undefined;
        let location: string | undefined;
        let extraDetails: Record<string, any> = {};

        if (typeof actionOrPayload === 'string') {
            action = actionOrPayload;
            extraDetails = legacyDetails ? { ...legacyDetails } : {};
            moduleName = extraDetails.module || extraDetails.page;
            target = extraDetails.target;
            status = extraDetails.status || (action.includes('ERROR') || action.includes('FAIL') ? 'FAILED' : 'SUCCESS');
            resultSummary = extraDetails.resultSummary || extraDetails.result_summary;
            changes = extraDetails.changes;
            location = extraDetails.location;
        } else {
            action = actionOrPayload.action;
            moduleName = actionOrPayload.module;
            target = actionOrPayload.target;
            status = actionOrPayload.status || (action.includes('ERROR') || action.includes('FAIL') ? 'FAILED' : 'SUCCESS');
            resultSummary = actionOrPayload.resultSummary;
            changes = actionOrPayload.changes;
            location = actionOrPayload.location;
            extraDetails = actionOrPayload.details ? { ...actionOrPayload.details } : {};
        }

        // Deduplicate rapid PAGE_VIEW events (debounce within 1000ms)
        if (action === 'PAGE_VIEW') {
            const pageKey = `${user.uid || user.email}_${extraDetails.page || moduleName || 'unknown'}`;
            const now = Date.now();
            const lastLogTime = recentPageViews.get(pageKey) || 0;
            if (now - lastLogTime < 1000) {
                // Skip duplicate page view
                return;
            }
            recentPageViews.set(pageKey, now);
        }

        const device = getDeviceContext();
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        const cachedGps = typeof window !== 'undefined' 
            ? ((window as any).__CURRENT_GPS__ || sessionStorage.getItem('last_known_gps') || (user.gps && user.gps !== 'Unknown' ? user.gps : null))
            : null;

        // Build structured details payload with 5W1H metadata
        const fullDetails: Record<string, any> = {
            ...extraDetails,
            module: moduleName || extraDetails.page || currentPath || 'System',
            target: target || extraDetails.target || null,
            status: status,
            result_summary: resultSummary || extraDetails.result_summary || null,
            changes: changes || null,
            location: location || user.factoryId || user.base_location || null,
            factory_id: user.factoryId || null,
            gps: extraDetails.gps || cachedGps || null,
            device: {
                type: device.type,
                screen: device.screen
            }
        };

        // Mask any sensitive fields
        const safeDetails = maskSensitiveData(fullDetails);

        // Asynchronous fire-and-forget insert
        supabase.from('user_activity_logs').insert([{
            user_id: user.uid,
            email: user.email,
            name: user.name || user.email?.split('@')[0] || 'Unknown User',
            role: user.role,
            action: action,
            details: safeDetails
        }]).then(({ error }) => {
            if (error) {
                console.warn('[Logger] Failed to insert activity log:', error.message);
            }
        }).catch((err) => {
            console.warn('[Logger] Exception during activity logging:', err);
        });

    } catch (e) {
        console.warn('[Logger] Exception building activity log:', e);
    }
};
