import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User, UserRole } from '../types';
import { Users, Shield, Search, Mail, Edit2, Phone, DollarSign, X, Save } from 'lucide-react';

interface UserManagementProps {
    currentUser: User | null;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        role: 'Operator' as UserRole,
        phone: '',
        salary: 0,
        roleModules: [] as string[]
    });
    const [isFetchingModules, setIsFetchingModules] = useState(false);

    // Subscribe to Users
    useEffect(() => {
        const fetchUsers = async () => {
            const { data, error } = await supabase
                .from('users_public')
                .select('*');

            if (error) {
                console.error("Error fetching users:", error);
                setLoading(false);
                return;
            }

            if (data) {
                const mappedUsers: User[] = data.map(u => ({
                    uid: u.id,
                    email: u.email,
                    role: u.role as UserRole,
                    name: u.name || undefined,
                    phone: u.phone || undefined,
                    salary: u.salary || 0,
                    status: u.status as any, // 'Active' | 'Pending' etc
                    employeeId: u.employee_id || undefined
                }));
                setUsers(mappedUsers);
                setLoading(false);
            }
        };

        fetchUsers();

        // Realtime Subscription
        const channel = supabase.channel('users-list-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users_public' }, fetchUsers)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const openEditModal = async (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name || '',
            role: user.role || 'Operator',
            phone: user.phone || '',
            salary: user.salary || 0,
            roleModules: []
        });
        setIsModalOpen(true);
        setIsFetchingModules(true);
        
        // Fetch specific role_modules from sys_users_v2
        const { data } = await supabase.from('sys_users_v2').select('role_modules').eq('auth_user_id', user.uid).maybeSingle();
        if (data && data.role_modules) {
            setFormData(prev => ({ ...prev, roleModules: data.role_modules }));
        }
        setIsFetchingModules(false);
    };

    const closeEditModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;

        try {
            // Update Public profile
            const { error } = await supabase
                .from('users_public')
                .update({
                    name: formData.name,
                    role: formData.role,
                    phone: formData.phone,
                    salary: Number(formData.salary)
                })
                .eq('id', editingUser.uid);

            if (error) throw error;

            // Sync role_modules back to sys_users_v2
            const { data: existV2 } = await supabase.from('sys_users_v2').select('id').eq('auth_user_id', editingUser.uid).maybeSingle();
            if (existV2) {
                await supabase.from('sys_users_v2').update({ role_modules: formData.roleModules }).eq('auth_user_id', editingUser.uid);
            }

            console.log(`Updated profile for ${editingUser.uid}`);
            closeEditModal();
            alert("User updated successfully!");
        } catch (error: any) {
            console.error("Error updating user:", error);
            alert("Failed to update user: " + error.message);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const roles: UserRole[] = ['Admin', 'Manager', 'Operator', 'Driver', 'HR'];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Users className="text-blue-400" /> User Management
                </h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 w-64"
                    />
                </div>
            </div>

            {/* Content Table */}
            {loading ? (
                <div className="text-white text-center py-10">Loading users...</div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
                                <th className="p-4 border-b border-gray-700">User</th>
                                <th className="p-4 border-b border-gray-700">Contact</th>
                                <th className="p-4 border-b border-gray-700">Role</th>
                                <th className="p-4 border-b border-gray-700">Salary (Admin)</th>
                                <th className="p-4 border-b border-gray-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {filteredUsers.map(user => (
                                <tr key={user.uid} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 border-b border-gray-800">
                                        <div className="font-medium text-white">
                                            {user.name || user.email?.split('@')[0] || `User ${user.uid.slice(0, 5)}`}
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono">{user.uid}</div>
                                    </td>
                                    <td className="p-4 border-b border-gray-800">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail className="w-3 h-3 text-gray-500" />
                                                {user.email}
                                            </div>
                                            {user.phone && (
                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <Phone className="w-3 h-3" />
                                                    {user.phone}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 border-b border-gray-800">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border
                                            ${user.role === 'Admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                user.role === 'Manager' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    user.role === 'HR' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                                                        user.role === 'Driver' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}
                                        >
                                            <div className="flex items-center gap-1">
                                                <Shield className="w-3 h-3" />
                                                {user.role}
                                            </div>
                                        </span>
                                    </td>
                                    <td className="p-4 border-b border-gray-800 font-mono text-green-400">
                                        {user.salary ? `$${user.salary.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="p-4 border-b border-gray-800 text-right">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded transition-colors flex items-center gap-2 ml-auto"
                                        >
                                            <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No users found matching "{searchTerm}"
                        </div>
                    )}
                </div>
            )}

            {/* EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="bg-gray-800/50 p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-blue-400" /> Edit User
                            </h3>
                            <button onClick={closeEditModal} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Phone</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
                                    placeholder="+60..."
                                />
                            </div>

                            {/* Role (Radio/Select) */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Role Permissions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {roles.map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setFormData({ ...formData, role: r })}
                                            className={`px-3 py-2 rounded text-sm text-center border transition-all ${formData.role === r
                                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Salary (Sensitive) */}
                            <div>
                                <label className="block text-red-300 text-sm mb-1 font-bold flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Monthly Salary (Admin Only)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        value={formData.salary}
                                        onChange={e => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-gray-900 border border-red-500/30 rounded p-2 pl-7 text-green-400 font-mono focus:border-red-500 focus:outline-none"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Visible only to Admins. Protected by Firestore Rules.</p>
                            </div>

                            {/* Custom Module Unlocks */}
                            <div className="pt-2 border-t border-gray-700/50">
                                <label className="block text-emerald-400 text-sm mb-2 font-bold flex items-center gap-1">
                                    🛡️ Custom Module Unlocks (特权开通)
                                </label>
                                <p className="text-[10px] text-gray-400 mb-3 leading-tight">
                                    Assign specific page access regardless of the user's primary Role. Great for giving Operators temporary audit powers.
                                </p>
                                
                                {isFetchingModules ? (
                                    <div className="text-xs text-blue-400 animate-pulse">Scanning core system permissions...</div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'stock-audit', label: 'Stock Audit (盘点)' },
                                            { id: 'stock-movement', label: 'Stock Move (移库)' },
                                            { id: 'inventory', label: 'Inventory (原材库存)' },
                                            { id: 'livestock', label: 'Live Stock (成品仓)' },
                                            { id: 'scanner', label: 'Scanner (生产打码)' },
                                            { id: 'machine-schedule', label: 'Machine Schedule (排产)' },
                                            { id: 'data-v2', label: 'Data Base (底层库)' },
                                            { id: 'order-summary', label: 'Daily Prep (生产预备)' },
                                            { id: 'delivery', label: 'Trip Admin (行政派车)' },
                                            { id: 'delivery-driver', label: 'My Delivery (司机手机端)' },
                                            { id: 'reports', label: 'Exec Reports (总报表)' },
                                            { id: 'maintenance', label: 'Maintenance (机器维修)' },
                                            { id: 'hr', label: 'HR Portal (行政人事)' }
                                        ].map(mod => {
                                            const isEnabled = formData.roleModules.includes(mod.id);
                                            return (
                                                <button
                                                    key={mod.id}
                                                    onClick={() => {
                                                        const newMods = isEnabled 
                                                            ? formData.roleModules.filter(m => m !== mod.id)
                                                            : [...formData.roleModules, mod.id];
                                                        setFormData({ ...formData, roleModules: newMods });
                                                    }}
                                                    className={`px-2 py-2 rounded text-left text-xs font-bold transition-all border flex items-center justify-between ${
                                                        isEnabled 
                                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                            : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                                                    }`}
                                                >
                                                    <span className="truncate">{mod.label}</span>
                                                    {isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={closeEditModal}
                                className="px-4 py-2 rounded text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveUser}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg shadow-blue-600/20 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Tools Hidden/Removed (No longer using Firestore Migration) */}
            {currentUser?.role === 'Admin' && (
                <div className="mt-8 pt-8 border-t border-gray-700">
                    <p className="text-gray-500 text-sm">System running on Supabase (All-in).</p>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
