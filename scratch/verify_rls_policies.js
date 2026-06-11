import pg from 'pg';
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to DB.");

        // 1. Fetch some user IDs from users_public for testing
        const { rows: users } = await client.query(`
            SELECT id, email, role, name 
            FROM public.users_public 
            WHERE role IN ('SuperAdmin', 'HR', 'Admin', 'Manager', 'Driver')
            ORDER BY role;
        `);

        const superAdmin = users.find(u => u.role === 'SuperAdmin');
        const hr = users.find(u => u.role === 'HR');
        const admin = users.find(u => u.role === 'Admin');
        const manager = users.find(u => u.role === 'Manager');
        const driver = users.find(u => u.role === 'Driver');

        console.log("Test Users Found:");
        console.log("- SuperAdmin:", superAdmin?.email, `(${superAdmin?.id})`);
        console.log("- HR:", hr?.email, `(${hr?.id})`);
        console.log("- Admin:", admin?.email, `(${admin?.id})`);
        console.log("- Manager:", manager?.email, `(${manager?.id})`);
        console.log("- Driver:", driver?.email, `(${driver?.id})`);

        // Test function
        async function testRLS(user, tableName) {
            if (!user) {
                console.log(`Skipping test for undefined user`);
                return;
            }

            try {
                // We use a transaction so SET ROLE and set_config are local to it
                await client.query('BEGIN');
                
                // Impersonate the authenticated role and set request.jwt.claims sub
                await client.query(`SET LOCAL ROLE authenticated`);
                await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
                    JSON.stringify({ sub: user.id })
                ]);

                // Try to select
                const { rows } = await client.query(`SELECT id, employee_id FROM public.${tableName} LIMIT 5`);
                console.log(`  ✅ ${user.role} (${user.email}) CAN read ${tableName}. Found ${rows.length} rows.`);

                // Try to count total rows in database to see if they see everything or only their own
                const countRes = await client.query(`SELECT COUNT(*) FROM public.${tableName}`);
                console.log(`  Counted: ${countRes.rows[0].count} rows.`);

            } catch (err) {
                console.log(`  ❌ ${user.role} (${user.email}) CANNOT read ${tableName}. Error: ${err.message}`);
            } finally {
                await client.query('ROLLBACK');
            }
        }

        console.log("\n=== Testing payroll_records ===");
        await testRLS(superAdmin, 'payroll_records');
        await testRLS(hr, 'payroll_records');
        await testRLS(admin, 'payroll_records');
        await testRLS(manager, 'payroll_records');
        await testRLS(driver, 'payroll_records');

        console.log("\n=== Testing salary_advances ===");
        await testRLS(superAdmin, 'salary_advances');
        await testRLS(hr, 'salary_advances');
        await testRLS(admin, 'salary_advances');
        await testRLS(manager, 'salary_advances');
        await testRLS(driver, 'salary_advances');

    } catch (e) {
        console.error("Connection error:", e);
    } finally {
        await client.end();
    }
}

run();
