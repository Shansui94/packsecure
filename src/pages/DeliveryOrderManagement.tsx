import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { determineState, findBestFactory, calculateLoad } from '../utils/logistics';
import { generateDraftTripsWithDrivers, DraftTrip } from '../utils/autoRouting';
import {
    Plus, Search, Calendar, FileText, X, Truck,
    User as UserIcon, Box, Zap, Trash2, Scissors, AlertTriangle, MapPin, Wrench, LayoutGrid, List, ArrowUp, ArrowDown,
    CheckCircle, XCircle, Camera, Sparkles, ImagePlus, Download
} from 'lucide-react';
import { WAREHOUSES } from '../data/factoryData';
import {
    SalesOrder,
    User,
    Lorry
} from '../types';
import { V2Item } from '../types/v2';
import { compressImage, dataUrlToBase64Payload } from '../utils/imageCompress';
import * as XLSX from 'xlsx';

type ScannedTripDraft = {
    label: string;
    destinations: string;
    tripCategory: string;
    tripDropCount: number;
    notes: string;
    items: SalesOrder['items'];
    driverId?: string;
    customer?: string;
};

type ScanSheetReview = {
    tripDate: string;
    deliveryDate: string;
    driverId: string;
    sheetNotes: string;
    trips: ScannedTripDraft[];
};

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

