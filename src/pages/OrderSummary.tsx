import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { SalesOrder, User } from '../types';
import { Calendar, User as UserIcon, Truck, MapPin, Package } from 'lucide-react';

// --- WAREHOUSE CONFIGURATION ---
const WAREHOUSES = ['SPD', 'OPM LAMA', 'OPM CORNER', 'NILAI'] as const;
type Warehouse = typeof WAREHOUSES[number];

const WAREHOUSE_KEYWORDS: Record<Warehouse, string[]> = {
    'SPD': ['SPD'],
    'OPM LAMA': ['OPM Lama', 'OPM LAMA', 'OPM_LAMA', 'OPMLAMA'],
    'OPM CORNER': ['OPM Corner', 'OPM CORNER', 'OPM_CORNER', 'OPMCORNER'],
    'NILAI': ['NILAI', 'Nilai'],
};

const WAREHOUSE_COLOR: Record<Warehouse, string> = {
    'SPD': 'blue',
    'OPM LAMA': 'violet',
    'OPM CORNER': 'amber',
    'NILAI': 'emerald',
};

const TAIPING_WAREHOUSES: Warehouse[] = ['SPD', 'OPM LAMA', 'OPM CORNER'];

interface OrderSummaryProps {
    user?: any;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ user }) => {
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [drivers, setDrivers] = useState<User[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    // Determine allowed tabs per user
    const isNeoson = user?.employeeId === '009';
    const isEric = user?.email === 'ericsoobaolin0219@gmail.com';

    const allowedTabs: Warehouse[] = isNeoson
        ? TAIPING_WAREHOUSES
        : isEric
            ? ['NILAI']
            : [...WAREHOUSES];

    const [activeTab, setActiveTab] = useState<Warehouse>(allowedTabs[0]);

    // Keep active tab valid if user context changes
    useEffect(() => {
        if (!allowedTabs.includes(activeTab)) {
            setActiveTab(allowedTabs[0]);
        }
    }, [isNeoson, isEric]);

    // --- FETCH ---
    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: driversData } = await supabase
                .from('users_public')
                .select('*')
                .eq('role', 'Driver');

            if (driversData) {
                const mappedDrivers: User[] = driversData.map(u => ({
                    uid: u.id,
                    email: u.email,
                    name: u.name || u.email?.split('@')[0] || 'Unknown Driver',
                    role: 'Driver',
                    factoryId: u.factory_id
                } as any));
                setDrivers(mappedDrivers);
            }

            const { data: ordersData } = await supabase
                .from('sales_orders')
                .select('*')
                .neq('status', 'Cancelled')
                .neq('status', 'Delivered')
                .or(`order_date.eq.${selectedDate},deadline.eq.${selectedDate}`);

            if (ordersData) {
                const mappedOrders: SalesOrder[] = ordersData.map(o => ({
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

                const dailyOrders = mappedOrders.filter(o => {
                    const dateToCheck = o.deadline || o.orderDate;
                    return dateToCheck === selectedDate;
                });

                setOrders(dailyOrders);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [selectedDate]);

    // --- WAREHOUSE CLASSIFICATION ---
    const getOrderWarehouse = (o: SalesOrder): Warehouse | null => {
        // 1. Check item remarks for warehouse keywords
        for (const wh of WAREHOUSES) {
            const keywords = WAREHOUSE_KEYWORDS[wh];
            const matched = o.items.some(item =>
                item.remark && keywords.some(k =>
                    item.remark!.toLowerCase().includes(k.toLowerCase())
                )
            );
            if (matched) return wh;
        }
        // 2. Fallback: factory_id
        if (o.factoryId === 'N1' || o.factoryId === 'N2') return 'NILAI';
        if (o.factoryId === 'T1') return 'SPD'; // Default Taiping → SPD
        return null;
    };

    // Build per-warehouse order lists
    const warehouseOrders: Record<Warehouse, SalesOrder[]> = {
        'SPD': [], 'OPM LAMA': [], 'OPM CORNER': [], 'NILAI': [],
    };
    orders.forEach(o => {
        const wh = getOrderWarehouse(o);
        if (wh) warehouseOrders[wh].push(o);
    });

    // Active tab's orders, sorted by trip sequence
    const activeOrders = [...(warehouseOrders[activeTab] || [])].sort(
        (a, b) => (a.tripSequence || 99) - (b.tripSequence || 99)
    );

    // Group by driver
    const groupByDriver = (list: SalesOrder[]) => {
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

    const getDriverName = (id: string) =>
        drivers.find(d => d.uid === id)?.name || 'Unknown Driver';

    // --- COMPONENTS ---
    const color = WAREHOUSE_COLOR[activeTab];

    const colorClass = {
        blue: { tab: 'border-blue-500 text-blue-400 bg-blue-500/10', badge: 'bg-blue-500/20 text-blue-300', unassigned: 'border-red-500/10', header: 'text-blue-400' },
        violet: { tab: 'border-violet-500 text-violet-400 bg-violet-500/10', badge: 'bg-violet-500/20 text-violet-300', unassigned: 'border-red-500/10', header: 'text-violet-400' },
        amber: { tab: 'border-amber-500 text-amber-400 bg-amber-500/10', badge: 'bg-amber-500/20 text-amber-300', unassigned: 'border-red-500/10', header: 'text-amber-400' },
        emerald: { tab: 'border-emerald-500 text-emerald-400 bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', unassigned: 'border-red-500/10', header: 'text-emerald-400' },
    }[color];

    const OrderCard = ({ order }: { order: SalesOrder }) => (
        <div className="bg-[#1a1a1e] border border-white/5 rounded-xl p-4 mb-3 hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="text-blue-400 font-bold text-sm mb-0.5">{order.orderNumber}</div>
                    <div className="text-white font-medium">{order.customer}</div>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${order.status === 'Delivered' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                    {order.status}
                </div>
            </div>

            <div className="text-xs text-gray-400 mb-3 flex items-start gap-1.5">
                <MapPin size={12} className="mt-0.5 shrink-0" />
                {order.deliveryAddress || 'No Address'}
            </div>

            <div className="bg-black/40 rounded-lg p-2 space-y-1">
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
    );

    const { byDriver, unassigned } = groupByDriver(activeOrders);

    // Production summary: aggregate qty by product for active tab
    const productSummary = activeOrders.reduce((acc, order) => {
        order.items.forEach(item => {
            acc[item.product] = (acc[item.product] || 0) + (item.quantity || 0);
        });
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="p-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Daily Prep List</h1>
                    <p className="text-gray-400 text-sm">Daily Production &amp; Delivery Preparation</p>
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

            {/* Warehouse Tabs */}
            <div className="flex mb-6 bg-[#0a0a0c] rounded-xl overflow-hidden border border-white/5">
                {allowedTabs.map(wh => {
                    const c = WAREHOUSE_COLOR[wh];
                    const isActive = activeTab === wh;
                    const borderColor = {
                        blue: 'border-blue-500 text-blue-400 bg-blue-500/10',
                        violet: 'border-violet-500 text-violet-400 bg-violet-500/10',
                        amber: 'border-amber-500 text-amber-400 bg-amber-500/10',
                        emerald: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
                    }[c];
                    return (
                        <button
                            key={wh}
                            onClick={() => setActiveTab(wh)}
                            className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${isActive
                                    ? borderColor
                                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            {wh}
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-xs">
                                {warehouseOrders[wh].length}
                            </span>
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500 animate-pulse">Loading orders...</div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

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

                    {/* ORDER CARDS — grouped by driver */}
                    {activeOrders.length === 0 ? (
                        <div className="text-center py-20 text-gray-600 italic border border-dashed border-white/5 rounded-xl">
                            No orders for {activeTab} on this date.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Unassigned */}
                            {unassigned.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-xs px-2">
                                        <UserIcon size={14} /> Unassigned
                                        <span className="bg-red-500/10 px-1.5 rounded text-[10px]">{unassigned.length}</span>
                                    </div>
                                    <div className="bg-[#121215] rounded-xl border border-red-500/10 p-2 min-h-[100px]">
                                        {unassigned.map(o => <OrderCard key={o.id} order={o} />)}
                                    </div>
                                </div>
                            )}

                            {/* By Driver */}
                            {Object.entries(byDriver).map(([driverId, driverOrders]) => (
                                <div key={driverId} className="space-y-4">
                                    <div className="flex items-center gap-2 text-gray-400 font-bold uppercase tracking-wider text-xs px-2">
                                        <Truck size={14} /> {getDriverName(driverId)}
                                        <span className="bg-white/5 px-1.5 rounded text-[10px] ml-auto">{driverOrders.length} DOs</span>
                                    </div>
                                    <div className="bg-[#121215] rounded-xl border border-white/5 p-2 h-full">
                                        {driverOrders.map(o => <OrderCard key={o.id} order={o} />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OrderSummary;
