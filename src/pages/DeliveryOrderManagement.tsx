import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { determineZone, determineState, findBestFactory } from '../utils/logistics';
import {
    Plus, Search, Calendar, FileText, X, Truck,
    User as UserIcon, Box, Zap, Trash2, Scissors, AlertTriangle, MapPin, Wrench
} from 'lucide-react';
import { WAREHOUSES } from '../data/factoryData';
import {
    SalesOrder,
    User,
    Lorry
} from '../types';
import { V2Item } from '../types/v2';



// Reusable Searchable Select Component (Ported from SimpleStock for consistency)
interface SearchableSelectProps {
    label?: string;
    icon?: React.ReactNode;
    options: { value: string; label: string; subLabel?: string; statusLabel?: string; statusColor?: string }[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    minimal?: boolean; // For cleaner look
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, icon, options, value, onChange, placeholder = "Search...", minimal = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    // Derived state for display
    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative w-full">
            {label && (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
                    {icon} {label}
                </label>
            )}

            {/* Input / Trigger */}
            <div
                className={`w-full bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3 cursor-pointer hover:border-slate-700 transition-colors ${minimal ? 'p-3' : 'px-4 py-4'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Search size={16} className="text-slate-500" />

                {selectedOption ? (
                    <div className="flex-1">
                        <div className={`font-bold text-white ${minimal ? 'text-sm' : ''}`}>{selectedOption.label}</div>
                        {selectedOption.subLabel && !minimal && (
                            <div className="text-xs text-slate-500 font-mono">{selectedOption.subLabel}</div>
                        )}
                    </div>
                ) : (
                    <input
                        type="text"
                        placeholder={placeholder}
                        className="bg-transparent border-none outline-none text-white placeholder:text-slate-600 w-full"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setIsOpen(true);
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}

                {selectedOption ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                            setSearch('');
                        }}
                        className="p-1 hover:bg-slate-800 rounded-full text-slate-500"
                    >
                        <X size={16} />
                    </button>
                ) : null}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1e] border border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-800/50">
                        {options
                            .filter(opt =>
                                !search ||
                                opt.label.toLowerCase().includes(search.toLowerCase()) ||
                                (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
                            )
                            .map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className="p-3 hover:bg-slate-800 cursor-pointer flex justify-between items-center group transition-colors"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-gray-200 group-hover:text-white">{opt.label}</div>
                                        {opt.subLabel && <div className="text-[10px] text-gray-500 font-mono">{opt.subLabel}</div>}
                                    </div>
                                    {opt.statusColor && opt.statusLabel && (
                                        <div className={`text-[10px] font-bold ${opt.statusColor} bg-white/10 px-2 py-0.5 rounded uppercase`}>
                                            {opt.statusLabel}
                                        </div>
                                    )}
                                </div>
                            ))}
                        {options.filter(opt =>
                            !search ||
                            opt.label.toLowerCase().includes(search.toLowerCase()) ||
                            (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
                        ).length === 0 && (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                    No results found.
                                </div>
                            )}
                    </div>
                </>
            )}
        </div>
    );
};

const DeliveryOrderManagement: React.FC = () => {
    // --- STATE ---
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [drivers, setDrivers] = useState<User[]>([]);
    const [lorries, setLorries] = useState<Lorry[]>([]);
    const [lorryServices, setLorryServices] = useState<any[]>([]); // State for Service Reminders

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');



    // AI / Smart Import State
    // const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Editing State
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

    // New Order Form State
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const getTodayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD 本地时间
    const getTomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); };
    const [newOrderDate, setNewOrderDate] = useState(getTodayStr); // 默认今天
    const [newOrderDeliveryDate, setNewOrderDeliveryDate] = useState(getTomorrowStr); // 默认明天
    const [newOrderItems, setNewOrderItems] = useState<SalesOrder['items']>([]);
    const [orderCustomer, setOrderCustomer] = useState('');
    const [newOrderAddress, setNewOrderAddress] = useState('');
    const [newOrderNotes, setNewOrderNotes] = useState(''); // Batch Note
    const [currentItemQty, setCurrentItemQty] = useState<number>(0);
    const [currentItemRemark, setCurrentItemRemark] = useState('');
    const [selectedV2Item, setSelectedV2Item] = useState<V2Item | null>(null);
    const [currentItemLoc, setCurrentItemLoc] = useState('SPD'); // New Location state

    // --- Driver Payroll Rate State ---
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);
    const [tripOrigin, setTripOrigin] = useState('TAIPING');
    const [tripCategory, setTripCategory] = useState('');
    const [tripDropCount, setTripDropCount] = useState<number>(1);

    const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
    const [reassignOrder, setReassignOrder] = useState<SalesOrder | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'error' | 'success'} | null>(null);

    // Split Order State
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [splitOrder, setSplitOrder] = useState<SalesOrder | null>(null);
    const [splitItems, setSplitItems] = useState<{ [key: number]: number }>({}); // Index -> Qty to transfer
    const [splitTargetDriverId, setSplitTargetDriverId] = useState('');
    const [splitTargetDate, setSplitTargetDate] = useState('');

    // Driver Leave & Service State
    const [driverLeaves, setDriverLeaves] = useState<any[]>([]);
    const [scheduledServices, setScheduledServices] = useState<any[]>([]);


    // AI Autocomplete State
    // AI Autocomplete State (Unused)
    // const [customerDB, setCustomerDB] = useState<any[]>([]);
    // const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
    // const [showSuggestions, setShowSuggestions] = useState(false);

    // Hybrid Item Entry State (Unused)
    // const [entryMode, setEntryMode] = useState<'search' | 'manual'>('search');

    // -- Mode A: V2 Search --
    const [v2Items, setV2Items] = useState<V2Item[]>([]);

    // Fetch Data
    const fetchData = async () => {

        try {
            // 1. Fetch Upcoming Services (Next 2 Weeks) independent of the big Promise.all to avoid index errors
            const today = new Date().toISOString().split('T')[0];
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 14);
            const endDateStr = endDate.toISOString().split('T')[0];

            const { data: serviceData } = await supabase
                .from('lorry_service_requests')
                .select('*')
                .gte('scheduled_date', today)
                .lte('scheduled_date', endDateStr)
                .neq('status', 'Completed');

            if (serviceData) setLorryServices(serviceData);

            const [usersRes, ordersRes, itemsRes, leavesRes, lorriesRes, servicesRes, ratesRes] = await Promise.all([
                supabase.from('users_public').select('*'),
                supabase.from('sales_orders').select('*').order('trip_sequence', { ascending: true }).order('created_at', { ascending: false }),
                getV2Items(),
                supabase.from('driver_leave').select('*'),
                supabase.from('lorries').select('*'),
                supabase.from('lorry_service_requests').select('*').eq('status', 'Scheduled'),
                supabase.from('delivery_rates').select('*').order('location_name')
            ]);

            // ... (rest of existing logic)
            if (ratesRes.data) {
                console.log("DEBUG: deliveryRates fetched -> ", ratesRes.data);
                setDeliveryRates(ratesRes.data);
            } else {
                console.warn("DEBUG: failed to fetch deliveryRates -> ", ratesRes.error);
            }
            if (leavesRes.data) {
                // console.log("Loaded leaves:", leavesRes.data.length); 
                // TEMPORARY DEBUG: Check if we can verify other users' leaves
                if (leavesRes.data.length === 0) console.warn("DEBUG: No leaves loaded! Possible RLS blocking.");
                setDriverLeaves(leavesRes.data);
            }

            if (servicesRes.data) setScheduledServices(servicesRes.data);
            if (itemsRes) setV2Items(itemsRes);
            if (lorriesRes.data) {
                const mappedLorries: Lorry[] = lorriesRes.data.map(l => ({
                    id: l.id,
                    plateNumber: l.plate_number,
                    driverName: l.driver_name || 'No Driver',
                    driverUserId: l.driver_id || '',
                    preferredZone: l.preferred_zone || 'Not Specified',
                    status: l.status || 'Available'
                }));
                setLorries(mappedLorries);
            }

            if (usersRes.data) {
                // Filter locally to ensure complex OR logic is handled correctly
                const filteredUsers = usersRes.data.filter(u =>
                    u.role === 'Driver' ||
                    u.email === 'neosonchun@gmail.com' ||
                    u.email === 'ericsoobaolin0219@gmail.com' ||
                    u.name?.toLowerCase().includes('neoson')
                );

                const mappedDrivers: User[] = filteredUsers.map(u => ({
                    uid: u.id,
                    email: u.email,
                    name: (u.name && u.name.trim() !== '') ? u.name : (u.email?.split('@')[0] || 'Unknown Driver'),
                    role: 'Driver'
                } as any));
                setDrivers(mappedDrivers);
            }

            if (ordersRes.data) {
                const mappedOrders: SalesOrder[] = ordersRes.data.map(o => ({
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
                    tripSequence: o.trip_sequence || 0
                }));
                setOrders(mappedOrders);
            }
        } catch (err) {
            console.error("System Error:", err);
        }
    };

    const formatDateDMY = (dateStr?: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        if (!y || !m || !d) return dateStr;
        return `${d}/${m}/${y}`;
    };

    const checkDriverAvailability = (driverId: string, orderDateStr?: string) => {
        // console.log("Checking availability for:", driverId, orderDateStr);
        // console.log("Leaves:", driverLeaves);

        if (!driverId || driverId === 'unassigned') return true;

        // Helper: Ensure YYYY-MM-DD format (Local Time safe)
        const toDateString = (date: string | Date) => {
            if (!date) return '';
            if (typeof date === 'string') {
                // Check if it looks like an ISO string with time
                if (date.includes('T')) return new Date(date).toLocaleDateString('en-CA');
                return date;
            }
            // Use en-CA for YYYY-MM-DD format in local time
            return new Date(date).toLocaleDateString('en-CA');
        };

        const targetDateStr = toDateString(orderDateStr || new Date());
        const driverName = drivers.find(d => d.uid === driverId)?.name || 'Driver';

        // DEBUG: Temporary check to see if data is loaded
        // if (driverLeaves.length === 0) alert("DEBUG: No leave records loaded!");

        // 1. BLOCK: Check for exact Leave date match
        // 1. BLOCK: Check for exact Leave date match (String Comparison)
        const strictConflict = driverLeaves.filter(l => l.status !== 'Rejected').find(l => {
            if (l.driver_id !== driverId) return false;
            // Robust comparison:
            const startStr = toDateString(l.start_date);
            const endStr = toDateString(l.end_date);
            return targetDateStr >= startStr && targetDateStr <= endStr;
        });

        if (strictConflict) {
            alert(`⛔ BLOCKED: ${driverName} is on leave from ${formatDateDMY(strictConflict.start_date)} to ${formatDateDMY(strictConflict.end_date)}.\n\nCannot assign orders on ${formatDateDMY(targetDateStr)}.`);
            return false;
        }

        // 2. WARN: Near-future Warning (3 days before leave starts)
        // 2. WARN: Near-future Warning (3 days before leave starts)
        const targetDateObj = new Date(targetDateStr);
        const nearConflict = driverLeaves.filter(l => l.status !== 'Rejected').find(l => {
            if (l.driver_id !== driverId) return false;

            const startStr = toDateString(l.start_date);
            const start = new Date(startStr);
            const bufferDate = new Date(startStr);
            bufferDate.setDate(bufferDate.getDate() - 3);

            // Re-convert to objects for consistent comparison (ignoring time)
            return targetDateObj >= bufferDate && targetDateObj < start;
        });

        if (nearConflict) {
            const confirmLeaveWithUser = window.confirm(`💡 LEAVE REMINDER: ${driverName} will be on leave starting ${formatDateDMY(nearConflict.start_date)} (in 3 days or less).\n\nAre you sure you want to assign this trip?`);
            if (!confirmLeaveWithUser) return false;
        }

        // 3. WARN: Service Date Conflict
        // 3. WARN: Service Date Conflict
        const serviceConflict = scheduledServices.find(s => {
            if (s.driver_id !== driverId) return false;
            return toDateString(s.scheduled_date) === targetDateStr;
        });

        if (serviceConflict) {
            const confirmService = window.confirm(`🔧 SERVICE WARNING: The lorry for ${driverName} is scheduled for maintenance on ${formatDateDMY(targetDateStr)}.\n\nProceed with assignment?`);
            if (!confirmService) return false;
        }

        return true;
    };

    useEffect(() => {
        fetchData();

        // 1. Subscribe to Orders (Logging Only - Disabled auto-fetch to protect Optimistic UI)
        const orderInfo = supabase.channel('do-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => {
                console.log("Realtime: Order changed. Fetching...");
                fetchData();
            })
            .subscribe();

        // 2. Subscribe to Drivers (users_public)
        const userInfo = supabase.channel('driver-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users_public' }, () => {
                console.log("Realtime: Driver list changed, fetching...");
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_leave' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lorry_service_requests' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(orderInfo);
            supabase.removeChannel(userInfo);
        };
    }, []);

    // Filter Logic
    const filteredOrders = orders.filter(o =>
        (statusFilter === 'All' ? !['Delivered', 'Cancelled'].includes(o.status) : o.status === statusFilter) &&
        (getDriverName(o.driverId)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.customer.toLowerCase().includes(searchTerm.toLowerCase()))
    );



    // Stock Visibility
    const [stockMap, setStockMap] = useState<Record<string, number>>({});
    useEffect(() => {
        const fetchStock = async () => {
            const { data } = await supabase.rpc('get_live_stock_viewer');
            if (data) {
                const map: Record<string, number> = {};
                data.forEach((item: any) => map[item.sku] = item.current_stock);
                setStockMap(map);
            }
        };
        if (isCreateModalOpen) fetchStock();
    }, [isCreateModalOpen]);

    // --- HANDLERS ---

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;

        // Same position
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const newDriverId = destination.droppableId === 'unassigned' ? null : destination.droppableId;
        const oldDriverId = source.droppableId === 'unassigned' ? null : source.droppableId; // Could be 'unassigned' or a user ID
        const orderId = draggableId;

        // Smart Reminder
        if (newDriverId && newDriverId !== oldDriverId) {
            const order = orders.find(o => o.id === orderId);
            if (!checkDriverAvailability(newDriverId, order?.deadline)) return;
        }

        // 1. Get all orders for the DESTINATION driver
        const destinationOrders = filteredOrders
            .filter(o => o.driverId === newDriverId)
            .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));

        // 2. Insert the moved item into the new position
        const movedOrder = orders.find(o => o.id === orderId);
        if (!movedOrder) return;

        // If moving within same list
        if (newDriverId === oldDriverId) {
            destinationOrders.splice(source.index, 1); // Remove from old pos
            destinationOrders.splice(destination.index, 0, movedOrder); // Insert at new pos
        } else {
            // Moving across lists
            destinationOrders.splice(destination.index, 0, { ...movedOrder, driverId: newDriverId || undefined });
        }

        // 3. Optimistic Update (Global State)
        const newOrdersState = orders.map(o => {
            // Update the moved order
            if (o.id === orderId) {
                return { ...o, driverId: newDriverId || undefined }; // Cast null to undefined for state
            }
            return o;
        });

        // We also need to reflect the sequence update immediately in UI (Badge)
        // Let's create a map of id -> new sequence
        const sequenceMap = new Map<string, number>();
        destinationOrders.forEach((o, index) => {
            sequenceMap.set(o.id, index + 1);
        });

        const finalOptimisticOrders = newOrdersState.map(o => {
            if (sequenceMap.has(o.id)) {
                return { ...o, tripSequence: sequenceMap.get(o.id) };
            }
            return o;
        });

        setOrders(finalOptimisticOrders);


        // 4. Server Update (Batch)
        try {
            // A. Update the moved item's driver first (if changed)
            if (newDriverId !== oldDriverId) {
                await supabase.from('sales_orders').update({ driver_id: newDriverId }).eq('id', orderId);
            }

            // B. Update Sequences for ALL affected items in the destination column
            // (Naive approach: update all n items. For < 50 items this is fine)
            const updates = destinationOrders.map((o, index) =>
                supabase.from('sales_orders').update({ trip_sequence: index + 1 }).eq('id', o.id)
            );

            await Promise.all(updates);

        } catch (err) {
            console.error("Failed to resequence:", err);
            alert("Sync error. Refreshing...");
            fetchData();
        }
    };

    // DELETE ORDER (Soft Delete)
    const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
        if (!window.confirm(`Are you sure you want to CANCEL Order ${orderNumber}?\nThis will move it to the Cancelled tab.`)) return;

        try {
            // Soft Delete: Update status to 'Cancelled'
            const { error } = await supabase.from('sales_orders').update({ status: 'Cancelled' }).eq('id', orderId);
            if (error) throw error;

            // Optimistic Remove (or move to Cancelled if checking that tab)
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Cancelled' } : o));

            // Soft Refresh
            await fetchData();

        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };

    // APPROVE AMENDMENT
    const handleApproveAmendment = async (order: SalesOrder) => {
        if (!window.confirm(`Approve changes for Order ${order.orderNumber}? \nThis will deduct stock and mark as Delivered.`)) return;

        try {
            // 1. Deduct Stock for approved amended quantities
            for (const item of order.items || []) {
                const qtyToDeduct = item.quantity || 0;
                if (qtyToDeduct > 0) {
                    const { error } = await supabase.rpc('record_stock_movement', {
                        p_sku: item.sku,
                        p_qty: -qtyToDeduct, // Negative OUT
                        p_event_type: 'Transfer Out',
                        p_ref_doc: order.orderNumber,
                        p_notes: `Approved Amend: ${order.notes || ''}`
                    });
                    if (error) console.error("Stock error for " + item.sku, error);
                }
            }

            // 2. Update Status
            const { error } = await supabase.from('sales_orders').update({
                status: 'Delivered',
                pod_timestamp: new Date().toISOString()
            }).eq('id', order.id);

            if (error) throw error;

            if (error) throw error;

            alert("✅ Approved & Stock Deducted!");

            // Optimistic Update
            setOrders(prev => prev.map(o => {
                if (o.id === order.id) {
                    return { ...o, status: 'Delivered' };
                }
                return o;
            }));

            // fetchData(); // Optional debounce

        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleAddItem = () => {
        if (currentItemQty <= 0) return alert("Please enter a valid quantity.");
        if (!selectedV2Item) return alert("Please select a product.");

        const newItem = {
            product: selectedV2Item.name,
            sku: selectedV2Item.sku,
            quantity: currentItemQty,
            remark: currentItemRemark,
            sourceLocation: currentItemLoc || undefined,
            packaging: (selectedV2Item.uom || 'Unit') as any
        };

        setNewOrderItems([...newOrderItems, newItem]);
        setCurrentItemQty(0);
        setCurrentItemRemark('');
        setSelectedV2Item(null);
    };

    const handleRemoveItem = (index: number) => {
        const updated = [...newOrderItems];
        updated.splice(index, 1);
        setNewOrderItems(updated);
    };

    // REASSIGN DRIVER HANDLER
    const handleReassignDriver = async (driverId: string) => {
        if (!reassignOrder) return;

        if (!reassignOrder) return;

        // Smart Reminder / Blocker
        if (!checkDriverAvailability(driverId, reassignOrder.deadline)) return;

        try {
            // Optimistic Update
            setOrders(prev => prev.map(o => {
                if (o.id === reassignOrder.id) {
                    return { ...o, driverId: driverId };
                }
                return o;
            }));

            // Close Modal
            setIsReassignModalOpen(false);
            setReassignOrder(null);

            // DB Update
            const { error } = await supabase.from('sales_orders').update({ driver_id: driverId }).eq('id', reassignOrder.id);
            if (error) throw error;

            // alert("Driver updated successfully!"); 
            // Force Reload for safety
            window.location.reload();

        } catch (err: any) {
            alert("Error reassigning driver: " + err.message);
            // fetchData(); 
            window.location.reload();
        }
    };

    // SPLIT ORDER HANDLER
    const handleSplitOrder = async () => {
        if (!splitOrder) return;

        // Validation: Check if anything is being transferred
        const hasTransfer = Object.values(splitItems).some(qty => qty > 0);
        if (!hasTransfer) return alert("Please select at least one item to transfer.");

        try {
            // 1. Calculate New Order Items (Transferred)
            const newOrderItemsPayload = splitOrder.items.map((item, idx) => {
                const transferQty = splitItems[idx] || 0;
                if (transferQty > 0) {
                    return { ...item, quantity: transferQty };
                }
                return null;
            }).filter(Boolean) as SalesOrder['items'];

            // 2. Calculate Original Order Items (Remaining)
            const remainingOriginalItems = splitOrder.items.map((item, idx) => {
                const transferQty = splitItems[idx] || 0;
                const remainingQty = item.quantity - transferQty;
                if (remainingQty > 0) {
                    return { ...item, quantity: remainingQty };
                }
                return null; // Remove item if fully transferred
            }).filter(Boolean) as SalesOrder['items'];

            if (remainingOriginalItems.length === 0) return alert("Cannot transfer all items. Use 'Reassign Driver' instead.");

            // 3. DB Transactions
            // A. Update Original Order
            const { error: updateError } = await supabase.from('sales_orders')
                .update({ items: remainingOriginalItems })
                .eq('id', splitOrder.id);
            if (updateError) throw updateError;

            // B. Create New Order
            // Generate distinct order number suffix
            const splitOrderNumber = `${splitOrder.orderNumber}-B`;

            const payload = {
                order_number: splitOrderNumber,
                customer: splitOrder.customer,
                delivery_address: splitOrder.deliveryAddress,
                zone: splitOrder.zone, // Inherit zone
                factory_id: 'default', // Ideally should fetch original factory_id, simplified for now
                driver_id: splitTargetDriverId || null,
                items: newOrderItemsPayload,
                status: 'New', // Default status for split part
                order_date: splitOrder.orderDate,
                deadline: splitTargetDate || splitOrder.deadline,
                notes: `Split from ${splitOrder.orderNumber}. ${splitOrder.notes || ''}`,
                trip_sequence: 999
            };

            const { error: insertError } = await supabase.from('sales_orders').insert(payload);
            if (insertError) throw insertError;

            // 4. Force Reload (Timeout for safety)
            setTimeout(() => {
                window.location.reload();
            }, 500);

        } catch (err: any) {
            alert("Error splitting order: " + err.message);
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    };

    /*
    const handleCustomerSearch = (term: string) => {
        setOrderCustomer(term);
        if (term.length > 0) {
            const matches = customerDB.filter(c => c.name.toLowerCase().includes(term.toLowerCase())).slice(0, 5);
            setFilteredCustomers(matches);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };
    
    const handleSelectCustomer = (customer: any) => {
        setOrderCustomer(customer.name);
        setNewOrderAddress(customer.address || '');
        setShowSuggestions(false);
    };
    */

    const handleSubmitOrder = async () => {
        if (isSubmitting) return; // 🛡️ Prevent double submission
        if (newOrderItems.length === 0) return alert("Add at least one item");

        setIsSubmitting(true);
        try {
            // Assign default customer if empty (since input is hidden)
            const finalCustomer = orderCustomer.trim() || "General Customer";

            let doNumber;
            if (editingOrderId) {
                // Keep existing DO Number
                const existingOrder = orders.find(o => o.id === editingOrderId);
                doNumber = existingOrder?.orderNumber;
            } else {
                // Generate New DO Number (Legacy Format or match new one?)
                // For now keeping legacy random for this manual form unless specified otherwise
                doNumber = `DO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
            }

            const zone = determineZone(newOrderAddress || '');
            const bestFactory = findBestFactory(zone, newOrderItems, stockMap);

            // Auto-Push Unlisted Trip Category to HR Payroll Rates
            if (tripCategory) {
                const categoryExists = deliveryRates.some(r => r.origin === tripOrigin && r.location_name === tripCategory);
                if (!categoryExists) {
                    try {
                        await supabase.from('delivery_rates').insert({
                            origin: tripOrigin,
                            location_name: tripCategory,
                            base_rate: 0,
                            max_places: 1,
                            extra_rate_per_place: 0,
                            notes: "Auto-imported from Trip form. HR please update rate."
                        });
                        // Technically we should update local state here but since this closes modal immediately it's fine.
                        console.log("Auto-pushed new category to HR rates.");
                    } catch (e) {
                        console.error("Failed to auto-push category", e);
                    }
                }
            }

            const payload: any = {
                order_number: doNumber,
                customer: finalCustomer,
                delivery_address: newOrderAddress,
                zone: tripCategory || determineZone(newOrderAddress || ''),
                trip_origin: tripOrigin,
                trip_drop_count: tripDropCount,
                factory_id: bestFactory.id,
                driver_id: selectedDriverId || null,
                items: newOrderItems,
                status: 'New',
                order_date: newOrderDate || new Date().toISOString().split("T")[0],
                deadline: newOrderDeliveryDate || null,
                notes: newOrderNotes // Include Batch Notes
            };

            // LEAVE CONFLICT CHECK BEFORE SUBMISSION
            // Fallback to order_date if deadline is not set
            const effectiveDate = payload.deadline || payload.order_date;

            // DEBUG: Spy on the data


            if (payload.driver_id && effectiveDate) {
                // Double check it's not "null" string or something weird
                if (String(payload.driver_id) !== 'null' && String(payload.driver_id) !== '') {
                    // Prevent pushing raw strings (like "Sam") into a UUID column
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.driver_id);
                    if (!isUUID) {
                        throw new Error(`The driver "${payload.driver_id}" must be selected from the valid list. Did you type the name without selecting?`);
                    }

                    const ok = checkDriverAvailability(payload.driver_id, effectiveDate);
                    if (!ok) return; // User cancelled or blocked
                }
            }

