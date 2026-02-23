
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Calendar, Send, History, FileText } from 'lucide-react';

interface DriverLeaveProps {
    user: any;
}

const DriverLeave: React.FC<DriverLeaveProps> = ({ user }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [leaveHistory, setLeaveHistory] = useState<any[]>([]);

    useEffect(() => {
        if (user) fetchLeaveHistory();
    }, [user]);

    const fetchLeaveHistory = async () => {
        const { data } = await supabase
            .from('employee_leave')
            .select('*')
            .eq('employee_id', user.uid)
            .order('created_at', { ascending: false });
        if (data) setLeaveHistory(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) return alert('Please select both dates');

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) return alert('End date cannot be before start date');

        setSubmitting(true);
        try {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            const { error } = await supabase.from('employee_leave').insert({
                employee_id: user.uid,
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
            fetchLeaveHistory();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-slate-200 p-4 pb-20 font-sans">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pt-4">
                <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30 text-blue-400">
                    <Calendar size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-wider">Apply Leave</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Employee Leave Portal</p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 shadow-2xl space-y-5">
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Start Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all"
                        required
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">End Date</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all"
                        required
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                        <FileText size={10} /> Reason (Optional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Medical appointment, family event..."
                        rows={3}
                        className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-all resize-none text-sm"
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-50"
                >
                    {submitting ? 'SENDING...' : (
                        <>
                            <Send size={20} />
                            Submit Leave Application
                        </>
                    )}
                </button>
            </form>

            {/* History */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <History size={16} className="text-slate-500" />
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">My Leave History</h2>
                </div>

                {leaveHistory.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-slate-800 border-dashed">
                        <History size={32} className="mx-auto mb-2 text-slate-700" />
                        <p className="text-slate-500 text-sm font-bold">No leave records found</p>
                    </div>
                ) : (
                    leaveHistory.map((leave, idx) => (
                        <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-bold text-sm">
                                        {leave.start_date} → {leave.end_date}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{leave.count_days} Days</div>
                                    {leave.reason && (
                                        <p className="text-xs text-slate-500 italic mt-1 truncate">"{leave.reason}"</p>
                                    )}
                                </div>
                                <div className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${leave.status === 'Approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                        leave.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    }`}>
                                    {leave.status}
                                </div>
                            </div>
                            {leave.reviewed_at && (
                                <div className="text-[9px] text-slate-700 font-mono mt-2">
                                    Reviewed: {new Date(leave.reviewed_at).toLocaleString()}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DriverLeave;
