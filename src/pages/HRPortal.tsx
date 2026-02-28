import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    Users, CheckCircle, XCircle, Calendar, Clock, User as UserIcon,
    DollarSign, ChevronLeft, ChevronRight, Loader, Download, AlertCircle,
    Wallet, Plus, Edit2, Save, X, ToggleLeft, Trash2,
    ToggleRight, Star, Award, MapPin
} from 'lucide-react';

// ── TYPES ────────────────────────────────────────────────────
interface Employee {
    id: string;
    auth_user_id: string;
    employee_id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    pay_type: string;
    hourly_rate: number;
    base_salary: number;
    trip_allowance: number;
    attendance_bonus: number;
    attendance_bonus_threshold: number;
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

// All pages in the system
const ALL_PAGES = [
    { id: 'factory-live-os', label: 'Factory Live OS', group: 'Factory' },
    { id: 'scanner', label: 'Production Control', group: 'Factory' },
    { id: 'livestock', label: 'Live Stock', group: 'Factory' },
    { id: 'production', label: 'Production Logs', group: 'Factory' },
    { id: 'inventory', label: 'Inventory', group: 'Inventory' },
    { id: 'products', label: 'Product Library', group: 'Inventory' },
    { id: 'stock-movement', label: 'Stock Movement', group: 'Inventory' },
    { id: 'stock-audit', label: 'Stock Audit', group: 'Inventory' },
    { id: 'audit-report', label: 'Audit Report', group: 'Inventory' },
    { id: 'delivery', label: 'Trip Management', group: 'Logistics' },
    { id: 'order-summary', label: 'Daily Prep', group: 'Logistics' },
    { id: 'lorry-management', label: 'Lorry Fleet', group: 'Logistics' },
    { id: 'loading-dock', label: 'Loading Dock', group: 'Logistics' },
    { id: 'delivery-driver', label: 'My Delivery', group: 'Driver' },
    { id: 'delivery-history', label: 'My History', group: 'Driver' },
    { id: 'lorry-service', label: 'Lorry Service', group: 'Driver' },
    { id: 'hr', label: 'HR Portal', group: 'Admin' },
    { id: 'operators', label: '操作员管理', group: 'Admin' },
    { id: 'driver-management', label: 'Driver Management', group: 'Admin' },
    { id: 'data-v2', label: 'Data Command', group: 'Admin' },
    { id: 'iot', label: 'IoT Settings', group: 'Admin' },
    { id: 'reports', label: 'Executive Reports', group: 'Admin' },
    { id: 'maintenance', label: 'Maintenance Control', group: 'Other' },
    { id: 'claims', label: 'Claims', group: 'Other' },
    { id: 'notes', label: 'Notes', group: 'Other' },
    { id: 'tasks', label: 'Tasks', group: 'Other' },
    { id: 'driver-leave', label: 'Apply Leave', group: 'Other' },
    { id: 'report-history', label: 'Reports', group: 'Other' },
];

const ALL_ROLES = ['SuperAdmin', 'Admin', 'Manager', 'HR', 'Operator', 'Driver'];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const PAY_TYPE_LABELS: Record<string, string> = {
    hourly: '🕐 Hourly (Operator)',
    monthly: '📅 Monthly Fixed',
    driver: '🚛 Driver (Base + Trip)',
};

const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        Approved: 'bg-green-500/10 text-green-400 border-green-500/20',
        Rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
        Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
    return (
        <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border ${styles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
            {status}
        </span>
    );
};

// ── EMPLOYEE EDIT MODAL ──────────────────────────────────────
const EmployeeModal: React.FC<{
    emp: Partial<Employee> | null;
    onClose: () => void;
    onSave: () => void;
}> = ({ emp, onClose, onSave }) => {
    const isNew = !emp?.id;
    const [form, setForm] = useState<Partial<Employee>>(emp || {
        role: 'Operator', pay_type: 'hourly', status: 'active',
        hourly_rate: 0, base_salary: 0, trip_allowance: 0,
        attendance_bonus: 0, attendance_bonus_threshold: 0,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k: keyof Employee, v: any) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.name?.trim()) return setError('Name is required.');
        setSaving(true);
        setError('');
        const payload = {
            name: form.name, email: form.email || null, phone: form.phone || null,
            role: form.role, status: form.status || 'active',
            pay_type: form.pay_type, hourly_rate: Number(form.hourly_rate) || 0,
            base_salary: Number(form.base_salary) || 0,
            trip_allowance: Number(form.trip_allowance) || 0,
            attendance_bonus: Number(form.attendance_bonus) || 0,
            attendance_bonus_threshold: Number(form.attendance_bonus_threshold) || 0,
        };
        const { error: err } = isNew
            ? await supabase.from('sys_users_v2').insert({ ...payload, employee_id: `EMP-${Date.now()}` })
            : await supabase.from('sys_users_v2').update(payload).eq('id', form.id);
        if (err) setError(err.message);
        else { onSave(); onClose(); }
        setSaving(false);
    };

