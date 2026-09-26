import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../services/supabase';
import { getV2Items, getInventoryStatus } from '../services/apiV2';
import { SalesOrder, SalesOrderItem, User } from '../types';
import { Calendar, User as UserIcon, Truck, MapPin, Package, Camera, Trash2, X, ChevronDown, ChevronUp, CheckCircle, RefreshCw, Clock, AlertTriangle, Search, Phone, ExternalLink, Zap, PackageCheck, Car, CheckCircle2, Image as ImageIcon, Video, FolderOpen } from 'lucide-react';
import Webcam from 'react-webcam';
import { parsePrepPhotos, stringifyPrepPhotos, PrepPhoto } from '../utils/prepPhotos';
import { compressImage, dataURLtoBlob } from '../utils/imageCompress';
import { guessItemLocation } from './DeliveryOrderManagement';
import { useTranslation } from "react-i18next";

// ─── TYPES & CONSTANTS ────────────────────────────────────────────────────────

type FactoryHub = 'Taiping' | 'Nilai' | 'Kelantan' | 'Johor';

const FACTORY_HUBS: FactoryHub[] = ['Taiping', 'Nilai', 'Kelantan', 'Johor'];

const TAIPING_WAREHOUSES = ['OPM Lama', 'OPM Corner', 'OPM Ali', 'SPD', 'All'] as const;

// Normalize inventory loc_id to match warehouse names
const normalizeLoc = (locId: string): string => {
    const lower = (locId || '').toLowerCase().trim();
    const LOC_ALIASES: Record<string, string> = {
        'spd': 'SPD', 
        'opm lama': 'OPM Lama', 
        'opm_lama': 'OPM Lama',
        'opm corner': 'OPM Corner', 
        'opm_corner': 'OPM Corner',
        'opm ali': 'OPM Ali', 
        'opm_ali': 'OPM Ali',
        'nilai': 'Nilai',
        'kelantan': 'Kelantan',
        'johor': 'Johor'
    };
    return LOC_ALIASES[lower] || locId;
};

// Sub-locations sharing stock fallback
const STOCK_FALLBACK: Record<string, string> = {
    'OPM Corner': 'SPD',
    'OPM Lama': 'SPD',
    'OPM Ali': 'SPD',
};

