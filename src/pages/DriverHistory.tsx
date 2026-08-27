import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Calendar, Package, X, CheckCircle, Clock } from 'lucide-react';
import { SalesOrder } from '../types';

interface DriverHistoryProps {
    user: any;
}

const DriverHistory: React.FC<DriverHistoryProps> = ({ user }) => {
    const [tasks, setTasks] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    // Fetch History
    const fetchHistory = async () => {
        setLoading(true);
        if (!user?.uid) return;

        try {
            const query = supabase
                .from('sales_orders')
                .select('*')
                .eq('driver_id', user.uid)
                .eq('status', 'Delivered')
                .order('deadline', { ascending: false });

            const { data } = await query;

            if (data) {
                const mapped = data.map((item: any) => ({
                    ...item,
                    orderNumber: item.order_number || item.orderNumber,
                    deliveryAddress: item.delivery_address || item.deliveryAddress,
                    deliveryDate: item.deadline,
                    orderDate: item.order_date || item.orderDate,
                }));

                // Client-side date filtering to handle different date representations safely
                const filtered = selectedDate
                    ? mapped.filter((item: any) => {
                          const dateVal = item.deliveryDate || item.orderDate || item.created_at || '';
                          return dateVal.startsWith(selectedDate);
                      })
                    : mapped;

                setTasks(filtered);
            }
        } catch (e) {
            console.error('Error fetching driver history:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [user, selectedDate]);

    return (
        <div className="min-h-screen bg-black text-slate-200 pb-24 font-sans">
            {/* TOP BAR */}
            <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-black text-white italic tracking-tighter">SEJARAH SAYA / MY HISTORY</h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {user?.name || 'Pemandu'} • {tasks.length} Penghantaran Selesai
                    </p>
                </div>
            </div>

            {/* FILTERS */}
            <div className="p-4 bg-slate-900/50 border-b border-white/5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                    Tapis mengikut Tarikh / Filter by Date
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="date"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm font-bold uppercase tracking-wider focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    {selectedDate && (
                        <button
                            onClick={() => setSelectedDate('')}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase transition-colors"
                        >
                            Set Semula / Reset
                        </button>
                    )}
                </div>
            </div>

            {/* LIST */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-500 animate-pulse font-bold">
                        Memuatkan Sejarah... / Loading History...
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-16 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800">
                        <Package size={44} className="mx-auto mb-3 text-slate-700" />
                        <h3 className="font-bold text-slate-400 text-sm">Tiada rekod sejarah ditemui. / No history found.</h3>
                        <p className="text-xs text-slate-600 mt-1">Sila tukar tapisan tarikh untuk melihat rekod lain.</p>
                    </div>
                ) : (
                    tasks.map((order) => {
                        const podPhotos = order.pod_photo_url ? order.pod_photo_url.split(',').filter(Boolean) : [];
                        const extraJobPhoto = (order as any).proof_of_load_url || (order as any).proofOfLoadUrl;

                        return (
                            <div
                                key={order.id}
                                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-5 relative group"
                            >
                                {/* Status Pill */}
                                <div className="flex justify-between items-start mb-3 gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center flex-wrap gap-2 mb-1">
                                            <span className="text-[10px] font-mono font-black bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">
                                                {order.orderNumber}
                                            </span>
                                            {order.zone && (
                                                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded uppercase">
                                                    {order.zone}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-base font-black text-white leading-tight">
                                            {order.deliveryAddress || order.customer || 'Tiada Alamat'}
                                        </h2>
                                        {order.customer && order.deliveryAddress && (
                                            <p className="text-xs text-slate-400 font-bold mt-0.5">{order.customer}</p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-mono font-black bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                                        <CheckCircle size={12} /> SELESAI
                                    </span>
                                </div>

                                {/* Items List summary if available */}
                                {order.items && order.items.length > 0 && (
                                    <div className="mb-3 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                                        <p className="text-[9px] text-slate-500 font-black uppercase mb-1 flex items-center gap-1">
                                            <Package size={10} /> Senarai Barang / Items
                                        </p>
                                        <div className="space-y-1">
                                            {order.items.map((it: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-slate-300">
                                                    <span>{it.product || it.name || it.sku}</span>
                                                    <span className="font-mono text-white font-bold">{it.quantity} Unit</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* POD Photos Grid */}
                                {podPhotos.length > 0 && (
                                    <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                        <p className="text-[10px] text-emerald-400 font-black uppercase mb-2 flex items-center gap-1">
                                            📸 Bukti Penghantaran / Proof of Delivery (POD)
                                        </p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {podPhotos.map((url, idx) => {
                                                const isDo = idx % 2 === 0;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="relative rounded-lg overflow-hidden border border-slate-700 bg-black aspect-square cursor-zoom-in group/img"
                                                        onClick={() => setPreviewImageUrl(url)}
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`POD ${idx + 1}`}
                                                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                                                        />
                                                        <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm text-[8px] font-black text-emerald-400 px-1 py-0.2 rounded uppercase">
                                                            {isDo ? 'DO' : 'Barang'}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Extra Job Photo Proof */}
                                {!podPhotos.length && extraJobPhoto && (
                                    <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                        <p className="text-[10px] text-emerald-400 font-black uppercase mb-2 flex items-center gap-1">
                                            📸 Bukti Gambar Tugasan / Task Photo Proof
                                        </p>
                                        <div
                                            className="w-full h-36 rounded-lg overflow-hidden border border-slate-700 bg-black relative cursor-zoom-in"
                                            onClick={() => setPreviewImageUrl(extraJobPhoto)}
                                        >
                                            <img
                                                src={extraJobPhoto}
                                                alt="Extra Job Proof"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Order / Driver Notes */}
                                {order.notes && (
                                    <div className="mb-3 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 text-xs">
                                        <p className="text-[9px] text-slate-500 font-black uppercase mb-0.5">Catatan / Notes</p>
                                        <p className="text-slate-300 italic whitespace-pre-line text-[11px] leading-relaxed">
                                            {order.notes}
                                        </p>
                                    </div>
                                )}

                                {/* Footer Timestamps */}
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 pt-3 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                                    <div className="flex items-center gap-1 text-blue-400 font-bold uppercase">
                                        <Calendar size={12} />
                                        <span>Tarikh Hantar: {(order as any).deliveryDate || 'N/A'}</span>
                                    </div>
                                    {order.pod_timestamp && (
                                        <div className="flex items-center gap-1 text-slate-500">
                                            <Clock size={12} />
                                            <span>Selesai: {new Date(order.pod_timestamp).toLocaleString('en-GB')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* FULLSCREEN IMAGE PREVIEW MODAL */}
            {previewImageUrl && (
                <div
                    className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setPreviewImageUrl(null)}
                >
                    <button
                        onClick={() => setPreviewImageUrl(null)}
                        className="absolute top-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 rounded-full text-white z-10 transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={previewImageUrl}
                        alt="Enlarged Preview"
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-slate-400 text-xs mt-3 font-mono">Ketik di luar untuk tutup / Tap outside to close</p>
                </div>
            )}
        </div>
    );
};

export default DriverHistory;

