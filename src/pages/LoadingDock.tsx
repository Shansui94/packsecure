import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Truck, CheckCircle, ClipboardList, Box } from 'lucide-react';
import { LogisticsTrip, SalesOrder } from '../types';

const LoadingDock: React.FC = () => {
    const [trips, setTrips] = useState<LogisticsTrip[]>([]);
    const [selectedTrip, setSelectedTrip] = useState<LogisticsTrip | null>(null);

    const fetchData = async () => {
        try {
            // Fetch Trips (Status: Planning, Loading)
            const { data: tripData, error } = await supabase
                .from('logistics_trips')
                .select(`
                    *,
                    sys_vehicles ( plate_number, max_volume_m3 ),
                    users_public ( name )
                `)
                .in('status', ['Planning', 'Loading'])
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Fetch Orders for these trips
            const tripIds = tripData?.map(t => t.trip_id) || [];
            let ordersMap: Record<string, SalesOrder[]> = {};

            if (tripIds.length > 0) {
                const { data: orderData } = await supabase
                    .from('sales_orders')
                    .select('*')
                    .in('trip_id', tripIds);

                if (orderData) {
                    orderData.forEach(o => {
                        if (!ordersMap[o.trip_id!]) ordersMap[o.trip_id!] = [];
                        ordersMap[o.trip_id!].push(o as SalesOrder);
                    });
                }
            }

            // Combine
            const mappedTrips: LogisticsTrip[] = (tripData || []).map(t => ({
                ...t,
                vehicle: t.sys_vehicles, // Supabase join result
                driverName: t.users_public?.name, // Supabase join result
                orders: ordersMap[t.trip_id] || []
            }));

            setTrips(mappedTrips);
        } catch (error) {
            console.error("Loading Dock Error:", error);
        }
    };

    useEffect(() => {
        fetchData();
        const sub = supabase.channel('loading_dock')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_trips' }, fetchData)
            .subscribe();
        return () => { supabase.removeChannel(sub) };
    }, []);

    const handleStartLoading = async (tripId: string) => {
        await supabase.from('logistics_trips').update({ status: 'Loading' }).eq('trip_id', tripId);
        fetchData(); // Optimistic update ideally
    };

    const handleConfirmLoaded = async (tripId: string) => {
        const confirm = window.confirm("Are all items verified and loaded?");
        if (!confirm) return;

        // Update Trip to 'Ready' or 'En-Route' (Let's assume En-Route for simplicity as driver takes over)
        // Or 'Ready' if we want a gate pass step. Let's do 'En-Route' for MVP.
        await supabase.from('logistics_trips').update({ status: 'En-Route', started_at: new Date().toISOString() }).eq('trip_id', tripId);

        // Update Orders to 'Shipped' (if not already)
        await supabase.from('sales_orders').update({ status: 'Shipped' }).eq('trip_id', tripId);

        fetchData();
        setSelectedTrip(null);
    };

    return (
        <div className="p-6 h-full text-white animate-fade-in pb-20">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                    <ClipboardList className="text-orange-500" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white uppercase">Loading Dock</h1>
                    <p className="text-gray-400 text-sm">Verify and load shipments for departure.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LIST */}
                <div className="space-y-4">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Pending Departures</h2>
                    {trips.length === 0 ? (
                        <div className="p-10 text-center text-gray-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                            No trips pending.
                        </div>
                    ) : (
                        trips.map(trip => (
                            <div
                                key={trip.trip_id}
                                onClick={() => setSelectedTrip(trip)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTrip?.trip_id === trip.trip_id
                                    ? 'bg-orange-500/10 border-orange-500 text-white'
                                    : 'bg-[#1e1e24] border-white/5 hover:border-white/20 text-gray-300'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold">{trip.trip_number}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${trip.status === 'Loading' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                                        }`}>
                                        {trip.status}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-400 flex items-center gap-2">
                                    <Truck size={14} /> {(trip.vehicle as any)?.plate_number || 'No Vehicle'}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                    {trip.orders?.length} Orders • {(trip.orders?.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0))} Items
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* DETAILS */}
                <div className="lg:col-span-2 bg-[#1e1e24] rounded-2xl border border-white/5 p-6 h-fit min-h-[500px]">
                    {selectedTrip ? (
                        <div className="animate-in slide-in-from-right-4">
                            <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/5">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedTrip.trip_number}</h2>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Driver: <span className="text-white font-bold">{(selectedTrip as any).driverName || 'Unknown'}</span>
                                    </p>
                                </div>
                                {selectedTrip.status === 'Planning' ? (
                                    <button
                                        onClick={() => handleStartLoading(selectedTrip.trip_id)}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg"
                                    >
                                        Start Loading
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleConfirmLoaded(selectedTrip.trip_id)}
                                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg flex items-center gap-2"
                                    >
                                        <CheckCircle size={18} /> Confirm Departure
                                    </button>
                                )}
                            </div>

                            <div className="space-y-6">
                                {selectedTrip.orders?.map((order, idx) => (
                                    <div key={order.id} className="bg-black/20 p-4 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-gray-400">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white">{order.customer}</div>
                                                <div className="text-xs text-gray-500 font-mono">{order.orderNumber}</div>
                                            </div>
                                            <div className="ml-auto text-xs font-bold text-gray-500 px-2 py-1 bg-white/5 rounded">
                                                Stop #{order.stop_sequence}
                                            </div>
                                        </div>

                                        <div className="space-y-2 ml-11">
                                            {order.items.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between text-sm bg-white/5 p-2 rounded lg:w-3/4">
                                                    <div className="flex items-center gap-3">
                                                        <Box size={14} className="text-orange-400" />
                                                        <span className="text-gray-300">{item.product}</span>
                                                    </div>
                                                    <span className="font-mono font-bold text-white">x{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
                            <Truck size={64} className="opacity-20" />
                            <p>Select a trip to view loading manifest.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoadingDock;
