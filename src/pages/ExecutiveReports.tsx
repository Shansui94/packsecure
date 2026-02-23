import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { FileText, TrendingUp, User, AlertCircle, CheckCircle, Plus } from 'lucide-react';

interface Report {
    id: string;
    date: string;
    author_name: string;
    role: string;
    summary: string;
    issues: string;
    next_steps: string;
    created_at: string;
}

interface ExecutiveReportsProps {
    user: any; // Using any for simplicty of AuthUser vs SysUser
}

const ExecutiveReports: React.FC<ExecutiveReportsProps> = ({ user }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        summary: '',
        issues: '',
        nextSteps: ''
    });

    // Production Stats for Reference
    const [stats, setStats] = useState({ totalProduced: 0, activeJobs: 0 });

    useEffect(() => {
        fetchReports();
        fetchQuickStats();
    }, []);

    const fetchReports = async () => {
        const { data } = await supabase
            .from('management_reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setReports(data);
    };

    const fetchQuickStats = async () => {
        // Get today's production count for context
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('production_logs_v2')
            .select('quantity_produced')
            .gte('created_at', `${today} T00:00:00`);

        const total = data?.reduce((sum, item) => sum + (item.quantity_produced || 0), 0) || 0;
        setStats(prev => ({ ...prev, totalProduced: total }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('management_reports').insert({
                date: new Date().toISOString(),
                author_id: user.uid,
                author_name: user.name || user.email,
                role: user.role,
                summary: formData.summary,
                issues: formData.issues,
                next_steps: formData.nextSteps,
                kpi_data: stats
            });

            if (error) throw error;
            setIsCreateOpen(false);
            setFormData({ summary: '', issues: '', nextSteps: '' });
            fetchReports();
            alert("Report Submitted Successfully");
        } catch (err) {
            console.error(err);
            alert("Failed to submit report");
        }
    };

    return (
        <div className="p-6 text-white min-h-screen pb-20 animate-fade-in">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <FileText className="text-purple-500" />
                        Executive Briefing
                    </h1>
                    <p className="text-gray-400 mt-1">Daily management reports for factory leadership.</p>
                </div>

                {(user.role === 'Admin' || user.role === 'Manager') && (
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="btn-primary px-6 py-2.5 rounded-xl flex items-center gap-2"
                    >
                        <Plus size={20} /> New Report
                    </button>
                )}
            </header>

            {/* Quick Stats Context */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#1e1e24] p-4 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                        <div className="text-gray-500 text-xs font-bold uppercase">Today's Production</div>
                        <div className="text-2xl font-black text-white">{stats.totalProduced.toLocaleString()} <span className="text-sm font-medium text-gray-500">Rolls</span></div>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg text-green-500"><TrendingUp size={20} /></div>
                </div>
                {/* Add more stats as needed */}
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#1e1e24] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Write Daily Report</h2>
                            <button onClick={() => setIsCreateOpen(false)} className="text-gray-500 hover:text-white">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Executive Summary</label>
                                <textarea
                                    className="w-full bg-[#121215] border border-white/10 rounded-xl p-4 text-white focus:border-purple-500/50 outline-none h-24 resize-none"
                                    placeholder="Brief overview of today's operations..."
                                    value={formData.summary}
                                    onChange={e => setFormData({ ...formData, summary: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2 text-red-400">Issues / Blockers</label>
                                    <textarea
                                        className="w-full bg-[#121215] border border-white/10 rounded-xl p-4 text-white focus:border-red-500/50 outline-none h-32 resize-none"
                                        placeholder="Any downtime, machine faults, or HR issues..."
                                        value={formData.issues}
                                        onChange={e => setFormData({ ...formData, issues: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2 text-blue-400">Next Steps / Plan</label>
                                    <textarea
                                        className="w-full bg-[#121215] border border-white/10 rounded-xl p-4 text-white focus:border-blue-500/50 outline-none h-32 resize-none"
                                        placeholder="Goals for tomorrow..."
                                        value={formData.nextSteps}
                                        onChange={e => setFormData({ ...formData, nextSteps: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white font-bold">Cancel</button>
                                <button type="submit" className="btn-primary px-6 py-2 rounded-xl">Submit Report</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reports Timeline */}
            <div className="space-y-6 max-w-4xl mx-auto">
                {reports.length === 0 ? (
                    <div className="text-center py-20 bg-[#1e1e24] rounded-2xl border border-dashed border-white/10 text-gray-500">
                        No reports submitted yet.
                    </div>
                ) : (
                    reports.map(report => (
                        <div key={report.id} className="bg-[#1e1e24] rounded-2xl border border-white/5 shadow-xl overflow-hidden group hover:border-purple-500/30 transition-all">
                            <div className="p-6 border-b border-white/5 flex justify-between items-start bg-gradient-to-r from-white/[0.02] to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg border border-purple-500/30">
                                        {new Date(report.created_at).getDate()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{new Date(report.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long' })}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <User size={12} /> {report.author_name} <span className="bg-white/10 px-1.5 rounded text-[10px] uppercase tracking-wider">{report.role}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <FileText size={24} />
                                </div>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="col-span-1 md:col-span-2">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Executive Summary</h4>
                                    <p className="text-gray-300 leading-relaxed text-lg">{report.summary}</p>
                                </div>

                                {report.issues && (
                                    <div className="bg-red-500/5 p-5 rounded-xl border border-red-500/10">
                                        <h4 className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest mb-2">
                                            <AlertCircle size={14} /> Issues & Risks
                                        </h4>
                                        <p className="text-gray-300 leading-relaxed text-sm">{report.issues}</p>
                                    </div>
                                )}

                                {report.next_steps && (
                                    <div className="bg-blue-500/5 p-5 rounded-xl border border-blue-500/10">
                                        <h4 className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">
                                            <CheckCircle size={14} /> Next Steps
                                        </h4>
                                        <p className="text-gray-300 leading-relaxed text-sm">{report.next_steps}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ExecutiveReports;
