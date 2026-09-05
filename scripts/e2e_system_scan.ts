import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

interface DiscoveredIssue {
    id: string;
    level: 'P0' | 'P1' | 'P2';
    module: string;
    description: string;
    reproduceSteps: string[];
    errorStack: string;
    screenshotPath?: string;
}

const BASE_URL = process.env.APP_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'test-results', 'screenshots');
const ISSUES_FILE = path.resolve(process.cwd(), 'docs', 'SYSTEM_ISSUES.md');

// 确保截图输出目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// 准备测试的免登录/深度直达链接清单
const TARGET_ROUTES = [
    { name: '登录认证主页', path: '/' },
    { name: 'IoT 生产控制台 (N1-M01)', path: '/#/production/N1-M01' },
    { name: '客户批量导入中心', path: '/#/customers/import' },
    { name: '全能进货录入 (Universal Intake)', path: '/#/universal-intake' },
    { name: '简易库存管理 (Simple Stock)', path: '/#/simple-stock' },
    { name: '标签批量打印预览 (Label Mode)', path: '/?mode=labels' }
];

async function checkServerAvailable(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res.status < 500;
    } catch {
        return false;
    }
}

async function runScanner() {
    console.log('====================================================');
    console.log('🚀 Packsecure OS 自动化全页面巡检与防崩扫描器');
    console.log(`🎯 目标地址: ${BASE_URL}`);
    console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`);
    console.log('====================================================\n');

    // 1. 检查前端服务是否就绪
    const isOnline = await checkServerAvailable(BASE_URL);
    if (!isOnline) {
        console.error(`❌ 无法连接到 ${BASE_URL}！`);
        console.error('👉 请先在另一个终端窗口启动本地服务: `npm run dev` 或 `npm run dev:all`');
        process.exit(1);
    }

    const browser: Browser = await chromium.launch({
        headless: true
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });

    const page: Page = await context.newPage();
    const issues: DiscoveredIssue[] = [];
    let issueCounter = 1;

    for (const route of TARGET_ROUTES) {
        const fullUrl = `${BASE_URL}${route.path}`;
        console.log(`⏳ 正在巡检路由: [${route.name}] -> ${route.path}`);

        const pageErrors: string[] = [];
        const consoleErrors: string[] = [];

        // 监听未捕获的运行时异常
        const pageErrorHandler = (err: Error) => {
            pageErrors.push(err.stack || err.message);
        };
        // 监听控制台 error
        const consoleHandler = (msg: any) => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // 忽略常见的静态 favicon 缺失或浏览器扩展提示
                if (!text.includes('favicon') && !text.includes('chrome-extension')) {
                    consoleErrors.push(text);
                }
            }
        };

        page.on('pageerror', pageErrorHandler);
        page.on('console', consoleHandler);

        try {
            await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(1000); // 等待 React 19 渲染完成与状态绑定

            // 检查是否触发了系统的 React ErrorBoundary
            const errorBoundaryEl = await page.$('.error-boundary, [data-error-boundary]');
            const hasCrashed = errorBoundaryEl !== null || pageErrors.length > 0;

            if (hasCrashed || consoleErrors.length > 0) {
                const bugId = `BUG-${String(issueCounter++).padStart(3, '0')}`;
                const screenshotFile = `screenshot_${bugId}_${route.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                const screenshotFull = path.join(SCREENSHOT_DIR, screenshotFile);

                await page.screenshot({ path: screenshotFull, fullPage: true });

                const level: 'P0' | 'P1' | 'P2' = hasCrashed ? 'P0' : 'P2';
                const issueDesc = hasCrashed
                    ? `页面发生未捕获异常或触发 ErrorBoundary 白屏`
                    : `页面渲染成功但控制台抛出错误日志 (${consoleErrors.length} 条)`;

                const allStacks = [...pageErrors, ...consoleErrors].join('\n');

                issues.push({
                    id: bugId,
                    level,
                    module: route.name,
                    description: issueDesc,
                    reproduceSteps: [
                        `直接访问路由 ${route.path}`,
                        `等待页面完成渲染`
                    ],
                    errorStack: allStacks.slice(0, 1000), // 避免日志超长
                    screenshotPath: path.relative(process.cwd(), screenshotFull).replace(/\\/g, '/')
                });

                console.log(`   ⚠️ 捕获异常! 已保存截图: ${screenshotFile}`);
            } else {
                console.log(`   ✅ 页面渲染正常，无致命错误`);
            }
        } catch (err: any) {
            console.error(`   ❌ 访问 ${fullUrl} 超时或加载失败:`, err.message);
        } finally {
            page.off('pageerror', pageErrorHandler);
            page.off('console', consoleHandler);
        }
    }

    await browser.close();

    // 2. 将发现的问题追加写入 docs/SYSTEM_ISSUES.md
    if (issues.length > 0) {
        console.log(`\n📝 正在将 ${issues.length} 个新发现的问题追加至 docs/SYSTEM_ISSUES.md ...`);

        let appendText = `\n\n### 自动化巡检结果 (${new Date().toLocaleString()})\n\n`;
        for (const issue of issues) {
            appendText += `#### [${issue.id}] [${issue.level}] ${issue.module} - ${issue.description}\n`;
            appendText += `- **严重级别**：${issue.level}\n`;
            appendText += `- **影响模块**：${issue.module}\n`;
            appendText += `- **复现步骤**：\n`;
            issue.reproduceSteps.forEach((s, idx) => {
                appendText += `  ${idx + 1}. ${s}\n`;
            });
            appendText += `- **错误堆栈 (Console/Error)**：\n\`\`\`text\n${issue.errorStack}\n\`\`\`\n`;
            if (issue.screenshotPath) {
                appendText += `- **截图凭证**：\`${issue.screenshotPath}\`\n`;
            }
            appendText += `- **当前状态**：\`[待修复]\`\n\n`;
        }

        fs.appendFileSync(ISSUES_FILE, appendText, 'utf-8');
        console.log('✅ 缺陷文档更新完成！');
    } else {
        console.log('\n🎉 本次巡检未发现任何崩溃或严重控制台异常！全页面健康状态良好。');
    }

    console.log('\n====================================================');
    console.log('巡检完成！');
    console.log('====================================================');
}

runScanner().catch(err => {
    console.error('Fatal scanner error:', err);
    process.exit(1);
});
