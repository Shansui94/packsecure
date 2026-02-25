import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../services/supabase';
import { SalesOrder, User } from '../types';
import { Calendar, User as UserIcon, Truck, MapPin, Package } from 'lucide-react';

// --- LOCATION CONFIGURATION ---
const LOCATIONS = ['Taiping', 'Nilai'] as const;
type Location = typeof LOCATIONS[number];

const TAIPING_KEYWORDS = ['SPD', 'OPM Lama', 'OPM LAMA', 'OPM_LAMA', 'OPMLAMA', 'OPM Corner', 'OPM CORNER', 'OPM_CORNER', 'OPMCORNER'];
const NILAI_KEYWORDS = ['NILAI', 'Nilai'];

const LOCATION_COLOR: Record<Location, string> = {
    'Taiping': 'blue',
    'Nilai': 'emerald',
};

interface OrderSummaryProps {
    user?: any;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ user: _user }) => {
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [drivers, setDrivers] = useState<User[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Location>('Taiping');

    // --- FETCH ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: allUsers } = await supabase.from('users_public').select('*');

            if (allUsers) {
                const filtered = allUsers.filter(u =>
                    u.role === 'Driver' ||
                    u.email === 'neosonchun@gmail.com' ||
                    u.email === 'ericsoobaolin0219@gmail.com' ||
                    u.name?.toLowerCase().includes('neoson')
                );
                setDrivers(filtered.map(u => ({
                    uid: u.id,
                    email: u.email,
                    name: (u.name && u.name.trim() !== '') ? u.name : (u.email?.split('@')[0] || 'Unknown Driver'),
                    role: 'Driver',
                    factoryId: u.factory_id,
                } as any)));
            }

            const { data: ordersData } = await supabase
                .from('sales_orders')
                .select('*')
                .neq('status', 'Cancelled')
                .neq('status', 'Delivered')
                .or(`order_date.eq.${selectedDate},deadline.eq.${selectedDate}`);

            if (ordersData) {
                const mapped: SalesOrder[] = ordersData.map(o => ({
                    id: o.id,
                    orderNumber: o.order_number || o.id.substring(0, 8),
                    customer: o.customer,
                    driverId: o.driver_id,
                    items: o.items || [],
                    status: o.status,
                    orderDate: o.order_date,
                    deadline: o.deadline,
                    notes: o.notes,
                    zone: o.zone,
                    deliveryAddress: o.delivery_address,
                    tripSequence: o.trip_sequence || 0,
                    factoryId: o.factory_id,
                }));
                setOrders(mapped.filter(o => (o.deadline || o.orderDate) === selectedDate));
            }
        } catch (err) {
            console.error('fetchData error:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- LOCATION CLASSIFICATION ---
    const getOrderLocation = (o: SalesOrder): Location | null => {
        const text = o.items.map(i => i.remark || '').join(' ');
        if (NILAI_KEYWORDS.some(k => text.toLowerCase().includes(k.toLowerCase()))) return 'Nilai';
        if (TAIPING_KEYWORDS.some(k => text.toLowerCase().includes(k.toLowerCase()))) return 'Taiping';
        if (o.factoryId === 'N1' || o.factoryId === 'N2') return 'Nilai';
        if (o.factoryId === 'T1') return 'Taiping';
        return null;
    };

    const locationOrders: Record<Location, SalesOrder[]> = { Taiping: [], Nilai: [] };
    orders.forEach(o => {
        const loc = getOrderLocation(o);
        if (loc) locationOrders[loc].push(o);
    });

    const activeTabOrders = [...(locationOrders[activeTab] || [])].sort(
        (a, b) => (a.tripSequence ?? 99) - (b.tripSequence ?? 99)
    );

    const getDriverName = (id?: string) =>
        drivers.find(d => d.uid === id)?.name || 'Unknown Driver';

    // --- DND HANDLER (mirrors DeliveryOrderManagement logic) ---
    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newDriverId = destination.droppableId === 'unassigned' ? null : destination.droppableId;
        const oldDriverId = source.droppableId === 'unassigned' ? null : source.droppableId;
        const orderId = draggableId;

        // Get destination column's current orders
        const destOrders = activeTabOrders
            .filter(o => {
                if (destination.droppableId === 'unassigned') return !o.driverId;
                return o.driverId === destination.droppableId;
            })
            .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));

        const movedOrder = orders.find(o => o.id === orderId);
        if (!movedOrder) return;

        // Build new order for destination
        if (newDriverId === oldDriverId) {
            // Same column reorder
            destOrders.splice(source.index, 1);
            destOrders.splice(destination.index, 0, movedOrder);
        } else {
            // Cross-column move
            destOrders.splice(destination.index, 0, { ...movedOrder, driverId: newDriverId || undefined });
        }

        // Optimistic update
        const sequenceMap = new Map<string, number>();
        destOrders.forEach((o, i) => sequenceMap.set(o.id, i + 1));

        setOrders(prev => prev.map(o => {
            let updated = o;
            if (o.id === orderId && newDriverId !== oldDriverId) {
                updated = { ...o, driverId: newDriverId || undefined };
            }
            if (sequenceMap.has(o.id)) {
                updated = { ...updated, tripSequence: sequenceMap.get(o.id) };
            }
            return updated;
        }));

        // Persist
        try {
            if (newDriverId !== oldDriverId) {
                await supabase.from('sales_orders').update({ driver_id: newDriverId }).eq('id', orderId);
            }
            await Promise.all(
                destOrders.map((o, i) =>
                    supabase.from('sales_orders').update({ trip_sequence: i + 1 }).eq('id', o.id)
                )
            );
        } catch (err) {
            console.error('DnD persist error:', err);
            fetchData();
        }
    };

    // Production summary
    const productSummary = activeTabOrders.reduce((acc, order) => {
        order.items.forEach(item => {
            acc[item.product] = (acc[item.product] || 0) + (item.quantity || 0);
        });
        return acc;
    }, {} as Record<string, number>);

    // Build column list: unassigned + all drivers who have orders in this tab
    const driverIdsInTab = [...new Set(
        activeTabOrders.filter(o => o.driverId).map(o => o.driverId!)
    )];

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="p-6 max-w-7xl mx-auto pb-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Daily Prep List</h1>
                        <p className="text-slate-400 text-sm">Drag trips to reassign drivers or reorder sequence</p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#1a1a1e] border border-white/10 p-1.5 rounded-xl">
                        <Calendar className="text-gray-500 ml-2" size={18} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none text-white font-mono text-sm focus:ring-0 outline-none [color-scheme:dark]"
                        />
                    </div>
                </div>

                {/* Location Tabs */}
                <div className="flex mb-6 bg-[#0a0a0c] rounded-xl overflow-hidden border border-white/5">
                    {LOCATIONS.map(loc => {
                        const c = LOCATION_COLOR[loc];
                        const isActive = activeTab === loc;
                        const activeStyle = {
                            blue: 'border-blue-500 text-blue-400 bg-blue-500/10',
                            emerald: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
                        }[c];
                        return (
                            <button
                                key={loc}
                                onClick={() => setActiveTab(loc)}
                                className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${isActive ? activeStyle : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                {loc}
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-xs">
                                    {locationOrders[loc].length}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div className="text-center py-20 text-gray-500 animate-pulse">Loading orders...</div>
                ) : (
                    <div>
                        {/* Production Summary */}
                        <div className="mb-8 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                            <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Package size={16} /> Production Requirements — {activeTab}
                            </h2>
                            {Object.keys(productSummary).length === 0 ? (
                                <div className="text-xs text-gray-500 italic">No production requirements found.</div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {Object.entries(productSummary).map(([product, qty]) => (
                                        <div key={product} className="bg-[#121215] border border-white/10 rounded-lg px-3 py-2 flex flex-col">
                                            <span className="text-[10px] text-gray-400 font-mono truncate" title={product}>{product}</span>
                                            <span className="text-lg font-bold text-white">{qty}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Kanban Columns */}
                        {activeTabOrders.length === 0 ? (
                            <div className="text-center py-20 text-gray-600 italic border border-dashed border-white/5 rounded-xl">
                                No orders for {activeTab} on this date.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {/* Unassigned Column */}
                                {(() => {
                                    const colOrders = activeTabOrders.filter(o => !o.driverId).sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));
                                    if (colOrders.length === 0 && driverIdsInTab.length > 0) return null;
                                    return (
                                        <DriverColumn
                                            key="unassigned"
                                            droppableId="unassigned"
                                            label="📦 Unassigned"
                                            orders={colOrders}
                                            isUnassigned
                                        />
                                    );
                                })()}

                                {/* Driver Columns */}
                                {driverIdsInTab.map(driverId => {
                                    const colOrders = activeTabOrders.filter(o => o.driverId === driverId).sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));
                                    return (
                                        <DriverColumn
                                            key={driverId}
                                            droppableId={driverId}
                                            label={getDriverName(driverId)}
                                            orders={colOrders}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DragDropContext>
    );
};

// ─── Driver Column Component ─────────────────────────────────────────────────
const DriverColumn: React.FC<{
    droppableId: string;
    label: string;
    orders: SalesOrder[];
    isUnassigned?: boolean;
}> = ({ droppableId, label, orders, isUnassigned }) => (
    <div className={`flex flex-col gap-4 rounded-2xl p-4 border transition-all ${isUnassigned ? 'bg-slate-900/50 border-dashed border-slate-700' : 'bg-slate-900/50 border-slate-800'
        }`}>
        {/* Column Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg ${isUnassigned ? 'bg-slate-700 text-slate-400' : 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white'
                    }`}>
                    {isUnassigned ? '?' : label.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div className={`font-bold text-sm ${isUnassigned ? 'text-slate-400' : 'text-white'}`}>{label}</div>
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        {isUnassigned ? <><UserIcon size={10} /> Pending Assign</> : <><Truck size={10} /> {orders.length} Orders</>}
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <div className="text-2xl font-black text-white">{orders.length}</div>
                <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Orders</div>
            </div>
        </div>

        {/* Droppable Area */}
        <Droppable droppableId={droppableId}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-1 space-y-3 min-h-[80px] transition-colors rounded-xl ${snapshot.isDraggingOver ? 'bg-blue-500/5 border border-blue-500/20' : ''
                        }`}
                >
                    {orders.map((order, index) => (
                        <Draggable key={order.id} draggableId={order.id} index={index}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{ ...provided.draggableProps.style }}
                                    className={`bg-[#18181b] border border-[#27272a] p-4 rounded-xl cursor-grab active:cursor-grabbing transition-all relative group/card ${snapshot.isDragging
                                        ? 'shadow-2xl border-blue-500 z-50 rotate-1'
                                        : 'hover:bg-[#27272a] hover:border-blue-500/50'
                                        }`}
                                >
                                    {/* Trip Sequence Badge */}
                                    <div className="absolute -top-2 -right-2 bg-slate-950 border border-slate-700 text-slate-400 text-[9px] font-bold uppercase py-0.5 px-2 rounded-full shadow-lg z-10">
                                        {index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Trip
                                    </div>

                                    {/* Order Header */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-mono text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 tracking-wide">
                                            {order.orderNumber}
                                        </div>
                                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${order.status === 'Delivered' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {order.status}
                                        </div>
                                    </div>

                                    <div className="text-white font-medium text-sm mb-2">{order.customer}</div>

                                    <div className="text-xs text-gray-400 mb-3 flex items-start gap-1.5">
                                        <MapPin size={12} className="mt-0.5 shrink-0" />
                                        {order.deliveryAddress || 'No Address'}
                                    </div>

                                    <div className="bg-black/30 rounded-lg p-2 space-y-1">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-xs">
                                                <span className="text-gray-300">{item.product}</span>
                                                <span className="font-mono text-gray-400">x{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {order.notes && (
                                        <div className="mt-2 text-[10px] text-yellow-500/80 italic">
                                            Note: {order.notes}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Draggable>
                    ))}
                    {provided.placeholder}
                    {orders.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex items-center justify-center h-16 text-[10px] text-gray-700 uppercase tracking-widest border border-dashed border-white/5 rounded-lg">
                            Drop here
                        </div>
                    )}
                </div>
            )}
        </Droppable>
    </div>
);

export default OrderSummary;
