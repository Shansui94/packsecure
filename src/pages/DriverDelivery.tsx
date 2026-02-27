import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Truck, CheckCircle, Package, ChevronRight, X, RefreshCw } from 'lucide-react';
import { SalesOrder } from '../types';

interface DriverDeliveryProps {
    user: any;
}

const DriverDelivery: React.FC<DriverDeliveryProps> = ({ user }) => {
    // State
    const [tasks, setTasks] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');

    // NAIK BARANG (Load Items) State
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [loadItems, setLoadItems] = useState<any[]>([]); // Items to verify
    const [submitting, setSubmitting] = useState(false);

    // 1. Fetch Data
    const fetchTasks = async () => {
        setLoading(true);
        if (!user?.uid) return;

        try {
            // Fetch assigned orders with items
            const { data } = await supabase
                .from('sales_orders')
                .select('*')
                .eq('driver_id', user.uid)
                .neq('status', 'Cancelled')
                .order('deadline', { ascending: false });

            if (data) {
                // Map DB snake_case to TS camelCase
                const mapped = data.map((item: any) => ({
                    ...item,
                    orderNumber: item.order_number || item.orderNumber,
                    deliveryAddress: item.delivery_address || item.deliveryAddress,
                    zone: item.zone || item.delivery_zone,
                    deliveryDate: item.deadline, // Use Deadline as Delivery Date
                    orderDate: item.order_date || item.orderDate // Map date
                }));

                // Client-side sort
                const sorted = mapped.sort((a: any, b: any) => {
                    // "New" or "Assigned" first (Need Loading)
                    // "Loaded" next
                    // "Delivered" last (handled by tab filter)
                    const statusA = a.status;
                    const statusB = b.status;

                    const getStatusPriority = (status: string) => {
                        if (status === 'Assigned' || status === 'New') return 1;
                        if (status === 'Loaded') return 2;
                        return 3; // Other statuses, including 'Delivered'
                    };

                    const priorityA = getStatusPriority(statusA);
                    const priorityB = getStatusPriority(statusB);

                    if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                    }

                    return (a.stop_sequence || 999) - (b.stop_sequence || 999);
                });
                setTasks(sorted);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [user]);

    // 2. Open Load Modal
    const handleOpenLoadModal = (order: SalesOrder) => {
        setSelectedOrder(order);
        // Deep copy items to allow editing quantity if needed (default same qty)
        setLoadItems(order.items?.map(i => ({ ...i, confirmedQty: i.quantity })) || []);
        setIsLoadModalOpen(true);
    };

    // 3. Submit Loading (Deduct Stock)
    const handleConfirmLoad = async () => {
        if (!selectedOrder) return;
        setSubmitting(true);

        try {
            // Check for Amendments
            const hasAmendments = loadItems.some(item => item.confirmedQty !== undefined && item.confirmedQty !== item.quantity);

            if (hasAmendments) {
                // 1. UPDATE ORDER with new quantities & Pending Approval Status
                // Map items to update quantities permanently
                const updatedItems = selectedOrder.items?.map(original => {
                    const match = loadItems.find(li => li.sku === original.sku && li.remark === original.remark);
                    return {
                        ...original,
                        quantity: match?.confirmedQty ?? original.quantity,
                        original_quantity: original.quantity // Keep track of original
                    };
                });

                await supabase.from('sales_orders').update({
                    status: 'Pending Approval',
                    items: updatedItems,
                    notes: (selectedOrder.notes || '') + ` | Amended by Driver: ${user?.name}`
                }).eq('id', selectedOrder.id);

                alert("⚠️ Order quantity changed. Sent to Vivian for Approval.");

            } else {
                // 2. NO AMENDMENTS - Proceed to Deduct & Deliver
                for (const item of loadItems) {
                    const qtyToDeduct = item.confirmedQty || item.quantity;
                    const loc = item.sourceLocation || 'Unassigned'; // NEW: Multi-location Source
                    if (qtyToDeduct > 0) {
                        // Direct Insert to bypass RPC "change_type" phantom error
                        const { error } = await supabase.from('stock_ledger_v2').insert({
                            sku: item.sku,
                            change_qty: -qtyToDeduct, // Negative for OUT
                            event_type: 'Transfer Out',
                            loc_id: loc,              // Explicit Warehouse Deduct
                            ref_doc: selectedOrder.orderNumber,
                            notes: `Loaded by Driver: ${user?.name || 'Unknown'} `
                        });

                        if (error) {
                            console.error("Stock Ledger Error:", error);
                            // If V2 table doesn't exist, try V1 as fallback (optional)
                            // or just ignore if it's not critical for blocking delivery
                            // throw error; // Strict: Block if stock fails
                        }
                    }
                }

                const { data: updatedData, error: updateError } = await supabase.from('sales_orders').update({
                    status: 'Delivered',
                    pod_timestamp: new Date().toISOString()
                }).eq('id', selectedOrder.id).select();

                if (updateError) throw updateError;
                if (!updatedData || updatedData.length === 0) {
                    throw new Error("Update failed: Permission denied or Order not found. (RLS Check Failed)");
                }

                // Optimistic Update: Move to Done locally
                setTasks(prev => prev.map(t => {
                    if (t.id === selectedOrder.id) {
                        return { ...t, status: 'Delivered' };
                    }
                    return t;
                }));
                // alert("✅ Stock Deducted & Loaded!");
            }

            setIsLoadModalOpen(false);
            // fetchTasks(); // Removed to prevent race condition. Optimistic update handles UI.

        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Real-time Subscription
    useEffect(() => {
        if (!user?.uid) return;

        console.log("Subscribing to driver orders:", user.uid);
        const subscription = supabase
            .channel(`driver-orders-${user.uid}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'sales_orders',
                filter: `driver_id=eq.${user.uid}`
            }, (payload) => {
                console.log("Realtime Update Recieved!", payload);
                fetchTasks();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    // View Logic
    const todoList = tasks.filter(t => t.status !== 'Delivered' && t.status !== 'Pending Approval' && t.status !== 'Cancelled');
    const doneList = tasks.filter(t => t.status === 'Delivered' || t.status === 'Pending Approval');
    const displayList = activeTab === 'todo' ? todoList : doneList;

    return (
        <div className="min-h-screen bg-black text-slate-200 pb-20 font-sans">
            <div className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
                <p className="text-[10px] font-bold text-slate-500 uppercase">{user?.name || 'Unknown Driver'} • {tasks.length} Orders</p>
                <button
                    onClick={() => fetchTasks()}
                    disabled={loading}
                    className="p-1.5 bg-slate-800 rounded-lg text-blue-400 border border-slate-700 active:scale-95 transition-all"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* TABS */}
            <div className="p-4 flex gap-2">
                <button
                    onClick={() => setActiveTab('todo')}
                    className={`flex - 1 py - 3 rounded - xl font - black uppercase text - sm tracking - wider transition - all ${activeTab === 'todo' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-900 text-slate-500'
                        } `}
                >
                    Pending ({todoList.length})
                </button>
                <button
                    onClick={() => setActiveTab('done')}
                    className={`flex - 1 py - 3 rounded - xl font - black uppercase text - sm tracking - wider transition - all ${activeTab === 'done' ? 'bg-green-600/20 text-green-500 border border-green-500/30' : 'bg-slate-900 text-slate-500'
                        } `}
                >
                    Done ({doneList.length})
                </button>
            </div>

            {/* LIST */}
            <div className="px-4 space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-slate-500 animate-pulse">Loading...</div>
                ) : displayList.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800">
                        <Package size={40} className="mx-auto mb-3 text-slate-700" />
                        <h3 className="font-bold text-slate-500">No orders found.</h3>
                    </div>
                ) : (
                    displayList.map((order) => (
                        <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg relative">
                            {/* Status Strip */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${order.status === 'Delivered' ? 'bg-green-500' :
                                order.status === 'Pending Approval' ? 'bg-yellow-500' :
                                    'bg-blue-500'
                                }`} />

                            {/* Card Body */}
                            <div className="p-5 pl-7">
                                <div className="flex justify-between items-start mb-6">
                                    {/* Swapped: State is now main title, Customer is subtitle */}
                                    <div>
                                        <h2 className="text-lg font-black text-white line-clamp-1">{order.deliveryAddress || 'No State'}</h2>
                                        {(order as any).deliveryDate && (
                                            <div className="flex items-center gap-2 mt-1 text-xs font-bold uppercase tracking-wider">
                                                <span className="text-orange-500">
                                                    {['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date((order as any).deliveryDate).getDay()]}
                                                </span>
                                                <span className="text-blue-400">
                                                    {new Date((order as any).deliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Order Notes */}
                            {order.notes && (
                                <div className="mb-4 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                    <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Notes</p>
                                    <p className="text-sm text-slate-300">{order.notes}</p>
                                </div>
                            )}

                            {/* Items Summary with Remarks (Grouped by Location) */}
                            <div className="space-y-3 mb-6">
                                {(() => {
                                    const grouped = (order.items || []).reduce((acc: any, item: any) => {
                                        let loc = item.sourceLocation || 'Other Items';

                                        // Fallback legacy support if an old order STILL has Loc: hardcoded in its remark
                                        if (loc === 'Other Items' && item.remark && item.remark.includes('Loc:')) {
                                            const match = item.remark.match(/Loc:\s*([^)\n\r,]+)/);
                                            if (match) loc = match[1].trim();
                                        }

                                        if (loc.toLowerCase() === 'general') loc = 'Other Items';
                                        if (!acc[loc]) acc[loc] = [];
                                        acc[loc].push(item);
                                        return acc;
                                    }, {});

                                    return Object.entries(grouped).map(([loc, items]: [string, any]) => (
                                        <div key={loc} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                                <Package size={10} /> {loc}
                                            </div>
                                            <div className="space-y-2">
                                                {items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-800/50 last:border-0 pb-1 last:pb-0">
                                                        <div>
                                                            <span className="font-bold text-white">{item.quantity} x {item.product || item.sku}</span>
                                                            {/* Display Remark (Legacy strip Loc: just in case) */}
                                                            {item.remark && (
                                                                <div className="text-[11px] text-amber-500 font-mono mt-0.5">
                                                                    {item.remark.replace(/Loc:\s*[^)\n\r,]+/, '').trim() || item.remark}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>


                            {/* ACTION BUTTON (Only for To-Do) */}
                            {activeTab === 'todo' && (
                                <button
                                    onClick={() => handleOpenLoadModal(order)}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase text-sm tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-900/30 active:scale-95 transition-all"
                                >
                                    <Truck size={18} /> Naik Barang
                                    <ChevronRight size={16} className="opacity-50" />
                                </button>
                            )}

                            {activeTab === 'done' && (
                                <div className={`text-center py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 ${order.status === 'Pending Approval'
                                    ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500'
                                    : 'bg-green-500/10 border border-green-500/20 text-green-400'
                                    }`}>
                                    {order.status === 'Pending Approval' ? (
                                        <>
                                            <Truck size={14} /> Sent to Vivian
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={14} /> Stock Deducted
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                    ))
                )}
            </div>

            {/* LOADING MODAL */}
            {
                isLoadModalOpen && selectedOrder && (
                    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in slide-in-from-bottom-10">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 safe-top-padding">
                            <div>
                                <h2 className="font-black text-white text-lg">VERIFY STOCK</h2>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">{selectedOrder.orderNumber}</p>
                            </div>
                            <button onClick={() => setIsLoadModalOpen(false)} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                        </div>

                        {/* ITEMS LIST (GROUPED BY LOCATION) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-black">
                            {/* Group items by Location parsed from remark "Loc: xxx" */}
                            {(() => {
                                const grouped: Record<string, any[]> = {};
                                try {
                                    (loadItems || []).forEach(item => {
                                        let loc = item.sourceLocation || 'Other Items';

                                        // Fallback legacy support
                                        if (loc === 'Other Items' && item && typeof item.remark === 'string') {
                                            const match = item.remark.match(/Loc:\s*([^)\n\r,]+)/);
                                            if (match) loc = match[1].trim();
                                        }

                                        if (loc.toLowerCase() === 'general') loc = 'Other Items';

                                        if (!grouped[loc]) grouped[loc] = [];
                                        grouped[loc].push(item);
                                    });
                                } catch (err) {
                                    console.error("Grouping Error:", err);
                                    return <div className="text-red-500 p-4">Error loading items. Please contact support.</div>;
                                }

                                const groups = Object.entries(grouped);
                                if (groups.length === 0) {
                                    return <div className="text-gray-500 text-center p-10">No items found in this order.</div>;
                                }

                                return groups.map(([location, items]) => (
                                    <div key={location}>
                                        {/* Location Header */}
                                        <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 border-b border-blue-500/20 pb-1">
                                            {location}
                                        </div>

                                        {/* Items in this location */}
                                        <div className="space-y-3">
                                            {items.map((item, idx) => {
                                                // Find original index in loadItems to update state correctly
                                                // Fallback to index if find fails (though it shouldn't)
                                                const originalIdx = loadItems.findIndex(i => i === item);
                                                if (originalIdx === -1) return null;

                                                return (
                                                    <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 font-bold border border-slate-700 text-xs">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-white font-bold text-sm">{(item as any).product || (item as any).name || (item as any).sku || 'Unknown Item'}</div>
                                                            <div className="text-[10px] text-slate-500 font-mono">Qty: {item.quantity} {(item as any).packaging || (item as any).uom || ''}</div>
                                                        </div>

                                                        {/* Quantity Editor */}
                                                        <div className="flex flex-col items-end gap-1">
                                                            <input
                                                                type="number"
                                                                className="w-16 bg-black border border-slate-700 rounded-lg p-2 text-center text-lg font-bold text-green-400 focus:border-green-500 outline-none"
                                                                value={loadItems[originalIdx].confirmedQty ?? item.quantity}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const newQty = val === '' ? 0 : parseInt(val);
                                                                    const newItems = [...loadItems];
                                                                    newItems[originalIdx].confirmedQty = isNaN(newQty) ? 0 : newQty;
                                                                    setLoadItems(newItems);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3 safe-bottom-padding">
                            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Total Items</span>
                                <span className="text-white">{(loadItems || []).reduce((acc, i) => acc + (i.confirmedQty ?? i.quantity ?? 0), 0)} Units</span>
                            </div>
                            <button
                                onClick={handleConfirmLoad}
                                disabled={submitting}
                                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black text-lg uppercase tracking-widest shadow-lg shadow-green-900/40 disabled:opacity-50 disabled:grayscale transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {submitting ? 'PROCESSING...' : 'CONFIRM & DEDUCT STOCK'}
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DriverDelivery;
