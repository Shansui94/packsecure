
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Wrench, Calendar, Truck, User, Trash2, XCircle } from 'lucide-react';

const NILAI_DRIVERS = ['SAM', 'Mahadi', 'Ayam', 'Tahir'];

const isNilaiDriver = (name?: string) =>
    name ? NILAI_DRIVERS.some(n => name.toUpperCase().includes(n.toUpperCase())) : false;

const MaintenanceManagement: React.FC<{ user?: any }> = ({ user }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'rejected'>('pending');

    // Factory filter: Neoson → Taiping (non-Nilai), Eric → Nilai
    const isNeoson = user?.employeeId === '009';
    const isEric = user?.email === 'ericsoobaolin0219@gmail.com';

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);

        try {
            // Attempt 1: Try Join Fetch (Preferred)
            const { data, error } = await supabase
                .from('lorry_service_requests')
                .select(`
                    *,
                    users_public (name, email)
                `)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setRequests(data);
                setLoading(false);
                return;
            }

            if (error) {
                console.warn("Join fetch failed, trying fallback...", error);
            }

            // Attempt 2: Fallback (Fetch Requests -> Then Fetch Users)
            // 1. Fetch Requests
            const { data: rawRequests, error: rawError } = await supabase
                .from('lorry_service_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (rawError) throw rawError;

            if (rawRequests && rawRequests.length > 0) {
                // 2. Extract Driver IDs
                const driverIds = [...new Set(rawRequests.map(r => r.driver_id).filter(Boolean))];

                // 3. Fetch Users
                const { data: users } = await supabase
                    .from('users_public')
                    .select('id, name, email')
                    .in('id', driverIds);

                // 4. Manual Join
                const joinedData = rawRequests.map(r => {
                    const user = users?.find(u => u.id === r.driver_id);
                    return {
                        ...r,
                        users_public: user ? { name: user.name, email: user.email } : null
                    };
                });

                setRequests(joinedData);
            } else {
                setRequests([]);
            }

        } catch (err: any) {
            console.error("Critical Fetch Error:", err);
            alert("Fetch Failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- REALTIME UPDATE FIX ---
    useEffect(() => {
        const channel = supabase
            .channel('lorry-requests-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lorry_service_requests' },
                () => {
                    console.log("New Service Request Detected! Refreshing...");
                    fetchRequests();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // --- MODAL STATE ---
    const [scheduleModal, setScheduleModal] = useState<{ open: boolean; requestId: string | null; date: string }>({
        open: false,
        requestId: null,
        date: new Date().toISOString().split('T')[0] // Default to today
    });

    const openScheduleModal = (id: string) => {
        setScheduleModal({ open: true, requestId: id, date: new Date().toISOString().split('T')[0] });
    };

    const confirmSchedule = async () => {
        if (!scheduleModal.requestId || !scheduleModal.date) return;

        const { error } = await supabase
            .from('lorry_service_requests')
            .update({ status: 'Scheduled', scheduled_date: scheduleModal.date })
            .eq('id', scheduleModal.requestId);

        if (error) {
            alert("Error: " + error.message);
        } else {
            setScheduleModal({ ...scheduleModal, open: false });
            fetchRequests(); // Refresh
        }
    };

    // --- ACTIONS ---
    const handleReject = async (id: string) => {
        if (!confirm('Are you sure you want to reject this request?')) return;
        const { error } = await supabase
            .from('lorry_service_requests')
            .update({ status: 'Rejected' })
            .eq('id', id);
        if (error) alert("Error: " + error.message);
        else fetchRequests();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to permanently delete this request?')) return;
        const { error } = await supabase
            .from('lorry_service_requests')
            .delete()
            .eq('id', id);
        if (error) alert("Error: " + error.message);
        else fetchRequests();
    };

    // Auto-Archive Past Requests
    useEffect(() => {
        const autoArchive = async () => {
            const today = new Date().toISOString().split('T')[0];

            // 1. Find expired requests
            const { data: expired } = await supabase
                .from('lorry_service_requests')
                .select('id')
                .eq('status', 'Scheduled')
                .lt('scheduled_date', today);

            if (expired && expired.length > 0) {
                console.log(`Auto-Archiving ${expired.length} past requests...`);

                // 2. Mark them as completed
                const { error } = await supabase
                    .from('lorry_service_requests')
                    .update({
                        status: 'Completed',
                        completed_at: new Date().toISOString()
                    })
                    .in('id', expired.map(e => e.id));

                if (!error) {
                    fetchRequests(); // Refresh list if updates happened
                }
            }
        };

        autoArchive();
    }, []);



    // Apply factory filter for Neoson / Eric
    const factoryFiltered = requests.filter(r => {
        const driverName = r.users_public?.name || '';
        if (isNeoson) return !isNilaiDriver(driverName); // Taiping only
        if (isEric) return isNilaiDriver(driverName);  // Nilai only
        return true; // Admins see all
    });

    const pendingList = factoryFiltered.filter(r => r.status !== 'Completed' && r.status !== 'Rejected');
    const historyList = factoryFiltered.filter(r => r.status === 'Completed');
    const rejectedList = factoryFiltered.filter(r => r.status === 'Rejected');
    
    const displayList = activeTab === 'pending' ? pendingList : activeTab === 'history' ? historyList : rejectedList;

    return (
        <div className="p-8 bg-[#121215] min-h-screen text-slate-100 relative">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-white italic flex items-center gap-3">
                    <Wrench className="text-amber-500" />
                    Maintenance Control
                </h1>
                <p className="text-slate-400 mt-1">Manage lorry service requests and schedules.</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-all ${activeTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'
                        }`}
                >
                    Pending for Service ({pendingList.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-all ${activeTab === 'history' ? 'bg-green-600/20 text-green-500 border border-green-500/30' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'
                        }`}
                >
                    Service History ({historyList.length})
                </button>
                <button
                    onClick={() => setActiveTab('rejected')}
                    className={`px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-all ${activeTab === 'rejected' ? 'bg-red-600/20 text-red-500 border border-red-500/30' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'
                        }`}
                >
                    Rejected ({rejectedList.length})
                </button>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-20 text-slate-500">Loading requests...</div>
                ) : displayList.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800 text-slate-500">
                        No service requests found.
                    </div>
                ) : (
                    displayList.map((req) => (
                        <div key={req.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-6 flex-1">
                                <div className="w-16 h-16 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center text-slate-500">
                                    <Truck size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight">{req.plate_number}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <User size={12} className="text-slate-500" />
                                        <span className="text-xs font-bold text-slate-400">{req.users_public?.name || 'Unknown Driver'}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-600 mt-2 font-mono">REQUESTED ON: {new Date(req.created_at).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-12 text-center">
                                <div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Status</div>
                                    <div className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${req.status === 'Completed' ? 'bg-green-500/10 text-green-500' :
                                        req.status === 'Scheduled' ? 'bg-blue-500/10 text-blue-500' :
                                            req.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                                                'bg-amber-500/10 text-amber-500'
                                        }`}>
                                        {req.status}
                                    </div>
                                </div>
                                {req.scheduled_date && (
                                    <div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Scheduled Date</div>
                                        <div className="text-sm font-bold text-white">{new Date(req.scheduled_date).toLocaleDateString()}</div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 w-full md:w-auto">
                                {req.status !== 'Completed' && req.status !== 'Rejected' && (
                                    <>
                                        <button
                                            onClick={() => openScheduleModal(req.id)}
                                            className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
                                        >
                                            <Calendar size={14} /> Schedule
                                        </button>
                                        <button
                                            onClick={() => handleReject(req.id)}
                                            className="w-full md:w-auto px-4 py-3 bg-red-900/40 hover:bg-red-900/60 text-red-400 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
                                            title="Reject Request"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => handleDelete(req.id)}
                                    className="w-full md:w-auto px-4 py-3 bg-slate-800 hover:bg-red-900/60 text-slate-500 hover:text-red-400 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
                                    title="Delete Record"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* SCHEDULE MODAL */}
            {
                scheduleModal.open && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                            <h3 className="text-xl font-black text-white italic mb-4">Set Schedule Date</h3>
                            <p className="text-slate-400 text-sm mb-6">Select when this lorry will be serviced.</p>

                            <input
                                type="date"
                                value={scheduleModal.date}
                                onChange={(e) => setScheduleModal({ ...scheduleModal, date: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setScheduleModal({ ...scheduleModal, open: false })}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold uppercase text-xs text-slate-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSchedule}
                                    className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold uppercase text-xs text-white"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default MaintenanceManagement;