const getLocalDateString = (d: Date = new Date()): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDayOfWeekBadge = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return '';
    const date = new Date(y, m - 1, d);
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${daysEn[date.getDay()]} · ${daysZh[date.getDay()]}`;
};

// Determine the factory hub of an order
const getOrderFactory = (order: any): FactoryHub => {
    const orig = (order.trip_origin || '').toUpperCase().trim();
    if (orig.includes('NILAI') || orig === 'N1') return 'Nilai';
    if (orig.includes('KELANTAN') || orig === 'K1') return 'Kelantan';
    if (orig.includes('JOHOR') || orig === 'J1') return 'Johor';
    if (orig.includes('TAIPING') || orig === 'T1' || orig.includes('OPM') || orig.includes('SPD')) return 'Taiping';

    const text = `${order.zone || ''} ${order.delivery_address || ''} ${order.notes || ''}`.toLowerCase();
    
    // 1. Check Johor keywords, towns & postcodes (80000 - 86999)
    if (
        text.includes('johor') || text.includes('skudai') || text.includes('senai') || text.includes('jb') ||
        text.includes('batu pahat') || text.includes('muar') || text.includes('kluang') || text.includes('kulai') ||
        text.includes('segamat') || text.includes('pontian') || text.includes('pasir gudang') || text.includes('tangkak') ||
        text.includes('kota tinggi') || text.includes('mersing') || text.includes('yong peng') || text.includes('kempas') ||
        text.includes('tampoi') || text.includes('ulu tiram') || text.includes('masai') || text.includes('plentong') ||
        /\b8[0-6]\d{3}\b/.test(text)
    ) return 'Johor';

    // 2. Check Nilai (Central Hub) keywords
    if (text.includes('nilai') || text.includes('seremban') || text.includes('kl') || text.includes('selangor') || text.includes('kuala lumpur') || text.includes('melaka') || text.includes('malacca') || text.includes('putrajaya')) return 'Nilai';

    // 3. Check Kelantan keywords
    if (text.includes('kelantan') || text.includes('kota bharu') || text.includes('terengganu') || text.includes('tumpat') || text.includes('pasir mas') || text.includes('bachok') || text.includes('pasir puteh')) return 'Kelantan';

    return 'Taiping';
};

// Determine specific item warehouse
const getItemWarehouse = (item: SalesOrderItem, order: any, activeFactory: FactoryHub): string => {
    if (item.sourceLocation && item.sourceLocation.trim()) {
        return normalizeLoc(item.sourceLocation.trim());
    }
    const origin = order.trip_origin || activeFactory;
    return guessItemLocation(item, origin) || (activeFactory === 'Taiping' ? 'OPM Lama' : activeFactory);
};

// Determine item unit of measurement (UOM)
const getItemUom = (productName: string, sku?: string): string => {
    const s = (sku || '').toUpperCase();
    const p = productName.toUpperCase();
    if (s.startsWith('BW-') || p.includes('BUBBLE') || p.includes('MERAH') || p.includes('HITAM') || p.includes('OREN') || p.includes('DL-') || p.includes('SL-')) {
        return 'Rolls / 卷';
    }
    if (s.startsWith('SF-') || p.includes('STRETCH') || p.includes('BABY ROLL') || p.includes('BABYROLL')) {
        return 'Rolls / 卷';
    }
    if (s.includes('TAPE') || p.includes('TAPE') || p.includes('CUKUPP') || s.includes('AWB')) {
        return 'Box / 箱';
    }
    if (p.includes('FOAM')) {
        return 'Rolls / 卷';
    }
    return 'Units / 件';
};

// Helper to extract trip number or tag from order notes or orderNumber
const extractTripIdentifier = (notes?: string): { tripSeq?: number; tripTag?: string } => {
    if (!notes) return {};
    const lower = notes.toLowerCase();

    // 1. Check bracket format: [Trip: trip 2 malam hantar]
    const mBracket = notes.match(/\[Trip:\s*([^\]]+)\]/i);
    if (mBracket) {
        const content = mBracket[1].trim();
        const numMatch = content.match(/\b(\d+)\b/);
        if (numMatch) {
            return { tripSeq: parseInt(numMatch[1], 10), tripTag: `Trip ${numMatch[1]}` };
        }
        return { tripTag: content };
    }

    // 2. Check "trip 1", "trip 2", "trip 3"
    const mTrip = lower.match(/\btrip\s*(\d+)\b/);
    if (mTrip) {
        return { tripSeq: parseInt(mTrip[1], 10), tripTag: `Trip ${mTrip[1]}` };
    }

    // 3. Check "1p", "2p", "3p" (Malaysian pusingan / trip shorthand)
    const mP = lower.match(/\b(\d+)\s*p\b/);
    if (mP) {
        return { tripSeq: parseInt(mP[1], 10), tripTag: `Trip ${mP[1]}` };
    }

    return {};
};

export interface SelfPickupItem {
    order: SalesOrder;
    isStaged: boolean;
    isDelivered: boolean;
    stagedPhotos: PrepPhoto[];
    vehiclePlate?: string;
    totalRolls: number;
    specialBadges: {
        hasCod: boolean;
        hasNightDelivery: boolean;
        hasExchange?: boolean;
    };
}

export function isSelfPickupOrder(order: SalesOrder): boolean {
    if ((order as any).delivery_method === 'SELF_PICKUP') return true;
    if (order.zone && (order.zone.toUpperCase().includes('PICKUP') || order.zone.toUpperCase().includes('AMBIL'))) return true;
    const noteText = `${order.notes || ''} ${order.customer || ''} ${(order as any).terms || ''}`.toLowerCase();
    return (
        noteText.includes('self pickup') || 
        noteText.includes('self-pickup') || 
        noteText.includes('walk in') || 
        noteText.includes('walk-in') || 
        noteText.includes('ambil sendiri') ||
        noteText.includes('pickup')
    );
}

export interface TripGroup {
    tripId: string;
    tripNumber: string;
    driverId: string | null;
    driverName: string;
    lorryId: string | null;
    lorryPlate: string;
    tripOrigin: FactoryHub;
    orders: SalesOrder[];
    totalRolls: number;
    totalDrops: number;
    zones: string[];
    photos: PrepPhoto[];
    isPrepared: boolean;
    isLoaded?: boolean;
    tripStatus?: string;
    tripSequence: number;
    createdDate?: string;
    // Special Badges
    hasCod: boolean;
    hasNightDelivery: boolean;
    hasSelfPickup: boolean;
    hasExchange?: boolean;
    specialNotes: string[];
}

interface OrderSummaryProps {
    user?: any;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const OrderSummary: React.FC<OrderSummaryProps> = ({ user }) => {
    const { t } = useTranslation();

    // Factory & Warehouse Tab States
    const [activeFactory, setActiveFactory] = useState<FactoryHub>('Taiping');
    const [activeTaipingWarehouse, setActiveTaipingWarehouse] = useState<string>('OPM Lama');

    // Date Filtering States (Added 'pending_prep' mode)
    const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
    const [dateMode, setDateMode] = useState<'today' | 'tomorrow' | 'pending_prep' | 'all_active' | 'custom'>('today');
    const [showLoadedTrips, setShowLoadedTrips] = useState<boolean>(false);

    // Data States
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [tripsMap, setTripsMap] = useState<Record<string, any>>({});
    const [lorries, setLorries] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<User[]>([]);
    const [skuNameMap, setSkuNameMap] = useState<Record<string, string>>({});
    const [stockMapByLoc, setStockMapByLoc] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(false);

    // Search & Expand States
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedTripIds, setExpandedTripIds] = useState<Record<string, boolean>>({});

    // Photo Upload & Camera States
    const [uploadingTarget, setUploadingTarget] = useState<{ type: 'trip' | 'order'; id: string } | null>(null);
    const [photoActionTarget, setPhotoActionTarget] = useState<{ type: 'trip' | 'order'; id: string } | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [showWebcam, setShowWebcam] = useState(false);
    const [webcamError, setWebcamError] = useState<any>(null);
    const webcamRef = useRef<Webcam>(null);
    const fetchIdRef = useRef(0);

    // Self-Pickup Handover States
    const [handoverTarget, setHandoverTarget] = useState<SalesOrder | null>(null);

    const handleToggleOrderStaged = async (order: SalesOrder) => {
        try {
            const nextStatus = (order.status === 'Ready-to-Ship' || order.status === 'Loaded') ? 'New' : 'Ready-to-Ship';
            const { error } = await supabase.from('sales_orders').update({
                status: nextStatus
            }).eq('id', order.id);

            if (error) throw error;
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: nextStatus as any } : o));
        } catch (e) {
            console.error("Failed to toggle order staged:", e);
        }
    };

    // ─── DATE HELPERS ─────────────────────────────────────────────────────────

    const handleDateModeChange = (mode: 'today' | 'tomorrow' | 'pending_prep' | 'all_active' | 'custom') => {
        setDateMode(mode);
        if (mode === 'today') {
            setSelectedDate(getLocalDateString());
        } else if (mode === 'tomorrow') {
            const tmr = new Date();
            tmr.setDate(tmr.getDate() + 1);
            setSelectedDate(getLocalDateString(tmr));
        }
    };

    // ─── FETCH INITIAL DATA (Items, Stock, Lorries, Drivers) ──────────────────

    useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const [items, inventory, lorriesRes, usersRes, sysUsersRes] = await Promise.all([
                    getV2Items(),
                    getInventoryStatus(),
                    supabase.from('lorries').select('id, plate_number, driver_id, driver_name'),
                    supabase.from('users_public').select('*'),
                    supabase.from('sys_users_v2').select('id, auth_user_id, role_modules')
                ]);

                if (items) {
                    const nameMap: Record<string, string> = {};
                    items.forEach(item => { nameMap[item.sku] = item.name; });
                    setSkuNameMap(nameMap);

                    if (inventory) {
                        const locSkuStock: Record<string, Record<string, number>> = {};
                        inventory.forEach(inv => {
                            const loc = normalizeLoc(inv.loc_id || 'Unknown');
                            if (!locSkuStock[loc]) locSkuStock[loc] = {};
                            locSkuStock[loc][inv.sku] = (locSkuStock[loc][inv.sku] || 0) + inv.current_stock;
                        });

                        const finalStockMap: Record<string, Record<string, number>> = {};
                        Object.keys(locSkuStock).forEach(loc => {
                            finalStockMap[loc] = {};
                            items.forEach(item => {
                                finalStockMap[loc][item.name] = locSkuStock[loc][item.sku] || 0;
                                if (item.sku) {
                                    finalStockMap[loc][item.sku] = locSkuStock[loc][item.sku] || 0;
                                }
                            });
                        });
                        setStockMapByLoc(finalStockMap);
                    }
                }

                if (lorriesRes.data) {
                    setLorries(lorriesRes.data);
                }

                if (usersRes.data) {
                    const driverCapableSet = new Set<string>();
                    (sysUsersRes.data || []).forEach((su: any) => {
                        if (su.role_modules && Array.isArray(su.role_modules) && su.role_modules.includes('delivery-driver')) {
                            if (su.id) driverCapableSet.add(su.id);
                            if (su.auth_user_id) driverCapableSet.add(su.auth_user_id);
                        }
                    });

                    const filteredDrivers = usersRes.data.filter(u =>
                        u.role === 'Driver' || driverCapableSet.has(u.id)
                    );
                    setDrivers(filteredDrivers.map(u => ({
                        uid: u.id,
                        email: u.email,
                        name: (u.name && u.name.trim() !== '') ? u.name : (u.email?.split('@')[0] || 'Driver'),
                        role: 'Driver',
                        factoryId: u.factory_id,
                        base_location: u.base_location || u.factory_id,
                    } as any)));
                }
            } catch (err) {
                console.error("Master data fetch failed:", err);
            }
        };

        fetchMasterData();
    }, []);

    // ─── FETCH ORDERS & TRIPS ─────────────────────────────────────────────────

    const fetchOrdersAndTrips = useCallback(async () => {
        const fetchId = ++fetchIdRef.current;
        setLoading(true);
        try {
            let query = supabase
                .from('sales_orders')
                .select('*')
                .neq('status', 'Cancelled')
                .neq('status', 'Delivered');

            if (dateMode === 'pending_prep') {
                // Fetch all orders that still need prep / loading
                query = query.in('status', ['New', 'Planned', 'Assigned', 'In-Production', 'Ready-to-Ship', 'Loading']);
            } else if (dateMode === 'all_active') {
                // All active open orders
            } else {
                // today / tomorrow / custom:
                // Delivery date is strictly deadline; only fall back to order_date if deadline is null
                query = query.or(`deadline.eq.${selectedDate},and(deadline.is.null,order_date.eq.${selectedDate})`);
            }

            const { data: ordersData, error: ordersErr } = await query;
            if (ordersErr) throw ordersErr;
            if (fetchId !== fetchIdRef.current) return;

            const mappedOrders: SalesOrder[] = (ordersData || []).map(o => ({
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
                tripSequence: o.trip_sequence || o.stop_sequence || 0,
                factoryId: o.factory_id,
                trip_origin: o.trip_origin,
                trip_drop_count: o.trip_drop_count,
                trip_id: o.trip_id,
                preparation_photo_url: o.preparation_photo_url,
            }));

            // Fetch associated trips_v2
            const tripIds = Array.from(new Set(mappedOrders.map(o => o.trip_id).filter(Boolean))) as string[];
            let tMap: Record<string, any> = {};
            if (tripIds.length > 0) {
                const { data: tripsData } = await supabase
                    .from('trips_v2')
                    .select('*')
                    .in('id', tripIds);

                if (fetchId !== fetchIdRef.current) return;

                (tripsData || []).forEach(t => {
                    tMap[t.id] = t;
                });
            }

            if (fetchId !== fetchIdRef.current) return;
            setOrders(mappedOrders);
            setTripsMap(tMap);
        } catch (err) {
            console.error("Failed to fetch orders/trips:", err);
        } finally {
            if (fetchId === fetchIdRef.current) {
                setLoading(false);
            }
        }
    }, [selectedDate, dateMode]);

    useEffect(() => {
        fetchOrdersAndTrips();
    }, [fetchOrdersAndTrips]);

    // ─── SUPABASE REALTIME SUBSCRIPTION (Live Dispatch & Naik Barang Sync) ───
    useEffect(() => {
        const channel = supabase.channel('order-summary-realtime-dispatch')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => {
                fetchOrdersAndTrips();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips_v2' }, () => {
                fetchOrdersAndTrips();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchOrdersAndTrips]);

    // ─── ITEM NAME RESOLUTION ─────────────────────────────────────────────────

    const resolveItemName = (item: { product: string; sku?: string }) => {
        let name = (item.sku && skuNameMap[item.sku]) ? skuNameMap[item.sku] : item.product;
        if (name && name.includes('STRECTH FIL')) {
            name = name.replace('STRECTH FIL', 'STRETCH FILM');
        }
        return name || item.product;
    };

    // ─── AGGREGATE ORDERS INTO TRIPS (Smart Grouping) & SELF-PICKUP ORDERS ─────

    const { trips: allTripGroups, pickupOrders: allPickupOrders } = useMemo(() => {
        const groups: Record<string, TripGroup> = {};
        const pickups: SelfPickupItem[] = [];

        orders.forEach(order => {
            // Client-side date filter safeguard:
            // When in a specific date mode (today, tomorrow, custom), strictly only include orders
            // whose effective delivery date (deadline or order_date if null) matches selectedDate.
            const effectiveDate = (order.deadline || order.orderDate || '').slice(0, 10);
            if (dateMode !== 'pending_prep' && dateMode !== 'all_active') {
                if (effectiveDate !== selectedDate) {
                    return; // Skip orders belonging to other delivery dates
                }
            }

            const rollsInOrder = (order.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
            const noteText = `${order.notes || ''} ${(order as any).terms || ''}`.toLowerCase();

            // 1. Check if order is Self-Pickup
            if (isSelfPickupOrder(order)) {
                const plateMatch = (order.notes || '').match(/\b([A-Z]{1,3}\s*\d{1,4}\s*[A-Z]?)\b/i);
                const vehiclePlate = plateMatch ? plateMatch[1].toUpperCase() : undefined;

                const prepPhotos = parsePrepPhotos(order.preparation_photo_url);
                const isStaged = prepPhotos.length > 0 || order.status === 'Ready-to-Ship' || order.status === 'Loaded';
                const isDelivered = order.status === 'Delivered';

                pickups.push({
                    order,
                    isStaged,
                    isDelivered,
                    stagedPhotos: prepPhotos,
                    vehiclePlate,
                    totalRolls: rollsInOrder,
                    specialBadges: {
                        hasCod: /cod|c\.o\.d|cash|tunai/i.test(noteText),
                        hasNightDelivery: /malam|night|petang/i.test(noteText)
                    }
                });
                return;
            }

            // 2. Regular delivery orders -> Grouped into trips
            const extracted = extractTripIdentifier(order.notes);
            const driverId = order.driverId || null;
            const dateKey = (order.deadline || order.orderDate || '').slice(0, 10);
            const factory = getOrderFactory(order);

            let tripKey = '';
            let tripNum = '';
            let isFromV2 = false;

            if (order.trip_id) {
                tripKey = order.trip_id;
                const tripV2 = tripsMap[order.trip_id];
                tripNum = tripV2?.trip_number || `TRIP-${order.trip_id.slice(0, 8).toUpperCase()}`;
                isFromV2 = true;
            } else {
                // Smart Grouping for manual / legacy orders without trip_id
                const driverObj = drivers.find(d => d.uid === driverId);
                const driverPrefix = driverObj?.name ? driverObj.name.split(' ')[0].toUpperCase() : 'UNASSIGNED';
                const dateCode = dateKey ? dateKey.replace(/-/g, '').slice(2) : '260917';
                const isExplicitSeq = order.tripSequence && order.tripSequence !== 999;
                const tripTag = extracted.tripTag || (isExplicitSeq ? `Trip ${order.tripSequence}` : 'Trip 1');

                tripKey = `grouped_${factory}_${driverId || 'unassigned'}_${dateKey}_${tripTag.replace(/\s+/g, '_')}`;
                tripNum = `TRIP-${factory.toUpperCase()}-${driverPrefix}-${dateCode}-${tripTag}`;
            }

            if (!groups[tripKey]) {
                const tripV2 = isFromV2 ? tripsMap[tripKey] : null;
                const resolvedDriverId = tripV2?.driver_id || driverId;
                const driver = drivers.find(d => d.uid === resolvedDriverId);
                const driverName = driver?.name || (resolvedDriverId ? 'Assigned Driver' : 'Unassigned / 待指派');

                const lorryId = tripV2?.lorry_id || null;
                let lorryPlate = '';
                if (lorryId) {
                    const l = lorries.find(x => x.id === lorryId);
                    lorryPlate = l?.plate_number || '';
                } else if (resolvedDriverId) {
                    const l = lorries.find(x => x.driver_id === resolvedDriverId);
                    lorryPlate = l?.plate_number || '';
                }

                const finalSeq = (order.tripSequence && order.tripSequence !== 999) ? order.tripSequence : (extracted.tripSeq || 1);

                groups[tripKey] = {
                    tripId: tripKey,
                    tripNumber: tripNum,
                    driverId: resolvedDriverId,
                    driverName,
                    lorryId,
                    lorryPlate,
                    tripOrigin: factory,
                    orders: [],
                    totalRolls: 0,
                    totalDrops: 0,
                    zones: [],
                    photos: [],
                    isPrepared: tripV2?.status === 'Prepared' || tripV2?.status === 'Loading',
                    tripSequence: finalSeq,
                    createdDate: dateKey,
                    hasCod: false,
                    hasNightDelivery: false,
                    hasSelfPickup: false,
                    hasExchange: false,
                    specialNotes: []
                };
            }

            groups[tripKey].orders.push(order);
            groups[tripKey].totalRolls += rollsInOrder;

            // Collect zones
            if (order.zone && !groups[tripKey].zones.includes(order.zone)) {
                groups[tripKey].zones.push(order.zone);
            }

            // Check Special Badges (COD, Night Delivery, Exchange)
            if (noteText.includes('c.o.d') || noteText.includes('cod') || noteText.includes('cash on delivery') || noteText.includes('bayar tunai')) {
                groups[tripKey].hasCod = true;
            }
            if (noteText.includes('malam') || noteText.includes('night') || noteText.includes('petang')) {
                groups[tripKey].hasNightDelivery = true;
            }
            if (noteText.includes('exchange') || noteText.includes('换货') || noteText.includes('ambil balik') || noteText.includes('tukar barang')) {
                groups[tripKey].hasExchange = true;
            }
            if (order.notes && order.notes.trim() && !groups[tripKey].specialNotes.includes(order.notes.trim())) {
                groups[tripKey].specialNotes.push(order.notes.trim());
            }

            // Collect prep photos
            const orderPhotos = parsePrepPhotos(order.preparation_photo_url);
            orderPhotos.forEach(p => {
                if (!groups[tripKey].photos.some(existing => existing.url === p.url)) {
                    groups[tripKey].photos.push(p);
                }
            });
        });

        // Finalize trip properties
        Object.values(groups).forEach(g => {
            const explicitDrops = g.orders.map(o => Number(o.trip_drop_count)).filter(d => Boolean(d) && d > 0);
            const allSameExplicit = explicitDrops.length > 0 && explicitDrops.every(d => d === explicitDrops[0]);
            if (allSameExplicit && explicitDrops[0] > 1) {
                g.totalDrops = explicitDrops[0];
            } else if (g.orders.length === 1 && explicitDrops.length === 1) {
                g.totalDrops = explicitDrops[0];
            } else {
                g.totalDrops = g.orders.length;
            }
            if (g.photos.length > 0 || tripsMap[g.tripId]?.status === 'Prepared') {
                g.isPrepared = true;
            }

            // Naik barang / Loaded check:
            // 1. trips_v2 record status indicates In Transit / En-Route / Loaded / Completed / Delivered
            // 2. OR all orders in the trip have status Loaded / In-Transit / Shipped / Delivered
            const tripV2 = tripsMap[g.tripId];
            const isTripV2Loaded = tripV2 && ['In Transit', 'En-Route', 'Loaded', 'Completed', 'Delivered'].includes(tripV2.status);
            const areAllOrdersLoaded = g.orders.length > 0 && g.orders.every(o =>
                o.status === 'Loaded' || o.status === 'In-Transit' || o.status === 'Shipped' || o.status === 'Delivered'
            );
            g.isLoaded = Boolean(isTripV2Loaded || areAllOrdersLoaded);
            g.tripStatus = tripV2?.status || (g.isLoaded ? 'Loaded' : (g.isPrepared ? 'Prepared' : 'Planning'));

            g.orders.sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));
        });

        return { trips: Object.values(groups), pickupOrders: pickups };
    }, [orders, tripsMap, drivers, lorries, selectedDate, dateMode]);

    // ─── FILTER TRIPS BY FACTORY & WAREHOUSE ───────────────────────────────────

    const filteredTrips = useMemo(() => {
        return allTripGroups.filter(trip => {
            // 0. Driver Naik Barang / Loaded Filter: Hide trips where goods have already been loaded onto the lorry
            if (!showLoadedTrips && trip.isLoaded) {
                return false;
            }

            // 1. Factory Hub check
            if (trip.tripOrigin !== activeFactory) {
                return false;
            }

            // 2. Sub-warehouse check (for Taiping)
            if (activeFactory === 'Taiping' && activeTaipingWarehouse !== 'All') {
                const hasItemInWarehouse = trip.orders.some(o =>
                    (o.items || []).some(it => getItemWarehouse(it, o, activeFactory) === activeTaipingWarehouse)
                );
                if (!hasItemInWarehouse) return false;
            }

            // 3. Search Term filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchTrip = trip.tripNumber.toLowerCase().includes(term);
                const matchDriver = trip.driverName.toLowerCase().includes(term);
                const matchLorry = trip.lorryPlate.toLowerCase().includes(term);
                const matchOrder = trip.orders.some(o =>
                    o.orderNumber.toLowerCase().includes(term) ||
                    o.customer.toLowerCase().includes(term) ||
                    (o.deliveryAddress || '').toLowerCase().includes(term) ||
                    (o.items || []).some(it => (it.product || '').toLowerCase().includes(term) || (it.sku || '').toLowerCase().includes(term))
                );
                return matchTrip || matchDriver || matchLorry || matchOrder;
            }

            return true;
        });
    }, [allTripGroups, activeFactory, activeTaipingWarehouse, searchTerm, showLoadedTrips]);

    // ─── FILTER PICKUP ORDERS BY FACTORY & WAREHOUSE ───────────────────────────

    const filteredPickupOrders = useMemo(() => {
        return allPickupOrders.filter(item => {
            const factory = getOrderFactory(item.order);
            if (factory !== activeFactory) return false;

            if (activeFactory === 'Taiping' && activeTaipingWarehouse !== 'All') {
                const hasItemInWarehouse = (item.order.items || []).some(it =>
                    getItemWarehouse(it, item.order, activeFactory) === activeTaipingWarehouse
                );
                if (!hasItemInWarehouse) return false;
            }

            // Hide already collected / delivered pickups unless showLoadedTrips is true
            if (!showLoadedTrips && (item.isDelivered || item.order.status === 'Delivered')) {
                return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchCustomer = item.order.customer.toLowerCase().includes(term);
                const matchOrder = item.order.orderNumber.toLowerCase().includes(term);
                const matchNote = (item.order.notes || '').toLowerCase().includes(term);
                const matchPlate = (item.vehiclePlate || '').toLowerCase().includes(term);
                return matchCustomer || matchOrder || matchNote || matchPlate;
            }

            return true;
        });
    }, [allPickupOrders, activeFactory, activeTaipingWarehouse, searchTerm, showLoadedTrips]);

    // ─── PRODUCTION REQUIREMENTS SUMMARY ──────────────────────────────────────

    const productionRequirements = useMemo(() => {
        const summary: Record<string, { qty: number; sku?: string; category: string; uom: string }> = {};

        // 1. Tally from regular delivery trips
        filteredTrips.forEach(trip => {
            trip.orders.forEach(order => {
                if (order.status === 'Loaded' || order.status === 'Delivered' || order.status === 'Pending Approval') return;

                (order.items || []).forEach(item => {
                    const itemLoc = getItemWarehouse(item, order, activeFactory);

                    if (activeFactory === 'Taiping' && activeTaipingWarehouse !== 'All' && itemLoc !== activeTaipingWarehouse) {
                        return;
                    }

                    const name = resolveItemName(item);
                    const uom = getItemUom(name, item.sku);

                    if (!summary[name]) {
                        summary[name] = { qty: 0, sku: item.sku, category: categorizeProduct(name, item.sku), uom };
                    }
                    summary[name].qty += Number(item.quantity) || 0;
                    if (item.sku && !summary[name].sku) summary[name].sku = item.sku;
                });
            });
        });

        // 2. Tally from customer self-pickup orders
        filteredPickupOrders.forEach(pItem => {
            const order = pItem.order;
            if (order.status === 'Delivered' || order.status === 'Cancelled' || order.status === 'Pending Approval') return;

            (order.items || []).forEach(item => {
                const itemLoc = getItemWarehouse(item, order, activeFactory);

                if (activeFactory === 'Taiping' && activeTaipingWarehouse !== 'All' && itemLoc !== activeTaipingWarehouse) {
                    return;
                }

                const name = resolveItemName(item);
                const uom = getItemUom(name, item.sku);

                if (!summary[name]) {
                    summary[name] = { qty: 0, sku: item.sku, category: categorizeProduct(name, item.sku), uom };
                }
                summary[name].qty += Number(item.quantity) || 0;
                if (item.sku && !summary[name].sku) summary[name].sku = item.sku;
            });
        });

        // Group by category
        const grouped: Record<string, { product: string; qty: number; sku?: string; uom: string }[]> = {};
        Object.entries(summary).forEach(([product, data]) => {
            if (!grouped[data.category]) grouped[data.category] = [];
            grouped[data.category].push({ product, qty: data.qty, sku: data.sku, uom: data.uom });
        });

        return grouped;
    }, [filteredTrips, activeFactory, activeTaipingWarehouse]);

    function getItemUom(name: string, sku?: string): string {
        const s = (sku || '').toLowerCase();
        const lower = name.toLowerCase();
        if (s.startsWith('bw') || lower.includes('bubble') || lower.includes('layer') || lower.includes('single') || lower.includes('double')) return 'Rolls / 卷';
        if (s.startsWith('sf') || lower.includes('stretch film') || lower.includes('strecth') || lower.includes('hand roll')) return 'Rolls / 卷';
        if (lower.includes('tape') || lower.includes('box') || lower.includes('carton') || lower.includes('cukupp')) return 'Boxes / 箱';
        return 'Units / 件';
    }

    function categorizeProduct(name: string, sku?: string): string {
        const s = (sku || '').toLowerCase();
        const lower = name.toLowerCase();

        if (s.startsWith('bw') || lower.includes('single') || lower.includes('double') || lower.includes('layer') || lower.includes('bubble')) return '🫧 Bubble Wrap / 气泡膜';
        if (s.startsWith('sf') || s.includes('sf-') || lower.includes('stretch film') || lower.includes('strecth') || lower.includes('sf') || lower.includes('hand roll') || lower.includes('baby roll')) return '📦 Stretch Film / 拉伸膜';
        if (lower.includes('tape') || lower.includes('awb') || lower.includes('cukupp') || lower.includes('airtube')) return '🏷️ Tapes & Packing / 胶带耗材';
        if (lower.includes('foam') || lower.includes('pe foam')) return '🛡️ PE Foam / 珍珠棉';
        if (lower.includes('corrugated') || lower.includes('box') || lower.includes('carton') || lower.includes('edge')) return '🗂️ Cartons / 纸箱角纸';
        if (lower.includes('core') || lower.includes('paper')) return '📜 Paper Cores / 纸管';
        return '🔹 Others / 其他';
    }

    // ─── PHOTO UPLOAD HANDLERS ────────────────────────────────────────────────

    const triggerUpload = (type: 'trip' | 'order', id: string) => {
        setUploadingTarget({ type, id });
        setPhotoActionTarget({ type, id });
    };

    const processUpload = async (blob: Blob, target: { type: 'trip' | 'order'; id: string }) => {
        setLoading(true);
        try {
            const uploadWarehouse = activeFactory === 'Taiping' ? activeTaipingWarehouse : activeFactory;
            const filename = `prep_${target.type}_${target.id}_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(filename, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(filename);
            const publicUrl = urlData.publicUrl;
            const newPhoto: PrepPhoto = { url: publicUrl, location: uploadWarehouse };

            if (target.type === 'trip') {
                // Whole Trip Upload: update trips_v2 and all orders in this trip
                const trip = allTripGroups.find(g => g.tripId === target.id);
                if (trip) {
                    const updatedPhotos = [...trip.photos, newPhoto];
                    const photoString = stringifyPrepPhotos(updatedPhotos);

                    // 1. Update trip in trips_v2 if real trip
                    if (!target.id.startsWith('grouped_') && !target.id.startsWith('solo_')) {
                        await supabase
                            .from('trips_v2')
                            .update({
                                preparation_photo_url: photoString,
                                status: 'Prepared'
                            })
                            .eq('id', target.id);
                    }

                    // 2. Cascade to all sales_orders in this trip
                    const orderIds = trip.orders.map(o => o.id);
                    await supabase
                        .from('sales_orders')
                        .update({ preparation_photo_url: photoString })
                        .in('id', orderIds);
                }
            } else {
                // Single DO Upload
                const order = orders.find(o => o.id === target.id);
                if (order) {
                    const existingPhotos = parsePrepPhotos(order.preparation_photo_url);
                    const updatedPhotos = [...existingPhotos, newPhoto];
                    const photoString = stringifyPrepPhotos(updatedPhotos);

                    await supabase
                        .from('sales_orders')
                        .update({ preparation_photo_url: photoString })
                        .eq('id', target.id);
                }
            }

            // Sync to work_photos log for HR monthly reports
            if (user) {
                try {
                    const uid = user.uid || user.id;
                    const empName = user.name || user.email?.split('@')[0] || 'Operator';
                    await supabase.from('work_photos').insert({
                        employee_id: uid,
                        employee_name: empName,
                        photo_url: publicUrl,
                        category: t('Cargo Prep / Stocking Photos'),
                        user_note: `Daily Prep - ${target.type.toUpperCase()}: ${target.id} - Factory: ${activeFactory}`,
                        location: uploadWarehouse,
                        risk_flag: false
                    });
                } catch (dbErr) {
                    console.error("work_photos insert error:", dbErr);
                }
            }

            await fetchOrdersAndTrips();
            alert(t('✅ {{var0}} stocking pictures uploaded successfully! / Cargo photo uploaded successfully!', { var0: uploadWarehouse }));
        } catch (err: any) {
            console.error("Upload failed:", err);
            alert("Upload failed: " + err.message);
        } finally {
            setLoading(false);
            setUploadingTarget(null);
            setPhotoActionTarget(null);
        }
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const target = uploadingTarget;
        if (!file || !target) return;

        setLoading(true);
        try {
            const compressed = await compressImage(file);
            const blob = dataURLtoBlob(compressed);
            await processUpload(blob, target);
        } catch (err: any) {
            console.error("Photo processing error:", err);
            alert("Upload failed: " + err.message);
            setLoading(false);
            setUploadingTarget(null);
            setPhotoActionTarget(null);
        } finally {
            if (cameraInputRef.current) cameraInputRef.current.value = '';
            if (galleryInputRef.current) galleryInputRef.current.value = '';
        }
    };

    const handleWebcamCapture = async () => {
        const target = uploadingTarget;
        if (!target) return;
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) {
            alert(t('未能截取摄像头画面，请重试 / Failed to capture image'));
            return;
        }

        setShowWebcam(false);
        setWebcamError(null);
        setLoading(true);
        try {
            const blob = dataURLtoBlob(imageSrc);
            await processUpload(blob, target);
        } catch (err: any) {
            console.error("Webcam upload error:", err);
            alert("Webcam capture failed: " + err.message);
            setLoading(false);
            setUploadingTarget(null);
            setPhotoActionTarget(null);
        }
    };

    // Toggle Mark Prepared for Trip
    const handleToggleMarkPrepared = async (trip: TripGroup) => {
        const newStatus = trip.isPrepared ? 'Planning' : 'Prepared';
        try {
            if (!trip.tripId.startsWith('grouped_') && !trip.tripId.startsWith('solo_')) {
                await supabase
                    .from('trips_v2')
                    .update({ status: newStatus })
                    .eq('id', trip.tripId);
            }
            await fetchOrdersAndTrips();
        } catch (err: any) {
            console.error("Toggle prepared status failed:", err);
        }
    };

    // Toggle Trip expansion
    const toggleTripExpand = (tripId: string) => {
        setExpandedTripIds(prev => ({
            ...prev,
            [tripId]: !prev[tripId]
        }));
    };

    // ─── DND REASSIGNMENT WITH CROSS-FACTORY GUARDRAIL ────────────────────────

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newDriverId = destination.droppableId === 'unassigned' ? null : destination.droppableId;
        const tripId = draggableId;
        const targetTrip = allTripGroups.find(g => g.tripId === tripId);
        if (!targetTrip) return;

        // 🛡️ Cross-Factory Guardrail Check
        if (newDriverId) {
            const targetDriver = drivers.find(d => d.uid === newDriverId);
            const driverBase = (targetDriver as any)?.base_location || targetDriver?.factoryId;
            if (driverBase && targetTrip.tripOrigin) {
                const normBase = driverBase.toLowerCase().trim();
                const normTrip = targetTrip.tripOrigin.toLowerCase().trim();
                const isMatch = normBase === normTrip ||
                               (normTrip === 'taiping' && (normBase === 't1' || normBase === 'spd' || normBase.includes('opm'))) ||
                               (normTrip === 'nilai' && normBase === 'n1');

                if (!isMatch) {
                    const proceed = window.confirm(
                        `⚠️ 跨厂区指派提醒 / Cross-hub Reassignment Warning:\n\n` +
                        `司机 ${targetDriver?.name} 的常驻基地是 [${driverBase}]，而当前车次的出发厂区是 [${targetTrip.tripOrigin}]。\n\n` +
                        `确定要将此车次指派给跨区域司机吗？`
                    );
                    if (!proceed) {
                        return; // Abort drag & drop
                    }
                }
            }
        }

        try {
            // Find lorry tied to driver if applicable
            const matchedLorry = lorries.find(l => l.driver_id === newDriverId);
            const lorryId = matchedLorry ? matchedLorry.id : null;

            if (!tripId.startsWith('grouped_') && !tripId.startsWith('solo_')) {
                await supabase
                    .from('trips_v2')
                    .update({
                        driver_id: newDriverId,
                        lorry_id: lorryId
                    })
                    .eq('id', tripId);
            }

            // Cascade driver assignment to all orders in this trip
            const orderIds = targetTrip.orders.map(o => o.id);
            await supabase
                .from('sales_orders')
                .update({ driver_id: newDriverId })
                .in('id', orderIds);

            await fetchOrdersAndTrips();
        } catch (err) {
            console.error("Trip reassignment error:", err);
            await fetchOrdersAndTrips();
        }
    };

    // ─── BUILD COLUMNS FOR CURRENT FACTORY ────────────────────────────────────

    const factoryDrivers = useMemo(() => {
        const activeDriverIdsInTrips = new Set(filteredTrips.map(t => t.driverId).filter(Boolean));
        return drivers.filter(d =>
            activeDriverIdsInTrips.has(d.uid) ||
            !d.factoryId ||
            d.factoryId.toLowerCase() === activeFactory.toLowerCase() ||
            (activeFactory === 'Taiping' && (d.factoryId === 'T1' || d.factoryId === 'SPD'))
        );
    }, [drivers, filteredTrips, activeFactory]);

    // Trips counts for Tab badges (only counts pending prep/loading when showLoadedTrips is false)
    const factoryTripCounts = useMemo(() => {
        const counts: Record<FactoryHub, number> = {
            Taiping: 0,
            Nilai: 0,
            Kelantan: 0,
            Johor: 0
        };
        allTripGroups.forEach(t => {
            if (!showLoadedTrips && t.isLoaded) return;
            if (counts[t.tripOrigin] !== undefined) {
                counts[t.tripOrigin]++;
            }
        });
        return counts;
    }, [allTripGroups, showLoadedTrips]);

    // Count of loaded trips (naik barang) for current factory
    const loadedTripsCount = useMemo(() => {
        return allTripGroups.filter(t => t.tripOrigin === activeFactory && t.isLoaded).length;
    }, [allTripGroups, activeFactory]);

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 text-slate-200">
                {/* ── Top Header ─────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                                <span>{t('Daily Prep (production preparation)')}</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold border border-blue-500/30">
                                    V2 Trip-Based
                                </span>
                            </h1>
                        </div>
                        <p className="text-slate-400 text-xs">
                            {t('Drag trips to reassign drivers or reorder sequence')} · {t('支持整车一键备货拍照与总卷数清点')}
                        </p>
                    </div>

                    {/* Date Selector & Quick Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-xl p-1 text-xs">
                            <button
                                onClick={() => handleDateModeChange('today')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${dateMode === 'today' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t('Today')}
                            </button>
                            <button
                                onClick={() => handleDateModeChange('tomorrow')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${dateMode === 'tomorrow' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t('Tomorrow')}
                            </button>
                            <button
                                onClick={() => handleDateModeChange('pending_prep')}
                                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${dateMode === 'pending_prep' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-400 hover:text-emerald-300'}`}
                                title="Show all active orders needing preparation"
                            >
                                <Zap size={12} />
                                <span>{t('待备货')}</span>
                            </button>
                            <button
                                onClick={() => handleDateModeChange('all_active')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${dateMode === 'all_active' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t('All Active')}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                            <Calendar className="text-slate-500 shrink-0" size={15} />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => {
                                    setSelectedDate(e.target.value);
                                    setDateMode('custom');
                                }}
                                className="bg-transparent border-none text-white font-mono text-xs focus:ring-0 outline-none [color-scheme:dark]"
                            />
                            {selectedDate && (
                                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 shrink-0">
                                    {getDayOfWeekBadge(selectedDate)}
                                </span>
                            )}
                        </div>

                        <button
                            onClick={fetchOrdersAndTrips}
                            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-95"
                            title="Refresh"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-400' : ''} />
                        </button>

                        {/* Toggle Loaded / Naik Barang Trips */}
                        <button
                            onClick={() => setShowLoadedTrips(prev => !prev)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                                showLoadedTrips
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                            title={showLoadedTrips ? t('点击隐藏已装车发车的卡片') : t('点击查看已装车发车的历史卡片')}
                        >
                            <Truck size={14} className={showLoadedTrips ? 'text-amber-400' : 'text-slate-400'} />
                            <span>{showLoadedTrips ? t('显示已装车') : t('已装车离场')}</span>
                            {loadedTripsCount > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                                    showLoadedTrips ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}>
                                    {loadedTripsCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Search Bar ─────────────────────────────────────────────── */}
                <div className="mb-5 relative">
                    <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={t('Search DO, customer, product, driver, or lorry plate...')}
                        className="w-full bg-slate-900/90 border border-slate-800 pl-10 pr-4 py-2 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60"
                    />
                </div>

                {/* ── Top Factory Tabs (4 Hubs) ─────────────────────────────── */}
                <div className="flex mb-3 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 shadow-inner overflow-x-auto gap-1">
                    {FACTORY_HUBS.map(hub => {
                        const isActive = activeFactory === hub;
                        const count = factoryTripCounts[hub] || 0;
                        return (
                            <button
                                key={hub}
                                onClick={() => setActiveFactory(hub)}
                                className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    isActive
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                }`}
                            >
                                <span>{hub}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                    {count} {t('Trips')}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* ── Sub-Warehouse Tabs (For Taiping Hub) ────────────────────── */}
                {activeFactory === 'Taiping' && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-6 px-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">
                            {t('Warehouse')}:
                        </span>
                        {TAIPING_WAREHOUSES.map(wh => {
                            const isActive = activeTaipingWarehouse === wh;
                            return (
                                <button
                                    key={wh}
                                    onClick={() => setActiveTaipingWarehouse(wh)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        isActive
                                            ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400 shadow-sm'
                                            : 'bg-slate-900/70 border border-slate-800/80 text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {wh === 'All' ? t('All Warehouses') : wh}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── Production Requirements Summary Card ──────────────────── */}
                <div className="mb-8 bg-slate-950/80 border border-blue-500/20 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-white/5">
                        <h2 className="text-xs sm:text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                            <Package size={16} className="text-blue-400" />
                            <span>{t('Production Requirements')}</span>
                            <span className="text-slate-400 text-xs font-mono font-normal">
                                ({activeFactory}{activeFactory === 'Taiping' ? ` · ${activeTaipingWarehouse}` : ''})
                            </span>
                        </h2>
                        <div className="text-[11px] text-slate-400 font-mono">
                            {t('Total Trips')}: <strong className="text-white font-bold">{filteredTrips.length}</strong> · {t('Total Rolls')}: <strong className="text-amber-400 font-bold">{filteredTrips.reduce((acc, t) => acc + t.totalRolls, 0)}</strong>
                        </div>
                    </div>

                    {Object.keys(productionRequirements).length === 0 ? (
                        <div className="text-xs text-slate-500 italic py-4 text-center">
                            {t('No production requirements found for this selection.')}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(productionRequirements).map(([category, items]) => (
                                <div key={category}>
                                    <h3 className="text-[10px] font-black text-blue-300/80 uppercase tracking-widest mb-2.5 pb-1 border-b border-blue-500/10">
                                        {category}
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                                        {items.map(({ product, qty, sku, uom }) => {
                                            let lookupLoc = activeFactory === 'Taiping' ? (activeTaipingWarehouse === 'All' ? 'OPM Lama' : activeTaipingWarehouse) : activeFactory;
                                            if (!stockMapByLoc[lookupLoc] && STOCK_FALLBACK[lookupLoc]) {
                                                lookupLoc = STOCK_FALLBACK[lookupLoc];
                                            }
                                            const stock = (sku && stockMapByLoc[lookupLoc]?.[sku] !== undefined)
                                                ? stockMapByLoc[lookupLoc][sku]
                                                : (stockMapByLoc[lookupLoc]?.[product] || 0);
                                            const deficit = qty - stock;
                                            const hasDeficit = deficit > 0;
                                            const uomShort = uom.split('/')[0].trim();

                                            return (
                                                <div
                                                    key={product}
                                                    className={`bg-slate-900/90 border rounded-xl p-2.5 flex flex-col justify-between relative transition-all ${
                                                        hasDeficit
                                                            ? 'border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.12)]'
                                                            : 'border-slate-800 hover:border-slate-700'
                                                    }`}
                                                >
                                                    {hasDeficit && (
                                                        <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]" title="Shortage" />
                                                    )}
                                                    <div className="pr-2 min-w-0 mb-2">
                                                        <div className="text-xs font-black text-white truncate" title={product}>
                                                            {product}
                                                        </div>
                                                        <div className="text-[9px] text-cyan-400 font-mono truncate" title={sku || product}>
                                                            {sku || product}
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 border-t border-white/5 flex items-end justify-between">
                                                        <div>
                                                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                                                {t('Req')} ({uomShort})
                                                            </div>
                                                            <div className="text-base font-black text-amber-300 font-mono leading-none mt-0.5">
                                                                {qty} <span className="text-[9px] text-amber-400/60 font-normal">{uomShort}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                                                {t('Stock')}
                                                            </div>
                                                            <div className={`text-xs font-black font-mono leading-none mt-0.5 ${stock >= qty ? 'text-emerald-400' : 'text-amber-500'}`}>
                                                                {stock}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {hasDeficit && (
                                                        <div className="mt-1.5 text-[8px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex items-center justify-between">
                                                            <span>{t('Shortage')}</span>
                                                            <span className="font-mono">-{deficit} {uomShort}</span>
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

                {/* ── Kanban Columns ────────────────────────────────────────── */}
                {loading && filteredTrips.length === 0 && filteredPickupOrders.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 animate-pulse font-mono text-sm">
                        Loading daily preparation trips...
                    </div>
                ) : filteredTrips.length === 0 && filteredPickupOrders.length === 0 ? (
                    <div className="text-center py-16 text-slate-600 italic border border-dashed border-slate-800 rounded-2xl">
                        {t('No trips found for {{var0}} on this date.', { var0: activeFactory })}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {/* 📦 Customer Self-Pickup Bay Column (Dedicated, not grouped into truck trips) */}
                        {filteredPickupOrders.length > 0 && (
                            <SelfPickupColumn
                                pickupOrders={filteredPickupOrders}
                                onUploadPhoto={(orderId) => triggerUpload('order', orderId)}
                                onToggleStaged={handleToggleOrderStaged}
                                onOpenHandover={(order) => setHandoverTarget(order)}
                                onPhotoClick={setPreviewImageUrl}
                                resolveItemName={resolveItemName}
                            />
                        )}

                        {/* Unassigned Trips Column */}
                        {(() => {
                            const unassignedTrips = filteredTrips.filter(t => !t.driverId);
                            if (unassignedTrips.length === 0 && factoryDrivers.length > 0) return null;
                            return (
                                <TripColumn
                                    key="unassigned"
                                    droppableId="unassigned"
                                    label={t('Unassigned Trips / 待指派车次')}
                                    trips={unassignedTrips}
                                    isUnassigned
                                    expandedTripIds={expandedTripIds}
                                    onToggleExpand={toggleTripExpand}
                                    onUploadTripPhoto={(tripId) => triggerUpload('trip', tripId)}
                                    onUploadOrderPhoto={(orderId) => triggerUpload('order', orderId)}
                                    onTogglePrepared={handleToggleMarkPrepared}
                                    onPhotoClick={setPreviewImageUrl}
                                    resolveItemName={resolveItemName}
                                    activeFactory={activeFactory}
                                />
                            );
                        })()}

                        {/* Driver Assigned Columns */}
                        {factoryDrivers.map(driver => {
                            const driverTrips = filteredTrips.filter(t => t.driverId === driver.uid);
                            if (driverTrips.length === 0) return null;
                            return (
                                <TripColumn
                                    key={driver.uid}
                                    droppableId={driver.uid}
                                    label={driver.name || driver.email || 'Driver'}
                                    trips={driverTrips}
                                    expandedTripIds={expandedTripIds}
                                    onToggleExpand={toggleTripExpand}
                                    onUploadTripPhoto={(tripId) => triggerUpload('trip', tripId)}
                                    onUploadOrderPhoto={(orderId) => triggerUpload('order', orderId)}
                                    onTogglePrepared={handleToggleMarkPrepared}
                                    onPhotoClick={setPreviewImageUrl}
                                    resolveItemName={resolveItemName}
                                    activeFactory={activeFactory}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Hidden File Inputs for Native Camera and Gallery */}
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelect}
                />
                <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                />

                {/* Photo Action Sheet / Modal */}
                {photoActionTarget && (() => {
                    const isTrip = photoActionTarget.type === 'trip';
                    const trip = isTrip ? allTripGroups.find(g => g.tripId === photoActionTarget.id) : null;
                    const order = !isTrip ? orders.find(o => o.id === photoActionTarget.id) : null;
                    const uploadWarehouse = activeFactory === 'Taiping' ? activeTaipingWarehouse : activeFactory;

                    return (
                        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
                            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 flex flex-col">
                                {/* Header */}
                                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                            <Camera size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-black text-white truncate">
                                                {t('Add Prep Photo / 添加备货照片')}
                                            </h3>
                                            <p className="text-[11px] text-slate-400 truncate">
                                                {isTrip 
                                                    ? `${trip?.tripId || photoActionTarget.id} · ${trip?.lorryPlate || t('No Plate')} (${trip?.orders.length || 0} DOs)`
                                                    : `${order?.orderNumber || photoActionTarget.id} · ${order?.customer || ''}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPhotoActionTarget(null);
                                            setUploadingTarget(null);
                                        }}
                                        className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Warehouse Location Info */}
                                <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs">
                                    <span className="text-slate-400 flex items-center gap-1.5">
                                        <MapPin size={13} className="text-amber-400" />
                                        <span>{t('Staging Location / 备货库位')}:</span>
                                    </span>
                                    <span className="font-bold font-mono text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">
                                        {uploadWarehouse}
                                    </span>
                                </div>

                                {/* Actions Grid */}
                                <div className="p-4 sm:p-5 space-y-3">
                                    {/* Primary Action: Direct Camera (拍照) */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPhotoActionTarget(null);
                                            if (cameraInputRef.current) {
                                                cameraInputRef.current.value = '';
                                                cameraInputRef.current.click();
                                            }
                                        }}
                                        className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white rounded-2xl font-black text-base shadow-lg shadow-emerald-950/50 flex items-center justify-between transition-all cursor-pointer border border-emerald-400/30 group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                                <Camera size={24} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-black tracking-wide">
                                                    📸 {t('Ambil Gambar / Take Photo / 现场拍照')}
                                                </div>
                                                <div className="text-[10px] text-emerald-100 font-normal mt-0.5">
                                                    {t('启动手机相机实时拍摄货品 (Launch Camera)')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-emerald-200 text-xs font-bold bg-emerald-700/40 px-2 py-1 rounded-lg border border-emerald-400/20">
                                            {t('Recommended')}
                                        </div>
                                    </button>

                                    {/* Secondary Action: Photo Gallery (相册选择) */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPhotoActionTarget(null);
                                            if (galleryInputRef.current) {
                                                galleryInputRef.current.value = '';
                                                galleryInputRef.current.click();
                                            }
                                        }}
                                        className="w-full py-3.5 px-4 bg-slate-800/90 hover:bg-slate-750 active:scale-[0.98] text-white rounded-2xl font-bold text-sm shadow-md flex items-center gap-3 transition-all cursor-pointer border border-slate-700/80 group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
                                            <ImageIcon size={20} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-slate-200">
                                                📁 {t('Pilih dari Galeri / Gallery Upload / 相册上传')}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                                {t('从手机相册或电脑文件选取已有图片 (Album / Files)')}
                                            </div>
                                        </div>
                                    </button>

                                    {/* Tertiary Action: Live Webcam (电脑端摄像头) */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPhotoActionTarget(null);
                                            setShowWebcam(true);
                                        }}
                                        className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800/80 active:scale-[0.98] text-slate-400 hover:text-slate-200 rounded-2xl font-medium text-xs flex items-center gap-3 transition-all cursor-pointer border border-slate-800 group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform border border-purple-500/20">
                                            <Video size={16} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <div className="text-xs font-bold text-slate-300">
                                                💻 {t('Webcam Live / 电脑摄像头取景')}
                                            </div>
                                            <div className="text-[9px] text-slate-500 mt-0.5">
                                                {t('适用电脑网页端调用摄像头实时截图')}
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* Footer Cancel */}
                                <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 text-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPhotoActionTarget(null);
                                            setUploadingTarget(null);
                                        }}
                                        className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                                    >
                                        {t('Cancel / Batal / 取消')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Webcam Live Capture Modal */}
                {showWebcam && (
                    <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
                            {/* Header */}
                            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Camera size={18} className="text-amber-400" />
                                    <h3 className="text-sm font-black text-white">{t('Webcam Live Photo / 摄像头拍照')}</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowWebcam(false);
                                        setWebcamError(null);
                                        setUploadingTarget(null);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Viewfinder */}
                            <div className="p-4 bg-black flex flex-col items-center justify-center min-h-[260px] relative">
                                {webcamError ? (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center text-center gap-2 text-red-400">
                                        <AlertTriangle size={24} />
                                        <p className="text-xs font-bold">{t('无法启动摄像头 / Cannot access webcam')}</p>
                                        <p className="text-[11px] text-slate-400 leading-normal">
                                            {t('请检查浏览器权限，或使用上方手机拍照/相册上传功能。')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                                        <Webcam
                                            audio={false}
                                            ref={webcamRef}
                                            screenshotFormat="image/jpeg"
                                            screenshotQuality={0.9}
                                            videoConstraints={{
                                                facingMode: "environment",
                                                width: { ideal: 1920, min: 1280 },
                                                height: { ideal: 1080, min: 720 }
                                            }}
                                            onUserMediaError={(err) => setWebcamError(err)}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowWebcam(false);
                                        setWebcamError(null);
                                        setUploadingTarget(null);
                                    }}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition cursor-pointer"
                                >
                                    {t('Cancel / 取消')}
                                </button>
                                <button
                                    type="button"
                                    disabled={!!webcamError}
                                    onClick={handleWebcamCapture}
                                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:grayscale text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 transition cursor-pointer"
                                >
                                    <Camera size={16} />
                                    <span>{t('Capture & Save / 截图并保存')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading / Uploading Overlay */}
                {loading && uploadingTarget && (
                    <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3">
                            <RefreshCw size={32} className="text-amber-400 animate-spin" />
                            <span className="text-sm font-bold text-white">{t('正在压缩并上传照片... / Uploading Photo...')}</span>
                            <span className="text-xs text-slate-400">{t('请稍候，系统正在同步备货状态')}</span>
                        </div>
                    </div>
                )}

                {/* Self-Pickup Handover Modal */}
                {handoverTarget && (
                    <SelfPickupHandoverModal
                        order={handoverTarget}
                        onClose={() => setHandoverTarget(null)}
                        onSuccess={(orderId, updatePayload) => {
                            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatePayload } : o));
                            setHandoverTarget(null);
                        }}
                        resolveItemName={resolveItemName}
                    />
                )}

                {/* Image Preview Modal */}
                {previewImageUrl && (
                    <div
                        className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md cursor-zoom-out"
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
                            alt="Stocking Preview"
                            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-4">
                            Ketik di mana-mana untuk tutup / Tap anywhere to close
                        </p>
                    </div>
                )}
            </div>
        </DragDropContext>
    );
};

