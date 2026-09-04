import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../services/supabase';
import { getV2Items, getInventoryStatus } from '../services/apiV2';
import { WAREHOUSES } from '../data/factoryData';
import { SalesOrder, SalesOrderItem, User } from '../types';
import { Calendar, User as UserIcon, Truck, MapPin, Package, Camera, Trash2, X } from 'lucide-react';
import { parsePrepPhotos, stringifyPrepPhotos, PrepPhoto } from '../utils/prepPhotos';
import { compressImage, dataURLtoBlob } from '../utils/imageCompress';
import { useTranslation } from "react-i18next";

const LOCATIONS = WAREHOUSES;
type Location = string;

const LOCATION_COLOR_PALETTES = ['blue', 'emerald', 'purple', 'orange', 'rose'];
const LOCATION_COLOR: Record<string, string> = {};
LOCATIONS.forEach((loc, i) => {
    LOCATION_COLOR[loc] = LOCATION_COLOR_PALETTES[i % LOCATION_COLOR_PALETTES.length];
});

// Normalize inventory loc_id to match WAREHOUSES display names
const normalizeLoc = (locId: string): string => {
    const lower = (locId || '').toLowerCase().trim();
    const LOC_ALIASES: Record<string, string> = {
        'spd': 'SPD', 'opm lama': 'OPM Lama', 'opm_lama': 'OPM Lama',
        'opm corner': 'OPM Corner', 'opm_corner': 'OPM Corner',
        'opm ali': 'OPM Ali', 'opm_ali': 'OPM Ali',
        'nilai': 'Nilai',
    };
    return LOC_ALIASES[lower] || locId;
};

// Sub-locations without independent inventory data fall back to parent warehouse
const STOCK_FALLBACK: Record<string, string> = {
    'OPM Corner': 'SPD',
    'OPM Lama': 'SPD',
    'OPM Ali': 'SPD',
};

// Determine which warehouse tab a single item belongs to
const getItemLocation = (item: SalesOrderItem, order: SalesOrder): string => {
    // 1. Explicit sourceLocation on the item
    if (item.sourceLocation) {
        const src = item.sourceLocation.toLowerCase();
        if (src.includes('opm lama')) return 'OPM Lama';
        if (src.includes('opm corner')) return 'OPM Corner';
        if (src.includes('opm ali')) return 'OPM Ali';
        if (src.includes('nilai')) return 'Nilai';
        if (src.includes('spd')) return 'SPD';
    }
    // 2. Legacy: location encoded in remark field
    if (item.remark) {
        const r = item.remark.toLowerCase();
        if (r.includes('opm lama')) return 'OPM Lama';
        if (r.includes('opm corner')) return 'OPM Corner';
        if (r.includes('opm ali')) return 'OPM Ali';
        if (r.includes('nilai')) return 'Nilai';
        if (r.includes('kelantan')) return 'Kelantan';
        if (r.includes('johor')) return 'Johor';
        if (r.includes('spd')) return 'SPD';
    }
    // 3. Order-level trip_origin
    if (order.trip_origin) {
        const origin = order.trip_origin.toUpperCase();
        if (origin === 'NILAI') return 'Nilai';
        if (origin === 'KELANTAN') return 'Kelantan';
        if (origin === 'JOHOR') return 'Johor';
        if (origin === 'TAIPING' || origin === 'SPD') return 'SPD';
    }
    // 4. Zone / address text matching
    const text = `${order.zone || ''} ${order.deliveryAddress || ''}`.toLowerCase();
    if (text.includes('nilai') || text.includes('seremban')) return 'Nilai';
    if (text.includes('kelantan') || text.includes('kota bharu')) return 'Kelantan';
    if (text.includes('johor') || text.includes('skudai') || text.includes('senai')) return 'Johor';
    return LOCATIONS[0] || 'SPD';
};

