import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import {
    ClipboardCheck, Calendar, MapPin, TrendingUp, TrendingDown,
    Minus, ChevronDown, ChevronUp, Search, Download, RefreshCw, AlertTriangle, User, Activity, PackageSearch, ShieldCheck, CheckCircle2
} from 'lucide-react';
import {
    Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ComposedChart, Line
} from 'recharts';
import { useTranslation } from 'react-i18next';

interface Props {
    user?: any;
}

interface AuditEntry {
    txn_id: string;
    sku: string;
    change_qty: number;
    loc_id: string;
    ref_doc: string;
    notes: string;
    timestamp: string;
    created_by_name?: string;
}

const parseNotes = (notes: string) => {
    const sysMatch = notes?.match(/System:\s*([\d.]+)/);
    const actMatch = notes?.match(/Actual:\s*([\d.]+)/);
    return {
        system: sysMatch ? sysMatch[1] : '–',
        actual: actMatch ? actMatch[1] : '–',
    };
};

interface AuditSession {
    ref_doc: string;
    date: string;
    location: string;
    items: AuditEntry[];
    total_adjustments: number; // Sum of absolute changes
    net_variance: number;      // Sum of actual changes (pos & neg)
    variance_percent: number;
    positive_count: number;
    negative_count: number;
    zero_variance_count: number;
    auditor: string;
    reviewed_by: string | null;
}

