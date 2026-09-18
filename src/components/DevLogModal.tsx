import React, { useState, useEffect } from 'react';
import {
    X, Sparkles, Check, Copy, Calendar, Plus, Trash2,
    CheckCircle2, AlertTriangle, Lightbulb, GitCommit,
    Layers, Bot, ArrowRight, Loader2, RefreshCw
} from 'lucide-react';
import { supabase } from '../services/supabase';

export interface DevLogRecord {
    id?: string;
    report_date: string;
    summary: string;
    commits_json?: any[];
    metrics_json?: any;
    changes_json: Array<{
        type: '新功能' | '修复' | '优化' | '重构' | '任务完成' | '配置' | string;
        description: string;
        impact: string;
    }>;
    risks_json: Array<{
        level: '高' | '中' | '低' | string;
        description: string;
        suggestion: string;
    }>;
    recommendations: string[];
    created_at?: string;
}

export type DevLog = DevLogRecord;

interface DevLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: (log: DevLogRecord) => void;
    initialLog?: DevLogRecord | null;
    initialTasks?: any[];
}

export function formatWhatsAppReport(log: DevLogRecord, versionTag?: string): string {
    const date = log.report_date;
    const lines = [
        `📅 *【Packsecure 每日工作与系统升级汇报】*`,
        `📆 日期：${date}${versionTag ? ` (版本: ${versionTag})` : ''}`,
        ``,
        `📌 *今日核心总结*：`,
        `${log.summary || '今日完成系统迭代维护与日常任务处理。'}`,
        ``
    ];

    if (log.changes_json && log.changes_json.length > 0) {
        lines.push(`🚀 *系统更新与 Task 进展*：`);
        log.changes_json.forEach((c, idx) => {
            lines.push(`${idx + 1}. [${c.type || '变更'}] ${c.description}${c.impact ? ` (影响: ${c.impact})` : ''}`);
        });
        lines.push(``);
    }

    if (log.risks_json && log.risks_json.length > 0) {
        lines.push(`⚠️ *风险评估与关注项*：`);
        log.risks_json.forEach((r, idx) => {
            lines.push(`• [${r.level || '低'}风险] ${r.description}${r.suggestion ? ` (建议: ${r.suggestion})` : ''}`);
        });
        lines.push(``);
    }

    if (log.recommendations && log.recommendations.length > 0) {
        lines.push(`🎯 *明日计划与优化建议*：`);
        log.recommendations.forEach((rec, idx) => {
            lines.push(`${idx + 1}. ${rec}`);
        });
        lines.push(``);
    }

    lines.push(`⚙️ _Packsecure OS Dev Center_`);
    return lines.join('\n');
}

