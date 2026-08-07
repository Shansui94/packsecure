import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Clock, Package, BarChart3, ShieldCheck, User, CalendarDays, Settings2, Calendar as CalendarIcon, Download } from 'lucide-react';
import { MACHINES } from '../data/factoryData';
import { mytTodayYmd } from '../utils/mytDate';

interface MachineRate {
    id: string;
    machine_id: string;
    operator_hourly_rate: number;
    manager_piece_rate: number;
}

interface UserData {
    id: string;
    auth_user_id: string;
    employee_id: string;
    name: string;
    role: string;
}

const MachineSchedule: React.FC<{ user?: any }> = () => {
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const [selectedDate, setSelectedDate] = useState<string>(mytTodayYmd());
    const [selectedMonth, setSelectedMonth] = useState<string>(mytTodayYmd().slice(0, 7)); // YYYY-MM
    
    const [showRates, setShowRates] = useState(false);
    const [expandedCalendars, setExpandedCalendars] = useState<Record<string, boolean>>({});
    
    const [rates, setRates] = useState<MachineRate[]>([]);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchBaseData();
    }, []);

    useEffect(() => {
        fetchData();
    }, [viewMode, selectedDate, selectedMonth]);

    const fetchBaseData = async () => {
        const [{ data: rData }, { data: uData }] = await Promise.all([
            supabase.from('machine_rates').select('*'),
            supabase.from('sys_users_v2').select('*')
        ]);
        if (rData) setRates(rData);
        if (uData) {
            console.log("FETCHED USERS V2:", uData);
            setUsers(uData);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        let startIso = '';
        let endIso = '';

        if (viewMode === 'daily') {
            startIso = new Date(`${selectedDate}T00:00:00+08:00`).toISOString();
            endIso = new Date(`${selectedDate}T23:59:59.999+08:00`).toISOString();
        } else {
            const startDate = `${selectedMonth}-01`;
            const start = new Date(`${startDate}T00:00:00+08:00`);
            const nextMonth = new Date(start.getTime());
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            startIso = start.toISOString();
            endIso = nextMonth.toISOString();
        }

        const fetchStartIso = new Date(new Date(startIso).getTime() - 14 * 3600000).toISOString();

        // Fetch Attendance with pagination
        let allAttData: any[] = [];
        let attHasMore = true;
        let attOffset = 0;
        while (attHasMore) {
            const { data } = await supabase.from('operator_attendance')
                .select('*')
                .gte('clock_in', fetchStartIso)
                .lt('clock_in', endIso)
                .range(attOffset, attOffset + 999);
            if (data && data.length > 0) {
                allAttData.push(...data);
                attOffset += 1000;
                if (data.length < 1000) attHasMore = false;
            } else {
                attHasMore = false;
            }
        }

        // Fetch Logs with pagination
        let allLogsData: any[] = [];
        let logsHasMore = true;
        let logsOffset = 0;
        while (logsHasMore) {
            const { data } = await supabase.from('production_logs_v2')
                .select('machine_id, operator_id, output_qty, job_id, created_at')
                .gte('created_at', startIso)
                .lt('created_at', endIso)
                .range(logsOffset, logsOffset + 999);
            if (data && data.length > 0) {
                allLogsData.push(...data);
                logsOffset += 1000;
                if (data.length < 1000) logsHasMore = false;
            } else {
                logsHasMore = false;
            }
        }
        
        setAttendance(allAttData);
        setLogs(allLogsData);
        setLoading(false);
    };

    const updateRate = async (id: string, field: string, val: number) => {
        setRates(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
        await supabase.from('machine_rates').update({ [field]: val }).eq('id', id);
    };

    const toggleCalendar = (machineId: string) => {
        setExpandedCalendars(prev => ({ ...prev, [machineId]: !prev[machineId] }));
    };

    const handleExportCSV = () => {
        if (!reportData || reportData.length === 0) {
            alert("No data available to export.");
            return;
        }

        const headers = [
            'Machine ID',
            'Machine Name',
            'Operator Name',
            'Role',
            'Total Hours',
            'Produced Rolls',
            'Night Shifts',
            'OT Hours',
            'Rate',
            'Earned Salary (RM)'
        ];

        const rows: any[] = [];
        reportData.forEach(m => {
            m.operators.forEach((op: any) => {
                const rateText = op.calcMode === 'hourly' 
                    ? `RM ${(op.rateInfo?.operator_hourly_rate || 0).toFixed(2)}/h` 
                    : `RM ${(op.rateInfo?.manager_piece_rate || 0).toFixed(2)}/roll`;
                rows.push([
                    m.machine_id,
                    m.machine_name,
                    op.name,
                    op.role,
                    op.totalHours.toFixed(1),
                    op.totalRolls,
                    op.nightShifts,
                    op.otHours.toFixed(1),
                    rateText,
                    op.finalWage.toFixed(2)
                ]);
            });
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const fileName = `Production_Wage_Report_${viewMode === 'daily' ? selectedDate : selectedMonth}.csv`;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reportData = useMemo(() => {
        const report: any[] = [];
        
        let windowStart = 0;
        let windowEnd = 0;
        if (viewMode === 'daily') {
            windowStart = new Date(`${selectedDate}T00:00:00+08:00`).getTime();
            windowEnd = new Date(`${selectedDate}T23:59:59.999+08:00`).getTime();
        } else {
            const startDate = `${selectedMonth}-01`;
            const start = new Date(`${startDate}T00:00:00+08:00`);
            const nextMonth = new Date(start.getTime());
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            windowStart = start.getTime();
            windowEnd = nextMonth.getTime();
        }

        MACHINES.forEach(machine => {
            const mRates = rates.find(r => r.machine_id === machine.id);
            
            const opsOnMachine = new Set<string>();
            
            attendance.filter(a => a.machine_id === machine.id).forEach(a => {
                if (!a.clock_in) return;
                const shiftStart = new Date(a.clock_in).getTime();
                const shiftEnd = a.clock_out ? new Date(a.clock_out).getTime() : Math.min(new Date().getTime(), shiftStart + 14 * 3600000);
                const overlapStart = Math.max(windowStart, shiftStart);
                const overlapEnd = Math.min(windowEnd, shiftEnd);
                if (overlapEnd - overlapStart > 60000) {
                    opsOnMachine.add(a.operator_id);
                }
            });
            
            logs.filter(l => l.machine_id === machine.id && l.operator_id).forEach(l => {
                const logOpStr = String(l.operator_id).trim().toLowerCase();
                const u = users.find(user => 
                    String(user.id).trim().toLowerCase() === logOpStr || 
                    (user.auth_user_id && String(user.auth_user_id).trim().toLowerCase() === logOpStr) || 
                    String(user.employee_id).trim().toLowerCase() === logOpStr
                );
                if (u) {
                    opsOnMachine.add(String(u.employee_id).trim());
                } else {
                    opsOnMachine.add(String(l.operator_id).trim());
                }
            });

            if (opsOnMachine.size === 0) return;

            const opDataList = Array.from(opsOnMachine).map(opId => {
                const opIdStr = String(opId).trim().toLowerCase();
                const userObj = users.find(u => 
                    String(u.employee_id).trim().toLowerCase() === opIdStr || 
                    String(u.id).trim().toLowerCase() === opIdStr || 
                    (u.auth_user_id && String(u.auth_user_id).trim().toLowerCase() === opIdStr)
                );
                const role = userObj?.role || 'Operator';
                const name = userObj?.name || `Unknown (${opId})`;
                
                const myAtts = attendance.filter(a => a.machine_id === machine.id && a.operator_id === opId);
                const timeSlots: string[] = [];
                const totalHours = myAtts.reduce((sum, a) => {
                    if (!a.clock_in) return sum;
                    const shiftStart = new Date(a.clock_in).getTime();
                    const shiftEnd = a.clock_out ? new Date(a.clock_out).getTime() : Math.min(new Date().getTime(), shiftStart + 14 * 3600000);
                    
                    const overlapStart = Math.max(windowStart, shiftStart);
                    const overlapEnd = Math.min(windowEnd, shiftEnd);
                    
                    if (overlapEnd - overlapStart > 60000) {
                        const formatTime = (ts: number) => {
                            return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' });
                        };
                        timeSlots.push(`${formatTime(overlapStart)} - ${formatTime(overlapEnd)}`);
                        return sum + (overlapEnd - overlapStart) / 3600000;
                    }
                    return sum;
                }, 0);
                
                let nightShifts = 0;
                let otHours = 0;

                const attByDate: Record<string, { hours: number, rawHours: number, isNight: boolean, logs: any[], intervals: [number, number][] }> = {};
                myAtts.forEach(a => {
                    if (!a.clock_in) return;
                    const shiftStart = new Date(a.clock_in).getTime();
                    // If no clock_out, shift continues until exactly now
                    const shiftEnd = a.clock_out ? new Date(a.clock_out).getTime() : new Date().getTime();
                    
                    const overlapStart = Math.max(windowStart, shiftStart);
                    const overlapEnd = Math.min(windowEnd, shiftEnd);
                    
                    if (overlapEnd - overlapStart <= 60000) return; // Ignore shifts that don't overlap the view window (ignore < 60s overlaps)
                    
                    let currentStart = overlapStart;
                    while (currentStart < overlapEnd) {
                        const mytDate = new Date(currentStart + 8 * 3600000);
                        const localY = mytDate.getUTCFullYear();
                        const localM = String(mytDate.getUTCMonth() + 1).padStart(2, '0');
                        const localD = String(mytDate.getUTCDate()).padStart(2, '0');
                        const dateKey = `${localY}-${localM}-${localD}`;
                        
                        const nextMidnightMyt = Date.UTC(localY, mytDate.getUTCMonth(), mytDate.getUTCDate() + 1);
                        const nextMidnight = nextMidnightMyt - 8 * 3600000;
                        const chunkEnd = Math.min(overlapEnd, nextMidnight);
                        
                        const hour = mytDate.getUTCHours();
                        const isNight = hour >= 18 || hour < 6;
                        
                        if (!attByDate[dateKey]) {
                            attByDate[dateKey] = { hours: 0, rawHours: 0, isNight: false, logs: [], intervals: [] };
                        }
                        
                        attByDate[dateKey].intervals.push([currentStart, chunkEnd]);
                        attByDate[dateKey].rawHours += (chunkEnd - currentStart) / 3600000;
                        
                        if (!attByDate[dateKey].logs.find(l => l.id === a.id)) {
                            attByDate[dateKey].logs.push(a);
                        }
                        if (isNight) attByDate[dateKey].isNight = true;
                        
                        currentStart = chunkEnd;
                    }
                });

                Object.values(attByDate).forEach(day => {
                    if (day.intervals && day.intervals.length > 0) {
                        day.intervals.sort((a, b) => a[0] - b[0]);
                        let merged = [];
                        for (let int of day.intervals) {
                            if (merged.length === 0 || merged[merged.length - 1][1] < int[0]) {
                                merged.push([...int]);
                            } else {
                                merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], int[1]);
                            }
                        }
                        let realHours = 0;
                        for (let m of merged) {
                            realHours += (m[1] - m[0]) / 3600000;
                        }
                        day.hours = realHours;
                    }
                });

                Object.values(attByDate).forEach(day => {
                    if (day.hours > 8) otHours += (day.hours - 8);
                    if (day.isNight) nightShifts++;
                });

                const myLogs = logs.filter(l => {
                    if (l.machine_id !== machine.id) return false;
                    
                    const logOpStr = String(l.operator_id).trim().toLowerCase();
                    const logUser = users.find(u => 
                        String(u.id).trim().toLowerCase() === logOpStr || 
                        (u.auth_user_id && String(u.auth_user_id).trim().toLowerCase() === logOpStr) || 
                        String(u.employee_id).trim().toLowerCase() === logOpStr
                    );
                    const normalizedLogId = logUser ? String(logUser.employee_id).trim() : String(l.operator_id).trim();
                    
                    // Exact match by normalized ID
                    if (normalizedLogId.toLowerCase() === String(opId).trim().toLowerCase()) return true;
                    
                    // Time-based matching for hardware-inserted logs (operator_id is null)
                    const logTime = new Date(l.created_at).getTime();
                    return myAtts.some(shift => {
                        const inTime = new Date(shift.clock_in).getTime();
                        const outTime = shift.clock_out ? new Date(shift.clock_out).getTime() : new Date().getTime() + 86400000;
                        return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                    });
                });
                const totalRolls = myLogs.reduce((sum, l) => sum + (Number(l.output_qty) || 0), 0);
                
                const jobsSet = new Set<string>();
                myLogs.forEach(l => { if (l.job_id) jobsSet.add(l.job_id); });

                const calcMode = role === 'Manager' ? 'piece' : 'hourly';
                let baseWage = 0;
                
                if (calcMode === 'hourly') {
                    baseWage = totalHours * (mRates?.operator_hourly_rate || 0);
                } else {
                    baseWage = totalRolls * (mRates?.manager_piece_rate || 0);
                }

                let premiumBonus = 0;
                if (calcMode === 'hourly') {
                    premiumBonus += otHours * (mRates?.operator_hourly_rate || 0) * 0.5;
                    premiumBonus += (nightShifts * 8) * (mRates?.operator_hourly_rate || 0) * 0.5;
                } else {
                    const otRatio = totalHours > 0 ? (otHours / totalHours) : 0;
                    const nightRatio = totalHours > 0 ? ((nightShifts * 8) / totalHours) : 0;
                    premiumBonus += baseWage * (otRatio * 0.5);
                    premiumBonus += baseWage * (Math.min(1, nightRatio) * 0.5);
                }
                
                const finalWage = baseWage + premiumBonus;

                return {
                    opId, name, role, totalHours, timeSlots, totalRolls, jobs: Array.from(jobsSet),
                    calcMode, baseWage, premiumBonus, finalWage, nightShifts, otHours, rateInfo: mRates,
                    daysWorked: Object.keys(attByDate).length,
                    attMap: attByDate
                };
            });

            // Sort operators so the "main" operator (highest hours) is at the top
            opDataList.sort((a, b) => b.totalHours - a.totalHours);

            report.push({
                machine_id: machine.id,
                machine_name: machine.name,
                operators: opDataList
            });
        });

        return report;
    }, [attendance, logs, rates, users, viewMode]);

    const totalPayout = reportData.reduce((sum, m) => sum + m.operators.reduce((opSum: number, op: any) => opSum + op.finalWage, 0), 0);
    const totalRolls = logs.reduce((sum, l) => sum + (Number(l.output_qty) || 0), 0);

    // Get days in selected month for calendar
    const daysInMonth = useMemo(() => {
        if (viewMode !== 'monthly') return [];
        const [year, month] = selectedMonth.split('-');
        const days = new Date(parseInt(year), parseInt(month), 0).getDate();
        return Array.from({ length: days }, (_, i) => i + 1);
    }, [selectedMonth, viewMode]);

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 font-sans bg-[url('/grid-pattern.svg')] bg-fixed">
            <div className="max-w-[1200px] mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6 relative z-10">
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center gap-3 tracking-tight">
                            <BarChart3 className="text-blue-500" size={28} />
                            {viewMode === 'daily' ? 'Daily' : 'Monthly'} Production & Wage Report
                        </h1>
                        <p className="text-gray-500 text-sm mt-1 font-bold tracking-wide">
                            Clear view of who was on duty, what was produced, and relative salary.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Mode Toggle */}
                        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 relative">
                            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-blue-600 rounded-lg transition-transform duration-300 ${viewMode === 'monthly' ? 'translate-x-full' : 'translate-x-0'}`}/>
                            <button onClick={() => setViewMode('daily')} className={`w-20 relative z-10 py-1.5 text-xs font-black transition-colors ${viewMode === 'daily' ? 'text-white' : 'text-gray-500'}`}>Daily</button>
                            <button onClick={() => setViewMode('monthly')} className={`w-20 relative z-10 py-1.5 text-xs font-black transition-colors ${viewMode === 'monthly' ? 'text-white' : 'text-gray-500'}`}>Monthly</button>
                        </div>

                        {/* Date/Month Picker */}
                        <div className="flex items-center gap-2 bg-[#0f0f13] border border-white/10 p-1.5 rounded-xl">
                            {viewMode === 'daily' ? (
                                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                    className="bg-transparent border-none px-3 py-1 text-sm font-bold text-white focus:outline-none cursor-pointer tracking-wider" />
                            ) : (
                                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                                    className="bg-transparent border-none px-3 py-1 text-sm font-bold text-white focus:outline-none cursor-pointer tracking-wider" />
                            )}
                        </div>

                        <button onClick={() => setShowRates(!showRates)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 border ${showRates ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}>
                            <Settings2 size={16} /> Machine Rates
                        </button>

                        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 bg-blue-600 text-white hover:bg-blue-700">
                            <Download size={16} /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Rate Matrix Panel */}
                {showRates && (
                    <div className="mb-8 bg-[#0f0f13]/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
                        <h2 className="text-sm font-black mb-4 flex items-center gap-2 text-purple-400 uppercase tracking-widest">
                            <ShieldCheck size={16} /> Base Pricing Configuration
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                                        <th className="pb-3 px-2">Machine Unit</th>
                                        <th className="pb-3 px-2">Operator (RM/hr)</th>
                                        <th className="pb-3 px-2">Manager (RM/roll)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {MACHINES.map(m => {
                                        const r = rates.find(x => x.machine_id === m.id);
                                        return (
                                            <tr key={m.id} className="hover:bg-white/[0.02]">
                                                <td className="py-2 px-2 font-bold text-sm text-gray-300">{m.name}</td>
                                                <td className="py-2 px-2">
                                                    <input type="number" value={r?.operator_hourly_rate || 0} onChange={e => updateRate(r!.id, 'operator_hourly_rate', Number(e.target.value))}
                                                        className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:border-purple-500 outline-none" />
                                                </td>
                                                <td className="py-2 px-2">
                                                    <input type="number" value={r?.manager_piece_rate || 0} onChange={e => updateRate(r!.id, 'manager_piece_rate', Number(e.target.value))}
                                                        className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:border-purple-500 outline-none" />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Dashboard Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-[#12121a] border border-white/5 p-5 rounded-2xl">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Total Payout (Est)</div>
                        <div className="text-2xl font-black text-green-400">RM {totalPayout.toFixed(2)}</div>
                    </div>
                    <div className="bg-[#12121a] border border-white/5 p-5 rounded-2xl">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Total Output</div>
                        <div className="text-2xl font-black text-blue-400">{totalRolls} Rolls</div>
                    </div>
                    <div className="bg-[#12121a] border border-white/5 p-5 rounded-2xl">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Machines Active</div>
                        <div className="text-2xl font-black text-white">{reportData.length}</div>
                    </div>
                    <div className="bg-[#12121a] border border-white/5 p-5 rounded-2xl">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Staff Involved</div>
                        <div className="text-2xl font-black text-purple-400">{reportData.reduce((sum, m) => sum + m.operators.length, 0)}</div>
                    </div>
                </div>

                {/* Main Report List */}
                {loading ? (
                    <div className="p-20 flex justify-center"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"/></div>
                ) : reportData.length === 0 ? (
                    <div className="p-20 text-center border border-white/5 border-dashed rounded-3xl bg-[#0f0f13]/50 mt-8">
                        <CalendarDays size={32} className="text-gray-600 mx-auto mb-4" />
                        <div className="text-lg text-white font-bold mb-1">No Activity Detected</div>
                        <div className="text-sm text-gray-500">No logs found for this {viewMode === 'daily' ? 'day' : 'month'}.</div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {reportData.map(machine => {
                            const isCalendarOpen = expandedCalendars[machine.machine_id];
                            
                            return (
                                <div key={machine.machine_id} className="bg-[#0f0f13] border border-white/10 rounded-3xl overflow-hidden shadow-lg">
                                    {/* Machine Header */}
                                    <div className="bg-gradient-to-r from-blue-900/20 to-transparent border-b border-white/5 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-500/10 text-blue-400 p-2 rounded-lg"><Settings2 size={20} /></div>
                                            <div>
                                                <h2 className="text-lg font-black text-white">{machine.machine_name}</h2>
                                                <div className="text-[10px] text-gray-500 font-mono">{machine.machine_id}</div>
                                            </div>
                                        </div>
                                        
                                        {/* View Calendar Button (Only in Monthly Mode) */}
                                        {viewMode === 'monthly' && (
                                            <button 
                                                onClick={() => toggleCalendar(machine.machine_id)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isCalendarOpen ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                            >
                                                <CalendarIcon size={14} /> Presence Calendar
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* Operators List */}
                                    <div className="divide-y divide-white/5">
                                        {machine.operators.map((op: any) => (
                                            <div key={op.opId} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                                                
                                                {/* Who */}
                                                <div className="flex items-center gap-4 w-full md:w-1/4">
                                                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 relative">
                                                        <User size={18} className="text-gray-400" />
                                                        {viewMode === 'monthly' && (
                                                            <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-[#0f0f13]" title={`${op.daysWorked} days worked`}>
                                                                {op.daysWorked}d
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{op.name}</div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{op.role}</div>
                                                    </div>
                                                </div>

                                                {/* What Produced & Time */}
                                                <div className="flex gap-6 w-full md:w-1/3">
                                                    <div className="flex flex-col items-start min-w-[80px]">
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><Clock size={12}/> {viewMode === 'monthly' ? 'Total Time' : 'Time'}</div>
                                                        <div className="text-sm font-bold text-white mb-1">{op.totalHours.toFixed(1)} h</div>
                                                        {viewMode === 'daily' && op.timeSlots && op.timeSlots.length > 0 && (
                                                            <div className="flex flex-col gap-0.5">
                                                                {op.timeSlots.map((ts: string, i: number) => (
                                                                    <span key={i} className="text-[9px] text-cyan-400 font-mono tracking-tighter bg-cyan-500/10 px-1 py-0.5 rounded border border-cyan-500/20 whitespace-nowrap">{ts}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><Package size={12}/> Produced</div>
                                                        <div className="text-sm font-bold text-white">{op.totalRolls} rolls</div>
                                                    </div>
                                                    {viewMode === 'daily' && (
                                                        <div className="flex-1">
                                                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Jobs</div>
                                                            <div className="text-xs text-blue-400 font-mono truncate max-w-[120px]">
                                                                {op.jobs.length > 0 ? op.jobs.join(', ') : '-'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Pay Rate & Badges */}
                                                <div className="flex flex-col items-start md:items-center w-full md:w-1/4 gap-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${op.calcMode === 'hourly' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                                            {op.calcMode === 'hourly' ? `RM ${(op.rateInfo?.operator_hourly_rate || 0).toFixed(2)}/h` : `RM ${(op.rateInfo?.manager_piece_rate || 0).toFixed(2)}/roll`}
                                                        </span>
                                                        {op.nightShifts > 0 && <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-purple-500/10 text-purple-400 border-purple-500/20">{op.nightShifts}x Night</span>}
                                                        {op.otHours > 0 && <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-orange-500/10 text-orange-400 border-orange-500/20">{op.otHours.toFixed(1)}h OT</span>}
                                                    </div>
                                                </div>

                                                {/* Final Salary */}
                                                <div className="text-left md:text-right w-full md:w-32 shrink-0">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Earned</div>
                                                    <div className="text-xl font-black text-green-400">
                                                        RM {op.finalWage.toFixed(2)}
                                                    </div>
                                                </div>

                                            </div>
                                        ))}
                                    </div>

                                    {/* Monthly Presence Matrix (Expanded Calendar) */}
                                    {viewMode === 'monthly' && isCalendarOpen && (
                                        <div className="bg-black/60 border-t border-white/5 p-6 animate-in slide-in-from-top-2">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
                                                <CalendarIcon size={14} /> Operator Presence Heatmap ({selectedMonth})
                                            </h3>
                                            
                                            <div className="overflow-x-auto pt-20 pb-4 better-scrollbar">
                                                <div className="min-w-max">
                                                    {/* Calendar Header (Days) */}
                                                    <div className="flex ml-40 gap-1.5">
                                                        {daysInMonth.map(day => (
                                                            <div key={day} className="w-6 flex-shrink-0 text-center text-[10px] font-bold text-gray-500 pb-2">
                                                                {day}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Calendar Rows (Operators) */}
                                                    <div className="space-y-2">
                                                        {machine.operators.map((op: any) => (
                                                            <div key={op.opId} className="flex items-center hover:bg-white/5 rounded-lg transition-colors p-1 pr-4">
                                                                <div className="w-40 flex-shrink-0 pr-4 flex items-center justify-end gap-2 text-right">
                                                                    <div className="text-[10px] text-gray-500 font-mono">{op.role === 'Manager' ? 'MGR' : 'OP'}</div>
                                                                    <div className="text-xs font-bold text-gray-300 truncate max-w-[100px]">{op.name}</div>
                                                                </div>
                                                                
                                                                <div className="flex gap-1.5 items-center">
                                                                    {daysInMonth.map(day => {
                                                                        const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
                                                                        const dayData = op.attMap[dateStr];
                                                                        const isPresent = !!dayData;
                                                                        const isNight = dayData?.isNight;
                                                                        
                                                                        // Round to 1 decimal place to avoid floating point > 8 false positives
                                                                        const roundedHours = isPresent ? Math.round(dayData.hours * 10) / 10 : 0;
                                                                        const isOT = roundedHours > 8;
                                                                        const hasOverlap = isPresent && dayData.rawHours > dayData.hours + 0.05;

                                                                        // Color logic based on what they worked
                                                                        let bgClass = "bg-white/5 border border-white/5"; // Empty
                                                                        if (isPresent) {
                                                                            if (isNight) bgClass = "bg-purple-500 border border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]";
                                                                            else if (isOT) bgClass = "bg-orange-500 border border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.4)]";
                                                                            else bgClass = "bg-cyan-500 border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]";
                                                                        }

                                                                        return (
                                                                            <div key={day} className="relative group z-10 hover:z-50">
                                                                                <div 
                                                                                    className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-black cursor-pointer transition-transform hover:scale-125 ${bgClass}`}
                                                                                >
                                                                                    {isPresent && (roundedHours % 1 === 0 ? roundedHours : roundedHours.toFixed(1))}
                                                                                </div>
                                                                                {isPresent && (
                                                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-max bg-gray-900 border border-white/10 text-white text-[10px] p-2 rounded shadow-2xl pointer-events-none">
                                                                                        <div className="font-bold text-blue-400 mb-1 border-b border-white/10 pb-1 flex items-center gap-2">
                                                                                            <span>{dateStr}</span>
                                                                                            <span className="text-gray-400">|</span>
                                                                                            <span>{roundedHours.toFixed(1)}h</span>
                                                                                            {isNight && <span className="text-purple-400" title="Night Shift">🌙</span>}
                                                                                            {isOT && <span className="text-orange-400" title="Overtime">⚠️</span>}
                                                                                            {hasOverlap && <span className="text-red-400" title="Overlapping logs">🔗</span>}
                                                                                        </div>
                                                                                        {dayData.logs.map((l: any, i: number) => {
                                                                                            const tIn = l.clock_in ? new Date(l.clock_in).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' }) : '?';
                                                                                            const tOut = l.clock_out ? new Date(l.clock_out).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' }) : 'Active';
                                                                                            return <div key={i} className="font-mono text-gray-300 flex justify-between gap-4">
                                                                                                <span className="text-gray-500">Log {i+1}:</span> 
                                                                                                <span><span className="text-green-400">{tIn}</span> → <span className={l.clock_out ? "text-red-400" : "text-cyan-400 animate-pulse"}>{tOut}</span></span>
                                                                                            </div>
                                                                                        })}
                                                                                        {hasOverlap && (
                                                                                            <div className="text-red-400 font-bold text-[9px] mt-1 pt-1 border-t border-red-500/20">
                                                                                                ⚠️ Duplicate/Overlapping logs merged (Raw: {dayData.rawHours.toFixed(1)}h)
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Legend */}
                                            <div className="mt-4 flex items-center gap-6 justify-center bg-white/5 w-fit mx-auto px-4 py-2 rounded-full border border-white/10">
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-cyan-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Normal Shift</span></div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Overtime (&gt;8h)</span></div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-purple-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Night Shift</span></div>
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

export default MachineSchedule;
