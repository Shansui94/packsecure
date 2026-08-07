import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Starting SOP Markdown seeding...");

    // 1. Read markdown files
    const driverSOPPath = path.join(__dirname, 'SOP_Driver_Delivery.md');
    const hrSOPPath = path.join(__dirname, 'SOP_HR_Leave_Approval.md');
    const machineSOPPath = path.join(__dirname, 'SOP_Machine_Labeling.md');

    let driverContent = '';
    let hrContent = '';
    let machineContent = '';

    try {
        driverContent = fs.readFileSync(driverSOPPath, 'utf-8');
        hrContent = fs.readFileSync(hrSOPPath, 'utf-8');
        machineContent = fs.readFileSync(machineSOPPath, 'utf-8');
    } catch (err) {
        console.error("Error reading markdown files:", err);
        process.exit(1);
    }

    // 2. Define article database models
    const articles = [
        {
            title: '卡车绑定与扫码还车 SOP (司机端)',
            description: '指导司机如何进行卡车绑定、送货拍照上传、以及回厂扫码交单结束行程。',
            content: driverContent,
            page_id: 'driver-delivery',
            target_roles: ['Driver', 'SuperAdmin', 'Admin', 'Manager'],
            sort_order: 1,
            is_published: true,
            created_by: 'System Seed'
        },
        {
            title: 'HR 假期审批标准操作规程 (HR/管理端)',
            description: '指导 HR 及管理人员在系统后台正确审核、批准、拒绝和撤销员工的请假申请。',
            content: hrContent,
            page_id: 'leave-calendar',
            target_roles: ['HR', 'SuperAdmin', 'Admin', 'Manager'],
            sort_order: 2,
            is_published: true,
            created_by: 'System Seed'
        },
        {
            title: '生产设备标签与扫码 SOP (操作工端)',
            description: '指导工厂管理人员及操作工如何正确打印、安装和扫描机器 QR 识别码进行生产计数。',
            content: machineContent,
            page_id: 'scanner',
            target_roles: ['Operator', 'SuperAdmin', 'Admin', 'Manager'],
            sort_order: 3,
            is_published: true,
            created_by: 'System Seed'
        }
    ];

    // 3. Clear existing articles to avoid duplicates
    console.log("Cleaning existing SOP articles...");
    const { error: deleteError } = await supabase
        .from('sop_articles')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
        console.error("Failed to clean table:", deleteError);
        process.exit(1);
    }

    // 4. Insert new seeded articles
    console.log("Inserting seeded articles...");
    const { data, error: insertError } = await supabase
        .from('sop_articles')
        .insert(articles)
        .select('id, title, page_id');

    if (insertError) {
        console.error("Failed to seed articles:", insertError);
        process.exit(1);
    }

    console.log("Successfully seeded SOP Articles:", data);
}

run();
