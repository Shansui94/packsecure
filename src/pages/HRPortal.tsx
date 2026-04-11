import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    Users, Download, AlertCircle,
    Wallet, Plus, Edit2, Save, X, ToggleLeft, Trash2,
    ToggleRight, Star, Award, MapPin, DollarSign, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader, Shield
} from 'lucide-react';

// ── SUPABASE ADMIN (FOR AUTH MANAGEMENT) ──────────────────────
import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── TYPES ────────────────────────────────────────────────────
interface Employee {
    id: string;
    auth_user_id: string;
    employee_id: string;
    pin_code?: string;
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

// ── EMPLOYEE EDIT MODAL ──────────────────────────────────────
const EmployeeModal: React.FC<{
    emp: Partial<Employee> | null;
    onClose: () => void;
    onSave: () => void;
}> = ({ emp, onClose, onSave }) => {
    const isNew = !emp?.id;
    const [form, setForm] = useState<Partial<Employee> & { pin_input?: string }>(emp ? {
        ...emp,
        pin_input: emp.pin_code || emp.employee_id || ''
    } : {
        role: 'Operator', pay_type: 'hourly', status: 'active',
        hourly_rate: 0, base_salary: 0, trip_allowance: 0,
        attendance_bonus: 0, attendance_bonus_threshold: 0,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [newPassword, setNewPassword] = useState(''); // separate from PIN — only for Auth login password

    const set = (k: keyof Employee, v: any) => setForm(f => ({ ...f, [k]: v }));

    // Auto-generate next PIN for new employees
    useEffect(() => {
        if (!isNew) return;
        supabase.from('sys_users_v2').select('employee_id').then(({ data }) => {
            const maxPin = (data || [])
                .map(r => r.employee_id || '')
                .filter(s => /^\d{4}$/.test(s))   // only exact 4-digit PINs
                .map(s => parseInt(s, 10))
                .reduce((m, n) => Math.max(m, n), 0);
            const nextPin = String(maxPin + 1).padStart(4, '0');
            setForm(f => ({ ...f, pin_input: nextPin } as any));
        });
    }, [isNew]);

    const handleSave = async () => {
        const pin = (form as any).pin_input || '';
        if (isNew && pin.length !== 4) return setError('PIN must be exactly 4 digits.');
        setSaving(true);
        setError('');

        let targetAuthId = form.auth_user_id;
        const validEmail = form.email || `emp_${pin}@packsecure.local`;

        // Supabase Auth requires minimum 6 characters for passwords.
        // We append '00' to the 4-digit PIN for Auth purposes.
        const authPassword = pin ? `${pin}00` : undefined;

        // 1. SUPABASE AUTH SYNC
        if (isNew && authPassword) {
            try {
                // Try to use the secure Vercel API first
                const res = await fetch('/api/manage-employee', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create', email: validEmail, password: authPassword, name: form.name, role: form.role })
                });
                
                if (!res.ok) {
                    // Fallback to direct supabaseAdmin for local development (npm run dev)
                    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
                        email: validEmail, password: authPassword, email_confirm: true, user_metadata: { name: form.name, role: form.role }
                    });
                    if (authErr) {
                        setError('Auth Error: ' + authErr.message + ' (Please check Vercel Env Vars)');
                        setSaving(false); return;
                    }
                    targetAuthId = authData.user.id;
                } else {
                    const data = await res.json();
                    targetAuthId = data.user.id;
                }
            } catch (err: any) {
                setError('API Error: ' + err.message);
                setSaving(false); return;
            }
        } else if (authPassword && targetAuthId) {
            // Update password if PIN is supplied
            try {
                await fetch('/api/manage-employee', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_password', targetAuthId, password: authPassword })
                });
                await supabaseAdmin.auth.admin.updateUserById(targetAuthId, { password: authPassword });
            } catch (e) { console.error(e); }
        }

