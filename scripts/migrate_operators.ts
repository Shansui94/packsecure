import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SERVICE_ROLE_KEY!
);

const NEW_OPERATORS = [
    { employee_id: '0014', name: 'Baby' },
    { employee_id: '0015', name: 'Min Htet' },
    { employee_id: '0016', name: 'Win Ko Zaw' },
    { employee_id: '0017', name: 'Than Soe' },
    { employee_id: '0018', name: 'Zaw Zaw' },
    { employee_id: '0019', name: 'Kyaw Than' },
    { employee_id: '0020', name: 'Mg Tin Htan' },
    { employee_id: '0021', name: 'Win Soe' },
    { employee_id: '0022', name: 'Win Htay' },
    { employee_id: '0023', name: 'Thaw Thaw' },
];

async function migrate() {
    console.log('🔄 开始操作员数据迁移...\n');

    // Step 1: 删除旧操作员 (EMP-6cffe1, EMP-8a4172, EMP-3fb43f)
    // 根据之前查询: 008=EMP-8a4172, 010=EMP-6cffe1, 013=EMP-3fb43f
    const { data: toDelete, error: fetchErr } = await supabase
        .from('sys_users_v2')
        .select('id, name, employee_id')
        .eq('role', 'Operator');

    if (fetchErr) { console.error('❌ 查询失败:', fetchErr.message); return; }

    console.log('📋 现有操作员:', toDelete?.map(u => `${u.employee_id} ${u.name}`).join(', '));

    // Delete all current operators (008, 010, 013) - identified by EMP- prefix pattern
    const empIds = toDelete?.map(u => u.id) || [];
    if (empIds.length > 0) {
        const { error: delErr } = await supabase
            .from('sys_users_v2')
            .delete()
            .in('id', empIds);

        if (delErr) {
            console.error('❌ 删除失败:', delErr.message);
            return;
        }
        console.log(`✅ 已删除 ${empIds.length} 位旧操作员\n`);
    }

    // Step 2: 插入新操作员
    const inserts = NEW_OPERATORS.map(op => ({
        employee_id: op.employee_id,
        name: op.name,
        role: 'Operator',
        status: 'Active',
        pin_code: op.employee_id, // pin_code 设为与 employee_id 相同（兼容旧逻辑）
    }));

    const { data: inserted, error: insErr } = await supabase
        .from('sys_users_v2')
        .insert(inserts)
        .select('employee_id, name');

    if (insErr) {
        console.error('❌ 插入失败:', insErr.message);
        return;
    }

    console.log('✅ 成功新增操作员:');
    console.table(inserted?.map((u: any) => ({ 工号: u.employee_id, 姓名: u.name })));
    console.log('\n🎉 迁移完成！操作员现在用工号登录（如: 0014）');
}

migrate().catch(console.error);
