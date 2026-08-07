import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. 获取所有用户
    const { data: users, error: userError } = await supabase
        .from('users_public')
        .select('*');

    if (userError) {
        console.error("Error fetching users_public:", userError);
        return;
    }

    const userMap = new Map();
    users.forEach(u => {
        userMap.set(u.id, u);
    });

    // 2. 获取所有 salary_advances 记录
    const { data: advances, error: advError } = await supabase
        .from('salary_advances')
        .select('*');

    if (advError) {
        console.error("Error fetching salary_advances:", advError);
        return;
    }

    console.log("=== All Advances with Analysis ===");
    
    const testRecords = [];
    const prodRecords = [];

    advances.forEach(adv => {
        const user = userMap.get(adv.employee_id) || {};
        const userName = user.name || '';
        const userEmail = user.email || '';
        const reason = adv.rejection_reason || '';
        const amount = adv.amount;
        const date = adv.bank_in_date;
        const status = adv.status;

        // 判断是否为 test 记录:
        // - 用户名包含 'test'
        // - 邮箱包含 'test'
        // - 驳回原因包含 'test' 或者是 'aaa' 这样随手打的字符
        // - 或者是 Max Tan 的账号申请的记录（Max Tan 为开发人员/测试人员账号，如果是在 6 月 15 日或更早的测试中进行的，例如 reason = 'test'）
        const isTestUser = userName.toLowerCase().includes('test') || userEmail.toLowerCase().includes('test');
        const isTestReason = reason.toLowerCase() === 'test' || reason.toLowerCase() === 'aaa' || reason.toLowerCase() === 'aaa ';
        const isMaxTanTest = userEmail === 'khailoon94@gmail.com' && isTestReason;

        if (isTestUser || isTestReason || isMaxTanTest) {
            testRecords.push({
                id: adv.id,
                userName,
                userEmail,
                amount,
                date,
                status,
                reason,
                why: isTestUser ? "Test User" : (isMaxTanTest ? "Max Tan Test Reason" : "Test Reason")
            });
        } else {
            prodRecords.push({
                id: adv.id,
                userName,
                userEmail,
                amount,
                date,
                status,
                reason
            });
        }
    });

    console.log("\n--- TEST RECORDS TO DELETE ---");
    testRecords.forEach(r => {
        console.log(`ID: ${r.id} | User: ${r.userName} (${r.userEmail}) | Amt: ${r.amount} | Date: ${r.date} | Status: ${r.status} | Reason: "${r.reason}" | Type: ${r.why}`);
    });

    console.log("\n--- PRODUCTION RECORDS TO KEEP ---");
    prodRecords.forEach(r => {
        console.log(`ID: ${r.id} | User: ${r.userName} (${r.userEmail}) | Amt: ${r.amount} | Date: ${r.date} | Status: ${r.status} | Reason: "${r.reason}"`);
    });
}

run();
