import type { VercelRequest, VercelResponse } from '@vercel/node';
import path from 'path';
import fs from 'fs';
import { applyAdminCors } from '../lib/cors.js';
import { requireStaffAuth, sendAuthError } from '../lib/admin-auth.js';

export interface DocDefinition {
    id: string;
    title: string;
    description: string;
    target: 'packsecure' | 'root';
    relativePath: string;
}

export const DOC_REGISTRY: DocDefinition[] = [
    {
        id: 'packsecure-readme',
        title: 'Packsecure OS 核心说明 (packsecure/README.md)',
        description: '系统整体定位、核心功能模块、技术架构选型与开发指引',
        target: 'packsecure',
        relativePath: 'README.md'
    },
    {
        id: 'root-readme',
        title: '项目根目录说明 (README.md)',
        description: '代码仓库根目录索引与多模块指引',
        target: 'root',
        relativePath: 'README.md'
    },
    {
        id: 'business-rules',
        title: '核心业务真理库 (docs/BUSINESS_RULES.md)',
        description: '厂区划分、机台配置、马来西亚时间考勤与时薪计算规则',
        target: 'packsecure',
        relativePath: 'docs/BUSINESS_RULES.md'
    },
    {
        id: 'data-dictionary',
        title: '数据库结构字典 (docs/DATA_DICTIONARY.md)',
        description: 'Postgres 核心表结构、状态枚举与关键字段定义',
        target: 'packsecure',
        relativePath: 'docs/DATA_DICTIONARY.md'
    },
    {
        id: 'system-issues',
        title: '系统排查记录 (docs/SYSTEM_ISSUES.md)',
        description: '系统历史问题、诊断日志与运维排障记录',
        target: 'packsecure',
        relativePath: 'docs/SYSTEM_ISSUES.md'
    }
];

function getWorkspacePaths(): { packsecureDir: string; repoRoot: string } {
    const cwd = process.cwd();
    const isPacksecureCwd = path.basename(cwd).toLowerCase() === 'packsecure';

    const packsecureDir = isPacksecureCwd ? cwd : path.join(cwd, 'packsecure');
    const repoRoot = isPacksecureCwd ? path.dirname(cwd) : cwd;

    return { packsecureDir, repoRoot };
}

function resolveDocPath(doc: DocDefinition): string {
    const { packsecureDir, repoRoot } = getWorkspacePaths();
    const baseDir = doc.target === 'root' ? repoRoot : packsecureDir;
    return path.resolve(baseDir, doc.relativePath);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyAdminCors(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ─── GET: 读取文档列表或单篇文档内容 ───────────────────────────────────────
    if (req.method === 'GET') {
        const docId = typeof req.query.docId === 'string' ? req.query.docId : undefined;

        try {
            if (docId) {
                const targetDoc = DOC_REGISTRY.find(d => d.id === docId);
                if (!targetDoc) {
                    return res.status(404).json({ error: `未找到指定文档: ${docId}` });
                }

                const filePath = resolveDocPath(targetDoc);
                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ error: `磁盘文件不存在: ${targetDoc.relativePath}` });
                }

                const stats = await fs.promises.stat(filePath);
                const content = await fs.promises.readFile(filePath, 'utf8');

                return res.status(200).json({
                    doc: {
                        ...targetDoc,
                        content,
                        size: stats.size,
                        updatedAt: stats.mtime.toISOString(),
                        fullPath: filePath
                    }
                });
            }

            // 返回所有白名单文档概览
            const documents = await Promise.all(
                DOC_REGISTRY.map(async (doc) => {
                    const filePath = resolveDocPath(doc);
                    const exists = fs.existsSync(filePath);
                    let size = 0;
                    let updatedAt: string | null = null;

                    if (exists) {
                        try {
                            const stats = await fs.promises.stat(filePath);
                            size = stats.size;
                            updatedAt = stats.mtime.toISOString();
                        } catch {
                            // ignore stat error
                        }
                    }

                    return {
                        ...doc,
                        exists,
                        size,
                        updatedAt
                    };
                })
            );

            return res.status(200).json({ documents });
        } catch (error: any) {
            console.error('[API /api/docs GET] 读取文档异常:', error);
            return res.status(500).json({ error: error?.message || '读取文档失败' });
        }
    }

    // ─── POST: 保存与覆写 Markdown 文档 ──────────────────────────────────────
    if (req.method === 'POST') {
        const { docId, content } = req.body ?? {};

        if (!docId || typeof docId !== 'string') {
            return res.status(400).json({ error: '缺少必需参数: docId' });
        }

        if (typeof content !== 'string') {
            return res.status(400).json({ error: '缺少必需参数: content (必须为字符串)' });
        }

        const targetDoc = DOC_REGISTRY.find(d => d.id === docId);
        if (!targetDoc) {
            return res.status(400).json({ error: `非法文档标识或不在白名单内: ${docId}` });
        }

        // 鉴权检查：仅 SuperAdmin 或 Admin 允许保存
        const userRoleHeader = req.headers['x-user-role'];
        const isDemoAdmin = (userRoleHeader === 'SuperAdmin' || userRoleHeader === 'Admin') &&
            process.env.NODE_ENV !== 'production';

        if (!isDemoAdmin) {
            const auth = await requireStaffAuth(req, ['SuperAdmin', 'Admin']);
            if (!auth.ok) {
                sendAuthError(res, auth);
                return;
            }
        }

        try {
            const filePath = resolveDocPath(targetDoc);
            const parentDir = path.dirname(filePath);

            if (!fs.existsSync(parentDir)) {
                await fs.promises.mkdir(parentDir, { recursive: true });
            }

            await fs.promises.writeFile(filePath, content, 'utf8');
            const stats = await fs.promises.stat(filePath);

            console.log(`[API /api/docs POST] 成功保存文档 ${docId} -> ${filePath} (${stats.size} bytes)`);

            return res.status(200).json({
                success: true,
                message: `文档 [${targetDoc.title}] 已成功保存到磁盘`,
                docId,
                updatedAt: stats.mtime.toISOString(),
                size: stats.size
            });
        } catch (error: any) {
            console.error(`[API /api/docs POST] 写入文档失败 [${docId}]:`, error);
            return res.status(500).json({ error: error?.message || '保存文档至磁盘失败' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
