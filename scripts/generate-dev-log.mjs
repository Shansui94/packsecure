#!/usr/bin/env node
/**
 * generate-dev-log.mjs
 * Called by GitHub Actions daily at 11 PM MYT.
 * 1. Reads git log from stdin (passed by workflow)
 * 2. Queries Supabase for today's app metrics
 * 3. Calls Gemini API to analyse
 * 4. Upserts report into dev_logs table
 */

import { execSync } from 'child_process';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;  // service role key
const REPORT_DATE = process.env.REPORT_DATE || new Date().toISOString().split('T')[0];

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing required env vars: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// ─── 1. Collect Git Info ─────────────────────────────────────
function getGitCommits() {
    try {
        const since = new Date();
        since.setHours(since.getHours() - 24);
        const sinceISO = since.toISOString();

        // Step 1: get commit lines
        const commitLines = execSync(
            `git log --since="${sinceISO}" --format="%H|%an|%s"`,
            { encoding: 'utf8', cwd: process.cwd() }
        ).trim().split('\n').filter(Boolean);

        const commits = commitLines.map(line => {
            const [hash, author, ...msgParts] = line.split('|');
            return { hash: (hash || '').substring(0, 7), author: author || '', message: msgParts.join('|'), files: [] };
        });

        // Step 2: get changed files for each commit
        for (const commit of commits) {
            try {
                const files = execSync(
                    `git diff-tree --no-commit-id -r --name-only ${commit.hash}`,
                    { encoding: 'utf8' }
                ).trim().split('\n').filter(Boolean);
                commit.files = files.slice(0, 10); // cap at 10 files
            } catch { /* ignore per-commit errors */ }
        }

        return commits;
    } catch (e) {
        console.warn('⚠️ Git log failed:', e.message);
        return [];
    }
}

function getGitDiffStat() {
    try {
        return execSync(
            `git diff --stat HEAD~${Math.max(1, getGitCommits().length)} HEAD 2>/dev/null || echo "No diff available"`,
            { encoding: 'utf8' }
        ).substring(0, 2000); // cap at 2k chars
    } catch {
        return 'No diff available';
    }
}

// ─── 2. Fetch Supabase App Metrics ───────────────────────────
async function fetchMetrics() {
    const today = REPORT_DATE;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };

    const supaFetch = (path) =>
        fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers }).then(r => r.json());

    try {
        const [tripsToday, tripsPending, usersTotal] = await Promise.all([
            // Trips created today
            supaFetch(`sales_orders?select=id&created_at=gte.${today}T00:00:00&created_at=lt.${today}T23:59:59`),
            // Trips still pending (no driver)
            supaFetch(`sales_orders?select=id&driver_id=is.null&status=neq.Cancelled&status=neq.Delivered`),
            // Total active users
            supaFetch(`users_public?select=id,role`),
        ]);

        return {
            trips_created_today: Array.isArray(tripsToday) ? tripsToday.length : 0,
            trips_unassigned: Array.isArray(tripsPending) ? tripsPending.length : 0,
            total_users: Array.isArray(usersTotal) ? usersTotal.length : 0,
            user_roles: Array.isArray(usersTotal)
                ? usersTotal.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {})
                : {},
            report_date: today,
            previous_date: yesterdayStr,
        };
    } catch (e) {
        console.warn('⚠️ Metrics fetch failed:', e.message);
        return { error: e.message, report_date: today };
    }
}

// ─── 3. Call Gemini API ───────────────────────────────────────
async function callGemini(commits, metrics, diffStat) {
    const prompt = `
你是 Packsecure 工厂管理系统的 AI 开发日志分析助手。
今天是 ${REPORT_DATE}（马来西亚时间）。

以下是今天的代码改动和应用数据，请生成一份结构化的中文开发日志报告。

## 今日 Git Commits (${commits.length} 个):
${commits.length === 0 ? '今天没有代码提交。' : commits.map(c =>
        `- [${c.hash}] ${c.message} (${c.author})\n  文件: ${c.files.slice(0, 5).join(', ')}`
    ).join('\n')}

## 文件变更统计:
${diffStat}

## 应用数据指标:
- 今日新建 Trip 数: ${metrics.trips_created_today ?? 'N/A'}
- 未分配 Trip 数: ${metrics.trips_unassigned ?? 'N/A'}
- 系统总用户: ${metrics.total_users ?? 'N/A'}
- 用户角色分布: ${JSON.stringify(metrics.user_roles ?? {})}

---

请以严格的 JSON 格式回复，字段如下：
{
  "summary": "两三句话的今日总结",
  "changes": [
    { "type": "新功能|修复|优化|重构|配置", "description": "改了什么", "impact": "影响哪些用户/功能" }
  ],
  "risks": [
    { "level": "高|中|低", "description": "风险描述", "suggestion": "建议" }
  ],
  "recommendations": ["建议1", "建议2"],
  "mood": "productive|quiet|risky|optimizing"
}

只回复 JSON，不要 markdown 代码块，不要额外文字。
`;
    // Replace raw fetch with @google/genai SDK
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.4,
                maxOutputTokens: 1500,
            }
        });

        const text = response.text || "{}";

        try {
            // Strip any accidental markdown fences
            const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return { parsed: JSON.parse(clean), raw: text };
        } catch {
            console.warn('⚠️ Could not parse Gemini JSON, using raw text');
            return {
                parsed: { summary: text.substring(0, 500), changes: [], risks: [], recommendations: [], mood: 'quiet' },
                raw: text
            };
        }
    } catch (apiErr) {
        throw new Error(`Gemini API error: ${apiErr.message}`);
    }
}

// ─── 4. Upsert into Supabase ──────────────────────────────────
async function saveReport(commits, metrics, aiResult) {
    const payload = {
        report_date: REPORT_DATE,
        summary: aiResult.parsed.summary || '',
        commits_json: commits,
        metrics_json: metrics,
        changes_json: aiResult.parsed.changes || [],
        risks_json: aiResult.parsed.risks || [],
        recommendations: aiResult.parsed.recommendations || [],
        raw_ai_response: aiResult.raw,
    };

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/dev_logs`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'  // upsert on report_date conflict
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Supabase insert failed: ${err}`);
    }

    console.log(`✅ Dev log saved for ${REPORT_DATE}`);
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
    console.log(`🔍 Generating dev log for ${REPORT_DATE}...`);

    const commits = getGitCommits();
    console.log(`📦 Found ${commits.length} commits today`);

    const diffStat = commits.length > 0 ? getGitDiffStat() : 'No commits today.';

    const metrics = await fetchMetrics();
    console.log('📊 App metrics:', metrics);

    const aiResult = await callGemini(commits, metrics, diffStat);
    console.log('🤖 AI summary:', aiResult.parsed.summary);
    console.log('⚠️  Risks found:', aiResult.parsed.risks?.length ?? 0);

    await saveReport(commits, metrics, aiResult);
}

main().catch(e => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
});