        // Separately: if admin explicitly typed a new login password, update Auth password directly
        if (!isNew && newPassword.trim().length >= 6 && targetAuthId) {
            try {
                await fetch('/api/manage-employee', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_password', targetAuthId, password: newPassword.trim() })
                });
                await supabaseAdmin.auth.admin.updateUserById(targetAuthId, { password: newPassword.trim() });
            } catch (e) { console.error(e); }
        }

        const payload: any = {
            auth_user_id: targetAuthId,
            name: form.name, email: validEmail, phone: form.phone || null,
            role: form.role, status: form.status || 'active',
            pay_type: form.pay_type, hourly_rate: Number(form.hourly_rate) || 0,
            base_salary: Number(form.base_salary) || 0,
            trip_allowance: Number(form.trip_allowance) || 0,
            attendance_bonus: Number(form.attendance_bonus) || 0,
            attendance_bonus_threshold: Number(form.attendance_bonus_threshold) || 0,
        };
        // Only set pin_code / employee_id when provided
        if (pin) { payload.pin_code = pin; payload.employee_id = pin; }

        const { error: err } = isNew
            ? await supabase.from('sys_users_v2').insert(payload)
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
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">
                                PIN / Employee ID {isNew && <span className="text-red-400">*</span>}
                            </label>
                            <input
                                type="text" maxLength={4}
                                value={(form as any).pin_input ?? ''}
                                onChange={e => setForm(f => ({ ...f, pin_input: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                placeholder={isNew ? '4-digit PIN' : 'Blank = keep existing'}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-white/30 tracking-[0.3em] font-mono" />
                            <div className="text-[9px] text-gray-600 mt-1">Used to clock in at Production Control</div>
                            <div className="text-[9px] text-red-500/80 mt-0.5 font-medium">⚠️ System Login Password = PIN + "00" (e.g. 123400)</div>
                        </div>

                        {/* Reset Login Password — existing employees only */}
                        {!isNew && (
                            <div>
                                <label className="block text-[10px] text-orange-400 uppercase tracking-widest mb-1.5 font-bold">
                                    🔑 Reset Login Password
                                </label>
                                <input
                                    type="text"
                                    style={{ WebkitTextSecurity: 'disc' } as any}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="New password (min 6 chars) — blank = no change"
                                    className="w-full bg-black/40 border border-orange-500/30 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-orange-400/60" />
                                <div className="text-[9px] text-gray-600 mt-1">Leave blank to keep current password. This changes the email login password only.</div>
                            </div>
                        )}
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
    const [activeTab, setActiveTab] = useState<'personnel' | 'permissions' | 'payroll'>('personnel');

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

    // Payroll
    const today = new Date();
    const [payMonth, setPayMonth] = useState(today.getMonth() + 1);
    const [payYear, setPayYear] = useState(today.getFullYear());
    const [payrollData, setPayrollData] = useState<any[]>([]);
    const [loadingPayroll, setLoadingPayroll] = useState(false);
    const [generatingPayroll, setGeneratingPayroll] = useState(false);

    // Delivery rates
    const [deliveryRates, setDeliveryRates] = useState<{ id: string; origin: string; location_name: string; base_rate: number; max_places: number; extra_rate_per_place: number; notes: string }[]>([]);
    const [showZoneEditor, setShowZoneEditor] = useState(false);
    const [showZoneForm, setShowZoneForm] = useState(false);
    const [newRateOrigin, setNewRateOrigin] = useState('TAIPING');
    const [newRateLocation, setNewRateLocation] = useState('');
    const [newRateBase, setNewRateBase] = useState('');
    const [newRateMaxPlaces, setNewRateMaxPlaces] = useState('3');
    const [newRateExtra, setNewRateExtra] = useState('');
    const [newZoneNotes, setNewZoneNotes] = useState('');
    const [savingZone, setSavingZone] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState<string | null>(null);

    // ── Personnel ────────────────────────────────────────────
    const fetchEmployees = useCallback(async () => {
        setLoadingEmp(true);
        const { data } = await supabase.from('sys_users_v2')
            .select('id, auth_user_id, employee_id, pin_code, name, email, phone, role, status, pay_type, hourly_rate, base_salary, trip_allowance, attendance_bonus, attendance_bonus_threshold')
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
        const targetedRoles = Object.keys(permissions);

        Object.entries(permissions).forEach(([role, pages]) => {
            Object.entries(pages).forEach(([pageId, allowed]) => {
                rows.push({ role_name: role, page_id: pageId, allowed });
            });
        });
        
        try {
            // Only wipe the roles we are about to re-insert
            if (targetedRoles.length > 0) {
                await supabase.from('role_permissions').delete().in('role_name', targetedRoles);
            }
            
            if (rows.length > 0) {
                const { error } = await supabase.from('role_permissions').insert(rows);
                if (error) throw error;
            }
            
            alert('✅ Permissions saved! Changes take effect on next login.');
        } catch (err: any) {
            console.error("Save failed:", err);
            alert("❌ Failed to save permissions! Error: " + err.message);
        } finally {
            setSavingPerms(false);
        }
    };

    // ── Zone Rates ───────────────────────────────────────────
    const fetchDeliveryRates = useCallback(async () => {
        const { data } = await supabase.from('delivery_rates').select('*').order('origin').order('location_name');
        setDeliveryRates(data || []);
    }, []);

    const handleAddZone = async () => {
        if (!newRateLocation.trim() || !newRateBase || !newRateOrigin) return;
        setSavingZone(true);
        const payload = { 
            origin: newRateOrigin.trim(), 
            location_name: newRateLocation.trim(), 
            base_rate: Number(newRateBase), 
            max_places: Number(newRateMaxPlaces),
            extra_rate_per_place: Number(newRateExtra),
            notes: newZoneNotes 
        };

        let err;
        let resultData;
        if (editingZoneId) {
            const { data, error } = await supabase.from('delivery_rates').update(payload).eq('id', editingZoneId).select();
            err = error;
            resultData = data;
        } else {
            const { data, error } = await supabase.from('delivery_rates').insert(payload).select();
            err = error;
            resultData = data;
        }

        if (err) {
            alert('Failed to save rate: ' + err.message);
        } else if (!resultData || resultData.length === 0) {
            alert('Database did not return inserted data. RLS or constraint issue might be silently blocking it.');
        } else {
            alert('Record successfully added/updated!');
            setNewRateLocation(''); setNewRateBase(''); setNewRateExtra(''); setNewZoneNotes('');
            setEditingZoneId(null);
            await fetchDeliveryRates();
        }
        setSavingZone(false);
    };

    const handleDeleteZone = async (id: string) => {
        if (!window.confirm('Delete this rate?')) return;
        await supabase.from('delivery_rates').delete().eq('id', id);
        fetchDeliveryRates();
    };

    const handleEditZone = (z: any) => {
        setEditingZoneId(z.id);
        setNewRateOrigin(z.origin || 'TAIPING');
        setNewRateLocation(z.location_name || '');
        setNewRateBase(z.base_rate?.toString() || '');
        setNewRateMaxPlaces(z.max_places?.toString() || '0');
        setNewRateExtra(z.extra_rate_per_place?.toString() || '');
        setNewZoneNotes(z.notes || '');
        setShowZoneForm(true);
        setShowZoneEditor(true);
    };

    const handleCloseZoneForm = () => {
        setShowZoneForm(false);
        setEditingZoneId(null);
        setNewRateLocation('');
        setNewRateBase('');
        setNewRateExtra('');
        setNewZoneNotes('');
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
            .select('driver_id, zone, delivery_zone, trip_origin, trip_drop_count')
            .eq('status', 'Delivered')
            .gte('deadline', firstDay)
            .lte('deadline', lastDay);

        // Delivery Rates lookup
        const { data: dr } = await supabase.from('delivery_rates').select('*');
        const rateMap: Record<string, any> = {};
        (dr || []).forEach((r: any) => { rateMap[`${r.origin}-${r.location_name}`.toLowerCase()] = r; });

        // Approved leave (for attendance bonus check)
        const { data: leaves } = await supabase.from('employee_leave')
            .select('employee_id, count_days').eq('status', 'Approved')
            .gte('start_date', firstDay).lte('end_date', lastDay);

        // Existing payroll records
        const { data: existing } = await supabase.from('payroll_records')
            .select('*').eq('month', payMonth).eq('year', payYear);

        // Build driver trip earnings map using origin+zone rates
        // tripEarningsMap[auth_user_id] = { totalEarnings, tripCount, tripDetails }
        const tripEarningsMap: Record<string, { total: number; count: number; breakdown: string[] }> = {};
        (trips || []).forEach((t: any) => {
            if (!t.driver_id) return;
            const origin = (t.trip_origin || 'TAIPING').toLowerCase();
            const zone = (t.zone || t.delivery_zone || '').toLowerCase();
            const key = `${origin}-${zone}`;
            const rateInfo = rateMap[key];
            
            const drops = Math.max(1, t.trip_drop_count || 1);

            if (!tripEarningsMap[t.driver_id]) tripEarningsMap[t.driver_id] = { total: 0, count: 0, breakdown: [] };
            tripEarningsMap[t.driver_id].count += 1;
            
            if (rateInfo) {
                const base = Number(rateInfo.base_rate) || 0;
                const maxPlaces = Number(rateInfo.max_places) || 0;
                const extraPlaces = Math.max(0, drops - maxPlaces);
                const extraRate = extraPlaces * (Number(rateInfo.extra_rate_per_place) || 0);
                const totalTripMoney = base + extraRate;

                tripEarningsMap[t.driver_id].total += totalTripMoney;
                tripEarningsMap[t.driver_id].breakdown.push(`${t.zone || t.delivery_zone} (${drops} drops): RM${totalTripMoney}`);
            } else {
                tripEarningsMap[t.driver_id].breakdown.push(`${t.zone || t.delivery_zone || 'Unknown'} (${drops} drops): ⚠️ no rate`);
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

    useEffect(() => { if (activeTab === 'payroll') { fetchPayroll(); fetchDeliveryRates(); } }, [activeTab, fetchPayroll, fetchDeliveryRates]);

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
                                                <div className="font-bold text-white text-sm group flex items-center gap-2">
                                                    {emp.name}
                                                    {emp.role === 'SuperAdmin' && <Shield size={12} className="text-purple-400" />}
                                                </div>
                                                <div className="text-[10px] text-gray-600 font-mono">ID: {emp.employee_id || 'N/A'} {emp.pin_code ? `| PIN: ${emp.pin_code}` : ''}</div>
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


                    {/* Delivery Rates Manager */}
                    <div className="mb-5 bg-[#0d0d12] border border-amber-500/20 rounded-2xl overflow-hidden">
                        <div className="w-full px-4 py-3 flex items-center justify-between border-b border-white/5 bg-black/20 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest cursor-pointer mt-1" onClick={() => setShowZoneEditor(v => !v)}>
                                <MapPin size={14} /> Driver Payroll Rates
                                <span className="text-[10px] text-zinc-500 lowercase ml-2 font-normal hidden sm:inline">({deliveryRates.length} configured)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { if (showZoneForm) { handleCloseZoneForm(); } else { setShowZoneForm(true); setShowZoneEditor(true); } }} className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-[10px] uppercase tracking-widest rounded-lg transition-colors border border-amber-500/20 flex items-center gap-1.5">
                                    {showZoneForm ? <X size={12} /> : <Plus size={12} />}
                                    {showZoneForm ? 'Close Form' : 'Add New Rate'}
                                </button>
                                <button onClick={() => setShowZoneEditor(v => !v)} className="p-1 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors">
                                    {showZoneEditor ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                            </div>
                        </div>
                        {showZoneEditor && (
                            <div className="border-t border-white/5 p-4 space-y-3">
                                {/* Existing zones */}
                                {deliveryRates.length > 0 && (
                                    <div className="mb-3 max-h-[500px] overflow-auto custom-scrollbar rounded-xl border border-white/5 relative">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="sticky top-0 bg-[#0d0d12] shadow-sm z-10 backdrop-blur-xl">
                                                <tr className="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-white/10">
                                                    <th className="px-4 py-3 font-bold">Origin</th>
                                                    <th className="px-4 py-3 font-bold">Destination</th>
                                                    <th className="px-4 py-3 font-bold">Base (RM)</th>
                                                    <th className="px-4 py-3 font-bold">Max Drops</th>
                                                    <th className="px-4 py-3 font-bold">+Rate / Drop</th>
                                                    <th className="px-4 py-3 font-bold">Notes</th>
                                                    <th className="px-4 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.03] bg-black/20">
                                                {deliveryRates.map(z => (
                                                    <tr key={z.id} className="hover:bg-white/[0.03] group transition-colors">
                                                        <td className="px-4 py-2.5 w-24">
                                                            <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-black">{z.origin}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-xs font-bold text-white uppercase">{z.location_name}</td>
                                                        <td className="px-4 py-2.5 text-xs font-mono text-amber-400">
                                                            {Number(z.base_rate).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-xs font-mono text-zinc-300">
                                                            {z.max_places}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-xs font-mono text-amber-400">
                                                            {Number(z.extra_rate_per_place).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-[10px] text-zinc-500 max-w-[120px] truncate">{z.notes || '-'}</td>
                                                        <td className="px-4 py-2.5 w-20 text-right">
                                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button onClick={() => handleEditZone(z)} className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                                                                    <Edit2 size={13} />
                                                                </button>
                                                                <button onClick={() => handleDeleteZone(z.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
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
        {/* Zone Form Modal */}
            {showZoneForm && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0d0d12] border border-amber-500/30 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
                        <div className="bg-amber-500/5 p-6 flex flex-col gap-4">
                            <button onClick={handleCloseZoneForm} className="absolute top-4 right-4 p-2 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-colors">
                                <X size={16} />
                            </button>
                            <div className="text-sm font-black text-amber-500 uppercase tracking-widest flex items-center gap-2 pr-8 mb-2">
                                <MapPin size={16} /> {newRateLocation ? `Update Rate: ${newRateLocation}` : 'Add New Delivery Rate'}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] text-amber-500/70 font-bold uppercase tracking-widest mb-1.5">Origin</label>
                                    <select value={newRateOrigin} onChange={e => setNewRateOrigin(e.target.value)} className="w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-400 transition-colors">
                                        <option value="TAIPING">TAIPING</option>
                                        <option value="NILAI">NILAI</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] text-amber-500/70 font-bold uppercase tracking-widest mb-1.5">Destination (Location)</label>
                                    <input type="text" value={newRateLocation} onChange={e => setNewRateLocation(e.target.value)} placeholder="e.g. KUALA LUMPUR" className="w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-white font-bold uppercase focus:outline-none focus:border-amber-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-amber-500/70 font-bold uppercase tracking-widest mb-1.5">Base Rate (RM)</label>
                                    <input type="number" value={newRateBase} onChange={e => setNewRateBase(e.target.value)} placeholder="0" className="w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-sm font-mono text-amber-400 focus:outline-none focus:border-amber-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-amber-500/70 font-bold uppercase tracking-widest mb-1.5">Max Free Drops</label>
                                    <input type="number" value={newRateMaxPlaces} onChange={e => setNewRateMaxPlaces(e.target.value)} placeholder="0" className="w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-amber-400 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-amber-500/70 font-bold uppercase tracking-widest mb-1.5">+ Extra Rate / Drop</label>
                                    <input type="number" value={newRateExtra} onChange={e => setNewRateExtra(e.target.value)} placeholder="0" className="w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-sm font-mono text-amber-400 focus:outline-none focus:border-amber-400 transition-colors" />
                                </div>
                                <div className="col-span-2 mt-2">
                                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5">Internal Notes</label>
                                    <input type="text" value={newZoneNotes} onChange={e => setNewZoneNotes(e.target.value)} placeholder="Optional specific instructions" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-400 focus:outline-none focus:border-amber-500/50 transition-colors" />
                                </div>
                            </div>
                            
                            <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-white/5">
                                <button onClick={handleCloseZoneForm} className="px-5 py-3 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                                <button onClick={() => { handleAddZone(); setShowZoneForm(false); }} disabled={savingZone || !newRateLocation || !newRateBase} className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20">
                                    {savingZone ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save Rate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRPortal;