            let newOrderObj: SalesOrder | null = null;

            if (editingOrderId) {
                const { error } = await supabase.from('sales_orders').update(payload).eq('id', editingOrderId);
                if (error) throw error;
                alert(`Order Updated!\nAssigned to ${bestFactory.name}`);

                // Optimistic Update: Edit
                newOrderObj = { ...orders.find(o => o.id === editingOrderId)!, ...payload, id: editingOrderId, orderNumber: doNumber };
                setOrders(prev => prev.map(o => o.id === editingOrderId ? newOrderObj! : o));

            } else {
                const { data, error } = await supabase.from('sales_orders').insert(payload).select().single();
                if (error) throw error;

                // Auto-save NEW customer (Unused)
                /*
                const existing = customerDB.find(c => c.name.toLowerCase() === orderCustomer.toLowerCase());
                if (!existing && newOrderAddress) {
                    supabase.from('sys_customers').insert({
                        name: orderCustomer, address: newOrderAddress, zone: determineZone(newOrderAddress)
                    }).then(() => {
                        supabase.from('sys_customers').select('*').then(res => res.data && setCustomerDB(res.data));
                    });
                }
                */
                // alert(`Order Created!\nAssigned to ${bestFactory.name} (Zone: ${zone})`);

                if (data) {
                    newOrderObj = {
                        id: data.id,
                        orderNumber: data.order_number,
                        customer: data.customer,
                        driverId: data.driver_id,
                        items: data.items,
                        status: data.status,
                        orderDate: data.order_date,
                        deadline: data.deadline,
                        notes: data.notes,
                        zone: data.zone,
                        deliveryAddress: data.delivery_address,
                        tripSequence: data.trip_sequence || 999
                    };
                }
            }