// ─── TRIP COLUMN COMPONENT ───────────────────────────────────────────────────

interface TripColumnProps {
    droppableId: string;
    label: string;
    trips: TripGroup[];
    isUnassigned?: boolean;
    expandedTripIds: Record<string, boolean>;
    onToggleExpand: (tripId: string) => void;
    onUploadTripPhoto: (tripId: string) => void;
    onUploadOrderPhoto: (orderId: string) => void;
    onTogglePrepared: (trip: TripGroup) => void;
    onPhotoClick: (url: string) => void;
    resolveItemName: (item: { product: string; sku?: string }) => string;
    activeFactory: FactoryHub;
}

const TripColumn: React.FC<TripColumnProps> = ({
    droppableId,
    label,
    trips,
    isUnassigned,
    expandedTripIds,
    onToggleExpand,
    onUploadTripPhoto,
    onUploadOrderPhoto,
    onTogglePrepared,
    onPhotoClick,
    resolveItemName,
    activeFactory
}) => {
    const { t } = useTranslation();

    const totalColumnRolls = trips.reduce((acc, t) => acc + t.totalRolls, 0);

    return (
        <div className={`flex flex-col gap-3 rounded-2xl p-3 sm:p-4 border transition-all ${
            isUnassigned ? 'bg-slate-950/60 border-dashed border-slate-700' : 'bg-slate-950/80 border-slate-800'
        }`}>
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 shadow-md ${
                        isUnassigned ? 'bg-slate-800 text-slate-400' : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                    }`}>
                        {isUnassigned ? '?' : label.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white truncate" title={label}>
                            {label}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                            <Truck size={11} className="text-slate-500" />
                            <span>{trips.length} {t('Trips')}</span>
                            <span>·</span>
                            <span className="text-amber-400 font-bold">{trips.reduce((acc, t) => acc + t.orders.length, 0)} {t('DOs')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Droppable Area for Trips */}
            <Droppable droppableId={droppableId}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-3 min-h-[100px] transition-colors rounded-xl p-1 ${
                            snapshot.isDraggingOver ? 'bg-blue-500/5 border border-blue-500/20' : ''
                        }`}
                    >
                        {trips.map((trip, index) => (
                            <Draggable key={trip.tripId} draggableId={trip.tripId} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                    <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className={`bg-slate-900 border rounded-2xl p-3.5 transition-all shadow-md group ${
                                            dragSnapshot.isDragging
                                                ? 'shadow-2xl border-blue-500 ring-2 ring-blue-500/20 z-50 rotate-1'
                                                : 'border-slate-800/90 hover:border-slate-700'
                                        }`}
                                    >
                                        {/* Trip Card Top Header */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                                <span className="font-mono text-xs font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                                                    {trip.tripNumber}
                                                </span>
                                                {trip.lorryPlate && (
                                                    <span className="font-mono text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                                                        <Truck size={10} className="text-slate-400" />
                                                        {trip.lorryPlate}
                                                    </span>
                                                )}
                                                {trip.createdDate && (
                                                    <span className="font-mono text-[10px] text-slate-400 bg-slate-950/70 px-1.5 py-0.5 rounded border border-slate-800">
                                                        📅 {trip.createdDate}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Prepared / Loaded Badge */}
                                            {trip.isLoaded ? (
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                                    title={t('已装车发车 / Pemandu telah sahkan naik barang')}
                                                >
                                                    <Truck size={10} className="text-blue-400" />
                                                    <span>{t('已装车 / Loaded')}</span>
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onTogglePrepared(trip);
                                                    }}
                                                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                                                        trip.isPrepared
                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                                                    }`}
                                                    title="Click to toggle prepared status"
                                                >
                                                    {trip.isPrepared ? (
                                                        <>
                                                            <CheckCircle size={10} className="text-emerald-400" />
                                                            <span>{t('Prepared')}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock size={10} className="text-amber-400" />
                                                            <span>{t('Pending Prep')}</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        {/* 🏷️ Special Flags & Indicators (COD, Malam, Pickup, Exchange) */}
                                        {(trip.hasCod || trip.hasNightDelivery || trip.hasSelfPickup || trip.hasExchange) && (
                                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                                {trip.hasCod && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                                                        💵 C.O.D. ({t('货到付款')})
                                                    </span>
                                                )}
                                                {trip.hasNightDelivery && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                                                        🌙 Malam ({t('夜间送货')})
                                                    </span>
                                                )}
                                                {trip.hasSelfPickup && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                                                        📦 Self Pickup ({t('自提')})
                                                    </span>
                                                )}
                                                {trip.hasExchange && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                                                        🔄 Exchange ({t('换货')})
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Trip Cargo Breakdown (Replaces unpractical Total Rolls) */}
                                        {(() => {
                                            const prodMap = new Map<string, { name: string; qty: number; uom?: string }>();
                                            trip.orders.forEach(o => {
                                                (o.items || []).forEach((it: any) => {
                                                    const name = resolveItemName(it) || it.product || it.sku || 'Item';
                                                    const qty = Number(it.quantity) || 0;
                                                    const uom = getItemUom(name, it.sku);
                                                    const existing = prodMap.get(name);
                                                    if (existing) {
                                                        existing.qty += qty;
                                                    } else {
                                                        prodMap.set(name, { name, qty, uom });
                                                    }
                                                });
                                            });
                                            const tripProducts = Array.from(prodMap.values());

                                            return (
                                                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 mb-3 space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-1 text-slate-400 font-bold">
                                                        <span className="text-[10px] uppercase tracking-wider flex items-center gap-1 text-amber-400 font-black">
                                                            📦 {t('Khas Muatan Trip')} ({tripProducts.length} {t('Jenis')})
                                                        </span>
                                                        <span className="font-mono text-[11px] text-slate-400">
                                                            {trip.totalDrops} {t('DOs')} {trip.zones.length > 0 ? `· ${trip.zones.join(', ')}` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1 pt-0.5 max-h-48 overflow-y-auto pr-1">
                                                        {tripProducts.length === 0 ? (
                                                            <div className="text-[10px] text-slate-500 italic py-1 text-center">{t('Tiada barang')}</div>
                                                        ) : (
                                                            tripProducts.map((p, pIdx) => (
                                                                <div key={pIdx} className="flex items-center justify-between text-xs gap-2 py-0.5 border-b border-slate-900/60 last:border-0">
                                                                    <span className="text-slate-200 font-bold text-[11px] truncate" title={p.name}>
                                                                        {p.name}
                                                                    </span>
                                                                    <span className="font-mono font-black text-amber-300 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs">
                                                                        {p.qty} <span className="text-[9px] font-normal text-amber-400/80">{p.uom || ''}</span>
                                                                    </span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Trip Action Buttons */}
                                        <div className="flex items-center gap-2 mb-2">
                                            {/* Trip Prep Camera Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onUploadTripPhoto(trip.tripId);
                                                }}
                                                className="flex-1 py-1.5 px-2.5 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 border border-amber-500/30 rounded-xl text-[10px] font-bold text-amber-300 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                            >
                                                <Camera size={12} className="text-amber-400" />
                                                <span>{t('Trip Prep Photo')}</span>
                                            </button>

                                            {/* Expand/Collapse Toggle */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleExpand(trip.tripId);
                                                }}
                                                className="py-1.5 px-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-[10px] font-bold text-slate-300 flex items-center gap-1 transition-all"
                                                title="Toggle DO list"
                                            >
                                                <span>{expandedTripIds[trip.tripId] ? t('Collapse') : t('Expand')}</span>
                                                {expandedTripIds[trip.tripId] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                        </div>

                                        {/* Trip Photo Thumbnails */}
                                        {trip.photos.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2 pt-1 border-t border-slate-800/50">
                                                {trip.photos.map((p, pIdx) => (
                                                    <div
                                                        key={pIdx}
                                                        className="relative w-11 h-11 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black shadow-inner cursor-zoom-in group/img"
                                                        onClick={() => onPhotoClick(p.url)}
                                                    >
                                                        <img
                                                            src={p.url}
                                                            alt={`Prep - ${p.location}`}
                                                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-200"
                                                        />
                                                        <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] font-bold text-center text-amber-400 uppercase py-0.5 truncate leading-none">
                                                            {p.location}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* ── Expanded Section: DO Cards ────────────────── */}
                                        {expandedTripIds[trip.tripId] && (
                                            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5 animate-in fade-in-50 duration-200">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                                    <span>{t('Delivery Orders in this trip')}</span>
                                                    <span>({trip.orders.length})</span>
                                                </div>

                                                {trip.orders.map((order, oIdx) => (
                                                    <div
                                                        key={order.id}
                                                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-xs space-y-1.5"
                                                    >
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="font-mono font-bold text-blue-400 text-[11px]">
                                                                #{oIdx + 1} {order.orderNumber}
                                                            </span>
                                                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                                                order.status === 'Delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                                                            }`}>
                                                                {order.status}
                                                            </span>
                                                        </div>

                                                        <div className="font-medium text-slate-200 truncate" title={order.customer}>
                                                            {order.customer}
                                                        </div>

                                                        {order.deliveryAddress && (
                                                            <div className="text-[10px] text-slate-400 flex items-start gap-1 truncate" title={order.deliveryAddress}>
                                                                <MapPin size={10} className="mt-0.5 shrink-0 text-slate-500" />
                                                                <span className="truncate">{order.deliveryAddress}</span>
                                                            </div>
                                                        )}

                                                        {/* Special Note highlight */}
                                                        {order.notes && (
                                                            <div className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                                                                💡 {order.notes}
                                                            </div>
                                                        )}

                                                        {/* Item Breakdown */}
                                                        <div className="bg-black/30 rounded-lg p-1.5 space-y-1 mt-1">
                                                            {(order.items || []).map((it, itIdx) => {
                                                                const resolved = resolveItemName(it);
                                                                const wh = getItemWarehouse(it, order, activeFactory);
                                                                return (
                                                                    <div key={itIdx} className="flex items-center justify-between text-[11px] gap-1">
                                                                        <div className="truncate flex-1" title={resolved}>
                                                                            <span className="text-slate-300 font-semibold">{resolved}</span>
                                                                            <span className="ml-1 text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1 py-0.2 rounded border border-blue-500/20">
                                                                                {wh}
                                                                            </span>
                                                                        </div>
                                                                        <span className="font-mono font-bold text-amber-300 shrink-0">
                                                                            x{it.quantity}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Single DO Photo Upload Button */}
                                                        <div className="pt-1 flex items-center justify-between text-[10px]">
                                                            <span className="text-slate-500 text-[9px]">
                                                                {parsePrepPhotos(order.preparation_photo_url).length} {t('Photos')}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onUploadOrderPhoto(order.id);
                                                                }}
                                                                className="text-[9px] font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                                                            >
                                                                <Camera size={10} />
                                                                <span>{t('Add DO Photo')}</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Bottom Sticky Action Bar for long lists on mobile */}
                                                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onUploadTripPhoto(trip.tripId);
                                                        }}
                                                        className="flex-1 py-1.5 px-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-xl text-[10px] font-bold text-amber-300 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                                    >
                                                        <Camera size={12} className="text-amber-400" />
                                                        <span>{t('Trip Prep Photo')}</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onToggleExpand(trip.tripId);
                                                        }}
                                                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[10px] font-bold text-slate-300 flex items-center gap-1 transition-all active:scale-95"
                                                    >
                                                        <ChevronUp size={12} />
                                                        <span>{t('Collapse DOs')}</span>
                                                    </button>
                                                </div>
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
        </div>
    );
};