const AuditReport: React.FC<Props> = ({ user }) => {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<AuditSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [locFilter, setLocFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [locations, setLocations] = useState<string[]>([]);
    const [verifying, setVerifying] = useState<string | null>(null);
    const [skuNames, setSkuNames] = useState<Record<string, string>>({});

    const isManager = user?.role === 'Manager' || user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'HR';

    const fetchAudits = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('stock_ledger_v2')
            .select('txn_id, sku, change_qty, loc_id, ref_doc, notes, timestamp, created_by_name')
            .eq('event_type', 'Audit Adjustment')
            .order('timestamp', { ascending: false })
            .limit(1000);

        if (dateFrom) {
            const start = new Date(dateFrom);
            start.setHours(0, 0, 0, 0);
            query = query.gte('timestamp', start.toISOString());
        }
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            query = query.lte('timestamp', end.toISOString());
        }
        if (locFilter) query = query.eq('loc_id', locFilter);

        const { data, error } = await query;
        if (error) { console.error(error); setLoading(false); return; }
        
        // Fetch SKU Names
        const { data: skuData } = await supabase.from('master_items_v2').select('sku, name');
        const skuMap: Record<string, string> = {};
        (skuData || []).forEach(item => {
            skuMap[item.sku] = item.name || item.sku;
        });
        setSkuNames(skuMap);

        // Group by ref_doc (each audit session)
        const sessionMap: Record<string, AuditEntry[]> = {};
        const locs = new Set<string>();

        (data || []).forEach((row: any) => {
            const key = row.ref_doc || 'AUDIT-UNKNOWN';
            if (!sessionMap[key]) sessionMap[key] = [];
            sessionMap[key].push(row);
            if (row.loc_id) locs.add(row.loc_id);
        });

        const grouped: AuditSession[] = Object.entries(sessionMap).map(([ref, items]) => {
            const loc = items[0]?.loc_id || 'Unknown';
            const ts = items[0]?.timestamp || '';
            const auditor = items.find(i => i.created_by_name)?.created_by_name || 'System / Auto';
            
            // Check for verification notes
            const reviewedNote = items.find(i => i.notes?.includes('[Reviewed by '))?.notes;
            const reviewedMatch = reviewedNote?.match(/\[Reviewed by (.*?)\]/);
            const reviewed_by = reviewedMatch ? reviewedMatch[1] : null;

            let total_sys = 0;
            items.forEach(i => {
                const { system } = parseNotes(i.notes);
                if (system !== '–') total_sys += parseFloat(system) || 0;
            });

            const net_variance = items.reduce((s, i) => s + i.change_qty, 0);
            const var_percent = total_sys > 0 ? ((net_variance / total_sys) * 100).toFixed(1) : '0.0';

            return {
                ref_doc: ref,
                date: ts,
                location: loc,
                items,
                total_adjustments: items.reduce((s, i) => s + Math.abs(i.change_qty), 0),
                net_variance,
                variance_percent: parseFloat(var_percent),
                positive_count: items.filter(i => i.change_qty > 0).length,
                negative_count: items.filter(i => i.change_qty < 0).length,
                zero_variance_count: items.filter(i => i.change_qty === 0).length,
                auditor,
                reviewed_by
            };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Optional: you can sort pending reviews to the top here if desired
        // grouped.sort((a, b) => { ... })

        setLocations([...locs].sort());
        setSessions(grouped);
        setLoading(false);
    }, [dateFrom, dateTo, locFilter]);

    useEffect(() => { fetchAudits(); }, [fetchAudits]);

    const handleVerifySession = async (session: AuditSession) => {
        if (!user || !user.name) return;
        setVerifying(session.ref_doc);
        const appendNote = ` | [Reviewed by ${user.name}]`;
        
        // We only append to the first item for efficiency to trigger the general session status
        const firstItem = session.items[0];
        const newNotes = (firstItem.notes || '') + appendNote;

        const { error } = await supabase
            .from('stock_ledger_v2')
            .update({ notes: newNotes })
            .eq('txn_id', firstItem.txn_id);

        if (!error) {
            // Optimistic update
            setSessions(prev => prev.map(s => 
                s.ref_doc === session.ref_doc ? { ...s, reviewed_by: user.name } : s
            ));
        }
        setVerifying(null);
    };

    const filteredSessions = sessions.filter(s =>
        !search || (s.ref_doc || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.location || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.auditor || '').toLowerCase().includes(search.toLowerCase()) ||
        s.items.some(i => (i.sku || '').toLowerCase().includes(search.toLowerCase()))
    );

    // Dynamic Chart Data Generation (Daily Aggregation)
    const chartData = useMemo(() => {
        const daily: Record<string, { sortKey: string, date: string, positive: number, negative: number, totalSkus: number, perfectSkus: number }> = {};
        
        filteredSessions.forEach(session => {
            const dt = session.date ? new Date(session.date) : new Date();
            const year = dt.getFullYear();
            const month = String(dt.getMonth() + 1).padStart(2, '0');
            const day = String(dt.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`; // Group by local date instead of UTC
            const displayLabel = dt.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
            
            if (!daily[key]) daily[key] = { sortKey: key, date: displayLabel, positive: 0, negative: 0, totalSkus: 0, perfectSkus: 0 };
            
            session.items.forEach(item => {
                daily[key].totalSkus++;
                if (item.change_qty > 0) daily[key].positive += item.change_qty;
                if (item.change_qty < 0) daily[key].negative += item.change_qty;
                if (item.change_qty === 0) daily[key].perfectSkus++;
            });
        });

        return Object.values(daily).map(d => ({
            ...d,
            accuracy: d.totalSkus > 0 ? parseFloat(((d.perfectSkus / d.totalSkus) * 100).toFixed(1)) : 0
        })).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [filteredSessions]);

    const exportCSV = (session: AuditSession) => {
        const rows = [
            ['SKU', 'Location', 'System Qty', 'Actual Qty', 'Variance', 'Notes', 'Auditor', 'Timestamp'],
            ...session.items.map(i => {
                const { system, actual } = parseNotes(i.notes);
                return [
                    i.sku, i.loc_id, system, actual, i.change_qty,
                    i.notes?.replace(/\[Reviewed by .*?\]/g, '')?.replace(/,/g, ';') || '',
                    session.auditor,
                    new Date(i.timestamp).toLocaleString('en-MY')
                ];
            })
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.ref_doc}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };


    const totalNetVariance = filteredSessions.reduce((s, x) => s + x.net_variance, 0);

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 font-sans selection:bg-purple-500/30">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2 flex items-center gap-3">
                        <ClipboardCheck className="text-purple-400" size={36} />
                        {t('盘点分析与核销')}
                    </h1>
                    <p className="text-gray-400 font-medium">{t('历史库存盘点调整、差异分析与管理审核日志')}</p>
                </div>

                {/* Premium Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: t('总盘点次数'), value: filteredSessions.length, icon: ClipboardCheck, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20 shadow-[0_0_20px_-10px_rgba(168,85,247,0.4)]' },
                        { label: t('已核对 SKU 数'), value: filteredSessions.reduce((s, x) => s + x.items.length, 0), icon: PackageSearch, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20 shadow-[0_0_20px_-10px_rgba(99,102,241,0.4)]' },
                        { label: t('总净差异'), value: `${totalNetVariance > 0 ? '+' : ''}${totalNetVariance}`, icon: Activity, color: totalNetVariance >= 0 ? 'text-green-400' : 'text-red-400', bg: totalNetVariance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10', border: totalNetVariance >= 0 ? 'border-green-500/20 shadow-[0_0_20px_-10px_rgba(34,197,94,0.4)]' : 'border-red-500/20 shadow-[0_0_20px_-10px_rgba(239,68,68,0.4)]' },
                        { label: t('待审核数'), value: filteredSessions.filter(s => !s.reviewed_by).length, icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20 shadow-[0_0_20px_-10px_rgba(251,191,36,0.4)]' },
                    ].map(card => (
                        <div key={card.label} className={`${card.bg} ${card.border} backdrop-blur-xl border rounded-3xl p-6 flex flex-col gap-3 group relative overflow-hidden transition-all hover:scale-[1.02]`}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-white/10 transition-colors" />
                            <card.icon size={20} className={card.color} />
                            <div>
                                <div className={`text-4xl font-black font-mono tracking-tight ${card.color}`}>{card.value}</div>
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{card.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-[#0d0d12]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-5 mb-8 flex flex-wrap gap-4 items-end relative z-20">
                    <div className="flex-1 min-w-48">
                        <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 ml-1">{t('搜索数据库')}</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t('单号、库位、SKU、盘点员...')}
                                className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all font-medium"
                            />
                        </div>
                    </div>
                    <div className="min-w-40">
                        <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 ml-1">{t('库位筛选')}</label>
                        <select
                            value={locFilter}
                            onChange={e => setLocFilter(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">{t('所有库位')}</option>
                            {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div className="min-w-36">
                        <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 ml-1">{t('起始日期')}</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50 transition-all [color-scheme:dark]" />
                    </div>
                    <div className="min-w-36">
                        <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 ml-1">{t('截止日期')}</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50 transition-all [color-scheme:dark]" />
                    </div>
                    <button onClick={fetchAudits} className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 border border-purple-500/50 shadow-lg shadow-purple-500/20 rounded-2xl text-sm font-bold text-white transition-all active:scale-95">
                        <RefreshCw size={16} /> {t('查询')}
                    </button>
                </div>

                {/* Composed Variance Chart */}
                {chartData.length > 0 && !loading && (
                    <div className="bg-[#09090b]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 mb-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />
                        
                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div>
                                <h2 className="text-xl font-black text-white flex items-center gap-2">
                                    <Activity className="text-blue-400" size={20} />
                                    {t('每日分析与准确率')}
                                </h2>
                                <p className="text-xs font-bold text-gray-500 mt-1">{t('盘盈、盘亏与完全匹配率多维透视')}</p>
                            </div>
                            <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest">
                                <span className="text-green-400 bg-green-500/10 px-2 py-1 rounded">Surplus</span>
                                <span className="text-red-400 bg-red-500/10 px-2 py-1 rounded">Deficit</span>
                                <span className="text-blue-400 bg-blue-500/10 px-2 py-1 rounded">Accuracy Base 100%</span>
                            </div>
                        </div>
                        
                        <div className="h-[300px] w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis yAxisId="left" stroke="#6b7280" tick={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" tick={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                                    
                                    <Tooltip 
                                        cursor={{ fill: '#ffffff05' }}
                                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', padding: '12px' }}
                                        itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                                        labelStyle={{ color: '#9ca3af', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <ReferenceLine y={0} yAxisId="left" stroke="#4b5563" />
                                    
                                    <Bar yAxisId="left" dataKey="positive" name="Surplus (+)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} stackId="a" />
                                    <Bar yAxisId="left" dataKey="negative" name="Loss (-)" fill="#ef4444" radius={[0, 0, 6, 6]} maxBarSize={40} stackId="a" />
                                    <Line yAxisId="right" type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#09090b', stroke: '#3b82f6', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#3b82f6' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Sessions List */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-[#09090b]/50 border border-white/5 rounded-3xl backdrop-blur-sm">
                        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest animate-pulse">Scanning ledgers...</div>
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="text-center py-32 bg-[#09090b]/50 border border-white/5 rounded-3xl backdrop-blur-sm">
                        <ClipboardCheck size={48} className="mx-auto mb-4 opacity-20 text-white" />
                        <div className="text-lg font-bold text-gray-400 mb-1">No audit records found</div>
                        <div className="text-xs font-medium text-gray-600">Try adjusting your filters or date range.</div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredSessions.map(session => {
                            const isOpen = expandedSession === session.ref_doc;
                            const isReviewed = !!session.reviewed_by;
                            const dateStr = session.date ? new Date(session.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown';
                            const timeStr = session.date ? new Date(session.date).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : '';
                            
                            // Visual Identifiers
                            const isMajorLoss = session.net_variance < 0; 


                            return (
                                <div key={session.ref_doc} className={`bg-[#0d0d12]/80 backdrop-blur-xl border rounded-3xl overflow-hidden transition-all duration-300 ${
                                    isOpen 
                                        ? 'border-purple-500/50 shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/20' 
                                        : isReviewed 
                                            ? 'border-green-500/20 bg-green-950/5 hover:border-green-500/30 shadow-none'
                                            : isMajorLoss 
                                                ? 'border-red-500/20 hover:border-red-500/40 shadow-[0_0_20px_-5px_rgba(239,68,68,0.05)]' 
                                                : 'border-white/10 hover:border-amber-500/30 hover:bg-[#12121a] shadow-xl shadow-black/50'
                                }`}>
                                    
                                    {/* Session Header */}
                                    <button
                                        className={`w-full p-5 lg:p-6 flex flex-col md:flex-row md:items-center gap-4 text-left relative overflow-hidden ${isReviewed ? 'opacity-80 hover:opacity-100' : ''}`}
                                        onClick={() => setExpandedSession(isOpen ? null : session.ref_doc)}
                                    >
                                        {/* Review Status Background Flare */}
                                        {!isReviewed && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>}
                                        {isReviewed && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>}

                                        {/* Icon */}
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${isReviewed ? 'bg-green-500/10 shadow-green-500/20' : isMajorLoss ? 'bg-red-500/10 shadow-red-500/20' : 'bg-purple-500/10 shadow-purple-500/20'}`}>
                                            {isReviewed
                                                ? <CheckCircle2 size={24} className="text-green-500" />
                                                : isMajorLoss 
                                                    ? <AlertTriangle size={20} className="text-red-400" />
                                                    : <ClipboardCheck size={20} className="text-purple-400" />
                                            }
                                        </div>

                                        {/* Info & Tags */}
                                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-black text-white text-base lg:text-lg font-mono tracking-tight">{session.ref_doc}</span>
                                                {/* Auditor Tag */}
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm">
                                                    <User size={10} className="shrink-0" />
                                                    {session.auditor}
                                                </div>
                                                {/* Review Badge */}
                                                {isReviewed ? (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm">
                                                        <ShieldCheck size={10} className="shrink-0" />
                                                        Verified by {session.reviewed_by}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm animate-pulse">
                                                        <AlertTriangle size={10} className="shrink-0" />
                                                        Pending Review
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-4 text-[11px] sm:text-xs text-gray-400 font-bold tracking-wide">
                                                <span className="flex items-center gap-1.5"><Calendar size={12} className="text-gray-500" /> {dateStr} <span className="text-gray-600 font-normal">{timeStr}</span></span>
                                                <span className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-500" /> {session.location}</span>
                                            </div>
                                        </div>

                                        {/* Dynamic Stats Row */}
                                        <div className="flex items-center justify-between md:justify-end gap-3 lg:gap-5 shrink-0 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-none border-white/5">
                                            
                                            {/* Micro Bar representation of pos/neg */}
                                            <div className="hidden lg:flex gap-1.5 opacity-80">
                                                {session.positive_count > 0 && (
                                                    <div className="flex items-center gap-1 bg-green-500/10 text-green-400 px-2.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest">
                                                        <TrendingUp size={12} /> {session.positive_count}
                                                    </div>
                                                )}
                                                {session.negative_count > 0 && (
                                                    <div className="flex items-center gap-1 bg-red-500/10 text-red-400 px-2.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest">
                                                        <TrendingDown size={12} /> {session.negative_count}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="hidden sm:block text-center px-4 border-r border-white/10">
                                                <div className="text-white font-black text-lg font-mono">{session.items.length}</div>
                                                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">SKUs</div>
                                            </div>

                                            {/* Net Variance Badge Highlighting */}
                                            <div className="flex gap-2">
                                                <div className={`px-4 py-2 min-w-20 rounded-2xl border flex flex-col items-center justify-center shadow-inner ${session.net_variance > 0 ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-green-500/10' : session.net_variance < 0 ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-red-500/10' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                                                    <span className="text-base font-black font-mono leading-none tracking-tighter">
                                                        {session.net_variance > 0 ? '+' : ''}{session.net_variance}
                                                    </span>
                                                    <span className="text-[9px] uppercase tracking-widest font-bold opacity-70 mt-1">Net Var</span>
                                                </div>
                                            </div>

                                            <div className="pl-2">
                                                <div className={`p-2 rounded-full transition-colors ${isOpen ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-400'}`}>
                                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Expanded Detail View */}
                                    {isOpen && (
                                        <div className="border-t border-white/5 bg-[#09090b]">
                                            {/* Action Bar */}
                                            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-gradient-to-r from-purple-500/5 to-transparent">
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    Audit Ledger Manifest
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {isManager && !isReviewed && (
                                                        <button 
                                                            onClick={() => handleVerifySession(session)}
                                                            disabled={verifying === session.ref_doc}
                                                            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-5 py-2.5 bg-green-600 hover:bg-green-500 border border-green-500/50 shadow-lg shadow-green-500/20 rounded-xl text-white transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            {verifying === session.ref_doc ? (
                                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            ) : (
                                                                <ShieldCheck size={16} />
                                                            )}
                                                            Verify & Approve
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => exportCSV(session)}
                                                        className="flex items-center gap-2 text-xs font-bold px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-gray-300 transition-colors shadow-sm"
                                                    >
                                                        <Download size={14} /> CSV
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Beautiful Data Table */}
                                            <div className="overflow-x-auto p-2">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr>
                                                            <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-black">SKU</th>
                                                            <th className="text-right px-4 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-black">Sys Qty</th>
                                                            <th className="text-right px-4 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-black">Act Qty</th>
                                                            <th className="text-right px-4 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-black">Variance</th>
                                                            <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-black hidden md:table-cell">Remarks</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {session.items
                                                            .sort((a, b) => Math.abs(b.change_qty) - Math.abs(a.change_qty))
                                                            .map((item, idx) => {
                                                                const { system, actual } = parseNotes(item.notes);
                                                                const pos = item.change_qty > 0;
                                                                const neg = item.change_qty < 0;
                                                                
                                                                return (
                                                                    <tr key={item.txn_id} className={`transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]'} hover:bg-white/[0.03]`}>
                                                                        <td className="px-4 py-3 text-white font-bold text-xs truncate max-w-[250px]" title={item.sku}>
                                                                            {skuNames[item.sku] || item.sku}
                                                                            <div className="text-[9px] text-gray-500 font-normal mt-0.5">{item.sku}</div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{system}</td>
                                                                        <td className="px-4 py-3 text-right text-white font-mono text-xs font-bold">{actual}</td>
                                                                        <td className="px-4 py-3 text-right">
                                                                            <span className={`inline-flex min-w-16 justify-center items-center gap-1.5 font-black font-mono text-[11px] px-2.5 py-1 rounded-lg border ${pos ? 'text-green-400 bg-green-500/10 border-green-500/20' : neg ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-gray-500 bg-white/5 border-transparent'}`}>
                                                                                {pos ? <TrendingUp size={10} /> : neg ? <TrendingDown size={10} /> : <Minus size={10} />}
                                                                                {pos ? '+' : ''}{item.change_qty}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-left text-gray-500 text-[10px] font-medium hidden md:table-cell truncate max-w-[200px]">
                                                                            {(item.notes || '').replace(/System:\s*[\d.]+\s*\|\s*Actual:\s*[\d.]+/g, '').replace(/\[Reviewed by .*?\]/g, '').replace(/^\|\s*/, '')}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditReport;