            // Close Modal
            handleCloseModal();

            // Soft Refresh
            await fetchData();

        } catch (err: any) {
            console.error("Save Error:", err);
            setToast({ message: "SAVE FAILED: " + (err.message || 'Unknown network error. Please screenshot this and contact IT.'), type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setIsCreateModalOpen(false);
        setEditingOrderId(null); setNewOrderDate(getTodayStr());
        setSelectedDriverId('');
        setOrderCustomer('');
        setNewOrderAddress('');
        setNewOrderDeliveryDate(getTomorrowStr());
        setNewOrderItems([]);
        setNewOrderNotes(''); // Reset Notes
        setTripOrigin('TAIPING');
        setTripCategory('');
        setTripDropCount(1);
        setToast(null); // Clear toast on close
    };

    function getDriverName(driverId?: string) {
        if (!driverId) return 'Unassigned';
        const d = drivers.find(u => u.uid === driverId);
        return d ? d.name : 'Unknown Driver';
    }

    // ... (rest of functions) ...

    function getStateColor(state: string) {
        switch (state) {
            case 'Selangor': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'K. Lumpur': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'Johor': return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'Penang': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'Melaka': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'Perak': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
            default: return 'text-slate-400 bg-slate-800 border-slate-700';
        }
    }

    // --- RENDER ---
    // (See return statement below for UI changes)

    /* Unused AI Stub
    const handleAIFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        setIsAnalyzing(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result as string;
                const base64Clean = base64Data.split(',')[1]; // Server expects raw base64
    
                // Call Server Vision API
                const response = await fetch('/api/agent/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: base64Clean })
                });
    
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Server error');
                }
    
                const data = await response.json(); // Array of extracted objects
    
                if (Array.isArray(data) && data.length > 0) {
                    const first = data[0]; // Take first contact found
                    if (first.name) setOrderCustomer(first.name);
                    if (first.address) setNewOrderAddress(first.address);
                    // You could also extract items if the prompt was updated, but for now just Contact Info
                    alert(`✨ AI Extracted:\nName: ${first.name}\nAddress: ${first.address}`);
                } else {
                    alert("AI couldn't find contact info in this image.");
                }
                setIsAnalyzing(false);
            };
        } catch (err: any) {
            console.error(err);
            alert("AI Error: " + err.message);
            setIsAnalyzing(false);
        }
    };
    */


    // Render Helpers
    // Render Helpers
    const getLocalDateStr = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const todayStr = getLocalDateStr(new Date());
    const within14Days = new Date();
    within14Days.setDate(within14Days.getDate() + 14);
    const within14DaysStr = getLocalDateStr(within14Days);

    const driversOnLeaveToday = drivers.filter(d =>
        driverLeaves.some(l => l.driver_id === d.uid && l.status !== 'Rejected' && todayStr >= l.start_date && todayStr <= l.end_date)
    );

    const upcomingLeaves = driverLeaves
        .filter(l => l.status !== 'Rejected' && l.start_date > todayStr && l.start_date <= within14DaysStr)
        .map(l => ({
            ...l,
            driverName: drivers.find(d => d.uid === l.driver_id)?.name || 'Unknown Driver'
        }))
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans selection:bg-blue-500/30">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white italic flex items-center gap-2">
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 w-3 h-10 rounded-full"></div>
                        Trip Management
                    </h1>
                    <p className="text-slate-400 mt-1 font-medium">Assign trips, track deliveries, and manage fleet.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="group relative bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-6 py-3 rounded-xl flex items-center gap-3 font-bold shadow-xl shadow-blue-900/20 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    New Trip
                </button>
            </div>

            {/* --- STATUS DASHBOARD (Driver Leaves & Lorry Services) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* 1. Driver Leaves Section */}
                <div className="flex flex-col gap-3">
                    {driversOnLeaveToday.length > 0 && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="bg-red-500 p-2 rounded-xl text-white">
                                    <AlertTriangle size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-black text-red-400 uppercase tracking-widest leading-none mb-1">Drivers on Holiday Today</div>
                                    <div className="text-xs font-bold text-red-500/80">
                                        {driversOnLeaveToday.map(d => d.name).join(', ')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {upcomingLeaves.length > 0 && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-amber-500 p-2 rounded-xl text-white">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-black text-amber-400 uppercase tracking-widest leading-none mb-1">Upcoming Holidays (Next 2 Weeks)</div>
                                    <div className="text-xs font-bold text-amber-500/80">
                                        {upcomingLeaves.map(l => `${l.driverName} (${l.start_date}${l.start_date !== l.end_date ? ' ➔ ' + l.end_date : ''})`).join(', ')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {driversOnLeaveToday.length === 0 && upcomingLeaves.length === 0 && (
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3 text-slate-500 h-full">
                            <Calendar size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">No Recent or Upcoming Driver Holidays</span>
                        </div>
                    )}
                </div>

                {/* 2. Lorry Service Reminder (Blue, Next 2 Weeks) */}
                <div>
                    {lorryServices.length > 0 ? (
                        <div className="bg-blue-900/20 border border-blue-500/50 rounded-2xl p-4 flex items-start gap-4 animate-in slide-in-from-top-4 duration-500 relative overflow-hidden h-full">
                            {/* Background Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-900/20 z-10">
                                <Wrench size={24} />
                            </div>
                            <div className="flex-1 z-10">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-blue-400 font-black uppercase tracking-widest text-sm mb-1">Upcoming Lorry Services (Next 2 Weeks)</h3>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Please arrange schedule accordingly.</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {lorryServices.map(s => {
                                        const driver = drivers.find(d => d.uid === s.driver_id);
                                        return (
                                            <div key={s.id} className="bg-slate-950 border border-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm group hover:border-blue-500/60 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-black font-mono text-xs tracking-wider">{s.plate_number}</span>
                                                    <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">{s.scheduled_date}</span>
                                                </div>
                                                {driver && (
                                                    <div className="pl-2 border-l border-slate-800 text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                        <UserIcon size={10} /> {driver.name}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3 text-slate-500 h-full">
                            <Wrench size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">No Upcoming Lorry Services</span>
                        </div>
                    )}
                </div>
            </div>

            {/* --- FILTERS & STATS --- */}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {/* Search Bar */}
                <div className="lg:col-span-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search Driver, Customer, or DO Number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 backdrop-blur-sm border border-slate-800 text-slate-200 text-sm rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                    />
                </div>

                {/* Status Tabs */}
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {/* Filter Tabs */}
                    {/* Removed: 'Prepared', 'In Transit' as per user request (Simplifying workflow) */}
                    {['All', 'Pending Approval', 'Delivered', 'Cancelled'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                                ${statusFilter === status
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {status === 'Delivered' ? 'Loaded' : (status === 'Pending Approval' ? (
                                <span className="flex items-center gap-2">
                                    Pending
                                    {orders.filter(o => o.status === 'Pending Approval').length > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full animate-pulse">
                                            {orders.filter(o => o.status === 'Pending Approval').length}
                                        </span>
                                    )}
                                </span>
                            ) : status === 'All' ? 'Active' : status)}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- MAIN GRID --- */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Add Unassigned Pseudo-Driver if not in list */}
                    {[
                        { uid: 'unassigned', name: '📦 Unassigned / New', email: '', role: 'Driver' } as User,
                        ...drivers
                    ].map(driver => {
                        const driverOrders = filteredOrders
                            .filter(o => {
                                if (driver.uid === 'unassigned') return !o.driverId; // Match null/undefined
                                return o.driverId === driver.uid;
                            })
                            .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0)); // Ensure visual order matches logical order for DnD

                        if (driverOrders.length === 0 && (searchTerm || statusFilter !== 'All') && driver.uid !== 'unassigned') return null;
                        // Always show Unassigned column if there are orders, or if we are in default view
                        if (driver.uid === 'unassigned' && driverOrders.length === 0 && (searchTerm || statusFilter !== 'All')) return null;

                        const isUnassigned = driver.uid === 'unassigned';

                        return (
                            <div key={driver.uid} className={`flex flex-col gap-4 rounded-2xl p-4 border transition-all ${isUnassigned ? 'bg-slate-900/50 border-dashed border-slate-700' : 'bg-slate-900/50 border-slate-800'
                                }`}>
                                {/* Driver Header */}
                                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg ${isUnassigned ? 'bg-slate-700 text-slate-400' : 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white'
                                            }`}>
                                            {isUnassigned ? '?' : (driver.name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className={`font-bold text-sm ${isUnassigned ? 'text-slate-400' : 'text-white'}`}>{driver.name || 'Unknown'}</div>
                                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                                {!isUnassigned && (
                                                    <>
                                                        {lorries.find(l => l.driverUserId === driver.uid) ? (
                                                            <span className="flex items-center gap-1 text-blue-400 font-black">
                                                                <Truck size={10} /> {lorries.find(l => l.driverUserId === driver.uid)?.plateNumber}
                                                                <span className="mx-1 opacity-30">|</span>
                                                                <MapPin size={10} className="text-slate-600" /> {lorries.find(l => l.driverUserId === driver.uid)?.preferredZone}
                                                            </span>
                                                        ) : (
                                                            <><Truck size={10} /> {driverOrders.length} Orders</>
                                                        )}
                                                    </>
                                                )}
                                                {isUnassigned && <><Box size={10} /> Pending Assign</>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-2xl font-black text-white">{driverOrders.length}</div>
                                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Orders</div>
                                    </div>
                                </div>

                                {/* Orders List (Droppable) */}
                                <Droppable droppableId={driver.uid}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={`flex-1 p-3 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar bg-[#09090b] ${snapshot.isDraggingOver ? 'bg-slate-900/50' : ''}`}
                                        >
                                            {driverOrders.map((order, index) => (
                                                <Draggable key={order.id} draggableId={order.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            onClick={() => {
                                                                setEditingOrderId(order.id); setNewOrderDate(order.orderDate || '');
                                                                setSelectedDriverId(order.driverId || '');
                                                                setOrderCustomer(order.customer);
                                                                setNewOrderAddress(order.deliveryAddress || '');
                                                                setNewOrderDeliveryDate(order.deadline || '');
                                                                setNewOrderNotes(order.notes || '');
                                                                setTripOrigin(order.trip_origin || 'TAIPING');
                                                                setTripCategory(order.zone || '');
                                                                setTripDropCount(order.trip_drop_count || 1);

                                                                // Extract legacy location from remark if sourceLocation is missing
                                                                const itemsWithExtractedLoc = (order.items || []).map(item => {
                                                                    if (!item.sourceLocation && item.remark && item.remark.includes('(Loc:')) {
                                                                        const locMatch = item.remark.match(/\(Loc:\s*(.*?)\)/);
                                                                        if (locMatch && locMatch[1]) {
                                                                            return { ...item, sourceLocation: locMatch[1] };
                                                                        }
                                                                    }
                                                                    return item;
                                                                });
                                                                setNewOrderItems(itemsWithExtractedLoc);

                                                                setIsCreateModalOpen(true);
                                                            }}
                                                            style={{ ...provided.draggableProps.style }}
                                                            className={`bg-[#18181b] border border-[#27272a] p-4 rounded-xl hover:bg-[#27272a] hover:border-blue-500/50 cursor-pointer transition-all relative group/card shadow-sm ${snapshot.isDragging ? 'shadow-2xl border-blue-500 z-50' : ''}`}
                                                        >
                                                            {/* Trip Sequence Badge */}
                                                            <div className="absolute -top-2 -right-2 bg-slate-950 border border-slate-700 text-slate-400 text-[9px] font-bold uppercase py-0.5 px-2 rounded-full shadow-lg z-10">
                                                                {index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Trip
                                                            </div>

                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="font-mono text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 tracking-wide">
                                                                        {order.orderNumber}
                                                                    </div>
                                                                    {order.deliveryAddress && (
                                                                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getStateColor(determineState(order.deliveryAddress))}`}>
                                                                            {determineState(order.deliveryAddress)}
                                                                        </div>
                                                                    )}
                                                                    {/* Delete Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteOrder(order.id, order.orderNumber);
                                                                        }}
                                                                        className="p-1.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300 rounded-md transition-colors"
                                                                        title="Cancel Order"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>

                                                                    {/* Reassign Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setReassignOrder(order);
                                                                            setIsReassignModalOpen(true);
                                                                        }}
                                                                        className="p-1.5 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors ml-1"
                                                                        title="Change Driver"
                                                                    >
                                                                        <UserIcon size={14} />
                                                                    </button>

                                                                    {/* Split Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSplitOrder(order);
                                                                            setSplitItems({}); // Reset
                                                                            setSplitTargetDriverId('');
                                                                            setSplitTargetDate('');
                                                                            setIsSplitModalOpen(true);
                                                                        }}
                                                                        className="p-1.5 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 hover:text-orange-300 rounded-md transition-colors ml-1"
                                                                        title="Split Order / Partial Delivery"
                                                                    >
                                                                        <Scissors size={14} />
                                                                    </button>
                                                                </div>
                                                                <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border ${order.status === 'New' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                                                                    order.status === 'Delivered' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                                                                        order.status === 'Pending Approval' ? 'text-red-400 border-red-500/20 bg-red-500/10 animate-pulse' :
                                                                            'text-slate-400 border-slate-700 bg-slate-800'
                                                                    }`}>
                                                                    {order.status}
                                                                </div>
                                                            </div>

                                                            <div className="text-xs text-slate-500 flex items-center gap-2 mb-3">
                                                                <Calendar size={14} className="text-slate-600 shrink-0" />
                                                                <div className="flex flex-col gap-0.5 leading-tight">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">📦 Ord:</span>
                                                                        <span className="text-[10px] text-slate-500 font-bold">{formatDateDMY(order.orderDate)}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[9px] font-black text-blue-500/50 uppercase tracking-tighter">🚚 Del:</span>
                                                                        <span className="text-[10px] text-blue-400 font-black">{formatDateDMY(order.deadline) || "No Date"}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Items Preview */}
                                                            <div className="space-y-1.5 bg-[#121214] p-3 rounded-lg border border-[#27272a]">
                                                                {order.items?.length === 0 ? (
                                                                    <div className="text-[10px] text-slate-600 italic text-center py-1">No Items</div>
                                                                ) : (
                                                                    order.items?.slice(0, 3).map((item, i) => (
                                                                        <div key={i} className="text-[11px] flex justify-between items-center gap-2">
                                                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                                                <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
                                                                                <span className="text-slate-400 truncate">{item.product}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                {item.sourceLocation && (
                                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest font-black">
                                                                                        {item.sourceLocation}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-slate-200 font-bold font-mono whitespace-nowrap">x{item.quantity}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                                {order.items && order.items.length > 3 && (
                                                                    <div className="text-[9px] text-zinc-600 font-bold text-center pt-1 uppercase tracking-wide">
                                                                        + {order.items.length - 3} more
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* APPROVE BUTTON FOR VIVIAN */}
                                                            {order.status === 'Pending Approval' && (
                                                                <div className="mt-4">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleApproveAmendment(order);
                                                                        }}
                                                                        className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition-all active:scale-95"
                                                                    >
                                                                        <Zap size={14} className="fill-white" /> Approve & Deduct Stock
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                                {driverOrders.length === 0 && (
                                    <div className="h-40 flex flex-col items-center justify-center text-slate-700 opacity-50">
                                        <Truck size={40} className="mb-3" />
                                        <span className="text-xs font-bold uppercase tracking-wider">No Trips</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </DragDropContext>

            {/* --- CREATE / EDIT MODAL --- */}
            {
                isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-black">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                        {editingOrderId ? <FileText className="text-blue-400" /> : <Plus className="text-blue-400" />}
                                        {editingOrderId ? 'Edit Trip' : 'Create New Trip'}
                                    </h2>
                                    {toast ? (
                                        <div className={`mt-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold border-2 ${toast.type === 'error' ? 'bg-red-900/50 text-red-200 border-red-500/50' : 'bg-emerald-900/50 text-emerald-200 border-emerald-500/50'}`}>
                                            <AlertTriangle size={14} />
                                            {toast.message}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500 mt-1">Manage trip details and items.</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 self-start">
                                    <button onClick={handleCloseModal} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950">

                                {/* Section 1: Basic Info (Simpler) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assigned Driver</label>
                                        <div className="relative">
                                            <UserIcon className="absolute left-3 top-3.5 text-slate-600 z-10" size={16} />
                                            <input
                                                list="drivers-list"
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none"
                                                placeholder="-- Type or Select Driver --"
                                                value={drivers.find(d => d.uid === selectedDriverId)?.name || drivers.find(d => d.uid === selectedDriverId)?.email || selectedDriverId || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    // Robust case-insensitive matching to find the driver UID
                                                    const matchedDriver = drivers.find(d => 
                                                        (d.name || '').toLowerCase() === val.toLowerCase() || 
                                                        (d.email || '').toLowerCase() === val.toLowerCase()
                                                    );
                                                    if (matchedDriver) {
                                                        setSelectedDriverId(matchedDriver.uid);
                                                    } else {
                                                        setSelectedDriverId(val); // Fallback to raw string (will be caught by UUID check on save)
                                                    }
                                                }}
                                                onBlur={e => {
                                                    // Optional cleanup: If they empty it, set unassigned
                                                    if (!e.target.value) setSelectedDriverId('');
                                                }}
                                            />
                                            <datalist id="drivers-list">
                                                {drivers.map(d => <option key={d.uid} value={d.name || d.email || ''} />)}
                                            </datalist>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-600 uppercase mb-2 tracking-widest flex items-center gap-2">
                                                    <Calendar size={12} /> Trip Date
                                                </label>
                                                <div className="relative group">
                                                    <input
                                                        type="date"
                                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 focus:border-blue-500/30 outline-none appearance-none cursor-pointer [color-scheme:dark] transition-all"
                                                        value={newOrderDate}
                                                        onChange={e => setNewOrderDate(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-blue-500/80 uppercase mb-2 tracking-widest flex items-center gap-2">
                                                    <Calendar size={12} /> Delivery Date
                                                </label>
                                                <div className="relative group">
                                                    <input
                                                        type="date"
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:border-blue-500/50 outline-none appearance-none cursor-pointer [color-scheme:dark] transition-all font-bold"
                                                        value={newOrderDeliveryDate}
                                                        onChange={e => setNewOrderDeliveryDate(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-1 flex justify-between px-1">
                                            <div className="text-[9px] text-slate-700 font-bold uppercase">Ord: {formatDateDMY(newOrderDate) || "Today"}</div>
                                            <div className="text-[9px] text-blue-500/60 font-black uppercase">Del: {formatDateDMY(newOrderDeliveryDate) || "Not Set"}</div>
                                        </div>
                                        <div className="mt-1 text-[10px] text-slate-600 font-bold px-1 flex justify-between">
                                            <span>Format: DD/MM/YYYY</span>
                                            {newOrderDeliveryDate && (
                                                <span className="text-blue-500/80">Selected: {formatDateDMY(newOrderDeliveryDate)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* DESTINATIONS (Delivery Address) */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Destinations (e.g., KL, PJ, Subang)</label>
                                    <input
                                        type="text"
                                        placeholder="Enter all delivery locations for this trip..."
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none placeholder:text-slate-600 mb-4"
                                        value={newOrderAddress}
                                        onChange={e => {
                                            setNewOrderAddress(e.target.value);
                                            // Auto-calc drops based on commas
                                            const drops = e.target.value.split(',').filter(s => s.trim().length > 0).length || 1;
                                            setTripDropCount(drops);
                                        }}
                                    />

                                    {/* DRIVER PAYROLL RATES: Origin, Category, Drops */}
                                    <div className="grid grid-cols-3 gap-4 bg-slate-900/50 p-4 border border-slate-800 rounded-xl">
                                        <div>
                                            <label className="block text-[10px] font-bold text-blue-500/80 uppercase tracking-widest mb-2">Origin</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none"
                                                value={tripOrigin}
                                                onChange={e => setTripOrigin(e.target.value)}
                                            >
                                                <option value="TAIPING">Taiping</option>
                                                <option value="NILAI">Nilai</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-blue-500/80 uppercase tracking-widest mb-2">Trip Category</label>
                                            <input
                                                list="trip-category-list"
                                                placeholder="-- Auto/Manual --"
                                                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors ${
                                                    tripCategory && !deliveryRates.some(r => r.origin === tripOrigin && r.location_name === tripCategory)
                                                        ? 'border-red-500/80 focus:border-red-500 text-red-100' // Invalid styling
                                                        : 'border-slate-800 focus:border-blue-500/50'     // Normal styling
                                                }`}
                                                value={tripCategory}
                                                onChange={e => setTripCategory(e.target.value.toUpperCase())}
                                            />
                                            <datalist id="trip-category-list">
                                                {Array.from(new Set(deliveryRates.filter(r => r.origin === tripOrigin).map(r => r.location_name))).map(loc => (
                                                    <option key={loc} value={loc} />
                                                ))}
                                            </datalist>
                                            {tripCategory && !deliveryRates.some(r => r.origin === tripOrigin && r.location_name === tripCategory) && (
                                                <div className="absolute mt-1 text-[9px] font-bold text-red-400">⚠️ Unlisted category. Pay will be RM0.</div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest mb-2">Total Drops</label>
                                            <input
                                                type="number"
                                                min={1}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500/50 outline-none"
                                                value={tripDropCount}
                                                onChange={e => setTripDropCount(parseInt(e.target.value) || 1)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* TRIP NOTE */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Trip Notes</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Enter notes for this trip..."
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-blue-500/50 outline-none placeholder:text-slate-600 resize-none"
                                        value={newOrderNotes}
                                        onChange={e => setNewOrderNotes(e.target.value)}
                                    />
                                </div>

                                <hr className="border-slate-800" />

                                {/* Section 2: Items */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Box size={16} /> Trip Items
                                    </h3>

                                    {/* Item List Layout */}
                                    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg flex flex-col min-h-[400px]">
                                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                                                <Box size={14} /> Items List
                                            </div>
                                            <div className="text-xs font-bold text-slate-600 bg-slate-900 px-2 py-1 rounded">
                                                {newOrderItems.length} Items
                                            </div>
                                        </div>

                                        {/* Items List (Inline Edit) */}
                                        <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[400px]">
                                            {newOrderItems.length === 0 ? (
                                                <div className="text-center py-12 text-slate-700 text-sm italic border-2 border-dashed border-slate-800/50 rounded-xl">
                                                    List empty. Add items below.
                                                </div>
                                            ) : (
                                                newOrderItems.map((item, idx) => (
                                                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col gap-2 group hover:border-slate-700 transition-colors">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                <div className="font-bold text-white text-sm leading-tight">{item.product}</div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] text-slate-500 font-mono">{item.sku}</span>
                                                                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold border border-blue-500/20">
                                                                        {item.packaging || 'Unit'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {/* INLINE QUANTITY EDIT */}
                                                                <input
                                                                    type="number"
                                                                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-bold text-orange-400 focus:border-orange-500 outline-none text-sm"
                                                                    value={item.quantity}
                                                                    onChange={(e) => {
                                                                        const val = Number(e.target.value);
                                                                        const updated = [...newOrderItems];
                                                                        updated[idx].quantity = val;
                                                                        setNewOrderItems(updated);
                                                                    }}
                                                                />
                                                                <button onClick={() => handleRemoveItem(idx)} className="text-slate-600 hover:text-red-500 p-1 rounded-full hover:bg-slate-900 transition-colors">
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* INLINE LOCATION & REMARK EDIT */}
                                                        <div className="flex flex-col gap-2 mt-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-[10px] font-bold text-slate-600 uppercase w-16">Pickup:</div>
                                                                <select
                                                                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-blue-400 font-bold focus:border-blue-500 outline-none"
                                                                    value={item.sourceLocation || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const updated = [...newOrderItems];
                                                                        updated[idx].sourceLocation = val;
                                                                        setNewOrderItems(updated);
                                                                    }}
                                                                >
                                                                    <option value="">-- No Location --</option>
                                                                    {WAREHOUSES.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-[10px] font-bold text-slate-600 uppercase w-16">Remark:</div>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Add remark..."
                                                                    className="flex-1 bg-transparent border-b border-slate-800 text-xs text-slate-400 focus:border-blue-500 outline-none py-0.5 placeholder:text-slate-700"
                                                                    value={item.remark || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const updated = [...newOrderItems];
                                                                        updated[idx].remark = val;
                                                                        setNewOrderItems(updated);
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Add Row (Footer) - Search Only */}
                                        <div className="bg-slate-800/50 p-4 border-t border-slate-700/50 flex flex-col gap-3 rounded-b-2xl">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quick Add (Search SKU)</div>

                                            <div className="flex flex-col gap-3">
                                                <SearchableSelect
                                                    placeholder="Select Product..."
                                                    options={v2Items.map(item => ({
                                                        value: item.sku,
                                                        label: item.name,
                                                        subLabel: `${item.sku} • Stock: ${stockMap[item.sku] || 0}`,
                                                        statusColor: (stockMap[item.sku] || 0) < 100 ? 'text-red-400' : 'text-green-400',
                                                        statusLabel: (stockMap[item.sku] || 0) < 100 ? 'LOW' : 'OK'
                                                    }))}
                                                    value={selectedV2Item?.sku || ''}
                                                    onChange={(val) => {
                                                        const i = v2Items.find(x => x.sku === val);
                                                        setSelectedV2Item(i || null);
                                                    }}
                                                    minimal
                                                />
                                                <div className="flex gap-2">
                                                    <select
                                                        className="w-1/4 bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-slate-300 outline-none focus:border-blue-500 text-xs font-bold uppercase transition-all"
                                                        value={currentItemLoc}
                                                        onChange={e => setCurrentItemLoc(e.target.value)}
                                                    >
                                                        {WAREHOUSES.map(loc => (
                                                            <option key={loc} value={loc}>{loc}</option>
                                                        ))}
                                                        <option value="">No Loc</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="Item Remark..."
                                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 outline-none focus:border-blue-500 text-sm placeholder:text-slate-600"
                                                        value={currentItemRemark}
                                                        onChange={e => setCurrentItemRemark(e.target.value)}
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Qty"
                                                        className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-2 py-3 text-white text-right font-bold outline-none focus:border-orange-500 text-sm"
                                                        value={currentItemQty || ''}
                                                        onChange={e => setCurrentItemQty(Number(e.target.value))}
                                                    />
                                                    <button
                                                        onClick={handleAddItem}
                                                        disabled={!selectedV2Item || !currentItemQty}
                                                        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Plus size={16} /> Add
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                                <button onClick={handleCloseModal} className="px-6 py-2 rounded-xl text-slate-400 hover:text-white font-bold transition-colors">Cancel</button>
                                <button
                                    onClick={handleSubmitOrder}
                                    disabled={isSubmitting}
                                    className="px-8 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                                    ) : (
                                        editingOrderId ? 'Save Changes' : 'Confirm Trip'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- SPLIT ORDER MODAL --- */}
            {isSplitModalOpen && splitOrder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-[#09090b] w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h1 className="text-3xl font-black text-white italic flex items-center gap-2">
                                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 w-3 h-10 rounded-full"></div>
                                Delivery Order Management
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono border border-slate-700">v2.0</span>
                            </h1>
                            <button onClick={() => setIsSplitModalOpen(false)} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            {/* Header Info */}
                            <div className="mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Original Order</div>
                                        <div className="text-xl font-mono font-black text-white">{splitOrder.orderNumber}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Customer</div>
                                        <div className="text-sm font-bold text-slate-300">{splitOrder.customer}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 italic">
                                    Define quantities to move to the <b>New Order</b>. Remaining items will stay in this order.
                                </div>
                            </div>

                            {/* Item Selection */}
                            <div className="space-y-4 mb-6">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Items to Transfer</div>
                                {splitOrder.items.map((item, idx) => (
                                    <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center gap-4">
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-200">{item.product}</div>
                                            <div className="text-[10px] text-slate-500">{item.sku}</div>
                                            <div className="text-xs text-slate-400 mt-1">Total: <span className="text-white font-mono">{item.quantity}</span> {item.packaging || 'Unit'}</div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <label className="text-[10px] text-slate-500 font-bold uppercase">Transfer Qty</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.quantity}
                                                className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-white font-bold outline-none focus:border-orange-500"
                                                value={splitItems[idx] || ''}
                                                placeholder="0"
                                                onChange={(e) => {
                                                    const val = Math.min(Number(e.target.value), item.quantity);
                                                    setSplitItems(prev => ({ ...prev, [idx]: val }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* New Order Settings */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Assign Driver (Optional)</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-orange-500"
                                        value={splitTargetDriverId}
                                        onChange={e => setSplitTargetDriverId(e.target.value)}
                                    >
                                        <option value="">Unassigned</option>
                                        {drivers.map(d => <option key={d.uid} value={d.uid}>{d.name || d.email}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">New Delivery Date (Optional)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-orange-500"
                                        value={splitTargetDate}
                                        onChange={e => setSplitTargetDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                            <button onClick={() => setIsSplitModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-bold transition-colors">Cancel</button>
                            <button
                                onClick={handleSplitOrder}
                                className="px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-lg text-xs font-bold shadow-lg shadow-orange-900/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Scissors size={14} />
                                Confirm Split
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- REASSIGN DRIVER MODAL --- */}
            {isReassignModalOpen && reassignOrder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-[#09090b] w-full max-w-sm rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <UserIcon size={18} className="text-blue-400" />
                                Reassign Driver
                            </h3>
                            <button onClick={() => setIsReassignModalOpen(false)} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-slate-800">
                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Order #</div>
                                <div className="text-lg font-mono font-black text-white">{reassignOrder.orderNumber}</div>
                                <div className="text-xs text-slate-400 mt-1">{reassignOrder.customer}</div>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {drivers.map(driver => (
                                    <button
                                        key={driver.uid}
                                        onClick={() => handleReassignDriver(driver.uid)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${reassignOrder.driverId === driver.uid
                                            ? 'bg-blue-500/20 border-blue-500 text-blue-100'
                                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${reassignOrder.driverId === driver.uid ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                                            }`}>
                                            {(driver.name || driver.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="font-bold text-sm text-left flex-1">{driver.name || driver.email}</div>
                                        {reassignOrder.driverId === driver.uid && <div className="text-[10px] font-bold uppercase bg-blue-500 text-white px-2 py-0.5 rounded-full">Current</div>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </div >
    );
};

// Start Icon helper needed for V2 items check mark

/*
function CheckCircle({size, className}: {size ?: number, className ?: string}) {
    return <div className={`rounded-full border flex items-center justify-center ${className}`} style={{ width: size, height: size }}>✓</div>;
            */


export default DeliveryOrderManagement;
