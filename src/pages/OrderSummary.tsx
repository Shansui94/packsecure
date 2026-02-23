import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { SalesOrder, User } from '../types';
import { Calendar, User as UserIcon, Truck, MapPin, Package, GripVertical } from 'lucide-react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- LOCATION CONFIGURATION ---
const LOCATIONS = ['Taiping', 'Nilai'] as const;
type Location = typeof LOCATIONS[number];

const TAIPING_KEYWORDS = ['SPD', 'OPM Lama', 'OPM LAMA', 'OPM_LAMA', 'OPMLAMA', 'OPM Corner', 'OPM CORNER', 'OPM_CORNER', 'OPMCORNER'];
const NILAI_KEYWORDS = ['NILAI', 'Nilai'];

const LOCATION_COLOR: Record<Location, string> = {
    'Taiping': 'blue',
    'Nilai': 'emerald',
};

const UNASSIGNED_COLUMN = '__unassigned__';

interface OrderSummaryProps {
    user?: any;
}

// ─── Draggable Order Card ────────────────────────────────────────────────────
const SortableOrderCard: React.FC<{ order: SalesOrder; isDragging?: boolean }> = ({ order, isDragging }) => {
    const { attributes, listeners, setNodeRef, transform, transition, over } = useSortable({ id: order.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        cursor: 'grab',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="mb-3">
            <div className={`bg-[#1a1a1e] border rounded-xl p-4 transition-all ${isDragging ? 'border-blue-500/50' : 'border-white/5 hover:border-white/10'
                }`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Drag handle */}
                        <div {...listeners} className="cursor-grab touch-none text-slate-600 hover:text-slate-400 shrink-0">
                            <GripVertical size={14} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-blue-400 font-bold text-sm mb-0.5">{order.orderNumber}</div>
                            <div className="text-white font-medium truncate">{order.customer}</div>
                        </div>
                    </div>
                    <div className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase ${order.status === 'Delivered' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                        {order.status}
                    </div>
                </div>

                <div className="text-xs text-gray-400 mb-3 flex items-start gap-1.5 ml-5">
                    <MapPin size={12} className="mt-0.5 shrink-0" />
                    {order.deliveryAddress || 'No Address'}
                </div>

                <div className="bg-black/40 rounded-lg p-2 space-y-1 ml-5">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                            <span className="text-gray-300">{item.product}</span>
                            <span className="font-mono text-gray-400">x{item.quantity}</span>
                        </div>
                    ))}
                </div>

                {order.notes && (
                    <div className="mt-2 text-[10px] text-yellow-500/80 italic ml-5">
                        Note: {order.notes}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Driver Column (Droppable) ───────────────────────────────────────────────
const DriverColumn: React.FC<{
    columnId: string;
    label: string;
    orders: SalesOrder[];
    isUnassigned?: boolean;
    isOver?: boolean;
}> = ({ columnId, label, orders, isUnassigned, isOver }) => {
    return (
        <div className="space-y-3">
            <div className={`flex items-center gap-2 font-bold uppercase tracking-wider text-xs px-2 ${isUnassigned ? 'text-red-400' : 'text-gray-400'
                }`}>
                {isUnassigned ? <UserIcon size={14} /> : <Truck size={14} />}
                {label}
                <span className={`px-1.5 rounded text-[10px] ml-auto ${isUnassigned ? 'bg-red-500/10 text-red-400' : 'bg-white/5'
                    }`}>{orders.length} DOs</span>
            </div>
            <div
                className={`rounded-xl border p-2 min-h-[100px] transition-all duration-150 ${isOver
                        ? isUnassigned
                            ? 'border-red-500/50 bg-red-500/5'
                            : 'border-blue-500/40 bg-blue-500/5'
                        : isUnassigned
                            ? 'border-red-500/10 bg-[#121215]'
                            : 'border-white/5 bg-[#121215]'
                    }`}
            >
                <SortableContext items={orders.map(o => o.id)} strategy={verticalListSortingStrategy}>
                    {orders.map(o => (
                        <SortableOrderCard key={o.id} order={o} />
                    ))}
                </SortableContext>
                {orders.length === 0 && (
                    <div className="flex items-center justify-center h-16 text-[10px] text-gray-700 uppercase tracking-widest border border-dashed border-white/5 rounded-lg">
                        Drop here
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const OrderSummary: React.FC<OrderSummaryProps> = ({ user: _user }) => {
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [drivers, setDrivers] = useState<User[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Location>('Taiping');

    // DnD state
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    // --- FETCH ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: driversData } = await supabase
                .from('users_public')
                .select('*')
                .eq('role', 'Driver');

            if (driversData) {
                setDrivers(driversData.map(u => ({
                    uid: u.id,
                    email: u.email,
                    name: u.name || u.email?.split('@')[0] || 'Unknown Driver',
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

                setOrders(mapped.filter(o => {
                    const d = o.deadline || o.orderDate;
                    return d === selectedDate;
                }));
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

    // Active tab orders sorted
    const activeTabOrders = [...(locationOrders[activeTab] || [])].sort(
        (a, b) => (a.tripSequence ?? 99) - (b.tripSequence ?? 99)
    );

    // Group by driver for current tab
    const buildColumns = (list: SalesOrder[]) => {
        const byDriver: Record<string, SalesOrder[]> = {};
        const unassigned: SalesOrder[] = [];
        list.forEach(o => {
            if (o.driverId && o.driverId !== 'unassigned') {
                if (!byDriver[o.driverId]) byDriver[o.driverId] = [];
                byDriver[o.driverId].push(o);
            } else {
                unassigned.push(o);
            }
        });
        return { byDriver, unassigned };
    };

    const { byDriver, unassigned } = buildColumns(activeTabOrders);

    const getDriverName = (id: string) =>
        drivers.find(d => d.uid === id)?.name || 'Unknown Driver';

    const activeOrder = activeId ? orders.find(o => o.id === activeId) : null;

    // Find which column ID an order belongs to
    const getColumnOfOrder = (orderId: string): string => {
        const o = orders.find(x => x.id === orderId);
        if (!o) return UNASSIGNED_COLUMN;
        if (!o.driverId || o.driverId === 'unassigned') return UNASSIGNED_COLUMN;
        return o.driverId;
    };

    // The column that is currently being hovered over
    const getTargetColumn = (overIdRaw: string | null): string | null => {
        if (!overIdRaw) return null;
        // overId is either a column header id or an order id
        if (overIdRaw === UNASSIGNED_COLUMN) return UNASSIGNED_COLUMN;
        if (drivers.find(d => d.uid === overIdRaw)) return overIdRaw; // it's a driver id
        // it's an order id — find which column it's in
        return getColumnOfOrder(overIdRaw);
    };

    // --- DND HANDLERS ---
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        setOverId(event.over?.id as string ?? null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);

        if (!over || active.id === over.id) return;

        const draggedId = active.id as string;
        const overId = over.id as string;

        const sourceCol = getColumnOfOrder(draggedId);
        const targetCol = getTargetColumn(overId) ?? sourceCol;

        if (sourceCol !== targetCol) {
            // ── Moved to different column: update driver_id ──
            const newDriverId = targetCol === UNASSIGNED_COLUMN ? null : targetCol;

            // Optimistic update
            setOrders(prev => prev.map(o =>
                o.id === draggedId ? { ...o, driverId: newDriverId ?? undefined } : o
            ));

            // Persist
            const { error } = await supabase
                .from('sales_orders')
                .update({ driver_id: newDriverId })
                .eq('id', draggedId);

            if (error) {
                console.error('Failed to update driver:', error);
                fetchData(); // rollback
            }
        } else {
            // ── Same column: reorder trip_sequence ──
            const colOrders = sourceCol === UNASSIGNED_COLUMN
                ? [...unassigned]
                : [...(byDriver[sourceCol] || [])];

            const oldIdx = colOrders.findIndex(o => o.id === draggedId);
            const newIdx = colOrders.findIndex(o => o.id === overId);
            if (oldIdx === -1 || newIdx === -1) return;

            const reordered = arrayMove(colOrders, oldIdx, newIdx);

            // Assign new trip_sequence values (1-based)
            const updates = reordered.map((o, idx) => ({
                id: o.id,
                trip_sequence: idx + 1,
            }));

            // Optimistic update
            setOrders(prev => prev.map(o => {
                const u = updates.find(x => x.id === o.id);
                return u ? { ...o, tripSequence: u.trip_sequence } : o;
            }));

            // Persist all in parallel
            await Promise.all(
                updates.map(u =>
                    supabase.from('sales_orders').update({ trip_sequence: u.trip_sequence }).eq('id', u.id)
                )
            );
        }
    };

    // Production summary
    const productSummary = activeTabOrders.reduce((acc, order) => {
        order.items.forEach(item => {
            acc[item.product] = (acc[item.product] || 0) + (item.quantity || 0);
        });
        return acc;
    }, {} as Record<string, number>);

    // All columns for DnD context (need all order ids + column drop zones)
    const allItems = activeTabOrders.map(o => o.id);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="p-6 max-w-7xl mx-auto pb-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Daily Prep List</h1>
                        <p className="text-gray-400 text-sm">Daily Production &amp; Delivery Preparation — drag cards to reassign drivers or reorder</p>
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
                        const borderColor = {
                            blue: 'border-blue-500 text-blue-400 bg-blue-500/10',
                            emerald: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
                        }[c];
                        return (
                            <button
                                key={loc}
                                onClick={() => setActiveTab(loc)}
                                className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${isActive ? borderColor : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
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
                    <div className="animate-in fade-in duration-300">
                        {/* PRODUCTION SUMMARY */}
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

                        {/* KANBAN COLUMNS */}
                        {activeTabOrders.length === 0 ? (
                            <div className="text-center py-20 text-gray-600 italic border border-dashed border-white/5 rounded-xl">
                                No orders for {activeTab} on this date.
                            </div>
                        ) : (
                            <SortableContext items={allItems} strategy={verticalListSortingStrategy}>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Unassigned */}
                                    {(unassigned.length > 0 || activeId) && (
                                        <DriverColumn
                                            columnId={UNASSIGNED_COLUMN}
                                            label="Unassigned"
                                            orders={unassigned}
                                            isUnassigned
                                            isOver={getTargetColumn(overId) === UNASSIGNED_COLUMN}
                                        />
                                    )}

                                    {/* Per-driver columns */}
                                    {Object.entries(byDriver).map(([driverId, driverOrders]) => (
                                        <DriverColumn
                                            key={driverId}
                                            columnId={driverId}
                                            label={getDriverName(driverId)}
                                            orders={driverOrders}
                                            isOver={getTargetColumn(overId) === driverId}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        )}
                    </div>
                )}
            </div>

            {/* Drag Overlay — ghost card while dragging */}
            <DragOverlay>
                {activeOrder ? (
                    <div className="bg-[#1a1a1e] border border-blue-500/60 rounded-xl p-4 shadow-2xl shadow-blue-500/20 opacity-95 rotate-1">
                        <div className="text-blue-400 font-bold text-sm">{activeOrder.orderNumber}</div>
                        <div className="text-white font-medium">{activeOrder.customer}</div>
                        <div className="text-xs text-gray-500 mt-1">{activeOrder.deliveryAddress}</div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default OrderSummary;
