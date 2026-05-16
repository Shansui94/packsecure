import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { UserPlus, Users, Copy, Check, X, Truck, BadgeCheck, Trash2, AlertTriangle } from 'lucide-react';

interface DriverManagementProps {
    currentUser: User | null;
}

interface DriverProfile {
    id: string;
    name: string;
    email: string;
    employee_id: string;
    status: string;
}

interface NewDriverResult {
    uid: string;
    name: string;
    email: string;
    employeeId: string;
    password: string;
}

const DriverManagement: React.FC<DriverManagementProps> = (_props) => {
    const [drivers, setDrivers] = useState<DriverProfile[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newDriver, setNewDriver] = useState<NewDriverResult | null>(null);
    const [error, setError] = useState('');

    // Form
    const [formName, setFormName] = useState('');
    const [formId, setFormId] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DriverProfile | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const fetchDrivers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('users_public')
            .select('id, name, email, employee_id, status')
            .eq('role', 'Driver')
            .order('name', { ascending: true });

        if (data) setDrivers(data);
        if (error) console.error('Fetch drivers error:', error);
        setLoading(false);
    };

    useEffect(() => {
        fetchDrivers();

        const channel = supabase.channel('driver-mgmt-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users_public' }, fetchDrivers)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const openModal = () => {
        setFormName('');
        setFormId('');
        setError('');
        setNewDriver(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setNewDriver(null);
        setError('');
    };

    const handleSubmit = async () => {
        if (!formName.trim() || !formId.trim()) {
            setError('请填写司机姓名和 4 位员工编号。');
            return;
        }
        const pin = formId.replace(/\D/g, '');
        if (pin.length !== 4) {
            setError('员工编号必须为 4 位数字（即登录 PIN）。');
            return;
        }
        setIsSubmitting(true);
        setError('');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const res = await fetch('/api/create-driver', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    name: formName.trim(),
                    employeeId: pin,
                })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to create driver');

            setNewDriver({
                uid: json.driver.uid,
                name: json.driver.name,
                email: json.driver.email,
                employeeId: json.driver.employeeId,
                password: json.driver.pin || pin,
            });
            fetchDrivers(); // Refresh list

        } catch (e: any) {
            setError(e.message || 'An error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        setDeleteError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const res = await fetch('/api/delete-driver', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ uid: deleteTarget.id })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to delete driver');

            setDeleteTarget(null);
            fetchDrivers();
        } catch (e: any) {
            setDeleteError(e.message || 'An error occurred.');
        } finally {
            setIsDeleting(false);
        }
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const previewEmail = formName && formId
        ? `${formName.trim().toLowerCase().replace(/\s/g, '')}.${formId.trim()}@packsecure.com`
        : '';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Truck className="text-yellow-400" /> Driver Management
                </h2>
                <button
                    onClick={openModal}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg shadow-lg shadow-yellow-500/20 transition-all hover:scale-105 active:scale-95"
                >
                    <UserPlus className="w-4 h-4" />
                    Add Driver
                </button>
            </div>

            {/* Driver List */}
            {loading ? (
                <div className="text-gray-400 text-center py-16 animate-pulse">Loading drivers...</div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
                                <th className="p-4 border-b border-gray-700">Driver</th>
                                <th className="p-4 border-b border-gray-700">Employee ID</th>
                                <th className="p-4 border-b border-gray-700">Login Email</th>
                                <th className="p-4 border-b border-gray-700">Status</th>
                                <th className="p-4 border-b border-gray-700 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {drivers.map(d => (
                                <tr key={d.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 border-b border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 font-bold text-sm">
                                                {(d.name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-white">{d.name || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 border-b border-gray-800 font-mono text-sm text-gray-300">
                                        {d.employee_id || '—'}
                                    </td>
                                    <td className="p-4 border-b border-gray-800 text-sm text-gray-400 font-mono">
                                        {d.email}
                                    </td>
                                    <td className="p-4 border-b border-gray-800">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${d.status === 'Active'
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                            }`}>
                                            {d.status || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="p-4 border-b border-gray-800 text-right">
                                        <button
                                            onClick={() => { setDeleteTarget(d); setDeleteError(''); }}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Delete Driver"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {drivers.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>No drivers found. Click "Add Driver" to get started.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ADD DRIVER MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

                        {/* Modal Header */}
                        <div className="bg-gray-800/50 p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-yellow-400" />
                                {newDriver ? '✅ Driver Created!' : 'Add New Driver'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {!newDriver ? (
                                // --- FORM ---
                                <div className="space-y-4">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">Driver Name <span className="text-red-400">*</span></label>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            placeholder="e.g. Ahmad Faizal"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-yellow-500 focus:outline-none transition-colors"
                                        />
                                    </div>

                                    {/* Employee ID */}
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">4-Digit Employee ID / PIN <span className="text-red-400">*</span></label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={4}
                                            value={formId}
                                            onChange={e => setFormId(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                            placeholder="e.g. 5563"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white font-mono focus:border-yellow-500 focus:outline-none transition-colors"
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5">
                                            Staff portal login: 4-digit ID + same 4-digit PIN (company policy).
                                        </p>
                                    </div>

                                    {/* Email Preview */}
                                    {previewEmail && (
                                        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                                            <p className="text-xs text-gray-500 mb-1">Login email will be:</p>
                                            <p className="text-yellow-400 font-mono text-sm">{previewEmail}</p>
                                        </div>
                                    )}

                                    {/* Error */}
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                                            {error}
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <><UserPlus className="w-4 h-4" /> Create Driver</>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                // --- SUCCESS CARD ---
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                        <BadgeCheck className="w-8 h-8 text-green-400 flex-shrink-0" />
                                        <div>
                                            <p className="text-white font-semibold">{newDriver.name}</p>
                                            <p className="text-gray-400 text-sm">Driver account created successfully</p>
                                        </div>
                                    </div>

                                    <p className="text-gray-400 text-sm font-medium">Driver Login Credentials — share securely:</p>

                                    {/* Email */}
                                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex justify-between items-center">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Email</p>
                                            <p className="text-yellow-400 font-mono text-sm">{newDriver.email}</p>
                                        </div>
                                        <button onClick={() => copyToClipboard(newDriver.email, 'email')} className="text-gray-400 hover:text-white transition-colors p-1">
                                            {copied === 'email' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Password */}
                                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex justify-between items-center">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">4-Digit Login PIN</p>
                                            <p className="text-white font-mono text-lg font-bold tracking-widest">{newDriver.password}</p>
                                        </div>
                                        <button onClick={() => copyToClipboard(newDriver.password, 'pw')} className="text-gray-400 hover:text-white transition-colors p-1">
                                            {copied === 'pw' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Employee ID */}
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                                        <p className="text-xs text-gray-500 mb-0.5">Employee ID</p>
                                        <p className="text-gray-300 font-mono">{newDriver.employeeId}</p>
                                    </div>

                                    <button
                                        onClick={closeModal}
                                        className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                                    >
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-red-500/30 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400" /> Delete Driver
                            </h3>
                            <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-300 text-sm">
                                确认删除司机 <span className="text-white font-bold">{deleteTarget.name}</span>？
                            </p>
                            <div className="bg-gray-800 rounded-lg p-3 text-sm font-mono text-gray-400">
                                <div>{deleteTarget.email}</div>
                                <div className="text-gray-500 text-xs mt-1">ID: {deleteTarget.employee_id}</div>
                            </div>
                            <p className="text-red-400 text-xs">⚠ 此操作将永久删除账号，无法撤销。</p>
                            {deleteError && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{deleteError}</div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-bold flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? (
                                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 删除中...</>
                                    ) : (
                                        <><Trash2 className="w-4 h-4" /> 确认删除</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverManagement;
