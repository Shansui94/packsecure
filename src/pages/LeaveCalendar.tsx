import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User as UserIcon, CalendarDays, Loader, Send, History, CheckCircle, XCircle, FileText, ClipboardList, Undo2, DollarSign, AlertCircle } from 'lucide-react';
import { getSalaryAdvancesForDriver, createSalaryAdvance } from '../services/apiV2';

interface LeaveRecord {
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    count_days: number;
    reason: string | null;
    status: 'Pending' | 'Approved' | 'Rejected';
    users_public: {
        name: string;
        role: string;
    };
    created_at: string;
    reviewed_at?: string;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Ahd/Sun', 'Isn/Mon', 'Sel/Tue', 'Rab/Wed', 'Kha/Thu', 'Jum/Fri', 'Sab/Sat'];

interface Props {
    user?: any;
}

const LeaveCalendar: React.FC<Props> = ({ user }) => {
    // Current Active Tab
    const [activeTab, setActiveTab] = useState<'calendar' | 'my-leave' | 'approvals' | 'my-advance'>('calendar');

    // -- My Salary Advance State --
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [advances, setAdvances] = useState<any[]>([]);
    const [loadingAdvances, setLoadingAdvances] = useState(false);
    const [submittingAdvance, setSubmittingAdvance] = useState(false);
    const [monthEarnings, setMonthEarnings] = useState(0);
    const [monthAdvanced, setMonthAdvanced] = useState(0);
    const [eligibleLimit, setEligibleLimit] = useState(0);
    const [loadingLimit, setLoadingLimit] = useState(false);

    const toLocalYYYYMMDD = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const formatYYYYMMDD = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const parts = cleanStr.split('-');
        if (parts.length !== 3) return dateStr;
        const [y, m, d] = parts;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = parseInt(m, 10) - 1;
        const monthName = months[monthIndex] || m;
        return `${parseInt(d, 10)} ${monthName} ${y}`;
    };

