
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Truck, Wrench, History, Clock, AlertCircle } from 'lucide-react';

interface LorryServiceProps {
    user: any;
}

const LorryService: React.FC<LorryServiceProps> = ({ user }) => {
    const [plateNumber, setPlateNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [serviceHistory, setServiceHistory] = useState<any[]>([]);

    const [availableLorries, setAvailableLorries] = useState<any[]>([]);
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);

    useEffect(() => {
        if (user) {
            fetchDriverLorry();
            fetchServiceHistory();
            fetchLorries();
        }
    }, [user]);

    const fetchLorries = async () => {
        const { data } = await supabase.from('lorries').select('*').order('plate_number');
        if (data) setAvailableLorries(data);
    };

    const fetchDriverLorry = async () => {
        try {
            // 1. First Priority: query directly from lorries table by driver_id
            const { data: lorryData } = await supabase
                .from('lorries')
                .select('plate_number')
                .eq('driver_id', user.uid)
                .maybeSingle();
            
            if (lorryData?.plate_number) {
                setPlateNumber(lorryData.plate_number);
                return;
            }

            // 2. Second Priority (Fallback): Look at assigned orders notes
            const { data: orders } = await supabase
                .from('sales_orders')
                .select('notes')
                .eq('driver_id', user.uid)
                .limit(1);
            if (orders && orders.length > 0 && orders[0].notes?.includes('Lorry:')) {
                // Support Malaysian plate numbers with spaces (e.g. PETRA 9821)
                const match = orders[0].notes.match(/Lorry:\s*([A-Za-z0-9]+\s+[0-9]+|[^\s,]+)/);
                if (match) setPlateNumber(match[1]);
            }
        } catch (err) {
            console.error("Error fetching driver lorry:", err);
        }
    };

    const fetchServiceHistory = async () => {
        const { data } = await supabase
            .from('lorry_service_requests')
            .select('*')
            .eq('driver_id', user.uid)
            .neq('status', 'Completed') // Filter out completed/done items
            .order('created_at', { ascending: false });
        if (data) setServiceHistory(data);
    };

    const handleRequest = async () => {
        if (!plateNumber) {
            setIsSelectionOpen(true);
            return;
        }
        submitRequest(plateNumber);
    };

    const submitRequest = async (plate: string) => {
        setSubmitting(true);
        try {
            const { error } = await supabase.from('lorry_service_requests').insert({
                driver_id: user.uid,
                plate_number: plate || 'UNKNOWN',
                status: 'Pending'
            });

            if (error) throw error;

            setPlateNumber(plate); // Remember the selection
            alert("✅ Permohonan servis berjaya dihantar. Menunggu kelulusan logistik. (Service request submitted. Pending logistics approval.)");
            fetchServiceHistory();
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setSubmitting(false);
            setIsSelectionOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-slate-200 p-4 pb-20 font-sans relative">
            {/* Modal: Lorry Selection */}
            {isSelectionOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-800">
                            <h2 className="text-xl font-black text-white uppercase tracking-wider mb-1">Pilih Lori / Select Vehicle</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Lori mana yang perlu diservis? / Which lorry needs service?</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {availableLorries.map(lorry => (
                                <button
                                    key={lorry.id}
                                    onClick={() => submitRequest(lorry.plate_number)}
                                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl hover:bg-blue-900/20 hover:border-blue-500/50 flex items-center justify-between group transition-all"
                                >
                                    <span className="font-mono font-bold text-lg text-slate-300 group-hover:text-blue-400 decoration-slate-900">{lorry.plate_number}</span>
                                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Truck size={14} />
                                    </div>
                                </button>
                            ))}
                             {availableLorries.length === 0 && (
                                <div className="text-center py-8 text-slate-600 font-bold text-sm">
                                    Tiada lori ditemui. / No lorries found.
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-800">
                            <button
                                onClick={() => setIsSelectionOpen(false)}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs transition-colors"
                            >
                                Batal / Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pt-4">
                <div className="p-3 bg-amber-600/20 rounded-2xl border border-amber-500/30 text-amber-400">
                    <Truck size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-wider">SERVIS LORI / LORRY SERVICE</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Kawalan Penyelenggaraan / Maintenance Control</p>
                </div>
            </div>

            {/* Large Request Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 mb-8 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform duration-700">
                    <Wrench size={120} />
                </div>

                <div className="relative z-10 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Lori Ditugaskan / Assigned Vehicle</p>
                    <h2 className="text-4xl font-black text-white mb-8 tracking-tighter">
                        {plateNumber || 'PILIH LORI / SELECT VEHICLE'}
                    </h2>

                    <button
                        onClick={handleRequest}
                        disabled={submitting}
                        className="w-full py-6 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black rounded-2xl font-black text-lg uppercase tracking-widest flex items-center justify-center gap-4 shadow-xl shadow-amber-900/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {submitting ? 'SEDANG DIHANTAR / SENDING...' : (
                            <>
                                <Wrench size={24} />
                                {plateNumber ? 'Mohon Servis / Request Service' : 'Pilih Lori / Select Vehicle'}
                            </>
                        )}
                    </button>
                    <p className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Menunggu kelulusan logistik / Pending logistics approval</p>
                </div>
            </div>

            {/* History */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <History size={16} className="text-slate-500" />
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">SEJARAH PERMOHONAN / REQUEST HISTORY</h2>
                </div>

                {serviceHistory.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-slate-800 border-dashed">
                        <AlertCircle size={32} className="mx-auto mb-2 text-slate-700" />
                        <p className="text-slate-500 text-sm font-bold">Tiada sejarah permohonan / No history available</p>
                    </div>
                ) : (
                    serviceHistory.map((req, idx) => (
                        <div key={idx} className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl flex justify-between items-center transition-all hover:border-slate-700">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-xl ${req.status === 'Scheduled' ? 'bg-blue-500/10 text-blue-500' :
                                    'bg-amber-500/10 text-amber-500'
                                    }`}>
                                    {req.status === 'Scheduled' ? <Clock size={20} /> : <AlertCircle size={20} />}
                                </div>
                                <div>
                                    <div className="text-white font-bold text-sm uppercase">Permohonan Servis / Maintenance Request</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">
                                        {req.scheduled_date ? `Dijadualkan pada: / Scheduled for: ${new Date(req.scheduled_date).toLocaleDateString()}` : 'Menunggu Tarikh / Date Pending'}
                                    </div>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${req.status === 'Scheduled' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-amber-500/20 text-amber-400'
                                }`}>
                                {req.status}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default LorryService;
