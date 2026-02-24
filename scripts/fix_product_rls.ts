import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SERVICE_ROLE_KEY!
);

async function fixRLS() {
    console.log('🔧 修复 Product Library 相关表的 RLS 策略...\n');

    const tables = ['master_items_v2', 'bom_headers_v2', 'bom_items_v2', 'v2_inventory_view'];

    for (const table of tables) {
        // Test if authenticated user can read
        const testClient = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.VITE_SUPABASE_ANON_KEY!
        );

        const { data, error } = await testClient.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ ${table}: ${error.message}`);
        } else {
            console.log(`✅ ${table}: 可读取 (${data?.length ?? 0} rows)`);
        }
    }

    // Apply RLS fixes via SQL
    console.log('\n📋 执行 RLS 修复 SQL...\n');

    const sqls = [
        // master_items_v2
        `ALTER TABLE master_items_v2 ENABLE ROW LEVEL SECURITY;`,
        `DROP POLICY IF EXISTS "authenticated_read_master_items_v2" ON master_items_v2;`,
        `CREATE POLICY "authenticated_read_master_items_v2" ON master_items_v2 FOR SELECT TO authenticated USING (true);`,
        `DROP POLICY IF EXISTS "authenticated_write_master_items_v2" ON master_items_v2;`,
        `CREATE POLICY "authenticated_write_master_items_v2" ON master_items_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);`,

        // bom_headers_v2
        `ALTER TABLE bom_headers_v2 ENABLE ROW LEVEL SECURITY;`,
        `DROP POLICY IF EXISTS "authenticated_read_bom_headers" ON bom_headers_v2;`,
        `CREATE POLICY "authenticated_read_bom_headers" ON bom_headers_v2 FOR SELECT TO authenticated USING (true);`,

        // bom_items_v2
        `ALTER TABLE bom_items_v2 ENABLE ROW LEVEL SECURITY;`,
        `DROP POLICY IF EXISTS "authenticated_read_bom_items" ON bom_items_v2;`,
        `CREATE POLICY "authenticated_read_bom_items" ON bom_items_v2 FOR SELECT TO authenticated USING (true);`,
    ];

    for (const sql of sqls) {
        const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: { message: 'rpc not available' } }));
        if (error) {
            // Try direct query approach
            console.log(`  ⚠️  RPC 不可用，请在 Supabase SQL Editor 手动执行：`);
            break;
        }
    }

    console.log('\n📋 请在 Supabase SQL Editor 执行以下 SQL：');
    console.log('链接：https://supabase.com/dashboard/project/kdahubyhwndgyloaljak/sql/new\n');
    console.log('-- ===== Product Library RLS Fix =====');
    for (const sql of sqls) {
        console.log(sql);
    }
}

fixRLS().catch(console.error);
