import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import {
    Activity, AlertTriangle, CheckCircle, Lightbulb,
    GitCommit, BarChart2, ChevronDown, ChevronUp,
    Calendar, RefreshCw, Shield
} from 'lucide-react';

interface DevLog {
    id: string;
    report_date: string;
    summary: string;
    commits_json: Commit[];
    metrics_json: Metrics;
    changes_json: Change[];
    risks_json: Risk[];
    recommendations: string[];
    created_at: string;
}

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
    type: '新功能' | '修复' | '优化' | '重构' | '配置' | string;
    description: string;
    impact: string;
}

interface Risk {
    level: '高' | '中' | '低';
    description: string;
    suggestion: string;
}

const CHANGE_COLORS: Record<string, string> = {
    '新功能': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    '修复': 'bg-green-500/20 text-green-300 border-green-500/30',
    '优化': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    '重构': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    '配置': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const RISK_COLORS: Record<string, string> = {
    '高': 'bg-red-500/10 border-red-500/30 text-red-400',
    '中': 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    '低': 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};


const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00+08:00');
    return d.toLocaleDateString('zh-MY', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

// ─── Log Card ────────────────────────────────────────────────
const LogCard: React.FC<{ log: DevLog }> = ({ log }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-[#111113] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all">
            {/* Card Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-start gap-4">
                    {/* Date Badge */}
                    <div className="shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 flex flex-col items-center min-w-[52px]">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                            {new Date(log.report_date + 'T00:00:00').toLocaleDateString('en', { month: 'short' })}
                        </span>
                        <span className="text-xl font-black text-white leading-none">
                            {new Date(log.report_date + 'T00:00:00').getDate()}
                        </span>
                    </div>

                    <div className="min-w-0">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">
                            {formatDate(log.report_date)}
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed line-clamp-2">{log.summary || '无摘要'}</p>

                        {/* Quick stats */}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {log.commits_json?.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                                    <GitCommit size={10} /> {log.commits_json.length} commits
                                </span>
                            )}
                            {log.changes_json?.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-green-500/70 bg-green-500/5 px-2 py-0.5 rounded-full">
                                    <CheckCircle size={10} /> {log.changes_json.length} 项改动
                                </span>
                            )}
                            {log.risks_json?.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-amber-500/70 bg-amber-500/5 px-2 py-0.5 rounded-full">
                                    <AlertTriangle size={10} /> {log.risks_json.length} 风险
                                </span>
                            )}
                            {log.metrics_json?.trips_created_today !== undefined && (
                                <span className="flex items-center gap-1 text-[10px] text-blue-500/70 bg-blue-500/5 px-2 py-0.5 rounded-full">
                                    <BarChart2 size={10} /> {log.metrics_json.trips_created_today} trips 今日
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 text-slate-600 mt-1">
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </button>

            {/* Expanded Detail */}
            {expanded && (
                <div className="border-t border-white/5 p-5 space-y-5">
                    {/* App Metrics */}
                    {log.metrics_json && (
                        <div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <BarChart2 size={12} /> 今日应用数据
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Trip 今日', value: log.metrics_json.trips_created_today ?? '-' },
                                    { label: '未分配 Trip', value: log.metrics_json.trips_unassigned ?? '-' },
                                    { label: '系统用户', value: log.metrics_json.total_users ?? '-' },
                                ].map(m => (
                                    <div key={m.label} className="bg-[#0a0a0c] border border-white/5 rounded-xl p-3">
                                        <div className="text-[10px] text-slate-600 mb-0.5">{m.label}</div>
                                        <div className="text-xl font-black text-white">{m.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Changes */}
                    {log.changes_json?.length > 0 && (
                        <div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Activity size={12} /> 今日改动
                            </div>
                            <div className="space-y-2">
                                {log.changes_json.map((c, i) => (
                                    <div key={i} className="flex items-start gap-3 bg-white/[0.02] rounded-xl p-3">
                                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${CHANGE_COLORS[c.type] || CHANGE_COLORS['配置']}`}>
                                            {c.type}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-sm text-slate-200">{c.description}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">影响：{c.impact}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risks */}
                    {log.risks_json?.length > 0 && (
                        <div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Shield size={12} /> 风险评估
                            </div>
                            <div className="space-y-2">
                                {log.risks_json.map((r, i) => (
                                    <div key={i} className={`border rounded-xl p-3 ${RISK_COLORS[r.level] || RISK_COLORS['低']}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <AlertTriangle size={12} />
                                            <span className="text-[10px] font-black uppercase tracking-wider">{r.level}风险</span>
                                        </div>
                                        <div className="text-sm font-medium">{r.description}</div>
                                        <div className="text-[11px] opacity-70 mt-1">建议：{r.suggestion}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Git Commits */}
                    {log.commits_json?.length > 0 && (
                        <div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <GitCommit size={12} /> Commits ({log.commits_json.length})
                            </div>
                            <div className="space-y-1.5 font-mono">
                                {log.commits_json.map((c, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                        <span className="text-blue-500/60 shrink-0">{c.hash}</span>
                                        <span className="text-slate-300 flex-1">{c.message}</span>
                                        <span className="text-slate-600 shrink-0">{c.author}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {log.recommendations?.length > 0 && (
                        <div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Lightbulb size={12} /> AI 建议
                            </div>
                            <ul className="space-y-1.5">
                                {log.recommendations.map((r, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                        <span className="text-blue-400 shrink-0 mt-0.5">→</span>
                                        {r}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────
const DevLog: React.FC = () => {
    const [logs, setLogs] = useState<DevLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('dev_logs')
            .select('*')
            .order('report_date', { ascending: false })
            .limit(30);

        if (!error && data) setLogs(data as DevLog[]);
        setLoading(false);
    };

    useEffect(() => { fetchLogs(); }, []);

    const totalCommits = logs.reduce((s, l) => s + (l.commits_json?.length || 0), 0);
    const totalRisks = logs.reduce((s, l) => s + (l.risks_json?.length || 0), 0);
    const totalChanges = logs.reduce((s, l) => s + (l.changes_json?.length || 0), 0);

    return (
        <div className="p-6 max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                        <Activity size={22} className="text-blue-400" />
                        Dev Log
                    </h1>
                    <p className="text-slate-400 text-sm">AI 自动生成的每日开发活动报告</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-all"
                >
                    <RefreshCw size={13} /> 刷新
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                    { label: '记录天数', value: logs.length, icon: <Calendar size={16} />, color: 'text-blue-400' },
                    { label: '总 Commits', value: totalCommits, icon: <GitCommit size={16} />, color: 'text-green-400' },
                    { label: '总改动项', value: totalChanges, icon: <Activity size={16} />, color: 'text-purple-400' },
                    { label: '累计风险项', value: totalRisks, icon: <AlertTriangle size={16} />, color: 'text-amber-400' },
                ].map(s => (
                    <div key={s.label} className="bg-[#111113] border border-white/5 rounded-2xl p-4">
                        <div className={`flex items-center gap-2 mb-2 ${s.color}`}>{s.icon}</div>
                        <div className="text-2xl font-black text-white">{s.value}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Log Timeline */}
            {loading ? (
                <div className="text-center py-20 text-slate-600 animate-pulse">Loading dev logs...</div>
            ) : logs.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl">
                    <Activity size={40} className="mx-auto text-slate-700 mb-4" />
                    <div className="text-slate-500 font-medium">还没有日志</div>
                    <div className="text-slate-600 text-sm mt-1">
                        先在 Supabase 执行 SQL migration，再在 GitHub 设置 Secrets，然后手动触发 Actions 工作流
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {logs.map(log => <LogCard key={log.id} log={log} />)}
                </div>
            )}
        </div>
    );
};

export default DevLog;
