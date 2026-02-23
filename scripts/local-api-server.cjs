// Local development API server
// Runs on port 8080, proxied by Vite from localhost:5173/api/*
// Usage: node scripts/local-api-server.cjs

const http = require('http');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch (e) { resolve({}); }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = req.url;

    // ---- GET /api/machines ----
    if (url === '/api/machines' && req.method === 'GET') {
        try {
            const [machineRes, iotRes] = await Promise.all([
                supabaseAdmin.from('sys_machines_v2').select('*').order('machine_id'),
                supabaseAdmin.from('iot_device_configs').select('machine_id, last_heartbeat')
            ]);

            if (machineRes.error) throw machineRes.error;

            const iotMap = {};
            if (iotRes.data) {
                iotRes.data.forEach(i => { if (i.machine_id) iotMap[i.machine_id] = i.last_heartbeat; });
            }

            const result = (machineRes.data || []).map(m => ({
                ...m,
                last_heartbeat: iotMap[m.machine_id] || null
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(result));
        } catch (e) {
            console.error('Machines API Error:', e);
            res.writeHead(500);
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ---- POST /api/create-driver ----
    if (url === '/api/create-driver' && req.method === 'POST') {
        try {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.replace('Bearer ', '');

            if (!token) {
                res.writeHead(401);
                return res.end(JSON.stringify({ error: 'Unauthorized: No token' }));
            }

            // Verify caller
            const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !caller) {
                res.writeHead(401);
                return res.end(JSON.stringify({ error: 'Unauthorized: Invalid token' }));
            }

            // Check role
            const { data: callerProfile } = await supabaseAdmin
                .from('users_public')
                .select('role, email')
                .eq('id', caller.id)
                .single();

            const allowedRoles = ['Admin', 'SuperAdmin', 'Manager'];
            const isVivian = caller.email === 'diyadmin1111@gmail.com';

            if (!callerProfile || (!allowedRoles.includes(callerProfile.role) && !isVivian)) {
                res.writeHead(403);
                return res.end(JSON.stringify({ error: 'Forbidden: No permission' }));
            }

            const { name, employeeId, password } = await parseBody(req);

            if (!name || !employeeId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: 'Missing name or employeeId' }));
            }

            const cleanName = name.toLowerCase().replace(/\s/g, '');
            const email = `${cleanName}.${employeeId}@packsecure.com`;
            const finalPassword = password || Math.floor(100000 + Math.random() * 900000).toString();

            const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: finalPassword,
                email_confirm: true,
                user_metadata: { full_name: name, employee_id: employeeId }
            });

            if (createError) {
                if (createError.message.includes('already been registered')) {
                    res.writeHead(409);
                    return res.end(JSON.stringify({ error: `Driver ID ${employeeId} already exists (${email})` }));
                }
                throw createError;
            }

            const uid = authData.user.id;

            const { error: profileError } = await supabaseAdmin.from('users_public').upsert({
                id: uid, email, name, employee_id: employeeId, role: 'Driver', status: 'Active'
            });

            if (profileError) throw profileError;

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                driver: { uid, name, email, employeeId, password: finalPassword, role: 'Driver' }
            }));

        } catch (e) {
            console.error('Create Driver Error:', e);
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message || 'Internal Server Error' }));
        }
        return;
    }

    // ---- POST /api/delete-driver ----
    if (url === '/api/delete-driver' && req.method === 'POST') {
        try {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.replace('Bearer ', '');
            if (!token) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }

            const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !caller) { res.writeHead(401); return res.end(JSON.stringify({ error: 'Unauthorized' })); }

            const { data: callerProfile } = await supabaseAdmin
                .from('users_public').select('role').eq('id', caller.id).single();

            const allowedRoles = ['Admin', 'SuperAdmin', 'Manager'];
            const isVivian = caller.email === 'diyadmin1111@gmail.com';
            if (!callerProfile || (!allowedRoles.includes(callerProfile.role) && !isVivian)) {
                res.writeHead(403); return res.end(JSON.stringify({ error: 'Forbidden' }));
            }

            const { uid } = await parseBody(req);
            if (!uid) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Missing uid' })); }

            // Use database-level RPC to handle all FK cleanup + auth.users deletion
            const { error: rpcError } = await supabaseAdmin.rpc('delete_driver_user', { target_uid: uid });
            if (rpcError) throw rpcError;

            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            console.error('Delete Driver Error:', e);
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message || 'Internal Server Error' }));
        }
        return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(8080, () => {
    console.log('🚀 Local API Server running at http://localhost:8080');
    console.log('   Handles: POST /api/create-driver');
    console.log('   Proxied via Vite at http://localhost:5173/api/*');
});
