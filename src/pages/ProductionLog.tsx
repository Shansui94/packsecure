import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Download, Search, Database, User, ChevronLeft, ChevronRight, Cpu } from 'lucide-react';
import { ProductionLog as ProductionLogType, UserRole } from '../types';
import { MACHINES } from '../data/factoryData';

interface ProductionLogProps {
    logs: ProductionLogType[];
    userRole: UserRole | string;
}

const PAGE_SIZE = 50;

const ProductionLog: React.FC<ProductionLogProps> = ({ userRole }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
    const [skuNameMap, setSkuNameMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterDate, setFilterDate] = useState<Date>(new Date());
    const [filterMachine, setFilterMachine] = useState('All');


    // Infinite scroll
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Fetch users + SKU names
    useEffect(() => {
        (async () => {
            const [usersRes, skuRes] = await Promise.all([
                supabase.from('sys_users_v2').select('id, name'),
                supabase.from('v2_inventory_view').select('sku, name'),
            ]);
            if (usersRes.data) {
                const m = new Map<string, string>();
                usersRes.data.forEach(u => m.set(u.id, u.name));
                setUserMap(m);
            }
            if (skuRes.data) {
                const m = new Map<string, string>();
                skuRes.data.forEach(s => { if (s.name) m.set(s.sku, s.name); });
                setSkuNameMap(m);
            }
        })();
    }, []);

    const fetchLogs = useCallback(async (pg: number, search: string, date: Date, machine: string, append = false) => {
        if (!append) setLoading(true); else setLoadingMore(true);
        try {
            let q = supabase.from('production_logs_v2').select('*')
                .order('created_at', { ascending: false })
                .range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1);

            const start = new Date(date); start.setHours(0, 0, 0, 0);
            const end = new Date(date); end.setHours(23, 59, 59, 999);
            q = q.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());

            if (machine !== 'All') q = q.eq('machine_id', machine);
            if (search) q = q.or(`sku.ilike.%${search}%,machine_id.ilike.%${search}%,batch_code.ilike.%${search}%`);

            const { data, error } = await q;
            if (error) throw error;
            if (data) {
                setHasMore(data.length >= PAGE_SIZE);
                if (append) setLogs(prev => [...prev, ...data]);
                else setLogs(data);
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); setLoadingMore(false); }
    }, []);

    useEffect(() => {
        setPage(0); setHasMore(true);
        fetchLogs(0, debouncedSearch, filterDate, filterMachine);
    }, [debouncedSearch, filterDate, filterMachine, fetchLogs]);

    // Realtime
    useEffect(() => {
        const ch = supabase.channel('prod_logs_rt')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_logs_v2' }, (p) => {
                if (page === 0) setLogs(prev => [p.new, ...prev]);
            }).subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [page]);

    // Infinite scroll observer
    useEffect(() => {
        if (!sentinelRef.current) return;
        const obs = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                const next = page + 1;
                setPage(next);
                fetchLogs(next, debouncedSearch, filterDate, filterMachine, true);
            }
        }, { threshold: 0.1 });
        obs.observe(sentinelRef.current);
        return () => obs.disconnect();
    }, [hasMore, loading, loadingMore, page, debouncedSearch, filterDate, filterMachine, fetchLogs]);

    // Date helpers
    const shiftDate = (d: number) => { const nd = new Date(filterDate); nd.setDate(nd.getDate() + d); setFilterDate(nd); };
    const isToday = filterDate.toDateString() === new Date().toDateString();


    // Export
    const handleExport = () => {
        if (!logs.length) return;
        const csv = ["Timestamp,Machine,Operator,SKU,Output,Reject,Note",
            ...logs.map(l => {
                const op = l.operator_id ? (userMap.get(l.operator_id) || l.operator_id) : '-';
                return `"${new Date(l.created_at).toLocaleString()}","${l.machine_id || '-'}","${op}","${l.sku || '-'}",${l.output_qty || 0},${l.reject_qty || 0},"${l.note || ''}"`;
            })].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `production_logs_${filterDate.toISOString().slice(0, 10)}.csv`; a.click();
    };

    // Stats
    const totalOutput = logs.reduce((s, l) => s + (l.output_qty || 0), 0);
    const totalRejects = logs.reduce((s, l) => s + (l.reject_qty || 0), 0);
    const uniqueMachines = new Set(logs.map(l => l.machine_id).filter(Boolean)).size;

    // Aggregate logs by machine + sku + operator
    interface GroupedLog {
        key: string;
        machine_id: string;
        sku: string;
        operator_id: string;
        total_output: number;
        total_rejects: number;
        count: number;
        first_time: string;
        last_time: string;
    }

    const groupedLogs: GroupedLog[] = (() => {
        const map = new Map<string, GroupedLog>();
        logs.forEach(l => {
            const key = `${l.machine_id}|${l.sku}|${l.operator_id || ''}`;
            const existing = map.get(key);
            if (existing) {
                existing.total_output += (l.output_qty || 0);
                existing.total_rejects += (l.reject_qty || 0);
                existing.count++;
                const t = l.created_at;
                if (t < existing.first_time) existing.first_time = t;
                if (t > existing.last_time) existing.last_time = t;
            } else {
                map.set(key, {
                    key,
                    machine_id: l.machine_id || '?',
                    sku: l.sku || '-',
                    operator_id: l.operator_id || '',
                    total_output: l.output_qty || 0,
                    total_rejects: l.reject_qty || 0,
                    count: 1,
                    first_time: l.created_at,
                    last_time: l.created_at,
                });
            }
        });
        return [...map.values()].sort((a, b) => b.total_output - a.total_output);
    })();

    // Machine list for filter chips
    const machineIds = MACHINES.map(m => m.id);

    const canEdit = userRole === 'Manager' || userRole === 'Admin';

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white dark:bg-[#09090b] text-slate-900 dark:text-white pb-24 transition-colors">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-violet-600 dark:from-blue-400 dark:via-cyan-400 dark:to-violet-500">
                            Production Logs
                        </h1>
                        <p className="text-slate-500 dark:text-gray-500 text-xs font-mono flex items-center gap-2 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                            LIVE · {isToday ? 'TODAY' : filterDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    {canEdit && (
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold transition-all">
                            <Download size={16} className="text-green-600 dark:text-green-400" /> Export CSV
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="bg-slate-50 dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                        <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-widest mb-1">Output</div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{totalOutput.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#121214] p-4 rounded-2xl border border-red-100 dark:border-red-500/10">
                        <div className="text-[10px] text-red-500 dark:text-red-400/70 font-black uppercase tracking-widest mb-1">Rejects</div>
                        <div className="text-2xl font-black text-red-600 dark:text-red-400">{totalRejects.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                        <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-widest mb-1">Records</div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{logs.length}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                        <div className="text-[10px] text-cyan-600 dark:text-cyan-400/70 font-black uppercase tracking-widest mb-1">Machines</div>
                        <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{uniqueMachines}</div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="bg-slate-50 dark:bg-[#121214] p-3 rounded-2xl border border-slate-200 dark:border-white/10 mb-6 space-y-3">
                    {/* Search + Date */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" size={16} />
                            <input
                                type="text" placeholder="Search SKU, Machine, Batch..."
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600"
                            />
                        </div>
                        <div className="flex items-center bg-white dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/10 p-1 shrink-0">
                            <button onClick={() => shiftDate(-1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-gray-400 transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-[11px] font-bold px-3 text-cyan-700 dark:text-cyan-400 w-28 text-center font-mono">
                                {filterDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={() => shiftDate(1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-gray-400 transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    {/* Machine Chips */}
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                        <Cpu size={14} className="text-slate-400 dark:text-gray-500 shrink-0 hidden sm:block" />
                        {['All', ...machineIds].map(m => (
                            <button key={m} onClick={() => setFilterMachine(m)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase whitespace-nowrap transition-all ${filterMachine === m
                                    ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 shadow-sm'
                                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:text-white'}`}
                            >{m === 'All' ? 'All Machines' : m}</button>
                        ))}
                    </div>
                </div>

                {/* Loading overlay */}
                {loading && logs.length === 0 && (
                    <div className="flex justify-center py-24">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
                    </div>
                )}

                {/* Empty state */}
                {!loading && logs.length === 0 && (
                    <div className="text-center py-24 text-slate-500 dark:text-gray-600 border border-dashed border-slate-300 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-transparent">
                        <Database size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No logs found for this date.</p>
                    </div>
                )}

                {groupedLogs.length > 0 && (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-slate-50 dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-[#18181b] text-slate-500 dark:text-gray-400 text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-white/5">
                                        <th className="p-4 font-bold">Machine</th>
                                        <th className="p-4 font-bold">Operator</th>
                                        <th className="p-4 font-bold">Product</th>
                                        <th className="p-4 font-bold">Time Range</th>
                                        <th className="p-4 font-bold text-right">Output</th>
                                        <th className="p-4 font-bold text-right">Logs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/50 dark:divide-white/5 text-sm">
                                    {groupedLogs.map(g => {
                                        const opName = g.operator_id ? (userMap.get(g.operator_id) || g.operator_id) : '-';
                                        const t1 = new Date(g.first_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const t2 = new Date(g.last_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        return (
                                            <tr key={g.key} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors">
                                                <td className="p-4 align-top">
                                                    <span className="bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                                        {g.machine_id}
                                                    </span>
                                                </td>
                                                <td className="p-4 align-top">
                                                    <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                                                        <User size={12} /> {opName}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top">
                                                    <div className="font-semibold text-slate-800 dark:text-white text-xs max-w-[280px] truncate">{skuNameMap.get(g.sku) || g.sku}</div>
                                                    {skuNameMap.has(g.sku) && <div className="text-[10px] text-slate-400 dark:text-gray-600 font-mono mt-0.5 truncate max-w-[280px]">{g.sku}</div>}
                                                </td>
                                                <td className="p-4 align-top">
                                                    <div className="text-xs text-slate-500 dark:text-gray-400 font-mono">
                                                        {t1}{t1 !== t2 && <> → {t2}</>}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top text-right">
                                                    <span className="text-xl font-black text-green-600 dark:text-green-400 font-mono">+{g.total_output}</span>
                                                    {g.total_rejects > 0 && <div className="text-xs font-bold text-red-500 dark:text-red-400 font-mono">-{g.total_rejects} scrap</div>}
                                                </td>
                                                <td className="p-4 align-top text-right">
                                                    <span className="text-xs text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full font-mono">{g.count}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-2">
                            {groupedLogs.map(g => {
                                const opName = g.operator_id ? (userMap.get(g.operator_id) || g.operator_id) : '-';
                                const t1 = new Date(g.first_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const t2 = new Date(g.last_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div key={g.key} className="bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{g.machine_id}</span>
                                                <span className="text-[10px] text-slate-400 dark:text-gray-600 font-mono">{t1}{t1 !== t2 && <> → {t2}</>}</span>
                                            </div>
                                            <span className="text-xl font-black text-green-600 dark:text-green-400 font-mono">+{g.total_output}</span>
                                        </div>
                                        <div className="font-semibold text-xs text-slate-700 dark:text-gray-300 truncate mb-0.5">{skuNameMap.get(g.sku) || g.sku}</div>
                                        {skuNameMap.has(g.sku) && <div className="text-[10px] text-slate-400 dark:text-gray-600 font-mono truncate mb-1">{g.sku}</div>}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400">
                                                <User size={10} /> {opName}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {g.total_rejects > 0 && <span className="text-[10px] font-bold text-red-500 dark:text-red-400">-{g.total_rejects} scrap</span>}
                                                <span className="text-[10px] text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full font-mono">{g.count} logs</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-10 flex items-center justify-center">
                    {loadingMore && <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />}
                    {!hasMore && logs.length > 0 && <span className="text-xs text-slate-400 dark:text-gray-600 font-mono">— End of logs —</span>}
                </div>
            </div>
        </div>
    );
};

export default ProductionLog;
