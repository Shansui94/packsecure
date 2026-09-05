import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY 或 VITE_SUPABASE_ANON_KEY，请检查 .env 配置');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface HealthReportItem {
    name: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    detail: string;
}

async function runHealthCheck() {
    console.log('====================================================');
    console.log('🔍 Packsecure OS 系统数据层与服务健康检查探针');
    console.log('⏰ 时间:', new Date().toLocaleString());
    console.log('====================================================\n');

    const results: HealthReportItem[] = [];

    // 1. 检查 Supabase 核心表可访问性与数据统计 (参照 DATA_DICTIONARY.md)
    const tablesToCheck = [
        'users_public',
        'sys_users_v2',
        'sys_machines_v2',
        'sys_vehicles',
        'live_stock',
        'trips',
        'sales_orders',
        'employee_leave',
        'role_permissions'
    ];

    for (const table of tablesToCheck) {
        try {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                results.push({
                    name: `数据表 [${table}]`,
                    status: 'FAIL',
                    detail: `查询失败: ${error.message} (代码: ${error.code})`
                });
            } else {
                results.push({
                    name: `数据表 [${table}]`,
                    status: 'PASS',
                    detail: `连通正常，记录数: ${count ?? 0}`
                });
            }
        } catch (err: any) {
            results.push({
                name: `数据表 [${table}]`,
                status: 'FAIL',
                detail: `抛出异常: ${err.message}`
            });
        }
    }

    // 2. 检查本地 API 服务 (:8080)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('http://localhost:8080/api/agent/chat', {
            method: 'OPTIONS',
            signal: controller.signal
        }).catch(() => null);
        clearTimeout(timeoutId);

        if (res) {
            results.push({
                name: '本地 Express API (:8080)',
                status: 'PASS',
                detail: `服务响应正常 (HTTP ${res.status})`
            });
        } else {
            results.push({
                name: '本地 Express API (:8080)',
                status: 'WARN',
                detail: '未检测到端口 8080 监听。提示: 如需测试 API，请在终端运行 `npm run dev:all` 或 `npm run start`'
            });
        }
    } catch {
        results.push({
            name: '本地 Express API (:8080)',
            status: 'WARN',
            detail: '8080 端口检测超时或未开启'
        });
    }

    // 3. 输出汇总报表
    console.log('\n--- 检查结果汇总 ---');
    let hasFailures = false;
    for (const item of results) {
        const icon = item.status === 'PASS' ? '✅' : item.status === 'WARN' ? '⚠️' : '❌';
        console.log(`${icon} [${item.status}] ${item.name}: ${item.detail}`);
        if (item.status === 'FAIL') hasFailures = true;
    }

    console.log('\n====================================================');
    if (hasFailures) {
        console.log('❌ 发现关键检查项失败，建议排查相应数据表权限或配置。');
    } else {
        console.log('🎉 基础健康探针全部通过！');
    }
    console.log('====================================================');
}

runHealthCheck().catch((err) => {
    console.error('Fatal health check error:', err);
    process.exit(1);
});
