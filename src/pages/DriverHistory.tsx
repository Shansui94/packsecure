import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Calendar, Package } from 'lucide-react';
import { SalesOrder } from '../types';

interface DriverHistoryProps {
    user: any;
}

const DriverHistory: React.FC<DriverHistoryProps> = ({ user }) => {
    const [tasks, setTasks] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD

    // Fetch History
    const fetchHistory = async () => {
        setLoading(true);
        if (!user?.uid) return;

        try {
            let query = supabase
                .from('sales_orders')
                .select('*')
                .eq('driver_id', user.uid)
                .eq('status', 'Delivered')
                .order('deadline', { ascending: false });

            if (selectedDate) {
                // Filter by Deadline Date
                query = query.gte('deadline', selectedDate).lte('deadline', selectedDate + 'T23:59:59');
            }

            const { data } = await query;

            if (data) {
                const mapped = data.map((item: any) => ({
                    ...item,
                    orderNumber: item.order_number || item.orderNumber,
                    deliveryAddress: item.delivery_address || item.deliveryAddress,
                    deliveryDate: item.deadline
                }));
                setTasks(mapped);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [user, selectedDate]);

    return (
        <div className="min-h-screen bg-black text-slate-200 pb-20 font-sans">
            {/* TOP BAR */}
            <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10 p-4">
                <h1 className="text-xl font-black text-white italic tracking-tighter">MY HISTORY</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Past Deliveries</p>
            </div>

            {/* FILTERS */}
            <div className="p-4 bg-slate-900/50 border-b border-white/5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Filter by Date</label>
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
                            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* LIST */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-slate-500 animate-pulse">Loading History...</div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800">
                        <Package size={40} className="mx-auto mb-3 text-slate-700" />
                        <h3 className="font-bold text-slate-500">No history found.</h3>
                    </div>
                ) : (
                    tasks.map((order) => (
                        <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-5">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h2 className="text-lg font-black text-white line-clamp-1">
                                        {/* Use State as main title per new display logic, fallback to customer */}
                                        {order.deliveryAddress || order.customer}
                                    </h2>
                                    <p className="text-xs text-slate-500 font-bold">{order.customer}</p>
                                </div>
                                <span className="text-[10px] font-mono font-bold bg-green-900/30 text-green-400 px-2 py-1 rounded">
                                    COMPLETED
                                </span>
                            </div>

                            <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-slate-800">
                                <div className="flex items-center gap-2 text-xs text-blue-400 font-bold uppercase tracking-widest">
                                    <Calendar size={12} className="text-blue-500" />
                                    Delivery Date: {(order as any).deliveryDate}
                                </div>
                                {order.pod_timestamp && (
                                    <div className="text-[10px] text-slate-600 font-mono flex items-center gap-2">
                                        System Logged: {new Date(order.pod_timestamp).toLocaleString()}
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

export default DriverHistory;