// Reusable Searchable Select Component (Ported from SimpleStock for consistency)
interface SearchableSelectProps {
    label?: string;
    icon?: React.ReactNode;
    options: {
        value: string;
        label: string;
        subLabel?: string;
        searchText?: string;
        statusLabel?: string;
        statusColor?: string;
    }[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    minimal?: boolean;
    dropdownMaxHeight?: string;
}

function filterSelectOptions(
    options: SearchableSelectProps['options'],
    search: string
) {
    const sortedByName = [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    if (!search.trim()) return sortedByName.slice(0, 200);

    const q = search.toLowerCase().trim();
    const searchTerms = q.split(/[\s-]+/).filter(Boolean);

    return sortedByName
        .map(opt => {
            const label = opt.label.toLowerCase();
            const sub = (opt.subLabel || '').toLowerCase();
            const extra = (opt.searchText || '').toLowerCase();
            const haystack = `${label} ${sub} ${extra}`;

            if (!searchTerms.every(term => haystack.includes(term))) {
                return { opt, score: -1 };
            }

            let score = 0;
            if (label === q) score += 100;
            else if (label.startsWith(q)) score += 80;
            else if (label.includes(q)) score += 65;
            else if (searchTerms.every(term => label.includes(term))) score += 55;
            else if (sub.includes(q)) score += 25;
            else score += 10;

            return { opt, score };
        })
        .filter(x => x.score >= 0)
        .sort((a, b) => b.score - a.score || a.opt.label.localeCompare(b.opt.label, undefined, { sensitivity: 'base' }))
        .slice(0, 150)
        .map(x => x.opt);
}

/** Trip list search: driver, DO, customer, trip category (zone), destinations, inferred state, notes */
function buildTripSearchHaystack(order: SalesOrder, driverName?: string): string {
    const addr = order.deliveryAddress || '';
    const inferredRegion = addr ? determineState(addr) : '';
    return [
        driverName,
        order.orderNumber,
        order.customer,
        order.zone,
        order.trip_origin,
        addr,
        inferredRegion,
        order.notes,
    ]
        .filter((v): v is string => Boolean(v && String(v).trim()))
        .join(' ')
        .toLowerCase();
}

function ymdToDmy(ymd: string): string {
    const [y, m, d] = ymd.split('-');
    if (!y || !m || !d) return ymd;
    return `${d}/${m}/${y}`;
}

/** Delivery date only (`deadline`), YYYY-MM-DD in local calendar */
function getOrderDeliveryYmd(order: SalesOrder): string | null {
    const raw = order.deadline;
    if (!raw) return null;
    if (raw.includes('T')) return new Date(raw).toLocaleDateString('en-CA');
    return raw.slice(0, 10);
}

/** Parse one search token as a calendar date → YYYY-MM-DD, or null if not a date */
function parseFlexibleDateToken(token: string): string | null {
    const t = token.trim();
    if (!t) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

    const dmy = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
    if (dmy) {
        const day = parseInt(dmy[1], 10);
        const month = parseInt(dmy[2], 10);
        let year = dmy[3] ? parseInt(dmy[3], 10) : new Date().getFullYear();
        if (year < 100) year += 2000;
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    return null;
}

const MONTH_NAME_TO_NUM: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
};

/** Parse search token as YYYY-MM (delivery month), or null */
function parseFlexibleMonthToken(token: string): string | null {
    const t = token.trim().toLowerCase();
    if (!t) return null;
    if (t === 'thismonth' || t === 'this-month') return getLocalCurrentMonthYm();

    if (/^\d{4}-\d{2}$/.test(t)) {
        const m = parseInt(t.slice(5, 7), 10);
        if (m >= 1 && m <= 12) return t;
        return null;
    }

    const my = t.match(/^(\d{1,2})[/.-](\d{4})$/);
    if (my) {
        const month = parseInt(my[1], 10);
        const year = parseInt(my[2], 10);
        if (month >= 1 && month <= 12) {
            return `${year}-${String(month).padStart(2, '0')}`;
        }
    }

    const ym = t.match(/^(\d{4})[/.-](\d{1,2})$/);
    if (ym) {
        const year = parseInt(ym[1], 10);
        const month = parseInt(ym[2], 10);
        if (month >= 1 && month <= 12) {
            return `${year}-${String(month).padStart(2, '0')}`;
        }
    }

    const parts = t.split(/[\s-]+/).filter(Boolean);
    if (parts.length >= 1) {
        const monthNum = MONTH_NAME_TO_NUM[parts[0]];
        if (monthNum) {
            let year = new Date().getFullYear();
            if (parts[1] && /^\d{4}$/.test(parts[1])) year = parseInt(parts[1], 10);
            else if (parts[1] && /^\d{2}$/.test(parts[1])) year = 2000 + parseInt(parts[1], 10);
            return `${year}-${String(monthNum).padStart(2, '0')}`;
        }
    }

    return null;
}

function getLocalCurrentMonthYm(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function orderDeliveryInMonth(order: SalesOrder, monthYm: string): boolean {
    const ymd = getOrderDeliveryYmd(order);
    if (!ymd) return false;
    return ymd.startsWith(`${monthYm}-`);
}

type DeliveryDateFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'month' | 'no_date';

function getLocalTodayYmd(): string {
    return new Date().toLocaleDateString('en-CA');
}

function getLocalTomorrowYmd(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA');
}

function getLocalWeekRangeYmd(): { start: string; end: string } {
    const now = new Date();
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(now);
    mon.setDate(now.getDate() + mondayOffset);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return {
        start: mon.toLocaleDateString('en-CA'),
        end: sun.toLocaleDateString('en-CA'),
    };
}

function orderMatchesDeliveryDateFilter(
    order: SalesOrder,
    filter: DeliveryDateFilter,
    monthYmOverride?: string
): boolean {
    if (monthYmOverride) return orderDeliveryInMonth(order, monthYmOverride);
    if (filter === 'all') return true;
    const ymd = getOrderDeliveryYmd(order);
    if (!ymd) return filter === 'no_date';

    if (filter === 'no_date') return false;
    if (filter === 'today') return ymd === getLocalTodayYmd();
    if (filter === 'tomorrow') return ymd === getLocalTomorrowYmd();
    if (filter === 'week') {
        const { start, end } = getLocalWeekRangeYmd();
        return ymd >= start && ymd <= end;
    }
    if (filter === 'month') return orderDeliveryInMonth(order, getLocalCurrentMonthYm());
    return true;
}

function tripMatchesSearch(order: SalesOrder, search: string, driverName?: string): boolean {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    const delYmd = getOrderDeliveryYmd(order);
    const delYm = delYmd ? delYmd.slice(0, 7) : '';
    const haystack = [
        buildTripSearchHaystack(order, driverName),
        delYmd || '',
        delYm,
        delYmd ? ymdToDmy(delYmd).toLowerCase() : '',
    ].join(' ');

    const terms = q.split(/[\s,]+/).filter(Boolean);
    return terms.every(term => {
        if (term === 'today') return delYmd === getLocalTodayYmd();
        if (term === 'tomorrow') return delYmd === getLocalTomorrowYmd();
        if (term === 'thismonth' || term === 'this-month') {
            return orderDeliveryInMonth(order, getLocalCurrentMonthYm());
        }

        const asMonth = parseFlexibleMonthToken(term);
        if (asMonth) return orderDeliveryInMonth(order, asMonth);

        const asDate = parseFlexibleDateToken(term);
        if (asDate) return delYmd === asDate;
        return haystack.includes(term);
    });
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    label,
    icon,
    options,
    value,
    onChange,
    placeholder = "Search by product name...",
    minimal = false,
    dropdownMaxHeight = 'max-h-[min(50vh,28rem)]',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(o => o.value === value);
    const filtered = filterSelectOptions(options, search);

    useEffect(() => {
        if (isOpen) {
            const t = window.setTimeout(() => searchInputRef.current?.focus(), 50);
            return () => window.clearTimeout(t);
        }
    }, [isOpen]);

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
                        className="fixed inset-0 z-[80]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 z-[90] bg-[#141418] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-3 border-b border-slate-800 bg-slate-900/80">
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={placeholder}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">
                                {filtered.length} match{filtered.length === 1 ? '' : 'es'}
                                {search.trim() ? ` for "${search.trim()}"` : ' — type to filter'}
                            </p>
                        </div>
                        <div className={`overflow-y-auto custom-scrollbar divide-y divide-slate-800/50 ${dropdownMaxHeight}`}>
                        {filtered.map(opt => (
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
                            {filtered.length === 0 && (
                                <div className="p-6 text-center text-gray-500 text-sm">No products found.</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const DeliveryOrderManagement: React.FC = () => {
    const getSafeOrigin = (o?: string) => (o || '').toUpperCase().trim();

    // --- STATE ---
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [drivers, setDrivers] = useState<User[]>([]);
    const [lorries, setLorries] = useState<Lorry[]>([]);
    const [lorryServices, setLorryServices] = useState<any[]>([]); // State for Service Reminders

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [deliveryDateFilter, setDeliveryDateFilter] = useState<DeliveryDateFilter>('all');
    const [deliveryMonthPick, setDeliveryMonthPick] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'dispatch'>('kanban');
    const [sortConfig, setSortConfig] = useState<{ key: string, dir: 'asc'|'desc' } | null>(null);

    // Dispatch Planner States
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [autoDispatchDrafts, setAutoDispatchDrafts] = useState<DraftTrip[] | null>(null);
    const [isAutoDispatchModalOpen, setIsAutoDispatchModalOpen] = useState(false);

    // Location Split State
    const [activeLocation, setActiveLocation] = useState<string>(() => localStorage.getItem('tripActiveLocation') || 'Taiping');

    useEffect(() => {
        localStorage.setItem('tripActiveLocation', activeLocation);
        const origin = activeLocation.toUpperCase();
        setTripOrigin(origin);
        setCurrentItemLoc(origin === 'NILAI' ? 'Nilai' : 'SPD');
        setSelectedOrderIds([]); // Clear selection when location changes
    }, [activeLocation]);



    const [isTripPhotoScanning, setIsTripPhotoScanning] = useState(false);
    const tripPhotoInputRef = useRef<HTMLInputElement>(null);
    const [isTripExcelImporting, setIsTripExcelImporting] = useState(false);
    const tripExcelInputRef = useRef<HTMLInputElement>(null);
    const [isScanReviewOpen, setIsScanReviewOpen] = useState(false);
    const [scanReview, setScanReview] = useState<ScanSheetReview | null>(null);
    const [isBatchCreating, setIsBatchCreating] = useState(false);

    // Editing State
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [editingOrderPhoto, setEditingOrderPhoto] = useState<string | null>(null);

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
    const [currentItemLoc, setCurrentItemLoc] = useState(() => activeLocation.toUpperCase() === 'NILAI' ? 'Nilai' : 'SPD'); // New Location state

    // --- Driver Payroll Rate State ---
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);
    const [tripOrigin, setTripOrigin] = useState(activeLocation.toUpperCase());
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
    const [customerDB, setCustomerDB] = useState<any[]>([]);

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
            endDate.setDate(endDate.getDate() + 30);
            const endDateStr = endDate.toISOString().split('T')[0];

            const { data: serviceData } = await supabase
                .from('lorry_service_requests')
                .select('*')
                .neq('status', 'Completed')
                .or(`scheduled_date.gte.${today},status.eq.Pending`);

            if (serviceData) {
                const filteredServices = serviceData.filter(s => {
                    if (s.status === 'Pending') return true;
                    return s.scheduled_date && s.scheduled_date <= endDateStr;
                });
                setLorryServices(filteredServices);
            }

            const [usersRes, ordersRes, itemsRes, leavesRes, lorriesRes, servicesRes, ratesRes, customersRes] = await Promise.all([
                supabase.from('users_public').select('*'),
                supabase.from('sales_orders').select('*').order('trip_sequence', { ascending: true }).order('created_at', { ascending: false }),
                getV2Items(),
                supabase.from('employee_leave').select('*'),
                supabase.from('lorries').select('*'),
                supabase.from('lorry_service_requests').select('*').eq('status', 'Scheduled'),
                supabase.from('delivery_rates').select('*').order('location_name'),
                supabase.from('sys_customers').select('*').order('name')
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
            if (customersRes?.data) setCustomerDB(customersRes.data);
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
                    role: 'Driver',
                    base_location: u.base_location
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
                    tripSequence: o.trip_sequence || 0,
                    trip_origin: o.trip_origin,
                    trip_drop_count: o.trip_drop_count,
                    proof_of_load_url: o.proof_of_load_url,
                    pod_photo_url: o.pod_photo_url,
                    pod_signature_url: o.pod_signature_url,
                    pod_signed_by: o.pod_signed_by,
                    pod_timestamp: o.pod_timestamp
                }));
                setOrders(mappedOrders);
            }
        } catch (err) {
            console.error("System Error:", err);
        }
    };

    const handleLeaveAction = async (leaveId: string, newStatus: 'Approved' | 'Rejected') => {
        if (!window.confirm(`Are you sure you want to ${newStatus} this leave?`)) return;
        try {
            await supabase.from('employee_leave').update({ status: newStatus }).eq('id', leaveId);
            fetchData();
        } catch (err) {
            console.error("Failed to approve/reject leave", err);
        }
    };

    const handleScheduleService = async (serviceId: string, dateStr: string) => {
        if (!dateStr) return;
        try {
            await supabase.from('lorry_service_requests').update({ status: 'Scheduled', scheduled_date: dateStr }).eq('id', serviceId);
            fetchData();
        } catch (err) {
            console.error("Failed to schedule service", err);
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
        const strictConflict = driverLeaves.filter(l => l.status === 'Approved').find(l => {
            if (l.employee_id !== driverId) return false;
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
        const nearConflict = driverLeaves.filter(l => l.status === 'Approved').find(l => {
            if (l.employee_id !== driverId) return false;

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
    const filteredOrders = orders.filter(o => {
        const matchesStatus = statusFilter === 'All' ? !['Delivered', 'Cancelled'].includes(o.status) : o.status === statusFilter;
        const matchesSearch = tripMatchesSearch(o, searchTerm, getDriverName(o.driverId));
        const matchesDeliveryDate = orderMatchesDeliveryDateFilter(
            o,
            deliveryDateFilter,
            deliveryMonthPick || undefined
        );

        const originLoc = o.trip_origin || 'TAIPING';
        const matchesLocation = originLoc.toUpperCase() === activeLocation.toUpperCase();

        return matchesStatus && matchesSearch && matchesDeliveryDate && matchesLocation;
    });

    const activeDriversForLanes = React.useMemo(() => {
        // 1. Base drivers for the current active location
        const baseDrivers = drivers.filter(
            d => (d.base_location || 'Taiping').toLowerCase() === activeLocation.toLowerCase()
        );

        // 2. Identify all driver IDs assigned to currently filtered orders
        const assignedDriverIds = new Set(
            filteredOrders
                .map(o => o.driverId)
                .filter((id): id is string => Boolean(id))
        );

        // 3. Find any drivers from other locations who are assigned to filtered orders
        const additionalDrivers = drivers.filter(
            d => assignedDriverIds.has(d.uid) && 
                 (d.base_location || 'Taiping').toLowerCase() !== activeLocation.toLowerCase()
        );

        // 4. Handle any driver IDs assigned but not present in the driver list (unregistered/missing role)
        const knownDriverIds = new Set(drivers.map(d => d.uid));
        const unknownDriverIds = Array.from(assignedDriverIds).filter(id => !knownDriverIds.has(id));
        const unknownDrivers: User[] = unknownDriverIds.map(id => ({
            uid: id,
            name: `Driver (ID: ${id.substring(0, 6)})`,
            email: '',
            role: 'Driver',
            base_location: activeLocation
        } as any));

        return [...baseDrivers, ...additionalDrivers, ...unknownDrivers];
    }, [drivers, filteredOrders, activeLocation]);

    const hasActiveListFilters =
        Boolean(searchTerm.trim()) ||
        deliveryDateFilter !== 'all' ||
        Boolean(deliveryMonthPick) ||
        statusFilter !== 'All';

    const selectDeliveryDateChip = (id: DeliveryDateFilter) => {
        setDeliveryMonthPick('');
        setDeliveryDateFilter(id);
    };

    const handleSort = (key: string) => {
        let dir: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.dir === 'asc') dir = 'desc';
        setSortConfig({ key, dir });
    };

    const sortedOrders = React.useMemo(() => {
        let sortable = [...filteredOrders];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                let aVal: any; let bVal: any;
                if (sortConfig.key === 'driver') {
                    aVal = drivers.find(d => d.uid === a.driverId)?.name || ''; bVal = drivers.find(d => d.uid === b.driverId)?.name || '';
                } else if (sortConfig.key === 'orderNumber') {
                    aVal = a.orderNumber || ''; bVal = b.orderNumber || '';
                } else if (sortConfig.key === 'destinations') {
                    aVal = a.deliveryAddress || ''; bVal = b.deliveryAddress || '';
                } else if (sortConfig.key === 'dates') {
                    aVal = new Date(a.deadline || a.orderDate || '').getTime(); bVal = new Date(b.deadline || b.orderDate || '').getTime();
                } else if (sortConfig.key === 'status') {
                    aVal = a.status || ''; bVal = b.status || '';
                } else if (sortConfig.key === 'items') {
                    aVal = (a.items || []).length; bVal = (b.items || []).length;
                }
                if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredOrders, sortConfig, drivers]);

    // Stock Visibility: SKU -> Location -> StockQty
    const [stockMap, setStockMap] = useState<Record<string, Record<string, number>>>({});
    useEffect(() => {
        const fetchStock = async () => {
            const { data } = await supabase.from('v2_inventory_view').select('sku, loc_id, current_stock');
            if (data) {
                const map: Record<string, Record<string, number>> = {};
                data.forEach((item: any) => {
                    const sku = item.sku;
                    const loc = normalizeLoc(item.loc_id || 'Unknown');
                    const stock = Number(item.current_stock) || 0;
                    if (!map[sku]) map[sku] = {};
                    map[sku][loc] = (map[sku][loc] || 0) + stock;
                });
                setStockMap(map);
            }
        };
        if (isCreateModalOpen) fetchStock();
    }, [isCreateModalOpen]);

    const getStockForSkuAndLoc = (sku: string, loc: string): number => {
        let lookupLoc = loc;
        const STOCK_FALLBACK: Record<string, string> = {
            'OPM Corner': 'SPD',
            'OPM Lama': 'SPD',
            'OPM Ali': 'SPD',
        };
        const hasLocStock = Object.values(stockMap).some(skuStocks => lookupLoc in skuStocks);
        if (!hasLocStock && STOCK_FALLBACK[lookupLoc]) {
            lookupLoc = STOCK_FALLBACK[lookupLoc];
        }
        return stockMap[sku]?.[lookupLoc] || 0;
    };

    useEffect(() => {
        if (isCreateModalOpen) {
            window.dispatchEvent(new CustomEvent('packsecure:overlay-open'));
        }
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
        if (!window.confirm(`Approve changes for Order ${order.orderNumber}? \nThis will adjust stock for amendments and mark as Delivered.`)) return;

        try {
            // 1. Let V6 DB Trigger handle the stock deduction/adjustment automatically.


            // 2. Update Status
            const { error } = await supabase.from('sales_orders').update({
                status: 'Delivered',
                pod_timestamp: new Date().toISOString()
            }).eq('id', order.id);

            if (error) throw error;

            alert("✅ Approved & Stock Adjusted!");

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

    const matchV2ItemByName = (product?: string): V2Item | null => {
        const p = (product || '').trim().toLowerCase();
        if (!p) return null;

        const exact = v2Items.find(i => i.name.toLowerCase() === p);
        if (exact) return exact;

        const terms = p.split(/[\s-]+/).filter(Boolean);
        const tokenMatch = v2Items.find(i => {
            const n = i.name.toLowerCase();
            return terms.every(term => n.includes(term));
        });
        if (tokenMatch) return tokenMatch;

        return v2Items.find(i => i.name.toLowerCase().includes(p) || p.includes(i.name.toLowerCase())) || null;
    };

    const matchV2ItemBySku = (sku?: string): V2Item | null => {
        const s = (sku || '').trim().toLowerCase();
        if (!s) return null;

        const exact = v2Items.find(i => i.sku.toLowerCase() === s);
        if (exact) return exact;

        return v2Items.find(i => i.sku.toLowerCase().includes(s) || s.includes(i.sku.toLowerCase())) || null;
    };

    const matchV2ItemFromScan = (sku?: string, product?: string): V2Item | null => {
        return matchV2ItemByName(product) || matchV2ItemByName(sku) || matchV2ItemBySku(sku);
    };

    // const mergeTripLineItems = (existing: SalesOrder['items'], incoming: SalesOrder['items']) => {
    //     const merged = [...existing];
    //     for (const item of incoming) {
    //         const idx = merged.findIndex(
    //             m => m.sku === item.sku && (m.sourceLocation || '') === (item.sourceLocation || '')
    //         );
    //         if (idx >= 0) {
    //             merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + item.quantity };
    //         } else {
    //             merged.push(item);
    //         }
    //     }
    //     return merged;
    // };

    const mapVisionRowsToItems = (rawItems: unknown[], defaultLoc: string): SalesOrder['items'] => {
        if (!Array.isArray(rawItems)) return [];
        const parsed: SalesOrder['items'] = [];
        for (const row of rawItems) {
            if (!row || typeof row !== 'object') continue;
            const r = row as Record<string, unknown>;
            const qty = Number(r.quantity) || 1;
            const v2 = matchV2ItemFromScan(
                r.sku != null ? String(r.sku) : undefined,
                r.product != null ? String(r.product) : undefined
            );
            parsed.push({
                product: v2?.name || String(r.product || r.sku || 'Unknown'),
                sku: v2?.sku || String(r.sku || 'UNKNOWN'),
                quantity: qty,
                remark: r.remark ? String(r.remark) : '',
                sourceLocation: r.sourceLocation ? String(r.sourceLocation) : defaultLoc,
                packaging: (v2?.uom || 'Unit') as SalesOrder['items'][0]['packaging'],
            });
        }
        return parsed;
    };

    const resolveDriverIdByName = (name?: string): string => {
        if (!name?.trim()) return selectedDriverId;
        const n = name.trim().toLowerCase();
        const matched = drivers.find(d =>
            (d.name || '').toLowerCase() === n ||
            (d.name || '').toLowerCase().includes(n) ||
            n.includes((d.name || '').toLowerCase())
        );
        return matched?.uid || selectedDriverId;
    };

    const visionErrorMessage = (response: Response, body: { error?: string }): string => {
        if (response.status === 413) return 'Image too large. Try a closer photo or retake.';
        if (response.status === 500 && body.error === 'Server AI Key not configured') {
            return 'AI not configured on server. Contact admin.';
        }
        return body.error || `Scan failed (${response.status})`;
    };

    const handleTripPhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setIsTripPhotoScanning(true);
        setToast(null);
        try {
            const dataUrl = await compressImage(file, 1200, 0.72);
            const { base64, mimeType } = dataUrlToBase64Payload(dataUrl);

            const response = await fetch('/api/agent/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: base64,
                    mimeType,
                    type: 'trip',
                    productsList: v2Items.map(i => ({ sku: i.sku, name: i.name })),
                    driversList: drivers.map(d => ({ uid: d.uid, name: d.name || d.email || '' })),
                }),
            });

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({} as { error?: string }));
                throw new Error(visionErrorMessage(response, errBody));
            }

            const data = (await response.json()) as Record<string, unknown>;
            const defaultLoc = tripOrigin === 'NILAI' ? 'Nilai' : 'SPD';
            const rawTrips = Array.isArray(data.trips) ? data.trips : [];

            const findDriverIdByName = (name?: string): string => {
                if (!name?.trim()) return '';
                const n = name.trim().toLowerCase();
                const matched = drivers.find(d =>
                    (d.name || '').toLowerCase() === n ||
                    (d.name || '').toLowerCase().includes(n) ||
                    n.includes((d.name || '').toLowerCase())
                );
                return matched?.uid || '';
            };

            const trips: ScannedTripDraft[] = rawTrips.map((t, i) => {
                const trip = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
                const extDriver = trip.driverName ? String(trip.driverName) : undefined;
                const tripLabel = String(trip.label || `Trip ${i + 1}`);

                let matchedDriverId = findDriverIdByName(extDriver);
                if (!matchedDriverId) {
                    matchedDriverId = findDriverIdByName(tripLabel);
                }

                return {
                    label: tripLabel,
                    destinations: String(trip.destinations || ''),
                    tripCategory: String(trip.tripCategory || '').toUpperCase(),
                    tripDropCount: typeof trip.tripDropCount === 'number' ? trip.tripDropCount : 1,
                    notes: String(trip.notes || ''),
                    items: mapVisionRowsToItems(
                        Array.isArray(trip.items) ? trip.items : [],
                        defaultLoc
                    ),
                    driverId: matchedDriverId || undefined,
                };
            }).filter(t => t.destinations || t.items.length > 0);

            if (trips.length === 0) {
                throw new Error('No trips detected on this sheet. Try a clearer photo.');
            }

            const tripDate = data.tripDate ? String(data.tripDate).slice(0, 10) : newOrderDate;
            const deliveryDate = data.deliveryDate ? String(data.deliveryDate).slice(0, 10) : newOrderDeliveryDate;

            setScanReview({
                tripDate,
                deliveryDate,
                driverId: resolveDriverIdByName(data.driverName ? String(data.driverName) : undefined),
                sheetNotes: data.notes ? String(data.notes) : '',
                trips,
            });
            setIsScanReviewOpen(true);
            setToast({
                type: 'success',
                message: `Found ${trips.length} trip(s) on sheet. Review and confirm.`,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Photo scan failed';
            console.error(err);
            setToast({ type: 'error', message: msg });
        } finally {
            setIsTripPhotoScanning(false);
        }
    };

    const handleTripExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setIsTripExcelImporting(true);
        setToast(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json(worksheet);

            if (!rawRows || rawRows.length === 0) {
                throw new Error('Excel sheet is empty.');
            }

            const defaultLoc = tripOrigin === 'NILAI' ? 'Nilai' : 'SPD';

            // Helper to match column headers dynamically (case-insensitive, ignores spaces and punctuation)
            const findValue = (row: any, keys: string[]) => {
                for (const key of keys) {
                    const foundKey = Object.keys(row).find(
                        k => k.toLowerCase().replace(/[\s\-_\/]/g, '') === key.toLowerCase().replace(/[\s\-_\/]/g, '')
                    );
                    if (foundKey !== undefined) return row[foundKey];
                }
                return undefined;
            };

            const findDriverIdByName = (name?: string): string => {
                if (!name?.trim()) return '';
                const n = name.trim().toLowerCase();
                const matched = drivers.find(d =>
                    (d.name || '').toLowerCase() === n ||
                    (d.name || '').toLowerCase().includes(n) ||
                    n.includes((d.name || '').toLowerCase())
                );
                return matched?.uid || '';
            };

            // Group rows by trip key
            const groups: Record<string, {
                tripLabel: string;
                driverName: string;
                tripDate: string;
                deliveryDate: string;
                customerName: string;
                destinations: string;
                tripCategory: string;
                tripDropCount: number;
                notes: string;
                items: SalesOrder['items'];
            }> = {};

            // Parse dates: Handle Excel serial dates or standard strings
            const parseExcelDate = (val: any): string => {
                if (!val) return '';
                if (typeof val === 'number') {
                    // Excel serial date number
                    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                    return date.toISOString().slice(0, 10);
                }
                // String date parsing
                const str = String(val).trim();
                if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                    return str.slice(0, 10);
                }
                const parsed = Date.parse(str);
                if (!isNaN(parsed)) {
                    return new Date(parsed).toISOString().slice(0, 10);
                }
                return str;
            };

            for (const row of rawRows) {
                if (!row || typeof row !== 'object') continue;

                // Extract fields
                const rawTripDate = findValue(row, ['tripdate', 'date', 'orderdate', 'triporderdate', '行程日期', '日期']);
                const rawDeliveryDate = findValue(row, ['deliverydate', 'deadline', 'duedate', 'targetdate', '送货日期', '交期', '截止日期']);
                const driverName = String(findValue(row, ['driver', 'drivername', 'assigneddriver', 'staff', 'driverid', '司机', '司机姓名']) || '').trim();
                const tripLabel = String(findValue(row, ['triplabel', 'tripname', 'label', 'trip', 'tripno', 'tripnumber', '行程', '行程标签', '趟次', '趟']) || '').trim();
                const customerName = String(findValue(row, ['customer', 'customername', 'client', 'clientname', 'company', 'companyname', '客户', '客户名称', '公司']) || '').trim();
                const destinations = String(findValue(row, ['destinations', 'destination', 'address', 'deliveryaddress', 'place', 'places', '目的地', '送货地址', '地址']) || '').trim();
                const tripCategory = String(findValue(row, ['tripcategory', 'category', 'zone', 'ratezone', 'destinationzone', '区域', '分类']) || '').trim();
                const tripDropCountVal = findValue(row, ['tripdropcount', 'dropcount', 'drops', 'placescount', 'drop', '落点', '卸货点数', '落点数']);
                const notes = String(findValue(row, ['notes', 'note', 'remark', 'remarks', 'comment', 'comments', 'sheetnotes', '备注']) || '').trim();

                const sku = findValue(row, ['sku', 'productsku', 'itemsku', 'code', 'itemcode', 'productcode', '产品编码', '商品编码', '编码']);
                const product = findValue(row, ['product', 'productname', 'item', 'itemname', 'description', 'name', '产品名称', '商品名称', '品名']);
                const quantity = Number(findValue(row, ['quantity', 'qty', 'amount', 'pcs', 'rolls', 'count', '数量', '件数'])) || 1;
                const itemLoc = findValue(row, ['sourcelocation', 'location', 'factory', 'hub', 'origin', 'warehouse', '发货仓库', '出货仓库', '仓库']);

                // If this row has no items and no destinations, skip it
                if (!sku && !product && !destinations) continue;

                const tripDate = parseExcelDate(rawTripDate) || newOrderDate;
                const deliveryDate = parseExcelDate(rawDeliveryDate) || newOrderDeliveryDate;
                const tripDropCount = Number(tripDropCountVal) || 1;

                // Generate grouping key
                const groupKey = [
                    tripLabel,
                    driverName,
                    tripDate,
                    customerName,
                    destinations
                ].filter(Boolean).join('|') || `trip-${Math.random()}`;

                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        tripLabel,
                        driverName,
                        tripDate,
                        deliveryDate,
                        customerName,
                        destinations,
                        tripCategory,
                        tripDropCount,
                        notes,
                        items: []
                    };
                }

                // If there's an item in this row, parse and add it
                if (sku || product) {
                    const v2 = matchV2ItemFromScan(
                        sku != null ? String(sku) : undefined,
                        product != null ? String(product) : undefined
                    );

                    groups[groupKey].items.push({
                        product: v2?.name || String(product || sku || 'Unknown'),
                        sku: v2?.sku || String(sku || 'UNKNOWN'),
                        quantity,
                        remark: notes,
                        sourceLocation: itemLoc ? String(itemLoc) : defaultLoc,
                        packaging: (v2?.uom || 'Unit') as SalesOrder['items'][0]['packaging'],
                    });
                }
            }

            // Map groups to ScannedTripDraft[]
            const trips: ScannedTripDraft[] = Object.values(groups).map((g, i) => {
                const matchedDriverId = findDriverIdByName(g.driverName);
                return {
                    label: g.tripLabel || `Trip ${i + 1}`,
                    destinations: g.destinations,
                    tripCategory: g.tripCategory.toUpperCase(),
                    tripDropCount: g.tripDropCount,
                    notes: g.notes,
                    items: g.items,
                    driverId: matchedDriverId || undefined,
                    customer: g.customerName || undefined,
                };
            }).filter(t => t.destinations || t.items.length > 0);

            if (trips.length === 0) {
                throw new Error('No valid trips or items could be parsed from the Excel file.');
            }

            const firstG = Object.values(groups)[0];
            const overallTripDate = firstG?.tripDate || newOrderDate;
            const overallDeliveryDate = firstG?.deliveryDate || newOrderDeliveryDate;
            const overallDriverId = findDriverIdByName(firstG?.driverName) || selectedDriverId;

            setScanReview({
                tripDate: overallTripDate,
                deliveryDate: overallDeliveryDate,
                driverId: overallDriverId,
                sheetNotes: 'Excel Import',
                trips,
            });

            setIsScanReviewOpen(true);
            setToast({
                type: 'success',
                message: `Imported ${trips.length} trip(s) from Excel. Review and confirm.`,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Excel import failed';
            console.error(err);
            setToast({ type: 'error', message: msg });
        } finally {
            setIsTripExcelImporting(false);
        }
    };

    const handleDownloadTemplate = () => {
        // Headers with translations/descriptions to guide users
        const headers = [
            ['Trip Date / 行程日期', 'Delivery Date / 送货日期', 'Driver Name / 司机姓名', 'Trip Label / 行程标签', 'Customer Name / 客户名称', 'Destinations / 送货目的地', 'Trip Category / 区域分类', 'Trip Drop Count / 卸货点数', 'Notes / 行程备注', 'SKU / 产品编码', 'Product Name / 产品名称', 'Quantity / 数量', 'Source Location / 发货仓库']
        ];
        
        // Sample data row to guide users
        const sampleData = [
            ['2026-06-03', '2026-06-04', 'Kha', 'Trip A', 'General Customer', 'Kuala Lumpur', 'KL', '1', 'Example trip note', 'SKU-001', 'Sample roll product', '10', 'SPD']
        ];
        
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Trip Template');
        XLSX.writeFile(wb, 'Trip_Import_Template.xlsx');
    };

    const closeScanReview = () => {
        setIsScanReviewOpen(false);
        setScanReview(null);
    };

    const removeScannedTrip = (index: number) => {
        setScanReview(prev => {
            if (!prev) return prev;
            const trips = prev.trips.filter((_, i) => i !== index);
            if (trips.length === 0) {
                closeScanReview();
                return null;
            }
            return { ...prev, trips };
        });
    };

    const applyFirstScannedTripToForm = () => {
        if (!scanReview || scanReview.trips.length === 0) return;
        const t = scanReview.trips[0];
        setNewOrderDate(scanReview.tripDate);
        setNewOrderDeliveryDate(scanReview.deliveryDate);
        if (t.customer) {
            setOrderCustomer(t.customer);
        }
        if (t.driverId) {
            setSelectedDriverId(t.driverId);
        } else if (scanReview.driverId) {
            setSelectedDriverId(scanReview.driverId);
        }
        setNewOrderAddress(t.destinations);
        setTripCategory(t.tripCategory);
        setTripDropCount(t.tripDropCount);
        const notes = [scanReview.sheetNotes, t.notes].filter(Boolean).join(' | ');
        setNewOrderNotes(notes);
        const defaultLoc = tripOrigin === 'NILAI' ? 'Nilai' : 'SPD';
        const itemsWithLoc = (t.items || []).map(item => ({
            ...item,
            sourceLocation: item.sourceLocation || defaultLoc
        }));
        setNewOrderItems(itemsWithLoc);
        closeScanReview();
        setToast({ type: 'success', message: 'First trip loaded into form.' });
    };

    const generateDoNumber = async (driverId: string, orderDate: string): Promise<string> => {
        const dateObj = new Date(orderDate || new Date().toISOString().split('T')[0]);
        const yy = String(dateObj.getFullYear()).slice(-2);
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateCode = `${yy}${mm}${dd}`;
        const selectedDriverName = drivers.find(d => d.uid === driverId)?.name || 'HQ';
        const driverPrefix = selectedDriverName.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
        const prefix = `DO-${driverPrefix}-${dateCode}`;

        const { data: latestOrder } = await supabase
            .from('sales_orders')
            .select('order_number')
            .like('order_number', `${prefix}-%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextSeq = 1;
        if (latestOrder?.order_number) {
            const parts = latestOrder.order_number.split('-');
            const parsed = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(parsed)) nextSeq = parsed + 1;
        }
        return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
    };

    const insertNewTripFromDraft = async (draft: {
        destinations: string;
        tripCategory: string;
        tripDropCount: number;
        notes: string;
        items: SalesOrder['items'];
        orderDate: string;
        deliveryDate: string;
        driverId: string;
        customer?: string;
    }) => {
        const finalCustomer = draft.customer?.trim() || orderCustomer.trim() || 'General Customer';
        const doNumber = await generateDoNumber(draft.driverId, draft.orderDate);
        const zone = draft.tripCategory || '';
        const bestFactory = findBestFactory(zone, draft.items, stockMap);

        let finalFactoryId = bestFactory.id;
        if (draft.items && draft.items.length > 0) {
            const explicitLoc = draft.items.find(item => item.sourceLocation)?.sourceLocation;
            if (explicitLoc) {
                finalFactoryId = explicitLoc;
            }
        }

        if (draft.tripCategory) {
            const categoryExists = deliveryRates.some(
                r => getSafeOrigin(r.origin) === getSafeOrigin(tripOrigin) && r.location_name === draft.tripCategory
            );
            if (!categoryExists) {
                try {
                    await supabase.from('delivery_rates').insert({
                        origin: tripOrigin,
                        location_name: draft.tripCategory,
                        base_rate: 0,
                        max_places: 1,
                        extra_rate_per_place: 0,
                        notes: 'Auto-imported from Trip photo scan.',
                    });
                } catch (e) {
                    console.error('Failed to auto-push category', e);
                }
            }
        }

        const payload: Record<string, unknown> = {
            order_number: doNumber,
            customer: finalCustomer,
            delivery_address: draft.destinations,
            zone: draft.tripCategory,
            trip_origin: tripOrigin,
            trip_drop_count: draft.tripDropCount,
            factory_id: finalFactoryId,
            driver_id: draft.driverId || null,
            items: draft.items,
            order_date: draft.orderDate,
            deadline: draft.deliveryDate || null,
            notes: draft.notes,
            status: 'New',
        };

        const effectiveDate = draft.deliveryDate || draft.orderDate;
        if (draft.driverId && effectiveDate) {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.driverId);
            if (!isUUID) {
                throw new Error('Select a valid driver from the list before creating trips.');
            }
            const ok = checkDriverAvailability(draft.driverId, effectiveDate);
            if (!ok) throw new Error('Driver availability check cancelled.');
        }

        const { error } = await supabase.from('sales_orders').insert(payload);
        if (error) throw error;
    };

    const handleBatchCreateFromScan = async () => {
        if (!scanReview || scanReview.trips.length === 0) return;
        const empty = scanReview.trips.find(t => t.items.length === 0);
        if (empty) {
            alert(`"${empty.label}" has no items. Remove it or add items manually after create.`);
            return;
        }

        setIsBatchCreating(true);
        setToast(null);
        try {
            let created = 0;
            for (const t of scanReview.trips) {
                const notes = [scanReview.sheetNotes, t.notes].filter(Boolean).join(' | ');
                await insertNewTripFromDraft({
                    destinations: t.destinations,
                    tripCategory: t.tripCategory,
                    tripDropCount: t.tripDropCount,
                    notes,
                    items: t.items,
                    orderDate: scanReview.tripDate,
                    deliveryDate: scanReview.deliveryDate,
                    driverId: t.driverId || scanReview.driverId,
                    customer: t.customer,
                });
                created++;
            }
            closeScanReview();
            handleCloseModal();
            await fetchData();
            setToast({
                type: 'success',
                message: `Created ${created} trip(s) from photo.`,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Batch create failed';
            setToast({ type: 'error', message: msg });
        } finally {
            setIsBatchCreating(false);
        }
    };

    // --- DISPATCH PLANNER HANDLERS ---
    const handleBatchAssign = async (driverId: string) => {
        if (selectedOrderIds.length === 0) return;
        if (!driverId) return;

        // Check availability
        for (const orderId of selectedOrderIds) {
            const order = orders.find(o => o.id === orderId);
            if (order && !checkDriverAvailability(driverId, order.deadline)) {
                return;
            }
        }

        try {
            // Optimistic Update
            setOrders(prev => prev.map(o => {
                if (selectedOrderIds.includes(o.id)) {
                    return { ...o, driverId: driverId, tripSequence: 999 };
                }
                return o;
            }));

            // Clear selection
            setSelectedOrderIds([]);

            // Server Update
            const updates = selectedOrderIds.map(orderId =>
                supabase.from('sales_orders').update({ driver_id: driverId, trip_sequence: 999 }).eq('id', orderId)
            );
            await Promise.all(updates);
            await fetchData();
            setToast({ type: 'success', message: '批量指派成功 (Batch assign success)' });
        } catch (err) {
            console.error("Failed to batch assign:", err);
            setToast({ type: 'error', message: '批量指派失败 (Batch assign failed)' });
            fetchData();
        }
    };

    const handleMoveOrderSequence = async (orderId: string, direction: 'up' | 'down') => {
        const orderToMove = orders.find(o => o.id === orderId);
        if (!orderToMove || !orderToMove.driverId) return;

        const driverId = orderToMove.driverId;
        const driverOrders = filteredOrders
            .filter(o => o.driverId === driverId)
            .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));

        const idx = driverOrders.findIndex(o => o.id === orderId);
        if (idx === -1) return;

        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === driverOrders.length - 1) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const temp = driverOrders[idx];
        driverOrders[idx] = driverOrders[swapIdx];
        driverOrders[swapIdx] = temp;

        const sequenceMap = new Map<string, number>();
        driverOrders.forEach((o, index) => {
            sequenceMap.set(o.id, index + 1);
        });

        setOrders(prev => prev.map(o => {
            if (sequenceMap.has(o.id)) {
                return { ...o, tripSequence: sequenceMap.get(o.id) };
            }
            return o;
        }));

        try {
            const updates = driverOrders.map((o, index) =>
                supabase.from('sales_orders').update({ trip_sequence: index + 1 }).eq('id', o.id)
            );
            await Promise.all(updates);
            await fetchData();
        } catch (err) {
            console.error("Resequence failed:", err);
            fetchData();
        }
    };

    const handleUnassignOrder = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const driverId = order.driverId;

        try {
            setOrders(prev => prev.map(o => {
                if (o.id === orderId) {
                    return { ...o, driverId: undefined, tripSequence: undefined };
                }
                return o;
            }));

            const { error } = await supabase.from('sales_orders').update({ driver_id: null, trip_sequence: null }).eq('id', orderId);
            if (error) throw error;

            if (driverId) {
                const remainingOrders = filteredOrders
                    .filter(o => o.driverId === driverId && o.id !== orderId)
                    .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));

                const updates = remainingOrders.map((o, index) =>
                    supabase.from('sales_orders').update({ trip_sequence: index + 1 }).eq('id', o.id)
                );
                await Promise.all(updates);
            }

            await fetchData();
            setToast({ type: 'success', message: '已取消分配 (Order unassigned)' });
        } catch (err) {
            console.error("Unassign failed:", err);
            setToast({ type: 'error', message: '取消分配失败 (Unassign failed)' });
            fetchData();
        }
    };

    const handleTriggerAutoDispatch = () => {
        const unassigned = filteredOrders.filter(o => !o.driverId && (o.trip_origin || 'TAIPING').toUpperCase() === activeLocation.toUpperCase());
        const activeDrivers = drivers.filter(d => (d.base_location || 'Taiping').toLowerCase() === activeLocation.toLowerCase());

        if (unassigned.length === 0) {
            alert("没有未分配的订单可以进行智能排单。(No unassigned orders for auto-dispatch.)");
            return;
        }
        if (activeDrivers.length === 0) {
            alert("当前仓库没有可用的司机。(No available drivers for active warehouse.)");
            return;
        }

        const drafts = generateDraftTripsWithDrivers(unassigned, activeDrivers);
        setAutoDispatchDrafts(drafts);
        setIsAutoDispatchModalOpen(true);
    };

    const handleUpdateDraftTripDriver = (tripId: string, driverId: string) => {
        if (!autoDispatchDrafts) return;
        const driver = drivers.find(d => d.uid === driverId);
        setAutoDispatchDrafts(prev => {
            if (!prev) return null;
            return prev.map(t => {
                if (t.id === tripId) {
                    return {
                        ...t,
                        recommendedDriverId: driverId || null,
                        recommendedDriverName: driver?.name || '未指派'
                    };
                }
                return t;
            });
        });
    };

    const handleApplyAutoDispatch = async () => {
        if (!autoDispatchDrafts) return;
        setIsSubmitting(true);
        try {
            const updates: any[] = [];

            autoDispatchDrafts.forEach(trip => {
                const driverId = trip.recommendedDriverId;
                if (!driverId) return;

                trip.orders.forEach((order, index) => {
                    updates.push(
                        supabase.from('sales_orders')
                            .update({
                                driver_id: driverId,
                                trip_sequence: index + 1
                            })
                            .eq('id', order.id)
                    );
                });
            });

            await Promise.all(updates);
            setIsAutoDispatchModalOpen(false);
            setAutoDispatchDrafts(null);
            alert("智能排单方案已成功应用！(Auto dispatch applied successfully!)");
            await fetchData();
        } catch (err) {
            console.error("Failed to apply auto dispatch:", err);
            alert("应用排单方案失败。(Failed to apply auto dispatch.)");
        } finally {
            setIsSubmitting(false);
        }
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
        const hasContent = newOrderItems.length > 0 || newOrderNotes.trim() !== '' || newOrderAddress.trim() !== '' || selectedDriverId;
        if (!hasContent) {
            return alert("Cannot create an empty trip. Please add items, a driver, destinations, or notes.");
        }

        // Remind if Customer or Destinations is not filled
        const isCustomerMissing = !orderCustomer.trim() || orderCustomer.trim() === 'General Customer';
        const isAddressMissing = !newOrderAddress.trim();

        if (isCustomerMissing || isAddressMissing) {
            const missingFields = [];
            if (isCustomerMissing) missingFields.push("Customer / Client (客户名称)");
            if (isAddressMissing) missingFields.push("Destinations (目的地/送货地址)");
            
            const warningMsg = `⚠️ Reminder: You have not filled in the following fields:\n- ${missingFields.join('\n- ')}\n\nDo you want to continue creating this trip anyway?\n(提醒：您尚未填写上述字段，是否仍要继续创建此行程？)`;
            if (!window.confirm(warningMsg)) {
                return; // Cancel submission
            }
        }

        // Force assign default location if somehow blank
        const defaultLoc = tripOrigin === 'NILAI' ? 'Nilai' : 'SPD';
        const finalizedItems = newOrderItems.map(item => ({
            ...item,
            sourceLocation: (item.sourceLocation && item.sourceLocation.trim() !== '') ? item.sourceLocation.trim() : defaultLoc
        }));

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
                // Generate sequential DO Number: DO-{DriverName}-{YYMMDD}-{Seq}
                const dateObj = new Date(newOrderDate || new Date().toISOString().split("T")[0]);
                const yy = String(dateObj.getFullYear()).slice(-2);
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const dateCode = `${yy}${mm}${dd}`;

                const selectedDriverName = drivers.find(d => d.uid === selectedDriverId)?.name || 'HQ';
                const driverPrefix = selectedDriverName.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');

                const prefix = `DO-${driverPrefix}-${dateCode}`;

                const { data: latestOrder } = await supabase
                    .from('sales_orders')
                    .select('order_number')
                    .like('order_number', `${prefix}-%`)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let nextSeq = 1;
                if (latestOrder && latestOrder.order_number) {
                    const parts = latestOrder.order_number.split('-');
                    const lastPart = parts[parts.length - 1];
                    const parsed = parseInt(lastPart, 10);
                    if (!isNaN(parsed)) {
                        nextSeq = parsed + 1;
                    }
                }
                const seq = String(nextSeq).padStart(3, '0');
                doNumber = `${prefix}-${seq}`;
            }

            const zone = tripCategory || '';
            const bestFactory = findBestFactory(zone, finalizedItems, stockMap);

            let finalFactoryId = bestFactory.id;
            let finalFactoryName = bestFactory.name;
            if (finalizedItems.length > 0) {
                const explicitLoc = finalizedItems.find(item => item.sourceLocation)?.sourceLocation;
                if (explicitLoc) {
                    finalFactoryId = explicitLoc;
                    finalFactoryName = explicitLoc;
                }
            }

            // Auto-Push Unlisted Trip Category to HR Payroll Rates
            if (tripCategory) {
                const categoryExists = deliveryRates.some(r => getSafeOrigin(r.origin) === getSafeOrigin(tripOrigin) && r.location_name === tripCategory);
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
                zone: tripCategory || '',
                trip_origin: tripOrigin,
                trip_drop_count: tripDropCount,
                factory_id: finalFactoryId,
                driver_id: selectedDriverId || null,
                items: finalizedItems,
                order_date: newOrderDate || new Date().toISOString().split("T")[0],
                deadline: newOrderDeliveryDate || null,
                notes: newOrderNotes // Include Batch Notes
            };

            // Only set status for NEW orders. Editing should not overwrite background status changes.
            if (!editingOrderId) {
                payload.status = 'New';
            }

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
                alert(`Order Updated!\nAssigned to ${finalFactoryName}`);

                // Optimistic Update: Edit
                newOrderObj = { ...orders.find(o => o.id === editingOrderId)!, ...payload, id: editingOrderId, orderNumber: doNumber };
                setOrders(prev => prev.map(o => o.id === editingOrderId ? newOrderObj! : o));

            } else {
                const { data, error } = await supabase.from('sales_orders').insert(payload).select().single();
                if (error) throw error;

                // Auto-save NEW customer if it doesn't exist (excluding "General Customer")
                const cleanCust = orderCustomer.trim();
                if (cleanCust && cleanCust.toLowerCase() !== 'general customer') {
                    const existing = customerDB.find(c => c.name.toLowerCase() === cleanCust.toLowerCase());
                    if (!existing && newOrderAddress) {
                        supabase.from('sys_customers').insert({
                            name: cleanCust, address: newOrderAddress, zone: tripCategory || ''
                        }).then(() => {
                            supabase.from('sys_customers').select('*').then(res => res.data && setCustomerDB(res.data));
                        });
                    }
                }
                // alert(`Order Created!\nAssigned to ${finalFactoryName} (Zone: ${zone})`);

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
        closeScanReview();
        setEditingOrderId(null); setNewOrderDate(getTodayStr());
        setSelectedDriverId('');
        setOrderCustomer('');
        setNewOrderAddress('');
        setNewOrderDeliveryDate(getTomorrowStr());
        setNewOrderItems([]);
        setNewOrderNotes(''); // Reset Notes
        setTripOrigin(activeLocation.toUpperCase());
        setCurrentItemLoc(activeLocation.toUpperCase() === 'NILAI' ? 'Nilai' : 'SPD');
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

    // Render Helpers
    // Render Helpers
    const getLocalDateStr = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const todayStr = getLocalDateStr(new Date());
    const within30Days = new Date();
    within30Days.setDate(within30Days.getDate() + 30);
    const within30DaysStr = getLocalDateStr(within30Days);

    const driversOnLeaveToday = drivers.filter(d =>
        driverLeaves.some(l => l.employee_id === d.uid && l.status === 'Approved' && todayStr >= l.start_date && todayStr <= l.end_date)
    );

    const upcomingLeaves = driverLeaves
        .filter(l => l.status === 'Approved' && l.start_date > todayStr && l.start_date <= within30DaysStr)
        .map(l => ({
            ...l,
            driverName: drivers.find(d => d.uid === l.employee_id)?.name || 'Unknown Driver'
        }))
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    const pendingLeaves = driverLeaves
        .filter(l => l.status === 'Pending')
        .map(l => ({
            ...l,
            driverName: drivers.find(d => d.uid === l.employee_id)?.name || 'Unknown Driver'
        }));

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
                    {pendingLeaves.length > 0 && (
                        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex flex-col gap-3 animate-in slide-in-from-top flex-1">
                            <div className="text-sm font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangle size={16} /> Pending Leave Approvals
                            </div>
                            <div className="space-y-2">
                                {pendingLeaves.map(l => (
                                    <div key={l.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                                        <div>
                                            <div className="text-xs font-bold text-white">{l.driverName}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                                {l.start_date} {l.start_date !== l.end_date ? `➔ ${l.end_date}` : ''} ({l.count_days} Days)
                                            </div>
                                            <div className="text-[9px] text-purple-400 mt-1 uppercase font-bold tracking-widest break-all">"{l.reason || 'No Reason provided'}"</div>
                                        </div>
                                        <div className="flex gap-2 shrink-0 ml-4">
                                            <button onClick={() => handleLeaveAction(l.id, 'Rejected')} className="text-red-400 hover:text-red-300 p-1 bg-red-400/10 rounded-lg transition-colors">
                                                <XCircle size={18} />
                                            </button>
                                            <button onClick={() => handleLeaveAction(l.id, 'Approved')} className="text-emerald-400 hover:text-emerald-300 p-1 bg-emerald-400/10 rounded-lg transition-colors">
                                                <CheckCircle size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                                    <div className="text-sm font-black text-amber-400 uppercase tracking-widest leading-none mb-1">Upcoming Holidays (Next 30 Days)</div>
                                    <div className="text-xs font-bold text-amber-500/80">
                                        {upcomingLeaves.map(l => `${l.driverName} (${l.start_date}${l.start_date !== l.end_date ? ' ➔ ' + l.end_date : ''})`).join(', ')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {driversOnLeaveToday.length === 0 && upcomingLeaves.length === 0 && pendingLeaves.length === 0 && (
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3 text-slate-500 h-full">
                            <Calendar size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">No Driver Holidays to review</span>
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
                                        <h3 className="text-blue-400 font-black uppercase tracking-widest text-sm mb-1">Upcoming Lorry Services (Next 30 Days)</h3>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Please arrange schedule accordingly.</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {lorryServices.map(s => {
                                        const driver = drivers.find(d => d.uid === s.driver_id);
                                        const isPending = s.status === 'Pending';
                                        return (
                                            <div key={s.id} className={`bg-slate-950 border px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm group transition-colors ${isPending ? 'border-amber-500/50 hover:border-amber-500' : 'border-blue-500/30 hover:border-blue-500/60'}`}>
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-white font-black font-mono text-xs tracking-wider">{s.plate_number}</span>
                                                    {isPending ? (
                                                        <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest">Needs Schedule</span>
                                                    ) : (
                                                        <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">{s.scheduled_date}</span>
                                                    )}
                                                </div>
                                                {isPending && (
                                                    <input 
                                                        type="date" 
                                                        className="text-[10px] bg-slate-900 text-white border border-slate-700 rounded px-1 py-0.5 outline-none focus:border-amber-500 [color-scheme:dark]"
                                                        onChange={(e) => {
                                                            if(e.target.value) handleScheduleService(s.id, e.target.value);
                                                        }}
                                                    />
                                                )}
                                                {driver && (
                                                    <div className="pl-2 border-l border-slate-800 text-[10px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
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
            </div>            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
                {/* Search Bar & Location Split Toggle */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 flex-1">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Area, date (20/05/2026), or month (2026-05, may)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900/50 backdrop-blur-sm border border-slate-800 text-slate-200 text-sm rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                        />
                    </div>

                    {/* Location Split Toggle */}
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 self-start md:self-center max-w-fit shrink-0">
                        {['Taiping', 'Nilai'].map(loc => (
                            <button
                                key={loc}
                                onClick={() => setActiveLocation(loc)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1
                                    ${activeLocation === loc
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <MapPin size={14} /> {loc}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status Tabs & View Toggle */}
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 justify-between shrink-0 self-start xl:self-center">
                    <div className="flex">
                        {/* Filter Tabs */}
                        {['All', 'Loaded', 'Pending Approval', 'Delivered', 'Cancelled'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                                    ${statusFilter === status
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                            >
                                {status === 'Delivered' ? 'Delivered' : (status === 'Loaded' ? 'Loaded' : (status === 'Pending Approval' ? (
                                    <span className="flex items-center gap-2">
                                        Pending
                                        {orders.filter(o => o.status === 'Pending Approval').length > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full animate-pulse">
                                                {orders.filter(o => o.status === 'Pending Approval').length}
                                            </span>
                                        )}
                                    </span>
                                ) : status === 'All' ? 'Active' : status))}
                            </button>
                        ))}
                    </div>
                    
                    {/* View Mode Toggle */}
                    <div className="flex ml-4 border-l border-slate-700 pl-4 gap-1.5 items-center">
                        <button
                            onClick={() => setViewMode('dispatch')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${viewMode === 'dispatch' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
                            title="Dispatch Planner (智能/手动排单)"
                        >
                            <Truck size={14} /> Dispatch Planner
                        </button>
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
                            title="Kanban Board"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
                            title="Table View"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mr-1">
                    <Calendar size={12} className="text-blue-400/80" />
                    Delivery date
                </span>
                {(
                    [
                        { id: 'all' as const, label: 'All' },
                        { id: 'today' as const, label: 'Today' },
                        { id: 'tomorrow' as const, label: 'Tomorrow' },
                        { id: 'week' as const, label: 'This week' },
                        { id: 'month' as const, label: 'This month' },
                        { id: 'no_date' as const, label: 'No date' },
                    ] as const
                ).map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => selectDeliveryDateChip(id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all
                            ${!deliveryMonthPick && deliveryDateFilter === id
                                ? 'bg-blue-600/30 border-blue-500/50 text-blue-200'
                                : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                            }`}
                    >
                        {label}
                    </button>
                ))}
                <label className="flex items-center gap-2 ml-1 sm:ml-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Month</span>
                    <input
                        type="month"
                        value={deliveryMonthPick}
                        onChange={e => {
                            const v = e.target.value;
                            setDeliveryMonthPick(v);
                            if (v) setDeliveryDateFilter('all');
                        }}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 [color-scheme:dark] outline-none focus:border-blue-500/50"
                    />
                    {deliveryMonthPick && (
                        <button
                            type="button"
                            onClick={() => setDeliveryMonthPick('')}
                            className="text-[10px] font-bold text-slate-500 hover:text-white uppercase"
                        >
                            Clear
                        </button>
                    )}
                </label>
            </div>

            {/* --- MAIN GRID / TABLE --- */}
            {viewMode === 'dispatch' ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start animate-in fade-in duration-300">
                    {/* LEFT PANEL: Unassigned Orders Pool */}
                    <div className="xl:col-span-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 min-h-[600px]">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                            <div>
                                <h2 className="text-base font-bold text-white flex items-center gap-2">
                                    <Box size={18} className="text-blue-500" />
                                    未指派订单池 (Unassigned Pool)
                                </h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">当前仓库未指派的有效订单</p>
                            </div>
                            <span className="bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono px-2.5 py-1 rounded-full font-bold">
                                {filteredOrders.filter(o => !o.driverId).length} 单
                            </span>
                        </div>

                        {/* Batch Action Bar */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row gap-3 items-center justify-between">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    checked={
                                        filteredOrders.filter(o => !o.driverId).length > 0 &&
                                        filteredOrders.filter(o => !o.driverId).every(o => selectedOrderIds.includes(o.id))
                                    }
                                    onChange={(e) => {
                                        const unassigned = filteredOrders.filter(o => !o.driverId);
                                        if (e.target.checked) {
                                            setSelectedOrderIds(prev => Array.from(new Set([...prev, ...unassigned.map(o => o.id)])));
                                        } else {
                                            setSelectedOrderIds(prev => prev.filter(id => !unassigned.some(o => o.id === id)));
                                        }
                                    }}
                                />
                                <span className="text-xs font-bold text-slate-400">全选 (Select All)</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                                <select
                                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500/50 w-full sm:w-36"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleBatchAssign(e.target.value);
                                            e.target.value = '';
                                        }
                                    }}
                                    disabled={selectedOrderIds.length === 0}
                                >
                                    <option value="">-- 批量指派司机 --</option>
                                    {drivers
                                        .filter(d => (d.base_location || 'Taiping').toLowerCase() === activeLocation.toLowerCase())
                                        .map(d => (
                                            <option key={d.uid} value={d.uid}>
                                                {d.name || d.email}
                                            </option>
                                        ))
                                    }
                                </select>

                                <button
                                    onClick={handleTriggerAutoDispatch}
                                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-950/30 transition-all active:scale-95 shrink-0"
                                >
                                    <Sparkles size={13} className="animate-pulse" />
                                    一键智能排单
                                </button>
                            </div>
                        </div>

                        {/* Unassigned List */}
                        <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1 custom-scrollbar">
                            {filteredOrders.filter(o => !o.driverId).length === 0 ? (
                                <div className="text-center py-12 text-slate-600 text-xs italic border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                                    没有未分配的订单
                                </div>
                            ) : (
                                filteredOrders.filter(o => !o.driverId).map(order => {
                                    const isSelected = selectedOrderIds.includes(order.id);
                                    const orderLoad = calculateLoad(order.items || [], { max_volume_m3: 20, max_weight_kg: 3000 });
                                    
                                    return (
                                        <div
                                            key={order.id}
                                            className={`p-4 rounded-xl border transition-all flex gap-3 bg-slate-950/60 hover:bg-slate-900/80 ${
                                                isSelected ? 'border-blue-500/80 bg-blue-950/10 shadow-lg shadow-blue-950/5' : 'border-slate-800/80'
                                            }`}
                                        >
                                            <div className="pt-1 select-none">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedOrderIds(prev => [...prev, order.id]);
                                                        } else {
                                                            setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                            {order.orderNumber}
                                                        </span>
                                                        {order.deliveryAddress && (
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getStateColor(determineState(order.deliveryAddress))}`}>
                                                                {determineState(order.deliveryAddress)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <select
                                                        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-400 outline-none focus:border-blue-500/50"
                                                        value=""
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                setSelectedOrderIds([order.id]);
                                                                handleBatchAssign(e.target.value);
                                                            }
                                                        }}
                                                    >
                                                        <option value="">指派司机...</option>
                                                        {drivers
                                                            .filter(d => (d.base_location || 'Taiping').toLowerCase() === activeLocation.toLowerCase())
                                                            .map(d => (
                                                                <option key={d.uid} value={d.uid}>
                                                                    {d.name}
                                                                </option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>

                                                <div className="text-xs text-white font-bold mb-1 truncate">{order.customer}</div>
                                                <div className="text-[10px] text-slate-500 mb-3 line-clamp-1">{order.deliveryAddress}</div>

                                                <div className="flex gap-3 text-[10px] text-slate-400 font-mono mb-3 bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                                                    <div>体积: <span className="text-slate-200 font-bold">{orderLoad.totalVol} m³</span></div>
                                                    <div className="border-l border-slate-800 pl-3">重量: <span className="text-slate-200 font-bold">{orderLoad.totalWeight} kg</span></div>
                                                </div>

                                                <div className="space-y-1">
                                                    {order.items?.map((item, i) => (
                                                        <div key={i} className="text-[10px] flex justify-between text-slate-400">
                                                            <span className="truncate max-w-[150px]">{item.product}</span>
                                                            <span className="font-bold font-mono">x{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Driver Lanes */}
                    <div className="xl:col-span-2 flex gap-4 overflow-x-auto pb-4 custom-scrollbar items-start">
                        {activeDriversForLanes
                            .map(driver => {
                                const driverOrders = filteredOrders
                                    .filter(o => o.driverId === driver.uid)
                                    .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));
                                
                                const allItems = driverOrders.flatMap(o => o.items || []);
                                const lorry = lorries.find(l => l.driverUserId === driver.uid);
                                const loadStats = calculateLoad(allItems, { max_volume_m3: 20, max_weight_kg: 3000 });
                                
                                return (
                                    <div
                                        key={driver.uid}
                                        className="w-[320px] shrink-0 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4"
                                    >
                                        <div className="border-b border-slate-800/80 pb-3 flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-sm text-white">{driver.name}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                                        <Truck size={12} className="text-blue-400" />
                                                        {lorry?.plateNumber || 'No Plate'}
                                                        <span className="text-slate-700">|</span>
                                                        <MapPin size={10} className="text-slate-500" />
                                                        {lorry?.preferredZone || '未指派区域'}
                                                    </div>
                                                </div>
                                                
                                                {loadStats.isOverloaded && (
                                                    <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase px-2 py-0.5 rounded animate-pulse">
                                                        ⚠️ OVERLOADED
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-1.5 mt-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/50">
                                                <div>
                                                    <div className="flex justify-between text-[9px] font-mono mb-0.5">
                                                        <span className="text-slate-400">体积 Vol ({loadStats.totalVol}/20 m³)</span>
                                                        <span className={`font-bold ${Number(loadStats.percentVol) >= 100 ? 'text-red-400 font-black' : Number(loadStats.percentVol) >= 80 ? 'text-amber-400' : 'text-slate-300'}`}>
                                                            {loadStats.percentVol}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                Number(loadStats.percentVol) >= 100 ? 'bg-red-500 shadow-md shadow-red-500/30' : Number(loadStats.percentVol) >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                            }`}
                                                            style={{ width: `${loadStats.percentVol}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <div className="flex justify-between text-[9px] font-mono mb-0.5">
                                                        <span className="text-slate-400">重量 Weight ({loadStats.totalWeight}/3000 kg)</span>
                                                        <span className={`font-bold ${Number(loadStats.percentWeight) >= 100 ? 'text-red-400 font-black' : Number(loadStats.percentWeight) >= 80 ? 'text-amber-400' : 'text-slate-300'}`}>
                                                            {loadStats.percentWeight}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                Number(loadStats.percentWeight) >= 100 ? 'bg-red-500 shadow-md shadow-red-500/30' : Number(loadStats.percentWeight) >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                            }`}
                                                            style={{ width: `${loadStats.percentWeight}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                                            {driverOrders.length === 0 ? (
                                                <div className="h-40 flex flex-col items-center justify-center text-slate-700 opacity-40 border border-dashed border-slate-800 rounded-xl">
                                                    <Truck size={36} className="mb-2" />
                                                    <span className="text-xs font-bold uppercase tracking-wider">暂无排单 (Empty)</span>
                                                </div>
                                            ) : (
                                                driverOrders.map((order, idx) => {
                                                    const orderLoad = calculateLoad(order.items || [], { max_volume_m3: 20, max_weight_kg: 3000 });
                                                    
                                                    return (
                                                        <div
                                                            key={order.id}
                                                            className="bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 p-3.5 rounded-xl flex flex-col gap-2 relative group"
                                                        >
                                                            <div className="absolute top-3 right-3 bg-slate-900 border border-slate-800 text-slate-400 text-[9px] font-bold uppercase py-0.5 px-2 rounded-full shadow-lg">
                                                                第 {idx + 1} 趟
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-[10px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                                    {order.orderNumber}
                                                                </span>
                                                                {order.deliveryAddress && (
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getStateColor(determineState(order.deliveryAddress))}`}>
                                                                        {determineState(order.deliveryAddress)}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="text-xs text-white font-bold leading-tight mt-1 truncate">{order.customer}</div>
                                                            <div className="text-[10px] text-slate-500 line-clamp-1">{order.deliveryAddress}</div>

                                                            <div className="flex gap-2 text-[9px] text-slate-400 font-mono mt-1">
                                                                <div>V: {orderLoad.totalVol} m³</div>
                                                                <div className="text-slate-800">|</div>
                                                                <div>W: {orderLoad.totalWeight} kg</div>
                                                            </div>

                                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-900">
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => handleMoveOrderSequence(order.id, 'up')}
                                                                        disabled={idx === 0}
                                                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                                                        title="上移顺序 (Move Up)"
                                                                    >
                                                                        <ArrowUp size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleMoveOrderSequence(order.id, 'down')}
                                                                        disabled={idx === driverOrders.length - 1}
                                                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                                                        title="下移顺序 (Move Down)"
                                                                    >
                                                                        <ArrowDown size={14} />
                                                                    </button>
                                                                </div>

                                                                <button
                                                                    onClick={() => handleUnassignOrder(order.id)}
                                                                    className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded transition-colors"
                                                                    title="取消分配 (Unassign)"
                                                                >
                                                                    取消指派
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ) : viewMode === 'kanban' ? (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Add Unassigned Pseudo-Driver if not in list */}
                    {[
                        { uid: 'unassigned', name: '📦 Unassigned / New', email: '', role: 'Driver' } as User,
                        ...activeDriversForLanes
                    ].map(driver => {
                        const driverOrders = filteredOrders
                            .filter(o => {
                                if (driver.uid === 'unassigned') {
                                    return !o.driverId && (o.trip_origin || 'TAIPING').toUpperCase() === activeLocation.toUpperCase();
                                }
                                return o.driverId === driver.uid;
                            })
                            .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0)); // Ensure visual order matches logical order for DnD

                        if (driverOrders.length === 0 && hasActiveListFilters && driver.uid !== 'unassigned') return null;
                        // Always show Unassigned column if there are orders, or if we are in default view
                        if (driver.uid === 'unassigned' && driverOrders.length === 0 && hasActiveListFilters) return null;

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
                                                                const orderOrigin = order.trip_origin || 'TAIPING';
                                                                setTripOrigin(orderOrigin);
                                                                setCurrentItemLoc(orderOrigin === 'NILAI' ? 'Nilai' : 'SPD');
                                                                setTripCategory(order.zone || '');
                                                                setTripDropCount(order.trip_drop_count || 1);

                                                                // Extract legacy location from remark if sourceLocation is missing, fallback to default
                                                                const defaultLoc = orderOrigin === 'NILAI' ? 'Nilai' : 'SPD';
                                                                const itemsWithExtractedLoc = (order.items || []).map(item => {
                                                                    let loc = item.sourceLocation;
                                                                    if (!loc && item.remark && item.remark.includes('(Loc:')) {
                                                                        const locMatch = item.remark.match(/\(Loc:\s*(.*?)\)/);
                                                                        if (locMatch && locMatch[1]) {
                                                                            loc = locMatch[1];
                                                                        }
                                                                    }
                                                                    return { ...item, sourceLocation: loc || defaultLoc };
                                                                });
                                                                setNewOrderItems(itemsWithExtractedLoc);
                                                                setEditingOrderPhoto(order.proof_of_load_url || null);

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
                                                                <div className="flex flex-col items-end gap-1.5">
                                                                    <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border ${order.status === 'New' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                                                                        order.status === 'Delivered' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                                                                            order.status === 'Pending Approval' ? 'text-red-400 border-red-500/20 bg-red-500/10 animate-pulse' :
                                                                                'text-slate-400 border-slate-700 bg-slate-800'
                                                                        }`}>
                                                                        {order.status}
                                                                    </div>
                                                                    {(order.pod_photo_url || order.pod_signature_url || (order.notes && order.notes.includes(']'))) && (
                                                                        <div className="flex flex-wrap items-center justify-end gap-1 max-w-[120px]">
                                                                            {order.pod_photo_url && (
                                                                                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5" title="Has delivery photo">
                                                                                    📸 POD
                                                                                </span>
                                                                            )}
                                                                            {order.pod_signature_url && (
                                                                                <span className="text-[8px] bg-teal-500/20 text-teal-400 border border-teal-500/30 px-1 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5" title="Has customer signature">
                                                                                    ✍️ SIGN
                                                                                </span>
                                                                            )}
                                                                            {order.notes && order.notes.includes(']') && (
                                                                                <span className="text-[8px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5" title="Has driver notes">
                                                                                    💬 NOTE
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
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

                                                            {/* Approve driver quantity amendments */}
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
            ) : (
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-slate-900 text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800">
                                    <th className="p-4 font-bold cursor-pointer hover:text-white" onClick={() => handleSort('driver')}>
                                        <div className="flex items-center gap-1">Driver / Sequence {sortConfig?.key === 'driver' && (sortConfig.dir === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    <th className="p-4 font-bold cursor-pointer hover:text-white" onClick={() => handleSort('orderNumber')}>
                                        <div className="flex items-center gap-1">Order No {sortConfig?.key === 'orderNumber' && (sortConfig.dir === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    <th className="p-4 font-bold cursor-pointer hover:text-white" onClick={() => handleSort('destinations')}>
                                        <div className="flex items-center gap-1">Destinations {sortConfig?.key === 'destinations' && (sortConfig.dir === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    <th className="p-4 font-bold cursor-pointer hover:text-white" onClick={() => handleSort('dates')}>
                                        <div className="flex items-center gap-1">Dates {sortConfig?.key === 'dates' && (sortConfig.dir === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    <th className="p-4 font-bold cursor-pointer hover:text-white" onClick={() => handleSort('status')}>
                                        <div className="flex items-center gap-1">Status {sortConfig?.key === 'status' && (sortConfig.dir === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    <th className="p-4 font-bold text-center cursor-pointer hover:text-white" onClick={() => handleSort('items')}>
                                        <div className="flex items-center justify-center gap-1">Items {sortConfig?.key === 'items' && (sortConfig.dir === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    <th className="p-4 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {sortedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-500 italic">No trips found matching criteria.</td>
                                    </tr>
                                ) : (
                                    sortedOrders.map(order => {
                                        const driver = drivers.find(d => d.uid === order.driverId);
                                        const driverName = driver?.name || 'Unassigned';
                                        
                                        return (
                                            <tr key={order.id} className="hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => {
                                                setEditingOrderId(order.id); setNewOrderDate(order.orderDate || '');
                                                setSelectedDriverId(order.driverId || '');
                                                setOrderCustomer(order.customer);
                                                setNewOrderAddress(order.deliveryAddress || '');
                                                setNewOrderDeliveryDate(order.deadline || '');
                                                setNewOrderNotes(order.notes || '');
                                                const orderOrigin = order.trip_origin || 'TAIPING';
                                                setTripOrigin(orderOrigin);
                                                setCurrentItemLoc(orderOrigin === 'NILAI' ? 'Nilai' : 'SPD');
                                                setTripCategory(order.zone || '');
                                                setTripDropCount(order.trip_drop_count || 1);

                                                const defaultLoc = orderOrigin === 'NILAI' ? 'Nilai' : 'SPD';
                                                const itemsWithExtractedLoc = (order.items || []).map(item => {
                                                    let loc = item.sourceLocation;
                                                    if (!loc && item.remark && item.remark.includes('(Loc:')) {
                                                        const locMatch = item.remark.match(/\(Loc:\s*(.*?)\)/);
                                                        if (locMatch && locMatch[1]) {
                                                            loc = locMatch[1];
                                                        }
                                                    }
                                                    return { ...item, sourceLocation: loc || defaultLoc };
                                                });
                                                setNewOrderItems(itemsWithExtractedLoc);
                                                setEditingOrderPhoto(order.proof_of_load_url || null);
                                                setIsCreateModalOpen(true);
                                            }}>
                                                <td className="p-4">
                                                    <div className="font-bold text-white text-sm">{driverName}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Sequence: <span className="text-blue-400 font-bold">{order.tripSequence === 999 ? 'New / Pending' : (order.tripSequence || 1)}</span></div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-mono text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-block border border-blue-500/20 tracking-wide">
                                                        {order.orderNumber}
                                                    </div>
                                                </td>
                                                <td className="p-4 max-w-[200px] truncate">
                                                    <div className="text-sm text-slate-200 truncate">{order.deliveryAddress || '-'}</div>
                                                    {order.deliveryAddress && (
                                                        <div className={`text-[9px] font-bold px-1.5 py-0.5 mt-1 rounded border uppercase tracking-wider inline-block ${getStateColor(determineState(order.deliveryAddress))}`}>
                                                            {determineState(order.deliveryAddress)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-xs text-slate-500 flex flex-col gap-0.5">
                                                        <div><span className="text-[9px] font-black uppercase tracking-tighter">Ord:</span> <span className="text-slate-300 font-medium">{formatDateDMY(order.orderDate)}</span></div>
                                                        <div><span className="text-[9px] font-black uppercase text-blue-500/50 tracking-tighter">Del:</span> <span className="text-blue-400 font-bold">{formatDateDMY(order.deadline) || "No Date"}</span></div>
                                                    </div>
                                                                                                </td>
                                                <td className="p-4">
                                                    <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border inline-block ${order.status === 'New' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                                                        order.status === 'Delivered' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                                                        order.status === 'Pending Approval' ? 'text-red-400 border-red-500/20 bg-red-500/10 animate-pulse' :
                                                        'text-slate-400 border-slate-700 bg-slate-800'
                                                    }`}>
                                                        {order.status}
                                                    </div>
                                                    {(order.pod_photo_url || order.pod_signature_url || (order.notes && order.notes.includes(']'))) && (
                                                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                                            {order.pod_photo_url && (
                                                                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5" title="Has delivery photo">
                                                                    📸 POD
                                                                </span>
                                                            )}
                                                            {order.pod_signature_url && (
                                                                <span className="text-[8px] bg-teal-500/20 text-teal-400 border border-teal-500/30 px-1 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5" title="Has customer signature">
                                                                    ✍️ SIGN
                                                                </span>
                                                            )}
                                                            {order.notes && order.notes.includes(']') && (
                                                                <span className="text-[8px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5" title="Has driver notes">
                                                                    💬 NOTE
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="text-xs bg-[#18181b] border border-[#27272a] text-slate-300 font-bold px-2 py-1.5 rounded-lg shadow-sm">{(order.items || []).length} items</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id, order.orderNumber); }} className="p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors" title="Cancel">
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); setReassignOrder(order); setIsReassignModalOpen(true); }} className="p-2 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors" title="Change Driver">
                                                            <UserIcon size={16} />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); setSplitOrder(order); setSplitItems({}); setSplitTargetDriverId(''); setSplitTargetDate(''); setIsSplitModalOpen(true); }} className="p-2 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 rounded-md transition-colors" title="Split Order">
                                                            <Scissors size={16} />
                                                        </button>
                                                        {order.status === 'Pending Approval' && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleApproveAmendment(order); }} className="p-2 text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-900/50 rounded-md transition-colors" title="Approve">
                                                                <Zap size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- CREATE / EDIT MODAL --- */}
            {
                isCreateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-3 lg:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-slate-950 border-0 sm:border border-slate-800 rounded-none sm:rounded-2xl w-full max-w-6xl h-full sm:h-[min(96vh,920px)] overflow-hidden flex flex-col shadow-2xl shadow-black">
                            {/* Modal Header */}
                            <div className="py-3 px-4 sm:px-6 border-b border-slate-800 flex justify-between items-center gap-3 bg-slate-900/50">
                                <div className="min-w-0 flex-1 flex items-center gap-3">
                                    <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                                        {editingOrderId ? <FileText className="text-blue-400" size={18} /> : <Plus className="text-blue-400" size={18} />}
                                        {editingOrderId ? 'Edit Trip' : 'Create New Trip'}
                                    </h2>
                                    {toast && (
                                        <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[10px] font-bold border ${toast.type === 'error' ? 'bg-red-900/40 text-red-200 border-red-500/30' : 'bg-emerald-900/40 text-emerald-200 border-emerald-500/30'}`}>
                                            <AlertTriangle size={12} />
                                            {toast.message}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={tripPhotoInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={handleTripPhotoScan}
                                    />
                                    <button
                                        type="button"
                                        disabled={isTripPhotoScanning}
                                        onClick={() => tripPhotoInputRef.current?.click()}
                                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-200 hover:bg-violet-600/30 disabled:opacity-50 text-xs font-bold uppercase tracking-wide transition-all shrink-0"
                                    >
                                        {isTripPhotoScanning ? (
                                            <span className="w-4 h-4 border-2 border-violet-300/30 border-t-violet-200 rounded-full animate-spin" />
                                        ) : (
                                            <Sparkles size={16} />
                                        )}
                                        <span className="hidden sm:inline">{isTripPhotoScanning ? 'Scanning…' : 'Scan Photo'}</span>
                                        <span className="sm:hidden sr-only">{isTripPhotoScanning ? 'Scanning' : 'Scan photo'}</span>
                                    </button>

                                    <input
                                        ref={tripExcelInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={handleTripExcelImport}
                                    />
                                    <button
                                        type="button"
                                        disabled={isTripExcelImporting}
                                        onClick={() => tripExcelInputRef.current?.click()}
                                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50 text-xs font-bold uppercase tracking-wide transition-all shrink-0"
                                    >
                                        {isTripExcelImporting ? (
                                            <span className="w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-200 rounded-full animate-spin" />
                                        ) : (
                                            <FileText size={16} />
                                        )}
                                        <span className="hidden sm:inline">{isTripExcelImporting ? 'Importing…' : 'Import Excel'}</span>
                                        <span className="sm:hidden sr-only">{isTripExcelImporting ? 'Importing' : 'Import Excel'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleDownloadTemplate}
                                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-200 hover:bg-blue-600/30 text-xs font-bold uppercase tracking-wide transition-all shrink-0"
                                        title="Download Excel Import Template"
                                    >
                                        <Download size={16} />
                                        <span className="hidden sm:inline">Template</span>
                                    </button>

                                    <button onClick={handleCloseModal} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar bg-slate-950 min-h-0">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                                <div className="space-y-6">

                                {/* Section 1: Basic Info (Simpler) */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                                                {drivers.filter(d => (d.base_location || 'Taiping').toUpperCase() === tripOrigin).map(d => <option key={d.uid} value={d.name || d.email || ''} />)}
                                            </datalist>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                                        <div className="hidden lg:flex mt-1 justify-between px-1">
                                            <div className="text-[9px] text-slate-700 font-bold uppercase">Ord: {formatDateDMY(newOrderDate) || "Today"}</div>
                                            <div className="text-[9px] text-blue-500/60 font-black uppercase">Del: {formatDateDMY(newOrderDeliveryDate) || "Not Set"}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* CUSTOMER / CLIENT SELECTION */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Customer / Client</label>
                                    <div className="relative">
                                        <input
                                            list="customers-list"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none placeholder:text-slate-600"
                                            placeholder="-- Type or Select Customer (Auto-fills Address & Zone) --"
                                            value={orderCustomer}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setOrderCustomer(val);
                                                // Auto-fill address and category if matched
                                                const matched = customerDB.find(
                                                    c => c.name.toLowerCase() === val.toLowerCase()
                                                );
                                                if (matched) {
                                                    setNewOrderAddress(matched.address || '');
                                                    if (matched.zone) {
                                                        setTripCategory(matched.zone);
                                                    }
                                                }
                                            }}
                                        />
                                        <datalist id="customers-list">
                                            {customerDB.map((c, i) => (
                                                <option key={c.id || i} value={c.name} />
                                            ))}
                                        </datalist>
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
                                            // Auto-calc drops supporting multipliers (e.g. "Penang x 3, KL")
                                            const drops = e.target.value.split(',').reduce((total, s) => {
                                                if (s.trim().length === 0) return total;
                                                const match = s.match(/[x*]\s*(\d+)/i);
                                                if (match && match[1]) {
                                                    return total + parseInt(match[1], 10);
                                                }
                                                return total + 1;
                                            }, 0) || 1;
                                            setTripDropCount(drops);
                                        }}
                                    />

                                    {/* DRIVER PAYROLL RATES: Origin, Category, Drops */}
                                    <div className="grid grid-cols-1 max-lg:gap-3 lg:grid-cols-3 gap-4 bg-slate-900/50 p-4 border border-slate-800 rounded-xl">
                                        <div>
                                            <label className="block text-[10px] font-bold text-blue-500/80 uppercase tracking-widest mb-2">Origin</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none"
                                                value={tripOrigin}
                                                onChange={e => {
                                                    const newOrigin = e.target.value;
                                                    setTripOrigin(newOrigin);
                                                    setCurrentItemLoc(newOrigin === 'NILAI' ? 'Nilai' : 'SPD');
                                                }}
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
                                                    tripCategory && !deliveryRates.some(r => getSafeOrigin(r.origin) === getSafeOrigin(tripOrigin) && r.location_name === tripCategory)
                                                        ? 'border-red-500/80 focus:border-red-500 text-red-100' // Invalid styling
                                                        : 'border-slate-800 focus:border-blue-500/50'     // Normal styling
                                                }`}
                                                value={tripCategory}
                                                onChange={e => setTripCategory(e.target.value.toUpperCase())}
                                            />
                                            <datalist id="trip-category-list">
                                                {Array.from(new Set(deliveryRates.filter(r => getSafeOrigin(r.origin) === getSafeOrigin(tripOrigin)).map(r => r.location_name))).map(loc => (
                                                    <option key={loc} value={loc} />
                                                ))}
                                            </datalist>
                                            {tripCategory && !deliveryRates.some(r => getSafeOrigin(r.origin) === getSafeOrigin(tripOrigin) && r.location_name === tripCategory) && (
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
                                {/* TRIP NOTE & PHOTO */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Trip Notes</label>
                                        <textarea
                                            rows={editingOrderPhoto ? 4 : 2}
                                            placeholder="Enter notes for this trip..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-blue-500/50 outline-none placeholder:text-slate-600 resize-none"
                                            value={newOrderNotes}
                                            onChange={e => setNewOrderNotes(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Driver Proof of Load</label>
                                        {editingOrderPhoto ? (
                                            <a href={editingOrderPhoto} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-700 h-28 bg-black">
                                                <img src={editingOrderPhoto} alt="Proof of Load" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    <span className="bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg uppercase tracking-wider backdrop-blur-sm">Click to Enlarge</span>
                                                </div>
                                            </a>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center bg-slate-900 border border-dashed border-slate-800 rounded-xl h-28 opacity-50">
                                                <Camera size={24} className="text-slate-600 mb-2" />
                                                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">No Photo Uploaded</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* DRIVER DELIVERY / POD INFO SECTION */}
                                {(() => {
                                    const currentOrder = orders.find(o => o.id === editingOrderId);
                                    if (!currentOrder || (!currentOrder.pod_photo_url && !currentOrder.pod_signature_url && !currentOrder.pod_timestamp)) return null;
                                    
                                    return (
                                        <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-900/30 flex flex-col gap-3">
                                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                                                🚚 Proof of Delivery / POD (Driver Uploads)
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* POD Photos */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Delivery Photos (DO / Goods)</label>
                                                    {currentOrder.pod_photo_url ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {currentOrder.pod_photo_url.split(',').map((url, idx) => (
                                                                <a key={idx} href={url.trim()} target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-lg border border-slate-800 hover:border-blue-500 h-20 w-20 bg-black flex-shrink-0 block transition-all">
                                                                    <img src={url.trim()} alt={`POD Photo ${idx + 1}`} className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                                        <span className="text-[9px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded shadow">View</span>
                                                                    </div>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-600 italic">No delivery photos uploaded</div>
                                                    )}
                                                </div>

                                                {/* POD Signature */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Signature</label>
                                                    {currentOrder.pod_signature_url ? (
                                                        <a href={currentOrder.pod_signature_url} target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-lg border border-slate-800 hover:border-blue-500 h-20 w-full max-w-[200px] bg-white flex items-center justify-center block transition-all">
                                                            <img src={currentOrder.pod_signature_url} alt="POD Signature" className="max-h-full object-contain p-1" />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                                <span className="text-[9px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded shadow">View</span>
                                                            </div>
                                                        </a>
                                                    ) : (
                                                        <div className="text-xs text-slate-600 italic">No signature recorded</div>
                                                    )}
                                                </div>

                                                {/* POD Details */}
                                                <div className="text-xs text-slate-400 flex flex-col gap-2.5 justify-center">
                                                    {currentOrder.pod_timestamp && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Delivered At</span>
                                                            <span className="text-slate-300 font-medium font-mono">{new Date(currentOrder.pod_timestamp).toLocaleString('en-GB')}</span>
                                                        </div>
                                                    )}
                                                    {currentOrder.pod_signed_by && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Signed By</span>
                                                            <span className="text-slate-300 font-medium">{currentOrder.pod_signed_by}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                </div>

                                <div className="flex flex-col min-h-0 lg:min-h-[min(72vh,680px)]">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Box size={16} /> Trip Items
                                    </h3>

                                    {/* Item List Layout */}
                                    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg flex flex-col flex-1 min-h-0 overflow-hidden">
                                        <div className="p-4 border-b border-slate-800 bg-slate-800/40 flex flex-col gap-3 shrink-0 z-10">
                                            <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                <ImagePlus size={14} className="text-blue-400" /> Quick Add (search by name)
                                            </div>
                                            <div className="text-xs font-bold text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                                {newOrderItems.length} in list
                                            </div>
                                            </div>
                                            <SearchableSelect
                                                placeholder="Type product name (e.g. stretch film)..."
                                                dropdownMaxHeight="max-h-[min(55vh,32rem)]"
                                                options={v2Items.map(item => {
                                                    const stock = getStockForSkuAndLoc(item.sku, currentItemLoc);
                                                    return {
                                                        value: item.sku,
                                                        label: item.name,
                                                        subLabel: `${item.sku} • Stock: ${stock}`,
                                                        searchText: [item.brand, item.description, item.legacy_code].filter(Boolean).join(' '),
                                                        statusColor: stock < 100 ? 'text-red-400' : 'text-green-400',
                                                        statusLabel: stock < 100 ? 'LOW' : 'OK'
                                                    };
                                                })}
                                                value={selectedV2Item?.sku || ''}
                                                onChange={(val) => {
                                                    const i = v2Items.find(x => x.sku === val);
                                                    setSelectedV2Item(i || null);
                                                }}
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                <select
                                                    className="min-w-[5rem] bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-slate-300 outline-none focus:border-blue-500 text-xs font-bold uppercase"
                                                    value={currentItemLoc}
                                                    onChange={e => setCurrentItemLoc(e.target.value)}
                                                >
                                                    {WAREHOUSES.filter(w => tripOrigin === 'NILAI' ? w === 'Nilai' : w !== 'Nilai').map(loc => (
                                                        <option key={loc} value={loc}>{loc}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="Item remark..."
                                                    className="flex-1 min-w-[8rem] bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 outline-none focus:border-blue-500 text-sm placeholder:text-slate-600"
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
                                                    type="button"
                                                    onClick={handleAddItem}
                                                    disabled={!selectedV2Item || !currentItemQty}
                                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shrink-0"
                                                >
                                                    <Plus size={16} /> Add
                                                </button>
                                            </div>
                                        </div>
                                        <div className="px-4 py-2 border-b border-slate-800/80 text-[10px] font-bold text-slate-600 uppercase shrink-0 flex items-center gap-2">
                                            <Box size={12} /> Line items
                                        </div>
                                        <div className="flex-1 min-h-0 p-4 space-y-2 overflow-y-auto custom-scrollbar max-h-[min(42vh,380px)] xl:max-h-none">
                                            {newOrderItems.length === 0 ? (
                                                <div className="text-center py-12 text-slate-700 text-sm italic border-2 border-dashed border-slate-800/50 rounded-xl">
                                                    No items yet. Use Quick Add above or Scan Photo.
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
                                                                    value={item.sourceLocation || (tripOrigin === 'NILAI' ? 'Nilai' : 'SPD')}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const updated = [...newOrderItems];
                                                                        updated[idx].sourceLocation = val;
                                                                        setNewOrderItems(updated);
                                                                    }}
                                                                >
                                                                    {WAREHOUSES.filter(w => tripOrigin === 'NILAI' ? w === 'Nilai' : w !== 'Nilai').map(loc => <option key={loc} value={loc}>{loc}</option>)}
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

            {/* --- TRIP SCAN REVIEW (batch create from photo) --- */}
            {isScanReviewOpen && scanReview && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[min(92vh,720px)] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-start gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    {scanReview.sheetNotes === 'Excel Import' ? (
                                        <FileText className="text-emerald-400" size={20} />
                                    ) : (
                                        <Sparkles className="text-violet-400" size={20} />
                                    )}
                                    {scanReview.sheetNotes === 'Excel Import' ? 'Excel Import Review' : 'Photo Scan Review'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {scanReview.trips.length} trip(s) {scanReview.sheetNotes === 'Excel Import' ? 'imported' : 'detected'} — confirm to create all, or load the first into the form only.
                                </p>
                            </div>
                            <button type="button" onClick={closeScanReview} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trip Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
                                        value={scanReview.tripDate}
                                        onChange={e => setScanReview({ ...scanReview, tripDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
                                        value={scanReview.deliveryDate}
                                        onChange={e => setScanReview({ ...scanReview, deliveryDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned Driver</label>
                                <input
                                    list="drivers-list-scan"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200"
                                    placeholder="Select driver..."
                                    value={drivers.find(d => d.uid === scanReview.driverId)?.name || ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        const matched = drivers.find(d =>
                                            (d.name || '').toLowerCase() === val.toLowerCase()
                                        );
                                        setScanReview({
                                            ...scanReview,
                                            driverId: matched?.uid || scanReview.driverId,
                                        });
                                    }}
                                />
                                <datalist id="drivers-list-scan">
                                    {drivers.filter(d => (d.base_location || 'Taiping').toUpperCase() === tripOrigin).map(d => (
                                        <option key={d.uid} value={d.name || ''} />
                                    ))}
                                </datalist>
                            </div>

                            {scanReview.trips.map((trip, idx) => (
                                <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <div className="min-w-0">
                                            <div className="font-bold text-white text-sm">{trip.label}</div>
                                            {trip.customer && (
                                                <div className="text-xs text-blue-400 mt-0.5 font-bold">
                                                    Client: {trip.customer}
                                                </div>
                                            )}
                                            <div className="text-xs text-slate-400 mt-1 truncate">{trip.destinations || '—'}</div>
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {trip.tripCategory || 'No category'} · {trip.tripDropCount} drop(s) · {trip.items.length} item(s)
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Driver:</span>
                                                <select
                                                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 w-full max-w-[200px] focus:outline-none focus:border-blue-600 transition-colors"
                                                    value={trip.driverId || ''}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setScanReview(prev => {
                                                            if (!prev) return null;
                                                            const updated = [...prev.trips];
                                                            updated[idx] = { ...updated[idx], driverId: val };
                                                            return { ...prev, trips: updated };
                                                        });
                                                    }}
                                                >
                                                    <option value="">-- Fallback to sheet driver --</option>
                                                    {drivers.filter(d => (d.base_location || 'Taiping').toUpperCase() === tripOrigin).map(d => (
                                                        <option key={d.uid} value={d.uid}>{d.name || d.email}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeScannedTrip(idx)}
                                            className="text-slate-500 hover:text-red-400 p-1 shrink-0"
                                            title="Remove this trip"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    {trip.items.length > 0 && (
                                        <ul className="text-xs text-slate-400 space-y-1 max-h-28 overflow-y-auto custom-scrollbar border-t border-slate-800 pt-2 mt-2">
                                            {trip.items.map((item, i) => (
                                                <li key={i} className="flex justify-between gap-2">
                                                    <span className="truncate">{item.product}</span>
                                                    <span className="font-mono text-orange-400 shrink-0">×{item.quantity}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={applyFirstScannedTripToForm}
                                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800"
                            >
                                Use first trip only
                            </button>
                            <button
                                type="button"
                                onClick={handleBatchCreateFromScan}
                                disabled={isBatchCreating}
                                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2"
                            >
                                {isBatchCreating ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : null}
                                Confirm & Create {scanReview.trips.length} Trip{scanReview.trips.length > 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* --- SMART AUTO DISPATCH MODAL --- */}
            {isAutoDispatchModalOpen && autoDispatchDrafts && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-[#09090b] w-full max-w-4xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Sparkles size={20} className="text-violet-400" />
                                    一键智能排单推荐方案 (Smart Auto-Dispatch Recommendation)
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    系统已根据送货区域（Zone）自动聚合拼车并进行容量装箱。请审查并指派最终司机。
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsAutoDispatchModalOpen(false);
                                    setAutoDispatchDrafts(null);
                                }}
                                className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            {autoDispatchDrafts.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 italic">
                                    没有生成推荐的拼车行程。
                                </div>
                            ) : (
                                autoDispatchDrafts.map((trip, tIdx) => (
                                    <div key={trip.id || tIdx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                                            <div>
                                                <div className="text-sm font-bold text-white flex items-center gap-2">
                                                    <Truck size={16} className="text-violet-400" />
                                                    {trip.name}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                    区域 Zone: <span className="text-slate-300 font-bold">{trip.zone}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                                                <div className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                                                    体积 Vol: <span className={`font-bold ${trip.totalVol > 20 ? 'text-red-400 font-black' : 'text-emerald-400'}`}>{trip.totalVol.toFixed(2)} m³</span>
                                                </div>
                                                <div className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                                                    重量 Wgt: <span className={`font-bold ${trip.totalWeight > 3000 ? 'text-red-400 font-black' : 'text-emerald-400'}`}>{trip.totalWeight.toFixed(2)} kg</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">指派司机:</span>
                                                    <select
                                                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-violet-500"
                                                        value={trip.recommendedDriverId || ''}
                                                        onChange={(e) => handleUpdateDraftTripDriver(trip.id, e.target.value)}
                                                    >
                                                        <option value="">-- 未指派 (Unassigned) --</option>
                                                        {drivers
                                                            .filter(d => (d.base_location || 'Taiping').toLowerCase() === activeLocation.toLowerCase())
                                                            .map(d => (
                                                                <option key={d.uid} value={d.uid}>
                                                                    {d.name}
                                                                </option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Orders inside this trip */}
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">包含送货单 ({trip.orders.length} 单)</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {trip.orders.map((order, oIdx) => (
                                                    <div key={order.id || oIdx} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs">
                                                        <div className="flex justify-between items-center gap-2 mb-1.5">
                                                            <span className="font-mono font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 text-[10px]">
                                                                {order.orderNumber}
                                                            </span>
                                                            {order.deliveryAddress && (
                                                                <span className={`text-[8px] font-bold px-1 py-0.5 rounded border uppercase tracking-wider ${getStateColor(determineState(order.deliveryAddress))}`}>
                                                                    {determineState(order.deliveryAddress)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="font-bold text-slate-200 mb-0.5 truncate">{order.customer}</div>
                                                        <div className="text-[10px] text-slate-500 line-clamp-1 mb-2">{order.deliveryAddress}</div>
                                                        
                                                        <div className="space-y-0.5 border-t border-slate-900 pt-1.5">
                                                            {order.items?.map((item: any, itemIdx: number) => (
                                                                <div key={itemIdx} className="text-[9px] flex justify-between text-slate-400">
                                                                    <span className="truncate max-w-[150px]">{item.product}</span>
                                                                    <span className="font-bold font-mono">x{item.quantity}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => {
                                    setIsAutoDispatchModalOpen(false);
                                    setAutoDispatchDrafts(null);
                                }}
                                className="px-6 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-sm transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleApplyAutoDispatch}
                                disabled={isSubmitting || autoDispatchDrafts.length === 0}
                                className="px-8 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-900/30 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />应用中...</>
                                ) : (
                                    '应用排单方案 (Apply Scheme)'
                                )}
                            </button>
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
