import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    Users, CheckCircle, XCircle, Calendar, Clock,
    User as UserIcon, DollarSign, ChevronLeft, ChevronRight,
    Loader, Download, AlertCircle, TrendingDown, Wallet
} from 'lucide-react';

interface HRPortalProps {
    user?: any;
}

interface LeaveRequest {
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    count_days: number;
    reason?: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    reviewed_at?: string;
    created_at: string;
    users_public?: { name: string; email: string; role: string; };
}

interface Employee {
    id: string;
    name: string;
    email: string;
    role: string;
    salary: number;
}

interface PayrollRow {
    employee: Employee;
    baseSalary: number;
    approvedLeaveDays: number;
    deduction: number;
    netSalary: number;
    existing?: any;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const WORKING_DAYS_PER_MONTH = 26;

const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
        Approved: 'bg-green-500/10 text-green-400 border-green-500/20',
        Rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
        Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    }[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    return (
        <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border ${styles}`}>
            {status}
        </span>
    );
};

const HRPortal: React.FC<HRPortalProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'payroll'>('pending');
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loadingLeave, setLoadingLeave] = useState(true);

    // Payroll state
    const today = new Date();
    const [payMonth, setPayMonth] = useState(today.getMonth() + 1); // 1-12
    const [payYear, setPayYear] = useState(today.getFullYear());
    const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
    const [loadingPayroll, setLoadingPayroll] = useState(false);
    const [generatingPayroll, setGeneratingPayroll] = useState(false);

    // ── Leave Data ──────────────────────────────────────────
    const fetchLeave = useCallback(async () => {
        setLoadingLeave(true);
        const { data, error } = await supabase
            .from('employee_leave')
            .select(`*, users_public:employee_id (name, email, role)`)
            .order('created_at', { ascending: false });

        if (!error) setRequests(data || []);
        setLoadingLeave(false);
    }, []);

    useEffect(() => { fetchLeave(); }, [fetchLeave]);

    const handleAction = async (id: string, newStatus: 'Approved' | 'Rejected') => {
        const confirmMsg = newStatus === 'Approved' ? 'Approve this leave request?' : 'Reject this leave request?';
        if (!window.confirm(confirmMsg)) return;

        const { error } = await supabase
            .from('employee_leave')
            .update({
                status: newStatus,
                reviewed_by: user?.uid || null,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (error) alert(error.message);
        else fetchLeave();
    };

    // ── Payroll Calculator ──────────────────────────────────
    const fetchPayroll = useCallback(async () => {
        setLoadingPayroll(true);

        // 1. Fetch all active employees with salary
        const { data: employees, error: empErr } = await supabase
            .from('users_public')
            .select('id, name, email, role, salary')
            .not('salary', 'is', null)
            .gt('salary', 0)
            .order('name');

        if (empErr || !employees) { setLoadingPayroll(false); return; }

        // 2. Compute date range for chosen month
        const firstDay = `${payYear}-${String(payMonth).padStart(2, '0')}-01`;
        const lastDayDate = new Date(payYear, payMonth, 0);
        const lastDay = `${payYear}-${String(payMonth).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

        // 3. Fetch approved leave for those employees this month
        const { data: leaveData } = await supabase
            .from('employee_leave')
            .select('employee_id, count_days')
            .eq('status', 'Approved')
            .gte('start_date', firstDay)
            .lte('end_date', lastDay);

        // 4. Fetch existing payroll records for this month/year
        const { data: existingPayroll } = await supabase
            .from('payroll_records')
            .select('*')
            .eq('month', payMonth)
            .eq('year', payYear);

        // 5. Build payroll rows
        const leaveMap: Record<string, number> = {};
        (leaveData || []).forEach(l => {
            leaveMap[l.employee_id] = (leaveMap[l.employee_id] || 0) + l.count_days;
        });

        const existingMap: Record<string, any> = {};
        (existingPayroll || []).forEach(r => { existingMap[r.employee_id] = r; });

        const rows: PayrollRow[] = employees.map(emp => {
            const baseSalary = Number(emp.salary) || 0;
            const approvedLeaveDays = leaveMap[emp.id] || 0;
            // All approved leave is paid leave — deduction is 0 by default.
            // To add unpaid leave logic: deduction = (dailyRate * unpaidDays)
            const deduction = 0;
            const netSalary = baseSalary - deduction;

            return {
                employee: emp as Employee,
                baseSalary,
                approvedLeaveDays,
                deduction,
                netSalary,
                existing: existingMap[emp.id] || null,
            };
        });

        setPayrollRows(rows);
        setLoadingPayroll(false);
    }, [payMonth, payYear]);

    useEffect(() => {
        if (activeTab === 'payroll') fetchPayroll();
    }, [activeTab, fetchPayroll]);

    const handleGeneratePayroll = async () => {
        if (!window.confirm(`Generate payroll for ${MONTH_NAMES[payMonth - 1]} ${payYear}?\n\nThis will save records for all ${payrollRows.length} employees.`)) return;
        setGeneratingPayroll(true);

        const records = payrollRows.map(row => ({
            employee_id: row.employee.id,
            month: payMonth,
            year: payYear,
            base_salary: row.baseSalary,
            leave_days_unpaid: 0,
            deduction: row.deduction,
            net_salary: row.netSalary,
            generated_by: user?.uid || null,
        }));

        const { error } = await supabase
            .from('payroll_records')
            .upsert(records, { onConflict: 'employee_id,month,year' });

        if (error) alert('Error: ' + error.message);
        else {
            alert(`✅ Payroll generated for ${MONTH_NAMES[payMonth - 1]} ${payYear}!`);
            fetchPayroll();
        }
        setGeneratingPayroll(false);
    };

    const changeMonth = (delta: number) => {
        let m = payMonth + delta;
        let y = payYear;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        setPayMonth(m);
        setPayYear(y);
    };

    const pendingList = requests.filter(r => r.status === 'Pending');
    const historyList = requests.filter(r => r.status !== 'Pending');
    const displayList = activeTab === 'pending' ? pendingList : historyList;

    const totalNetPayroll = payrollRows.reduce((s, r) => s + r.netSalary, 0);

    const tabs = [
        { id: 'pending', label: `Pending (${pendingList.length})` },
        { id: 'history', label: `Leave History (${historyList.length})` },
        { id: 'payroll', label: '💰 Payroll Calculator' },
    ] as const;

    return (
        <div className="p-6 bg-[#121215] min-h-screen text-slate-100">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-black text-white italic flex items-center gap-3">
                    <Users className="text-blue-500" />
                    HR Control Center
                </h1>
                <p className="text-slate-400 mt-1 text-sm">
                    Manage all employee leave applications and payroll.
                </p>
            </header>

            {/* Tabs */}
            <div className="flex gap-3 mb-8 flex-wrap">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${activeTab === tab.id
                            ? tab.id === 'payroll'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-slate-900 text-slate-500 hover:bg-slate-800 border border-slate-800'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── LEAVE TABS ─────────────────────────────── */}
            {(activeTab === 'pending' || activeTab === 'history') && (
                <div className="grid gap-4">
                    {loadingLeave ? (
                        <div className="text-center py-20 text-slate-500 flex flex-col items-center gap-3">
                            <Loader className="animate-spin text-blue-500" size={32} />
                            <span>Loading leave requests...</span>
                        </div>
                    ) : displayList.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800 text-slate-500">
                            <AlertCircle className="mx-auto mb-3 text-slate-700" size={36} />
                            <p className="font-bold">No leave requests in this category.</p>
                        </div>
                    ) : (
                        displayList.map((req) => (
                            <div
                                key={req.id}
                                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:border-blue-500/20 transition-all"
                            >
                                {/* Employee Info */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="w-12 h-12 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center text-blue-500 shrink-0">
                                        <UserIcon size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-black text-white truncate">
                                            {req.users_public?.name || 'Unknown Employee'}
                                        </h3>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2 mt-0.5">
                                            <span>{req.users_public?.role || '—'}</span>
                                            <span>·</span>
                                            <span>{req.users_public?.email}</span>
                                        </div>
                                        {req.reason && (
                                            <p className="text-xs text-slate-400 mt-1 italic">
                                                "{req.reason}"
                                            </p>
                                        )}
                                        <div className="text-[10px] text-slate-700 mt-1.5 font-mono flex items-center gap-1">
                                            <Clock size={9} />
                                            Applied: {new Date(req.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Date Range & Status */}
                                <div className="flex items-center gap-6 text-center shrink-0">
                                    <div className="bg-slate-950/60 px-5 py-2.5 rounded-xl border border-slate-800">
                                        <div className="text-[10px] font-black text-slate-500 uppercase mb-1 flex items-center justify-center gap-1">
                                            <Calendar size={9} /> Date Range
                                        </div>
                                        <div className="text-sm font-bold text-white">
                                            {req.start_date} → {req.end_date}
                                        </div>
                                        <div className="text-[10px] font-bold text-blue-400 mt-0.5 uppercase">{req.count_days} Days</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Status</div>
                                        <StatusBadge status={req.status} />
                                        {req.reviewed_at && (
                                            <div className="text-[9px] text-slate-600 mt-1 font-mono">
                                                {new Date(req.reviewed_at).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                {activeTab === 'pending' && (
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <button
                                            onClick={() => handleAction(req.id, 'Approved')}
                                            className="flex-1 md:w-auto px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                                        >
                                            <CheckCircle size={14} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleAction(req.id, 'Rejected')}
                                            className="flex-1 md:w-auto px-5 py-2.5 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={14} /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── PAYROLL CALCULATOR ─────────────────────── */}
            {activeTab === 'payroll' && (
                <div>
                    {/* Month Picker */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3">
                            <button onClick={() => changeMonth(-1)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                                <ChevronLeft size={20} />
                            </button>
                            <div className="text-center min-w-[160px]">
                                <div className="text-lg font-black text-white">{MONTH_NAMES[payMonth - 1]}</div>
                                <div className="text-xs font-bold text-slate-500">{payYear}</div>
                            </div>
                            <button onClick={() => changeMonth(1)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Summary & Generate Button */}
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-2xl px-5 py-3 text-right">
                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Total Payroll</div>
                                <div className="text-xl font-black text-emerald-400">
                                    RM {totalNetPayroll.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <button
                                onClick={handleGeneratePayroll}
                                disabled={generatingPayroll || payrollRows.length === 0}
                                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                            >
                                {generatingPayroll ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                                Generate Payroll
                            </button>
                        </div>
                    </div>

                    {/* Info Banner */}
                    <div className="mb-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                        <AlertCircle size={14} className="text-blue-500 shrink-0" />
                        Day rate = Monthly Salary ÷ {WORKING_DAYS_PER_MONTH} working days. Approved leave = paid, does not reduce net pay.
                    </div>

                    {/* Payroll Table */}
                    {loadingPayroll ? (
                        <div className="text-center py-20 text-slate-500 flex flex-col items-center gap-3">
                            <Loader className="animate-spin text-emerald-500" size={32} />
                            <span>Loading payroll data...</span>
                        </div>
                    ) : payrollRows.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800 text-slate-500">
                            <DollarSign className="mx-auto mb-3 text-slate-700" size={36} />
                            <p className="font-bold">No employees with salary configured.</p>
                            <p className="text-xs mt-1">Set salaries in User Management first.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-800">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-900 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                        <th className="px-5 py-4 border-b border-slate-800">Employee</th>
                                        <th className="px-5 py-4 border-b border-slate-800">Role</th>
                                        <th className="px-5 py-4 border-b border-slate-800 text-right">Base Salary</th>
                                        <th className="px-5 py-4 border-b border-slate-800 text-center">Leave Days</th>
                                        <th className="px-5 py-4 border-b border-slate-800 text-right text-red-500">Deduction</th>
                                        <th className="px-5 py-4 border-b border-slate-800 text-right text-emerald-500">Net Pay</th>
                                        <th className="px-5 py-4 border-b border-slate-800 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrollRows.map((row) => (
                                        <tr key={row.employee.id} className="bg-slate-950 hover:bg-slate-900/80 transition-colors border-b border-slate-800/50 last:border-0">
                                            <td className="px-5 py-4">
                                                <div className="font-bold text-white text-sm">{row.employee.name || '—'}</div>
                                                <div className="text-[10px] text-slate-600 font-mono">{row.employee.email}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">
                                                    {row.employee.role}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right font-mono font-bold text-white">
                                                RM {row.baseSalary.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {row.approvedLeaveDays > 0 ? (
                                                    <span className="text-amber-400 font-bold text-sm">{row.approvedLeaveDays}d</span>
                                                ) : (
                                                    <span className="text-slate-700 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right font-mono">
                                                {row.deduction > 0 ? (
                                                    <span className="text-red-400 font-bold flex items-center justify-end gap-1">
                                                        <TrendingDown size={12} />
                                                        RM {row.deduction.toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-700">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="font-black text-emerald-400 font-mono text-sm">
                                                    RM {row.netSalary.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {row.existing ? (
                                                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center justify-center gap-1">
                                                        <Wallet size={10} /> Generated
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold uppercase text-slate-600">Draft</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HRPortal;
