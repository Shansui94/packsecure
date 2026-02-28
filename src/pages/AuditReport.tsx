import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    ClipboardCheck, Calendar, MapPin, TrendingUp, TrendingDown,
    Minus, ChevronDown, ChevronUp, Search, Download, RefreshCw, AlertTriangle
} from 'lucide-react';

interface AuditEntry {
    txn_id: string;
    sku: string;
    change_qty: number;
    loc_id: string;
    ref_doc: string;
    notes: string;
    timestamp: string;
}

interface AuditSession {
    ref_doc: string;
    date: string;
    location: string;
    items: AuditEntry[];
    total_adjustments: number;
    positive_count: number;
    negative_count: number;
    zero_variance_count: number;
}

const AuditReport: React.FC = () => {
    const [sessions, setSessions] = useState<AuditSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [locFilter, setLocFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [locations, setLocations] = useState<string[]>([]);

    const fetchAudits = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('stock_ledger_v2')
            .select('txn_id, sku, change_qty, loc_id, ref_doc, notes, timestamp')
            .eq('event_type', 'Audit Adjustment')
            .order('timestamp', { ascending: false })
            .limit(500);

        if (dateFrom) query = query.gte('timestamp', new Date(dateFrom).toISOString());
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            query = query.lte('timestamp', end.toISOString());
        }
        if (locFilter) query = query.eq('loc_id', locFilter);

        const { data, error } = await query;
        if (error) { console.error(error); setLoading(false); return; }

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
            return {
                ref_doc: ref,
                date: ts,
                location: loc,
                items,
                total_adjustments: items.reduce((s, i) => s + Math.abs(i.change_qty), 0),
                positive_count: items.filter(i => i.change_qty > 0).length,
                negative_count: items.filter(i => i.change_qty < 0).length,
                zero_variance_count: items.filter(i => i.change_qty === 0).length,
            };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setLocations([...locs].sort());
        setSessions(grouped);
        setLoading(false);
    }, [dateFrom, dateTo, locFilter]);

    useEffect(() => { fetchAudits(); }, [fetchAudits]);

    const filteredSessions = sessions.filter(s =>
        !search || s.ref_doc.toLowerCase().includes(search.toLowerCase()) ||
        s.location.toLowerCase().includes(search.toLowerCase()) ||
        s.items.some(i => i.sku.toLowerCase().includes(search.toLowerCase()))
    );

    const exportCSV = (session: AuditSession) => {
        const rows = [
            ['SKU', 'Location', 'Variance', 'Notes', 'Timestamp'],
            ...session.items.map(i => [
                i.sku, i.loc_id, i.change_qty,
                i.notes?.replace(/,/g, ';') || '',
                new Date(i.timestamp).toLocaleString('en-MY')
            ])
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

    const parseNotes = (notes: string) => {
        const sysMatch = notes?.match(/System:\s*([\d.]+)/);
        const actMatch = notes?.match(/Actual:\s*([\d.]+)/);
        return {
            system: sysMatch ? sysMatch[1] : '–',
            actual: actMatch ? actMatch[1] : '–',
        };
    };

    const totalPositive = filteredSessions.reduce((s, x) => s + x.positive_count, 0);
    const totalNegative = filteredSessions.reduce((s, x) => s + x.negative_count, 0);

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black tracking-tighter text-white mb-1 flex items-center gap-3">
                        <ClipboardCheck className="text-purple-400" size={28} />
                        Audit Report
                    </h1>
                    <p className="text-gray-500 text-sm">Historical stock audit adjustments grouped by session.</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Sessions', value: filteredSessions.length, icon: ClipboardCheck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        { label: 'Total SKUs Audited', value: filteredSessions.reduce((s, x) => s + x.items.length, 0), icon: Search, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                        { label: 'Stock Increases', value: totalPositive, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
                        { label: 'Stock Decreases', value: totalNegative, icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
                    ].map(card => (
                        <div key={card.label} className={`${card.bg} border border-white/5 rounded-2xl p-5 flex flex-col gap-2`}>
                            <card.icon size={18} className={card.color} />
                            <div className={`text-3xl font-black ${card.color}`}>{card.value}</div>
                            <div className="text-xs text-gray-500 font-medium">{card.label}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-5 mb-6 flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-48">
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Search</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Ref, location or SKU..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                            />
                        </div>
                    </div>
                    <div className="min-w-40">
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Location</label>
                        <select
                            value={locFilter}
                            onChange={e => setLocFilter(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
                        >
                            <option value="">All Locations</option>
                            {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div className="min-w-36">
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30" />
                    </div>
                    <div className="min-w-36">
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30" />
                    </div>
                    <button onClick={fetchAudits} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white transition-colors">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                {/* Sessions List */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="text-center py-24 text-gray-600">
                        <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
                        <div>No audit records found</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredSessions.map(session => {
                            const isOpen = expandedSession === session.ref_doc;
                            const dateStr = new Date(session.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
                            const timeStr = new Date(session.date).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
                            const hasIssues = session.negative_count > 0;

                            return (
                                <div key={session.ref_doc} className={`bg-[#0d0d12] border rounded-2xl overflow-hidden transition-all ${isOpen ? 'border-purple-500/30' : 'border-white/5 hover:border-white/10'}`}>
                                    {/* Session Header */}
                                    <button
                                        className="w-full p-5 flex items-center gap-4 text-left"
                                        onClick={() => setExpandedSession(isOpen ? null : session.ref_doc)}
                                    >
                                        {/* Icon */}
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasIssues ? 'bg-orange-500/10' : 'bg-purple-500/10'}`}>
                                            {hasIssues
                                                ? <AlertTriangle size={18} className="text-orange-400" />
                                                : <ClipboardCheck size={18} className="text-purple-400" />
                                            }
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-black text-white text-sm font-mono">{session.ref_doc}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-[11px] text-gray-500">
                                                <span className="flex items-center gap-1"><Calendar size={10} /> {dateStr} {timeStr}</span>
                                                <span className="flex items-center gap-1"><MapPin size={10} /> {session.location}</span>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-center hidden md:block">
                                                <div className="text-white font-black text-lg">{session.items.length}</div>
                                                <div className="text-[9px] text-gray-600 uppercase tracking-widest">SKUs</div>
                                            </div>
                                            {session.positive_count > 0 && (
                                                <div className="flex items-center gap-1 bg-green-500/10 text-green-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                                                    <TrendingUp size={12} /> +{session.positive_count}
                                                </div>
                                            )}
                                            {session.negative_count > 0 && (
                                                <div className="flex items-center gap-1 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                                                    <TrendingDown size={12} /> -{session.negative_count}
                                                </div>
                                            )}
                                            {isOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                        </div>
                                    </button>

                                    {/* Expanded Detail */}
                                    {isOpen && (
                                        <div className="border-t border-white/5">
                                            {/* Export Button */}
                                            <div className="px-5 py-3 flex justify-end border-b border-white/5">
                                                <button
                                                    onClick={() => exportCSV(session)}
                                                    className="flex items-center gap-2 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 border border-white/10 transition-colors"
                                                >
                                                    <Download size={12} /> Export CSV
                                                </button>
                                            </div>

                                            {/* Items Table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-white/5">
                                                            <th className="text-left px-5 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-bold">SKU</th>
                                                            <th className="text-right px-5 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-bold">System Qty</th>
                                                            <th className="text-right px-5 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Actual Qty</th>
                                                            <th className="text-right px-5 py-3 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Variance</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {session.items
                                                            .sort((a, b) => Math.abs(b.change_qty) - Math.abs(a.change_qty))
                                                            .map(item => {
                                                                const { system, actual } = parseNotes(item.notes);
                                                                const pos = item.change_qty > 0;
                                                                const neg = item.change_qty < 0;
                                                                return (
                                                                    <tr key={item.txn_id} className="hover:bg-white/[0.02] transition-colors">
                                                                        <td className="px-5 py-3 font-mono text-white font-bold text-xs">{item.sku}</td>
                                                                        <td className="px-5 py-3 text-right text-gray-400 font-mono text-xs">{system}</td>
                                                                        <td className="px-5 py-3 text-right text-white font-mono text-xs">{actual}</td>
                                                                        <td className="px-5 py-3 text-right">
                                                                            <span className={`inline-flex items-center gap-1 font-black font-mono text-xs px-2 py-0.5 rounded-lg ${pos ? 'text-green-400 bg-green-500/10' : neg ? 'text-red-400 bg-red-500/10' : 'text-gray-500 bg-white/5'}`}>
                                                                                {pos ? <TrendingUp size={10} /> : neg ? <TrendingDown size={10} /> : <Minus size={10} />}
                                                                                {pos ? '+' : ''}{item.change_qty}
                                                                            </span>
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
