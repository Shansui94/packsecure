import * as React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User, ProductionLog } from '../types';
import { generateSessionReport } from '../utils/reportGenerator';
import { Download, Loader, ChevronLeft, ChevronRight, Activity, PowerOff } from 'lucide-react';
import { WAREHOUSES, MACHINES } from '../data/factoryData';

interface ReportHistoryProps {
    user: User | null;
}

interface MachineDailySummary {
    machineId: string;
    machineName: string;
    totalQty: number;
    logCount: number;
    avgSpeed: number;
    logs: ProductionLog[];
    operatorName: string; // Main operator or 'Multiple'
}

const ReportHistory: React.FC<ReportHistoryProps> = ({ user }: ReportHistoryProps) => {
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [dailyData, setDailyData] = useState<Record<string, MachineDailySummary>>({}); // Map<MachineID, Summary>

    const [selectedSummary, setSelectedSummary] = useState<MachineDailySummary | null>(null);

    useEffect(() => {
        if (!user) return;
        fetchDailyLogs();
    }, [user, selectedDate]);

    const fetchDailyLogs = async () => {
        setLoading(true);
        try {
            // Get User Map for Operator display
            let userMap: Record<string, any> = {};
            const { data: allUsers } = await supabase.from('sys_users_v2').select('id, name, email');
            if (allUsers) allUsers.forEach((u: any) => { userMap[u.id] = u; });

            // Fetch Logs for selected Date
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            const { data: logs, error } = await supabase
                .from('production_logs_v2')
                .select('*')
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Process Logs into Machine Summaries
            const summaryMap: Record<string, MachineDailySummary> = {};

            logs?.forEach((log: any) => {
                const machineId = log.machine_id;
                if (!machineId) return;

                if (!summaryMap[machineId]) {
                    // Find machine config
                    const mConfig = MACHINES.find(m => m.id === machineId);
                    summaryMap[machineId] = {
                        machineId,
                        machineName: mConfig?.name || machineId,
                        totalQty: 0,
                        logCount: 0,
                        avgSpeed: 0,
                        logs: [],
                        operatorName: ''
                    };
                }

                const summary = summaryMap[machineId];
                summary.logs.push({
                    Log_ID: log.log_id,
                    Timestamp: log.created_at,
                    Job_ID: 'N/A',
                    Operator_Email: 'Auto',
                    Output_Qty: log.output_qty || 1,
                    Note: log.sku,
                    formattedDate: new Date(log.created_at).toLocaleTimeString()
                } as any);

                summary.totalQty += (Number(log.output_qty) || 1);
                summary.logCount++;
            });

            // Calculate Metrics (Operator, Speed)
            Object.values(summaryMap).forEach(s => {
                // Operator: Take the most frequent or first
                if (s.logs.length > 0) {
                    s.operatorName = s.logs[0].Operator_Email || 'Unknown'; // Simple first logic
                }

                // Speed
                if (s.logs.length > 1) {
                    const sorted = [...s.logs].sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
                    const start = new Date(sorted[0].Timestamp).getTime();
                    const end = new Date(sorted[sorted.length - 1].Timestamp).getTime();
                    const durationMinutes = (end - start) / 60000;
                    if (s.totalQty > 0 && durationMinutes > 0) {
                        s.avgSpeed = durationMinutes / s.totalQty;
                    }
                }
            });

            setDailyData(summaryMap);

        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (summary: MachineDailySummary) => {
        if (!summary.logs.length) return;
        const sorted = [...summary.logs].sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
        generateSessionReport(
            summary.machineName,
            `Daily Report ${selectedDate}`,
            sorted,
            new Date(sorted[0].Timestamp),
            new Date(sorted[sorted.length - 1].Timestamp)
        );
    };

    const shiftDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* --- HEADER --- */}
            <div className="px-6 py-5 bg-white border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Production Kanban</h1>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Factory Floor Overview</p>
                    </div>
                </div>

                {/* Date Controls */}
                <div className="flex items-center gap-3 bg-gray-100 p-1 rounded-xl shadow-inner">
                    <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-gray-900 shadow-sm"><ChevronLeft size={20} /></button>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-center font-bold text-gray-800 outline-none border-none py-1"
                    />
                    <button onClick={() => shiftDate(1)} className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-gray-900 shadow-sm"><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* --- KANBAN BOARD --- */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                <div className="flex gap-6 h-full min-w-max">
                    {loading ? (
                        <div className="flex items-center justify-center w-full h-64 text-gray-400 gap-3">
                            <Loader className="animate-spin" /> Loading data...
                        </div>
                    ) : (
                        WAREHOUSES.map(warehouse => {
                            // Filter machines for this warehouse
                            const warehouseMachines = MACHINES.filter(m => m.factory_id === warehouse);
                            if (warehouseMachines.length === 0) return null; // Skip empty warehouses if any

                            return (
                                <div key={warehouse} className="w-[320px] flex flex-col h-full bg-gray-100/50 rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                    {/* Column Header */}
                                    <div className="p-4 border-b border-gray-200 bg-white rounded-t-2xl flex justify-between items-center">
                                        <h3 className="font-bold text-gray-800">{warehouse}</h3>
                                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full border border-gray-200">
                                            Zone
                                        </span>
                                    </div>

                                    {/* Column Body */}
                                    <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                                        {warehouseMachines.map(machine => {
                                            const summary = dailyData[machine.id];
                                            const hasData = summary && summary.logCount > 0;

                                            return (
                                                <div
                                                    key={machine.id}
                                                    onClick={() => hasData && setSelectedSummary(summary)}
                                                    className={`
                                                        relative p-4 rounded-xl border transition-all duration-200 group
                                                        ${hasData
                                                            ? 'bg-white border-blue-200 cursor-pointer hover:border-blue-400 hover:shadow-lg hover:-translate-y-1'
                                                            : 'bg-gray-50 border-gray-200 opacity-60' // Idle/Ghost State
                                                        }
                                                    `}
                                                >
                                                    {/* Status Dot */}
                                                    <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${hasData ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-gray-300'}`} />

                                                    <h4 className={`text-sm font-bold mb-1 ${hasData ? 'text-gray-900' : 'text-gray-400'}`}>
                                                        {machine.name}
                                                    </h4>

                                                    {hasData ? (
                                                        <div className="mt-3">
                                                            <div className="text-3xl font-black text-gray-800 flex items-baseline gap-1">
                                                                {summary.totalQty.toLocaleString()}
                                                                <span className="text-xs font-bold text-gray-400">sets</span>
                                                            </div>

                                                            <div className="mt-3 flex items-center justify-between text-xs font-medium text-gray-500 border-t border-gray-100 pt-3">
                                                                <div className="flex items-center gap-1.5 overflow-hidden max-w-[60%]">
                                                                    <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                                                                        OP
                                                                    </div>
                                                                    <span className="truncate">{summary.operatorName}</span>
                                                                </div>
                                                                {summary.avgSpeed > 0 && (
                                                                    <span className="text-green-600 font-mono tracking-tight">{summary.avgSpeed.toFixed(1)}m/u</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-4 flex flex-col items-center justify-center h-20 text-gray-300 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                                                            <PowerOff size={20} className="mb-1" />
                                                            <span className="text-[10px] font-bold uppercase">No Production</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-2xl text-center text-[10px] uppercase font-bold text-gray-400">
                                        Manufacturing Unit
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- DETAILS MODAL --- */}
            {selectedSummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedSummary.machineName}</h3>
                                <p className="text-sm text-gray-500 font-medium">Daily Report • {selectedDate}</p>
                            </div>
                            <button
                                onClick={() => setSelectedSummary(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-6 py-3">Time</th>
                                        <th className="px-6 py-3">Operator</th>
                                        <th className="px-6 py-3 text-right">Qty</th>
                                        <th className="px-6 py-3">Product / Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedSummary.logs.map((log) => (
                                        <tr key={log.Log_ID} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-6 py-3 font-mono text-gray-600 whitespace-nowrap">
                                                {(log as any).formattedDate}
                                            </td>
                                            <td className="px-6 py-3 font-bold text-gray-700">
                                                {log.Operator_Email}
                                            </td>
                                            <td className="px-6 py-3 text-right font-bold text-blue-600 text-lg">
                                                {log.Output_Qty}
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 truncate max-w-[200px]">
                                                {log.Note || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedSummary(null)}
                                className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors text-sm"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => handleDownload(selectedSummary)}
                                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold shadow-lg shadow-gray-900/20 transition-all flex items-center gap-2 text-sm active:scale-95"
                            >
                                <Download size={18} />
                                Download Report PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportHistory;
