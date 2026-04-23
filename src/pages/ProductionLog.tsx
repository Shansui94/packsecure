import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Download, Calendar, Search, Filter, Database, Clock, FileText, User, AlertTriangle, Edit2, Check, X } from 'lucide-react';
import { ProductionLog as ProductionLogType, UserRole } from '../types';

interface ProductionLogProps {
    logs: ProductionLogType[]; // Legacy prop
    userRole: UserRole | string;
}

const PAGE_SIZE = 50;

const ProductionLog: React.FC<ProductionLogProps> = ({ userRole }) => {
    // Data State
    const [logs, setLogs] = useState<any[]>([]);
    const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
    
    // Pagination & Loading
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');

    // Editing State (Manager/Admin only)
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ output_qty: 0, reject_qty: 0, note: '' });

    // Refs for Realtime
    const logsRef = useRef<any[]>([]);
    logsRef.current = logs;

    // Fetch User Mapping ONCE
    useEffect(() => {
        const fetchUsers = async () => {
            const { data } = await supabase.from('sys_users_v2').select('id, name');
            if (data) {
                const map = new Map();
                data.forEach(u => map.set(u.id, u.name));
                setUserMap(map);
            }
        };
        fetchUsers();
    }, []);

    // Main Fetch Function
    const fetchLogs = useCallback(async (pageNumber: number, search: string, dateFilter: string, isLoadMore = false) => {
        if (!isLoadMore) setLoading(true);
        else setLoadingMore(true);

        try {
            let query = supabase
                .from('production_logs_v2')
                .select('*')
                .order('created_at', { ascending: false })
                .range(pageNumber * PAGE_SIZE, (pageNumber + 1) * PAGE_SIZE - 1);

            if (dateFilter) {
                const startOfDay = new Date(dateFilter);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(dateFilter);
                endOfDay.setHours(23, 59, 59, 999);
                query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
            }

            if (search) {
                // ILIKE search on sku or machine_id or batch_code
                query = query.or(`sku.ilike.%${search}%,machine_id.ilike.%${search}%,batch_code.ilike.%${search}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data) {
                if (data.length < PAGE_SIZE) setHasMore(false);
                else setHasMore(true);

                if (isLoadMore) {
                    setLogs(prev => [...prev, ...data]);
                } else {
                    setLogs(data);
                }
            }
        } catch (err) {
            console.error("Error fetching logs:", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    // Initial load & Filter trigger
    useEffect(() => {
        setPage(0);
        setHasMore(true);
        fetchLogs(0, appliedSearch, filterDate, false);
    }, [appliedSearch, filterDate, fetchLogs]);

    // Supabase Realtime Subscription
    useEffect(() => {
        const channel = supabase.channel('production_logs_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'production_logs_v2' },
                (payload) => {
                    // Only prepend if we are on the first page and not heavily filtering
                    if (page === 0) {
                        setLogs(prev => [payload.new, ...prev]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [page]);

    // Handlers
    const handleSearch = () => {
        setAppliedSearch(searchTerm);
    };

    const handleLoadMore = () => {
        if (!hasMore || loadingMore) return;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchLogs(nextPage, appliedSearch, filterDate, true);
    };

    const startEditing = (log: any) => {
        setEditingLogId(log.log_id);
        setEditForm({
            output_qty: log.output_qty || 0,
            reject_qty: log.reject_qty || 0,
            note: log.note || ''
        });
    };

    const cancelEditing = () => {
        setEditingLogId(null);
    };

    const saveEdit = async (logId: string) => {
        try {
            const { error } = await supabase
                .from('production_logs_v2')
                .update({
                    output_qty: editForm.output_qty,
                    reject_qty: editForm.reject_qty,
                    note: editForm.note
                })
                .eq('log_id', logId);

            if (error) throw error;

            // Update local state
            setLogs(prev => prev.map(l => l.log_id === logId ? { ...l, ...editForm } : l));
            setEditingLogId(null);
        } catch (err: any) {
            alert("Failed to update log: " + err.message);
        }
    };

    const handleExport = () => {
        if (!logs.length) return;
        const headers = ["Timestamp", "Job ID", "Batch Code", "Operator", "Product ID", "Machine ID", "Output Qty", "Reject Qty", "Note"];
        const csvContent = [
            headers.join(','),
            ...logs.map(log => {
                const opName = log.operator_id ? (userMap.get(log.operator_id) || log.operator_id) : 'Unknown';
                return [
                    `"${new Date(log.created_at).toLocaleString()}"`,
                    `"${log.job_id || '-'}"`,
                    `"${log.batch_code || '-'}"`,
                    `"${opName}"`,
                    `"${log.sku || '-'}"`,
                    `"${log.machine_id || '-'}"`,
                    log.output_qty || 0,
                    log.reject_qty || 0,
                    `"${log.note || ''}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `production_logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Computed Stats (from loaded data)
    const loadedOutput = logs.reduce((sum, log) => sum + (log.output_qty || 0), 0);
    const loadedRejects = logs.reduce((sum, log) => sum + (log.reject_qty || 0), 0);

    return (
        <div className="p-6 min-h-screen bg-[#09090b] text-white animate-fade-in pb-20">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <Database className="text-blue-500" />
                        Production Logs
                    </h1>
                    <p className="text-gray-400 mt-1">Real-time audit trail of all factory output</p>
                </div>

                {(userRole === 'Manager' || userRole === 'Admin') && (
                    <button
                        onClick={handleExport}
                        className="bg-[#18181b] hover:bg-[#202025] border border-white/10 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all hover:scale-105 active:scale-95 shadow-xl"
                    >
                        <Download size={18} className="text-green-400" />
                        <span>Export CSV</span>
                    </button>
                )}
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#121214] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="flex justify-between items-start z-10 relative">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Loaded Output</p>
                            <h3 className="text-3xl font-black text-white">{loadedOutput.toLocaleString()} <span className="text-lg font-medium text-gray-500">Units</span></h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <Database size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-[#121214] p-6 rounded-2xl border border-red-500/10 relative overflow-hidden group">
                    <div className="flex justify-between items-start z-10 relative">
                        <div>
                            <p className="text-red-400/80 text-xs font-bold uppercase tracking-wider mb-2">Loaded Rejects</p>
                            <h3 className="text-3xl font-black text-red-400">{loadedRejects.toLocaleString()} <span className="text-lg font-medium text-red-500/50">Units</span></h3>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-xl text-red-400">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-[#121214] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="flex justify-between items-start z-10 relative">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Latest Sync</p>
                            <h3 className="text-lg font-bold text-green-400 flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                Live Connected
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">{logs[0] ? new Date(logs[0].created_at).toLocaleTimeString() : 'Awaiting data...'}</p>
                        </div>
                        <div className="p-3 bg-green-500/10 rounded-xl text-green-400">
                            <Clock size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-[#121214] p-4 rounded-xl border border-white/5 mb-6 flex flex-col md:flex-row gap-4 items-center shadow-lg">
                <div className="flex-1 w-full relative flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search Machine, SKU, Batch..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full bg-[#09090b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-blue-500/50 outline-none transition-all placeholder:text-gray-600"
                        />
                    </div>
                    <button onClick={handleSearch} className="px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors">
                        Search
                    </button>
                </div>
                <div className="w-full md:w-auto relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full bg-[#09090b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-blue-500/50 outline-none transition-all [color-scheme:dark]"
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-[#121214] rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative">
                {loading && (
                    <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-[#18181b] text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                                <th className="p-5 font-bold">Timestamp</th>
                                <th className="p-5 font-bold">Operator & Machine</th>
                                <th className="p-5 font-bold">SKU / Job Details</th>
                                <th className="p-5 font-bold text-right">Production</th>
                                {(userRole === 'Manager' || userRole === 'Admin') && (
                                    <th className="p-5 font-bold text-center">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {logs.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-gray-500">No logs found matching criteria.</td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const opName = log.operator_id ? (userMap.get(log.operator_id) || log.operator_id) : 'Unknown';
                                    const isEditing = editingLogId === log.log_id;

                                    return (
                                        <tr key={log.log_id} className="hover:bg-white/[0.02] transition-colors group">
                                            {/* Timestamp */}
                                            <td className="p-5 align-top">
                                                <div className="font-mono text-gray-300">
                                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </div>
                                                <div className="text-xs text-gray-600 font-medium mt-0.5">
                                                    {new Date(log.created_at).toLocaleDateString()}
                                                </div>
                                            </td>

                                            {/* Operator & Machine */}
                                            <td className="p-5 align-top">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                                        {log.machine_id || 'UNKNOWN'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-blue-400">
                                                    <User size={12} /> {opName}
                                                </div>
                                            </td>

                                            {/* SKU / Job Details */}
                                            <td className="p-5 align-top">
                                                <div className="font-medium text-white max-w-[200px] break-words" title={log.sku}>{log.sku || '-'}</div>
                                                <div className="mt-1 flex flex-wrap gap-2">
                                                    {log.job_id && (
                                                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                            Job: {log.job_id}
                                                        </span>
                                                    )}
                                                    {log.batch_code && (
                                                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                                                            Batch: {log.batch_code}
                                                        </span>
                                                    )}
                                                </div>
                                                {!isEditing && log.note && (
                                                    <div className="mt-2 text-xs text-orange-400 italic break-words max-w-[200px] bg-orange-400/10 p-1.5 rounded border border-orange-400/20">
                                                        "{log.note}"
                                                    </div>
                                                )}
                                            </td>

                                            {/* Production (Output & Reject) */}
                                            <td className="p-5 align-top text-right">
                                                {isEditing ? (
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500 w-12 text-left">Output:</span>
                                                            <input 
                                                                type="number" 
                                                                value={editForm.output_qty} 
                                                                onChange={e => setEditForm({...editForm, output_qty: Number(e.target.value)})}
                                                                className="w-20 bg-black border border-gray-600 rounded px-2 py-1 text-green-400 font-mono text-right"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500 w-12 text-left">Reject:</span>
                                                            <input 
                                                                type="number" 
                                                                value={editForm.reject_qty} 
                                                                onChange={e => setEditForm({...editForm, reject_qty: Number(e.target.value)})}
                                                                className="w-20 bg-black border border-gray-600 rounded px-2 py-1 text-red-400 font-mono text-right"
                                                            />
                                                        </div>
                                                        <input 
                                                            type="text"
                                                            placeholder="Correction note..."
                                                            value={editForm.note}
                                                            onChange={e => setEditForm({...editForm, note: e.target.value})}
                                                            className="w-full bg-black border border-gray-600 rounded px-2 py-1 text-xs text-white mt-1"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end">
                                                        <div className="text-xl font-bold text-green-400 font-mono flex items-center gap-1">
                                                            +{log.output_qty || 0}
                                                        </div>
                                                        {(log.reject_qty > 0) && (
                                                            <div className="text-sm font-bold text-red-400 font-mono flex items-center gap-1 mt-0.5">
                                                                -{log.reject_qty} scrap
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions (Manager Only) */}
                                            {(userRole === 'Manager' || userRole === 'Admin') && (
                                                <td className="p-5 align-top text-center">
                                                    {isEditing ? (
                                                        <div className="flex justify-center gap-2">
                                                            <button onClick={() => saveEdit(log.log_id)} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/40 rounded transition-colors">
                                                                <Check size={16} />
                                                            </button>
                                                            <button onClick={cancelEditing} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded transition-colors">
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => startEditing(log)} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors">
                                                            <Edit2 size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Load More Button */}
                {hasMore && !loading && (
                    <div className="p-4 border-t border-white/5 flex justify-center bg-[#09090b]">
                        <button 
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2 bg-[#18181b] border border-white/10 hover:bg-[#202025] rounded-full text-sm font-bold text-gray-300 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {loadingMore ? 'Loading...' : 'Load Older Logs'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductionLog;