// ─── SELF-PICKUP COLUMN COMPONENT ──────────────────────────────────────────

interface SelfPickupColumnProps {
    pickupOrders: SelfPickupItem[];
    onUploadPhoto: (orderId: string) => void;
    onToggleStaged: (order: SalesOrder) => void;
    onOpenHandover: (order: SalesOrder) => void;
    onPhotoClick: (url: string) => void;
    resolveItemName: (item: { product: string; sku?: string }) => string;
}

const SelfPickupColumn: React.FC<SelfPickupColumnProps> = ({
    pickupOrders,
    onUploadPhoto,
    onToggleStaged,
    onOpenHandover,
    onPhotoClick,
    resolveItemName
}) => {
    const { t } = useTranslation();
    const totalRolls = pickupOrders.reduce((sum, p) => sum + p.totalRolls, 0);
    const stagedCount = pickupOrders.filter(p => p.isStaged || p.isDelivered).length;

    const getItemUomShort = (name: string, sku?: string) => {
        const s = (sku || '').toLowerCase();
        const lower = name.toLowerCase();
        if (s.startsWith('bw') || lower.includes('bubble') || lower.includes('layer')) return 'Rolls';
        if (s.startsWith('sf') || lower.includes('stretch film')) return 'Rolls';
        if (lower.includes('tape') || lower.includes('box') || lower.includes('carton') || lower.includes('cukupp')) return 'Boxes';
        return 'Units';
    };

    return (
        <div className="bg-slate-900/60 border-2 border-amber-500/30 rounded-2xl p-3 sm:p-4 flex flex-col h-fit shadow-xl">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-500/20">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <PackageCheck size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white flex items-center gap-2">
                            <span>{t('Self-Pickup Bay')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/40">
                                {pickupOrders.length} {t('Orders')}
                            </span>
                        </h2>
                        <p className="text-[10px] text-amber-300/70 font-medium">
                            {t('到厂自提 · 独立核销')} · {stagedCount}/{pickupOrders.length} {t('Staged')}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">{t('Total Rolls')}</span>
                    <span className="text-base font-black text-amber-400 font-mono leading-tight">{totalRolls}</span>
                </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
                {pickupOrders.map(({ order, isStaged, isDelivered, stagedPhotos, vehiclePlate, specialBadges }) => {
                    return (
                        <div
                            key={order.id}
                            className={`bg-slate-950/80 border rounded-xl p-3.5 transition-all shadow-md ${
                                isDelivered
                                    ? 'border-emerald-500/30 opacity-75'
                                    : isStaged
                                    ? 'border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                                    : 'border-slate-800 hover:border-slate-700'
                            }`}
                        >
                            {/* Card Top: Order Number & Status Badge */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono text-xs font-bold text-slate-300 truncate">
                                        {order.orderNumber}
                                    </span>
                                    {vehiclePlate && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold border border-blue-500/30 flex items-center gap-1 shrink-0">
                                            <Car size={10} />
                                            {vehiclePlate}
                                        </span>
                                    )}
                                </div>

                                {/* Status Pill */}
                                {isDelivered ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                                        <CheckCircle2 size={11} />
                                        {t('Delivered')}
                                    </span>
                                ) : isStaged ? (
                                    <button
                                        type="button"
                                        onClick={() => onToggleStaged(order)}
                                        title="Click to revert to pending"
                                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                    >
                                        <CheckCircle2 size={11} className="text-emerald-400" />
                                        {t('Staged in Bay')}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onToggleStaged(order)}
                                        title="Click to mark as staged"
                                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                    >
                                        <Clock size={11} />
                                        {t('Pending Prep')}
                                    </button>
                                )}
                            </div>

                            {/* Customer Name */}
                            <div className="font-black text-sm text-white mb-1.5 flex items-center gap-1.5">
                                <span className="text-amber-400">👤</span>
                                <span className="truncate">{order.customer}</span>
                            </div>

                            {/* Items List */}
                            <div className="space-y-1 bg-slate-900/50 rounded-lg p-2 mb-2 text-xs border border-white/5">
                                {(order.items || []).map((it, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-slate-300">
                                        <span className="truncate pr-2 font-medium">{resolveItemName(it)}</span>
                                        <span className="font-mono font-bold text-amber-300 shrink-0">
                                            {it.quantity} {getItemUomShort(it.product, it.sku)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Notes & Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                {specialBadges.hasCod && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        💵 C.O.D.
                                    </span>
                                )}
                                {specialBadges.hasNightDelivery && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                        🌙 Malam
                                    </span>
                                )}
                                {order.notes && (
                                    <span className="text-[10px] text-slate-400 italic line-clamp-1 w-full" title={order.notes}>
                                        📝 {order.notes}
                                    </span>
                                )}
                            </div>

                            {/* Photos List if any */}
                            {stagedPhotos.length > 0 && (
                                <div className="flex items-center gap-1.5 mb-3 overflow-x-auto py-1">
                                    {stagedPhotos.map((p, pIdx) => (
                                        <img
                                            key={pIdx}
                                            src={p.url}
                                            alt="Staged cargo"
                                            onClick={() => onPhotoClick(p.url)}
                                            className="w-10 h-10 object-cover rounded-lg border border-emerald-500/40 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Action Buttons: Two-Stage Workflow */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                                <button
                                    type="button"
                                    onClick={() => onUploadPhoto(order.id)}
                                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-xl text-[10px] font-bold text-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <Camera size={12} className="text-amber-400" />
                                    <span>{t('Prep Photo')}</span>
                                </button>

                                {isDelivered ? (
                                    <button
                                        type="button"
                                        disabled
                                        className="py-1.5 px-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[10px] font-bold text-emerald-400 flex items-center justify-center gap-1"
                                    >
                                        <CheckCircle2 size={12} />
                                        <span>{t('已提货')}</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onOpenHandover(order)}
                                        className="py-1.5 px-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold rounded-xl text-[10px] shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                    >
                                        <CheckCircle2 size={12} />
                                        <span>{t('Handover / Release')}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── SELF-PICKUP HANDOVER MODAL COMPONENT ─────────────────────────────────

interface SelfPickupHandoverModalProps {
    order: SalesOrder;
    onClose: () => void;
    onSuccess: (orderId: string, updatedOrder: any) => void;
    resolveItemName: (item: { product: string; sku?: string }) => string;
}

const SelfPickupHandoverModal: React.FC<SelfPickupHandoverModalProps> = ({
    order,
    onClose,
    onSuccess,
    resolveItemName
}) => {
    const { t } = useTranslation();

    // Extract default plate from notes (e.g. PGH 9559)
    const plateMatch = (order.notes || '').match(/\b([A-Z]{1,3}\s*\d{1,4}\s*[A-Z]?)\b/i);
    const [plate, setPlate] = useState(plateMatch ? plateMatch[1].toUpperCase() : '');
    const [collector, setCollector] = useState('');
    const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const getItemUomShort = (name: string, sku?: string) => {
        const s = (sku || '').toLowerCase();
        const lower = name.toLowerCase();
        if (s.startsWith('bw') || lower.includes('bubble') || lower.includes('layer')) return 'Rolls';
        if (s.startsWith('sf') || lower.includes('stretch film')) return 'Rolls';
        if (lower.includes('tape') || lower.includes('box') || lower.includes('carton') || lower.includes('cukupp')) return 'Boxes';
        return 'Units';
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedPhoto(file);
            const reader = new FileReader();
            reader.onload = () => setPhotoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleConfirmHandover = async () => {
        setIsSubmitting(true);
        try {
            let photoUrl = order.pod_photo_url || null;

            if (selectedPhoto) {
                const compressed = await compressImage(selectedPhoto);
                const blob = dataURLtoBlob(compressed);
                const filename = `handover_${order.id}_${Date.now()}.jpg`;

                const { error: uploadError } = await supabase.storage
                    .from('work-photos')
                    .upload(filename, blob, { contentType: 'image/jpeg' });

                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(filename);
                    photoUrl = urlData.publicUrl;
                }
            }

            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toISOString().slice(0, 10);
            const handoverNote = `[Self-Pickup: Plate ${plate.trim() || 'N/A'}, Collector: ${collector.trim() || 'Customer'}, Handed over ${dateStr} ${timeStr}]`;
            const updatedNotes = order.notes ? `${order.notes}\n${handoverNote}` : handoverNote;

            const updatePayload: any = {
                status: 'Delivered',
                pod_photo_url: photoUrl,
                pod_signed_by: collector.trim() || 'Customer Self-Pickup',
                pod_timestamp: now.toISOString(),
                notes: updatedNotes
            };

            const { error: dbError } = await supabase
                .from('sales_orders')
                .update(updatePayload)
                .eq('id', order.id);

            if (dbError) throw dbError;

            onSuccess(order.id, updatePayload);
        } catch (err: any) {
            console.error("Handover error:", err);
            alert(`Handover failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <PackageCheck size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">{t('Self-Pickup Handover')}</h2>
                            <p className="text-xs text-slate-400">
                                {order.orderNumber} · {order.customer}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
                    {/* Items Recap */}
                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                            {t('Order Items / 提货货物清单')}
                        </span>
                        <div className="space-y-1">
                            {(order.items || []).map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center text-slate-200">
                                    <span className="truncate pr-2">{resolveItemName(it)}</span>
                                    <span className="font-mono font-bold text-amber-300 shrink-0">
                                        {it.quantity} {getItemUomShort(it.product, it.sku)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Vehicle Plate Input */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                            <Car size={13} className="text-blue-400" />
                            <span>{t('Vehicle Plate Number')}</span>
                        </label>
                        <input
                            type="text"
                            value={plate}
                            onChange={(e) => setPlate(e.target.value.toUpperCase())}
                            placeholder={t('Vehicle Plate Placeholder')}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold uppercase placeholder:text-slate-600 outline-none focus:border-emerald-500 transition"
                        />
                        {plateMatch && (
                            <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                                <span>💡</span> 从备注自动识别到车牌: <strong className="font-mono">{plateMatch[1]}</strong>
                            </p>
                        )}
                    </div>

                    {/* Collector Name / Phone */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                            {t('Collector Name / Phone')}
                        </label>
                        <input
                            type="text"
                            value={collector}
                            onChange={(e) => setCollector(e.target.value)}
                            placeholder={t('Collector Placeholder')}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-500 transition"
                        />
                    </div>

                    {/* Photo Proof */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                            <Camera size={13} className="text-amber-400" />
                            <span>{t('Take Photo / Document')}</span>
                        </label>

                        {photoPreview ? (
                            <div className="relative rounded-xl overflow-hidden border border-emerald-500/40">
                                <img src={photoPreview} alt="Handover Preview" className="w-full h-44 object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedPhoto(null);
                                            setPhotoPreview(null);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition cursor-pointer"
                                        title={t('Remove Photo')}
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="absolute bottom-2 inset-x-2 flex gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (cameraInputRef.current) {
                                                    cameraInputRef.current.value = '';
                                                    cameraInputRef.current.click();
                                                }
                                            }}
                                            className="flex-1 py-1.5 px-2 rounded-lg bg-black/80 hover:bg-black text-[10px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center justify-center gap-1 backdrop-blur-sm transition"
                                        >
                                            <Camera size={12} />
                                            <span>{t('重拍 / Retake')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (galleryInputRef.current) {
                                                    galleryInputRef.current.value = '';
                                                    galleryInputRef.current.click();
                                                }
                                            }}
                                            className="flex-1 py-1.5 px-2 rounded-lg bg-black/80 hover:bg-black text-[10px] font-bold text-slate-300 border border-white/10 flex items-center justify-center gap-1 backdrop-blur-sm transition"
                                        >
                                            <ImageIcon size={12} />
                                            <span>{t('相册 / Album')}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (cameraInputRef.current) {
                                                cameraInputRef.current.value = '';
                                                cameraInputRef.current.click();
                                            }
                                        }}
                                        className="py-3.5 px-3 border border-emerald-500/40 hover:border-emerald-500 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.98] flex flex-col items-center justify-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition group cursor-pointer"
                                    >
                                        <Camera size={22} className="group-hover:scale-110 transition-transform" />
                                        <span className="font-black text-xs">📸 {t('现场拍照 / Camera')}</span>
                                        <span className="text-[9px] text-emerald-300/70">{t('调起手机相机')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (galleryInputRef.current) {
                                                galleryInputRef.current.value = '';
                                                galleryInputRef.current.click();
                                            }
                                        }}
                                        className="py-3.5 px-3 border border-slate-700 hover:border-slate-500 rounded-xl bg-slate-950/50 hover:bg-slate-900 active:scale-[0.98] flex flex-col items-center justify-center gap-1.5 text-slate-300 hover:text-white transition group cursor-pointer"
                                    >
                                        <ImageIcon size={22} className="group-hover:scale-110 transition-transform text-slate-400" />
                                        <span className="font-bold text-xs">📁 {t('相册上传 / Gallery')}</span>
                                        <span className="text-[9px] text-slate-500">{t('挑选已有照片')}</span>
                                    </button>
                                </div>
                            )}
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handlePhotoChange}
                            />
                            <input
                                ref={galleryInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoChange}
                            />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition cursor-pointer"
                    >
                        {t('Cancel/Cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmHandover}
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                    >
                        {isSubmitting ? (
                            <>
                                <RefreshCw size={13} className="animate-spin" />
                                <span>提交中...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={13} />
                                <span>{t('Confirm Handover & Complete')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderSummary;
