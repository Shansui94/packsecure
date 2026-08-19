import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import {
    Activity, AlertTriangle, CheckCircle, Lightbulb,
    GitCommit, BarChart2, ChevronDown, ChevronUp,
    Calendar, RefreshCw, Shield
} from 'lucide-react';
import { useTranslation } from "react-i18next";
import i18next from "i18next";

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
    [i18next.t('new features')]: 'bg-apple-blue/10 text-apple-blue border-apple-blue/20',
    [i18next.t('repair')]: 'bg-apple-green/10 text-apple-green border-apple-green/20',
    [i18next.t('optimization')]: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    [i18next.t('Refactor')]: 'bg-apple-orange/10 text-apple-orange border-apple-orange/20',
    [i18next.t('Configuration')]: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

const RISK_COLORS: Record<string, string> = {
    [i18next.t('high')]: 'bg-apple-red/10 border-apple-red/20 text-apple-red',
    [i18next.t('middle')]: 'bg-apple-orange/10 border-apple-orange/20 text-apple-orange',
    [i18next.t('Low')]: 'bg-apple-blue/10 border-apple-blue/20 text-apple-blue',
};


const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00+08:00');
    return d.toLocaleDateString('zh-MY', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

// ─── Log Card ────────────────────────────────────────────────
const LogCard: React.FC<{ log: DevLog }> = ({ log }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="apple-card p-0 overflow-hidden group">
            {/* Card Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-start gap-4">
                    {/* Date Badge */}
                    <div className="shrink-0 bg-apple-blue/10 border border-apple-blue/20 rounded-2xl p-2.5 flex flex-col items-center min-w-[56px] shadow-sm">
                        <span className="text-[10px] text-apple-blue font-bold uppercase tracking-widest mb-0.5">
                            {new Date(log.report_date + 'T00:00:00').toLocaleDateString('en', { month: 'short' })}
                        </span>
                        <span className="text-2xl font-black text-apple-blue leading-none">
                            {new Date(log.report_date + 'T00:00:00').getDate()}
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-apple-textMuted font-bold uppercase tracking-widest mb-1.5">
                            {formatDate(log.report_date)}
                        </div>
                        <p className="text-apple-textMain dark:text-white text-[15px] font-medium leading-relaxed line-clamp-2 pr-4">{log.summary || t('No abstract')}</p>

                        {/* Quick stats */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {log.commits_json?.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-apple-textMuted bg-black/5 dark:bg-white/10 px-2.5 py-1 rounded-full font-medium">
                                    <GitCommit size={12} /> {log.commits_json.length} commits
                                </span>
                            )}
                            {log.changes_json?.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-apple-green bg-apple-green/10 px-2.5 py-1 rounded-full font-medium">
                                    <CheckCircle size={12} /> {log.changes_json.length}  {t('changes')}
                                                                    </span>
                            )}
                            {log.risks_json?.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-apple-orange bg-apple-orange/10 px-2.5 py-1 rounded-full font-medium">
                                    <AlertTriangle size={12} /> {log.risks_json.length}  {t('risk')}
                                                                    </span>
                            )}
                            {log.metrics_json?.trips_created_today !== undefined && (
                                <span className="flex items-center gap-1 text-[10px] text-apple-blue bg-apple-blue/10 px-2.5 py-1 rounded-full font-medium">
                                    <BarChart2 size={12} /> {log.metrics_json.trips_created_today}  {t('trips today')}
                                                                    </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 text-apple-textMuted mt-1 group-hover:text-apple-blue transition-colors bg-black/5 dark:bg-white/10 p-1.5 rounded-full">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {/* Expanded Detail */}
            {expanded && (
                <div className="border-t border-black/5 dark:border-white/10 p-6 space-y-6 bg-black/[0.02] dark:bg-black/20">
                    {/* App Metrics */}
                    {log.metrics_json && (
                        <div>
                            <div className="text-[10px] text-apple-textMuted font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <BarChart2 size={14} className="text-apple-blue" />  {t('Today\'s application data')}
                                                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: t('Trip today'), value: log.metrics_json.trips_created_today ?? '-' },
                                    { label: t('No trip assigned'), value: log.metrics_json.trips_unassigned ?? '-' },
                                    { label: t('system user'), value: log.metrics_json.total_users ?? '-' },
                                ].map(m => (
                                    <div key={m.label} className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                                        <div className="text-xs text-apple-textMuted font-medium mb-1">{m.label}</div>
                                        <div className="text-2xl font-black text-apple-textMain dark:text-white">{m.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Changes */}
                    {log.changes_json?.length > 0 && (
                        <div>
                            <div className="text-[10px] text-apple-textMuted font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Activity size={14} className="text-apple-green" />  {t('Today\'s changes')}
                                                            </div>
                            <div className="space-y-2">
                                {log.changes_json.map((c, i) => (
                                    <div key={i} className="flex items-start gap-3 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                                        <span className={t('shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border {{var0}}', { var0: CHANGE_COLORS[c.type] || CHANGE_COLORS[t('Configuration')] })}>
                                            {c.type}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-[15px] font-medium text-apple-textMain dark:text-white">{c.description}</div>
                                            <div className="text-xs text-apple-textMuted mt-1">{t('Influence:')}{c.impact}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risks */}
                    {log.risks_json?.length > 0 && (
                        <div>
                            <div className="text-[10px] text-apple-textMuted font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Shield size={14} className="text-apple-red" />  {t('risk assessment')}
                                                            </div>
                            <div className="space-y-2">
                                {log.risks_json.map((r, i) => (
                                    <div key={i} className={`border rounded-2xl p-4 bg-white dark:bg-[#1C1C1E] shadow-sm flex flex-col`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={t('p-1.5 rounded-lg {{var0}}', { var0: RISK_COLORS[r.level] || RISK_COLORS[t('Low')] })}>
                                                <AlertTriangle size={14} />
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-apple-textMain dark:text-white">{r.level}{t('risk')}</span>
                                        </div>
                                        <div className="text-[14px] font-medium text-apple-textMain dark:text-white mb-1">{r.description}</div>
                                        <div className="text-xs text-apple-textMuted">{t('suggestion:')}{r.suggestion}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Git Commits */}
                    {log.commits_json?.length > 0 && (
                        <div>
                            <div className="text-[10px] text-apple-textMuted font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <GitCommit size={14} className="text-gray-400" /> Commits ({log.commits_json.length})
                            </div>
                            <div className="space-y-2 font-mono bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                                {log.commits_json.map((c, i) => (
                                    <div key={i} className="flex items-start gap-3 text-xs py-1 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0">
                                        <span className="text-apple-blue shrink-0 font-bold">{c.hash}</span>
                                        <span className="text-apple-textMain dark:text-slate-300 flex-1">{c.message}</span>
                                        <span className="text-apple-textMuted shrink-0 font-medium">{c.author}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {log.recommendations?.length > 0 && (
                        <div>
                            <div className="text-[10px] text-apple-textMuted font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Lightbulb size={14} className="text-apple-orange" />  {t('AI suggestions')}
                                                            </div>
                            <ul className="space-y-2 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-2xl p-5 shadow-sm">
                                {log.recommendations.map((r, i) => (
                                    <li key={i} className="flex items-start gap-3 text-[14px] text-apple-textMain dark:text-white font-medium">
                                        <div className="shrink-0 mt-0.5 bg-apple-orange/10 text-apple-orange p-1 rounded-full">
                                            <Lightbulb size={12} />
                                        </div>
                                        <span className="leading-relaxed">{r}</span>
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
    const { t } = useTranslation();
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
        <div className="p-6 max-w-4xl mx-auto pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-black text-apple-textMain dark:text-white mb-2 flex items-center gap-3">
                        <Activity size={28} className="text-apple-blue" />
                        Dev Log
                    </h1>
                    <p className="text-apple-textMuted text-[15px] font-medium">{t('AI-automated daily development activity reports')}</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="apple-btn-secondary"
                >
                    <RefreshCw size={16} />  {t('refresh')}
                                    </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                    { label: t('Record number of days'), value: logs.length, icon: <Calendar size={18} />, color: 'text-apple-blue', bg: 'bg-apple-blue/10' },
                    { label: t('Total Commits'), value: totalCommits, icon: <GitCommit size={18} />, color: 'text-apple-green', bg: 'bg-apple-green/10' },
                    { label: t('Total changes'), value: totalChanges, icon: <Activity size={18} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                    { label: t('Cumulative risk items'), value: totalRisks, icon: <AlertTriangle size={18} />, color: 'text-apple-orange', bg: 'bg-apple-orange/10' },
                ].map(s => (
                    <div key={s.label} className="apple-card flex flex-col items-center justify-center text-center p-5">
                        <div className={`p-2.5 rounded-xl mb-3 ${s.bg} ${s.color}`}>{s.icon}</div>
                        <div className="text-3xl font-black text-apple-textMain dark:text-white leading-none mb-2">{s.value}</div>
                        <div className="text-[10px] text-apple-textMuted font-bold uppercase tracking-widest">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Log Timeline */}
            {loading ? (
                <div className="text-center py-20 text-apple-textMuted font-medium animate-pulse">Loading dev logs...</div>
            ) : logs.length === 0 ? (
                <div className="text-center py-24 apple-card border-dashed">
                    <Activity size={48} className="mx-auto text-black/20 dark:text-white/20 mb-5" />
                    <div className="text-apple-textMain dark:text-white font-bold text-lg">{t('No logs yet')}</div>
                    <div className="text-apple-textMuted text-[15px] mt-2 max-w-sm mx-auto">
                        
                                                    {t('First perform SQL migration in Supabase, then set Secrets in GitHub, and then manually trigger the Actions workflow')}
                                                </div>
                </div>
            ) : (
                <div className="space-y-5 relative before:absolute before:inset-y-0 before:left-[42px] before:w-0.5 before:bg-black/5 dark:before:bg-white/10">
                    {logs.map(log => (
                        <div key={log.id} className="relative z-10">
                            <LogCard log={log} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DevLog;
