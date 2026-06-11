import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getGitCommitsForDate(dateStr) {
    const sinceISO = `${dateStr}T00:00:00+08:00`;
    const untilISO = `${dateStr}T23:59:59+08:00`;
    try {
        const commitLines = execSync(
            `git log --since="${sinceISO}" --until="${untilISO}" --format="%H|%an|%s"`,
            { encoding: 'utf8', cwd: process.cwd() }
        ).trim().split('\n').filter(Boolean);

        const commits = commitLines.map(line => {
            const [hash, author, ...msgParts] = line.split('|');
            return { hash: (hash || '').substring(0, 7), author: author || '', message: msgParts.join('|'), files: [] };
        });

        for (const commit of commits) {
            try {
                const files = execSync(
                    `git diff-tree --no-commit-id -r --name-only ${commit.hash}`,
                    { encoding: 'utf8' }
                ).trim().split('\n').filter(Boolean);
                commit.files = files.slice(0, 10); 
            } catch { /* ignore */ }
        }
        return commits;
    } catch (e) {
        return [];
    }
}

function getGitDiffStat(dateStr) {
    const sinceISO = `${dateStr}T00:00:00+08:00`;
    const untilISO = `${dateStr}T23:59:59+08:00`;
    try {
        const commits = execSync(`git log --since="${sinceISO}" --until="${untilISO}" --format="%H"`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
        if (commits.length === 0) return 'No diff available';
        const first = commits[commits.length - 1];
        const last = commits[0];
        if (first === last) {
            return execSync(`git show --stat ${last}`, { encoding: 'utf8' }).substring(0, 2000);
        }
        return execSync(`git diff --stat ${first}~1 ${last}`, { encoding: 'utf8' }).substring(0, 2000);
    } catch {
        return 'No diff available';
    }
}

async function processDate(dateStr) {
    console.log(`\n--- Processing ${dateStr} ---`);
    const commits = getGitCommitsForDate(dateStr);
    
    const checkResp = await fetch(`${SUPABASE_URL}/rest/v1/dev_logs?report_date=eq.${dateStr}&select=id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const existing = await checkResp.json();
    if (existing && existing.length > 0) {
        console.log(`Skipping ${dateStr}, already exists.`);
        return;
    }

    if (commits.length === 0) {
        console.log(`No commits on ${dateStr}. Skipping.`);
        return;
    }
    console.log(`Found ${commits.length} commits.`);
    const diffStat = getGitDiffStat(dateStr);

    const prompt = `你是 Packsecure 工厂管理系统的 AI 开发日志分析助手。今天是 ${dateStr}。以下是当天的代码改动，请生成一份结构化的中文开发日志报告。

## Git Commits (${commits.length} 个):
${commits.map(c => `- [${c.hash}] ${c.message} (${c.author})\n  文件: ${c.files.slice(0, 5).join(', ')}`).join('\n')}

## 文件变更统计:
${diffStat}

请以严格的 JSON 格式回复，字段如下：
{
  "summary": "总结当天的主要修改",
  "changes": [
    { "type": "新功能|修复|优化|重构|配置", "description": "改了什么", "impact": "影响范围" }
  ],
  "risks": [
    { "level": "高|中|低", "description": "风险描述", "suggestion": "建议" }
  ],
  "recommendations": ["建议1", "建议2"],
  "mood": "productive|quiet|risky|optimizing"
}
只回复 JSON。`;

    let aiResultText = "{}";
    let retries = 3;
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    while (retries > 0) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { temperature: 0.4, maxOutputTokens: 1500 }
            });
            aiResultText = response.text || "{}";
            break;
        } catch (e) {
            console.error(`Gemini Error on ${dateStr}: ${e.message}`);
            retries--;
            if (retries === 0) {
                console.log("Skipping due to repeated AI errors.");
                return;
            }
            console.log("Waiting 3 seconds before retry...");
            await sleep(3000);
        }
    }

    let parsed = { summary: '无总结', changes: [], risks: [], recommendations: [], mood: 'quiet' };
    try {
        const clean = aiResultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(clean);
    } catch {
        parsed.summary = aiResultText.substring(0, 500);
    }

    const payload = {
        report_date: dateStr,
        summary: parsed.summary || '',
        commits_json: commits,
        metrics_json: { report_date: dateStr, trips_created_today: 0, trips_unassigned: 0, total_users: 0, user_roles: {} },
        changes_json: parsed.changes || [],
        risks_json: parsed.risks || [],
        recommendations: parsed.recommendations || [],
        raw_ai_response: aiResultText,
    };

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/dev_logs`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        console.error(`Failed to save to Supabase`);
    } else {
        console.log(`✅ Saved ${dateStr}`);
    }
    await sleep(2000);
}

async function run() {
    let d = new Date('2026-05-14T00:00:00+08:00'); // This evaluates to 2026-05-13 UTC
    const end = new Date('2026-05-14T23:59:59+08:00');
    
    while (d <= end) {
        const dateStr = d.toISOString().split('T')[0];
        await processDate(dateStr);
        d.setDate(d.getDate() + 1);
    }
    console.log("Backfill complete.");
}

run();