    const formatDDMon = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const parts = cleanStr.split('-');
        if (parts.length !== 3) return dateStr;
        const [, m, d] = parts;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = parseInt(m, 10) - 1;
        const monthName = months[monthIndex] || m;
        return `${String(parseInt(d, 10)).padStart(2, '0')} ${monthName}`;
    };

    const getComingMonday = (fromDate: Date = new Date()): string => {
        const day = fromDate.getDay();
        const result = new Date(fromDate);
        if (day === 1) {
            return toLocalYYYYMMDD(result);
        }
        const daysToMonday = (1 - day + 7) % 7;
        result.setDate(fromDate.getDate() + daysToMonday);
        return toLocalYYYYMMDD(result);
    };

    const getFirstMondayAfter15 = (year: number, month: number): Date => {
        const date = new Date(year, month, 15);
        while (date.getDay() !== 1) {
            date.setDate(date.getDate() + 1);
        }
        return date;
    };

    const getTargetPaymentDate = (): Date => {
        const now = new Date();
        const currentCycle = getFirstMondayAfter15(now.getFullYear(), now.getMonth());
        
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const cycleStart = new Date(currentCycle.getFullYear(), currentCycle.getMonth(), currentCycle.getDate());
        
        if (todayStart <= cycleStart) {
            return currentCycle;
        } else {
            // Calculate next Monday from tomorrow to ensure it rolls over if today is Monday
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const comingMondayStr = getComingMonday(tomorrow);
            const [y, m, d] = comingMondayStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
    };

    const fetchEarningLimit = async () => {
        if (!user?.uid) return;
        setLoadingLimit(true);
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const firstDayStr = toLocalYYYYMMDD(new Date(year, month, 1));
            const lastDayStr = toLocalYYYYMMDD(new Date(year, month + 1, 0));

            // 1. Get deliveries
            const { data: trips, error: tripsErr } = await supabase
                .from('sales_orders')
                .select('trip_origin, zone, trip_drop_count')
                .eq('driver_id', user.uid)
                .eq('status', 'Delivered')
                .gte('deadline', firstDayStr)
                .lte('deadline', lastDayStr);

            if (tripsErr) throw tripsErr;

            // 2. Get delivery rates
            const { data: rates, error: ratesErr } = await supabase
                .from('delivery_rates')
                .select('*');

            if (ratesErr) throw ratesErr;

            let totalEarnings = 0;
            if (trips && rates) {
                const rateMap: Record<string, any> = {};
                rates.forEach(r => { rateMap[`${r.origin}-${r.location_name}`.toLowerCase()] = r; });
                
                trips.forEach((t: any) => {
                    const origin = (t.trip_origin || 'TAIPING').toLowerCase();
                    const zone = (t.zone || t.delivery_zone || '').toLowerCase();
                    const key = `${origin}-${zone}`;
                    const rateInfo = rateMap[key];
                    const drops = Math.max(1, t.trip_drop_count || 1);
                    
                    if (rateInfo) {
                        const base = Number(rateInfo.base_rate) || 0;
                        const maxPlaces = Number(rateInfo.max_places) || 0;
                        const extraPlaces = Math.max(0, drops - maxPlaces);
                        const extraRate = extraPlaces * (Number(rateInfo.extra_rate_per_place) || 0);
                        totalEarnings += (base + extraRate);
                    }
                });
            }

            // 3. Get advances for the month
            const { data: monthAdvances, error: advsErr } = await supabase
                .from('salary_advances')
                .select('amount')
                .eq('employee_id', user.uid)
                .in('status', ['Approved', 'Pending', 'Paid'])
                .gte('created_at', `${firstDayStr}T00:00:00.000Z`);

            if (advsErr) throw advsErr;

            let totalAdvancedThisMonth = 0;
            if (monthAdvances) {
                monthAdvances.forEach((a: any) => {
                    totalAdvancedThisMonth += Number(a.amount);
                });
            }

            setMonthEarnings(totalEarnings);
            setMonthAdvanced(totalAdvancedThisMonth);
            
            let limit = 0;
            if (totalEarnings > 1700) {
                limit = Math.max(0, totalEarnings - 1700 - totalAdvancedThisMonth);
            }
            setEligibleLimit(limit);
        } catch (err) {
            console.error("Failed to fetch earning limit:", err);
        } finally {
            setLoadingLimit(false);
        }
    };

    const fetchAdvances = async () => {
        if (!user?.uid) return;
        setLoadingAdvances(true);
        try {
            const data = await getSalaryAdvancesForDriver(user.uid);
            setAdvances(data || []);
            await fetchEarningLimit();
        } catch (err) {
            console.error("Failed to fetch advances:", err);
        } finally {
            setLoadingAdvances(false);
        }
    };

    const handleSubmitAdvance = async () => {
        if (!user?.uid) return;
        const amount = parseFloat(advanceAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("⚠️ Sila masukkan jumlah yang sah! / Please enter a valid amount!");
            return;
        }

        if (amount > eligibleLimit) {
            alert(`⚠️ Had Maksimum Advance: RM ${eligibleLimit.toFixed(2)} sahaja bagi permohonan semasa anda. / Max Advance Limit: RM ${eligibleLimit.toFixed(2)} for your current request.`);
            return;
        }

        // Check if there is already a pending advance
        const hasPending = advances.some(adv => adv.status === 'Pending');
        if (hasPending) {
            alert("⚠️ Anda sudah mempunyai permohonan yang sedang diproses. Sila tunggu kelulusan permohonan sedia ada. / You already have a pending request. Please wait for its approval.");
            return;
        }

        setSubmittingAdvance(true);
        try {
            const targetDateStr = toLocalYYYYMMDD(getTargetPaymentDate());
            const result = await createSalaryAdvance(user.uid, amount, targetDateStr);
            if (result) {
                alert("✅ Permohonan advance gaji berjaya dihantar! / Salary advance requested successfully!");
                setAdvanceAmount('');
                fetchAdvances();
            }
        } catch (err: any) {
            alert("Error requesting advance: " + err.message);
        } finally {
            setSubmittingAdvance(false);
        }
    };

    // -- Calendar State --
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [leaves, setLeaves] = useState<LeaveRecord[]>([]); // All leaves across system (for calendar & approvals)
    const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

    // -- My Leave State --
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    // -- Global State --
    const [loading, setLoading] = useState(true);
    const userRole = user?.role || 'Operator';
    const isManagement = ['SuperAdmin', 'Admin', 'Manager', 'HR', 'LogisticsCoordinator'].includes(userRole);
    const canRequestAdvance = ['Driver', 'SuperAdmin', 'Admin'].includes(userRole);

    // Fetch all leaves based on needs
    const fetchLeaves = async () => {
        setLoading(true);
        // We fetch everything so we can slice and dice locally.
        // For a very large company you'd paginate, but this is fine for SME.
        const { data: leaveData, error: leaveError } = await supabase
            .from('employee_leave')
            .select('*')
            .order('created_at', { ascending: false });

        if (leaveError || !leaveData) {
            console.error("Error fetching leaves:", leaveError);
            setLoading(false);
            return;
        }

        // Fetch users for mapping
        const userIds = [...new Set(leaveData.map(l => l.employee_id))];
        const { data: usersData } = await supabase
            .from('sys_users_v2')
            .select('auth_user_id, name, role')
            .in('auth_user_id', userIds);

        const usersMap = (usersData || []).reduce((acc: any, u: any) => {
            acc[u.auth_user_id] = { name: u.name, role: u.role };
            return acc;
        }, {});

        // Combine
        const enrichedLeaves = leaveData.map(l => ({
            ...l,
            users_public: usersMap[l.employee_id] || { name: 'Unknown', role: 'Unknown' }
        }));

        setLeaves(enrichedLeaves as any);
        setLoading(false);
    };

    useEffect(() => {
        fetchLeaves();
        if (canRequestAdvance) {
            fetchAdvances();
        }
    }, [user]);

    // ── CALENDAR LOGIC ──────────────────────────────────────────────────────────
    const changeMonth = (offset: number) => {
        let m = currentMonth + offset;
        let y = currentYear;
        if (m > 11) { m = 0; y++; }
        if (m < 0) { m = 11; y--; }
        setCurrentMonth(m);
        setCurrentYear(y);
        setSelectedDateFilter(null);
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

    const blanks = Array.from({ length: firstDay }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const grid = [...blanks, ...days];

    // Calendar only shows Approved leaves
    const approvedLeaves = leaves.filter(l => l.status === 'Approved');
    const getLeavesOnDate = (dateStr: string) => {
        return approvedLeaves.filter(l => l.start_date <= dateStr && l.end_date >= dateStr);
    };

    const colors = [
        'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'bg-amber-500/20 text-amber-400 border-amber-500/30',
        'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        'bg-rose-500/20 text-rose-400 border-rose-500/30',
        'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    ];

    const getEmployeeColor = (employeeName: string) => {
        if (!employeeName) return colors[0];
        const hash = Array.from(employeeName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    const activePanelLeaves = selectedDateFilter ? getLeavesOnDate(selectedDateFilter) : approvedLeaves.filter(l => {
        const firstDayStr = toLocalYYYYMMDD(new Date(currentYear, currentMonth, 1));
        const lastDayStr = toLocalYYYYMMDD(new Date(currentYear, currentMonth + 1, 0));
        return l.start_date <= lastDayStr && l.end_date >= firstDayStr;
    });


    // ── MY LEAVE LOGIC ──────────────────────────────────────────────────────────
    const myLeaves = leaves.filter(l => l.employee_id === user?.uid);

    const handleSubmitApplication = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) return alert('Sila pilih kedua-dua tarikh / Please select both dates');

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) return alert('Tarikh tamat tidak boleh sebelum tarikh mula / End date cannot be before start date');

        // Check for overlapping leaves
        const hasOverlap = myLeaves.some(l =>
            l.status !== 'Rejected' &&
            startDate <= l.end_date &&
            endDate >= l.start_date
        );

        if (hasOverlap) {
            return alert('Ralat: Anda sudah mempunyai permohonan Cuti (Proses/Lulus) yang bertindih dengan tarikh ini. / Error: You already have a Pending or Approved leave that overlaps with these dates.');
        }

        if (!user || (!user.uid && !user.id)) {
            alert("Ralat: Sesi pengguna tidak ditemui. Sila log masuk semula. / Error: User session not found. Please log in again.");
            return;
        }

        setSubmitting(true);
        try {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            const userId = user.uid || user.id;

            const { error } = await supabase.from('employee_leave').insert({
                employee_id: userId,
                start_date: startDate,
                end_date: endDate,
                count_days: diffDays,
                reason: reason.trim() || null,
                status: 'Pending',
            });

            if (error) throw error;

            alert('✅ Permohonan cuti berjaya dihantar! Menunggu kelulusan HR. (Leave application submitted! Pending HR approval.)');
            setStartDate('');
            setEndDate('');
            setReason('');
            fetchLeaves(); // Refresh global list
            setActiveTab('my-leave'); // Stay or go to history
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };


    // ── APPROVALS LOGIC ─────────────────────────────────────────────────────────
    const pendingLeaves = leaves.filter(l => l.status === 'Pending');
    const approvedForRevoke = leaves
        .filter(l => l.status === 'Approved')
        .sort((a, b) => b.start_date.localeCompare(a.start_date));
    const pastApprovals = leaves.filter(l => l.status !== 'Pending');

    const reviewerId = user?.uid || user?.id;

    const handleApprovalAction = async (id: string, newStatus: 'Approved' | 'Rejected') => {
        if (!window.confirm(`${newStatus} this leave request?`)) return;

        const { error } = await supabase.from('employee_leave').update({
            status: newStatus,
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
        }).eq('id', id);

        if (error) {
            alert('Failed to update leave: ' + error.message);
            return;
        }
        fetchLeaves();
    };

    /** Revoke an already-approved leave (sets status to Rejected so trips can be assigned again). */
    const handleRevokeApproved = async (leave: LeaveRecord) => {
        const name = leave.users_public?.name || 'Employee';
        const confirmed = window.confirm(
            `Revoke approved leave for ${name}?\n\n` +
            `${leave.start_date} → ${leave.end_date} (${leave.count_days} day(s))\n\n` +
            `This removes the absence block for trip assignment.`
        );
        if (!confirmed) return;

        setRevokingId(leave.id);
        try {
            const { error } = await supabase.from('employee_leave').update({
                status: 'Rejected',
                reviewed_by: reviewerId,
                reviewed_at: new Date().toISOString(),
            }).eq('id', leave.id);

            if (error) throw error;
            await fetchLeaves();
            alert(`Leave revoked for ${name}. They can be assigned trips on those dates again.`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            alert('Failed to revoke leave: ' + msg);
        } finally {
            setRevokingId(null);
        }
    };

    const getConflictingDriversOnLeave = (req: LeaveRecord) => {
        if (req.users_public?.role !== 'Driver') return [];

        const [sYear, sMonth, sDay] = req.start_date.split('-').map(Number);
        const [eYear, eMonth, eDay] = req.end_date.split('-').map(Number);
        const start = new Date(sYear, sMonth - 1, sDay);
        const end = new Date(eYear, eMonth - 1, eDay);
        const dates: string[] = [];
        const curr = new Date(start);
        while (curr <= end) {
            dates.push(toLocalYYYYMMDD(curr));
            curr.setDate(curr.getDate() + 1);
        }

        const conflicts: { date: string; name: string; status: string }[] = [];

        const otherDriverLeaves = leaves.filter(l =>
            l.id !== req.id &&
            l.employee_id !== req.employee_id &&
            l.users_public?.role === 'Driver' &&
            (l.status === 'Approved' || l.status === 'Pending')
        );

        dates.forEach(d => {
            otherDriverLeaves.forEach(l => {
                if (l.start_date <= d && l.end_date >= d) {
                    conflicts.push({
                        date: d,
                        name: l.users_public?.name || 'Driver',
                        status: l.status
                    });
                }
            });
        });

        return conflicts;
    };


    // ── RENDERERS ───────────────────────────────────────────────────────────────

    const renderCalendar = () => (
        <div className="flex flex-col xl:flex-row gap-6 h-full">
            {/* L: Calendar */}
            <div className="flex-1 max-w-5xl flex flex-col gap-6">
                <div className="bg-black/40 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 bg-black/60 p-1.5 sm:p-2 rounded-2xl border border-white/5 shadow-inner w-full md:w-auto justify-between md:justify-start">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-slate-400 hover:text-white">
                            <ChevronLeft size={18} />
                        </button>
                        <div className="w-28 sm:w-40 text-center">
                            <div className="text-sm sm:text-lg font-black text-white uppercase tracking-widest">{MONTH_NAMES[currentMonth]}</div>
                            <div className="text-[10px] sm:text-xs text-blue-400 font-bold">{currentYear}</div>
                        </div>
                        <button onClick={() => changeMonth(1)} className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-slate-400 hover:text-white">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-2xl flex-1 flex flex-col">
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-4">
                        {WEEKDAYS.map(day => {
                            const [my] = day.split('/');
                            return (
                                <div key={day} className="text-center text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500">
                                    <span className="hidden sm:inline">{day}</span>
                                    <span className="inline sm:hidden">{my}</span>
                                </div>
                            );
                        })}
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col gap-4 items-center justify-center min-h-[300px] sm:min-h-[400px]">
                            <Loader size={36} className="animate-spin text-blue-500/50" />
                        </div>
                    ) : (
                        <div className="flex-1 grid grid-cols-7 gap-1 sm:gap-2">
                            {grid.map((dayNum, i) => {
                                if (dayNum === null) return <div key={`blank-${i}`} className="bg-white/[0.01] rounded-lg sm:rounded-2xl border border-dashed border-white/[0.03]"></div>;

                                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                const isToday = dateStr === toLocalYYYYMMDD(today);
                                const isSelected = selectedDateFilter === dateStr;
                                const dayLeaves = getLeavesOnDate(dateStr);
                                const isWeekend = (i % 7 === 0) || (i % 7 === 6);

                                return (
                                    <button
                                        key={`day-${dayNum}`}
                                        onClick={() => setSelectedDateFilter(isSelected ? null : dateStr)}
                                        className={`
                                            group min-h-[60px] sm:min-h-[120px] rounded-lg sm:rounded-2xl p-1 sm:p-2.5 transition-all text-left flex flex-col relative overflow-hidden
                                            ${isSelected ? 'bg-blue-600/20 border-blue-500/50 ring-2 ring-blue-500/30'
                                                : isToday ? 'bg-indigo-500/10 border-indigo-500/30 hover:bg-white/10'
                                                    : isWeekend ? 'bg-white/[0.02] border-white/5 hover:bg-white/10'
                                                        : 'bg-white/[0.04] border-white/5 hover:border-white/20 hover:bg-white/10'}
                                            border backdrop-blur-sm
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-0.5 sm:mb-2 z-10 w-full">
                                            <span className={`text-[10px] sm:text-base font-black ${isToday ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : isWeekend ? 'text-slate-500' : 'text-slate-300'}`}>
                                                {String(dayNum).padStart(2, '0')}
                                            </span>
                                            {dayLeaves.length > 0 && <div className="w-1 h-1 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>}
                                        </div>

                                        <div className="flex-1 flex flex-col gap-1 overflow-hidden z-10 w-full pt-0.5">
                                            {/* Desktop layout: text tags */}
                                            <div className="hidden sm:flex flex-col gap-1 w-full">
                                                {dayLeaves.slice(0, 3).map((l, idx) => (
                                                    <div key={idx}
                                                        className={`text-[8px] sm:text-[10px] w-full truncate font-bold px-1.5 py-0.5 sm:py-1 rounded sm:rounded-md border bg-black/50 backdrop-blur-md ${getEmployeeColor(l.users_public?.name || '')} transition-transform group-hover:scale-[1.02]`}
                                                    >
                                                        {l.users_public?.name?.split(' ')[0]}
                                                    </div>
                                                ))}
                                                {dayLeaves.length > 3 && <div className="text-[9px] text-slate-500 font-bold px-1">+ {dayLeaves.length - 3} more</div>}
                                            </div>

                                            {/* Mobile layout: small colored dots */}
                                            <div className="flex sm:hidden flex-wrap gap-0.5 justify-start items-center w-full mt-auto">
                                                {dayLeaves.slice(0, 4).map((l, idx) => {
                                                    const colorParts = getEmployeeColor(l.users_public?.name || '').split(' ');
                                                    const dotBg = colorParts[0].replace('/20', '');
                                                    return (
                                                        <div key={idx}
                                                            className={`w-1.5 h-1.5 rounded-full ${dotBg} border border-white/10`}
                                                            title={l.users_public?.name}
                                                        />
                                                    );
                                                })}
                                                {dayLeaves.length > 4 && <span className="text-[7px] text-slate-500 font-black">+</span>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* R: Sidebar Summary */}
            <div className="xl:w-[400px] flex flex-col gap-6">
                <div className="bg-black/40 border border-white/5 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex-1 flex flex-col h-full sticky top-6">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                        <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/20">
                            <CalendarDays size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">
                                {selectedDateFilter
                                    ? formatYYYYMMDD(selectedDateFilter)
                                    : `${MONTH_NAMES[currentMonth]} Summary`}
                            </h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                                {activePanelLeaves.length} Approved Absence{activePanelLeaves.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        {selectedDateFilter && (
                            <button onClick={() => setSelectedDateFilter(null)} className="ml-auto text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg font-bold uppercase transition-colors">
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {loading ? (
                            <div className="text-center py-10 opacity-50"><Loader className="mx-auto mb-2 animate-spin" size={20} /></div>
                        ) : activePanelLeaves.length === 0 ? (
                            <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                                <div className="text-4xl mb-3 opacity-20">✅</div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Capacity</div>
                                <div className="text-[10px] text-slate-600 mt-1">No upcoming leaves scheduled.</div>
                            </div>
                        ) : (
                            activePanelLeaves.map(leave => (
                                <div key={leave.id} className="bg-black/60 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 hover:border-white/20 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${getEmployeeColor(leave.users_public?.name || '')}`}>
                                            <UserIcon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white text-sm truncate">{leave.users_public?.name}</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1.5 mt-0.5">
                                                <span className="bg-white/10 px-1.5 py-0.5 rounded">{leave.users_public?.role}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                                            <div className="text-xs font-black text-blue-400">{leave.count_days} Day{leave.count_days > 1 ? 's' : ''}</div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col gap-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Duration</span>
                                            <span className="text-slate-300 font-mono">{leave.start_date} → {leave.end_date}</span>
                                        </div>
                                        {leave.reason && <div className="pt-2 border-t border-white/5 text-xs text-slate-400 italic">"{leave.reason}"</div>}
                                    </div>
                                    {isManagement && (
                                        <button
                                            type="button"
                                            disabled={revokingId === leave.id}
                                            onClick={() => handleRevokeApproved(leave)}
                                            className="w-full py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                        >
                                            {revokingId === leave.id ? (
                                                <Loader size={14} className="animate-spin" />
                                            ) : (
                                                <Undo2 size={14} />
                                            )}
                                            Revoke approval
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const getPaymentDateCountdownText = (): string => {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const targetDate = getTargetPaymentDate();
        const diffTime = targetDate.getTime() - todayStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return "Hari ini! / Today!";
        } else if (diffDays < 0) {
            return "Selesai / Processed";
        }
        return `${diffDays} hari lagi / ${diffDays} days left`;
    };

    const renderMyAdvance = () => (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-50 duration-200">
            {/* Countdown card */}
            <div className="bg-gradient-to-r from-amber-600/10 to-blue-600/10 border border-amber-500/20 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 border border-amber-500/20 shrink-0">
                        <CalendarIcon size={22} />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Jadual Pembayaran Seterusnya / Next Payment Cycle</div>
                        <div className="text-sm font-bold text-white mt-0.5">
                            {(() => {
                                const targetDate = getTargetPaymentDate();
                                const now = new Date();
                                const currentCycle = getFirstMondayAfter15(now.getFullYear(), now.getMonth());
                                const isCurrentCycle = targetDate.getTime() === currentCycle.getTime();
                                const labelMs = isCurrentCycle ? 'Isnin Selepas 15hb / Monday Post-15th' : 'Isnin Depan / Next Monday';
                                return `${labelMs}, ${targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
                            })()}
                        </div>
                    </div>
                </div>
                <div className="sm:text-right border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Baki Masa / Time Remaining</div>
                    <div className="text-sm font-black text-amber-400 uppercase mt-0.5 animate-pulse">
                        {getPaymentDateCountdownText()}
                    </div>
                </div>
            </div>

            {/* Dynamic limit summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-3 sm:p-4">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gaji Bulan Ini / Month Earnings</div>
                    {loadingLimit ? (
                        <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1"></div>
                    ) : (
                        <div className="text-sm sm:text-base font-black text-white mt-1">RM {monthEarnings.toFixed(2)}</div>
                    )}
                    <div className="text-[9px] text-slate-500 mt-0.5">Trip Delivered sahaja</div>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-3 sm:p-4">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Had Penyangga / Untouchable Buffer</div>
                    <div className="text-sm sm:text-base font-black text-slate-400 mt-1">RM 1,700.00</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Had potongan minimum</div>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-3 sm:p-4">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Telah Diambil / Already Advanced</div>
                    {loadingLimit ? (
                        <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1"></div>
                    ) : (
                        <div className="text-sm sm:text-base font-black text-slate-300 mt-1">RM {monthAdvanced.toFixed(2)}</div>
                    )}
                    <div className="text-[9px] text-slate-500 mt-0.5">Status Lulus & Proses</div>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-3 sm:p-4 col-span-2 md:col-span-1 border-emerald-500/20 bg-emerald-500/[0.02]">
                    <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Baki Had Layak / Remaining Limit</div>
                    {loadingLimit ? (
                        <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1"></div>
                    ) : (
                        <div className="text-sm sm:text-base font-black text-emerald-400 mt-1">RM {eligibleLimit.toFixed(2)}</div>
                    )}
                    <div className="text-[9px] text-emerald-600/80 mt-0.5">Had maks boleh pinjam</div>
                </div>
            </div>

            {/* Form */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                        <DollarSign size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Mohon Advance Gaji / Apply Salary Advance</h2>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Permohonan Gaji Pendahuluan</p>
                    </div>
                </div>

                {/* Warning / Informational banner */}
                <div className="bg-amber-600/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <div className="text-xs text-amber-200 leading-relaxed font-sans">
                        <p className="font-bold mb-1">Syarat Kelayakan / Eligibility Rules:</p>
                        <p>1. Jumlah pinjaman adalah **automatik dihadkan** di bawah baki kelayakan anda (Pendapatan trip bulan ini - Penyangga RM 1,700 - Pinjaman sedia ada). / The advance amount is **automatically capped** under your remaining limit (Current month trip earnings - RM 1,700 buffer - Existing advances).</p>
                        <p className="mt-0.5">2. Hanya **satu (1) permohonan aktif** dibenarkan pada satu-satu masa. / Only **one (1) active request** is allowed at any time.</p>
                        <p className="mt-0.5">3. Permohonan sebelum 15hb akan **ditangguhkan (held)** dan diproses pada hari Isnin pertama selepas 15hb. / Requests submitted before the 15th will be **held** and processed on the first Monday after the 15th.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">1. MASUKKAN JUMLAH (RM) / ENTER AMOUNT</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">RM</span>
                            <input 
                                type="number" 
                                value={advanceAmount} 
                                onChange={e => setAdvanceAmount(e.target.value)}
                                placeholder="0.00" 
                                max={eligibleLimit}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xl font-black text-white focus:border-amber-500 outline-none transition-all"
                            />
                        </div>
                        {eligibleLimit <= 0 && !loadingLimit && (
                            <p className="text-red-400 text-[10px] font-bold uppercase tracking-wide mt-1.5 px-1">
                                {monthEarnings <= 1700 
                                    ? "⚠️ Pendapatan trip anda belum melebihi had penyangga RM 1,700. Sila selesaikan penghantaran order dahulu. / Earnings must exceed RM 1,700 buffer threshold. Please complete deliveries first."
                                    : "⚠️ Baki kelayakan anda adalah RM 0.00 (had pinjaman bulan ini telah dipenuhi). / Remaining limit is RM 0.00."}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">2. TARIKH MASUK BANK / TARGET BANK-IN DATE</label>
                        <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 flex items-center gap-3">
                            <CalendarIcon className="text-blue-400 shrink-0" size={18} />
                            <div>
                                <div>
                                    <div className="text-sm font-bold text-white">
                                        {(() => {
                                            const targetDate = getTargetPaymentDate();
                                            const dayMs = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][targetDate.getDay()];
                                            const dayEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][targetDate.getDay()];
                                            return `${dayMs} (${dayEn}), ${targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
                                        })()}
                                    </div>
                                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Hari pemrosesan akan datang / Upcoming processing day</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmitAdvance}
                        disabled={submittingAdvance || !advanceAmount || eligibleLimit <= 0 || loadingLimit}
                        className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"
                    >
                        {submittingAdvance ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                <span>HANTAR PERMOHONAN...</span>
                            </>
                        ) : (
                            <span>HANTAR PERMOHONAN / SUBMIT REQUEST</span>
                        )}
                    </button>
                </div>
            </div>

            {/* History */}
            <div>
                <div className="flex items-center gap-2 mb-4 px-2">
                    <History size={16} className="text-slate-500" />
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">SEJARAH PERMOHONAN / REQUEST HISTORY</h2>
                </div>
                {loadingAdvances ? (
                    <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest animate-pulse">Sila tunggu / Please wait...</p>
                    </div>
                ) : advances.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Tiada rekod permohonan / No past requests</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {advances.map(adv => (
                            <div key={adv.id} className="bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col gap-4 hover:bg-white/[0.02] transition-colors">
                                <div className="flex justify-between items-center w-full">
                                    <div>
                                        <div className="text-white font-black text-sm sm:text-base">RM {Number(adv.amount).toFixed(2)}</div>
                                        <div className="text-[10px] text-blue-400 font-bold uppercase mt-1 flex items-center gap-1.5">
                                            <CalendarIcon size={10} /> Bank-In: {formatYYYYMMDD(adv.bank_in_date)}
                                        </div>
                                        {adv.rejection_reason && (
                                            <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-500/10 rounded px-2 py-1 mt-2 font-sans">
                                                ❌ Sebab Ditolak: {adv.rejection_reason}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-wider ${
                                            adv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            adv.status === 'Approved' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            adv.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        }`}>
                                            {adv.status === 'Paid' ? 'Dibayar / Paid' :
                                             adv.status === 'Approved' ? 'Diluluskan / Approved' :
                                             adv.status === 'Rejected' ? 'Ditolak / Rejected' :
                                             'Proses / Pending'}
                                        </span>
                                    </div>
                                </div>

                                {/* Timeline Step Bar */}
                                <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-2 text-[9px] font-bold">
                                    <div className="flex items-center gap-2 sm:gap-1.5 shrink-0">
                                        <div className="w-4 h-4 rounded-full bg-blue-500 text-black flex items-center justify-center text-[8px] font-black shrink-0">✓</div>
                                        <span className="text-blue-400 uppercase">1. Dihantar / Submitted</span>
                                    </div>
                                    <div className="hidden sm:block h-0.5 bg-slate-800 flex-1 mx-2 shrink">
                                        <div className={`h-full ${adv.status !== 'Pending' ? 'bg-blue-500' : 'bg-slate-850'}`} style={{ width: adv.status !== 'Pending' ? '100%' : '50%' }}></div>
                                    </div>
                                    <div className="sm:hidden w-0.5 h-2.5 bg-slate-800 ml-2" />
                                    
                                    <div className="flex items-center gap-2 sm:gap-1.5 shrink-0">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 ${
                                            adv.status === 'Pending' ? 'bg-amber-500 text-black animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                            adv.status === 'Approved' || adv.status === 'Paid' || adv.status === 'Rejected' ? 'bg-blue-500 text-black' : 'bg-slate-850 text-slate-500'
                                        }`}>
                                            {adv.status !== 'Pending' ? '✓' : '2'}
                                        </div>
                                        <span className={adv.status === 'Pending' ? 'text-amber-500 uppercase animate-pulse' : adv.status !== 'Pending' ? 'text-blue-400 uppercase' : 'text-slate-500 uppercase'}>2. Diproses / Reviewing</span>
                                    </div>
                                    <div className="hidden sm:block h-0.5 bg-slate-800 flex-1 mx-2 shrink">
                                        <div className={`h-full ${adv.status === 'Paid' ? 'bg-emerald-500' : adv.status === 'Approved' ? 'bg-amber-500 animate-pulse' : adv.status === 'Rejected' ? 'bg-rose-500' : 'bg-slate-850'}`} style={{ width: adv.status === 'Paid' || adv.status === 'Rejected' ? '100%' : adv.status === 'Approved' ? '50%' : '0%' }}></div>
                                    </div>
                                    <div className="sm:hidden w-0.5 h-2.5 bg-slate-800 ml-2" />
                                    
                                    <div className="flex items-center gap-2 sm:gap-1.5 shrink-0">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 ${
                                            adv.status === 'Paid' ? 'bg-emerald-500 text-black' :
                                            adv.status === 'Approved' ? 'bg-amber-500 text-black animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                            adv.status === 'Rejected' ? 'bg-rose-500 text-white' : 'bg-slate-850 text-slate-500'
                                        }`}>
                                            {adv.status === 'Paid' ? '✓' : adv.status === 'Rejected' ? '✕' : '3'}
                                        </div>
                                        <span className={
                                            adv.status === 'Paid' ? 'text-emerald-400 uppercase' :
                                            adv.status === 'Approved' ? 'text-amber-500 uppercase animate-pulse' :
                                            adv.status === 'Rejected' ? 'text-rose-400 uppercase' : 'text-slate-500 uppercase'
                                        }>
                                            {adv.status === 'Rejected' ? '3. Ditolak / Rejected' : adv.status === 'Approved' ? '3. Menunggu Bayaran / Pending Payment' : '3. Dibayar / Paid'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderMyLeave = () => (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Form */}
            <form onSubmit={handleSubmitApplication} className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30"><Send size={16} /></div>
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Mohon Cuti / Apply for Leave</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Tarikh Mula / Start Date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Tarikh Tamat / End Date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all" />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                        <FileText size={10} /> Sebab (Pilihan) / Reason (Optional)
                    </label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                        placeholder="Contoh: Temujanji perubatan, urusan keluarga..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all resize-none text-sm" />
                </div>
                <button type="submit" disabled={submitting}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-50">
                    {submitting ? 'SEDANG DIHANTAR / SENDING...' : 'Hantar Permohonan Cuti / Submit Leave Application'}
                </button>
            </form>

            {/* History */}
            <div>
                <div className="flex items-center gap-2 mb-4 px-2">
                    <History size={16} className="text-slate-500" />
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">SEJARAH CUTI SAYA / MY LEAVE HISTORY</h2>
                </div>
                {myLeaves.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Tiada rekod cuti / No leaves recorded</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {myLeaves.map((leave) => (
                            <div key={leave.id} className="bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                <div>
                                    <div className="text-white font-black text-sm sm:text-base">{leave.start_date} <span className="text-slate-600 font-normal mx-1">hingga / to</span> {leave.end_date}</div>
                                    <div className="text-[10px] text-blue-400 font-bold uppercase mt-1">{leave.count_days} Hari Cuti / Days Off</div>
                                    {leave.reason && <p className="text-xs text-slate-400 italic mt-2">"{leave.reason}"</p>}
                                </div>
                                <div className="flex flex-col sm:items-end items-start gap-2">
                                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase border tracking-wider
                                        ${leave.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            leave.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                        {leave.status === 'Approved' ? 'Lulus / Approved' :
                                         leave.status === 'Rejected' ? 'Ditolak / Rejected' :
                                         'Proses / Pending'}
                                    </div>
                                    {leave.reviewed_at && <div className="text-[9px] text-slate-600 font-mono">Reviewed: {new Date(leave.reviewed_at).toLocaleDateString()}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderApprovals = () => (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Pending Approvals */}
            <div>
                <div className="flex items-center gap-2 mb-4 px-2">
                    <ClipboardList size={16} className="text-amber-500" />
                    <h2 className="text-xs font-black text-amber-500 uppercase tracking-widest">Needs Your Review ({pendingLeaves.length})</h2>
                </div>
                {pendingLeaves.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-amber-500/20 rounded-3xl bg-amber-500/5">
                        <p className="text-amber-500/50 text-sm font-bold uppercase tracking-widest">All caught up!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingLeaves.map(req => (
                            <div key={req.id} className="bg-[#0d0d12] border border-amber-500/20 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-amber-500/40 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20"><UserIcon size={18} /></div>
                                    <div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            {req.users_public?.name || 'Unknown'}
                                            <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded uppercase text-slate-400">{req.users_public?.role}</span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-300 mt-1">{req.start_date} <span className="text-slate-600 font-normal">→</span> {req.end_date} <span className="text-amber-400 text-xs ml-2">({req.count_days} Days)</span></div>
                                        {req.reason && <div className="text-xs text-slate-400 mt-1 italic">"{req.reason}"</div>}
                                        {(() => {
                                            const conflicts = getConflictingDriversOnLeave(req);
                                            if (conflicts.length === 0) return null;

                                            // Group conflicts by driver name and status to show a clean message
                                            const driverToDetails: Record<string, { dates: string[]; status: string }> = {};
                                            conflicts.forEach(c => {
                                                const key = `${c.name}-${c.status}`;
                                                if (!driverToDetails[key]) {
                                                    driverToDetails[key] = { dates: [], status: c.status };
                                                }
                                                const formattedDate = formatDDMon(c.date);
                                                if (!driverToDetails[key].dates.includes(formattedDate)) {
                                                    driverToDetails[key].dates.push(formattedDate);
                                                }
                                            });

                                            return (
                                                <div className="mt-3 text-[10px] text-amber-400 bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2 max-w-xl font-sans">
                                                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                                                    <div>
                                                        <span className="font-black uppercase tracking-wider block mb-1">⚠️ Amaran Perlapisan Cuti / Leave Overlap Warning</span>
                                                        <span className="opacity-90">Terdapat pemandu lain yang bercuti/memohon cuti pada tarikh yang sama: / Other driver(s) on leave or pending request on the same dates:</span>
                                                        <ul className="list-disc list-inside mt-1.5 space-y-1 pl-1">
                                                            {Object.entries(driverToDetails).map(([key, details]) => {
                                                                const name = key.split('-')[0];
                                                                const statusText = details.status === 'Approved' ? 'Lulus / Approved' : 'Proses / Pending';
                                                                const statusColor = details.status === 'Approved' ? 'text-emerald-400' : 'text-amber-500';
                                                                return (
                                                                    <li key={key} className="opacity-95">
                                                                        <span className="font-bold text-white">{name}</span> ({details.dates.join(', ')}) — <span className={`font-bold ${statusColor}`}>{statusText}</span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button onClick={() => handleApprovalAction(req.id, 'Approved')} className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors">
                                        <CheckCircle size={14} /> Approve
                                    </button>
                                    <button onClick={() => handleApprovalAction(req.id, 'Rejected')} className="flex-1 md:flex-none px-4 py-2.5 bg-white/5 hover:bg-rose-900/30 hover:text-rose-400 text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                                        <XCircle size={14} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Revoke approved leave (wrong dates / unblock trips) */}
            <div>
                <div className="flex items-center gap-2 mb-4 px-2">
                    <Undo2 size={16} className="text-rose-400" />
                    <h2 className="text-xs font-black text-rose-400 uppercase tracking-widest">
                        Approved leave — revoke ({approvedForRevoke.length})
                    </h2>
                </div>
                <p className="text-[10px] text-slate-500 px-2 mb-3 max-w-2xl">
                    Use when dates were wrong or leave was approved by mistake. Revoking removes the trip-assignment block for those dates.
                </p>
                {approvedForRevoke.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No active approved leave</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                        {approvedForRevoke.map(req => (
                            <div key={req.id} className="bg-[#0d0d12] border border-emerald-500/20 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
                                        <UserIcon size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                            {req.users_public?.name || 'Unknown'}
                                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded uppercase border border-emerald-500/20">Approved</span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-300 mt-1">
                                            {req.start_date} <span className="text-slate-600 font-normal">→</span> {req.end_date}
                                            <span className="text-emerald-400/80 text-xs ml-2">({req.count_days} days)</span>
                                        </div>
                                        {req.reason && <div className="text-xs text-slate-400 mt-1 italic truncate">"{req.reason}"</div>}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={revokingId === req.id}
                                    onClick={() => handleRevokeApproved(req)}
                                    className="w-full md:w-auto px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 transition-colors"
                                >
                                    {revokingId === req.id ? (
                                        <Loader size={14} className="animate-spin" />
                                    ) : (
                                        <Undo2 size={14} />
                                    )}
                                    Revoke approval
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* History of approvals */}
            <div className="opacity-70">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <History size={16} className="text-slate-600" />
                    <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest">Recent Decisions</h2>
                </div>
                <div className="space-y-2">
                    {pastApprovals.slice(0, 10).map(req => (
                        <div key={req.id} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex justify-between items-center text-xs">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-300 w-24 truncate">{req.users_public?.name}</span>
                                <span className="text-slate-500">{req.start_date} / {req.count_days}d</span>
                            </div>
                            <span className={`font-black uppercase text-[9px] px-2 py-0.5 rounded border ${req.status === 'Approved' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' : 'text-rose-500 border-rose-500/20 bg-rose-500/10'}`}>
                                {req.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );



    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6 pb-20 font-sans selection:bg-blue-500/30 flex flex-col gap-6">

            {/* PAGE HEADER & TABS */}
            <div className="max-w-7xl w-full mx-auto">
                <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
                    <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl sm:rounded-2xl border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)] text-blue-400 shrink-0">
                        <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-black italic uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 drop-shadow-sm leading-tight">
                            URUSAN STAF / STAFF HUB
                        </h1>
                        <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Sistem Urusan Staf Bersepadu / Unified Staff Request Hub</p>
                    </div>
                </div>

                {/* TABS CONTROLLER */}
                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto max-w-full pb-2">
                    <button onClick={() => setActiveTab('calendar')}
                        className={`flex-1 sm:flex-none text-center px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all border whitespace-nowrap
                        ${activeTab === 'calendar' ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white hover:bg-white/10'}`}>
                        <span className="hidden sm:inline">Pandangan Kalendar / Calendar View</span>
                        <span className="inline sm:hidden">Kalendar</span>
                    </button>
                    <button onClick={() => setActiveTab('my-leave')}
                        className={`flex-1 sm:flex-none text-center px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all border whitespace-nowrap
                        ${activeTab === 'my-leave' ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white hover:bg-white/10'}`}>
                        <span className="hidden sm:inline">Cuti Saya (Mohon) / My Leave (Apply)</span>
                        <span className="inline sm:hidden">Cuti</span>
                    </button>

                    {canRequestAdvance && (
                        <button onClick={() => setActiveTab('my-advance')}
                            className={`flex-1 sm:flex-none text-center px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all border whitespace-nowrap
                            ${activeTab === 'my-advance' ? 'bg-amber-600/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white hover:bg-white/10'}`}>
                            <span className="hidden sm:inline">💸 Mohon Advance / Apply Advance</span>
                            <span className="inline sm:hidden">💸 Advance</span>
                        </button>
                    )}

                    {/* Management Only Tab */}
                    {isManagement && (
                        <button onClick={() => setActiveTab('approvals')}
                            className={`flex-1 sm:flex-none text-center px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all border whitespace-nowrap flex items-center justify-center gap-1 sm:gap-2
                            ${activeTab === 'approvals' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white hover:bg-white/10'}`}>
                            <span>Approvals</span>
                            {pendingLeaves.length > 0 && <span className="bg-amber-500 text-black px-1.5 py-0.5 rounded-full text-[9px] font-black">{pendingLeaves.length}</span>}
                        </button>
                    )}

                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="max-w-7xl w-full mx-auto flex-1">
                {activeTab === 'calendar' && renderCalendar()}
                {activeTab === 'my-leave' && renderMyLeave()}
                {activeTab === 'my-advance' && canRequestAdvance && renderMyAdvance()}
                {activeTab === 'approvals' && isManagement && renderApprovals()}
            </div>
        </div>
    );
};

export default LeaveCalendar;
