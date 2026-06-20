import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    Users, Download, AlertCircle,
    Wallet, Plus, Edit2, Save, X, ToggleLeft, Trash2,
    ToggleRight, Star, Award, MapPin, DollarSign, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader, Shield, Check, RefreshCw
} from 'lucide-react';
import { getSalaryAdvances, updateSalaryAdvanceStatus } from '../services/apiV2';

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

const formatCSVDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
};

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
    role_modules?: string[];
    base_location?: string;
}

const ALL_PAGES = [
    { id: 'factory-live-os', label: 'Factory Live OS', group: 'Factory' },
    { id: 'scanner', label: 'Production Control', group: 'Factory' },
    { id: 'livestock', label: 'Live Stock', group: 'Factory' },
    { id: 'production', label: 'Production Logs', group: 'Factory' },
    { id: 'floor-plan', label: 'Floor Plan (厂房布局)', group: 'Factory' },
    { id: 'machine-schedule', label: 'Machine Schedule (排产)', group: 'Factory' },
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
    { id: 'activity-logs', label: 'Activity Logs (操作日志)', group: 'Admin' },
    { id: 'dev-log', label: 'Dev Log (开发日志)', group: 'Admin' },
    { id: 'maintenance', label: 'Maintenance Control', group: 'Other' },
    { id: 'claims', label: 'Claims', group: 'Other' },
    { id: 'notes', label: 'Notes', group: 'Other' },
    { id: 'tasks', label: 'Tasks', group: 'Other' },
    { id: 'driver-leave', label: 'Apply Leave', group: 'Other' },
    { id: 'report-history', label: 'Reports', group: 'Other' },
    { id: 'leave-calendar', label: 'Leave Center (请假中心)', group: 'Other' },
    { id: 'sop-center', label: 'SOP Guide (SOP 指南)', group: 'Other' },
    { id: 'work-photos', label: 'Work Photos (工作记录)', group: 'Other' },
    { id: 'personal-report', label: 'Monthly Report (月度报告)', group: 'Other' },
];

