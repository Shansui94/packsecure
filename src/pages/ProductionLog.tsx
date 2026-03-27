import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Download, Calendar, Search, Filter, Database, Clock, FileText, User } from 'lucide-react';
import { ProductionLog as ProductionLogType, UserRole } from '../types';

interface ProductionLogProps {
    logs: ProductionLogType[]; // Kept for interface compatibility but we'll likely fetch internal
    userRole: UserRole | string;
}

const ProductionLog: React.FC<ProductionLogProps> = ({ userRole }) => {
    // State
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');

    // Fetch Logs
    const fetchLogs = async () => {
        setLoading(true);
        try {
            // UPDATED: Use the unified V2 table directly
            let query = supabase
                .from('production_logs_v2')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (filterDate) {
                const startOfDay = new Date(filterDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(filterDate);
                endOfDay.setHours(23, 59, 59, 999);

                query = query
                    .gte('created_at', startOfDay.toISOString())
                    .lte('created_at', endOfDay.toISOString());
            } else {
                // Default to last 30 days
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                query = query.gte('created_at', thirtyDaysAgo.toISOString());
            }

            const { data, error } = await query;

            console.log("Production Logs Query Result:", {
                dataLength: data?.length,
                queryError: error,
                firstLogDate: data?.[0]?.created_at,
                lastLogDate: data?.[data?.length - 1]?.created_at
            });

            if (data) {
                // UPDATED: Map fields from the V2 schema to the UI format
                const mappedData = data.map((item: any) => ({
                    ...item,
                    quantity_produced: item.output_qty,
                    product_id: item.sku || 'UNKNOWN',
                    job_id: 'N/A',
                    operator_id: 'Auto',
                    session_id: 'N/A',
                    note: '',
                    unit_id: 'Roll'
                }));
                setLogs(mappedData);
            }
        } catch (err) {
            console.error("Error fetching logs:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filterDate]);

    // Computed Stats
    const totalOutput = logs.reduce((sum, log) => sum + (log.quantity_produced || 0), 0);
    const totalSessions = new Set(logs.map(l => l.session_id)).size;

    const filteredLogs = logs.filter(log => {
        const term = searchTerm.toLowerCase();
        const job = (log.job_id || '').toLowerCase();
        const op = (log.operator_id || '').toLowerCase();
        const prod = (log.product_id || '').toLowerCase();

        return job.includes(term) || op.includes(term) || prod.includes(term);
    });

    const handleExport = () => {
        if (!logs.length) return;
        const headers = ["Timestamp", "Job ID", "Operator", "Product ID", "Quantity", "Machine ID", "Session ID", "Note"];
        const csvContent = [
            headers.join(','),
            ...logs.map(log => [
                `"${new Date(log.created_at).toLocaleString()}"`,
                log.job_id || '-',
                log.operator_id || 'Unknown',
                log.product_id,
                log.quantity_produced,
                log.machine_id,
                log.session_id,
                `"${log.note || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `production_logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="p-6 min-h-screen bg-[#09090b] text-white animate-fade-in pb-20">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <Database className="text-blue-500" />
                        Production Logs
                    </h1>
                    <p className="text-gray-400 mt-1">Audit trail of all factory output (V2 Database)</p>
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
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Total Output</p>
                            <h3 className="text-3xl font-black text-white">{totalOutput.toLocaleString()} <span className="text-lg font-medium text-gray-500">Rolls</span></h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                            <Database size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-[#121214] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="flex justify-between items-start z-10 relative">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Active Sessions</p>
                            <h3 className="text-3xl font-black text-white">{totalSessions}</h3>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
                            <Clock size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-[#121214] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                    {/* Gradient BG */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start z-10 relative">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Latest Entry</p>
                            <h3 className="text-lg font-bold text-white truncate max-w-[150px]">
                                {logs[0] ? new Date(logs[0].created_at).toLocaleTimeString() : '--:--'}
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">{logs[0] ? new Date(logs[0].created_at).toLocaleDateString() : 'No Data'}</p>
                        </div>
                        <div className="p-3 bg-green-500/10 rounded-xl text-green-400">
                            <FileText size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-[#121214] p-4 rounded-xl border border-white/5 mb-6 flex flex-col md:flex-row gap-4 items-center shadow-lg">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search Job ID, Operator..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#09090b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-blue-500/50 outline-none transition-all placeholder:text-gray-600"
                    />
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
                <button
                    onClick={fetchLogs}
                    className="p-2.5 bg-[#09090b] text-gray-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition-all"
                >
                    <Filter size={20} />
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-[#121214] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#18181b] text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                                <th className="p-5 font-bold">Timestamp</th>
                                <th className="p-5 font-bold">Job / Info</th>
                                <th className="p-5 font-bold">Product</th>
                                <th className="p-5 font-bold text-right">Output</th>
                                <th className="p-5 font-bold">Metadata</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-gray-500 italic">loading data stream...</td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-gray-500">No logs found matching criteria.</td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-5">
                                            <div className="font-mono text-gray-300">
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-xs text-gray-600 font-medium mt-0.5">
                                                {new Date(log.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                                                    {log.job_id || 'NO-JOB'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <User size={12} /> {log.operator_id ? `Operator: ${log.operator_id.substring(0, 6)}...` : 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="font-medium text-white max-w-[200px] truncate" title={log.product_id}>{log.product_id}</div>
                                            {log.note && (
                                                <div className="mt-1 text-xs text-orange-400 italic break-words max-w-[200px] bg-orange-400/10 p-1 rounded">
                                                    "{log.note}"
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="text-xl font-bold text-green-400 font-mono">
                                                +{log.quantity_produced || 1}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                    <Database size={12} /> Unit: {log.unit_id || 'Roll'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                    <Clock size={12} /> Session: {log.session_id ? log.session_id.substring(0, 8) : '-'}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProductionLog;
