import React, { useState, useEffect, useMemo } from 'react';
import {
    CalendarDays, Award, AlertTriangle, Camera,
    DollarSign, Clock, ChevronLeft, ChevronRight, Truck, MapPin, User as UserIcon
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
    zones: string[];
    photoCount: number;
    leaveStatus: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    trips: any[];
}

const PersonalMonthlyReport: React.FC<Props> = ({ user }) => {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [loading, setLoading] = useState(true);



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
    const [payroll, setPayroll] = useState<any | null>(null);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);

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
            
            // If Manager/HR/Admin/SuperAdmin, fetch all employees
            const role = data?.role || user.role;
            if (['SuperAdmin', 'Admin', 'Manager', 'HR'].includes(role)) {
                const { data: allEmp } = await supabase
                    .from('sys_users_v2')
                    .select('auth_user_id, name, employee_id, role, status')
                    .eq('status', 'Active')
                    .order('name');
                if (allEmp) {
                    // Filter out rows without auth_user_id if any, or just show them
                    setEmployeesList(allEmp.filter(e => e.auth_user_id));
                }
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
        const lastDayStr = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
        const startDateTs = `${firstDay}T00:00:00.000Z`;
        const endDateTs = `${lastDayStr}T23:59:59.999Z`;

        try {
            // A. Fetch Viewed User Profile
            const { data: profileData } = await supabase
                .from('sys_users_v2')
                .select('*')
                .eq('auth_user_id', selectedEmployeeId)
                .single();

            setViewedProfile(profileData);
            
            const activeEmpId = profileData ? profileData.employee_id : (selectedEmployeeId === (user.uid || user.id) ? user.employeeId : undefined);

            // B. Production Logs
            const { data: prodData } = await supabase
                .from('production_logs_v2')
                .select('created_at, output_qty, reject_qty, alarm_count')
                .eq('operator_id', selectedEmployeeId)
                .gte('created_at', startDateTs)
                .lte('created_at', endDateTs);
            setProductionLogs(prodData || []);

            // C. Attendance (Using operator_attendance)
            let attendanceData: any[] = [];
            if (activeEmpId) {
                const { data } = await supabase
                    .from('operator_attendance')
                    .select('date, clock_in, clock_out, hours_worked')
                    .eq('operator_id', activeEmpId)
                    .gte('date', firstDay)
                    .lte('date', lastDayStr);
                attendanceData = data || [];
            }
            setAttendanceShifts(attendanceData);

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

            // G. Deliveries & Rates (For Drivers)
            const isDriverProfile = profileData?.role === 'Driver' || (!profileData && user.role === 'Driver');
            if (isDriverProfile) {
                // Fetch HR Rates for commission calculation
                const { data: routeRates } = await supabase.from('delivery_rates').select('*');
                setDeliveryRates(routeRates || []);

                // Fetch trips: either completed this month, or created this month and pending
                const { data: deliveryData, error: dErr } = await supabase
                    .from('sales_orders')
                    .select('id, order_number, status, order_date, pod_timestamp, zone, trip_origin, trip_drop_count')
                    .eq('driver_id', selectedEmployeeId)
                    .or(`pod_timestamp.gte.${startDateTs},order_date.gte.${firstDay}`);
                
                if (dErr) console.error("Query Error: ", dErr);

                // Client-side exact filtering
                const validDeliveries = (deliveryData || []).filter(d => {
                    if (d.status === 'Delivered' && d.pod_timestamp) {
                        return d.pod_timestamp >= startDateTs && d.pod_timestamp <= endDateTs;
                    }
                    if (d.order_date) {
                        const od = d.order_date.split('T')[0];
                        return od >= firstDay && od <= lastDayStr;
                    }
                    return false;
                });
                
                // Sort by pod_timestamp, fallback to order_date
                validDeliveries.sort((a, b) => {
                    const dateA = a.pod_timestamp || a.order_date;
                    const dateB = b.pod_timestamp || b.order_date;
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                });

                setDeliveries(validDeliveries);
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

            // Prod
            const dayProd = productionLogs.filter(p => p.created_at.startsWith(dateStr));
            const outputQty = dayProd.reduce((sum, p) => sum + (Number(p.output_qty) || 0), 0);
            const alarmCount = dayProd.reduce((sum, p) => sum + (Number(p.alarm_count) || Number(p.reject_qty) || 0), 0);

            // Photos
            const dayPhotos = photoLogs.filter(p => p.created_at.startsWith(dateStr));

            // Shift
            const dayShift = attendanceShifts.find(s => s.date === dateStr);

            // Leave
            const dayLeave = leaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);

            // Deliveries
            const dayDeliveries = deliveries.filter(d => {
                const targetDateStr = d.pod_timestamp || d.order_date;
                return targetDateStr && targetDateStr.startsWith(dateStr);
            });
            const tripCount = dayDeliveries.length;
            const zones = dayDeliveries.map(d => d.zone).filter(Boolean);

            matrix.push({
                dateStr,
                dayNum: i,
                isWeekend,
                hasAttendance: !!dayShift,
                shiftStart: (dayShift && dayShift.clock_in) ? new Date(dayShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                shiftEnd: (dayShift && dayShift.clock_out) ? new Date(dayShift.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                outputQty,
                alarmCount,
                tripCount,
                zones,
                trips: dayDeliveries,
                photoCount: dayPhotos.length,
                leaveStatus: dayLeave ? dayLeave.status : null
            });
        }
        return matrix;
    }, [productionLogs, attendanceShifts, photoLogs, leaves, daysInMonth, selectedYear, selectedMonth]);

    // Summary Aggregates
    const totalOutput = dailyMetrics.reduce((sum, d) => sum + d.outputQty, 0);
    const totalAlarms = dailyMetrics.reduce((sum, d) => sum + d.alarmCount, 0);
    const totalTrips = dailyMetrics.reduce((sum, d) => sum + d.tripCount, 0);
    const presentDays = dailyMetrics.filter(d => d.hasAttendance).length;
    const leaveDays = dailyMetrics.filter(d => d.leaveStatus).length;
    const totalPhotos = photoLogs.length;

    const canSelectEmployee = employeesList.length > 0;
    const isDriver = viewedProfile?.role === 'Driver' || (!viewedProfile && user?.role === 'Driver');

    // Calculate Estimated Commission
    const estimatedCommission = useMemo(() => {
        if (!isDriver) return 0;
        let total = 0;
        deliveries.forEach(trip => {
            const r = deliveryRates.find(r => 
                (r.origin || '').toLowerCase() === (trip.trip_origin || '').toLowerCase() &&
                (r.location_name || '').toLowerCase() === (trip.zone || '').toLowerCase()
            );
            
            if (r) {
                const base = r.base_rate || 0;
                const drops = trip.trip_drop_count || 1;
                const maxP = r.max_places || 1;
                const extra = r.extra_rate_per_place || 0;
                
                total += base + (Math.max(0, drops - maxP) * extra);
            }
        });
        return total;
    }, [deliveries, deliveryRates, isDriver]);

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-6 font-sans">
            {/* Header Area */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                
                {/* Profile Badge & Selector */}
                <div className="flex items-center gap-4 bg-[#0d0d12] border border-white/5 pr-6 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 shrink-0 flex items-center justify-center">
                        <UserIcon className="text-white" size={32} />
                    </div>
                    <div className="py-2">
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-0.5">Report For</p>
                        {canSelectEmployee ? (
                            <select 
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="bg-transparent border-none text-xl font-black text-white focus:outline-none focus:ring-0 appearance-none cursor-pointer p-0 -ml-1 pr-6 hover:text-blue-300 transition-colors"
                            >
                                {employeesList.map(emp => (
                                    <option key={emp.auth_user_id} value={emp.auth_user_id} className="bg-slate-900 text-sm">
                                        {emp.name || emp.employee_id} ({emp.role})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <h1 className="text-xl font-black text-white">
                                {viewedProfile?.name || user?.name}
                            </h1>
                        )}
                        <p className="text-xs text-gray-500 font-medium">Role: <span className="text-gray-400">{viewedProfile?.role || user?.role}</span></p>
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
                        <div className={`bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group transition-colors ${isDriver ? 'hover:border-orange-500/30' : 'hover:border-red-500/30'}`}>
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all ${isDriver ? 'bg-orange-500/10 group-hover:bg-orange-500/20' : 'bg-red-500/10 group-hover:bg-red-500/20'}`}></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${isDriver ? 'text-orange-400' : 'text-red-400'}`}>
                                        {isDriver ? 'Destinations' : 'Anomalies'}
                                    </p>
                                    <h3 className="text-3xl font-black text-white">
                                        {isDriver ? Array.from(new Set(deliveries.map(d => d.zone).filter(Boolean))).length : totalAlarms}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-2">{isDriver ? 'Unique locations visited' : 'Alarms / Rejects handled'}</p>
                                </div>
                                <div className={`p-3 rounded-2xl border ${isDriver ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                    {isDriver ? <MapPin size={20} /> : <AlertTriangle size={20} />}
                                </div>
                            </div>
                        </div>

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
                                            <h3 className="text-2xl font-black text-green-400">
                                                {isDriver ? `RM ${estimatedCommission.toLocaleString('en-MY', { minimumFractionDigits: 2 })}` : 'Pending Calc.'}
                                            </h3>
                                            <p className="text-[10px] text-green-500/60 mt-2 uppercase font-bold tracking-wider">
                                                {isDriver ? 'Estimated Earnings' : 'Subject to final HR review'}
                                            </p>
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
                                        <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500">{isDriver ? 'Location / Destination' : 'Alarms'}</th>
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
                                                    <div className="flex items-center gap-2 font-mono text-xs">
                                                        <span className="text-green-400">{day.shiftStart || '-'}</span>
                                                        <span className="text-gray-600">→</span>
                                                        <span className="text-orange-400">{day.shiftEnd || 'Active'}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-700 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                {isDriver ? (
                                                    day.tripCount > 0 ? (
                                                        <span className="font-mono text-amber-400 font-bold">{day.tripCount} <span className="text-[10px] text-gray-500">trips</span></span>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                ) : (
                                                    day.outputQty > 0 ? (
                                                        <span className="font-mono text-blue-400 font-bold">{day.outputQty.toLocaleString()}</span>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                {isDriver ? (
                                                    day.trips && day.trips.length > 0 ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            {day.trips.map((t, idx) => (
                                                                <div key={idx} className="flex flex-col items-center bg-black/40 border border-white/5 rounded-lg p-1.5 w-full min-w-[140px]">
                                                                    <span className="text-[10px] font-black text-white/90 uppercase tracking-widest truncate max-w-[160px]" title={t.order_number}>
                                                                        {t.trip_origin || 'null'} ➔ {t.zone || 'null'}
                                                                    </span>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1">
                                                                            <MapPin size={10} className="text-gray-500" />
                                                                            {t.trip_drop_count > 1 ? `${t.trip_drop_count} DROPS` : '1 DROP'}
                                                                        </span>
                                                                        <span className={`text-[8px] uppercase tracking-widest px-1 py-0.5 rounded border ${
                                                                            t.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                                                            t.status === 'In-Transit' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                                                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                                        }`}>
                                                                            {t.status === 'Delivered' ? 'DONE' : t.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                ) : (
                                                    day.alarmCount > 0 ? (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
                                                            {day.alarmCount}
                                                        </span>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                )}
                                            </td>
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
        </div>
    );
};

export default PersonalMonthlyReport;
