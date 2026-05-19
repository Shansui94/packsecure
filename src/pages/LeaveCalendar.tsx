import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User as UserIcon, CalendarDays, Loader, Send, History, CheckCircle, XCircle, FileText, ClipboardList, Undo2 } from 'lucide-react';

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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
    user?: any;
}

const LeaveCalendar: React.FC<Props> = ({ user }) => {
    // Current Active Tab
    const [activeTab, setActiveTab] = useState<'calendar' | 'my-leave' | 'approvals'>('calendar');

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
    }, []);

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
        const firstDayStr = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
        const lastDayStr = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
        return l.start_date <= lastDayStr && l.end_date >= firstDayStr;
    });


    // ── MY LEAVE LOGIC ──────────────────────────────────────────────────────────
    const myLeaves = leaves.filter(l => l.employee_id === user?.uid);

    const handleSubmitApplication = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) return alert('Please select both dates');

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) return alert('End date cannot be before start date');

        // Check for overlapping leaves
        const hasOverlap = myLeaves.some(l =>
            l.status !== 'Rejected' &&
            startDate <= l.end_date &&
            endDate >= l.start_date
        );

        if (hasOverlap) {
            return alert('Error: You already have a Pending or Approved leave that overlaps with these dates.');
        }

        if (!user || (!user.uid && !user.id)) {
            alert("Error: User session not found. Please log in again.");
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

            alert('✅ Leave application submitted! Pending HR approval.');
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


    // ── RENDERERS ───────────────────────────────────────────────────────────────

    const renderCalendar = () => (
        <div className="flex flex-col xl:flex-row gap-6 h-full">
            {/* L: Calendar */}
            <div className="flex-1 max-w-5xl flex flex-col gap-6">
                <div className="bg-black/40 border border-white/5 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 bg-black/60 p-2 rounded-2xl border border-white/5 shadow-inner">
                        <button onClick={() => changeMonth(-1)} className="p-2.5 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-slate-400 hover:text-white">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="w-40 text-center">
                            <div className="text-lg font-black text-white uppercase tracking-widest">{MONTH_NAMES[currentMonth]}</div>
                            <div className="text-xs text-blue-400 font-bold">{currentYear}</div>
                        </div>
                        <button onClick={() => changeMonth(1)} className="p-2.5 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-slate-400 hover:text-white">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-2xl flex-1 flex flex-col">
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-4">
                        {WEEKDAYS.map(day => (
                            <div key={day} className="text-center text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500">{day}</div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col gap-4 items-center justify-center min-h-[400px]">
                            <Loader size={36} className="animate-spin text-blue-500/50" />
                        </div>
                    ) : (
                        <div className="flex-1 grid grid-cols-7 gap-1 sm:gap-2">
                            {grid.map((dayNum, i) => {
                                if (dayNum === null) return <div key={`blank-${i}`} className="bg-white/[0.01] rounded-xl sm:rounded-2xl border border-dashed border-white/[0.03]"></div>;

                                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                const isToday = dateStr === today.toISOString().split('T')[0];
                                const isSelected = selectedDateFilter === dateStr;
                                const dayLeaves = getLeavesOnDate(dateStr);
                                const isWeekend = (i % 7 === 0) || (i % 7 === 6);

                                return (
                                    <button
                                        key={`day-${dayNum}`}
                                        onClick={() => setSelectedDateFilter(isSelected ? null : dateStr)}
                                        className={`
                                            group min-h-[80px] sm:min-h-[120px] rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 transition-all text-left flex flex-col relative overflow-hidden
                                            ${isSelected ? 'bg-blue-600/20 border-blue-500/50 ring-2 ring-blue-500/30'
                                                : isToday ? 'bg-indigo-500/10 border-indigo-500/30 hover:bg-white/10'
                                                    : isWeekend ? 'bg-white/[0.02] border-white/5 hover:bg-white/10'
                                                        : 'bg-white/[0.04] border-white/5 hover:border-white/20 hover:bg-white/10'}
                                            border backdrop-blur-sm
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-1 sm:mb-2 z-10 w-full">
                                            <span className={`text-xs sm:text-base font-black ${isToday ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : isWeekend ? 'text-slate-500' : 'text-slate-300'}`}>
                                                {String(dayNum).padStart(2, '0')}
                                            </span>
                                            {dayLeaves.length > 0 && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>}
                                        </div>

                                        <div className="flex-1 flex flex-col gap-1 overflow-hidden z-10 w-full pt-1">
                                            {dayLeaves.slice(0, 3).map((l, idx) => (
                                                <div key={idx}
                                                    className={`text-[8px] sm:text-[10px] w-full truncate font-bold px-1.5 py-0.5 sm:py-1 rounded sm:rounded-md border bg-black/50 backdrop-blur-md ${getEmployeeColor(l.users_public?.name || '')} transition-transform group-hover:scale-[1.02]`}
                                                >
                                                    {l.users_public?.name?.split(' ')[0]}
                                                </div>
                                            ))}
                                            {dayLeaves.length > 3 && <div className="text-[9px] text-slate-500 font-bold px-1">+ {dayLeaves.length - 3} more</div>}
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
                                    ? new Date(selectedDateFilter).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

    const renderMyLeave = () => (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Form */}
            <form onSubmit={handleSubmitApplication} className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30"><Send size={16} /></div>
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Apply for Leave</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Start Date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">End Date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all" />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                        <FileText size={10} /> Reason (Optional)
                    </label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                        placeholder="e.g. Medical appointment, family event..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all resize-none text-sm" />
                </div>
                <button type="submit" disabled={submitting}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-50">
                    {submitting ? 'SENDING...' : 'Submit Leave Application'}
                </button>
            </form>

            {/* History */}
            <div>
                <div className="flex items-center gap-2 mb-4 px-2">
                    <History size={16} className="text-slate-500" />
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">My Leave History</h2>
                </div>
                {myLeaves.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">No leaves recorded</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {myLeaves.map((leave) => (
                            <div key={leave.id} className="bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                <div>
                                    <div className="text-white font-black text-sm sm:text-base">{leave.start_date} <span className="text-slate-600 font-normal mx-1">to</span> {leave.end_date}</div>
                                    <div className="text-[10px] text-blue-400 font-bold uppercase mt-1">{leave.count_days} Days Off</div>
                                    {leave.reason && <p className="text-xs text-slate-400 italic mt-2">"{leave.reason}"</p>}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase border tracking-wider
                                        ${leave.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            leave.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                        {leave.status}
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
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)] text-blue-400">
                        <CalendarIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black italic uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 drop-shadow-sm">
                            Leave Center
                        </h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Unified Absence Management System</p>
                    </div>
                </div>

                {/* TABS CONTROLLER */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                    <button onClick={() => setActiveTab('calendar')}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border whitespace-nowrap
                        ${activeTab === 'calendar' ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white hover:bg-white/10'}`}>
                        Calendar View
                    </button>
                    <button onClick={() => setActiveTab('my-leave')}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border whitespace-nowrap
                        ${activeTab === 'my-leave' ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white hover:bg-white/10'}`}>
                        My Leave (Apply)
                    </button>

                    {/* Management Only Tab */}
                    {isManagement && (
                        <button onClick={() => setActiveTab('approvals')}
                            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border whitespace-nowrap flex items-center gap-2
                            ${activeTab === 'approvals' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white hover:bg-white/10'}`}>
                            Approvals
                            {pendingLeaves.length > 0 && <span className="bg-amber-500 text-black px-1.5 py-0.5 rounded-full text-[9px] font-black">{pendingLeaves.length}</span>}
                        </button>
                    )}
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="max-w-7xl w-full mx-auto flex-1">
                {activeTab === 'calendar' && renderCalendar()}
                {activeTab === 'my-leave' && renderMyLeave()}
                {activeTab === 'approvals' && isManagement && renderApprovals()}
            </div>
        </div>
    );
};

export default LeaveCalendar;
