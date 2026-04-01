import { supabase } from '../services/supabase';
import { User } from '../types';

/**
 * Logs a user's action to the database.
 * @param user The user performing the action
 * @param action A short string describing the action (e.g., 'PAGE_VIEW', 'FORM_SUBMITTED')
 * @param details An object containing extra context (e.g., { page: 'Dashboard', id: 123 })
 */
export const logActivity = async (user: User | null | undefined, action: string, details?: Record<string, any>) => {
    if (!user) {
        // Can't reliably log if user isn't authenticated or passed in
        return;
    }

    try {
        const { error } = await supabase.from('user_activity_logs').insert([{
            user_id: user.uid,
            email: user.email,
            name: user.name,
            role: user.role,
            action: action,
            details: details || {}
        }]);

        if (error) {
            console.warn('[Logger] Failed to insert activity log:', error.message);
        }
    } catch (e) {
        console.warn('[Logger] Exception during activity logging:', e);
    }
};