    const f = (label: string, key: keyof Employee, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">{label}</label>
            <input type={type} value={(form[key] as any) ?? ''} onChange={e => set(key, type === 'number' ? e.target.value : e.target.value)}
                placeholder={placeholder}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-white/30" />
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0d0d12] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-lg font-black text-white">{isNew ? '+ New Employee' : `Edit: ${emp?.name}`}</h2>
                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-3">
                        {f('Full Name', 'name', 'text', 'Ahmad bin Ali')}
                        {f('Email', 'email', 'email', 'ahmad@company.com')}
                        {f('Phone', 'phone', 'text', '012-XXXXXXX')}
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Role</label>
                            <select value={form.role || 'Operator'} onChange={e => set('role', e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30">
                                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                            <select value={form.status || 'active'} onChange={e => set('status', e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="resigned">Resigned</option>
                            </select>
                        </div>
                    </div>

                    {/* Pay Type */}
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Pay Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(PAY_TYPE_LABELS).map(([k, v]) => (
                                <button key={k} onClick={() => set('pay_type', k)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${form.pay_type === k ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/5 hover:text-white'}`}>
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pay Fields based on type */}
                    <div className="bg-black/30 rounded-2xl p-4 space-y-3 border border-white/5">
                        {form.pay_type === 'hourly' && (
                            f('Hourly Rate (RM)', 'hourly_rate', 'number', '6.50')
                        )}
                        {form.pay_type === 'monthly' && (
                            f('Monthly Salary (RM)', 'base_salary', 'number', '2000')
                        )}
                        {form.pay_type === 'driver' && (<>
                            {f('Base Salary (RM, 0 = no base)', 'base_salary', 'number', '0')}
                            {f('Trip Allowance (RM/trip)', 'trip_allowance', 'number', '30')}
                        </>)}
                        {/* Attendance Bonus for all */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                            {f('全勤奖 Attendance Bonus (RM)', 'attendance_bonus', 'number', '200')}
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Max Absent Days Still Eligible</label>
                                <input type="number" value={form.attendance_bonus_threshold ?? 0} onChange={e => set('attendance_bonus_threshold', e.target.value)}
                                    placeholder="0 = perfect attendance"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-white/30" />
                                <div className="text-[9px] text-gray-600 mt-1">0 = zero absences required</div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}
                </div>
                <div className="p-6 border-t border-white/5 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-400 transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm text-white font-bold flex items-center justify-center gap-2 transition-colors">
                        {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                        {isNew ? 'Create Employee' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── MAIN COMPONENT ────────────────────────────────────────────
const HRPortal: React.FC<{ user?: any }> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'personnel' | 'permissions' | 'leave' | 'payroll'>('personnel');

    // Personnel
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loadingEmp, setLoadingEmp] = useState(true);
    const [editingEmp, setEditingEmp] = useState<Partial<Employee> | null | 'new'>(null);
    const [empSearch, setEmpSearch] = useState('');

    // Permissions
    const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
    const [loadingPerms, setLoadingPerms] = useState(true);
    const [savingPerms, setSavingPerms] = useState(false);
    const [selectedPermRole, setSelectedPermRole] = useState('Driver');

    // Leave
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loadingLeave, setLoadingLeave] = useState(true);

    // Payroll
    const today = new Date();
    const [payMonth, setPayMonth] = useState(today.getMonth() + 1);
    const [payYear, setPayYear] = useState(today.getFullYear());
    const [payrollData, setPayrollData] = useState<any[]>([]);
    const [loadingPayroll, setLoadingPayroll] = useState(false);
    const [generatingPayroll, setGeneratingPayroll] = useState(false);

    // Zone rates
    const [zoneRates, setZoneRates] = useState<{ id: string; zone_name: string; rate: number; notes: string }[]>([]);
    const [showZoneEditor, setShowZoneEditor] = useState(false);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneRate, setNewZoneRate] = useState('');
    const [newZoneNotes, setNewZoneNotes] = useState('');
    const [savingZone, setSavingZone] = useState(false);

    // ── Personnel ────────────────────────────────────────────
    const fetchEmployees = useCallback(async () => {
        setLoadingEmp(true);
        const { data } = await supabase.from('sys_users_v2')
            .select('id, auth_user_id, employee_id, name, email, phone, role, status, pay_type, hourly_rate, base_salary, trip_allowance, attendance_bonus, attendance_bonus_threshold')
            .order('name');
        setEmployees(data || []);
        setLoadingEmp(false);
    }, []);

    useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

    // ── Permissions ──────────────────────────────────────────
    const fetchPermissions = useCallback(async () => {
        setLoadingPerms(true);
        const { data } = await supabase.from('role_permissions').select('*');
        const map: Record<string, Record<string, boolean>> = {};
        (data || []).forEach((r: any) => {
            if (!map[r.role_name]) map[r.role_name] = {};
            map[r.role_name][r.page_id] = r.allowed;
        });
        setPermissions(map);
        setLoadingPerms(false);
    }, []);

    useEffect(() => { if (activeTab === 'permissions') fetchPermissions(); }, [activeTab, fetchPermissions]);

    const togglePerm = (role: string, pageId: string) => {
        setPermissions(prev => ({
            ...prev,
            [role]: { ...(prev[role] || {}), [pageId]: !(prev[role]?.[pageId] ?? false) }
        }));
    };

    const savePermissions = async () => {
        setSavingPerms(true);
        const rows: any[] = [];
        Object.entries(permissions).forEach(([role, pages]) => {
            Object.entries(pages).forEach(([pageId, allowed]) => {
                rows.push({ role_name: role, page_id: pageId, allowed });
            });
        });
        await supabase.from('role_permissions').delete().in('role_name', ALL_ROLES);
        if (rows.length > 0) await supabase.from('role_permissions').insert(rows);
        setSavingPerms(false);
        alert('✅ Permissions saved! Changes take effect on next login.');
    };

    // ── Leave ────────────────────────────────────────────────
    const fetchLeave = useCallback(async () => {
        setLoadingLeave(true);
        const { data } = await supabase.from('employee_leave')
            .select('*, users_public:employee_id (name, email, role)')
            .order('created_at', { ascending: false });
        setRequests(data || []);
        setLoadingLeave(false);
    }, []);

    useEffect(() => { if (activeTab === 'leave') fetchLeave(); }, [activeTab, fetchLeave]);

    const handleLeaveAction = async (id: string, status: 'Approved' | 'Rejected') => {
        if (!window.confirm(`${status} this leave request?`)) return;
        await supabase.from('employee_leave').update({ status, reviewed_by: user?.uid, reviewed_at: new Date().toISOString() }).eq('id', id);
        fetchLeave();
    };


    // ── Zone Rates ───────────────────────────────────────────
    const fetchZoneRates = useCallback(async () => {
        const { data } = await supabase.from('zone_trip_rates').select('*').order('zone_name');
        setZoneRates(data || []);
    }, []);

    const handleAddZone = async () => {
        if (!newZoneName.trim() || !newZoneRate) return;
        setSavingZone(true);
        await supabase.from('zone_trip_rates').upsert(
            { zone_name: newZoneName.trim(), rate: Number(newZoneRate), notes: newZoneNotes },
            { onConflict: 'zone_name' }
        );
        setNewZoneName(''); setNewZoneRate(''); setNewZoneNotes('');
        await fetchZoneRates();
        setSavingZone(false);
    };

    const handleDeleteZone = async (id: string) => {
        if (!window.confirm('Delete this zone rate?')) return;
        await supabase.from('zone_trip_rates').delete().eq('id', id);
        fetchZoneRates();
    };

    // ── Payroll ──────────────────────────────────────────────
    const fetchPayroll = useCallback(async () => {
        setLoadingPayroll(true);
        const firstDay = `${payYear}-${String(payMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(payYear, payMonth, 0).toISOString().split('T')[0];

        // Employees
        const { data: emps } = await supabase.from('sys_users_v2')
            .select('id, auth_user_id, employee_id, name, role, pay_type, hourly_rate, base_salary, trip_allowance, attendance_bonus, attendance_bonus_threshold')
            .eq('status', 'active').order('name');

        // Attendance hours for operators
        const { data: attendance } = await supabase.from('operator_attendance')
            .select('operator_id, hours_worked, date')
            .gte('date', firstDay).lte('date', lastDay);

        // Driver trips with zone info for zone-based allowance
        const { data: trips } = await supabase.from('sales_orders')
            .select('driver_id, zone, delivery_zone')
            .eq('status', 'Delivered')
            .gte('pod_timestamp', new Date(payYear, payMonth - 1, 1).toISOString())
            .lte('pod_timestamp', new Date(payYear, payMonth, 0, 23, 59, 59).toISOString());

        // Zone rates lookup
        const { data: zr } = await supabase.from('zone_trip_rates').select('zone_name, rate');
        const zoneRateMap: Record<string, number> = {};
        (zr || []).forEach((z: any) => { zoneRateMap[z.zone_name?.toLowerCase()] = Number(z.rate); });

        // Approved leave (for attendance bonus check)
        const { data: leaves } = await supabase.from('employee_leave')
            .select('employee_id, count_days').eq('status', 'Approved')
            .gte('start_date', firstDay).lte('end_date', lastDay);

        // Existing payroll records
        const { data: existing } = await supabase.from('payroll_records')
            .select('*').eq('month', payMonth).eq('year', payYear);

        // Build driver trip earnings map using zone rates
        // tripEarningsMap[auth_user_id] = { totalEarnings, tripCount, tripDetails }
        const tripEarningsMap: Record<string, { total: number; count: number; breakdown: string[] }> = {};
        (trips || []).forEach((t: any) => {
            if (!t.driver_id) return;
            const zone = (t.zone || t.delivery_zone || '').toLowerCase();
            const rate = zoneRateMap[zone] ?? null;
            if (!tripEarningsMap[t.driver_id]) tripEarningsMap[t.driver_id] = { total: 0, count: 0, breakdown: [] };
            tripEarningsMap[t.driver_id].count += 1;
            if (rate !== null) {
                tripEarningsMap[t.driver_id].total += rate;
                tripEarningsMap[t.driver_id].breakdown.push(`${t.zone || t.delivery_zone}: RM${rate}`);
            } else {
                // No zone rate — flag it
                tripEarningsMap[t.driver_id].breakdown.push(`${t.zone || t.delivery_zone || 'Unknown'}: ⚠️ no rate`);
            }
        });

        // Build maps
        const hoursMap: Record<string, number> = {};
        (attendance || []).forEach((a: any) => { hoursMap[a.operator_id] = (hoursMap[a.operator_id] || 0) + (Number(a.hours_worked) || 0); });

        const leaveMap: Record<string, number> = {};
        (leaves || []).forEach((l: any) => { leaveMap[l.employee_id] = (leaveMap[l.employee_id] || 0) + l.count_days; });

        const existingMap: Record<string, any> = {};
        (existing || []).forEach((r: any) => { existingMap[r.employee_id] = r; });

        // Calculate payroll per employee
        const rows = (emps || []).map((emp: any) => {
            let gross = 0;
            let details = '';
            const hoursWorked = hoursMap[emp.employee_id] || 0;
            const tripData = tripEarningsMap[emp.auth_user_id] || { total: 0, count: 0, breakdown: [] };
            const absentDays = leaveMap[emp.employee_id] || 0;

            if (emp.pay_type === 'hourly') {
                gross = hoursWorked * (Number(emp.hourly_rate) || 0);
                details = `${hoursWorked.toFixed(1)}h × RM${emp.hourly_rate}`;
            } else if (emp.pay_type === 'driver') {
                gross = Number(emp.base_salary) + tripData.total;
                const basePart = emp.base_salary > 0 ? `Base RM${emp.base_salary} + ` : '';
                details = `${basePart}${tripData.count} trips = RM${tripData.total.toFixed(2)}`;
            } else {
                gross = Number(emp.base_salary);
                details = `Fixed RM${emp.base_salary}`;
            }

            // Full attendance bonus
            const threshold = Number(emp.attendance_bonus_threshold) || 0;
            const earnedBonus = (Number(emp.attendance_bonus) > 0 && absentDays <= threshold);
            const bonusAmt = earnedBonus ? Number(emp.attendance_bonus) : 0;
            const net = gross + bonusAmt;

            return {
                emp, gross, details, hoursWorked,
                tripCount: tripData.count, tripBreakdown: tripData.breakdown, absentDays,
                bonusAmt, earnedBonus, net,
                existing: existingMap[emp.employee_id] || null,
            };
        });

        setPayrollData(rows);
        setLoadingPayroll(false);
    }, [payMonth, payYear]);

    useEffect(() => { if (activeTab === 'payroll') { fetchPayroll(); fetchZoneRates(); } }, [activeTab, fetchPayroll, fetchZoneRates]);

    const handleGeneratePayroll = async () => {
        if (!window.confirm(`Generate payroll for ${MONTH_NAMES[payMonth - 1]} ${payYear}?`)) return;
        setGeneratingPayroll(true);
        const records = payrollData.map(r => ({
            employee_id: r.emp.employee_id,
            month: payMonth, year: payYear,
            base_salary: r.gross,
            attendance_bonus: r.bonusAmt,
            net_salary: r.net,
            leave_days_unpaid: 0, deduction: 0,
            generated_by: user?.uid || null,
        }));
        const { error } = await supabase.from('payroll_records')
            .upsert(records, { onConflict: 'employee_id,month,year' });
        if (error) alert('Error: ' + error.message);
        else { alert(`✅ Payroll saved for ${MONTH_NAMES[payMonth - 1]} ${payYear}`); fetchPayroll(); }
        setGeneratingPayroll(false);
    };

    const changeMonth = (d: number) => {
        let m = payMonth + d, y = payYear;
        if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
        setPayMonth(m); setPayYear(y);
    };

    const pendingLeave = requests.filter(r => r.status === 'Pending');
    const historyLeave = requests.filter(r => r.status !== 'Pending');
    const [leaveSubTab, setLeaveSubTab] = useState<'pending' | 'history'>('pending');
    const displayLeave = leaveSubTab === 'pending' ? pendingLeave : historyLeave;

    const filteredEmps = employees.filter(e =>
        !empSearch || e.name?.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.role?.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.employee_id?.toLowerCase().includes(empSearch.toLowerCase()));

    const totalPayroll = payrollData.reduce((s, r) => s + r.net, 0);

    const pageGroups = ALL_PAGES.reduce((acc, p) => {
        if (!acc[p.group]) acc[p.group] = [];
        acc[p.group].push(p);
        return acc;
    }, {} as Record<string, typeof ALL_PAGES>);

    // ── TABS ──────────────────────────────────────────────────
    const TABS = [
        { id: 'personnel', label: `👥 Personnel (${employees.length})` },
        { id: 'permissions', label: '🔐 Page Permissions' },
        { id: 'leave', label: `🏖️ Leave (${pendingLeave.length} pending)` },
        { id: 'payroll', label: '💰 Payroll' },
    ] as const;

    return (
        <div className="p-4 md:p-6 bg-[#07070a] min-h-screen text-white font-sans">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-black text-white flex items-center gap-3 mb-1">
                    <Users className="text-blue-500" size={28} /> HR Control Center
                </h1>
                <p className="text-gray-500 text-sm">Manage employees, permissions, leave and payroll.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${activeTab === tab.id
                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                            : 'bg-white/5 text-gray-500 border-white/5 hover:text-white hover:border-white/10'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── PERSONNEL ── */}
            {activeTab === 'personnel' && (
                <div>
                    <div className="flex items-center justify-between mb-4 gap-3">
                        <input type="text" value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                            placeholder="Search name, role, ID..."
                            className="flex-1 max-w-xs bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                        <button onClick={() => setEditingEmp('new')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm text-white font-bold transition-colors">
                            <Plus size={14} /> New Employee
                        </button>
                    </div>

                    {loadingEmp ? (
                        <div className="flex justify-center py-20"><Loader className="animate-spin text-blue-500" size={28} /></div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-white/5">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-white/[0.03] text-gray-500 text-[10px] uppercase tracking-widest">
                                        {['Employee', 'Role', 'Pay Type', 'Rate / Salary', '全勤奖', 'Status', ''].map(h => (
                                            <th key={h} className="px-4 py-3 text-left border-b border-white/5 font-bold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredEmps.map(emp => (
                                        <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-white">{emp.name || '—'}</div>
                                                <div className="text-[10px] text-gray-600 font-mono">{emp.employee_id}</div>
                                                {emp.email && <div className="text-[10px] text-gray-600">{emp.email}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">
                                                    {emp.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-400">
                                                {PAY_TYPE_LABELS[emp.pay_type] || emp.pay_type}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-white">
                                                {emp.pay_type === 'hourly' && `RM ${Number(emp.hourly_rate).toFixed(2)}/hr`}
                                                {emp.pay_type === 'monthly' && `RM ${Number(emp.base_salary).toLocaleString()}/mo`}
                                                {emp.pay_type === 'driver' && (
                                                    <div>
                                                        <div className="text-gray-400">{emp.base_salary > 0 ? `Base: RM${emp.base_salary}` : 'No base'}</div>
                                                        <div className="text-amber-400">+RM{emp.trip_allowance}/trip</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {emp.attendance_bonus > 0 ? (
                                                    <div className="text-yellow-400 font-bold text-xs flex items-center gap-1">
                                                        <Star size={10} /> RM{emp.attendance_bonus}
                                                        <span className="text-gray-600 text-[9px]">≤{emp.attendance_bonus_threshold}d</span>
                                                    </div>
                                                ) : <span className="text-gray-700 text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${emp.status === 'active' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => setEditingEmp(emp)}
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                                    <Edit2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── PAGE PERMISSIONS ── */}
            {activeTab === 'permissions' && (
                <div>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <div className="flex gap-2 flex-wrap">
                            {ALL_ROLES.map(role => (
                                <button key={role} onClick={() => setSelectedPermRole(role)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${selectedPermRole === role ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-white/5 text-gray-500 border-white/5 hover:text-white'}`}>
                                    {role}
                                </button>
                            ))}
                        </div>
                        <button onClick={savePermissions} disabled={savingPerms}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-sm text-white font-bold transition-colors">
                            {savingPerms ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
                            Save Permissions
                        </button>
                    </div>

                    <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-1 text-xs text-gray-500 mb-4">
                        <AlertCircle size={12} className="inline mr-1 text-amber-400" />
                        Page access is saved to DB. Changes apply to users on next login. Unchecked = blocked, Checked = allowed.
                    </div>

                    {loadingPerms ? (
                        <div className="flex justify-center py-16"><Loader className="animate-spin" size={24} /></div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(pageGroups).map(([group, pages]) => (
                                <div key={group} className="bg-[#0d0d12] border border-white/5 rounded-2xl overflow-hidden">
                                    <div className="px-4 py-2 border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">{group}</div>
                                    <div className="divide-y divide-white/5">
                                        {pages.map(page => {
                                            const isAllowed = permissions[selectedPermRole]?.[page.id] ?? false;
                                            return (
                                                <div key={page.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02]">
                                                    <span className="text-sm text-white">{page.label}</span>
                                                    <button onClick={() => togglePerm(selectedPermRole, page.id)}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isAllowed ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/5 text-gray-600 border-white/5'}`}>
                                                        {isAllowed ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                                        {isAllowed ? 'ALLOWED' : 'BLOCKED'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── LEAVE ── */}
            {activeTab === 'leave' && (
                <div>
                    <div className="flex gap-2 mb-4">
                        {(['pending', 'history'] as const).map(t => (
                            <button key={t} onClick={() => setLeaveSubTab(t)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase border transition-all ${leaveSubTab === t ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}>
                                {t === 'pending' ? `Pending (${pendingLeave.length})` : `History (${historyLeave.length})`}
                            </button>
                        ))}
                    </div>
                    {loadingLeave ? (
                        <div className="flex justify-center py-16"><Loader className="animate-spin text-amber-500" size={24} /></div>
                    ) : displayLeave.length === 0 ? (
                        <div className="text-center py-20 text-gray-600 border border-dashed border-white/5 rounded-2xl">
                            <Calendar size={36} className="mx-auto mb-3 opacity-30" />
                            <p>No leave requests.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {displayLeave.map(req => (
                                <div key={req.id} className="bg-[#0d0d12] border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-white/10 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 shrink-0"><UserIcon size={18} /></div>
                                        <div>
                                            <div className="font-bold text-white">{req.users_public?.name || 'Unknown'}</div>
                                            <div className="text-[10px] text-gray-500 uppercase">{req.users_public?.role}</div>
                                            {req.reason && <div className="text-xs text-gray-400 mt-0.5 italic">"{req.reason}"</div>}
                                            <div className="text-[10px] text-gray-600 mt-1 font-mono flex items-center gap-1"><Clock size={9} /> {new Date(req.created_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5 text-center">
                                            <div className="text-[10px] text-gray-500 uppercase mb-0.5 flex items-center gap-1"><Calendar size={9} /> Date</div>
                                            <div className="text-sm font-bold text-white">{req.start_date} → {req.end_date}</div>
                                            <div className="text-[10px] text-blue-400 font-bold">{req.count_days} Days</div>
                                        </div>
                                        <StatusBadge status={req.status} />
                                        {leaveSubTab === 'pending' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleLeaveAction(req.id, 'Approved')}
                                                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors">
                                                    <CheckCircle size={12} /> Approve
                                                </button>
                                                <button onClick={() => handleLeaveAction(req.id, 'Rejected')}
                                                    className="px-4 py-2 bg-white/5 hover:bg-red-900/30 hover:text-red-400 text-gray-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                                                    <XCircle size={12} /> Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── PAYROLL ── */}
            {activeTab === 'payroll' && (
                <div>
                    {/* Controls */}
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                        <div className="flex items-center gap-3 bg-[#0d0d12] border border-white/10 rounded-2xl px-4 py-3">
                            <button onClick={() => changeMonth(-1)} className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"><ChevronLeft size={20} /></button>
                            <div className="text-center min-w-[140px]">
                                <div className="text-lg font-black text-white">{MONTH_NAMES[payMonth - 1]}</div>
                                <div className="text-xs text-gray-500">{payYear}</div>
                            </div>
                            <button onClick={() => changeMonth(1)} className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"><ChevronRight size={20} /></button>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="bg-green-950/40 border border-green-500/20 rounded-2xl px-5 py-3">
                                <div className="text-[10px] text-green-500 uppercase tracking-widest mb-0.5">Total Payroll</div>
                                <div className="text-xl font-black text-green-400">RM {totalPayroll.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <button onClick={handleGeneratePayroll} disabled={generatingPayroll || payrollData.length === 0}
                                className="px-4 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-2xl font-bold text-xs uppercase tracking-widest text-white flex items-center gap-2 transition-colors">
                                {generatingPayroll ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                                Generate
                            </button>
                        </div>
                    </div>


                    {/* Zone Rates Manager */}
                    <div className="mb-5 bg-[#0d0d12] border border-amber-500/20 rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setShowZoneEditor(v => !v)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
                                <MapPin size={13} /> Zone Trip Rates
                            </div>
                            <span className="text-[10px] text-gray-500">{zoneRates.length} zones configured · click to {showZoneEditor ? 'collapse' : 'expand'}</span>
                        </button>
                        {showZoneEditor && (
                            <div className="border-t border-white/5 p-4 space-y-3">
                                {/* Existing zones */}
                                {zoneRates.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                                        {zoneRates.map(z => (
                                            <div key={z.id} className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-3 py-2">
                                                <div>
                                                    <div className="text-sm font-bold text-white">{z.zone_name}</div>
                                                    <div className="text-[10px] text-amber-400 font-mono">RM {Number(z.rate).toFixed(2)}</div>
                                                    {z.notes && <div className="text-[10px] text-gray-600">{z.notes}</div>}
                                                </div>
                                                <button onClick={() => handleDeleteZone(z.id)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Add new zone */}
                                <div className="flex gap-2 flex-wrap">
                                    <input type="text" value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
                                        placeholder="Zone name (e.g. KL, Seremban)"
                                        className="flex-1 min-w-[140px] bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50" />
                                    <input type="number" value={newZoneRate} onChange={e => setNewZoneRate(e.target.value)}
                                        placeholder="Rate (RM)"
                                        className="w-28 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50" />
                                    <input type="text" value={newZoneNotes} onChange={e => setNewZoneNotes(e.target.value)}
                                        placeholder="Notes (optional)"
                                        className="flex-1 min-w-[120px] bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-amber-500/50" />
                                    <button onClick={handleAddZone} disabled={savingZone || !newZoneName || !newZoneRate}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors">
                                        {savingZone ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                                        Add Zone
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {loadingPayroll ? (
                        <div className="flex justify-center py-20"><Loader className="animate-spin text-green-500" size={28} /></div>
                    ) : payrollData.length === 0 ? (
                        <div className="text-center py-20 text-gray-600 border border-dashed border-white/5 rounded-2xl">
                            <DollarSign size={36} className="mx-auto mb-3 opacity-30" />
                            <p>No active employees found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-white/5">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-white/[0.03] text-gray-500 text-[10px] uppercase tracking-widest">
                                        {['Employee', 'Pay Type', 'Activity', 'Gross', '全勤奖', 'Net Pay', 'Status'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left border-b border-white/5 font-bold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {payrollData.map(row => (
                                        <tr key={row.emp.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-white">{row.emp.name}</div>
                                                <div className="text-[10px] text-gray-600 font-mono">{row.emp.employee_id}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">{row.emp.pay_type}</span>
                                            </td>
                                            <td className="px-4 py-4 text-xs text-gray-400">
                                                <div>{row.details}</div>
                                                {row.emp.pay_type === 'hourly' && <div className="text-[10px] text-gray-600">{row.hoursWorked.toFixed(1)} hours logged</div>}
                                                {row.emp.pay_type === 'driver' && (
                                                    <div className="space-y-0.5 mt-0.5">
                                                        {row.tripBreakdown?.slice(0, 5).map((b: string, i: number) => (
                                                            <div key={i} className={`text-[10px] font-mono ${b.includes('⚠️') ? 'text-red-400' : 'text-amber-400/70'}`}>{b}</div>
                                                        ))}
                                                        {row.tripBreakdown?.length > 5 && <div className="text-[9px] text-gray-600">+{row.tripBreakdown.length - 5} more</div>}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 font-mono font-bold text-white">
                                                RM {row.gross.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-4">
                                                {row.emp.attendance_bonus > 0 ? (
                                                    row.earnedBonus ? (
                                                        <div className="flex items-center gap-1 text-yellow-400 font-bold text-xs">
                                                            <Award size={12} /> +RM{row.bonusAmt}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-gray-600">{row.absentDays}d absent<br />Not eligible</div>
                                                    )
                                                ) : <span className="text-gray-700">—</span>}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="font-black text-green-400 font-mono">RM {row.net.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                {row.existing ? (
                                                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border border-green-500/20 bg-green-500/10 text-green-400 flex items-center gap-1 w-fit">
                                                        <Wallet size={10} /> Saved
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 uppercase">Draft</span>
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

            {/* Employee Edit Modal */}
            {editingEmp !== null && (
                <EmployeeModal
                    emp={editingEmp === 'new' ? null : editingEmp}
                    onClose={() => setEditingEmp(null)}
                    onSave={fetchEmployees}
                />
            )}
        </div>
    );
};

export default HRPortal;
