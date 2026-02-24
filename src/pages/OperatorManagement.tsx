import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Users, Plus, Trash2, Edit2, Check, X, RefreshCw, ShieldCheck } from 'lucide-react';

interface Operator {
    id: string;
    name: string;
    employee_id: string;
    status: string;
}

const OperatorManagement: React.FC = () => {
    const [operators, setOperators] = useState<Operator[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Add form state
    const [newName, setNewName] = useState('');
    const [newEmpId, setNewEmpId] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const fetchOperators = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: err } = await supabase
            .from('sys_users_v2')
            .select('id, name, employee_id, status')
            .eq('role', 'Operator')
            .order('employee_id');

        if (err) { setError(err.message); }
        else { setOperators(data || []); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchOperators(); }, [fetchOperators]);

    const handleAdd = async () => {
        if (!newName.trim() || !newEmpId.trim()) {
            setError('姓名和工号不能为空');
            return;
        }
        if (!/^\d{4}$/.test(newEmpId)) {
            setError('工号必须是 4 位数字（如 0024）');
            return;
        }
        setSaving(true);
        setError(null);
        const { error: err } = await supabase.from('sys_users_v2').insert({
            name: newName.trim(),
            employee_id: newEmpId.trim(),
            role: 'Operator',
            status: 'Active',
            pin_code: newEmpId.trim(), // 兼容旧逻辑
        });
        if (err) { setError(err.message); }
        else {
            setNewName('');
            setNewEmpId('');
            setShowAddForm(false);
            fetchOperators();
        }
        setSaving(false);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`确认删除操作员「${name}」？此操作不可撤销。`)) return;
        const { error: err } = await supabase.from('sys_users_v2').delete().eq('id', id);
        if (err) { setError(err.message); }
        else { fetchOperators(); }
    };

    const handleEditSave = async (id: string) => {
        if (!editName.trim()) return;
        setSaving(true);
        const { error: err } = await supabase
            .from('sys_users_v2')
            .update({ name: editName.trim() })
            .eq('id', id);
        if (err) { setError(err.message); }
        else { setEditingId(null); fetchOperators(); }
        setSaving(false);
    };

    const handleToggleStatus = async (op: Operator) => {
        const newStatus = op.status === 'Active' ? 'Inactive' : 'Active';
        const { error: err } = await supabase
            .from('sys_users_v2')
            .update({ status: newStatus })
            .eq('id', op.id);
        if (err) { setError(err.message); }
        else { fetchOperators(); }
    };

    return (
        <div className="min-h-screen bg-[#0d0d14] text-white p-6">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                            <Users size={20} className="text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">操作员管理</h1>
                            <p className="text-xs text-gray-500">使用 4 位工号登录生产系统</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchOperators} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                            <RefreshCw size={16} />
                        </button>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-all"
                        >
                            <Plus size={16} />新增操作员
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X size={14} /></button>
                    </div>
                )}

                {/* Add Form */}
                {showAddForm && (
                    <div className="mb-6 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-5">
                        <h3 className="text-sm font-bold text-cyan-400 mb-4 uppercase tracking-widest">新增操作员</h3>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">姓名</label>
                                <input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="如: Ah Kow"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">工号（4位数字）</label>
                                <input
                                    value={newEmpId}
                                    onChange={e => setNewEmpId(e.target.value)}
                                    placeholder="如: 0024"
                                    maxLength={4}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-cyan-500/50"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setShowAddForm(false); setError(null); }} className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-sm hover:bg-white/10 transition-all">取消</button>
                            <button
                                onClick={handleAdd}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <Check size={14} />{saving ? '保存中...' : '确认新增'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Operator List */}
                <div className="bg-[#13131a] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                        <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">操作员列表</span>
                        <span className="text-xs text-gray-600 font-mono">{operators.length} 人</span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                        </div>
                    ) : operators.length === 0 ? (
                        <div className="text-center text-gray-600 py-12 text-sm">暂无操作员</div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {operators.map(op => (
                                <div key={op.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-all">
                                    {/* ID Badge */}
                                    <div className="w-14 text-center">
                                        <span className="font-mono text-sm font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-lg">{op.employee_id}</span>
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1">
                                        {editingId === op.id ? (
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleEditSave(op.id)}
                                                className="bg-black/40 border border-cyan-500/40 rounded-lg px-2 py-1 text-sm text-white w-full focus:outline-none"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="text-sm font-semibold text-white">{op.name || '—'}</span>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <button
                                        onClick={() => handleToggleStatus(op)}
                                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-all ${op.status === 'Active'
                                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400'
                                            : 'bg-gray-500/10 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400'
                                            }`}
                                    >
                                        <ShieldCheck size={10} />
                                        {op.status === 'Active' ? '启用' : '停用'}
                                    </button>

                                    {/* Actions */}
                                    <div className="flex gap-1">
                                        {editingId === op.id ? (
                                            <>
                                                <button onClick={() => handleEditSave(op.id)} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all">
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-all">
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => { setEditingId(op.id); setEditName(op.name || ''); }}
                                                    className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-cyan-500/20 hover:text-cyan-400 transition-all"
                                                    title="编辑姓名"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(op.id, op.name || op.employee_id)}
                                                    className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-all"
                                                    title="删除"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="mt-4 bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-xs text-blue-400/70">
                    <span className="font-bold text-blue-400">登录方式：</span>操作员在生产页面输入 4 位工号（如 <span className="font-mono bg-blue-500/10 px-1 rounded">0014</span>）即可打卡上班，工号就是唯一登录凭据。
                </div>
            </div>
        </div>
    );
};

export default OperatorManagement;
