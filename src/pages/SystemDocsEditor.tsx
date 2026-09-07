import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    FileCode,
    Save,
    RotateCcw,
    Eye,
    Edit3,
    Columns,
    Check,
    AlertCircle,
    Copy,
    ExternalLink,
    Clock,
    HardDrive,
    Shield,
    Lock,
    Bold,
    Italic,
    Heading1,
    Heading2,
    List,
    ListOrdered,
    Code,
    Table,
    Quote,
    Link as LinkIcon,
    AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../services/supabase';

interface DocSummary {
    id: string;
    title: string;
    description: string;
    target: 'packsecure' | 'root';
    relativePath: string;
    exists: boolean;
    size?: number;
    updatedAt?: string | null;
}

interface SystemDocsEditorProps {
    user?: any;
}

export const SystemDocsEditor: React.FC<SystemDocsEditorProps> = ({ user }) => {
    const [docs, setDocs] = useState<DocSummary[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>('packsecure-readme');
    const [content, setContent] = useState<string>('');
    const [savedContent, setSavedContent] = useState<string>('');
    const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
    const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const userRole = user?.role || 'Operator';
    const isSuperAdmin = userRole === 'SuperAdmin';
    const isAdmin = userRole === 'Admin';
    const canEdit = isSuperAdmin || isAdmin;

    const isDirty = content !== savedContent;

    // 默认在移动端宽度下切换为单视图
    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 1024 && viewMode === 'split') {
                setViewMode('edit');
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [viewMode]);

    // 自动清除反馈提示
    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    // 1. 获取文档清单
    const fetchDocList = useCallback(async () => {
        try {
            setIsLoadingList(true);
            const res = await fetch('/api/docs');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.documents && Array.isArray(data.documents)) {
                setDocs(data.documents);
            }
        } catch (err: any) {
            console.error('获取文档列表失败:', err);
            setFeedback({ type: 'error', message: '无法读取文档列表，请检查本地后端服务 (8080)' });
        } finally {
            setIsLoadingList(false);
        }
    }, []);

    useEffect(() => {
        fetchDocList();
    }, [fetchDocList]);

    // 2. 获取当前选中篇目内容
    const fetchDocContent = useCallback(async (docId: string) => {
        try {
            setIsLoadingContent(true);
            const res = await fetch(`/api/docs?docId=${encodeURIComponent(docId)}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            const text = data.doc?.content || '';
            setContent(text);
            setSavedContent(text);
            setLastSavedTime(data.doc?.updatedAt ? new Date(data.doc.updatedAt).toLocaleTimeString() : null);
        } catch (err: any) {
            console.error(`加载文档 [${docId}] 失败:`, err);
            setFeedback({ type: 'error', message: `读取文档失败: ${err.message}` });
        } finally {
            setIsLoadingContent(false);
        }
    }, []);

    useEffect(() => {
        if (selectedDocId) {
            fetchDocContent(selectedDocId);
        }
    }, [selectedDocId, fetchDocContent]);

    // 3. 保存文档内容到磁盘
    const handleSave = async () => {
        if (!canEdit) {
            setFeedback({ type: 'error', message: '权限不足：仅管理员与超级管理员可保存修改' });
            return;
        }

        try {
            setIsSaving(true);
            const session = (await supabase.auth.getSession()).data.session;
            const token = session?.access_token || '';

            const res = await fetch('/api/docs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    'x-user-role': userRole
                },
                body: JSON.stringify({
                    docId: selectedDocId,
                    content
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            setSavedContent(content);
            const nowStr = new Date().toLocaleTimeString();
            setLastSavedTime(nowStr);
            setFeedback({ type: 'success', message: `✅ 成功保存至磁盘！(${nowStr})` });

            // 刷新列表以同步最新修改时间与大小
            fetchDocList();
        } catch (err: any) {
            console.error('保存文档失败:', err);
            setFeedback({ type: 'error', message: `保存失败: ${err.message}` });
        } finally {
            setIsSaving(false);
        }
    };

    // 快捷键 Ctrl+S / Cmd+S 支持
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (canEdit && isDirty && !isSaving) {
                    handleSave();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canEdit, isDirty, isSaving, content, selectedDocId]);

    // 常用 Markdown 语法插入器
    const insertMarkdown = (prefix: string, suffix = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selection = content.substring(start, end);
        const replacement = `${prefix}${selection || '内容'}${suffix}`;

        const nextContent = content.substring(0, start) + replacement + content.substring(end);
        setContent(nextContent);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(
                start + prefix.length,
                start + prefix.length + (selection.length || '内容'.length)
            );
        }, 0);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const selectedDoc = docs.find(d => d.id === selectedDocId);

    // 统计指标
    const stats = {
        chars: content.length,
        lines: content ? content.split('\n').length : 0,
        words: content.trim() ? content.trim().split(/\s+/).length : 0
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-2rem)] max-w-[1600px] mx-auto p-2 sm:p-4 space-y-3 font-sans text-gray-200">
            {/* 顶栏：标题、文档选择与操作区 */}
            <div className="bg-[#111827] border border-gray-800/80 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                        <FileCode size={22} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                                系统文档中心 (System Docs)
                            </h1>
                            {isDirty && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                                    未保存变更
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 truncate hidden sm:block">
                            {selectedDoc?.description || '在线查看并修改项目 Markdown 物理文件'}
                        </p>
                    </div>
                </div>

                {/* 操作与工具按钮 */}
                <div className="flex items-center flex-wrap gap-2">
                    {/* 视图模式切换 */}
                    <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('edit')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                                viewMode === 'edit'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                            title="仅编辑模式"
                        >
                            <Edit3 size={14} />
                            <span className="hidden sm:inline">编辑</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('split')}
                            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                                viewMode === 'split'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                            title="双栏分屏对比"
                        >
                            <Columns size={14} />
                            <span>分屏</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('preview')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                                viewMode === 'preview'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                            title="仅预览模式"
                        >
                            <Eye size={14} />
                            <span className="hidden sm:inline">预览</span>
                        </button>
                    </div>

                    {/* 复制全部 */}
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700/60 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                        title="复制 Markdown 原文"
                    >
                        {copySuccess ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        <span className="hidden md:inline">{copySuccess ? '已复制' : '复制'}</span>
                    </button>

                    {/* 撤销重置 */}
                    <button
                        type="button"
                        onClick={() => fetchDocContent(selectedDocId)}
                        disabled={!isDirty || isLoadingContent}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 hover:text-white border border-gray-700/60 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                        title="重置放弃未保存修改"
                    >
                        <RotateCcw size={14} />
                        <span className="hidden md:inline">重置</span>
                    </button>

                    {/* 保存按钮 */}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canEdit || !isDirty || isSaving}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg active:scale-95 ${
                            !canEdit
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                                : isDirty
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/40'
                                : 'bg-gray-800 text-gray-400 border border-gray-700 cursor-not-allowed'
                        }`}
                        title={canEdit ? '保存更改至物理磁盘 (Ctrl+S)' : '您没有保存权限'}
                    >
                        {isSaving ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={14} />
                        )}
                        <span>{isSaving ? '保存中...' : '保存更改 (Ctrl+S)'}</span>
                    </button>
                </div>
            </div>

            {/* 文档标签页选择栏 */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
                {docs.map((d) => {
                    const isSelected = d.id === selectedDocId;
                    return (
                        <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                                if (isDirty) {
                                    if (!window.confirm('当前文档有未保存的修改，确定切换吗？')) {
                                        return;
                                    }
                                }
                                setSelectedDocId(d.id);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 flex items-center gap-2 ${
                                isSelected
                                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm'
                                    : 'bg-[#111827] text-gray-400 border-gray-800 hover:border-gray-700 hover:text-gray-200'
                            }`}
                        >
                            <FileCode size={14} className={isSelected ? 'text-blue-400' : 'text-gray-500'} />
                            <span>{d.title.split(' ')[0]}</span>
                            <span className="text-[10px] text-gray-500 font-mono">
                                ({d.relativePath.split('/').pop()})
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* 权限或反馈状态条 */}
            {feedback && (
                <div
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition animate-fade-in shrink-0 ${
                        feedback.type === 'success'
                            ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                            : 'bg-red-500/10 border border-red-500/30 text-red-300'
                    }`}
                >
                    {feedback.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {!canEdit && (
                <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 shrink-0">
                    <Lock size={15} className="shrink-0" />
                    <span>只读模式：当前账户角色 ({userRole}) 仅可查看文档，如需修改保存请使用管理员 (Admin/SuperAdmin) 账户。</span>
                </div>
            )}

            {/* 编辑工具栏 (仅在包含编辑视图时显示) */}
            {viewMode !== 'preview' && canEdit && (
                <div className="bg-[#111827] border border-gray-800 rounded-xl px-3 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 text-gray-400 text-xs">
                    <span className="text-[11px] font-bold text-gray-500 uppercase mr-1 hidden sm:inline">插入:</span>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('# ')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="一级标题 (# )"
                    >
                        <Heading1 size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('## ')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="二级标题 (## )"
                    >
                        <Heading2 size={15} />
                    </button>
                    <div className="w-[1px] h-4 bg-gray-800 mx-1" />
                    <button
                        type="button"
                        onClick={() => insertMarkdown('**', '**')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="加粗 (**粗体**)"
                    >
                        <Bold size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('*', '*')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="斜体 (*斜体*)"
                    >
                        <Italic size={15} />
                    </button>
                    <div className="w-[1px] h-4 bg-gray-800 mx-1" />
                    <button
                        type="button"
                        onClick={() => insertMarkdown('- ')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="无序列表 (- )"
                    >
                        <List size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('1. ')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="有序列表 (1. )"
                    >
                        <ListOrdered size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('> ')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="引用块 (> )"
                    >
                        <Quote size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('```markdown\n', '\n```')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="代码块 (```)"
                    >
                        <Code size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('\n| 标题 1 | 标题 2 |\n| :--- | :--- |\n| 单元格 1 | 单元格 2 |\n')}
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="Markdown 表格"
                    >
                        <Table size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('[链接文本](', ')') }
                        className="p-1.5 hover:bg-gray-800 hover:text-white rounded-lg transition"
                        title="超链接"
                    >
                        <LinkIcon size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertMarkdown('> [!NOTE]\n> ')}
                        className="px-2 py-1 hover:bg-gray-800 hover:text-blue-400 rounded-lg transition text-[11px] font-mono"
                        title="GitHub 提示块"
                    >
                        [!NOTE]
                    </button>
                </div>
            )}

            {/* 主内容区域：分屏 / 单栏 */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* 1. 编辑区域 */}
                {(viewMode === 'edit' || viewMode === 'split') && (
                    <div
                        className={`flex flex-col bg-[#0b0f17] border border-gray-800 rounded-2xl overflow-hidden shadow-inner ${
                            viewMode === 'edit' ? 'lg:col-span-2' : ''
                        }`}
                    >
                        <div className="bg-[#111827] border-b border-gray-800 px-3 py-2 flex items-center justify-between text-xs text-gray-400 shrink-0">
                            <span className="font-semibold flex items-center gap-1.5 text-gray-300">
                                <Edit3 size={13} className="text-blue-400" />
                                Markdown 原文编辑
                            </span>
                            <span className="text-[11px] font-mono text-gray-500">
                                {stats.lines} 行 • {stats.chars} 字符
                            </span>
                        </div>

                        <div className="flex-1 min-h-0 relative">
                            {isLoadingContent ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs text-gray-400">正在读取文档内容...</p>
                                    </div>
                                </div>
                            ) : null}
                            <textarea
                                ref={textareaRef}
                                value={content}
                                readOnly={!canEdit}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="在此输入或编辑 Markdown 内容..."
                                className="w-full h-full p-3 sm:p-4 bg-transparent text-gray-200 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 custom-scrollbar"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                )}

                {/* 2. 预览区域 */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                    <div
                        className={`flex flex-col bg-[#0b0f17] border border-gray-800 rounded-2xl overflow-hidden shadow-inner ${
                            viewMode === 'preview' ? 'lg:col-span-2' : ''
                        }`}
                    >
                        <div className="bg-[#111827] border-b border-gray-800 px-3 py-2 flex items-center justify-between text-xs text-gray-400 shrink-0">
                            <span className="font-semibold flex items-center gap-1.5 text-gray-300">
                                <Eye size={13} className="text-green-400" />
                                实时渲染预览 (GFM)
                            </span>
                            <span className="text-[11px] font-mono text-gray-500">
                                实时同步渲染
                            </span>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                            {content ? (
                                <div className="prose prose-invert prose-sm max-w-none space-y-3 leading-relaxed
                                    prose-headings:font-bold prose-headings:text-white prose-headings:tracking-tight prose-headings:border-b prose-headings:border-gray-800/80 prose-headings:pb-1.5
                                    prose-h1:text-xl sm:prose-h1:text-2xl prose-h1:text-blue-400
                                    prose-h2:text-lg sm:prose-h2:text-xl prose-h2:text-indigo-300 prose-h2:mt-6
                                    prose-h3:text-base prose-h3:text-gray-200
                                    prose-p:text-gray-300 prose-p:text-xs sm:prose-p:text-sm
                                    prose-a:text-blue-400 prose-a:underline hover:prose-a:text-blue-300
                                    prose-strong:text-white prose-strong:font-bold
                                    prose-code:text-amber-300 prose-code:bg-gray-800/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs
                                    prose-pre:bg-gray-900/90 prose-pre:border prose-pre:border-gray-800 prose-pre:rounded-xl prose-pre:p-3
                                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-500/5 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:text-gray-400 prose-blockquote:rounded-r-lg
                                    prose-table:border-collapse prose-table:w-full prose-table:text-xs
                                    prose-th:bg-gray-900 prose-th:border prose-th:border-gray-800 prose-th:p-2 prose-th:text-gray-200 prose-th:font-semibold
                                    prose-td:border prose-td:border-gray-800 prose-td:p-2 prose-td:text-gray-300
                                    prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5
                                    prose-hr:border-gray-800">
                                    <ReactMarkdown>{content}</ReactMarkdown>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                                    <FileCode size={36} className="mb-2 opacity-40" />
                                    <p>文档内容为空</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 底栏：物理路径与状态信息 */}
            <div className="bg-[#111827] border border-gray-800/80 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-gray-400 shrink-0">
                <div className="flex items-center gap-2 truncate">
                    <HardDrive size={13} className="text-gray-500 shrink-0" />
                    <span className="font-mono text-gray-300 truncate">
                        {selectedDoc ? `${selectedDoc.relativePath}` : '未知路径'}
                    </span>
                    {selectedDoc?.size ? (
                        <span className="text-gray-600 hidden md:inline">
                            ({(selectedDoc.size / 1024).toFixed(1)} KB)
                        </span>
                    ) : null}
                </div>

                <div className="flex items-center gap-4 text-gray-500">
                    {lastSavedTime && (
                        <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>上次保存: {lastSavedTime}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        <Shield size={12} className={canEdit ? 'text-green-500' : 'text-amber-500'} />
                        <span>{canEdit ? '写入权限有效' : '只读'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemDocsEditor;