export const DevLogModal: React.FC<DevLogModalProps> = ({
    isOpen,
    onClose,
    onSaved,
    initialLog,
    initialTasks = []
}) => {
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const [reportDate, setReportDate] = useState<string>(todayStr);
    const [version, setVersion] = useState<string>('');
    const [summary, setSummary] = useState<string>('');
    const [rawDraft, setRawDraft] = useState<string>('');
    const [changes, setChanges] = useState<Array<{ type: string; description: string; impact: string }>>([
        { type: '新功能', description: '', impact: '全厂系统' }
    ]);
    const [risks, setRisks] = useState<Array<{ level: string; description: string; suggestion: string }>>([]);
    const [recommendations, setRecommendations] = useState<string[]>(['']);
    const [commits, setCommits] = useState<any[]>([]);

    // Task importing state
    const [availableTasks, setAvailableTasks] = useState<any[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [showTaskPicker, setShowTaskPicker] = useState(false);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);

    // AI and Saving state
    const [isAiPolishing, setIsAiPolishing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Initialize or reset form
    useEffect(() => {
        if (!isOpen) return;

        if (initialLog) {
            setReportDate(initialLog.report_date || todayStr);
            setSummary(initialLog.summary || '');
            setChanges(initialLog.changes_json?.length ? initialLog.changes_json : [{ type: '新功能', description: '', impact: '系统' }]);
            setRisks(initialLog.risks_json || []);
            setRecommendations(initialLog.recommendations?.length ? initialLog.recommendations : ['']);
            setCommits(initialLog.commits_json || []);
            setRawDraft('');
        } else {
            setReportDate(todayStr);
            setVersion('');
            setSummary('');
            setRawDraft('');
            setChanges([{ type: '新功能', description: '', impact: '全厂系统' }]);
            setRisks([]);
            setRecommendations(['']);
            setCommits([]);

            // If initial tasks passed from Tasks.tsx
            if (initialTasks.length > 0) {
                const prefilledChanges = initialTasks.map(t => ({
                    type: t.status === 'Done' ? '任务完成' : '修复',
                    description: t.title + (t.description ? ` (${t.description})` : ''),
                    impact: '协同任务'
                }));
                setChanges(prefilledChanges);
            }
        }
    }, [isOpen, initialLog, initialTasks]);

    if (!isOpen) return null;

    // ── Fetch DB Tasks ──
    const fetchTasks = async () => {
        setIsLoadingTasks(true);
        setShowTaskPicker(true);
        try {
            const resp = await fetch(`/api/dev-log?action=fetch-tasks&date=${reportDate}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.tasks) {
                    setAvailableTasks(data.tasks);
                    return;
                }
            }
            // Fallback direct Supabase
            const { data, error } = await supabase
                .from('tasks')
                .select('id, title, description, status, priority, created_at')
                .order('created_at', { ascending: false })
                .limit(30);

            if (!error && data) {
                setAvailableTasks(data);
            }
        } catch (e: any) {
            console.error('Fetch tasks error:', e);
        } finally {
            setIsLoadingTasks(false);
        }
    };

    // ── Toggle task selection ──
    const toggleTaskSelection = (t: any) => {
        const next = new Set(selectedTaskIds);
        if (next.has(t.id)) {
            next.delete(t.id);
        } else {
            next.add(t.id);
        }
        setSelectedTaskIds(next);
    };

    // ── Apply selected tasks to changes ──
    const applySelectedTasks = () => {
        const chosen = availableTasks.filter(t => selectedTaskIds.has(t.id));
        if (chosen.length === 0) return;

        const newItems = chosen.map(t => ({
            type: t.status === 'Done' ? '任务完成' : '优化',
            description: t.title + (t.description ? ` - ${t.description}` : ''),
            impact: '日常任务'
        }));

        setChanges(prev => [...prev.filter(c => c.description.trim() !== ''), ...newItems]);
        setShowTaskPicker(false);
        showToast(`已成功导入 ${chosen.length} 项系统任务！`);
    };

    // ── Fetch Git Commits ──
    const fetchGitCommits = async () => {
        try {
            const resp = await fetch(`/api/dev-log?action=fetch-git&date=${reportDate}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.commits && data.commits.length > 0) {
                    setCommits(data.commits);
                    showToast(`已提取 ${data.commits.length} 条 Git 提交`);
                } else {
                    showToast('未检测到今日本地 Git 提交（可能处于线上环境）');
                }
            }
        } catch (e) {
            showToast('Git 获取失败，可在下方草稿中输入说明');
        }
    };

    // ── AI Polish ──
    const handleAiPolish = async () => {
        setIsAiPolishing(true);
        try {
            const chosenTasks = availableTasks.filter(t => selectedTaskIds.has(t.id));
            const payload = {
                action: 'ai-polish',
                report_date: reportDate,
                version: version.trim(),
                rawText: rawDraft.trim(),
                tasks: chosenTasks.length > 0 ? chosenTasks : changes.map(c => ({ status: c.type, title: c.description })),
                commits: commits
            };

            const resp = await fetch('/api/dev-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errJson = await resp.json();
                throw new Error(errJson.error || 'AI polish failed');
            }

            const { result } = await resp.json();
            if (result) {
                if (result.summary) setSummary(result.summary);
                if (Array.isArray(result.changes) && result.changes.length > 0) {
                    setChanges(result.changes);
                }
                if (Array.isArray(result.risks) && result.risks.length > 0) {
                    setRisks(result.risks);
                }
                if (Array.isArray(result.recommendations) && result.recommendations.length > 0) {
                    setRecommendations(result.recommendations);
                }
                showToast('✨ AI 智能整理与润色完成！');
            }
        } catch (e: any) {
            console.error('AI polish error:', e);
            alert('AI 润色失败: ' + (e.message || '网络超时'));
        } finally {
            setIsAiPolishing(false);
        }
    };

    // ── Save to Supabase ──
    const handleSave = async () => {
        if (!reportDate) {
            alert('请选择汇报日期');
            return;
        }

        setIsSaving(true);
        const payload: DevLog = {
            id: initialLog?.id,
            report_date: reportDate,
            summary: summary.trim(),
            changes_json: changes.filter(c => c.description.trim() !== ''),
            risks_json: risks.filter(r => r.description.trim() !== ''),
            recommendations: recommendations.filter(r => r.trim() !== ''),
            commits_json: commits
        };

        try {
            // 1. Try server API
            const resp = await fetch('/api/dev-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'upsert', ...payload })
            });

            if (resp.ok) {
                const result = await resp.json();
                onSaved(result.data || payload);
                onClose();
                return;
            }

            // 2. Direct Supabase fallback
            const { data, error } = await supabase
                .from('dev_logs')
                .upsert(payload, { onConflict: 'report_date' })
                .select()
                .single();

            if (error) throw error;
            onSaved(data as DevLog);
            onClose();
        } catch (e: any) {
            alert('保存失败: ' + (e.message || '请检查数据库连接'));
        } finally {
            setIsSaving(false);
        }
    };

    // ── Copy WhatsApp Format ──
    const handleCopyWhatsApp = () => {
        const payload: DevLog = {
            report_date: reportDate,
            summary: summary.trim(),
            changes_json: changes.filter(c => c.description.trim() !== ''),
            risks_json: risks.filter(r => r.description.trim() !== ''),
            recommendations: recommendations.filter(r => r.trim() !== '')
        };
        const text = formatWhatsAppReport(payload, version);
        navigator.clipboard.writeText(text);
        showToast('📋 WhatsApp / 微信格式日报已复制到剪贴板！');
    };

    // Dynamic list mutators
    const addChangeItem = () => setChanges([...changes, { type: '优化', description: '', impact: '业务模块' }]);
    const removeChangeItem = (idx: number) => setChanges(changes.filter((_, i) => i !== idx));

    const addRiskItem = () => setRisks([...risks, { level: '低', description: '', suggestion: '' }]);
    const removeRiskItem = (idx: number) => setRisks(risks.filter((_, i) => i !== idx));

    const addRecItem = () => setRecommendations([...recommendations, '']);
    const removeRecItem = (idx: number) => setRecommendations(recommendations.filter((_, i) => i !== idx));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
            {/* Modal Body */}
            <div className="bg-[#18181B] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
                
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold shadow-sm">
                            <Bot size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                                {initialLog ? '✏️ 编辑工作汇报与系统升级' : '📝 填写今日工作汇报与系统升级'}
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">记录每日 Task 进展、系统版本升级与 AI 结构化日志</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Tab switch */}
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs font-bold mr-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('form')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'form' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                编辑表单
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('preview')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'preview' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                汇报预览
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Toast message banner */}
                {toastMessage && (
                    <div className="bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-400 px-6 py-2.5 text-xs font-bold flex items-center gap-2 animate-fade-in">
                        <Check size={16} />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* Modal Content Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {activeTab === 'form' ? (
                        <>
                            {/* SECTION 1: Date & Version */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Calendar size={14} className="text-blue-400" /> 汇报日期 (Report Date)
                                    </label>
                                    <input
                                        type="date"
                                        value={reportDate}
                                        onChange={(e) => setReportDate(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Layers size={14} className="text-indigo-400" /> 版本代号 / 升级主题 (可选)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="例: v6.8.0 配送单多图识别与日志发布"
                                        value={version}
                                        onChange={(e) => setVersion(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500 text-sm placeholder-gray-600"
                                    />
                                </div>
                            </div>

                            {/* SECTION 2: AI Assistant & Quick Import Bar */}
                            <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/20 p-5 rounded-2xl space-y-3 shadow-inner">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={18} className="text-amber-400 animate-pulse" />
                                        <span className="text-sm font-bold text-white">AI 智能辅助与快速导入</span>
                                        <span className="text-[11px] text-blue-300/80 bg-blue-500/20 px-2 py-0.5 rounded-full font-medium">Gemini 2.5</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={fetchTasks}
                                            disabled={isLoadingTasks}
                                            className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-blue-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                                        >
                                            <CheckCircle2 size={14} />
                                            {isLoadingTasks ? '读取中...' : '⚡ 导入系统 Task'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={fetchGitCommits}
                                            className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-indigo-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                                        >
                                            <GitCommit size={14} />
                                            💻 提取 Git 提交
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAiPolish}
                                            disabled={isAiPolishing}
                                            className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
                                        >
                                            {isAiPolishing ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    AI 整理中...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={14} />
                                                    🤖 AI 一键整理生成
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Raw notes textarea */}
                                <div>
                                    <textarea
                                        rows={2}
                                        value={rawDraft}
                                        onChange={(e) => setRawDraft(e.target.value)}
                                        placeholder="快捷草稿备忘：可在这里随意输入今日完成的工作要点、改动或遇到的问题，点击「AI 一键整理生成」自动排版为专业结构化汇报..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-blue-400 placeholder-gray-500 custom-scrollbar"
                                    />
                                </div>

                                {/* Task picker modal/panel if triggered */}
                                {showTaskPicker && (
                                    <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-2 mt-2">
                                        <div className="flex items-center justify-between text-xs font-bold text-gray-300 mb-1">
                                            <span>选择要加入今日汇报的任务 ({availableTasks.length} 项可用)：</span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={applySelectedTasks}
                                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg font-bold"
                                                >
                                                    确认导入 ({selectedTaskIds.size})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTaskPicker(false)}
                                                    className="text-xs text-gray-400 hover:text-white px-2 py-1"
                                                >
                                                    关闭
                                                </button>
                                            </div>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                            {availableTasks.length === 0 ? (
                                                <p className="text-xs text-gray-500 py-2 text-center">暂无任务记录</p>
                                            ) : (
                                                availableTasks.map(t => {
                                                    const isChecked = selectedTaskIds.has(t.id);
                                                    return (
                                                        <div
                                                            key={t.id}
                                                            onClick={() => toggleTaskSelection(t)}
                                                            className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition ${isChecked ? 'bg-blue-500/20 border-blue-500/40 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {}}
                                                                className="rounded bg-black/40 border-white/20 text-blue-500"
                                                            />
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.status === 'Done' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                                {t.status}
                                                            </span>
                                                            <span className="font-medium flex-1 truncate">{t.title}</span>
                                                            <span className="text-[10px] text-gray-500">{new Date(t.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 3: Executive Summary */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span>今日核心工作总结 (Executive Summary)</span>
                                    <span className="text-[10px] text-gray-500 font-normal">向管理层展示的高层概览</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                    placeholder="阐述今天完成的关键系统升级或主要 Task 成果，言简意赅..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white font-medium focus:outline-none focus:border-blue-500 placeholder-gray-600 leading-relaxed custom-scrollbar"
                                />
                            </div>

                            {/* SECTION 4: Changes & Tasks List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <CheckCircle2 size={15} className="text-emerald-400" />
                                        系统更新与 Task 详细清单 ({changes.length})
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addChangeItem}
                                        className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/10 px-3 py-1 rounded-xl border border-blue-500/20 transition active:scale-95"
                                    >
                                        <Plus size={14} /> 添加改动/任务
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {changes.map((item, idx) => (
                                        <div key={idx} className="bg-black/30 border border-white/10 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3 group">
                                            {/* Type selector */}
                                            <select
                                                value={item.type}
                                                onChange={(e) => {
                                                    const updated = [...changes];
                                                    updated[idx].type = e.target.value;
                                                    setChanges(updated);
                                                }}
                                                className="bg-white/10 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-blue-400 shrink-0"
                                            >
                                                <option value="新功能" className="bg-[#1c1c1f]">✨ 新功能</option>
                                                <option value="修复" className="bg-[#1c1c1f]">🐛 修复</option>
                                                <option value="优化" className="bg-[#1c1c1f]">⚡ 优化</option>
                                                <option value="重构" className="bg-[#1c1c1f]">🧱 重构</option>
                                                <option value="任务完成" className="bg-[#1c1c1f]">✅ 任务完成</option>
                                                <option value="配置" className="bg-[#1c1c1f]">⚙️ 配置</option>
                                            </select>

                                            {/* Description */}
                                            <input
                                                type="text"
                                                placeholder="具体做了什么改动或完成了什么任务..."
                                                value={item.description}
                                                onChange={(e) => {
                                                    const updated = [...changes];
                                                    updated[idx].description = e.target.value;
                                                    setChanges(updated);
                                                }}
                                                className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-400 placeholder-gray-600"
                                            />

                                            {/* Impact */}
                                            <input
                                                type="text"
                                                placeholder="影响范围 (如: 司机端/车间/调度)"
                                                value={item.impact}
                                                onChange={(e) => {
                                                    const updated = [...changes];
                                                    updated[idx].impact = e.target.value;
                                                    setChanges(updated);
                                                }}
                                                className="w-full sm:w-44 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-400 placeholder-gray-600"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => removeChangeItem(idx)}
                                                className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg transition-colors shrink-0"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SECTION 5: Risks & Blockers */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <AlertTriangle size={15} className="text-amber-400" />
                                        风险评估与关注项 (Risks & Blockers)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addRiskItem}
                                        className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 transition active:scale-95"
                                    >
                                        <Plus size={14} /> 添加风险项
                                    </button>
                                </div>

                                {risks.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic bg-black/20 p-3 rounded-xl border border-dashed border-white/5">
                                        暂无风险项（如一切平稳，可无需添加）
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {risks.map((r, idx) => (
                                            <div key={idx} className="bg-black/30 border border-white/10 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                <select
                                                    value={r.level}
                                                    onChange={(e) => {
                                                        const updated = [...risks];
                                                        updated[idx].level = e.target.value;
                                                        setRisks(updated);
                                                    }}
                                                    className="bg-white/10 border border-white/10 rounded-xl px-2 py-1 text-xs font-bold text-white focus:outline-none shrink-0"
                                                >
                                                    <option value="低" className="bg-[#1c1c1f]">🟢 低风险</option>
                                                    <option value="中" className="bg-[#1c1c1f]">🟡 中风险</option>
                                                    <option value="高" className="bg-[#1c1c1f]">🔴 高风险</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="风险描述..."
                                                    value={r.description}
                                                    onChange={(e) => {
                                                        const updated = [...risks];
                                                        updated[idx].description = e.target.value;
                                                        setRisks(updated);
                                                    }}
                                                    className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="应对策略或建议..."
                                                    value={r.suggestion}
                                                    onChange={(e) => {
                                                        const updated = [...risks];
                                                        updated[idx].suggestion = e.target.value;
                                                        setRisks(updated);
                                                    }}
                                                    className="w-full sm:w-56 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeRiskItem(idx)}
                                                    className="text-gray-500 hover:text-red-400 p-1 shrink-0"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* SECTION 6: Tomorrow's Plan / Recommendations */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <Lightbulb size={15} className="text-amber-400" />
                                        明日计划与后续建议 (Next Steps)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addRecItem}
                                        className="text-xs text-gray-400 hover:text-white font-bold flex items-center gap-1 bg-white/5 px-3 py-1 rounded-xl border border-white/10 transition active:scale-95"
                                    >
                                        <Plus size={14} /> 添加计划项
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {recommendations.map((rec, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder={`明日计划或建议 #${idx + 1}...`}
                                                value={rec}
                                                onChange={(e) => {
                                                    const updated = [...recommendations];
                                                    updated[idx] = e.target.value;
                                                    setRecommendations(updated);
                                                }}
                                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeRecItem(idx)}
                                                className="text-gray-500 hover:text-red-400 p-1.5"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* PREVIEW TAB */
                        <div className="space-y-4">
                            <div className="p-4 bg-black/40 rounded-2xl border border-white/10">
                                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        WhatsApp / 微信 格式预览
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCopyWhatsApp}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                                    >
                                        <Copy size={14} /> 复制文本
                                    </button>
                                </div>
                                <pre className="font-mono text-xs sm:text-sm text-gray-200 whitespace-pre-wrap leading-relaxed bg-[#111113] p-4 rounded-xl border border-white/5 select-all">
                                    {formatWhatsAppReport({
                                        report_date: reportDate,
                                        summary,
                                        changes_json: changes.filter(c => c.description.trim() !== ''),
                                        risks_json: risks.filter(r => r.description.trim() !== ''),
                                        recommendations: recommendations.filter(r => r.trim() !== '')
                                    }, version)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white/[0.02]">
                    <button
                        type="button"
                        onClick={handleCopyWhatsApp}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition active:scale-95 cursor-pointer"
                    >
                        <Copy size={16} />
                        复制 WhatsApp 日报
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-gray-400 hover:text-white text-xs sm:text-sm font-bold rounded-xl transition"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            保存至系统日志
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
