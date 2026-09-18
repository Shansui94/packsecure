import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import {
    Activity, AlertTriangle, CheckCircle, Lightbulb,
    GitCommit, BarChart2, ChevronDown, ChevronUp,
    Calendar, RefreshCw, Shield, Plus, PenSquare,
    Copy, Trash2, Check, Search, Filter, Layers,
    CheckCircle2, Sparkles, MessageSquare
} from 'lucide-react';
import { useTranslation } from "react-i18next";
import { DevLogModal, formatWhatsAppReport, type DevLogRecord } from '../components/DevLogModal';

interface Commit {
    hash: string;
    author: string;
    message: string;
    files: string[];
}

interface Metrics {
    trips_created_today: number;
    trips_unassigned: number;
    total_users: number;
    user_roles: Record<string, number>;
    report_date: string;
}

interface Change {
    type: '新功能' | '修复' | '优化' | '重构' | '任务完成' | '配置' | string;
    description: string;
    impact: string;
}

interface Risk {
    level: '高' | '中' | '低' | string;
    description: string;
    suggestion: string;
}

interface DevLogProps {
    user?: any;
    onNavigate?: (page: string) => void;
}

// ── Resilient Color Resolvers ──────────────────────────────────
const getChangeBadgeStyle = (type: string = '') => {
    const lower = type.toLowerCase();
    if (lower.includes('新') || lower.includes('feat')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (lower.includes('修') || lower.includes('fix') || lower.includes('bug')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (lower.includes('优') || lower.includes('opt')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (lower.includes('构') || lower.includes('refactor')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (lower.includes('任务') || lower.includes('task')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

const getRiskBadgeStyle = (level: string = '') => {
    const lower = level.toLowerCase();
    if (lower.includes('高') || lower.includes('high')) return 'bg-red-500/10 border-red-500/20 text-red-400';
    if (lower.includes('中') || lower.includes('mid') || lower.includes('med')) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
};

const formatDate = (dateStr: string) => {
    try {
        const d = new Date(dateStr + 'T00:00:00+08:00');
        return d.toLocaleDateString('zh-MY', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    } catch {
        return dateStr;
    }
};

// ─── Log Card Component ───────────────────────────────────────
const LogCard: React.FC<{
    log: DevLogRecord;
    onEdit: (log: DevLogRecord) => void;
    onDelete: (id: string, date: string) => void;
}> = ({ log, onEdit, onDelete }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = formatWhatsAppReport(log);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`确定要删除 ${log.report_date} 的日志报告吗？此操作不可逆。`)) {
            onDelete(log.id || '', log.report_date);
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(log);
    };

    const hasTasks = log.changes_json?.some(c => c.type === '任务完成' || c.description?.includes('Task') || c.description?.includes('任务'));
    const hasUpgrades = log.changes_json?.some(c => c.type !== '任务完成');

    return (
        <div className="apple-card p-0 overflow-hidden group border border-white/5 hover:border-white/15 transition-all shadow-md">
            {/* Card Header (Click to toggle expansion) */}
            <div
                onClick={() => setExpanded(!expanded)}
                className="w-full p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Date Badge */}
                    <div className="shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-2.5 flex flex-col items-center min-w-[56px] shadow-sm">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-0.5">
                            {new Date(log.report_date + 'T00:00:00').toLocaleDateString('en', { month: 'short' })}
                        </span>
                        <span className="text-2xl font-black text-blue-400 leading-none">
                            {new Date(log.report_date + 'T00:00:00').getDate()}
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                                {formatDate(log.report_date)}
                            </span>
                            {hasUpgrades && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                    🚀 系统升级
                                </span>
                            )}
                            {hasTasks && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                    📋 任务汇报
                                </span>
                            )}
                        </div>

                        <p className="text-white text-[15px] font-medium leading-relaxed line-clamp-2 pr-2">
                            {log.summary || t('No abstract')}
                        </p>

                        {/* Quick Stats Badges */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {log.commits_json && log.commits_json.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-white/5 px-2.5 py-1 rounded-full font-medium border border-white/5">
                                    <GitCommit size={12} /> {log.commits_json.length} commits
                                </span>
                            )}
                            {log.changes_json && log.changes_json.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full font-medium border border-emerald-500/20">
                                    <CheckCircle size={12} /> {log.changes_json.length} {t('changes')}
                                </span>
                            )}
                            {log.risks_json && log.risks_json.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full font-medium border border-amber-500/20">
                                    <AlertTriangle size={12} /> {log.risks_json.length} {t('risk')}
                                </span>
                            )}
                            {log.metrics_json?.trips_created_today !== undefined && (
                                <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full font-medium border border-blue-500/20">
                                    <BarChart2 size={12} /> {log.metrics_json.trips_created_today} {t('trips today')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                        type="button"
                        onClick={handleCopy}
                        title="复制为 WhatsApp 日报"
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 ${copied ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'}`}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        <span className="hidden sm:inline">{copied ? '已复制' : '复制日报'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleEdit}
                        title="编辑此日志"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition active:scale-95"
                    >
                        <PenSquare size={14} />
                    </button>

                    <button
                        type="button"
                        onClick={handleDelete}
                        title="删除日志"
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 text-gray-400 hover:text-red-400 transition active:scale-95"
                    >
                        <Trash2 size={14} />
                    </button>

                    <div className="p-2 text-gray-400 group-hover:text-blue-400 transition-colors bg-white/5 rounded-xl ml-1">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>
            </div>

            {/* Expanded Detail */}
            {expanded && (
                <div className="border-t border-white/5 p-6 space-y-6 bg-black/20">
                    {/* App Metrics if present */}
                    {log.metrics_json && Object.keys(log.metrics_json).length > 0 && (
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <BarChart2 size={14} className="text-blue-400" />
                                今日系统数据指标
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: '今日新建行程 (Trip)', value: log.metrics_json.trips_created_today ?? '-' },
                                    { label: '待分配行程', value: log.metrics_json.trips_unassigned ?? '-' },
                                    { label: '系统活跃用户', value: log.metrics_json.total_users ?? '-' },
                                ].map(m => (
                                    <div key={m.label} className="bg-white/5 border border-white/5 rounded-2xl p-4 shadow-sm">
                                        <div className="text-xs text-gray-400 font-medium mb-1">{m.label}</div>
                                        <div className="text-2xl font-black text-white">{m.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Changes & Task Details */}
                    {log.changes_json && log.changes_json.length > 0 && (
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Activity size={14} className="text-emerald-400" />
                                变更与 Task 明细清单 ({log.changes_json.length})
                            </div>
                            <div className="space-y-2">
                                {log.changes_json.map((c, i) => (
                                    <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/5 rounded-2xl p-4 shadow-sm">
                                        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${getChangeBadgeStyle(c.type)}`}>
                                            {c.type || '变更'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[15px] font-medium text-white">{c.description}</div>
                                            {c.impact && (
                                                <div className="text-xs text-gray-400 mt-1">影响范围: {c.impact}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risks */}
                    {log.risks_json && log.risks_json.length > 0 && (
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Shield size={14} className="text-amber-400" />
                                风险评估与关注项
                            </div>
                            <div className="space-y-2">
                                {log.risks_json.map((r, i) => (
                                    <div key={i} className="border border-white/5 rounded-2xl p-4 bg-white/5 shadow-sm flex flex-col">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`p-1.5 rounded-lg border ${getRiskBadgeStyle(r.level)}`}>
                                                <AlertTriangle size={14} />
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-white">
                                                {r.level}风险
                                            </span>
                                        </div>
                                        <div className="text-[14px] font-medium text-white mb-1">{r.description}</div>
                                        {r.suggestion && (
                                            <div className="text-xs text-gray-400">应对策略: {r.suggestion}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations & Next Steps */}
                    {log.recommendations && log.recommendations.length > 0 && (
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Lightbulb size={14} className="text-amber-400" />
                                明日计划重点与后续建议
                            </div>
                            <ul className="space-y-2 bg-white/5 border border-white/5 rounded-2xl p-4 shadow-sm">
                                {log.recommendations.map((r, i) => (
                                    <li key={i} className="flex items-start gap-3 text-[14px] text-white font-medium">
                                        <div className="shrink-0 mt-0.5 bg-amber-500/10 text-amber-400 p-1 rounded-full border border-amber-500/20">
                                            <Lightbulb size={12} />
                                        </div>
                                        <span className="leading-relaxed">{r}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Git Commits */}
                    {log.commits_json && log.commits_json.length > 0 && (
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <GitCommit size={14} className="text-gray-400" />
                                代码提交记录 ({log.commits_json.length})
                            </div>
                            <div className="space-y-2 font-mono bg-black/40 border border-white/5 rounded-2xl p-4 shadow-sm">
                                {log.commits_json.map((c, i) => (
                                    <div key={i} className="flex items-start gap-3 text-xs py-1 border-b border-white/5 last:border-0">
                                        <span className="text-blue-400 shrink-0 font-bold">{c.hash}</span>
                                        <span className="text-gray-200 flex-1">{c.message}</span>
                                        <span className="text-gray-400 shrink-0 font-medium">{c.author}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main DevLog Page ─────────────────────────────────────────
const DevLog: React.FC<DevLogProps> = ({ user, onNavigate }) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<DevLogRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter & search states
    const [activeFilter, setActiveFilter] = useState<'all' | 'upgrades' | 'tasks'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<DevLogRecord | null>(null);

    const todayStr = new Date().toLocaleDateString('en-CA');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('dev_logs')
                .select('*')
                .order('report_date', { ascending: false })
                .limit(60);

            if (!error && data) {
                setLogs(data as DevLogRecord[]);
            }
        } catch (e) {
            console.error('Fetch logs error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // Handle Log Saved
    const handleLogSaved = (saved: DevLogRecord) => {
        fetchLogs();
    };

    // Handle Log Delete
    const handleDeleteLog = async (id: string, dateStr: string) => {
        try {
            const resp = await fetch(`/api/dev-log?action=delete&id=${id}&report_date=${dateStr}`, { method: 'POST' });
            if (resp.ok) {
                setLogs(logs.filter(l => l.id !== id && l.report_date !== dateStr));
                return;
            }
            // Fallback direct delete
            const { error } = await supabase.from('dev_logs').delete().eq('report_date', dateStr);
            if (!error) {
                setLogs(logs.filter(l => l.report_date !== dateStr));
            } else {
                alert('删除失败: ' + error.message);
            }
        } catch (e: any) {
            alert('删除异常: ' + e.message);
        }
    };

    // Open Modal for New Log
    const handleOpenNewModal = () => {
        setEditingLog(null);
        setIsModalOpen(true);
    };

    // Open Modal for Editing Log
    const handleOpenEditModal = (log: DevLogRecord) => {
        setEditingLog(log);
        setIsModalOpen(true);
    };

    // Auto-sync Today from Git and Tasks with AI
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);
    const handleAutoSyncToday = async () => {
        setIsAutoSyncing(true);
        try {
            const gitResp = await fetch(`/api/dev-log?action=fetch-git&date=${todayStr}`).then(r => r.json());
            const tasksResp = await fetch(`/api/dev-log?action=fetch-tasks&date=${todayStr}`).then(r => r.json());

            const aiResp = await fetch('/api/dev-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'ai-polish',
                    report_date: todayStr,
                    version: '最新版本更新与日常任务完成',
                    rawText: '自动根据今日系统代码提交与协同任务完成情况提炼总结。',
                    tasks: tasksResp.tasks?.slice(0, 10),
                    commits: gitResp.commits
                })
            }).then(r => r.json());

            if (aiResp.result) {
                await fetch('/api/dev-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'upsert',
                        report_date: todayStr,
                        summary: aiResp.result?.summary,
                        changes_json: aiResp.result?.changes,
                        risks_json: aiResp.result?.risks,
                        recommendations: aiResp.result?.recommendations,
                        commits_json: gitResp.commits
                    })
                });
                await fetchLogs();
                alert('✅ 已成功基于今日最新 Git 提交与协同任务，由 AI 自动生成并同步今日开发汇报！');
            }
        } catch (e: any) {
            alert('自动同步异常: ' + (e.message || '网络超时'));
        } finally {
            setIsAutoSyncing(false);
        }
    };

    // Filtered logs
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Category filter
            if (activeFilter === 'upgrades') {
                const hasUpgrade = log.changes_json?.some(c => c.type !== '任务完成') || (log.commits_json?.length || 0) > 0;
                if (!hasUpgrade) return false;
            } else if (activeFilter === 'tasks') {
                const hasTask = log.changes_json?.some(c => c.type === '任务完成' || c.description?.includes('Task') || c.description?.includes('任务'));
                if (!hasTask) return false;
            }

            // Keyword / Date search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchDate = log.report_date.includes(q);
                const matchSummary = log.summary?.toLowerCase().includes(q);
                const matchChanges = log.changes_json?.some(c => c.description?.toLowerCase().includes(q) || c.type?.toLowerCase().includes(q));
                return matchDate || matchSummary || matchChanges;
            }

            return true;
        });
    }, [logs, activeFilter, searchQuery]);

    // Statistics
    const totalCommits = logs.reduce((s, l) => s + (l.commits_json?.length || 0), 0);
    const totalRisks = logs.reduce((s, l) => s + (l.risks_json?.length || 0), 0);
    const totalChanges = logs.reduce((s, l) => s + (l.changes_json?.length || 0), 0);
    const hasReportedToday = logs.some(l => l.report_date === todayStr);

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-24 animate-fade-in text-gray-200">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Activity size={32} className="text-blue-500" />
                        系统升级与工作日志
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Dev & Task Log
                        </span>
                    </h1>
                    <p className="text-gray-400 text-sm mt-1.5 flex items-center gap-2">
                        <span>每日 Task 进展汇报、系统版本迭代发布与 AI 结构化日志中心</span>
                        {hasReportedToday ? (
                            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 size={12} /> 今日已汇报
                            </span>
                        ) : (
                            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                                <AlertTriangle size={12} /> 今日待汇报
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={fetchLogs}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-gray-300 hover:text-white transition active:scale-95 cursor-pointer"
                        title="刷新日志"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin text-blue-400' : ''} />
                    </button>

                    <button
                        type="button"
                        onClick={handleAutoSyncToday}
                        disabled={isAutoSyncing}
                        className="px-3.5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-amber-400 hover:text-amber-300 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold disabled:opacity-50"
                        title="从本地 Git 提交与今日 Tasks 自动由 AI 提炼生成汇报"
                    >
                        <Sparkles size={16} className={isAutoSyncing ? 'animate-spin' : ''} />
                        <span>{isAutoSyncing ? 'AI 正在自动同步...' : '⚡ AI 自动同步今日'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenNewModal}
                        className="flex-1 md:flex-initial bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition active:scale-95 cursor-pointer"
                    >
                        <Plus size={18} />
                        <span>填写今日汇报 / 记录系统升级</span>
                    </button>
                </div>
            </div>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
                {[
                    { label: '累计汇报天数', value: logs.length, icon: <Calendar size={18} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: '累计变更与任务', value: totalChanges, icon: <Activity size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: '累计风险项', value: totalRisks, icon: <AlertTriangle size={18} />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Git 提交总数', value: totalCommits, icon: <GitCommit size={18} />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                ].map(s => (
                    <div key={s.label} className="apple-card flex flex-col items-center justify-center text-center p-4 sm:p-5 border border-white/5 shadow-md">
                        <div className={`p-2.5 rounded-2xl mb-2.5 ${s.bg} ${s.color}`}>{s.icon}</div>
                        <div className="text-2xl sm:text-3xl font-black text-white leading-none mb-1">{s.value}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400 font-bold tracking-wider">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-white/[0.02] p-2.5 rounded-2xl border border-white/5">
                {/* Tabs */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                    {[
                        { id: 'all', label: '全部汇报', count: logs.length },
                        { id: 'upgrades', label: '🚀 系统升级', count: logs.filter(l => l.changes_json?.some(c => c.type !== '任务完成')).length },
                        { id: 'tasks', label: '📋 任务汇报', count: logs.filter(l => l.changes_json?.some(c => c.type === '任务完成' || c.description?.includes('Task') || c.description?.includes('任务'))).length },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveFilter(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeFilter === tab.id ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span>{tab.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === tab.id ? 'bg-blue-700 text-white' : 'bg-white/10 text-gray-400'}`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Search Box */}
                <div className="relative flex-1 sm:max-w-xs">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="搜索日期 (YYYY-MM-DD) 或关键字..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Timeline List */}
            {loading ? (
                <div className="text-center py-20 text-gray-400 font-medium animate-pulse flex flex-col items-center gap-3">
                    <RefreshCw size={28} className="animate-spin text-blue-500" />
                    <span>正在同步开发与任务日志...</span>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="text-center py-20 apple-card border-dashed border-white/10 rounded-3xl p-8">
                    <Activity size={48} className="mx-auto text-gray-600 mb-4" />
                    <h3 className="text-white font-bold text-lg">暂无匹配的工作与升级日志</h3>
                    <p className="text-gray-400 text-sm mt-1.5 max-w-md mx-auto">
                        点击上方「填写今日汇报 / 记录系统升级」按钮，即可快速记录今天的系统版本改动或 Task 任务进展，并支持 AI 一键整理！
                    </p>
                    <button
                        type="button"
                        onClick={handleOpenNewModal}
                        className="mt-5 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                    >
                        <Plus size={16} /> 立即填写今日第一条汇报
                    </button>
                </div>
            ) : (
                <div className="space-y-5 relative before:absolute before:inset-y-0 before:left-[42px] before:w-0.5 before:bg-white/5">
                    {filteredLogs.map(log => (
                        <div key={log.id || log.report_date} className="relative z-10">
                            <LogCard
                                log={log}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteLog}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Interactive Report Editor Modal */}
            <DevLogModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSaved={handleLogSaved}
                initialLog={editingLog}
            />

        </div>
    );
};

export default DevLog;
