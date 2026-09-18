import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyAdminCors } from '../lib/cors.js';
import { getServiceRoleClient } from '../lib/admin-auth.js';
import { execSync } from 'child_process';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

function getTodayGitCommits(dateStr: string) {
    try {
        const sinceISO = `${dateStr}T00:00:00+08:00`;
        const untilISO = `${dateStr}T23:59:59+08:00`;

        const commitLines = execSync(
            `git log --since="${sinceISO}" --until="${untilISO}" --format="%H|%an|%s"`,
            { encoding: 'utf8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'ignore'] }
        ).trim().split('\n').filter(Boolean);

        return commitLines.map(line => {
            const [hash, author, ...msgParts] = line.split('|');
            return {
                hash: (hash || '').substring(0, 7),
                author: author || '',
                message: msgParts.join('|'),
                files: []
            };
        });
    } catch {
        return [];
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyAdminCors(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    let admin;
    try {
        admin = getServiceRoleClient();
    } catch (e: any) {
        return res.status(500).json({ error: 'Database service client error: ' + (e.message || 'Config error') });
    }

    const action = (req.body?.action || req.query?.action || 'upsert') as string;

    try {
        // ── 1. Fetch Today's Tasks from DB ──
        if (action === 'fetch-tasks') {
            const { data: tasks, error } = await admin
                .from('tasks')
                .select(`
                    id,
                    title,
                    description,
                    status,
                    priority,
                    created_at,
                    assigned_to,
                    assignee:users_public!assigned_to(name),
                    creator:users_public!created_by(name)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                return res.status(400).json({ error: error.message });
            }

            const formattedTasks = (tasks || []).map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description || '',
                status: t.status,
                priority: t.priority,
                created_at: t.created_at,
                assignee_name: t.assignee?.name || 'Unassigned',
                creator_name: t.creator?.name || 'Unknown'
            }));

            return res.status(200).json({ ok: true, tasks: formattedTasks });
        }

        // ── 2. Fetch Git Commits ──
        if (action === 'fetch-git') {
            const dateStr = (req.query?.date as string) || (req.body?.date as string) || new Date().toISOString().split('T')[0];
            const commits = getTodayGitCommits(dateStr);
            return res.status(200).json({ ok: true, commits });
        }

        // ── 3. AI Polish & Structuring ──
        if (action === 'ai-polish') {
            const { rawText, tasks = [], commits = [], version, report_date } = req.body || {};
            const dateStr = report_date || new Date().toISOString().split('T')[0];

            if (!GEMINI_API_KEY) {
                return res.status(500).json({ error: 'GOOGLE_API_KEY is not configured on server' });
            }

            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const taskSummary = Array.isArray(tasks) && tasks.length > 0
                ? tasks.map((t: any) => `- [${t.status}] ${t.title}${t.description ? ' (' + t.description + ')' : ''}`).join('\n')
                : '暂无勾选的系统任务';

            const commitSummary = Array.isArray(commits) && commits.length > 0
                ? commits.map((c: any) => `- [${c.hash || 'git'}] ${c.message} (${c.author || 'dev'})`).join('\n')
                : '暂无Git提交';

            const prompt = `
你是 Packsecure 工厂操作系统 (Packsecure OS) 的首席架构师兼 AI 汇报助手。
当前汇报日期是：${dateStr}
系统版本/代号：${version || '最新版本迭代'}

请根据开发者/管理员提供的以下原始输入、任务进展与提交信息，整理成一份专业、结构严谨的「每日工作与系统升级汇报」。

【原始输入/速记笔记】：
${rawText || '（用户未输入具体草稿，请根据任务和提交记录提炼总结）'}

【关联的系统 Tasks 任务】：
${taskSummary}

【关联的 Git 提交变更】：
${commitSummary}

---
请以严格的 JSON 格式输出，不要包含 markdown 代码块（\`\`\`json 开头或结尾都不需要），只返回纯 JSON 对象。
JSON 字段定义如下：
{
  "summary": "2至4句话的今日核心工作总结，阐述完成了哪些关键业务功能升级与任务，言简意赅。",
  "changes": [
    {
      "type": "新功能" | "修复" | "优化" | "重构" | "任务完成",
      "description": "详细说明做了什么改动或完成了什么任务",
      "impact": "说明对哪些业务角色（如司机、车间操作员、物流调度、管理层）或页面产生了影响"
    }
  ],
  "risks": [
    {
      "level": "高" | "中" | "低",
      "description": "可能存在的业务或系统风险（若无明显风险可写'运行平稳，无高危阻塞'）",
      "suggestion": "应对策略或后续注意事项"
    }
  ],
  "recommendations": [
    "明日计划重点或后续优化建议第1条",
    "明日计划重点或后续优化建议第2条"
  ]
}
`;

            const result = await model.generateContent(prompt);
            const textResponse = result.response.text();

            let parsed: any;
            try {
                const cleaned = textResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                parsed = JSON.parse(cleaned);
            } catch (err) {
                console.warn('AI response JSON parse error:', err, textResponse);
                parsed = {
                    summary: textResponse.slice(0, 300),
                    changes: [{ type: '优化', description: rawText || '系统更新维护', impact: '系统稳定性' }],
                    risks: [],
                    recommendations: ['继续跟踪系统运行状态']
                };
            }

            return res.status(200).json({ ok: true, result: parsed });
        }

        // ── 4. Upsert Dev Log Entry ──
        if (action === 'upsert' || req.method === 'POST') {
            const {
                id,
                report_date,
                summary,
                changes_json = [],
                risks_json = [],
                recommendations = [],
                commits_json = [],
                metrics_json = {},
                raw_ai_response = ''
            } = req.body || {};

            if (!report_date) {
                return res.status(400).json({ error: 'report_date is required (YYYY-MM-DD)' });
            }

            const payload: any = {
                report_date,
                summary: summary || '',
                changes_json: Array.isArray(changes_json) ? changes_json : [],
                risks_json: Array.isArray(risks_json) ? risks_json : [],
                recommendations: Array.isArray(recommendations) ? recommendations : [],
                commits_json: Array.isArray(commits_json) ? commits_json : [],
                metrics_json: typeof metrics_json === 'object' ? metrics_json : {},
                raw_ai_response: raw_ai_response || null
            };

            if (id) {
                payload.id = id;
            }

            const { data, error } = await admin
                .from('dev_logs')
                .upsert(payload, { onConflict: 'report_date' })
                .select()
                .single();

            if (error) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(200).json({ ok: true, data });
        }

        // ── 5. Delete Log Entry ──
        if (action === 'delete') {
            const { id, report_date } = req.body || req.query || {};
            if (!id && !report_date) {
                return res.status(400).json({ error: 'id or report_date is required' });
            }

            let query = admin.from('dev_logs').delete();
            if (id) query = query.eq('id', id);
            else if (report_date) query = query.eq('report_date', report_date);

            const { error } = await query;
            if (error) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: `Unsupported action: ${action}` });
    } catch (err: any) {
        console.error('[API /api/dev-log] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
