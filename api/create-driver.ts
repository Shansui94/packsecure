import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client with service role (server-side only)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        // 1. Verify caller is authenticated & authorized
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !caller) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // 2. Check caller's role (must be Admin, Manager or Vivian's special account)
        const { data: callerProfile } = await supabaseAdmin
            .from('users_public')
            .select('role, email')
            .eq('id', caller.id)
            .single();

        const allowedRoles = ['Admin', 'SuperAdmin', 'Manager'];
        const isVivian = caller.email === 'diyadmin1111@gmail.com';

        if (!callerProfile || (!allowedRoles.includes(callerProfile.role) && !isVivian)) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to create drivers' });
        }

        // 3. Parse body
        const { name, employeeId, password } = req.body;

        if (!name || !employeeId) {
            return res.status(400).json({ error: 'Missing required fields: name, employeeId' });
        }

        const cleanName = name.toLowerCase().replace(/\s/g, '');
        const email = `${cleanName}.${employeeId}@packsecure.com`;
        const finalPassword = password || Math.floor(100000 + Math.random() * 900000).toString();

        // 4. Create auth user
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: finalPassword,
            email_confirm: true,
            user_metadata: {
                full_name: name,
                employee_id: employeeId
            }
        });

        if (createError) {
            // If user already exists, return a helpful message
            if (createError.message.includes('already been registered')) {
                return res.status(409).json({ error: `Driver with ID ${employeeId} already exists (email: ${email})` });
            }
            throw createError;
        }

        const uid = authData.user.id;

        // 5. Upsert public profile
        const { error: profileError } = await supabaseAdmin.from('users_public').upsert({
            id: uid,
            email,
            name,
            employee_id: employeeId,
            role: 'Driver',
            status: 'Active'
        });

        if (profileError) throw profileError;

        return res.status(200).json({
            success: true,
            driver: {
                uid,
                name,
                email,
                employeeId,
                password: finalPassword,
                role: 'Driver'
            }
        });

    } catch (e: any) {
        console.error('Create Driver Error:', e);
        return res.status(500).json({ error: e.message || 'Failed to create driver' });
    }
}
