import React, { useState, useEffect, useMemo } from 'react';
import {
    CalendarDays, Award, AlertTriangle, Camera,
    DollarSign, Clock, ChevronLeft, ChevronRight, Activity, Users, Truck, X
} from 'lucide-react';
import { supabase } from '../services/supabase';

interface Props {
    user: any;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface DailyMetrics {
    dateStr: string;
    dayNum: number;
    isWeekend: boolean;
    hasAttendance: boolean;
    outputQty: number;
    alarmCount: number;
    tripCount: number;
    tripEarnings: number;
    tripDetails: {
        id: string;
        order_number: string;
        customer: string;
        items: any[];
        notes: string;
        displayString: string;
    }[];
    photoCount: number;
    leaveStatus: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    machinesOperated: string[];
}

const PersonalMonthlyReport: React.FC<Props> = ({ user }) => {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [loading, setLoading] = useState(true);

    // Profile state for the logged-in user
    const [, setLoggedInProfile] = useState<any>(null);

    // HR/Admin Selector States
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(user.uid || user.id);
    const [employeesList, setEmployeesList] = useState<any[]>([]);
    
    // Viewed Profile (could be self or someone else)
    const [viewedProfile, setViewedProfile] = useState<any>(null);

    // Data states
    const [productionLogs, setProductionLogs] = useState<any[]>([]);
    const [attendanceShifts, setAttendanceShifts] = useState<any[]>([]);
    const [photoLogs, setPhotoLogs] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [plannedMachines, setPlannedMachines] = useState<any[]>([]);
    const [payroll, setPayroll] = useState<any | null>(null);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);
    const [selectedTrip, setSelectedTrip] = useState<any | null>(null);

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    // 1. Initial Load: Fetch Logged In User Profile to check permissions
    useEffect(() => {
        if (!user) return;
        const fetchPermissions = async () => {
            const { data } = await supabase
                .from('sys_users_v2')
                .select('role, auth_user_id')
                .eq('auth_user_id', user.uid || user.id)
                .single();
            
            setLoggedInProfile(data || { role: user.role });

            // If Manager/HR/Admin/SuperAdmin, fetch all employees
            const role = data?.role || user.role;
            if (['SuperAdmin', 'Admin', 'Manager', 'HR'].includes(role)) {
                const [v2Res, pubRes] = await Promise.all([
                    supabase.from('sys_users_v2').select('auth_user_id, name, employee_id, role, status').eq('status', 'Active'),
                    supabase.from('users_public').select('id, name, employee_id, role, status').eq('status', 'Active')
                ]);
                
                let merged: any[] = [];
                if (v2Res.data) {
                    merged = [...v2Res.data.filter(e => e.auth_user_id).map(e => ({...e, uid: e.auth_user_id}))];
                }
                if (pubRes.data) {
                    pubRes.data.forEach(p => {
                        if (!merged.find(m => m.uid === p.id)) {
                            merged.push({...p, uid: p.id, auth_user_id: p.id});
                        }
                    });
                }
                setEmployeesList(merged.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            }
        };
        fetchPermissions();
    }, [user]);

    // 2. Fetch Data whenever Employee or Month changes
    useEffect(() => {
        if (!selectedEmployeeId) return;
        fetchData();
    }, [selectedEmployeeId, selectedMonth, selectedYear]);

    const fetchData = async () => {
        setLoading(true);

        const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const lastDayObj = new Date(selectedYear, selectedMonth, 0);
        const lastDayStr = `${lastDayObj.getFullYear()}-${String(lastDayObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
        const startDateTs = `${firstDay}T00:00:00.000Z`;
        const endDateTs = `${lastDayStr}T23:59:59.999Z`;

        try {
            // A. Fetch Viewed User Profile
            let { data: profileData } = await supabase
                .from('sys_users_v2')
                .select('*')
                .eq('auth_user_id', selectedEmployeeId)
                .single();

            if (!profileData) {
                // Check users_public (for standalone Drivers)
                const { data: pubData } = await supabase
                    .from('users_public')
                    .select('*')
                    .eq('id', selectedEmployeeId)
                    .single();
                
                if (pubData) {
                    profileData = { ...pubData, auth_user_id: pubData.id };
                }
            }

            setViewedProfile(profileData);
            
            const activeEmpId = profileData ? profileData.employee_id : (selectedEmployeeId === (user.uid || user.id) ? user.employeeId : undefined);

            // C. Fetch Attendance First
            let attendanceData: any[] = [];
            if (activeEmpId) {
                const { data } = await supabase
                    .from('operator_attendance')
                    .select('date, clock_in, clock_out, hours_worked, machine_id, notes')
                    .eq('operator_id', activeEmpId)
                    .gte('date', firstDay)
                    .lte('date', lastDayStr);
                attendanceData = data || [];
            }
            setAttendanceShifts(attendanceData);
            setPlannedMachines([]);

            // B. Fetch Production Logs based on Time-matching & Explicit ID
            let prodData: any[] = [];
            if (activeEmpId || selectedEmployeeId) {
                const machinesTouched = Array.from(new Set(attendanceData.map(a => a.machine_id).filter(Boolean)));
                let rawLogs: any[] = [];
                
                if (machinesTouched.length > 0) {
                    let allRawLogs: any[] = [];
                    let hasMore = true;
                    let offset = 0;
                    
                    while (hasMore) {
                        const { data } = await supabase
                            .from('production_logs_v2')
                            .select('log_id, created_at, output_qty, reject_qty, machine_id, job_id, operator_id')
                            .in('machine_id', machinesTouched)
                            .gte('created_at', startDateTs)
                            .lte('created_at', endDateTs)
                            .range(offset, offset + 999);
                            
                        if (data && data.length > 0) {
                            allRawLogs.push(...data);
                            offset += 1000;
                            if (data.length < 1000) hasMore = false;
                        } else {
                            hasMore = false;
                        }
                    }
                    rawLogs = allRawLogs;
                }
                
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                const validIds = [selectedEmployeeId, activeEmpId].filter(id => id && uuidRegex.test(id));
                let explicitLogs: any[] = [];
                if (validIds.length > 0) {
                    const orStr = validIds.map(id => `operator_id.eq.${id}`).join(',');
                    let hasMoreExplicit = true;
                    let offsetExplicit = 0;
                    
                    while (hasMoreExplicit) {
                        const { data } = await supabase
                            .from('production_logs_v2')
                            .select('log_id, created_at, output_qty, reject_qty, machine_id, job_id, operator_id')
                            .or(orStr)
                            .gte('created_at', startDateTs)
                            .lte('created_at', endDateTs)
                            .range(offsetExplicit, offsetExplicit + 999);
                            
                        if (data && data.length > 0) {
                            explicitLogs.push(...data);
                            offsetExplicit += 1000;
                            if (data.length < 1000) hasMoreExplicit = false;
                        } else {
                            hasMoreExplicit = false;
                        }
                    }
                }
                    
                const allLogs = [...rawLogs, ...explicitLogs];
                
                const logMap = new Map();
                allLogs.forEach(log => {
                    const uniqueId = log.log_id || (log.created_at + log.machine_id);
                    if (logMap.has(uniqueId)) return;
                    
                    if (log.operator_id === selectedEmployeeId || log.operator_id === activeEmpId) {
                        logMap.set(uniqueId, log);
                        return;
                    }
                    
                    const logTime = new Date(log.created_at).getTime();
                    const belongsToMe = attendanceData.some(shift => {
                        if (shift.machine_id !== log.machine_id) return false;
                        const inTime = new Date(shift.clock_in).getTime();
                        const maxOutTime = inTime + (14 * 60 * 60 * 1000); // 14 hours max duration
                        const outTime = shift.clock_out ? new Date(shift.clock_out).getTime() : Math.min(new Date().getTime() + 86400000, maxOutTime);
                        return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                    });
                    
                    if (belongsToMe) {
                        logMap.set(uniqueId, log);
                    }
                });
                
                prodData = Array.from(logMap.values());
            }
            setProductionLogs(prodData);

            // D. Photos
            if (activeEmpId) {
                const { data: photoData } = await supabase
                    .from('work_photos')
                    .select('created_at, category, risk_flag, photo_url')
                    .eq('employee_id', activeEmpId)
                    .gte('created_at', startDateTs)
                    .lte('created_at', endDateTs);
                setPhotoLogs(photoData || []);
            } else {
                setPhotoLogs([]);
            }

            // E. Leaves
            const { data: leaveData } = await supabase
                .from('employee_leave')
                .select('start_date, end_date, status, reason')
                .eq('employee_id', selectedEmployeeId)
                .eq('status', 'Approved')
                .lte('start_date', lastDayStr) 
                .gte('end_date', firstDay);   
            setLeaves(leaveData || []);

            // F. Payroll
            if (activeEmpId) {
                const { data: payrollData } = await supabase
                    .from('payroll_records')
                    .select('*')
                    .eq('employee_id', activeEmpId)
                    .eq('month', selectedMonth)
                    .eq('year', selectedYear)
                    .maybeSingle();
                setPayroll(payrollData || null);
            } else {
                setPayroll(null);
            }

            // G. Deliveries (For Drivers)
            if (profileData?.role === 'Driver' || (!profileData && user.role === 'Driver')) {
                const { data: dr } = await supabase.from('delivery_rates').select('*');
                setDeliveryRates(dr || []);

                const { data: deliveryData } = await supabase
                    .from('sales_orders')
                    .select('id, order_number, customer, items, notes, order_date, pod_timestamp, deadline, zone, delivery_address, created_at, trip_origin, trip_drop_count')
                    .eq('driver_id', selectedEmployeeId) 
                    .eq('status', 'Delivered')
                    .gte('deadline', startDateTs.split('T')[0])
                    .lte('deadline', endDateTs.split('T')[0]);
                setDeliveries(deliveryData || []);
            } else {
                setDeliveries([]);
                setDeliveryRates([]);
            }

        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            setLoading(false);
        }
    };

    const changeMonth = (offset: number) => {
        let m = selectedMonth + offset;
        let y = selectedYear;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        setSelectedMonth(m);
        setSelectedYear(y);
    };

    // Calculate Daily Matrix
    const dailyMetrics = useMemo(() => {
        const matrix: DailyMetrics[] = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dateObj = new Date(selectedYear, selectedMonth - 1, i);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            const matchDate = (utcIsoString: string | null | undefined, targetDateStr: string) => {
                if (!utcIsoString) return false;
                // Convert UTC timestamp to local Date object, then format as YYYY-MM-DD
                const d = new Date(utcIsoString);
                const localY = d.getFullYear();
                const localM = String(d.getMonth() + 1).padStart(2, '0');
                const localD = String(d.getDate()).padStart(2, '0');
                return `${localY}-${localM}-${localD}` === targetDateStr;
            };

            // Prod
            const dayProd = productionLogs.filter(p => {
                const logTime = new Date(p.created_at).getTime();
                // Check if this log belongs to a known shift
                const matchingShift = attendanceShifts.find(shift => {
                    if (p.machine_id && shift.machine_id && p.machine_id !== shift.machine_id) return false;
                    const inTime = new Date(shift.clock_in).getTime();
                    const outTime = shift.clock_out ? new Date(shift.clock_out).getTime() : inTime + (14 * 3600000);
                    return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                });

                if (matchingShift) {
                    return matchingShift.date === dateStr;
                }
                
                return matchDate(p.created_at, dateStr);
            });
            const outputQty = dayProd.reduce((sum, p) => sum + (Number(p.output_qty) || 0), 0);
            const alarmCount = dayProd.reduce((sum, p) => sum + (Number(p.alarm_count) || Number(p.reject_qty) || 0), 0);

            // Photos
            const dayPhotos = photoLogs.filter(p => matchDate(p.created_at, dateStr));

            // Shift
            const dayShift = attendanceShifts.find(s => s.date === dateStr);
            const dayPlans = plannedMachines.filter(s => s.shift_date === dateStr);

            const machinesOperated = Array.from(new Set([
                ...dayPlans.map(p => p.machine_id),
                ...dayProd.map(p => {
                    if (p.machine_id && p.machine_id.trim() !== '') return p.machine_id;
                    if (p.job_id && String(p.job_id).startsWith('JOB-')) return String(p.job_id).split('-')[1];
                    return null;
                })
            ].filter(Boolean)));

            // Leave
            const dayLeave = leaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);

            const dayDeliveries = deliveries.filter(d => {
                const ts = d.deadline || d.created_at;
                if (!ts) return false;
                if (d.deadline) return ts.startsWith(dateStr); // deadline is usually purely 'YYYY-MM-DD'
                return matchDate(ts, dateStr);
            });
            const tripCount = dayDeliveries.length;
            const tripDetails: any[] = [];

            let tripEarnings = 0;
            const rateMap: Record<string, any> = {};
            deliveryRates.forEach(r => { rateMap[`${r.origin}-${r.location_name}`.toLowerCase()] = r; });

            dayDeliveries.forEach(t => {
                const originRaw = t.trip_origin || 'TAIPING';
                const origin = originRaw.toLowerCase();
                const zoneRaw = t.zone || t.delivery_address || 'Unknown';
                let calcZone = zoneRaw.toLowerCase();
                let displayZone = zoneRaw;

                const key = `${origin}-${calcZone}`;
                const rateInfo = rateMap[key];
                const drops = Math.max(1, t.trip_drop_count || 1);

                if (rateInfo) {
                    const base = Number(rateInfo.base_rate) || 0;
                    const maxPlaces = Number(rateInfo.max_places) || 0;
                    const extraPlaces = Math.max(0, drops - maxPlaces);
                    const extraRate = extraPlaces * (Number(rateInfo.extra_rate_per_place) || 0);
                    tripEarnings += (base + extraRate);
                }

                // Push formatting: "TAIPING ➞ KL (2 Drops)"
                tripDetails.push({
                    id: t.id,
                    order_number: t.order_number,
                    customer: t.customer,
                    items: t.items,
                    notes: t.notes,
                    displayString: `${originRaw} ➞ ${displayZone} (${drops} Drop${drops > 1 ? 's' : ''})`
                });
            });

            matrix.push({
                dateStr,
                dayNum: i,
                isWeekend,
                hasAttendance: !!dayShift,
                shiftStart: (dayShift && dayShift.clock_in) ? new Date(dayShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                shiftEnd: (dayShift && dayShift.clock_out) ? new Date(dayShift.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                notes: dayShift?.notes || null,
                outputQty,
                alarmCount,
                tripCount,
                tripEarnings,
                tripDetails,
                photoCount: dayPhotos.length,
                leaveStatus: dayLeave ? dayLeave.status : null,
                machinesOperated
            });
        }
        return matrix;
    }, [productionLogs, attendanceShifts, photoLogs, leaves, plannedMachines, deliveries, deliveryRates, daysInMonth, selectedYear, selectedMonth]);

    // Summary Aggregates
    const totalOutput = dailyMetrics.reduce((sum, d) => sum + d.outputQty, 0);
    const totalAlarms = dailyMetrics.reduce((sum, d) => sum + d.alarmCount, 0);
    const totalTrips = dailyMetrics.reduce((sum, d) => sum + d.tripCount, 0);
    const presentDays = dailyMetrics.filter(d => d.hasAttendance).length;
    const leaveDays = dailyMetrics.filter(d => d.leaveStatus).length;
    const totalPhotos = photoLogs.length;

    const canSelectEmployee = employeesList.length > 0;
    const isDriver = viewedProfile?.role === 'Driver' || (!viewedProfile && user?.role === 'Driver');

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-6 font-sans">
            {/* Header Area */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-1 flex items-center gap-3">
                        <Activity className="text-blue-500" size={28} />
                        Monthly Report
                    </h1>
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-500">
                            Viewing analytics for:
                        </p>
                        {canSelectEmployee ? (
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Users size={14} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
                                </div>
                                <select 
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    className="pl-9 pr-8 py-1.5 bg-[#0d0d12] border border-white/10 hover:border-blue-500/50 rounded-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer transition-colors"
                                >
                                    {employeesList.map(emp => (
                                        <option key={emp.auth_user_id} value={emp.auth_user_id}>
                                            {emp.name || emp.employee_id} ({emp.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <span className="text-sm font-bold text-gray-300 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                                {viewedProfile?.name || user?.name} ({viewedProfile?.role || user?.role})
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-[#0d0d12] border border-white/10 rounded-2xl px-5 py-3 shadow-lg">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="text-center min-w-[140px]">
                        <div className="text-xl font-black text-white">{MONTH_NAMES[selectedMonth - 1]}</div>
                        <div className="text-xs text-blue-400 tracking-widest uppercase font-bold">{selectedYear}</div>
                    </div>
                    <button onClick={() => changeMonth(1)} disabled={selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()}
                        className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-r-2 border-indigo-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}></div>
                    </div>
                    <p className="text-blue-400 font-bold tracking-widest uppercase text-sm animate-pulse">Calculating Metrics...</p>
                </div>
            ) : (
                <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* Top Row: Metrics Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Attendance Card */}
                        <div className="bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-1">Attendance</p>
                                    <h3 className="text-3xl font-black text-white">{presentDays} <span className="text-sm font-normal text-gray-500">days</span></h3>
                                    <p className="text-xs text-gray-400 mt-2">{leaveDays} approved leaves</p>
                                </div>
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                                    <CalendarDays size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Production / Deliveries Card */}
                        <div className={`bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group transition-colors ${isDriver ? 'hover:border-amber-500/30' : 'hover:border-blue-500/30'}`}>
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all ${isDriver ? 'bg-amber-500/10 group-hover:bg-amber-500/20' : 'bg-blue-500/10 group-hover:bg-blue-500/20'}`}></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${isDriver ? 'text-amber-400' : 'text-blue-400'}`}>
                                        {isDriver ? 'Total Deliveries' : 'Total Output'}
                                    </p>
                                    <h3 className="text-3xl font-black text-white">{isDriver ? totalTrips : totalOutput.toLocaleString()}</h3>
                                    <p className="text-xs text-gray-400 mt-2">{isDriver ? 'Completed trips' : 'Units / KG produced'}</p>
                                </div>
                                <div className={`p-3 rounded-2xl border ${isDriver ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    {isDriver ? <Truck size={20} /> : <Award size={20} />}
                                </div>
                            </div>
                        </div>

                        {/* Alarms / Zones Card */}
                        {!isDriver && (
                            <div className="bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group transition-colors hover:border-red-500/30">
                                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all bg-red-500/10 group-hover:bg-red-500/20"></div>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-black mb-1 text-red-400">
                                            Anomalies
                                        </p>
                                        <h3 className="text-3xl font-black text-white">
                                            {totalAlarms}
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-2">Alarms / Rejects handled</p>
                                    </div>
                                    <div className="p-3 rounded-2xl border bg-red-500/10 text-red-500 border-red-500/20">
                                        <AlertTriangle size={20} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Photo Logs Card */}
                        <div className="bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group hover:border-violet-500/30 transition-colors">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] text-violet-400 uppercase tracking-widest font-black mb-1">Photo Logs</p>
                                    <h3 className="text-3xl font-black text-white">{totalPhotos} <span className="text-sm font-normal text-gray-500">logs</span></h3>
                                    <p className="text-xs text-gray-400 mt-2">Submitted visual records</p>
                                </div>
                                <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-400 border border-violet-500/20">
                                    <Camera size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Payroll Estimate Card */}
                        <div className="bg-gradient-to-br from-green-950/30 to-black border border-green-500/20 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                            <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] text-green-400 uppercase tracking-widest font-black mb-1">Recorded Wallet</p>
                                    {payroll ? (
                                        <>
                                            <h3 className="text-2xl font-black text-green-300">RM {Number(payroll.net_salary).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</h3>
                                            <p className="text-[10px] text-green-500/60 mt-2 uppercase font-bold tracking-wider">Payroll Processed</p>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-lg font-black text-gray-400 italic mt-2">Pending Calc.</h3>
                                            <p className="text-[10px] text-gray-500 mt-2 uppercase">Subject to final HR review</p>
                                        </>
                                    )}
                                </div>
                                <div className="p-3 bg-green-500/10 rounded-2xl text-green-400 border border-green-500/30">
                                    <DollarSign size={20} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Breakdown Section */}
                    <div className="bg-[#0d0d12] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                                <Clock size={18} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white">Daily Timeline</h2>
                                <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mt-0.5">Day by Day Breakdown</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/40">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02]">
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Date</th>
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-32">Status</th>
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Scan In/Out</th>
                                        <th className="px-5 py-4 text-right font-black text-[10px] uppercase tracking-widest text-gray-500">{isDriver ? 'Trips' : 'Output'}</th>
                                        <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500">{isDriver ? 'Trip Details' : 'Machines / Alarms'}</th>
                                        <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500">Photos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {dailyMetrics.map((day) => (
                                        <tr key={day.dateStr} className={`transition-colors hover:bg-white/[0.03] ${day.isWeekend ? 'bg-white/[0.01]' : ''}`}>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className={`font-black text-lg ${day.isWeekend ? 'text-gray-600' : 'text-gray-300'}`}>{day.dayNum}</span>
                                                    <span className="text-[9px] uppercase tracking-widest font-bold text-gray-600">
                                                        {new Date(day.dateStr).toLocaleDateString('en-US', { weekday: 'short' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {day.leaveStatus ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider">
                                                        Leave ({day.leaveStatus})
                                                    </span>
                                                ) : day.hasAttendance ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                                        Present
                                                    </span>
                                                ) : day.isWeekend ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-white/5 border border-white/5 text-gray-500 text-[10px] font-black uppercase tracking-wider">
                                                        Weekend
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-gray-800 text-gray-500 text-[10px] font-black uppercase tracking-wider">
                                                        No Log
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {day.hasAttendance ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 font-mono text-xs">
                                                            <span className="text-green-400">{day.shiftStart || '-'}</span>
                                                            <span className="text-gray-600">→</span>
                                                            <span className="text-orange-400">{day.shiftEnd || 'Active'}</span>
                                                        </div>
                                                        {day.notes === 'System Auto-Logout' && (
                                                            <span className="text-[9px] uppercase font-bold text-red-500/80 bg-red-500/10 px-1.5 py-0.5 rounded w-fit border border-red-500/20">
                                                                Auto-Logout
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-700 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                {isDriver ? (
                                                    day.tripCount > 0 ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-mono text-amber-400 font-bold">{day.tripCount} <span className="text-[10px] text-gray-500">trips</span></span>
                                                            {day.tripEarnings > 0 && (
                                                                <span className="text-[10px] text-green-400 font-mono mt-0.5">+ RM{day.tripEarnings.toFixed(2)}</span>
                                                            )}
                                                        </div>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                ) : (
                                                    day.outputQty > 0 ? (
                                                        <span className="font-mono text-blue-400 font-bold">{day.outputQty.toLocaleString()}</span>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                )}
                                            </td>
                                            {isDriver ? (
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    {day.tripDetails && day.tripDetails.length > 0 ? (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            {day.tripDetails.map((td, idx) => (
                                                                <button 
                                                                    key={idx} 
                                                                    onClick={() => setSelectedTrip(td)}
                                                                    className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 px-2 py-0.5 rounded font-mono shadow-sm cursor-pointer transition-colors"
                                                                >
                                                                    {td.displayString}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : <span className="text-gray-700 font-mono">—</span>}
                                                </td>
                                            ) : (
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {day.machinesOperated.length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-1">
                                                                {day.machinesOperated.map(m => (
                                                                    <span key={m} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono shadow-sm">{m}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {day.alarmCount > 0 && (
                                                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20" title={`${day.alarmCount} anomalies recorded`}>
                                                                {day.alarmCount} Alarms
                                                            </span>
                                                        )}
                                                        {day.machinesOperated.length === 0 && day.alarmCount === 0 && (
                                                            <span className="text-gray-700 font-mono">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                {day.photoCount > 0 ? (
                                                    <div className="flex items-center justify-center gap-1.5 text-violet-400">
                                                        <Camera size={14} />
                                                        <span className="text-xs font-bold">{day.photoCount}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-700">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                    </div>
                </div>
            )}
            {/* Trip Detail Modal */}
            {selectedTrip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#09090b] border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl shadow-black relative overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 bg-slate-900/50 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <Truck size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        {selectedTrip.order_number || 'Unknown DO'}
                                    </h2>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
                                        Trip Details
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedTrip(null)}
                                className="p-2 -mr-2 -mt-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-950">
                            
                            {/* Route & Customer */}
                            <div className="space-y-4 bg-[#0d0d12] border border-white/5 p-4 rounded-xl">
                                <div>
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Route summary</div>
                                    <div className="text-sm font-bold text-blue-400 font-mono bg-blue-500/10 inline-block px-3 py-1 rounded border border-blue-500/20">
                                        {selectedTrip.displayString}
                                    </div>
                                </div>
                                {selectedTrip.customer && (
                                    <div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Customer</div>
                                        <div className="text-sm font-bold text-gray-200">
                                            {selectedTrip.customer}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Load Items
                                </h3>
                                
                                {selectedTrip.items && selectedTrip.items.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedTrip.items.map((item: any, idx: number) => (
                                            <div key={idx} className="bg-[#121214] border border-[#27272a] p-3 rounded-lg flex items-center justify-between gap-3 group hover:border-blue-500/30 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-gray-200 truncate">{item.product}</div>
                                                    {(item.remark || item.sourceLocation) && (
                                                        <div className="text-[10px] font-mono text-gray-500 mt-1 truncate">
                                                            {item.sourceLocation && <span className="text-blue-400 mr-2">[{item.sourceLocation}]</span>}
                                                            {item.remark}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 pl-3 border-l border-white/5 shrink-0">
                                                    <span className="text-lg font-black font-mono text-white">x{item.quantity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-center text-xs text-gray-500 font-bold">
                                        No items recorded for this trip.
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            {selectedTrip.notes && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        Trip Notes
                                    </h3>
                                    <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-200/80 leading-relaxed font-medium">
                                        {selectedTrip.notes}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalMonthlyReport;