const ALL_ROLES = ['SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator', 'HR', 'Operator', 'Driver'];

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
    currentUser: any;
}> = ({ emp, onClose, onSave, currentUser }) => {
    const isNew = !emp?.id;
    const isSuperAdminOrHR = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'HR';
    const [form, setForm] = useState<Partial<Employee> & { pin_input?: string }>(emp ? {
        ...emp,
        pin_input: emp.pin_code || emp.employee_id || '',
        role_modules: emp.role_modules || [],
        base_location: emp.base_location || 'Taiping'
    } : {
        role: 'Operator', pay_type: 'hourly', status: 'active',
        hourly_rate: 0, base_salary: 0, trip_allowance: 0,
        attendance_bonus: 0, attendance_bonus_threshold: 0,
        role_modules: [],
        base_location: 'Taiping'
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [newPassword, setNewPassword] = useState(''); // separate from PIN — only for Auth login password

    const set = (k: keyof Employee, v: any) => setForm(f => ({ ...f, [k]: v }));

    const staffAuthHeaders = async (): Promise<Record<string, string>> => {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
        }
        return headers;
    };

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

    const pin = (form as any).pin_input || '';

    // Auto-generate email preview for new Driver/Operator
    useEffect(() => {
        if (isNew && form.name && pin && (form.role === 'Driver' || form.role === 'Operator')) {
            const cleanName = form.name.trim().toLowerCase().replace(/\s/g, '');
            const generated = `${cleanName}.${pin}@packsecure.com`;
            if (!form.email || form.email.startsWith('emp_') || form.email.includes('@packsecure.local')) {
                setForm(f => ({ ...f, email: generated }));
            }
        }
    }, [form.name, pin, form.role, isNew]);

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
                const headers = await staffAuthHeaders();
                const res = await fetch('/api/manage-employee', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        action: 'create',
                        email: validEmail,
                        password: authPassword,
                        pin,
                        employeeId: pin,
                        name: form.name,
                        role: form.role,
                    }),
                });

                const raw = await res.text();
                let data: any = {};
                try {
                    data = raw ? JSON.parse(raw) : {};
                } catch {
                    if (raw) data.error = raw.slice(0, 300);
                }
                if (!res.ok) {
                    const hint =
                        res.status === 404
                            ? 'API route missing — run npm run dev:all locally, or redeploy with api/manage-employee on Vercel.'
                            : res.status === 500 &&
                                /misconfigured|SUPABASE_SERVICE_ROLE|SUPABASE_URL/i.test(String(data.error || ''))
                              ? 'Add SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in Vercel → Environment Variables, then Redeploy.'
                              : '';
                    setError(
                        [data.error, hint].filter(Boolean).join(' ') ||
                            `Auth API failed (HTTP ${res.status}). Run npm run dev:all locally or check Vercel env vars.`
                    );
                    setSaving(false);
                    return;
                }
                targetAuthId = data.user?.id;
                if (!targetAuthId) {
                    setError('Auth API did not return a user id.');
                    setSaving(false);
                    return;
                }
            } catch (err: any) {
                setError('API Error: ' + err.message);
                setSaving(false);
                return;
            }
        } else if (authPassword && targetAuthId) {
            try {
                const headers = await staffAuthHeaders();
                const res = await fetch('/api/manage-employee', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ action: 'update_password', targetAuthId, password: authPassword }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setError(data.error || 'Failed to update login password from PIN.');
                    setSaving(false);
                    return;
                }
            } catch (e: any) {
                setError(e.message || 'Password update failed');
                setSaving(false);
                return;
            }
        }

        if (!isNew && newPassword.trim().length >= 6 && targetAuthId) {
            try {
                const headers = await staffAuthHeaders();
                const res = await fetch('/api/manage-employee', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        action: 'update_password',
                        targetAuthId,
                        password: newPassword.trim(),
                    }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setError(data.error || 'Failed to reset login password.');
                    setSaving(false);
                    return;
                }
            } catch (e: any) {
                setError(e.message || 'Password reset failed');
                setSaving(false);
                return;
            }
        }

        const payload: any = {
            auth_user_id: targetAuthId,
            name: form.name, email: validEmail, phone: form.phone || null,
            role: form.role, status: form.status || 'active',
            role_modules: form.role_modules || []
        };

        if (isSuperAdminOrHR) {
            payload.pay_type = form.pay_type;
            payload.hourly_rate = Number(form.hourly_rate) || 0;
            payload.base_salary = Number(form.base_salary) || 0;
            payload.trip_allowance = Number(form.trip_allowance) || 0;
            payload.attendance_bonus = Number(form.attendance_bonus) || 0;
            payload.attendance_bonus_threshold = Number(form.attendance_bonus_threshold) || 0;
        }
        // Only set pin_code / employee_id when provided
        if (pin) { payload.pin_code = pin; payload.employee_id = pin; }

        const { error: err } = isNew
            ? await supabase.from('sys_users_v2').insert(payload)
            : await supabase.from('sys_users_v2').update(payload).eq('id', form.id);

        if (err) setError(err.message);
        else {
            // Sync base_location to users_public
            if (targetAuthId && form.base_location) {
                const { error: locErr } = await supabase.from('users_public')
                    .update({ base_location: form.base_location })
                    .eq('id', targetAuthId);
                if (locErr) console.warn("Failed to sync base_location to users_public:", locErr.message);
            }
            onSave();
            onClose();
        }
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
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Base Location (📍 Origin)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Taiping', 'Nilai'].map(loc => (
                                    <button
                                        key={loc}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, base_location: loc }))}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                            form.base_location === loc
                                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                : 'bg-white/5 text-gray-500 border-white/5 hover:text-white'
                                        }`}
                                    >
                                        {loc}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Pay Type */}
                    {isSuperAdminOrHR && (
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
                    )}

                    {/* Pay Fields based on type */}
                    {isSuperAdminOrHR && (
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
                    )}

                    {/* Custom Module Unlocks */}
                    {['SuperAdmin', 'Admin', 'Manager'].includes(currentUser?.role || '') && (
                        <div className="pt-4 border-t border-white/5 space-y-2">
                            <label className="block text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                                🛡️ Custom Module Unlocks (特权开通)
                            </label>
                            <p className="text-[10px] text-gray-500 leading-tight">
                                为员工开通专属页面访问权限（无需改变角色，适用于临时授权）。
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'stock-audit', label: 'Stock Audit (盘点)' },
                                    { id: 'stock-movement', label: 'Stock Move (移库)' },
                                    { id: 'inventory', label: 'Inventory (原材库存)' },
                                    { id: 'livestock', label: 'Live Stock (成品仓)' },
                                    { id: 'scanner', label: 'Scanner (生产打码)' },
                                    { id: 'machine-schedule', label: 'Machine Schedule (排产)' },
                                    { id: 'floor-plan', label: 'Floor Plan (厂房布局)' },
                                    { id: 'data-v2', label: 'Data Base (底层库)' },
                                    { id: 'order-summary', label: 'Daily Prep (生产预备)' },
                                    { id: 'delivery', label: 'Trip Admin (行政派车)' },
                                    { id: 'delivery-driver', label: 'My Delivery (司机手机端)' },
                                    { id: 'reports', label: 'Exec Reports (总报表)' },
                                    { id: 'maintenance', label: 'Maintenance (机器维修)' },
                                    { id: 'hr', label: 'HR Portal (行政人事)' },
                                    { id: 'leave-calendar', label: 'Leave Center (请假中心)' },
                                    { id: 'sop-center', label: 'SOP Guide (SOP 指南)' },
                                    { id: 'work-photos', label: 'Work Photos (工作记录)' },
                                    { id: 'personal-report', label: 'Monthly Report (月度报告)' },
                                    { id: 'activity-logs', label: 'Activity Logs (操作日志)' },
                                    { id: 'dev-log', label: 'Dev Log (开发日志)' }
                                ].map(mod => {
                                    const roleModules = form.role_modules || [];
                                    const isEnabled = roleModules.includes(mod.id);
                                    return (
                                        <button
                                            key={mod.id}
                                            type="button"
                                            onClick={() => {
                                                const newMods = isEnabled 
                                                    ? roleModules.filter(m => m !== mod.id)
                                                    : [...roleModules, mod.id];
                                                setForm(f => ({ ...f, role_modules: newMods }));
                                            }}
                                            className={`px-2 py-2 rounded-xl text-left text-xs font-bold transition-all border flex items-center justify-between ${
                                                isEnabled 
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                    : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
                                            }`}
                                        >
                                            <span className="truncate">{mod.label}</span>
                                            {isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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
interface HRPortalProps {
    user?: any;
    initialTab?: 'personnel' | 'permissions' | 'payroll' | 'advances';
    initialRoleFilter?: string;
}

const HRPortal: React.FC<HRPortalProps> = ({ user, initialTab, initialRoleFilter }) => {
    const isSuperAdminOrHR = user?.role === 'SuperAdmin' || user?.role === 'HR';
    const [activeTab, setActiveTab] = useState<'personnel' | 'permissions' | 'payroll' | 'advances'>(
        (initialTab && (initialTab !== 'payroll' && initialTab !== 'advances' || isSuperAdminOrHR)) 
            ? initialTab 
            : 'personnel'
    );
    const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter || 'All');

    // Sync tab/filter if redirect parameters change
    useEffect(() => {
        if (initialTab) {
            if (initialTab === 'payroll' || initialTab === 'advances') {
                if (isSuperAdminOrHR) setActiveTab(initialTab);
            } else {
                setActiveTab(initialTab);
            }
        }
    }, [initialTab, isSuperAdminOrHR]);

    useEffect(() => {
        if (initialRoleFilter) setRoleFilter(initialRoleFilter);
    }, [initialRoleFilter]);

    // Personnel
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loadingEmp, setLoadingEmp] = useState(true);
    const [editingEmp, setEditingEmp] = useState<Partial<Employee> | null | 'new'>(null);
    const [empSearch, setEmpSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

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
        // Fetch core data from sys_users_v2
        const { data: v2Data } = await supabase.from('sys_users_v2')
            .select('id, auth_user_id, employee_id, pin_code, name, email, phone, role, status, pay_type, hourly_rate, base_salary, trip_allowance, attendance_bonus, attendance_bonus_threshold, role_modules')
            .order('name');

        // Fetch base_location from users_public
        const { data: pubData } = await supabase.from('users_public')
            .select('id, base_location');

        if (v2Data) {
            const locationMap = new Map(pubData?.map(p => [p.id, p.base_location]) || []);
            const merged: Employee[] = v2Data.map(emp => ({
                ...emp,
                base_location: locationMap.get(emp.auth_user_id) || 'Taiping'
            }));
            setEmployees(merged);
        } else {
            setEmployees([]);
        }
        setLoadingEmp(false);
    }, []);

    const handleDeleteEmployee = async (emp: Employee) => {
        if (!emp) return;
        const confirmMsg = `确认要彻底删除员工「${emp.name}」吗？\n\n警告：此操作将从系统 Auth、员工记录、请假历史、薪资记录中彻底清除该账户，且不可撤销！`;
        if (!window.confirm(confirmMsg)) return;

        setDeletingId(emp.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const res = await fetch('/api/manage-employee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    action: 'delete',
                    uid: emp.auth_user_id || emp.id,
                    rowId: emp.id,
                    isDriver: emp.role === 'Driver'
                })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to delete employee');

            alert('✅ 员工账户已成功删除！');
            fetchEmployees();
        } catch (err: any) {
            console.error('Delete employee error:', err);
            alert('❌ 删除失败: ' + err.message);
        } finally {
            setDeletingId(null);
        }
    };

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

    // ── Salary Advances State & Functions ──────────────────────
    const [salaryAdvances, setSalaryAdvances] = useState<any[]>([]);
    const [loadingAdvances, setLoadingAdvances] = useState(false);
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchSalaryAdvances = useCallback(async () => {
        setLoadingAdvances(true);
        try {
            const data = await getSalaryAdvances();
            setSalaryAdvances(data);
        } catch (err) {
            console.error("Failed to fetch salary advances:", err);
        } finally {
            setLoadingAdvances(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'advances') {
            fetchSalaryAdvances();
        }
    }, [activeTab, fetchSalaryAdvances]);

    const handleApproveAdvance = async (id: string) => {
        if (!window.confirm("Approve this salary advance request? (确认批准该预支薪资申请？)")) return;
        const success = await updateSalaryAdvanceStatus(id, 'Approved');
        if (success) {
            alert("✅ Advance request approved!");
            fetchSalaryAdvances();
        } else {
            alert("❌ Failed to update status.");
        }
    };

    const handleMarkAsPaid = async (id: string) => {
        if (!window.confirm("Mark this advance as PAID (Bank-in completed)? (确认已打款给司机？)")) return;
        const success = await updateSalaryAdvanceStatus(id, 'Paid');
        if (success) {
            alert("✅ Advance marked as PAID!");
            fetchSalaryAdvances();
        } else {
            alert(
                "❌ Failed to mark as PAID.\n\n" +
                "This is likely because the database constraint hasn't been updated yet to support the 'Paid' status.\n\n" +
                "Please run this SQL in your Supabase Dashboard SQL Editor:\n\n" +
                "ALTER TABLE public.salary_advances DROP CONSTRAINT IF EXISTS salary_advances_status_check;\n" +
                "ALTER TABLE public.salary_advances ADD CONSTRAINT salary_advances_status_check CHECK (status IN ('Pending', 'Approved', 'Paid', 'Rejected'));"
            );
        }
    };

    const handleRejectAdvance = async () => {
        if (!selectedAdvanceId || !rejectionReason.trim()) return;
        const success = await updateSalaryAdvanceStatus(selectedAdvanceId, 'Rejected', rejectionReason.trim());
        if (success) {
            alert("❌ Advance request rejected.");
            setIsRejectionModalOpen(false);
            setSelectedAdvanceId(null);
            setRejectionReason('');
            fetchSalaryAdvances();
        } else {
            alert("❌ Failed to reject request.");
        }
    };

    const handleExportAdvances = () => {
        if (salaryAdvances.length === 0) {
            alert("Tiada rekod untuk dieksport. / No records to export.");
            return;
        }

        const headers = ["Driver Name", "Driver PIN", "Request Date", "Target Bank-In Date", "Amount (RM)", "Status", "Notes/Rejection Reason"];

        const rows = salaryAdvances.map(adv => [
            adv.employee?.name || 'Unknown User',
            adv.employee?.employee_id || 'N/A',
            new Date(adv.created_at).toLocaleDateString('en-GB'),
            formatCSVDate(adv.bank_in_date),
            Number(adv.amount).toFixed(2),
            adv.status,
            adv.rejection_reason || adv.notes || ''
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Salary_Advances_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ── Payroll ──────────────────────────────────────────────
    const fetchPayroll = useCallback(async () => {

        setLoadingPayroll(true);
        const firstDay = `${payYear}-${String(payMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(payYear, payMonth, 0).toISOString().split('T')[0];

        // Employees
        const { data: emps } = await supabase.from('sys_users_v2')
            .select('id, auth_user_id, employee_id, name, role, pay_type, hourly_rate, base_salary, trip_allowance, attendance_bonus, attendance_bonus_threshold')
            .eq('status', 'Active').order('name');

        // Attendance hours for operators
        const { data: attendance } = await supabase.from('operator_attendance')
            .select('operator_id, hours_worked, date')
            .gte('date', firstDay).lte('date', lastDay);

        // Driver trips with zone info for zone-based allowance
        const { data: trips } = await supabase.from('sales_orders')
            .select('driver_id, zone, trip_origin, trip_drop_count')
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

        // Fetch approved or paid advances for the month
        const { data: approvedAdvances } = await supabase.from('salary_advances')
            .select('employee_id, amount, bank_in_date')
            .in('status', ['Approved', 'Paid'])
            .gte('bank_in_date', firstDay).lte('bank_in_date', lastDay);

        const advancesMap: Record<string, { total: number; details: string[] }> = {};
        (approvedAdvances || []).forEach((adv: any) => {
            const empId = adv.employee_id;
            if (!advancesMap[empId]) {
                advancesMap[empId] = { total: 0, details: [] };
            }
            const dateStr = formatDDMon(adv.bank_in_date);
            advancesMap[empId].total += Number(adv.amount);
            advancesMap[empId].details.push(`RM${Number(adv.amount)} (${dateStr})`);
        });

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
            const absentDays = leaveMap[emp.auth_user_id] || 0;
            const advanceData = advancesMap[emp.auth_user_id] || { total: 0, details: [] };
            const advanceDeduction = advanceData.total;

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
            const net = gross + bonusAmt - advanceDeduction;

            let detailsWithDeductions = details;
            if (advanceDeduction > 0) {
                detailsWithDeductions += ` | Deduct Advance: -RM${advanceDeduction.toFixed(2)} (${advanceData.details.join(', ')})`;
            }

            return {
                emp, gross, details: detailsWithDeductions, hoursWorked,
                tripCount: tripData.count, tripBreakdown: tripData.breakdown, absentDays,
                bonusAmt, earnedBonus, net,
                advanceDeduction,
                deductionsDetail: advanceDeduction > 0 ? `Advances: ${advanceData.details.join(', ')}` : '',
                existing: existingMap[emp.auth_user_id] || null,
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
            employee_id: r.emp.auth_user_id, // Fix Bug: use auth_user_id (UUID) instead of employee_id (string PIN)
            month: payMonth, year: payYear,
            base_salary: r.gross,
            attendance_bonus: r.bonusAmt,
            net_salary: r.net,
            leave_days_unpaid: 0,
            deduction: r.advanceDeduction || 0, // Populate deductions from advances
            notes: r.deductionsDetail || null, // Deductions description
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

    const isLogisticsCoordinator = user?.role === 'LogisticsCoordinator';
    const effectiveRoleFilter = isLogisticsCoordinator ? 'Driver' : roleFilter;

    const filteredEmps = employees.filter(e => {
        const matchesSearch = !empSearch || 
            e.name?.toLowerCase().includes(empSearch.toLowerCase()) ||
            e.role?.toLowerCase().includes(empSearch.toLowerCase()) ||
            e.employee_id?.toLowerCase().includes(empSearch.toLowerCase());
        
        const matchesRole = effectiveRoleFilter === 'All' || e.role === effectiveRoleFilter;
        
        return matchesSearch && matchesRole;
    });

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
        { id: 'advances', label: '💸 Salary Advances' },
    ] as const;

    const visibleTabs = TABS.filter(tab => {
        if (isLogisticsCoordinator) {
            return tab.id === 'personnel';
        }
        if (user?.role === 'HR') {
            return tab.id !== 'permissions';
        }
        if (tab.id === 'payroll' || tab.id === 'advances') {
            return isSuperAdminOrHR;
        }
        return true;
    });


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
                {visibleTabs.map(tab => (
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
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            <input type="text" value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                                placeholder="Search name, role, ID..."
                                className="w-64 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                            {!isLogisticsCoordinator && (
                                <select
                                    value={roleFilter}
                                    onChange={e => setRoleFilter(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="All">All Roles</option>
                                    <option value="SuperAdmin">SuperAdmin</option>
                                    <option value="Admin">Admin</option>
                                    <option value="Manager">Manager</option>
                                    <option value="LogisticsCoordinator">LogisticsCoordinator</option>
                                    <option value="HR">HR</option>
                                    <option value="Operator">Operator</option>
                                    <option value="Driver">Driver</option>
                                </select>
                            )}
                            {isLogisticsCoordinator && (
                                <span className="text-xs text-gray-500 border border-white/5 bg-white/2 px-3 py-2 rounded-xl">
                                    Locked to Driver role
                                </span>
                            )}
                        </div>
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
                                        {(isSuperAdminOrHR 
                                            ? ['Employee', 'Role', 'Pay Type', 'Rate / Salary', '全勤奖', 'Status', '']
                                            : ['Employee', 'Role', 'Status', '']
                                        ).map(h => (
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
                                            {isSuperAdminOrHR && (
                                                <>
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
                                                </>
                                            )}
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${emp.status === 'active' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => setEditingEmp(emp)}
                                                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                        title="Edit details">
                                                        <Edit2 size={13} />
                                                    </button>
                                                    {['SuperAdmin', 'Admin', 'Manager'].includes(user?.role || '') && (
                                                        <button 
                                                            onClick={() => handleDeleteEmployee(emp)}
                                                            disabled={deletingId === emp.id}
                                                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 disabled:opacity-50 transition-colors"
                                                            title="Delete employee">
                                                            {deletingId === emp.id ? (
                                                                <Loader size={13} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={13} />
                                                            )}
                                                        </button>
                                                    )}
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

            {/* ── SALARY ADVANCES ── */}
            {activeTab === 'advances' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-white uppercase tracking-wider">Driver Salary Advances</h2>
                            <p className="text-xs text-slate-500 mt-1">Review pending requests and manage historic advance payouts.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleExportAdvances}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/20"
                            >
                                <Download size={14} /> Export to Excel
                            </button>
                            <button 
                                onClick={fetchSalaryAdvances}
                                disabled={loadingAdvances}
                                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-blue-400 border border-white/5 active:scale-95 transition-all"
                            >
                                <RefreshCw size={14} className={loadingAdvances ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {loadingAdvances ? (
                        <div className="flex justify-center py-20"><Loader className="animate-spin text-amber-500" size={28} /></div>
                    ) : salaryAdvances.length === 0 ? (
                        <div className="text-center py-20 text-gray-600 border border-dashed border-white/5 rounded-2xl">
                            <DollarSign size={36} className="mx-auto mb-3 opacity-30" />
                            <p>No salary advance requests found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-white/5">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="bg-white/[0.03] text-gray-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                                        <th className="px-4 py-3 font-bold">Driver (Name / PIN)</th>
                                        <th className="px-4 py-3 font-bold">Request Date</th>
                                        <th className="px-4 py-3 font-bold">Target Bank-In Date</th>
                                        <th className="px-4 py-3 font-bold">Amount (RM)</th>
                                        <th className="px-4 py-3 font-bold">Status</th>
                                        <th className="px-4 py-3 font-bold">Notes / Rejection Reason</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {salaryAdvances.map(adv => (
                                        <tr key={adv.id} className="hover:bg-white/[0.01] transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-white text-sm">{adv.employee?.name || 'Unknown User'}</div>
                                                <div className="text-[10px] text-gray-600 font-mono">PIN: {adv.employee?.employee_id || 'N/A'}</div>
                                            </td>
                                            <td className="px-4 py-4 text-xs text-gray-400">
                                                {new Date(adv.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-4 text-xs font-bold text-zinc-300">
                                                {formatYYYYMMDD(adv.bank_in_date)}
                                            </td>
                                            <td className="px-4 py-4 font-mono font-bold text-white">
                                                RM {Number(adv.amount).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                                                    adv.status === 'Paid' ? 'border-green-500/20 bg-green-500/10 text-green-400' :
                                                    adv.status === 'Approved' ? 'border-blue-500/20 bg-blue-500/10 text-blue-400' :
                                                    adv.status === 'Rejected' ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                                                    'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'
                                                }`}>
                                                    {adv.status === 'Paid' ? 'Paid' :
                                                     adv.status === 'Approved' ? 'Approved / Unpaid' :
                                                     adv.status === 'Rejected' ? 'Rejected' :
                                                     'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-xs text-gray-500 max-w-[350px] break-words whitespace-pre-wrap">
                                                {adv.status === 'Rejected' && adv.rejection_reason ? (
                                                    <span className="text-red-400 font-medium">❌ Reason: {adv.rejection_reason}</span>
                                                ) : (
                                                    adv.notes || '-'
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {adv.status === 'Pending' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleApproveAdvance(adv.id)}
                                                            className="px-3 py-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                            title="Approve"
                                                        >
                                                            <Check size={14} /> Approve
                                                        </button>
                                                        <button 
                                                            onClick={() => { setSelectedAdvanceId(adv.id); setIsRejectionModalOpen(true); }}
                                                            className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                            title="Reject"
                                                        >
                                                            <X size={14} /> Reject
                                                        </button>
                                                    </div>
                                                )}
                                                {adv.status === 'Approved' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleMarkAsPaid(adv.id)}
                                                            className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                            title="Mark as Paid"
                                                        >
                                                            <DollarSign size={14} /> Mark as Paid
                                                        </button>
                                                        <button 
                                                            onClick={() => { setSelectedAdvanceId(adv.id); setIsRejectionModalOpen(true); }}
                                                            className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                            title="Reject"
                                                        >
                                                            <X size={14} /> Reject
                                                        </button>
                                                    </div>
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

            {/* Rejection Reason Modal */}
            {isRejectionModalOpen && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0d0d12] border border-red-500/30 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
                        <div className="p-6 flex flex-col gap-4">
                            <button 
                                onClick={() => { setIsRejectionModalOpen(false); setSelectedAdvanceId(null); setRejectionReason(''); }} 
                                className="absolute top-4 right-4 p-2 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-colors"
                            >
                                <X size={16} />
                            </button>
                            <h3 className="text-sm font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                ❌ Reject Salary Advance Request
                            </h3>
                            <div>
                                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5">REJECTION REASON / 拒绝原因</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={e => setRejectionReason(e.target.value)}
                                    placeholder="Enter the reason why this advance request is rejected..."
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 resize-none h-24 transition-colors"
                                />
                            </div>
                            <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-white/5">
                                <button 
                                    onClick={() => { setIsRejectionModalOpen(false); setSelectedAdvanceId(null); setRejectionReason(''); }} 
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleRejectAdvance} 
                                    disabled={!rejectionReason.trim()}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-500/20"
                                >
                                    Confirm Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Employee Edit Modal */}

            {editingEmp !== null && (
                <EmployeeModal
                    emp={editingEmp === 'new' ? null : editingEmp}
                    onClose={() => setEditingEmp(null)}
                    onSave={fetchEmployees}
                    currentUser={user}
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
