
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Task, User } from '../types';
import { Plus, Trash2, CheckCircle2, Circle, Clock, FileText } from 'lucide-react';
import { DevLogModal } from '../components/DevLogModal';

interface TasksProps {
    user: User | null;
}

const Tasks: React.FC<TasksProps> = ({ user }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'All' | 'My Tasks' | 'Assigned by Me'>('All');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Normal' | 'High'>('Normal');
    const [assignee, setAssignee] = useState(user?.uid || ''); // Default to self
    const [dueDate, setDueDate] = useState('');
    const [usersList, setUsersList] = useState<any[]>([]);

    useEffect(() => {
        fetchTasks();
        fetchUsers();

        const channel = supabase.channel('tasks-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchUsers = async () => {
        const { data } = await supabase.from('users_public').select('id, name, email').order('name');
        if (data) setUsersList(data);
    };

    const fetchTasks = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('tasks')
                .select(`
                    *,
                    assignee:users_public!assigned_to(name),
                    creator:users_public!created_by(name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedTasks: Task[] = data.map((t: any) => ({
                    ...t,
                    assignee_name: t.assignee?.name || 'Unassigned',
                    creator_name: t.creator?.name || 'Unknown'
                }));
                setTasks(mappedTasks);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!title.trim()) return alert('Title is required');

        const newTask = {
            title,
            description,
            priority,
            assigned_to: assignee,
            created_by: user.uid,
            status: 'To Do',
            due_date: dueDate ? new Date(dueDate).toISOString() : null
        };

        try {
            const { error } = await supabase.from('tasks').insert(newTask);
            if (error) throw error;
            setShowCreateModal(false);
            resetForm();
        } catch (error: any) {
            alert('Error creating task: ' + error.message);
        }
    };

    const handleStatusToggle = async (task: Task) => {
        const nextStatus = task.status === 'Done' ? 'To Do' : 'Done';
        try {
            const { error } = await supabase.from('tasks').update({ status: nextStatus }).eq('id', task.id);
            if (error) throw error;
        } catch (error: any) {
            alert('Error updating status: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this task?')) return;
        try {
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (error) throw error;
        } catch (error: any) {
            alert('Error deleting task: ' + error.message);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setPriority('Normal');
        setAssignee(user?.uid || '');
        setDueDate('');
    };

    const filteredTasks = tasks.filter(t => {
        if (filter === 'My Tasks') return t.assigned_to === user?.uid;
        if (filter === 'Assigned by Me') return t.created_by === user?.uid;
        return true;
    });

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'High': return 'text-red-400 border-red-500/50 bg-red-500/10';
            case 'Low': return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
            default: return 'text-gray-400 border-gray-500/50 bg-gray-500/10';
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#121215] text-gray-200 p-8 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        Tasks
                        <span className="text-sm font-normal text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">{filteredTasks.length} Count</span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Manage assignments and track progress across the team.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setShowReportModal(true)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer text-sm"
                        title="将今日任务一键汇总为工作汇报"
                    >
                        <FileText size={18} className="text-blue-400" />
                        <span>生成今日工作汇报</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer text-sm"
                    >
                        <Plus size={20} /> Create Task
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 border-b border-white/5 pb-1">
                {['All', 'My Tasks', 'Assigned by Me'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${filter === f ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="text-center py-12 text-gray-500 animate-pulse">Loading Tasks...</div>
                ) : filteredTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} />
                        </div>
                        <p>No tasks found.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredTasks.map(task => (
                            <div key={task.id} className="group bg-[#1a1a1e] border border-white/5 hover:border-blue-500/30 rounded-xl p-4 transition-all duration-200 flex items-start gap-4 hover:shadow-lg hover:shadow-black/50">
                                <button
                                    onClick={() => handleStatusToggle(task)}
                                    className={`mt-1 transition-colors ${task.status === 'Done' ? 'text-green-500' : 'text-gray-600 hover:text-blue-500'}`}
                                >
                                    {task.status === 'Done' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                </button>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <h3 className={`font-bold text-lg mb-1 transition-all ${task.status === 'Done' ? 'text-gray-500 line-through decoration-2 decoration-gray-600' : 'text-white'}`}>
                                            {task.title}
                                        </h3>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                        </div>
                                    </div>
                                    <p className={`text-sm mb-3 ${task.status === 'Done' ? 'text-gray-600' : 'text-gray-400'}`}>{task.description || 'No description'}</p>

                                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
                                        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                                            <span className="text-gray-400">Assigned to:</span>
                                            <span className="text-blue-300">{task.assignee_name}</span>
                                        </div>
                                        {task.due_date && (
                                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${new Date(task.due_date) < new Date() && task.status !== 'Done' ? 'bg-red-500/10 text-red-400' : 'bg-white/5'}`}>
                                                <Clock size={12} />
                                                <span>{new Date(task.due_date).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        <div className="flex-1"></div>
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-gray-600">Created by {task.creator_name}</span>
                                            {(user?.uid === task.created_by || user?.role === 'SuperAdmin') && (
                                                <button onClick={() => handleDelete(task.id)} className="ml-2 text-gray-600 hover:text-red-400 transition-colors p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Task Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
                    <div className="bg-[#1a1a1e] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in-up">
                        <h2 className="text-xl font-bold text-white mb-6">Create New Task</h2>
                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="What needs to be done?"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none h-24"
                                    placeholder="Add details..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Priority</label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value as any)}
                                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Normal">Normal</option>
                                        <option value="High">High</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Due Date</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assign To</label>
                                <select
                                    value={assignee}
                                    onChange={(e) => setAssignee(e.target.value)}
                                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value={user?.uid}>Me ({user?.name})</option>
                                    {usersList.filter(u => u.id !== user?.uid).map(u => (
                                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all"
                                >
                                    Create Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Daily Task & Upgrade Report Modal */}
            <DevLogModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                onSaved={() => setShowReportModal(false)}
                initialTasks={tasks}
            />
        </div>
    );
};

export default Tasks;