const getLocalDateString = (d: Date = new Date()): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface OrderSummaryProps {
    user?: any;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ user }) => {
    const { t } = useTranslation();
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [drivers, setDrivers] = useState<User[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Location>(LOCATIONS[0] || 'Unknown');

    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedOrderIdForUpload, setSelectedOrderIdForUpload] = useState<string | null>(null);

    const handleUploadButtonClick = (orderId: string) => {
        setSelectedOrderIdForUpload(orderId);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const orderId = selectedOrderIdForUpload;
        if (!file || !orderId) return;

        setUploadingId(orderId);
        try {
            const currentOrder = orders.find(o => o.id === orderId);
            const existingPhotos = parsePrepPhotos(currentOrder?.preparation_photo_url);

            const compressedDataUrl = await compressImage(file);
            const blob = dataURLtoBlob(compressedDataUrl);

            const filename = `prep_${orderId}_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(filename, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(filename);
            const publicUrl = urlData.publicUrl;

            // Create new photo item and append to existing
            const newPhoto: PrepPhoto = { url: publicUrl, location: activeTab };
            const updatedPhotos = [...existingPhotos, newPhoto];
            const updatedPhotoUrlField = stringifyPrepPhotos(updatedPhotos);

            const { error: updateError } = await supabase
                .from('sales_orders')
                .update({ preparation_photo_url: updatedPhotoUrlField })
                .eq('id', orderId);

            if (updateError) throw updateError;

            // 同步记录到 work_photos 表，以便在 Monthly Report (月度报告) 中能展示对应员工的备货照片
            if (user) {
                try {
                    const uid = user.uid || user.id;
                    const { data: pubUser } = await supabase
                        .from('users_public')
                        .select('employee_id, name')
                        .eq('id', uid)
                        .single();
                        
                    const empId = pubUser?.employee_id || user.employeeId || 'unknown';
                    const empName = pubUser?.name || user.name || user.email?.split('@')[0] || 'Unknown';
                    
                    await supabase.from('work_photos').insert({
                        employee_id: empId,
                        employee_name: empName,
                        photo_url: publicUrl,
                        category: t('Cargo Prep / Stocking Photos'),
                        user_note: t('Daily Prep Stocking Location Map - Order: {{var0}} - Location: {{var1}}', { var0: currentOrder?.orderNumber || 'Unknown', var1: activeTab }),
                        location: activeTab,
                        risk_flag: false
                    });
                } catch (dbErr) {
                    console.error("Failed to insert cargo prep photo log:", dbErr);
                }
            }

            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, preparation_photo_url: updatedPhotoUrlField } : o));
            alert(t('✅ {{var0}} stocking pictures uploaded successfully! / Cargo photo uploaded successfully!', { var0: activeTab }));
        } catch (err: any) {
            console.error("Failed to upload photo:", err);
            alert("Upload failed: " + err.message);
        } finally {
            setUploadingId(null);
            setSelectedOrderIdForUpload(null);
        }
    };


    const handleDeletePhoto = async (orderId: string, photoIndex: number) => {
        if (!window.confirm(t('Are you sure you want to delete this stocking photo? / Are you sure you want to delete this photo?'))) return;
        
        try {
            const currentOrder = orders.find(o => o.id === orderId);
            if (!currentOrder) return;
            const existingPhotos = parsePrepPhotos(currentOrder.preparation_photo_url);
            
            const updatedPhotos = existingPhotos.filter((_, idx) => idx !== photoIndex);
            const updatedPhotoUrlField = updatedPhotos.length > 0 ? stringifyPrepPhotos(updatedPhotos) : null;
            
            const { error } = await supabase
                .from('sales_orders')
                .update({ preparation_photo_url: updatedPhotoUrlField })
                .eq('id', orderId);
                
            if (error) throw error;
            
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, preparation_photo_url: updatedPhotoUrlField } : o));
            alert(t('✅ The photo has been successfully deleted! / Photo deleted successfully!'));
        } catch (err: any) {
            console.error("Failed to delete photo:", err);
            alert("Delete failed: " + err.message);
        }
    };

    const [skuNameMap, setSkuNameMap] = useState<Record<string, string>>({});
    // Maps [LocationName] -> [ItemName] -> StockQty
    const [stockMapByLoc, setStockMapByLoc] = useState<Record<string, Record<string, number>>>({});

    // Fetch master item names and inventory status for SKU resolution and stock display
    useEffect(() => {
        const fetchItemData = async () => {
            try {
                const [items, inventory] = await Promise.all([
                    getV2Items(),
                    getInventoryStatus()
                ]);

                if (items) {
                    const nameMap: Record<string, string> = {};
                    items.forEach(item => { nameMap[item.sku] = item.name; });
                    setSkuNameMap(nameMap);

                    if (inventory) {
                        // 1. Group stock by Location -> SKU
                        const locSkuStock: Record<string, Record<string, number>> = {};
                        inventory.forEach(inv => {
                            const loc = normalizeLoc(inv.loc_id || 'Unknown');
                            if (!locSkuStock[loc]) locSkuStock[loc] = {};
                            locSkuStock[loc][inv.sku] = (locSkuStock[loc][inv.sku] || 0) + inv.current_stock;
                        });

                        // 2. Map SKU back to Item Name per location
                        const finalStockMap: Record<string, Record<string, number>> = {};
                        Object.keys(locSkuStock).forEach(loc => {
                            finalStockMap[loc] = {};
                            items.forEach(item => {
                                finalStockMap[loc][item.name] = locSkuStock[loc][item.sku] || 0;
                            });
                        });
                        setStockMapByLoc(finalStockMap);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch item data:', err);
            }
        };
        fetchItemData();
    }, []);

    // Resolve item name: prefer current name from master catalog, fallback to stored name
    const resolveItemName = (item: { product: string; sku?: string }) => {
        let name = (item.sku && skuNameMap[item.sku]) ? skuNameMap[item.sku] : item.product;
        if (name && name.includes('STRECTH FIL')) {
            name = name.replace('STRECTH FIL', 'STRETCH FILM');
        }
        return name || item.product;
    };

    // --- FETCH ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [allUsersRes, sysUsersRes] = await Promise.all([
                supabase.from('users_public').select('*'),
                supabase.from('sys_users_v2').select('id, auth_user_id, role_modules')
            ]);

            const allUsers = allUsersRes.data;
            if (allUsers) {
                const driverCapableSet = new Set<string>();
                (sysUsersRes.data || []).forEach((su: any) => {
                    if (su.role_modules && Array.isArray(su.role_modules) && su.role_modules.includes('delivery-driver')) {
                        if (su.id) driverCapableSet.add(su.id);
                        if (su.auth_user_id) driverCapableSet.add(su.auth_user_id);
                    }
                });

                const filtered = allUsers.filter(u =>
                    u.role === 'Driver' || driverCapableSet.has(u.id)
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
                .neq('status', 'Loaded')
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
                    trip_origin: o.trip_origin,
                    trip_drop_count: o.trip_drop_count,
                    preparation_photo_url: o.preparation_photo_url,
                }));
                
                const getTenChars = (s?: string) => s ? s.slice(0, 10) : '';
                const filtered = mapped.filter(o => {
                    const effective = getTenChars(o.deadline) || getTenChars(o.orderDate);
                    return effective === selectedDate;
                });
                setOrders(filtered);
            }
        } catch (err) {
            console.error('fetchData error:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- LOCATION CLASSIFICATION (Item-Level) ---
    // Each order can appear in multiple tabs if its items span different warehouses.
    const locationOrders: Record<Location, SalesOrder[]> = {};
    LOCATIONS.forEach(loc => locationOrders[loc] = []);

    orders.forEach(o => {
        const seenLocs = new Set<string>();
        if (o.items.length === 0) {
            // No items: use order-level fallback
            const origin = o.trip_origin?.toUpperCase();
            const fallbackLoc = origin === 'NILAI' ? 'Nilai' : (origin === 'KELANTAN' ? 'Kelantan' : (origin === 'JOHOR' ? 'Johor' : (LOCATIONS[0] || 'SPD')));
            seenLocs.add(fallbackLoc);
        } else {
            o.items.forEach(item => {
                seenLocs.add(getItemLocation(item, o));
            });
        }
        seenLocs.forEach(loc => {
            if (!locationOrders[loc]) locationOrders[loc] = [];
            locationOrders[loc].push(o);
        });
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

    // Production summary — only count items belonging to the active tab
    const productSummary = activeTabOrders.reduce((acc, order) => {
        // Exclude orders that have already been loaded, delivered, or are pending amendment approval
        if (order.status === 'Loaded' || order.status === 'Delivered' || order.status === 'Pending Approval') return acc;

        order.items.forEach(item => {
            if (getItemLocation(item, order) !== activeTab) return;
            const name = resolveItemName(item);
            if (!acc[name]) acc[name] = { qty: 0, sku: item.sku };
            acc[name].qty += (item.quantity || 0);
            if (item.sku && !acc[name].sku) acc[name].sku = item.sku;
        });
        return acc;
    }, {} as Record<string, { qty: number; sku?: string }>);

    // Categorization logic
    const categorizeProduct = (name: string, sku?: string): string => {
        const s = (sku || '').toLowerCase();
        const lower = name.toLowerCase();
        
        if (s.startsWith('bw') || lower.includes('single') || lower.includes('double') || lower.includes('layer') || lower.includes('bubble')) return '🫧 Bubble Wrap';
        if (s.startsWith('sf') || s.includes('sf-') || lower.includes('stretch film') || lower.includes('strecth') || lower.includes('sf') || lower.includes('hand roll')) return '📦 Stretch Film';
        if (lower.includes('foam') || lower.includes('pe foam')) return '🛡️ PE Foam';
        if (lower.includes('corrugated') || lower.includes('box') || lower.includes('carton') || lower.includes('edge')) return '🗂️ Cartons & Edge Protectors';
        if (lower.includes('core') || lower.includes('paper')) return '📜 Paper Cores';
        return '🔹 Others';
    };

    const groupedSummary = Object.entries(productSummary).reduce((acc, [product, data]) => {
        const cat = categorizeProduct(product, data.sku);
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push({ product, qty: data.qty, sku: data.sku });
        return acc;
    }, {} as Record<string, { product: string; qty: number; sku?: string }[]>);

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
                                <div className="flex flex-col gap-6">
                                    {Object.entries(groupedSummary).map(([category, items]) => (
                                        <div key={category}>
                                            <h3 className="text-[11px] font-bold text-blue-300/70 border-b border-blue-500/20 pb-1 mb-3 uppercase tracking-wider">
                                                {category}
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {items.map(({ product, qty, sku }) => {
                                                    let lookupLoc = activeTab;
                                                    // Generalized fallback for sub-locations sharing a parent warehouse
                                                    if (!stockMapByLoc[lookupLoc] && STOCK_FALLBACK[lookupLoc]) {
                                                        lookupLoc = STOCK_FALLBACK[lookupLoc];
                                                    }
                                                    const stock = stockMapByLoc[lookupLoc]?.[product] || 0;
                                                    const deficit = qty - stock;
                                                    const hasDeficit = deficit > 0;
                                                    return (
                                                    <div key={product} className={`bg-[#121215] border rounded-xl p-3 flex flex-col justify-between relative overflow-hidden transition-all ${hasDeficit ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.08)]' : 'border-white/10 hover:border-white/20'}`}>
                                                        {hasDeficit && (
                                                            <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.9)]" title="Shortage"></div>
                                                        )}
                                                        {/* 名字为主，SKU为辅 */}
                                                        <div className="flex flex-col mb-2.5 pr-3 min-w-0">
                                                            <span className="text-xs sm:text-sm font-black text-white tracking-wide truncate leading-snug" title={product}>
                                                                {product}
                                                            </span>
                                                            <span className="text-[10px] text-cyan-400 font-mono font-medium truncate mt-0.5" title={sku ? `SKU: ${sku}` : product}>
                                                                {sku || product}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-end justify-between pt-2 border-t border-white/5">
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Req</span>
                                                                <span className="text-lg font-black text-white leading-none mt-1">{qty}</span>
                                                            </div>
                                                            <div className="w-px h-6 bg-white/10 mx-2"></div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Phy Stock</span>
                                                                <span className={`text-sm font-black leading-none mt-1 ${stock >= qty ? 'text-green-400' : 'text-amber-400'}`}>{stock}</span>
                                                            </div>
                                                        </div>
                                                        {hasDeficit && (
                                                            <div className="mt-2 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md truncate w-fit">
                                                                Shortage: {deficit}
                                                            </div>
                                                        )}
                                                    </div>
                                                    );
                                                })}
                                            </div>
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
                                            resolveItemName={resolveItemName}
                                            onUploadClick={handleUploadButtonClick}
                                            onDeleteClick={handleDeletePhoto}
                                            onPhotoClick={setPreviewImageUrl}
                                            uploadingId={uploadingId}
                                            isDragDisabled={user?.role === 'Operator'}
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
                                            resolveItemName={resolveItemName}
                                            onUploadClick={handleUploadButtonClick}
                                            onDeleteClick={handleDeletePhoto}
                                            onPhotoClick={setPreviewImageUrl}
                                            uploadingId={uploadingId}
                                            isDragDisabled={user?.role === 'Operator'}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {/* Hidden input for mobile camera upload */}
                <input 
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                />

                {/* Full Screen Image Preview Modal */}
                {previewImageUrl && (
                    <div 
                        className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setPreviewImageUrl(null)}
                    >
                        <button 
                            onClick={() => setPreviewImageUrl(null)} 
                            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all"
                        >
                            <X size={24} />
                        </button>
                        <img 
                            src={previewImageUrl} 
                            alt="Preview" 
                            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200" 
                            onClick={(e) => e.stopPropagation()}
                        />
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-4">
                            Ketik di mana-mana untuk tutup / Tap anywhere to close
                        </p>
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
    resolveItemName: (item: { product: string; sku?: string }) => string;
    onUploadClick: (orderId: string) => void;
    onDeleteClick: (orderId: string, photoIndex: number) => void;
    onPhotoClick: (url: string) => void;
    uploadingId: string | null;
    isDragDisabled?: boolean;
}> = ({ droppableId, label, orders, isUnassigned, resolveItemName, onUploadClick, onDeleteClick, onPhotoClick, uploadingId, isDragDisabled }) => (
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
                        <Draggable key={order.id} draggableId={order.id} index={index} isDragDisabled={isDragDisabled}>
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

                                    <div className="bg-black/30 rounded-lg p-2 space-y-2">
                                        {order.items.map((item, idx) => {
                                            const resolvedName = resolveItemName(item);
                                            return (
                                            <div key={idx} className="text-xs border-b border-white/[0.02] last:border-0 pb-1.5 last:pb-0">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex flex-col min-w-0 pr-2">
                                                        <span className="text-gray-200 font-semibold">{resolvedName}</span>
                                                        {item.sku && item.sku !== resolvedName && (
                                                            <span className="text-[10px] text-cyan-400 font-mono">{item.sku}</span>
                                                        )}
                                                    </div>
                                                    <span className="font-mono text-gray-300 font-bold shrink-0">x{item.quantity}</span>
                                                </div>
                                                {item.remark && (
                                                    <p className="text-[10px] text-amber-500/80 font-mono tracking-wide mt-1 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10 w-fit max-w-full whitespace-pre-wrap">
                                                        {item.remark}
                                                    </p>
                                                )}
                                            </div>
                                            );
                                        })}
                                    </div>

                                    {order.notes && (
                                        <div className="mt-2 text-[10px] text-yellow-500/80 italic">
                                            Note: {order.notes}
                                        </div>
                                    )}

                                    {/* Cargo Prep Photo Upload / Thumbnail */}
                                    {(() => {
                                        const photos = parsePrepPhotos(order.preparation_photo_url);
                                        return (
                                            <div className="mt-3 border-t border-white/5 pt-3 space-y-2">
                                                {photos.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {photos.map((p, idx) => (
                                                            <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black/40 shadow-inner group cursor-zoom-in" onClick={() => onPhotoClick(p.url)}>
                                                                <img 
                                                                    src={p.url} 
                                                                    alt={`Cargo Prep - ${p.location}`} 
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                                {/* Location tag label overlay */}
                                                                <div className="absolute bottom-0 inset-x-0 bg-black/75 text-[8px] font-black text-center text-amber-400 uppercase py-0.5 truncate leading-none">
                                                                    {p.location}
                                                                </div>
                                                                {/* Delete overlay */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onDeleteClick(order.id, idx);
                                                                    }}
                                                                    className="absolute top-0 right-0 p-0.5 bg-red-600/90 hover:bg-red-600 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Delete Photo"
                                                                >
                                                                    <Trash2 size={8} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                                                        {photos.length > 0 ? `${photos.length} Photos` : 'No Cargo Photo'}
                                                    </span>
                                                    <button
                                                        onClick={() => onUploadClick(order.id)}
                                                        disabled={uploadingId === order.id}
                                                        className="px-2.5 py-1.5 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                                    >
                                                        <Camera size={11} />
                                                        {uploadingId === order.id ? 'Uploading...' : 'Add Photo'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}
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
