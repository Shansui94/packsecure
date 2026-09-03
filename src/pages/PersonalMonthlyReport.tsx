import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    CalendarDays, Award, AlertTriangle, Camera,
    DollarSign, Clock, ChevronLeft, ChevronRight, Activity, Users, Truck, X,
    FileSpreadsheet, Printer, FileText, CheckCircle2, Percent, Layers, Plus, Search, Box,
    User as UserIcon, MapPin, ImagePlus, Calendar, Sparkles, Download, CheckSquare
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { deductStockForOrder } from '../services/stockService';
import * as XLSX from 'xlsx';

const normalizeWarehouseName = (loc: string): string => {
    if (!loc) return 'SPD';
    const lower = loc.trim().toLowerCase();
    if (lower === 'spd' || lower === 't1' || lower === 'taiping') return 'SPD';
    if (lower === 'nilai') return 'Nilai';
    if (lower === 'kelantan') return 'Kelantan';
    if (lower === 'johor') return 'Johor';
    if (lower === 'opm lama' || lower === 'opm_lama') return 'OPM Lama';
    if (lower === 'opm corner' || lower === 'opm_corner') return 'OPM Corner';
    if (lower === 'opm ali' || lower === 'opm_ali') return 'OPM Ali';
    return loc;
};

const getDefaultLocForOrigin = (origin: string): string => {
    return normalizeWarehouseName(origin);
};

const getAvailableWarehousesForOrigin = (origin: string): string[] => {
    const u = (origin || '').toUpperCase().trim();
    if (u === 'NILAI') return ['Nilai'];
    if (u === 'KELANTAN') return ['Kelantan'];
    if (u === 'JOHOR') return ['Johor'];
    return ['SPD', 'OPM Lama', 'OPM Corner', 'OPM Ali'];
};

const getPercentColor = (percent: number): string => {
    if (percent < 70) return 'text-red-400 font-bold';
    if (percent >= 70 && percent < 90) return 'text-amber-400 font-bold';
    if (percent >= 90 && percent <= 100) return 'text-emerald-400 font-bold';
    return 'text-red-400 font-black';
};

const getPercentBarColor = (percent: number): string => {
    if (percent < 70) return 'bg-red-500 shadow-md shadow-red-500/20';
    if (percent >= 70 && percent < 90) return 'bg-amber-500 shadow-md shadow-amber-500/20';
    if (percent >= 90 && percent <= 100) return 'bg-emerald-500 shadow-md shadow-emerald-500/20';
    return 'bg-red-600 shadow-md shadow-red-600/40';
};

const formatDateDMY = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
        return dateStr;
    }
};

interface SearchableSelectProps {
    label?: string;
    icon?: React.ReactNode;
    options: {
        value: string;
        label: string;
        subLabel?: string;
        searchText?: string;
        statusColor?: string;
        statusLabel?: string;
    }[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    minimal?: boolean;
    dropdownMaxHeight?: string;
}

const filterSelectOptions = (options: SearchableSelectProps['options'], search: string) => {
    const sortedByName = [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    if (!search.trim()) return sortedByName.slice(0, 200);

    const q = search.toLowerCase().trim();
    const searchTerms = q.split(/[\s-]+/).filter(Boolean);

    return sortedByName.filter(opt => {
        const label = opt.label.toLowerCase();
        const sub = (opt.subLabel || '').toLowerCase();
        const extra = (opt.searchText || '').toLowerCase();
        const haystack = `${label} ${sub} ${extra}`;
        return searchTerms.every(term => haystack.includes(term));
    });
};

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
                        type="button"
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

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[80]" onClick={() => setIsOpen(false)} />
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

interface Props {
    user: any;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface DailyMetrics {
    dateStr: string;
    dayNum: number;
    isWeekend: boolean;
    isSunday: boolean;
    hasAttendance: boolean;
    hoursWorked: number;
    outputQty: number;
    rejectQty: number;
    alarmCount: number;
    tripCount: number;
    tripEarnings: number;
    tripDetails: {
        id: string;
        order_number: string;
        customer: string;
        items: any[];
        notes: string;
        displayString: string;
        pod_photo_url?: string | null;
        pod_signature_url?: string | null;
        proof_of_load_url?: string | null;
        driver_id?: string | null;
        lorry_id?: string | null;
        trip_origin?: string | null;
        zone?: string | null;
        trip_drop_count?: number;
        delivery_address?: string | null;
        earnings?: number;
        deadline?: string | null;
        order_date?: string | null;
        pod_timestamp?: string | null;
    }[];
    photoCount: number;
    photos: any[];
    leaveStatus: string | null;
    leaveType: string | null;
    leaveReason: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    notes: string | null;
    machinesOperated: string[];
    jobDetails: { jobId: string; sku?: string; output: number; reject: number }[];
    approvedClaims: number;
}

const PersonalMonthlyReport: React.FC<Props> = ({ user }) => {
    const today = new Date();
    const getSafeOrigin = (o?: string) => (o || '').toUpperCase().trim();
    // Check if a pending edit payload actually has real differences from the original order
    const hasRealPreEditChanges = (notes?: string | null, original?: any) => {
        if (!notes) return false;
        const payloadMatch = notes.match(/\[PENDING_EDIT_PAYLOAD\]:\s*(\{.*\})/is);
        if (!payloadMatch) {
            return Boolean(notes.includes('[PENDING EDIT'));
        }
        if (!original) return true;
        try {
            const after = JSON.parse(payloadMatch[1]);
            const cleanOldNotes = (original.notes || '').replace(/(?:\n\n)?\[PENDING_EDIT_PAYLOAD\]:[\s\S]*$/is, '').replace(/\[PENDING EDIT.*?\]:?[\s\S]*/gi, '').trim();
            const cleanNewNotes = (after.notes || '').replace(/(?:\n\n)?\[PENDING_EDIT_PAYLOAD\]:[\s\S]*$/is, '').replace(/\[PENDING EDIT.*?\]:?[\s\S]*/gi, '').trim();

            const originChanged = after.trip_origin && after.trip_origin.toUpperCase() !== (original.trip_origin || '').toUpperCase();
            const zoneChanged = after.zone && after.zone !== original.zone;
            const dropsChanged = after.trip_drop_count !== undefined && Number(after.trip_drop_count) !== Number(original.trip_drop_count || 1);
            const addressChanged = after.delivery_address && after.delivery_address.trim() !== (original.delivery_address || '').trim();
            const customerChanged = after.customer && after.customer.trim() !== (original.customer || '').trim();
            const dateChanged = after.deadline && after.deadline !== original.deadline;
            const notesChanged = cleanNewNotes !== cleanOldNotes;

            return Boolean(originChanged || zoneChanged || dropsChanged || addressChanged || customerChanged || dateChanged || notesChanged);
        } catch(e) {
            return true;
        }
    };

    // Unified helper to check if a trip / extra job is pending approval
    const isTripPending = (t: any) => {
        if (!t) return false;
        if (t.status === 'Pending Approval' || t.status === 'Pending') return true;
        if ((t.job_type === 'Extra Job' || t.order_number?.startsWith('TRIP-JOB') || t.order_number?.startsWith('TRIP-PU')) && t.status !== 'Delivered' && t.status !== 'Cancelled') return true;
        if (t.notes?.includes('[PENDING_EDIT_PAYLOAD]') || t.notes?.includes('[PENDING EDIT')) {
            return hasRealPreEditChanges(t.notes, t);
        }
        return false;
    };
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const saved = sessionStorage.getItem('pmr_selectedMonth');
        return saved ? parseInt(saved, 10) : today.getMonth() + 1;
    });
    const [selectedYear, setSelectedYear] = useState(() => {
        const saved = sessionStorage.getItem('pmr_selectedYear');
        return saved ? parseInt(saved, 10) : today.getFullYear();
    });
    const [loading, setLoading] = useState(true);

    // HR/Admin Selector States
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
        return sessionStorage.getItem('pmr_selectedEmployeeId') || '';
    });
    const [employeesList, setEmployeesList] = useState<any[]>([]);
    
    // Viewed Profile (could be self or someone else)
    const [viewedProfile, setViewedProfile] = useState<any>(null);

    // Attendance Edit Form States
    const [editClockIn, setEditClockIn] = useState<string>('');
    const [editClockOut, setEditClockOut] = useState<string>('');
    const [editAttendanceNotes, setEditAttendanceNotes] = useState<string>('');

    // Rich Trip Edit Form States (Matching DeliveryOrderManagement UI 1:1)
    const [isEditingTrip, setIsEditingTrip] = useState<boolean>(false);
    const [selectedLorryId, setSelectedLorryId] = useState<string>('');
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');
    const [newOrderDate, setNewOrderDate] = useState<string>('');
    const [newOrderDeliveryDate, setNewOrderDeliveryDate] = useState<string>('');
    const [orderCustomer, setOrderCustomer] = useState<string>('');
    const [newOrderAddress, setNewOrderAddress] = useState<string>('');
    const [tripOrigin, setTripOrigin] = useState<string>('JOHOR');
    const [tripCategory, setTripCategory] = useState<string>('');
    const [tripDropCount, setTripDropCount] = useState<number>(1);
    const [newOrderNotes, setNewOrderNotes] = useState<string>('');
    const [newOrderItems, setNewOrderItems] = useState<any[]>([]);

    // Quick Add Item States for Trip Items (Matching DeliveryOrderManagement)
    const [selectedV2Item, setSelectedV2Item] = useState<any | null>(null);
    const [currentItemLoc, setCurrentItemLoc] = useState<string>('SPD');
    const [currentItemRemark, setCurrentItemRemark] = useState<string>('');
    const [currentItemQty, setCurrentItemQty] = useState<number>(1);

    // DB Reference Data for Trip Edit Modal
    const [lorries, setLorries] = useState<any[]>([]);
    const [v2Items, setV2Items] = useState<any[]>([]);

    // Data states
    const [productionLogs, setProductionLogs] = useState<any[]>([]);
    const [attendanceShifts, setAttendanceShifts] = useState<any[]>([]);
    const [photoLogs, setPhotoLogs] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [plannedMachines, setPlannedMachines] = useState<any[]>([]);
    const [payroll, setPayroll] = useState<any | null>(null);
    const [claims, setClaims] = useState<any[]>([]);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);
    const [driverLorryPlate, setDriverLorryPlate] = useState<string>('N/A');
    const [isMonthlyConfirmed, setIsMonthlyConfirmed] = useState<boolean>(false);
    const [confirmedTripIds, setConfirmedTripIds] = useState<Set<string>>(new Set());
    const [pendingCountsMap, setPendingCountsMap] = useState<Record<string, number>>({});
    
    // Batch & Single Print States
    const [isPreparingBatchPrint, setIsPreparingBatchPrint] = useState(false);
    const [batchPrintData, setBatchPrintData] = useState<any[]>([]);
    
    // Modal / selection states
    const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
    const [selectedPhotoDay, setSelectedPhotoDay] = useState<any | null>(null);
    const [selectedAttendanceDay, setSelectedAttendanceDay] = useState<any | null>(null);
    const [showPayrollModal, setShowPayrollModal] = useState<boolean>(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>('');

    const isDriver = viewedProfile?.role === 'Driver' || (!viewedProfile && user?.role === 'Driver') || deliveries.length > 0;
    const isAdminOrHR = ['SuperAdmin', 'Admin', 'HR'].includes(currentUserRole);
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    // Customer DB for Datalist
    const customerDB = useMemo(() => {
        const map = new Map();
        deliveries.forEach(d => {
            if (d.customer && !map.has(d.customer)) {
                map.set(d.customer, { id: d.customer, name: d.customer, address: d.delivery_address || '', zone: d.zone || '' });
            }
        });
        return Array.from(map.values());
    }, [deliveries]);

    // Sync selectedEmployeeId when user loads and handle session storage restoration safely
    useEffect(() => {
        if (user) {
            const loggedInUid = user.uid || user.id;
            const savedUserUid = sessionStorage.getItem('pmr_loggedInUserUid');
            const savedEmployeeId = sessionStorage.getItem('pmr_selectedEmployeeId');
            
            if (savedUserUid === loggedInUid && savedEmployeeId) {
                setSelectedEmployeeId(savedEmployeeId);
            } else {
                setSelectedEmployeeId(loggedInUid);
                sessionStorage.setItem('pmr_loggedInUserUid', loggedInUid);
                sessionStorage.setItem('pmr_selectedEmployeeId', loggedInUid);
            }
        }
    }, [user]);

    // Keep sessionStorage synced when filters change
    useEffect(() => {
        if (selectedEmployeeId) {
            sessionStorage.setItem('pmr_selectedEmployeeId', selectedEmployeeId);
        }
    }, [selectedEmployeeId]);

    useEffect(() => {
        sessionStorage.setItem('pmr_selectedMonth', String(selectedMonth));
    }, [selectedMonth]);

    useEffect(() => {
        sessionStorage.setItem('pmr_selectedYear', String(selectedYear));
    }, [selectedYear]);

    // Sync Attendance Edit Form when day selected
    useEffect(() => {
        if (selectedAttendanceDay) {
            const dateStr = selectedAttendanceDay.dateStr;
            const shift = attendanceShifts.find(s => s.date === dateStr);
            if (shift) {
                const toLocalDatetimeInput = (isoStr: string | null) => {
                    if (!isoStr) return '';
                    const d = new Date(isoStr);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                };
                setEditClockIn(toLocalDatetimeInput(shift.clock_in));
                setEditClockOut(toLocalDatetimeInput(shift.clock_out));
                setEditAttendanceNotes(shift.notes || '');
            } else {
                setEditClockIn(`${dateStr}T08:00`);
                setEditClockOut(`${dateStr}T17:00`);
                setEditAttendanceNotes('');
            }
        }
    }, [selectedAttendanceDay, attendanceShifts]);

    // Fetch Lorries and V2 Master Items for Rich Trip Edit Modal
    useEffect(() => {
        supabase.from('lorries').select('*').then(({ data }) => setLorries(data || []));
        getV2Items().then(items => setV2Items(items || []));
    }, []);

    // Sync Trip Edit Form when trip selected
    useEffect(() => {
        if (selectedTrip) {
            const hasPendingPayload = selectedTrip.pending_edit_payload;
            const source = hasPendingPayload ? selectedTrip.pending_edit_payload : selectedTrip;

            setSelectedLorryId(source.lorry_id || selectedTrip.lorry_id || '');
            setSelectedDriverId(source.driver_id || selectedTrip.driver_id || selectedEmployeeId || '');
            setNewOrderDate(source.order_date || selectedTrip.order_date || selectedTrip.date || '');
            setNewOrderDeliveryDate(source.deadline || selectedTrip.deadline || '');
            setOrderCustomer(source.customer || selectedTrip.customer || '');
            setNewOrderAddress(source.delivery_address || selectedTrip.delivery_address || selectedTrip.zone || '');
            setTripOrigin(source.trip_origin || selectedTrip.trip_origin || 'JOHOR');
            setTripCategory(source.zone || selectedTrip.zone || '');
            setTripDropCount(source.trip_drop_count || selectedTrip.trip_drop_count || 1);
            setNewOrderNotes((source.notes || selectedTrip.notes || '').replace(/(?:\n\n)?\[PENDING_EDIT_PAYLOAD\]:[\s\S]*$/is, '').replace(/\[PENDING EDIT.*?\]:?[\s\S]*/gi, '').trim());
            setNewOrderItems(source.items ? [...source.items] : (selectedTrip.items ? [...selectedTrip.items] : []));
            setIsEditingTrip(true);
        }
    }, [selectedTrip, selectedEmployeeId]);

    const handleAddItem = () => {
        if (!selectedV2Item || !currentItemQty) return;
        const newItem = {
            product: selectedV2Item.name,
            sku: selectedV2Item.sku,
            quantity: currentItemQty,
            packaging: selectedV2Item.packaging || 'Unit',
            sourceLocation: currentItemLoc,
            remark: currentItemRemark || ''
        };
        setNewOrderItems(prev => [...prev, newItem]);
        setSelectedV2Item(null);
        setCurrentItemRemark('');
        setCurrentItemQty(1);
    };

    const handleRemoveItem = (index: number) => {
        setNewOrderItems(prev => prev.filter((_, i) => i !== index));
    };

    const calculateLoad = (itemsList: any[], masterItems: any[]) => {
        let totalVol = 0;
        let totalWeight = 0;

        (itemsList || []).forEach(item => {
            const qty = Number(item.quantity || item.qty) || 0;
            const itemSku = item.sku || item.item_sku || '';
            const itemProd = item.product || item.name || '';
            const matched = masterItems.find(v => 
                (itemSku && v.sku && v.sku.toLowerCase() === itemSku.toLowerCase()) || 
                (itemProd && v.name && v.name.toLowerCase() === itemProd.toLowerCase()) ||
                (itemProd && v.sku && v.sku.toLowerCase() === itemProd.toLowerCase())
            );
            if (matched) {
                const vol = Number(matched.unit_volume_m3 || matched.volume_m3 || matched.vol_m3) || 0;
                const weight = Number(matched.unit_weight_kg || matched.weight_kg || matched.weight) || 0;
                totalVol += vol * qty;
                totalWeight += weight * qty;
            } else if (qty > 0) {
                // Default estimate per roll/unit if not found in master_items_v2
                totalVol += 0.04 * qty;
                totalWeight += 10 * qty;
            }
        });

        const maxVol = 36.81;
        const maxWeight = 5000;
        const percentVol = maxVol > 0 ? ((totalVol / maxVol) * 100).toFixed(1) : '0.0';
        const percentWeight = maxWeight > 0 ? ((totalWeight / maxWeight) * 100).toFixed(1) : '0.0';

        return {
            totalVol: totalVol.toFixed(2),
            totalWeight: totalWeight.toFixed(2),
            maxVol,
            maxWeight,
            percentVol,
            percentWeight
        };
    };

    // 1. Initial Load: Fetch Logged In User Profile to check permissions
    useEffect(() => {
        if (!user) return;
        const fetchPermissions = async () => {
            const { data } = await supabase
                .from('sys_users_v2')
                .select('role, auth_user_id')
                .eq('auth_user_id', user.uid || user.id)
                .single();

            const role = data?.role || user.role;
            setCurrentUserRole(role);
            const isAdminOrHRUser = ['SuperAdmin', 'Admin', 'HR'].includes(role);
            
            if (isAdminOrHRUser) {
                // HR Portal persists status as lowercase 'active'; Driver API / others may use 'Active'
                const activeStatuses = ['Active', 'active'];
                const [v2Res, pubRes] = await Promise.all([
                    supabase.from('sys_users_v2').select('auth_user_id, name, employee_id, role, status').in('status', activeStatuses),
                    supabase.from('users_public').select('id, name, employee_id, role, status').in('status', activeStatuses)
                ]);
                
                let merged: any[] = [];
                if (v2Res.data) {
                    merged = [...v2Res.data.filter(e => e.auth_user_id).map(e => ({...e, uid: e.auth_user_id}))];
                }
                if (pubRes.data) {
                    pubRes.data.forEach(p => {
                        if (!merged.find(m => m.uid === p.id)) {
                            merged.push({...p, uid: p.id, auth_user_id: p.id});
                        }
                    });
                }
                setEmployeesList(merged.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
                fetchGlobalPendingCounts();
            } else {
                setEmployeesList([]);
                setSelectedEmployeeId(user.uid || user.id);
            }
        };
        fetchPermissions();
    }, [user]);

    // 2. Fetch Data whenever Employee or Month changes
    useEffect(() => {
        if (!selectedEmployeeId) return;
        fetchData();
    }, [selectedEmployeeId, selectedMonth, selectedYear]);

    const fetchGlobalPendingCounts = async () => {
        try {
            const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDayObj = new Date(selectedYear, selectedMonth, 0);
            const lastDayStr = `${lastDayObj.getFullYear()}-${String(lastDayObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

            const { data } = await supabase
                .from('sales_orders')
                .select('id, driver_id, status, job_type, order_number, notes, deadline, created_at')
                .or('status.eq.Pending Approval,status.eq.Pending,job_type.eq.Extra Job,order_number.ilike.TRIP-JOB%,order_number.ilike.TRIP-PU%,notes.ilike.%[PENDING%');

            if (data) {
                const counts: Record<string, number> = {};
                data.forEach((o: any) => {
                    const rawDate = o.deadline || (o.created_at ? o.created_at.split('T')[0] : null);
                    if (rawDate && (rawDate < firstDay || rawDate > lastDayStr)) return;
                    if (isTripPending(o) && o.driver_id) {
                        counts[o.driver_id] = (counts[o.driver_id] || 0) + 1;
                    }
                });
                setPendingCountsMap(counts);
            }
        } catch (e) {
            console.warn("Global pending counts error:", e);
        }
    };

    const fetchData = async (isSilent: boolean = false) => {
        if (!isSilent) setLoading(true);
        fetchGlobalPendingCounts();

        const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const lastDayObj = new Date(selectedYear, selectedMonth, 0);
        const lastDayStr = `${lastDayObj.getFullYear()}-${String(lastDayObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
        const startDateTs = `${firstDay}T00:00:00.000Z`;
        const endDateTs = `${lastDayStr}T23:59:59.999Z`;

        try {
            // A. Fetch Viewed User Profile
            let { data: profileData } = await supabase
                .from('sys_users_v2')
                .select('*')
                .eq('auth_user_id', selectedEmployeeId)
                .single();

            if (!profileData) {
                // Check users_public (for standalone Drivers)
                const { data: pubData } = await supabase
                    .from('users_public')
                    .select('*')
                    .eq('id', selectedEmployeeId)
                    .single();
                
                if (pubData) {
                    profileData = { ...pubData, auth_user_id: pubData.id };
                }
            }

            setViewedProfile(profileData);
            
            const activeEmpId = profileData ? profileData.employee_id : (selectedEmployeeId === (user.uid || user.id) ? user.employeeId : undefined);
            const dbUserId = profileData ? profileData.id : null;

            // C. Fetch Attendance First
            let attendanceData: any[] = [];
            if (activeEmpId) {
                const { data } = await supabase
                    .from('operator_attendance')
                    .select('id, date, clock_in, clock_out, hours_worked, machine_id, notes')
                    .eq('operator_id', activeEmpId)
                    .gte('date', firstDay)
                    .lte('date', lastDayStr);
                attendanceData = data || [];
            }
            setAttendanceShifts(attendanceData);

            // Fetch Planned Schedules / Machines
            try {
                const { data: mSchedData } = await supabase
                    .from('machine_schedules')
                    .select('*')
                    .gte('shift_date', firstDay)
                    .lte('shift_date', lastDayStr);

                if (mSchedData && mSchedData.length > 0) {
                    const myScheds = mSchedData.filter((s: any) => 
                        (activeEmpId && s.operator_id === activeEmpId) || 
                        s.employee_id === selectedEmployeeId || 
                        s.operator_id === selectedEmployeeId
                    );
                    setPlannedMachines(myScheds.length > 0 ? myScheds : mSchedData);
                } else {
                    setPlannedMachines([]);
                }
            } catch (sErr) {
                console.warn("Schedule query fallback:", sErr);
                setPlannedMachines([]);
            }

            // B. Fetch Production Logs based on Time-matching & Explicit ID
            let prodData: any[] = [];
            if (activeEmpId || selectedEmployeeId) {
                const machinesTouched = Array.from(new Set(attendanceData.map(a => a.machine_id).filter(Boolean)));
                let rawLogs: any[] = [];
                
                if (machinesTouched.length > 0) {
                    let allRawLogs: any[] = [];
                    let hasMore = true;
                    let offset = 0;
                    
                    while (hasMore) {
                        const { data } = await supabase
                            .from('production_logs_v2')
                            .select('log_id, created_at, output_qty, reject_qty, machine_id, job_id, operator_id, sku')
                            .in('machine_id', machinesTouched)
                            .gte('created_at', startDateTs)
                            .lte('created_at', endDateTs)
                            .range(offset, offset + 999);
                            
                        if (data && data.length > 0) {
                            allRawLogs.push(...data);
                            offset += 1000;
                            if (data.length < 1000) hasMore = false;
                        } else {
                            hasMore = false;
                        }
                    }
                    rawLogs = allRawLogs;
                }
                
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                const validIds = [selectedEmployeeId, dbUserId, activeEmpId].filter(id => id && uuidRegex.test(id));
                let explicitLogs: any[] = [];
                if (validIds.length > 0) {
                    const orStr = validIds.map(id => `operator_id.eq.${id}`).join(',');
                    let hasMoreExplicit = true;
                    let offsetExplicit = 0;
                    
                    while (hasMoreExplicit) {
                        const { data } = await supabase
                            .from('production_logs_v2')
                            .select('log_id, created_at, output_qty, reject_qty, machine_id, job_id, operator_id, sku')
                            .or(orStr)
                            .gte('created_at', startDateTs)
                            .lte('created_at', endDateTs)
                            .range(offsetExplicit, offsetExplicit + 999);
                            
                        if (data && data.length > 0) {
                            explicitLogs.push(...data);
                            offsetExplicit += 1000;
                            if (data.length < 1000) hasMoreExplicit = false;
                        } else {
                            hasMoreExplicit = false;
                        }
                    }
                }
                    
                const allLogs = [...rawLogs, ...explicitLogs];
                
                const logMap = new Map();
                allLogs.forEach(log => {
                    const uniqueId = log.log_id || (log.created_at + log.machine_id);
                    if (logMap.has(uniqueId)) return;
                    
                    // 1. If the log explicitly belongs to the viewed operator, keep it
                    if (log.operator_id === selectedEmployeeId || log.operator_id === dbUserId || log.operator_id === activeEmpId) {
                        logMap.set(uniqueId, log);
                        return;
                    }
                    
                    // 2. If the log explicitly belongs to someone else, do NOT count it for this operator
                    if (log.operator_id && log.operator_id.trim() !== '') {
                        return;
                    }
                    
                    // 3. Fallback: If operator_id is null/blank, match by shift time
                    const logTime = new Date(log.created_at).getTime();
                    const belongsToMe = attendanceData.some(shift => {
                        if (shift.machine_id !== log.machine_id) return false;
                        const inTime = new Date(shift.clock_in).getTime();
                        const outTime = shift.clock_out 
                            ? Math.min(new Date(shift.clock_out).getTime(), inTime + (14 * 3600000))
                            : inTime + (14 * 3600000);
                        return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                    });
                    
                    if (belongsToMe) {
                        logMap.set(uniqueId, log);
                    }
                });
                
                prodData = Array.from(logMap.values());
            }
            setProductionLogs(prodData);

            // D. Photos
            if (activeEmpId) {
                const { data: photoData } = await supabase
                    .from('work_photos')
                    .select('created_at, category, risk_flag, photo_url')
                    .eq('employee_id', activeEmpId)
                    .gte('created_at', startDateTs)
                    .lte('created_at', endDateTs);
                setPhotoLogs(photoData || []);
            } else {
                setPhotoLogs([]);
            }

            // E. Leaves
            const { data: leaveData } = await supabase
                .from('employee_leave')
                .select('start_date, end_date, status, reason, leave_type, type')
                .eq('employee_id', selectedEmployeeId)
                .eq('status', 'Approved')
                .lte('start_date', lastDayStr) 
                .gte('end_date', firstDay);   
            setLeaves(leaveData || []);

            // F. Payroll & Confirmation Status
            if (activeEmpId) {
                const { data: payrollData } = await supabase
                    .from('payroll_records')
                    .select('*')
                    .eq('employee_id', activeEmpId)
                    .eq('month', selectedMonth)
                    .eq('year', selectedYear)
                    .maybeSingle();
                setPayroll(payrollData || null);

                // Sync monthly confirmation state
                const savedState = sessionStorage.getItem(`pmr_confirmed_${selectedEmployeeId}_${selectedYear}_${selectedMonth}`);
                setIsMonthlyConfirmed(payrollData?.driver_confirmed || savedState === 'true');
            } else {
                setPayroll(null);
                const savedState = sessionStorage.getItem(`pmr_confirmed_${selectedEmployeeId}_${selectedYear}_${selectedMonth}`);
                setIsMonthlyConfirmed(savedState === 'true');
            }

            // H. Claims
            try {
                const { data: claimsData } = await supabase
                    .from('claims')
                    .select('*')
                    .or(`userId.eq.${selectedEmployeeId},userId.eq.${dbUserId || ''}`);

                const monthlyClaims = (claimsData || []).filter((c: any) => {
                    const cDate = c.date || (c.timestamp ? c.timestamp.split('T')[0] : (c.created_at ? c.created_at.split('T')[0] : null));
                    const isAppr = c.status === 'Approved' || c.status === 'approved';
                    return cDate && cDate >= firstDay && cDate <= lastDayStr && isAppr;
                });
                setClaims(monthlyClaims);
            } catch (cErr) {
                console.warn("Claims query failed:", cErr);
                setClaims([]);
            }

            // G. Deliveries & Rates (Fetched for all roles so pending tasks/trips are always visible)
            const { data: dr } = await supabase.from('delivery_rates').select('*');
            setDeliveryRates(dr || []);

            const { data: rawDeliveryData } = await supabase
                .from('sales_orders')
                .select('*')
                .eq('driver_id', selectedEmployeeId);

            const monthlyDeliveries = (rawDeliveryData || []).filter(d => {
                if (d.status !== 'Delivered') return false; // 🔒 仅统计已实际送达完成的 Trip（排除未完成/未进行的计划单与装车单）
                const rawDate = d.deadline || (d.pod_timestamp ? d.pod_timestamp.split('T')[0] : (d.created_at ? d.created_at.split('T')[0] : null));
                if (!rawDate) return false;
                return rawDate >= firstDay && rawDate <= lastDayStr;
            });
            setDeliveries(monthlyDeliveries);

            const confirmedSet = new Set<string>();
            (monthlyDeliveries || []).forEach(d => {
                const savedLocal = sessionStorage.getItem(`pmr_confirmed_trip_${d.id}`);
                if (d.notes?.includes('[DRIVER_CONFIRMED') || d.driver_confirmed === true || d.driver_verified === true || savedLocal === 'true') {
                    confirmedSet.add(d.id);
                }
            });
            setConfirmedTripIds(confirmedSet);

            // Determine if whole month is fully confirmed
            const validTrips = (monthlyDeliveries || []).filter(d => d.status === 'Delivered');
            if (validTrips.length > 0 && validTrips.every(d => confirmedSet.has(d.id))) {
                setIsMonthlyConfirmed(true);
            } else {
                setIsMonthlyConfirmed(false);
            }

            // Fetch tied lorry for driver / Dapatkan lorry yang terikat untuk pemandu
            const { data: lorryData } = await supabase
                .from('lorries')
                .select('plate_number')
                .eq('driver_id', selectedEmployeeId)
                .maybeSingle();
            setDriverLorryPlate(lorryData?.plate_number || 'N/A');

        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const handleSaveAttendance = async () => {
        if (!viewedProfile?.employee_id) {
            alert("Sila pilih pekerja yang sah. / Please select a valid employee.");
            return;
        }
        
        const dateStr = selectedAttendanceDay.dateStr;
        const shift = attendanceShifts.find(s => s.date === dateStr);
        
        let hoursWorked = 0;
        if (editClockIn && editClockOut) {
            const inTime = new Date(editClockIn).getTime();
            const outTime = new Date(editClockOut).getTime();
            if (outTime < inTime) {
                alert("Masa keluar tidak boleh sebelum masa masuk. / Clock out cannot be before clock in.");
                return;
            }
            hoursWorked = Math.round(((outTime - inTime) / 3600000) * 100) / 100;
        }
        
        const clockInIso = editClockIn ? new Date(editClockIn).toISOString() : null;
        const clockOutIso = editClockOut ? new Date(editClockOut).toISOString() : null;
        
        try {
            if (shift) {
                const { error } = await supabase
                    .from('operator_attendance')
                    .update({
                        clock_in: clockInIso,
                        clock_out: clockOutIso,
                        hours_worked: hoursWorked,
                        notes: editAttendanceNotes || null
                    })
                    .eq('id', shift.id);
                    
                if (error) throw error;
                alert("✅ Rekod kehadiran berjaya dikemas kini! / Attendance record updated successfully!");
            } else {
                const { error } = await supabase
                    .from('operator_attendance')
                    .insert({
                        operator_id: viewedProfile.employee_id,
                        date: dateStr,
                        clock_in: clockInIso,
                        clock_out: clockOutIso,
                        hours_worked: hoursWorked,
                        notes: editAttendanceNotes || null
                    });
                    
                if (error) throw error;
                alert("✅ Rekod kehadiran berjaya ditambah! / Attendance record added successfully!");
            }
            
            setSelectedAttendanceDay(null);
            fetchData();
        } catch (err: any) {
            console.error("Failed to save attendance:", err);
            alert("Ralat menyimpan rekod: / Error saving record: " + err.message);
        }
    };

    const handleDeleteAttendance = async () => {
        if (!selectedAttendanceDay) return;
        const dateStr = selectedAttendanceDay.dateStr;
        const shift = attendanceShifts.find(s => s.date === dateStr);
        if (!shift) return;
        
        if (!window.confirm("Adakah anda pasti mahu memadam rekod ini? / Are you sure you want to delete this record?")) {
            return;
        }
        
        try {
            const { error } = await supabase
                .from('operator_attendance')
                .delete()
                .eq('id', shift.id);
                
            if (error) throw error;
            alert("✅ Rekod kehadiran berjaya dipadam! / Attendance record deleted successfully!");
            setSelectedAttendanceDay(null);
            fetchData();
        } catch (err: any) {
            console.error("Failed to delete attendance:", err);
            alert("Ralat memadam rekod: / Error deleting record: " + err.message);
        }
    };

    const handleToggleTripConfirmation = async (tripOrId: any, checked: boolean) => {
        const tripId = typeof tripOrId === 'string' ? tripOrId : tripOrId.id;
        const oldNotes = (typeof tripOrId === 'object' ? tripOrId.notes : '') || '';
        setConfirmedTripIds(prev => {
            const updated = new Set(prev);
            if (checked) {
                updated.add(tripId);
            } else {
                updated.delete(tripId);
            }
            return updated;
        });

        sessionStorage.setItem(`pmr_confirmed_trip_${tripId}`, String(checked));

        let newNotes = oldNotes;
        if (checked) {
            if (!oldNotes.includes('[DRIVER_CONFIRMED]')) {
                newNotes = (oldNotes ? oldNotes + '\n' : '') + `[DRIVER_CONFIRMED: ${new Date().toISOString()}]`;
            }
        } else {
            newNotes = oldNotes.replace(/\[DRIVER_CONFIRMED:[^\]]*\]\n?/gi, '').replace(/\[DRIVER_CONFIRMED\]\n?/gi, '').trim();
        }

        // Optimistic UI update: instant transition with ZERO screen flash/reload
        setDeliveries(prev => prev.map(d => d.id === tripId ? { ...d, notes: newNotes, driver_confirmed: checked } : d));

        try {
            await supabase
                .from('sales_orders')
                .update({ notes: newNotes })
                .eq('id', tripId);
        } catch (err) {
            console.error("Error saving trip confirmation:", err);
        }
    };

    const handleToggleHRApproveTrip = async (trip: any, checked: boolean) => {
        const oldNotes = trip.notes || '';
        let newNotes = oldNotes;
        if (checked) {
            if (!oldNotes.includes('[HR_APPROVED]')) {
                newNotes = (oldNotes ? oldNotes + '\n' : '') + '[HR_APPROVED]'; 
            }
        } else {
            newNotes = oldNotes.replace(/\[HR_APPROVED\]\n?/g, '').trim();
        }

        // Optimistic UI update: instant transition with ZERO screen flash/reload
        setDeliveries(prev => prev.map(d => d.id === trip.id ? { ...d, notes: newNotes } : d));

        try {
            await supabase
                .from('sales_orders')
                .update({ notes: newNotes })
                .eq('id', trip.id);
        } catch (err) {
            console.error("Error saving HR approval:", err);
            // Revert state if error
            setDeliveries(prev => prev.map(d => d.id === trip.id ? { ...d, notes: oldNotes } : d));
        }
    };

    const handleToggleMonthlyConfirmation = async (checked: boolean) => {
        setIsMonthlyConfirmed(checked);
        sessionStorage.setItem(`pmr_confirmed_${selectedEmployeeId}_${selectedYear}_${selectedMonth}`, String(checked));

        const driverTrips = (deliveries || []).filter(d => d.status !== 'Cancelled');

        if (checked) {
            const allTripIds = new Set(confirmedTripIds);
            driverTrips.forEach(d => allTripIds.add(d.id));
            setConfirmedTripIds(allTripIds);

            // Optimistically update deliveries state in memory
            setDeliveries(prev => prev.map(d => {
                const oldNotes = d.notes || '';
                const newNotes = oldNotes.includes('[DRIVER_CONFIRMED') 
                    ? oldNotes 
                    : (oldNotes ? `${oldNotes}\n` : '') + `[DRIVER_CONFIRMED: ${new Date().toISOString()}]`;
                return { ...d, notes: newNotes, driver_confirmed: true };
            }));

            // Persist to Supabase in background for all monthly trips
            try {
                for (const d of driverTrips) {
                    if (!d.notes?.includes('[DRIVER_CONFIRMED')) {
                        const newNotes = ((d.notes || '') + `\n[DRIVER_CONFIRMED: ${new Date().toISOString()}]`).trim();
                        await supabase.from('sales_orders').update({ notes: newNotes }).eq('id', d.id);
                    }
                }
            } catch (err) {
                console.error("Error bulk confirming trips:", err);
            }
            alert("✅ 已打钩确认全月所有 Trip 出车无误！ / All trips for this month confirmed!");
        } else {
            setConfirmedTripIds(new Set());

            // Optimistically update deliveries in memory
            setDeliveries(prev => prev.map(d => {
                const oldNotes = d.notes || '';
                const newNotes = oldNotes.replace(/\[DRIVER_CONFIRMED:[^\]]*\]\n?/gi, '').replace(/\[DRIVER_CONFIRMED\]\n?/gi, '').trim();
                return { ...d, notes: newNotes, driver_confirmed: false };
            }));

            // Persist uncheck in background for all monthly trips
            try {
                for (const d of driverTrips) {
                    if (d.notes?.includes('[DRIVER_CONFIRMED')) {
                        const newNotes = (d.notes || '').replace(/\[DRIVER_CONFIRMED:[^\]]*\]\n?/gi, '').replace(/\[DRIVER_CONFIRMED\]\n?/gi, '').trim();
                        await supabase.from('sales_orders').update({ notes: newNotes }).eq('id', d.id);
                    }
                }
            } catch (err) {
                console.error("Error bulk unchecking trips:", err);
            }
            alert("ℹ️ 已取消全月打钩确认。 / Monthly confirmation unchecked.");
        }
    };

    const handleAdminApproveTrip = async (approve: boolean) => {
        if (!selectedTrip) return;

        try {
            const payloadMatch = selectedTrip.notes?.match(/\[PENDING_EDIT_PAYLOAD\]:\s*(\{.*\})/is);
            let fallbackPayload: any = {};
            if (payloadMatch) {
                try { fallbackPayload = JSON.parse(payloadMatch[1]); } catch(e) {}
            }
            
            const cleanNotes = (selectedTrip.notes || '')
                .replace(/(?:\n\n)?\[PENDING_EDIT_PAYLOAD\]:[\s\S]*$/is, '')
                .replace(/\[PENDING EDIT.*?\]:?[\s\S]*/gi, '')
                .trim();

            if (approve) {
                const payload: any = {
                    notes: cleanNotes
                };
                if (fallbackPayload.customer !== undefined) payload.customer = fallbackPayload.customer;
                if (fallbackPayload.delivery_address !== undefined) payload.delivery_address = fallbackPayload.delivery_address;
                if (fallbackPayload.trip_origin !== undefined) payload.trip_origin = fallbackPayload.trip_origin.toUpperCase();
                if (fallbackPayload.zone !== undefined) payload.zone = fallbackPayload.zone;
                if (fallbackPayload.trip_drop_count !== undefined) payload.trip_drop_count = fallbackPayload.trip_drop_count;
                if (fallbackPayload.deadline !== undefined) payload.deadline = fallbackPayload.deadline;

                const { error } = await supabase
                    .from('sales_orders')
                    .update(payload)
                    .eq('id', selectedTrip.id);

                if (error) throw error;
                alert("✅ Admin 已批准预修改并套用更改！ / Edit approved and applied!");
            } else {
                const { error } = await supabase
                    .from('sales_orders')
                    .update({ notes: cleanNotes })
                    .eq('id', selectedTrip.id);

                if (error) throw error;
                alert("❌ Admin 已拒绝预修改申请，已清除待审核状态。 / Pending edit request rejected.");
            }
            setSelectedTrip(null);
            setIsEditingTrip(false);
            fetchData();
        } catch (err: any) {
            console.error("Admin approve/reject error:", err);
            alert("Ralat: " + err.message);
        }
    };

    const handleSaveTrip = async () => {
        if (!selectedTrip) return;

        const isUserAdmin = ['SuperAdmin', 'Admin'].includes(currentUserRole);

        const cleanOriginalNotes = (selectedTrip.notes || '')
            .replace(/(?:\n\n)?\[PENDING_EDIT_PAYLOAD\]:[\s\S]*$/is, '')
            .replace(/\[PENDING EDIT.*?\]:?[\s\S]*/gi, '')
            .trim();
        const cleanNewNotes = (newOrderNotes || '').trim();

        const originChanged = (tripOrigin || '').toUpperCase() !== (selectedTrip.trip_origin || '').toUpperCase();
        const zoneChanged = (tripCategory || '') !== (selectedTrip.zone || '');
        const dropsChanged = Number(tripDropCount || 1) !== Number(selectedTrip.trip_drop_count || 1);
        const addressChanged = (newOrderAddress || '').trim() !== (selectedTrip.delivery_address || '').trim();
        const customerChanged = (orderCustomer || '').trim() !== (selectedTrip.customer || '').trim();
        const dateChanged = (newOrderDeliveryDate || '') !== (selectedTrip.deadline || '');
        const notesChanged = cleanNewNotes !== cleanOriginalNotes;

        const hasAnyChange = originChanged || zoneChanged || dropsChanged || addressChanged || customerChanged || dateChanged || notesChanged;

        if (!hasAnyChange) {
            alert("ℹ️ 未检测到任何修改内容，未提交申请。 / No changes detected.");
            setSelectedTrip(null);
            setIsEditingTrip(false);
            return;
        }

        const updatedTripPayload = {
            driver_id: selectedDriverId || null,
            lorry_id: selectedLorryId || null,
            customer: orderCustomer || null,
            delivery_address: newOrderAddress || null,
            trip_origin: tripOrigin.toUpperCase(),
            zone: tripCategory,
            trip_drop_count: Math.max(1, Number(tripDropCount) || 1),
            notes: cleanNewNotes || null,
            items: newOrderItems,
            deadline: newOrderDeliveryDate || null
        };

        try {
            if (isUserAdmin) {
                // Admin can directly edit and apply
                const { error } = await supabase
                    .from('sales_orders')
                    .update(updatedTripPayload)
                    .eq('id', selectedTrip.id);

                if (error) throw error;
                alert("✅ Admin 已成功保存 Trip 更改！ / Trip record updated by Admin!");
            } else {
                // Driver: submit pre-edit payload only when there are actual changes
                const pendingPayload = {
                    customer: orderCustomer,
                    delivery_address: newOrderAddress,
                    trip_origin: tripOrigin,
                    zone: tripCategory,
                    trip_drop_count: tripDropCount,
                    notes: cleanNewNotes,
                    deadline: newOrderDeliveryDate
                };
                const appendedNotes = cleanOriginalNotes ? `${cleanOriginalNotes}\n\n[PENDING_EDIT_PAYLOAD]: ${JSON.stringify(pendingPayload)}` : `[PENDING_EDIT_PAYLOAD]: ${JSON.stringify(pendingPayload)}`;

                const { error } = await supabase
                    .from('sales_orders')
                    .update({ notes: appendedNotes })
                    .eq('id', selectedTrip.id);

                if (error) throw error;
                alert("⏳ 预修改已提交！已转入 Pending 状态，须待 Admin 确认后才正式生效。 / Pre-change submitted! Set to Pending status awaiting Admin approval.");
            }

            setSelectedTrip(null);
            setIsEditingTrip(false);
            fetchData();
        } catch (err: any) {
            console.error("Failed to save trip details:", err);
            alert("Ralat: / Error: " + err.message);
        }
    };

    const handleDownloadExcel = () => {
        if (isDriver) {
            // Collect all tripDetails from dailyMetrics
            const allTrips: any[] = [];
            dailyMetrics.forEach(day => {
                if (day.tripDetails && day.tripDetails.length > 0) {
                    day.tripDetails.forEach(trip => {
                        allTrips.push({
                            date: day.dateStr,
                            plateNumber: driverLorryPlate,
                            origin: trip.trip_origin || 'TAIPING',
                            destinations: trip.delivery_address || 'Unknown',
                            tripCategory: trip.zone || 'Unknown',
                            totalDrops: trip.trip_drop_count || 1,
                            price: trip.earnings || 0
                        });
                    });
                }
            });

            if (allTrips.length === 0) {
                alert("Tiada data perjalanan untuk dieksport. / No trip data to export.");
                return;
            }

            // Format data for sheet
            const excelRows = allTrips.map(t => ({
                'Tarikh / Date': t.date,
                'No. Pendaftaran Lorry / Lorry Plate Number': t.plateNumber,
                'Tempat Asal / Origin': t.origin,
                'Destinasi / Destinations': t.destinations,
                'Kategori Trip / Trip Category': t.tripCategory,
                'Jumlah Drops / Total Drops': t.totalDrops,
                'Harga / Price (RM)': t.price
            }));

            const ws = XLSX.utils.json_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Trip Logs');

            // Set column widths for better layout
            ws['!cols'] = [
                { wch: 15 }, // Date
                { wch: 25 }, // Lorry Plate Number
                { wch: 20 }, // Origin
                { wch: 35 }, // Destinations
                { wch: 20 }, // Trip Category
                { wch: 15 }, // Total Drops
                { wch: 15 }  // Price
            ];

            const driverName = viewedProfile?.name || user?.name || 'Driver';
            const fileName = `Laporan_Trip_Pemandu_${driverName.replace(/\s+/g, '_')}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } else {
            // Export Operator / General Staff Monthly Log
            const excelRows = dailyMetrics.map(day => ({
                'Tarikh / Date': day.dateStr,
                'Hari / Day': new Date(day.dateStr.replace(/-/g, '/')).toLocaleDateString('ms-MY', { weekday: 'long' }),
                'Status Kehadiran / Attendance': day.leaveStatus ? `Cuti / Leave (${day.leaveType || ''})` : (day.hasAttendance ? 'Hadir / Present' : 'Tiada Log / No Log'),
                'Masa Masuk / Clock In': day.shiftStart || '-',
                'Masa Keluar / Clock Out': day.shiftEnd || '-',
                'Jam Kerja / Hours Worked': day.hoursWorked.toFixed(1),
                'Jumlah Output / Total Output': day.outputQty,
                'Jumlah Defect / Reject Qty': day.rejectQty,
                'Mesin Dilesenkan / Machines': day.machinesOperated.join(', ') || '-',
                'Produk SKU / Job Orders': day.jobDetails.map(j => `${j.jobId} (${j.sku || 'SKU'}: ${j.output})`).join('; ') || '-',
                'Gambar Kerja / Photo Count': day.photoCount,
                'Tuntutan / Approved Claims (RM)': day.approvedClaims.toFixed(2),
                'Nota / Remarks': day.notes || ''
            }));

            const ws = XLSX.utils.json_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Operator Monthly Report');

            ws['!cols'] = [
                { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 15 }, { wch: 15 },
                { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 35 },
                { wch: 16 }, { wch: 22 }, { wch: 25 }
            ];

            const empName = viewedProfile?.name || user?.name || 'Employee';
            const fileName = `Laporan_Bulanan_${empName.replace(/\s+/g, '_')}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;
            XLSX.writeFile(wb, fileName);
        }
    };

    const handlePrintSingleDriver = () => {
        const allTrips: any[] = [];
        dailyMetrics.forEach(day => {
            if (day.tripDetails && day.tripDetails.length > 0) {
                day.tripDetails.forEach(trip => {
                    allTrips.push({
                        date: day.dateStr,
                        orderNumber: trip.order_number || 'N/A',
                        customer: trip.customer || 'N/A',
                        origin: trip.trip_origin || 'TAIPING',
                        destination: trip.zone || trip.delivery_address || 'Unknown',
                        drops: trip.trip_drop_count || 1,
                        earnings: trip.earnings || 0
                    });
                });
            }
        });

        allTrips.sort((a, b) => a.date.localeCompare(b.date));
        const totalEarnings = allTrips.reduce((sum, t) => sum + (t.earnings || 0), 0);

        const singleReport = {
            driverName: viewedProfile?.name || user?.name || 'Driver',
            employeeId: viewedProfile?.employee_id || user?.employeeId || 'N/A',
            baseLocation: viewedProfile?.base_location || 'Taiping',
            plateNumber: driverLorryPlate || 'N/A',
            totalTrips: allTrips.length,
            totalEarnings,
            tripRows: allTrips
        };

        setBatchPrintData([singleReport]);
        setTimeout(() => {
            window.print();
        }, 400);
    };

    const handlePrintAllDrivers = async () => {
        setIsPreparingBatchPrint(true);
        try {
            const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDayObj = new Date(selectedYear, selectedMonth, 0);
            const lastDayStr = `${lastDayObj.getFullYear()}-${String(lastDayObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

            // Fetch drivers from both tables
            const [v2Res, pubRes] = await Promise.all([
                supabase.from('sys_users_v2').select('auth_user_id, name, employee_id, role, base_location').eq('role', 'Driver').in('status', ['Active', 'active']),
                supabase.from('users_public').select('id, name, employee_id, role, base_location').eq('role', 'Driver').in('status', ['Active', 'active'])
            ]);

            let mergedDrivers: any[] = [];
            if (v2Res.data) {
                mergedDrivers = [...v2Res.data.filter(e => e.auth_user_id).map(e => ({ ...e, uid: e.auth_user_id }))];
            }
            if (pubRes.data) {
                pubRes.data.forEach(p => {
                    if (!mergedDrivers.find(m => m.uid === p.id)) {
                        mergedDrivers.push({ ...p, uid: p.id, auth_user_id: p.id });
                    }
                });
            }

            let driversList = mergedDrivers;

            if (driversList.length === 0) {
                alert("Tiada pemandu dijumpai untuk dicetak. / No drivers found to print.");
                setIsPreparingBatchPrint(false);
                return;
            }

            const { data: dr } = await supabase.from('delivery_rates').select('*');
            const rates = dr || [];
            const rateMap: Record<string, any> = {};
            rates.forEach(r => { rateMap[`${r.origin}-${r.location_name}`.toLowerCase()] = r; });

            const { data: lorryData } = await supabase.from('lorries').select('driver_id, plate_number');
            const lorryMap: Record<string, string> = {};
            (lorryData || []).forEach(l => {
                if (l.driver_id) lorryMap[l.driver_id] = l.plate_number;
            });

            const driverIds = driversList.map(d => d.uid || d.auth_user_id || d.id).filter(Boolean);
            const { data: rawDeliveryData } = await supabase
                .from('sales_orders')
                .select('id, order_number, customer, items, notes, order_date, pod_timestamp, deadline, zone, delivery_address, created_at, trip_origin, trip_drop_count, driver_id')
                .in('driver_id', driverIds)
                .eq('status', 'Delivered');

            const allDeliveries = (rawDeliveryData || []).filter(order => {
                const rawDate = order.deadline || (order.pod_timestamp ? order.pod_timestamp.split('T')[0] : (order.created_at ? order.created_at.split('T')[0] : null));
                if (!rawDate) return false;
                return rawDate >= firstDay && rawDate <= lastDayStr;
            });

            const batchReports = driversList.map(driver => {
                const driverUid = driver.uid || driver.auth_user_id || driver.id;
                const driverDeliveries = allDeliveries.filter(d => d.driver_id === driverUid);
                const plate = lorryMap[driverUid] || 'N/A';

                let totalEarnings = 0;
                const tripRows: any[] = [];

                driverDeliveries.forEach(t => {
                    const originRaw = t.trip_origin || 'TAIPING';
                    const origin = originRaw.toLowerCase();
                    const zoneRaw = t.zone || t.delivery_address || 'Unknown';
                    let calcZone = zoneRaw.toLowerCase();
                    const key = `${origin}-${calcZone}`;
                    const rateInfo = rateMap[key];
                    const drops = Math.max(1, t.trip_drop_count || 1);

                    let tEarnings = 0;
                    if (rateInfo) {
                        const base = Number(rateInfo.base_rate) || 0;
                        const maxPlaces = Number(rateInfo.max_places) || 0;
                        const extraPlaces = Math.max(0, drops - maxPlaces);
                        const extraRate = extraPlaces * (Number(rateInfo.extra_rate_per_place) || 0);
                        tEarnings = base + extraRate;
                    }

                    totalEarnings += tEarnings;

                    const dateStr = t.deadline || (t.pod_timestamp ? t.pod_timestamp.split('T')[0] : t.created_at.split('T')[0]);

                    tripRows.push({
                        date: dateStr,
                        orderNumber: t.order_number || 'N/A',
                        customer: t.customer || 'N/A',
                        origin: originRaw,
                        destination: zoneRaw,
                        drops,
                        earnings: tEarnings
                    });
                });

                tripRows.sort((a, b) => a.date.localeCompare(b.date));

                return {
                    driverName: driver.name || driver.employee_id || 'Pemandu',
                    employeeId: driver.employee_id || 'N/A',
                    baseLocation: driver.base_location || 'Taiping',
                    plateNumber: plate,
                    totalTrips: tripRows.length,
                    totalEarnings,
                    tripRows
                };
            });

            setBatchPrintData(batchReports);

            setTimeout(() => {
                window.print();
                setIsPreparingBatchPrint(false);
            }, 500);

        } catch (err: any) {
            console.error("Batch print error:", err);
            alert("Ralat menyediakan laporan cetakan: " + err.message);
            setIsPreparingBatchPrint(false);
        }
    };

    const changeMonth = (offset: number) => {
        let m = selectedMonth + offset;
        let y = selectedYear;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        setSelectedMonth(m);
        setSelectedYear(y);
    };

    // Calculate Daily Matrix
    const dailyMetrics = useMemo(() => {
        const matrix: DailyMetrics[] = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dateObj = new Date(selectedYear, selectedMonth - 1, i);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isSunday = dateObj.getDay() === 0;

            const matchDate = (utcIsoString: string | null | undefined, targetDateStr: string) => {
                if (!utcIsoString) return false;
                // Convert UTC timestamp to local Date object, then format as YYYY-MM-DD
                const d = new Date(utcIsoString);
                const localY = d.getFullYear();
                const localM = String(d.getMonth() + 1).padStart(2, '0');
                const localD = String(d.getDate()).padStart(2, '0');
                return `${localY}-${localM}-${localD}` === targetDateStr;
            };

            const dayDeliveries = deliveries.filter(d => {
                const ts = d.deadline || d.created_at;
                if (!ts) return false;
                if (d.deadline) return ts.startsWith(dateStr); // deadline is usually purely 'YYYY-MM-DD'
                return matchDate(ts, dateStr);
            });

            // Prod
            const dayProd = productionLogs.filter(p => {
                const logTime = new Date(p.created_at).getTime();
                
                // Find shifts on this specific day (dateStr)
                const shiftsOnThisDay = attendanceShifts.filter(s => s.date === dateStr);
                
                if (shiftsOnThisDay.length > 0) {
                    // If there are shifts on this day, the log MUST fall within at least one of these shifts (with 5 min buffer)
                    return shiftsOnThisDay.some(shift => {
                        if (p.machine_id && shift.machine_id && p.machine_id !== shift.machine_id) return false;
                        const inTime = new Date(shift.clock_in).getTime();
                        const outTime = shift.clock_out 
                            ? Math.min(new Date(shift.clock_out).getTime(), inTime + (14 * 3600000))
                            : inTime + (14 * 3600000);
                        return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                    });
                }
                
                // If there are no shifts on this day, check if this log belongs to a known shift on ANOTHER day
                const matchingShiftOnOtherDay = attendanceShifts.find(shift => {
                    if (p.machine_id && shift.machine_id && p.machine_id !== shift.machine_id) return false;
                    const inTime = new Date(shift.clock_in).getTime();
                    const outTime = shift.clock_out 
                        ? Math.min(new Date(shift.clock_out).getTime(), inTime + (14 * 3600000))
                        : inTime + (14 * 3600000);
                    return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                });

                if (matchingShiftOnOtherDay) {
                    return false;
                }
                
                // Otherwise, fallback to matching the creation date
                return matchDate(p.created_at, dateStr);
            });
            const outputQty = dayProd.reduce((sum, p) => sum + (Number(p.output_qty) || 0), 0);
            const rejectQty = dayProd.reduce((sum, p) => sum + (Number(p.reject_qty) || 0), 0);
            const alarmCount = dayProd.reduce((sum, p) => sum + (Number(p.alarm_count) || Number(p.reject_qty) || 0), 0);

            // Job Details
            const jobMap = new Map();
            dayProd.forEach(p => {
                const jKey = p.job_id || p.sku || 'PROD';
                if (!jobMap.has(jKey)) {
                    jobMap.set(jKey, { jobId: p.job_id || 'PROD', sku: p.sku || null, output: 0, reject: 0 });
                }
                const item = jobMap.get(jKey);
                item.output += Number(p.output_qty) || 0;
                item.reject += Number(p.reject_qty) || 0;
            });
            const jobDetails = Array.from(jobMap.values());

            // Photos
            const dayPhotos = [...photoLogs.filter(p => matchDate(p.created_at, dateStr))];
            if (isDriver) {
                dayDeliveries.forEach(d => {
                    if (d.proof_of_load_url) {
                        dayPhotos.push({
                            created_at: d.pod_timestamp || d.created_at || `${dateStr}T12:00:00.000Z`,
                            category: 'Proof of Load / Muatan',
                            photo_url: d.proof_of_load_url,
                            risk_flag: false
                        });
                    }
                    if (d.pod_photo_url) {
                        d.pod_photo_url.split(',').forEach((url: string, index: number) => {
                            const trimmed = url.trim();
                            if (trimmed) {
                                dayPhotos.push({
                                    created_at: d.pod_timestamp || d.created_at || `${dateStr}T12:00:00.000Z`,
                                    category: `Proof of Delivery / POD (${index + 1})`,
                                    photo_url: trimmed,
                                    risk_flag: false
                                });
                            }
                        });
                    }
                    if (d.pod_signature_url) {
                        dayPhotos.push({
                            created_at: d.pod_timestamp || d.created_at || `${dateStr}T12:00:00.000Z`,
                            category: 'Tandatangan / Signature',
                            photo_url: d.pod_signature_url,
                            risk_flag: false
                        });
                    }
                });
            }

            // Shift & Working Hours
            const dayShift = attendanceShifts.find(s => s.date === dateStr);
            let hoursWorked = 0;
            if (dayShift) {
                if (dayShift.hours_worked && Number(dayShift.hours_worked) > 0) {
                    hoursWorked = Number(dayShift.hours_worked);
                } else if (dayShift.clock_in && dayShift.clock_out) {
                    const inT = new Date(dayShift.clock_in).getTime();
                    const outT = new Date(dayShift.clock_out).getTime();
                    if (outT > inT) hoursWorked = Math.round(((outT - inT) / 3600000) * 10) / 10;
                }
            }

            const dayPlans = plannedMachines.filter(s => s.shift_date === dateStr || s.scheduled_date === dateStr);

            const machinesOperated = Array.from(new Set([
                ...dayPlans.map(p => p.machine_id),
                ...dayProd.map(p => {
                    if (p.machine_id && p.machine_id.trim() !== '') return p.machine_id;
                    if (p.job_id && String(p.job_id).startsWith('JOB-')) return String(p.job_id).split('-')[1];
                    return null;
                })
            ].filter(Boolean)));

            // Leave
            const dayLeave = leaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);
            const leaveType = dayLeave ? (dayLeave.leave_type || dayLeave.type || 'Leave') : null;
            const leaveReason = dayLeave ? dayLeave.reason : null;

            // Claims
            const dayClaims = claims.filter(c => {
                const cDate = c.date || (c.timestamp ? c.timestamp.split('T')[0] : (c.created_at ? c.created_at.split('T')[0] : null));
                return cDate === dateStr;
            });
            const approvedClaims = dayClaims.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

            const tripCount = dayDeliveries.length;
            const tripDetails: any[] = [];

            let tripEarnings = 0;
            const rateMap: Record<string, any> = {};
            deliveryRates.forEach(r => { rateMap[`${r.origin}-${r.location_name}`.toLowerCase()] = r; });

            dayDeliveries.forEach(t => {
                const originRaw = t.trip_origin || 'TAIPING';
                const origin = originRaw.toLowerCase();
                const zoneRaw = t.zone || t.delivery_address || 'Unknown';
                let calcZone = zoneRaw.toLowerCase();
                let displayZone = zoneRaw;

                const key = `${origin}-${calcZone}`;
                const rateInfo = rateMap[key];
                const drops = Math.max(1, t.trip_drop_count || 1);

                const isExtraJob = t.job_type === 'Extra Job' || t.order_number?.startsWith('TRIP-JOB');
                const approvedAmountMatch = t.notes?.match(/\[APPROVED_AMOUNT:\s*([\d.]+)\]/);

                let baseRate = 0;
                let extraRate = 0;
                let tEarnings = 0;

                if (approvedAmountMatch) {
                    baseRate = parseFloat(approvedAmountMatch[1]) || 0;
                    tEarnings = baseRate;
                } else if (rateInfo) {
                    baseRate = Number(rateInfo.base_rate) || 0;
                    const maxPlaces = Number(rateInfo.max_places) || 0;
                    const extraPlaces = Math.max(0, drops - maxPlaces);
                    extraRate = extraPlaces * (Number(rateInfo.extra_rate_per_place) || 0);
                    tEarnings = baseRate + extraRate;
                } else if (t.earnings || t.trip_allowance) {
                    tEarnings = Number(t.earnings || t.trip_allowance || 0);
                    baseRate = tEarnings;
                }

                // If Delivered, add to trip earnings (for both standard trips and extra jobs)
                if (t.status === 'Delivered') {
                    tripEarnings += tEarnings;
                }

                let displayString = `${originRaw} ➞ ${displayZone} (${drops} Drop${drops > 1 ? 's' : ''})`;
                if (isExtraJob) {
                    const iconMap: Record<string, string> = {
                        'AMBIK PALLET': '🪵',
                        'LORRY SERVICE': '🔧',
                        'SHOPEE': '🛍️',
                        'RETURN': '↩️',
                        'OTHER': '🛠️'
                    };
                    const icon = iconMap[t.zone?.toUpperCase()] || '📸';
                    displayString = `${icon} ${t.zone || 'Extra Job'}`;
                }

                // Push formatting
                tripDetails.push({
                    id: t.id,
                    order_number: t.order_number,
                    customer: t.customer,
                    items: t.items,
                    notes: t.notes,
                    status: t.status,
                    job_type: t.job_type || (isExtraJob ? 'Extra Job' : undefined),
                    pod_photo_url: t.pod_photo_url || null,
                    pod_signature_url: t.pod_signature_url || null,
                    proof_of_load_url: t.proof_of_load_url || null,
                    driver_id: t.driver_id || null,
                    trip_origin: t.trip_origin || null,
                    zone: t.zone || null,
                    trip_drop_count: t.trip_drop_count || 1,
                    delivery_address: t.delivery_address || null,
                    edit_status: t.edit_status || null,
                    pending_edit_payload: t.pending_edit_payload || null,
                    driver_confirmed: t.driver_confirmed || false,
                    baseRate,
                    extraRate,
                    earnings: tEarnings,
                    deadline: t.deadline || null,
                    pod_timestamp: t.pod_timestamp || null,
                    pod_signed_by: t.pod_signed_by || null,
                    displayString
                });
            });

            matrix.push({
                dateStr,
                dayNum: i,
                isWeekend,
                isSunday,
                hasAttendance: !!dayShift,
                hoursWorked,
                shiftStart: (dayShift && dayShift.clock_in) ? new Date(dayShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                shiftEnd: (dayShift && dayShift.clock_out) ? new Date(dayShift.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                notes: dayShift?.notes || null,
                outputQty,
                rejectQty,
                alarmCount,
                tripCount,
                tripEarnings,
                tripDetails,
                photoCount: dayPhotos.length,
                photos: dayPhotos,
                leaveStatus: dayLeave ? dayLeave.status : null,
                leaveType,
                leaveReason,
                machinesOperated,
                jobDetails,
                approvedClaims
            });
        }
        return matrix;
    }, [productionLogs, attendanceShifts, photoLogs, leaves, plannedMachines, claims, deliveries, deliveryRates, daysInMonth, selectedYear, selectedMonth, isDriver]);

    // Summary Aggregates
    const totalOutput = dailyMetrics.reduce((sum, d) => sum + d.outputQty, 0);
    const totalRejects = dailyMetrics.reduce((sum, d) => sum + d.rejectQty, 0);
    const yieldRate = (totalOutput + totalRejects) > 0 ? (((totalOutput) / (totalOutput + totalRejects)) * 100).toFixed(1) : '100.0';
    const totalAlarms = dailyMetrics.reduce((sum, d) => sum + d.alarmCount, 0);
    const totalTrips = dailyMetrics.reduce((sum, d) => sum + d.tripCount, 0);
    const presentDays = dailyMetrics.filter(d => d.hasAttendance).length;
    const leaveDays = dailyMetrics.filter(d => d.leaveStatus).length;
    const totalPhotos = dailyMetrics.reduce((sum, d) => sum + d.photoCount, 0);
    const totalHoursWorked = dailyMetrics.reduce((sum, d) => sum + d.hoursWorked, 0);
    const otHours = dailyMetrics.reduce((sum, d) => sum + (d.hasAttendance ? Math.max(0, d.hoursWorked - 8) : 0), 0);
    const totalClaimsAmount = claims.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const riskPhotoCount = dailyMetrics.reduce((sum, d) => sum + d.photos.filter((p: any) => p.risk_flag).length, 0);
    const totalDropCount = dailyMetrics.reduce((sum, d) => sum + d.tripDetails.reduce((ts: number, t: any) => ts + (t.trip_drop_count || 1), 0), 0);
    const onTimeTripsCount = dailyMetrics.reduce((sum, d) => sum + d.tripDetails.filter((t: any) => !t.deadline || !t.pod_timestamp || t.pod_timestamp.split('T')[0] <= t.deadline).length, 0);
    const onTimeRate = totalTrips > 0 ? Math.round((onTimeTripsCount / totalTrips) * 100) : 100;

    const canSelectEmployee = employeesList.length > 0;
    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-6 font-sans pmr-no-print">
            {/* Header Area / Kawasan Kepala Halaman */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-1 flex items-center gap-3">
                        <Activity className="text-blue-500 animate-pulse" size={28} />
                        Laporan Bulanan / Monthly Report
                    </h1>
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-500">
                            Analisis untuk: / Analytics for:
                        </p>
                        {canSelectEmployee ? (
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Users size={14} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
                                </div>
                                <select 
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    className="pl-9 pr-8 py-1.5 bg-[#0d0d12]/90 border border-white/10 hover:border-blue-500/50 rounded-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer transition-all backdrop-blur-md"
                                >
                                    {employeesList.map(emp => {
                                        const rowKey = emp.uid || emp.auth_user_id || emp.id;
                                        const pendingCount = pendingCountsMap[rowKey] || 0;
                                        return (
                                            <option key={rowKey} value={rowKey}>
                                                {emp.name || emp.employee_id} ({emp.role === 'Driver' ? 'Pemandu / Driver' : emp.role}){pendingCount > 0 ? ` 🟡 [${pendingCount} 待审核 / Pending]` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        ) : (
                            <span className="text-sm font-bold text-gray-300 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                                {viewedProfile?.name || user?.name} ({viewedProfile?.role === 'Driver' ? 'Pemandu / Driver' : (viewedProfile?.role || user?.role)})
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {isDriver && (
                        <button
                            onClick={handleDownloadExcel}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-600 text-white border border-emerald-500/30 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-950/20 active:scale-95 cursor-pointer"
                        >
                            <FileSpreadsheet size={16} className="text-emerald-400" />
                            <span>Excel</span>
                        </button>
                    )}

                    {(isDriver || viewedProfile?.role === 'Driver') && (
                        <button
                            onClick={handlePrintSingleDriver}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-500/80 to-indigo-600/80 hover:from-blue-500 hover:to-indigo-600 text-white border border-blue-500/30 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-950/20 active:scale-95 cursor-pointer"
                            title="Cetak Laporan Pemandu Ini / Print Current Driver Report"
                        >
                            <Printer size={16} className="text-blue-300" />
                            <span>Cetak Driver</span>
                        </button>
                    )}

                    {(isAdminOrHR || canSelectEmployee) && (
                        <button
                            onClick={handlePrintAllDrivers}
                            disabled={isPreparingBatchPrint}
                            className="flex items-center gap-2 bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 text-white border border-purple-500/30 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-purple-950/20 active:scale-95 cursor-pointer disabled:opacity-50"
                            title="Cetak Laporan Semua Pemandu / Print All Drivers Reports"
                        >
                            <Printer size={16} className="text-purple-300" />
                            <span>{isPreparingBatchPrint ? 'Menyedia...' : 'Cetak Semua Driver (Batch)'}</span>
                        </button>
                    )}

                    <div className="flex items-center gap-3 bg-[#0d0d12]/80 border border-white/10 rounded-2xl px-5 py-3 shadow-lg backdrop-blur-md">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="text-center min-w-[140px]">
                            <div className="text-xl font-black text-white">
                                {(() => {
                                    const msNames: Record<string, string> = {
                                        'January': 'Januari / January', 'February': 'Februari / February', 'March': 'Mac / March',
                                        'April': 'April / April', 'May': 'Mei / May', 'June': 'Jun / June', 'July': 'Julai / July',
                                        'August': 'Ogos / August', 'September': 'September / September', 'October': 'Oktober / October',
                                        'November': 'November / November', 'December': 'Disember / December'
                                    };
                                    return msNames[MONTH_NAMES[selectedMonth - 1]] || MONTH_NAMES[selectedMonth - 1];
                                })()}
                            </div>
                            <div className="text-xs text-blue-400 tracking-widest uppercase font-bold">{selectedYear}</div>
                        </div>
                        <button onClick={() => changeMonth(1)} disabled={selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()}
                            className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer active:scale-95">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-r-2 border-indigo-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}></div>
                    </div>
                    <p className="text-blue-400 font-bold tracking-widest uppercase text-sm animate-pulse">Sila tunggu, sedang dikira... / Calculating Metrics...</p>
                </div>
            ) : (
                <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* Performance Badges Row / Barisan Lencana Prestasi */}
                    {(() => {
                        const badges = [];
                        const totalWorkingDays = dailyMetrics.filter(d => !d.isSunday).length;
                        const attendRate = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0;
                        
                        if (attendRate >= 90) {
                            badges.push({
                                icon: <CalendarDays size={14} className="text-emerald-400" />,
                                text: "Juara Kehadiran / Attendance Champion",
                                desc: "Hadir >= 90% hari bekerja (Isnin-Sabtu) / Attended >= 90% of working days (Mon-Sat)",
                                color: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                            });
                        }
                        if (isDriver && totalTrips >= 15) {
                            badges.push({
                                icon: <Truck size={14} className="text-amber-400" />,
                                text: "Pemandu Emas / Gold Driver",
                                desc: "Melakukan >= 15 trip penghantaran bulan ini / Made >= 15 trips this month",
                                color: "bg-amber-500/10 border-amber-500/25 text-amber-400"
                            });
                        } else if (!isDriver && totalOutput >= 5000) {
                            badges.push({
                                icon: <Award size={14} className="text-blue-400" />,
                                text: "Pengendali Bintang / Star Operator",
                                desc: "Jumlah output >= 5,000 unit bulan ini / Total output >= 5,000 units this month",
                                color: "bg-blue-500/10 border-blue-500/25 text-blue-400"
                            });
                        }
                        if (totalPhotos >= 15) {
                            badges.push({
                                icon: <Camera size={14} className="text-purple-400" />,
                                text: "Pemberita Visual / Visual Reporter",
                                desc: "Memuat naik >= 15 gambar rekod kerja / Uploaded >= 15 work photos",
                                color: "bg-purple-500/10 border-purple-500/25 text-purple-400"
                            });
                        }
                        if (totalAlarms === 0 && presentDays >= 5) {
                            badges.push({
                                icon: <AlertTriangle size={14} className="text-teal-400" />,
                                text: "Bebas Ralat / Error-Free Pro",
                                desc: "Tiada sebarang ralat atau amaran dikesan / Zero alarms or rejects handled",
                                color: "bg-teal-500/10 border-teal-500/25 text-teal-400"
                            });
                        }

                        if (badges.length === 0) return null;

                        return (
                            <div className="flex flex-wrap gap-2.5 bg-[#0d0d12]/50 border border-white/5 p-3 rounded-2xl">
                                {badges.map((b, idx) => (
                                    <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold shadow-sm cursor-help relative group transition-all hover:scale-105 hover:bg-white/5 ${b.color}`} title={b.desc}>
                                        {b.icon}
                                        <span>{b.text}</span>
                                        {/* Floating Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-[#09090b] border border-slate-800 p-2.5 rounded-xl text-[10px] text-gray-400 font-normal leading-normal opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-2xl z-20">
                                            {b.desc}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {/* Driver Pending Extra Jobs / Trips Notice Banner */}
                    {isDriver && dailyMetrics.some(d => d.tripDetails.some((t: any) => isTripPending(t))) && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg animate-fade-in">
                            <div className="flex items-center gap-3">
                                <Clock className="text-amber-400 animate-spin shrink-0" size={20} />
                                <div>
                                    <div className="text-sm font-bold text-amber-300">
                                        {isAdminOrHR ? "发现待审核的额外任务 / 预修改申请" : "您有待审核的额外任务 / 预修改申请"}
                                    </div>
                                    <div className="text-xs text-amber-400/80 mt-0.5">
                                        {isAdminOrHR 
                                            ? "下方行程标有 ⏳ [待审核] 标签。点击该行程即可直接进行审核、修改金额并批准。" 
                                            : "额外任务或预修改已提交，等待 Admin/Manager 审核确认后将直接计入当月薪资。"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top Row: Metrics Overview / Ringkasan Metrik */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Attendance Card */}
                        <div className="bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-1">Kehadiran / Attendance</p>
                                    <h3 className="text-3xl font-black text-white">{presentDays} <span className="text-xs font-normal text-gray-500">hari / days</span></h3>
                                    <p className="text-[10px] text-emerald-400/90 font-mono mt-1.5 font-bold">{totalHoursWorked.toFixed(1)} hrs total ({otHours.toFixed(1)}h OT)</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{leaveDays} Cuti diluluskan / Approved leaves</p>
                                </div>
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                                    <CalendarDays size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Production / Deliveries Card */}
                        <div className={`bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300 ${isDriver ? 'hover:border-amber-500/30' : 'hover:border-blue-500/30'}`}>
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all ${isDriver ? 'bg-amber-500/10 group-hover:bg-amber-500/20' : 'bg-blue-500/10 group-hover:bg-blue-500/20'}`}></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${isDriver ? 'text-amber-400' : 'text-blue-400'}`}>
                                        {isDriver ? 'Penghantaran / Deliveries' : 'Jumlah Output / Total Output'}
                                    </p>
                                    <h3 className="text-3xl font-black text-white">{isDriver ? totalTrips : totalOutput.toLocaleString()}</h3>
                                    <p className="text-[10px] text-gray-400 mt-1">{isDriver ? `${totalDropCount} Total Drops` : `Unit Dihasilkan / Produced`}</p>
                                    {!isDriver && (
                                        <p className="text-[10px] text-blue-400 font-mono mt-1 font-bold">Yield: {yieldRate}% ({totalRejects} Reject)</p>
                                    )}
                                </div>
                                <div className={`p-3 rounded-2xl border ${isDriver ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    {isDriver ? <Truck size={20} /> : <Award size={20} />}
                                </div>
                            </div>
                        </div>

                        {/* Alarms / Zones Card */}
                        <div className={`bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300 ${isDriver ? 'hover:border-cyan-500/30' : 'hover:border-red-500/30'}`}>
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all ${isDriver ? 'bg-cyan-500/10 group-hover:bg-cyan-500/20' : 'bg-red-500/10 group-hover:bg-red-500/20'}`}></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${isDriver ? 'text-cyan-400' : 'text-red-400'}`}>
                                        {isDriver ? 'Destinasi & Performance' : 'Anomali & Defect'}
                                    </p>
                                    <h3 className="text-3xl font-black text-white">
                                        {isDriver ? Array.from(new Set(deliveries.map(d => d.zone).filter(Boolean))).length : (totalAlarms + totalRejects)}
                                    </h3>
                                    <p className="text-[10px] text-gray-400 mt-1">{isDriver ? `On-time Delivery: ${onTimeRate}%` : `Alarms: ${totalAlarms} | Defect: ${totalRejects}`}</p>
                                </div>
                                <div className={`p-3 rounded-2xl border ${isDriver ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                    {isDriver ? <Truck size={20} /> : <AlertTriangle size={20} />}
                                </div>
                            </div>
                        </div>

                        {/* Photo Logs Card */}
                        <div className="bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] text-violet-400 uppercase tracking-widest font-black mb-1">Rekod Bergambar / Photo Logs</p>
                                    <h3 className="text-3xl font-black text-white">{totalPhotos} <span className="text-xs font-normal text-gray-500">fail</span></h3>
                                    <p className="text-[10px] text-gray-400 mt-1">{riskPhotoCount > 0 ? <span className="text-red-400 font-bold">⚠️ {riskPhotoCount} Risiko / Risk</span> : 'Gambar Tugasan / Proofs'}</p>
                                </div>
                                <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-400 border border-violet-500/20">
                                    <Camera size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Payroll Estimate Card */}
                        <div 
                            onClick={() => setShowPayrollModal(true)}
                            className="bg-gradient-to-br from-green-950/30 to-black border border-green-500/20 rounded-3xl p-5 shadow-2xl relative overflow-hidden group hover:border-green-500/40 transition-all duration-300 cursor-pointer"
                        >
                            <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] text-green-400 uppercase tracking-widest font-black mb-1 flex items-center gap-1">
                                        Gaji / Wallet <span className="text-[8px] bg-green-500/20 px-1 py-0.5 rounded border border-green-500/30 text-green-300">Detail 🔍</span>
                                    </p>
                                    {payroll ? (
                                        <>
                                            <h3 className="text-2xl font-black text-green-300">RM {Number(payroll.net_salary).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</h3>
                                            {totalClaimsAmount > 0 && (
                                                <p className="text-[9px] text-teal-400 mt-1 font-bold">+ Claims: RM {totalClaimsAmount.toFixed(2)}</p>
                                            )}
                                            <p className="text-[9px] text-green-500/80 mt-1 uppercase font-bold tracking-wider">Telah Disahkan / Confirmed</p>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-lg font-black text-gray-400 italic mt-1">RM {totalClaimsAmount > 0 ? totalClaimsAmount.toFixed(2) : '0.00'}</h3>
                                            <p className="text-[9px] text-teal-400 font-bold mt-1">+ Claims: RM {totalClaimsAmount.toFixed(2)}</p>
                                            <p className="text-[9px] text-gray-500 mt-1 uppercase">Klik perincian / Breakdown 🔍</p>
                                        </>
                                    )}
                                </div>
                                <div className="p-3 bg-green-500/10 rounded-2xl text-green-400 border border-green-500/30 group-hover:scale-110 transition-transform">
                                    <DollarSign size={20} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Chart & Calendar Grid / Graf Trend & Grid Bulanan */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Interactive Trend Chart Card (SVG) */}
                        <div className="lg:col-span-2 bg-[#0d0d12]/80 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/20">
                                        <Activity size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-white">
                                            {isDriver ? 'Analisis Pendapatan Harian / Daily Trip Earnings Trend' : 'Carta Output Harian / Daily Output Trend'}
                                        </h2>
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mt-0.5">
                                            {isDriver ? 'Carta Pendapatan Trip / Trip Earnings Chart' : 'Carta Output Kerja / Work Output Chart'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* SVG Render */}
                            <div className="w-full flex-1 min-h-[180px] flex items-center">
                                {(() => {
                                    const chartData = dailyMetrics.map(d => ({
                                        day: d.dayNum,
                                        val: isDriver ? d.tripEarnings : d.outputQty
                                    }));
                                    const maxChartVal = Math.max(...chartData.map(c => c.val), 10);

                                    return (
                                        <div className="w-full overflow-hidden">
                                            <svg viewBox="0 0 800 200" className="w-full overflow-visible">
                                                <defs>
                                                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={isDriver ? '#f59e0b' : '#3b82f6'} stopOpacity="0.25"/>
                                                        <stop offset="100%" stopColor={isDriver ? '#f59e0b' : '#3b82f6'} stopOpacity="0.00"/>
                                                    </linearGradient>
                                                </defs>

                                                {/* Gridlines */}
                                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                                    const y = 20 + ratio * 140;
                                                    const labelVal = maxChartVal - ratio * maxChartVal;
                                                    return (
                                                        <g key={i} className="opacity-20">
                                                            <line x1="55" y1={y} x2="770" y2={y} stroke="#fff" strokeDasharray="4 4" strokeWidth="0.5" />
                                                            <text x="10" y={y + 4} fill="#fff" className="text-[9px] font-mono font-bold">{isDriver ? 'RM' : ''}{Math.round(labelVal)}</text>
                                                        </g>
                                                    );
                                                })}

                                                {/* Path Drawing */}
                                                {(() => {
                                                    const points = chartData.map((c, idx) => {
                                                        const x = 55 + (idx / (chartData.length - 1)) * 715;
                                                        const y = 160 - (c.val / maxChartVal) * 140;
                                                        return { x, y, day: c.day, val: c.val };
                                                    });

                                                    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                                    const areaD = `${pathD} L ${points[points.length - 1].x} 160 L 55 160 Z`;

                                                    return (
                                                        <>
                                                            {/* Area Fill */}
                                                            <path d={areaD} fill="url(#chartGlow)" />

                                                            {/* Line */}
                                                            <path d={pathD} fill="none" stroke={isDriver ? '#f59e0b' : '#3b82f6'} strokeWidth="2.5" className="drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />

                                                            {/* Interactive/Visual Dots */}
                                                            {points.map((p, idx) => (
                                                                <g key={idx} className="group/dot cursor-pointer">
                                                                    <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={isDriver ? '#f59e0b' : '#3b82f6'} strokeWidth="2" className="transition-all duration-300 transform origin-center hover:scale-[2]" />
                                                                    <circle cx={p.x} cy={p.y} r="9" fill={isDriver ? '#f59e0b' : '#3b82f6'} className="opacity-0 hover:opacity-20 transition-opacity" />
                                                                    <title>{`Hari / Day ${p.day}: ${isDriver ? 'RM ' : ''}${p.val.toLocaleString()}`}</title>
                                                                </g>
                                                            ))}
                                                        </>
                                                    );
                                                })()}

                                                {/* X-axis Labels */}
                                                {chartData.map((c, idx) => {
                                                    if (idx % 3 !== 0 && idx !== chartData.length - 1) return null;
                                                    const x = 55 + (idx / (chartData.length - 1)) * 715;
                                                    return (
                                                        <text key={idx} x={x} y="185" fill="#fff" className="text-[9px] font-mono font-bold opacity-30 text-center" textAnchor="middle">
                                                            {c.day}
                                                        </text>
                                                    );
                                                })}
                                            </svg>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* GitHub-Style Attendance Grid / Grid Visual Kehadiran */}
                        <div className="bg-[#0d0d12]/80 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20">
                                    <CalendarDays size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white">Visual Kehadiran / Attendance Grid</h2>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mt-0.5">Status Harian / Daily Status</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1.5 max-w-sm mx-auto w-full">
                                {/* Weekday headers */}
                                {['Ahd/Sun', 'Isn/Mon', 'Sel/Tue', 'Rab/Wed', 'Kha/Thu', 'Jum/Fri', 'Sab/Sat'].map((d, i) => (
                                    <div key={i} className="text-[8px] font-black uppercase text-slate-500 tracking-wider text-center">{d.slice(0, 3)}</div>
                                ))}

                                {/* Blanks */}
                                {(() => {
                                    const firstDayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
                                    const firstDayIdx = new Date(firstDayStr.replace(/-/g, '/')).getDay();
                                    return Array.from({ length: firstDayIdx }).map((_, i) => (
                                        <div key={`blank-${i}`} className="aspect-square rounded-md bg-white/[0.01] border border-dashed border-white/[0.03]"></div>
                                    ));
                                })()}

                                {/* Days */}
                                {dailyMetrics.map((day) => {
                                    let colorClass = "bg-white/[0.02] border-white/5 text-gray-500";
                                    
                                    if (day.leaveStatus) {
                                        colorClass = "bg-amber-500/10 border-amber-500/35 text-amber-400 shadow-sm shadow-amber-950/20";
                                    } else if (day.hasAttendance) {
                                        if (day.notes === 'System Auto-Logout') {
                                            colorClass = "bg-rose-500/10 border-rose-500/35 text-rose-400 shadow-sm shadow-rose-950/20 border-dashed";
                                        } else {
                                            colorClass = "bg-emerald-500/10 border-emerald-500/35 text-emerald-400 shadow-sm shadow-emerald-950/20";
                                        }
                                    } else if (day.isWeekend) {
                                        colorClass = "bg-white/[0.04] border-white/10 text-slate-500";
                                    }

                                    return (
                                        <div 
                                            key={day.dateStr} 
                                            className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative group cursor-pointer transition-all hover:scale-110 hover:z-10 ${colorClass}`}
                                        >
                                            <span className="text-[10px] font-black">{day.dayNum}</span>
                                            
                                            {/* Floating Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#09090b] border border-slate-800 p-3 rounded-xl text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-2xl z-30 leading-relaxed font-sans">
                                                <div className="font-bold text-white mb-1 flex items-center justify-between border-b border-white/5 pb-1">
                                                    <span>{new Date(day.dateStr.replace(/-/g, '/')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    <span className="text-[9px] text-gray-500 uppercase tracking-widest">{new Date(day.dateStr.replace(/-/g, '/')).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                                </div>
                                                
                                                <div className="space-y-1 mt-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Status:</span>
                                                        <span className={`font-bold uppercase text-[9px] ${
                                                            day.leaveStatus ? 'text-amber-400' :
                                                            day.hasAttendance ? 'text-emerald-400' :
                                                            day.isWeekend ? 'text-slate-500' : 'text-gray-500'
                                                        }`}>
                                                            {day.leaveStatus ? `Cuti / Leave` :
                                                             day.hasAttendance ? 'Hadir / Present' :
                                                             day.isWeekend ? 'Weekend' : 'Rest'}
                                                        </span>
                                                    </div>

                                                    {day.hasAttendance && (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Masa / Time:</span>
                                                                <span className="font-mono text-white text-[9px]">{day.shiftStart} → {day.shiftEnd || 'Aktif'}</span>
                                                            </div>
                                                            {day.notes && (
                                                                <div className="text-[8px] text-rose-400 font-bold bg-rose-950/20 px-1 py-0.5 rounded mt-0.5 border border-rose-500/10">
                                                                    ⚠️ {day.notes === 'System Auto-Logout' ? 'Log Keluar Automatik' : day.notes}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}

                                                    {isDriver ? (
                                                        day.tripCount > 0 && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Trip:</span>
                                                                    <span className="font-bold text-amber-400">{day.tripCount} trip{day.tripCount > 1 ? 's' : ''}</span>
                                                                </div>
                                                                {day.tripEarnings > 0 && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Gaji Trip:</span>
                                                                        <span className="font-bold text-green-400">RM {day.tripEarnings.toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )
                                                    ) : (
                                                        day.outputQty > 0 && (
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Output:</span>
                                                                <span className="font-bold text-blue-400">{day.outputQty.toLocaleString()}</span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* PENDING EXTRA JOBS & EDITS QUICK REVIEW SECTION */ }
                    {(() => {
                        const pendingTripsList = dailyMetrics.flatMap(d => (d.tripDetails || []).filter((t: any) => 
                            isTripPending(t)
                        ).map((t: any) => ({ ...t, dateStr: d.dateStr })));

                        if (!isDriver || pendingTripsList.length === 0) return null;

                        return (
                            <div className="bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-black border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-fade-in">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-2xl border border-amber-500/30">
                                            <Clock size={22} className="animate-spin" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                                                <span>待审核任务专区 / Pending Approvals List</span>
                                                <span className="px-2 py-0.5 bg-amber-500 text-black text-xs font-black rounded-full">
                                                    {pendingTripsList.length} 项待处理
                                                </span>
                                            </h3>
                                            <p className="text-xs text-amber-400/80 mt-0.5">
                                                {isAdminOrHR ? "发现该司机有待审核的额外任务/预修改，点击卡片可直接核实并批准金额：" : "您提交的任务已进入审核列表，等待 Admin/Manager 确认：" }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {pendingTripsList.map((pt, pidx) => (
                                        <div 
                                            key={pidx} 
                                            onClick={() => setSelectedTrip(pt)}
                                            className="bg-black/60 border border-amber-500/30 hover:border-amber-500/70 p-4 rounded-2xl flex flex-col justify-between gap-3 transition-all cursor-pointer group hover:bg-black/80 hover:shadow-lg hover:shadow-amber-500/10"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-start gap-2">
                                                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                                                        📅 {pt.dateStr}
                                                    </span>
                                                    <span className="font-mono font-black text-amber-300 text-sm">
                                                        预估 RM {(pt.earnings || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="text-xs font-black text-white group-hover:text-amber-200 transition-colors">
                                                    {pt.displayString}
                                                </div>
                                                {pt.delivery_address && (
                                                    <div className="text-[10px] text-gray-400 truncate">
                                                        📍 {pt.delivery_address}
                                                    </div>
                                                )}
                                                {pt.proof_of_load_url && (
                                                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/50 border border-white/10 relative">
                                                        <img src={pt.proof_of_load_url} alt="Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                    </div>
                                                )}
                                            </div>
                                            <button 
                                                type="button" 
                                                className="w-full py-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-xl text-xs font-bold transition-all border border-amber-500/30 flex items-center justify-center gap-1.5"
                                            >
                                                <span>{isAdminOrHR ? "⚡ 点击审核 / Review & Approve" : "查看详情 / View"}</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Daily Breakdown Table Section / Seksyen Jadual Harian */}
                    <div className="bg-[#0d0d12] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                                <Clock size={18} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white">Garis Masa Harian / Daily Timeline</h2>
                                <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mt-0.5">Perincian Rekod Kerja / Detailed Job Logs</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/40">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02]">
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Tarikh / Date</th>
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-32">Status / Status</th>
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Masa Kerja / Working Time (Scan In/Out)</th>
                                        <th className="px-5 py-4 text-right font-black text-[10px] uppercase tracking-widest text-gray-500">{isDriver ? 'Trip / Perjalanan' : 'Output / Output'}</th>
                                        <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500">{isDriver ? 'Butiran Trip / Trip Details' : 'Mesin & Ralat / Machines & Alarms'}</th>
                                        <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500">Gambar / Photos</th>
                                        {isAdminOrHR && <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500 w-28">Tindakan / Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {dailyMetrics.map((day) => {
                                        const hasDayPending = isDriver && day.tripDetails?.some((t: any) => isTripPending(t));
                                        return (
                                        <tr key={day.dateStr} className={`transition-colors ${hasDayPending ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-500 shadow-sm' : (day.isWeekend ? 'bg-white/[0.01] hover:bg-white/[0.03]' : 'hover:bg-white/[0.03]')}`}>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className={`font-black text-lg ${day.isWeekend ? 'text-gray-600' : 'text-gray-300'}`}>{day.dayNum}</span>
                                                    <span className="text-[9px] uppercase tracking-widest font-bold text-gray-600">
                                                        {new Date(day.dateStr.replace(/-/g, '/')).toLocaleDateString('ms-MY', { weekday: 'short' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {hasDayPending && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider animate-pulse mb-1">
                                                        <Clock size={10} className="animate-spin" />
                                                        待审核 / Pending
                                                    </span>
                                                )}
                                                {day.leaveStatus ? (
                                                    <div className="flex flex-col items-start gap-0.5">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                                                            Cuti / {day.leaveType || 'Leave'}
                                                        </span>
                                                        {day.leaveReason && (
                                                            <span className="text-[9px] text-gray-400 max-w-[140px] truncate" title={day.leaveReason}>
                                                                {day.leaveReason}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : day.hasAttendance ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                                        Hadir / Present
                                                    </span>
                                                ) : day.isWeekend ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-white/5 border border-white/5 text-gray-500 text-[10px] font-black uppercase tracking-wider">
                                                        Weekend
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-gray-800 text-gray-500 text-[10px] font-black uppercase tracking-wider">
                                                        Tiada Log / No Log
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {day.hasAttendance ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 font-mono text-xs">
                                                            <span className="text-green-400">{day.shiftStart || '-'}</span>
                                                            <span className="text-gray-600">→</span>
                                                            <span className="text-orange-400">{day.shiftEnd || 'Aktif / Active'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                                {day.hoursWorked.toFixed(1)} hrs
                                                            </span>
                                                            {day.notes === 'System Auto-Logout' && (
                                                                <span className="text-[9px] uppercase font-bold text-red-500/80 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                                                    Auto-Logout
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-700 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                {isDriver ? (
                                                    day.tripCount > 0 ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="font-mono text-amber-400 font-bold">{day.tripCount} <span className="text-[10px] text-gray-500">trip</span></span>
                                                            {day.tripDetails && day.tripDetails.length > 0 ? (
                                                                <div className="flex flex-col items-end gap-0.5 font-mono text-[10px]">
                                                                    {day.tripDetails.map((td: any, tidx: number) => {
                                                                        const isPending = isTripPending(td);
                                                                        return (
                                                                            <span key={tidx} className={`font-bold px-1.5 py-0.5 rounded border ${
                                                                                isPending 
                                                                                    ? 'text-amber-300 bg-amber-500/10 border-amber-500/30 animate-pulse' 
                                                                                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                                            }`} title={`Trip ${tidx+1}: Base RM${(td.baseRate||td.earnings||0).toFixed(2)} + Extra Drop RM${(td.extraRate||0).toFixed(2)}`}>
                                                                                {isPending ? `Trip #${tidx + 1}: ⏳ 待审核 (RM ${(td.earnings || 0).toFixed(2)})` : `Trip #${tidx + 1}: RM ${(td.earnings || 0).toFixed(2)}`}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                    {day.tripDetails.length > 1 && (
                                                                        <span className="text-[10px] text-amber-300 font-black mt-0.5 pt-0.5 border-t border-slate-800">
                                                                            合计: RM {day.tripEarnings.toFixed(2)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                day.tripEarnings > 0 && (
                                                                    <span className="text-[10px] text-green-400 font-mono mt-0.5">+ RM{day.tripEarnings.toFixed(2)}</span>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                ) : (
                                                    day.outputQty > 0 ? (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className="font-mono text-blue-400 font-bold text-base">{day.outputQty.toLocaleString()}</span>
                                                            {day.jobDetails.length > 0 && (
                                                                <div className="flex flex-col items-end text-[9px] text-gray-400 font-mono">
                                                                    {day.jobDetails.slice(0, 2).map((j, jidx) => (
                                                                        <span key={jidx} className="text-gray-400" title={`Job: ${j.jobId}, SKU: ${j.sku || 'N/A'}`}>
                                                                            {j.sku ? j.sku.split('-').slice(0, 3).join('-') : j.jobId}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                )}
                                            </td>
                                            {isDriver ? (
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    {day.tripDetails && day.tripDetails.length > 0 ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            {day.tripDetails.map((td: any, idx: number) => {
                                                                const isPending = isTripPending(td);
                                                                const isTripConfirmed = confirmedTripIds.has(td.id) || td.notes?.includes('[DRIVER_CONFIRMED') || td.driver_confirmed === true;

                                                                return (
                                                                    <div key={idx} className="flex items-center gap-2 justify-center">
                                                                        <button 
                                                                            onClick={() => setSelectedTrip(td)}
                                                                            className={`text-[10px] px-2.5 py-1 rounded-lg font-mono shadow-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                                                                                td.notes?.includes('[HR_APPROVED]')
                                                                                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold'
                                                                                    : isPending 
                                                                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-bold'
                                                                                        : isTripConfirmed
                                                                                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold'
                                                                                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300'
                                                                            }`}
                                                                            title={td.notes?.includes('[HR_APPROVED]') ? "🔒 已被 HR 锁定 / Locked by HR" : "点击查看或提交预修改申请 / Click to view or pre-edit"}
                                                                        >
                                                                            {td.notes?.includes('[HR_APPROVED]') && <div className="text-indigo-400 shrink-0">🔒</div>}
                                                                            {isPending && !td.notes?.includes('[HR_APPROVED]') && <Clock size={10} className="text-amber-400 shrink-0" />}
                                                                            {isTripConfirmed && !td.notes?.includes('[HR_APPROVED]') && <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />}
                                                                            <span>{isPending ? `⏳ [待审核] ${td.displayString}` : td.displayString}</span>
                                                                            <span className={`ml-1 px-1.5 py-0.5 rounded font-black border text-[9.5px] ${
                                                                                td.notes?.includes('[HR_APPROVED]') 
                                                                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                                                                                    : isPending
                                                                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                                                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                                            }`}>
                                                                                {isPending ? `待审核 RM ${(td.earnings || 0).toFixed(2)}` : `RM ${(td.earnings || 0).toFixed(2)}`}
                                                                            </span>
                                                                        </button>

                                                                        <div className="flex items-center gap-1.5 border-l border-slate-700/50 pl-1.5 ml-1">
                                                                            <label 
                                                                                className={`flex items-center justify-center p-1 rounded transition-colors ${td.notes?.includes('[HR_APPROVED]') ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'}`}
                                                                                title={td.notes?.includes('[HR_APPROVED]') ? "🔒 已被 HR 锁定 / Locked by HR" : (isTripConfirmed ? "✅ 该 Trip 已确认无误 / Trip Confirmed" : "⬜ 点击打钩确认此 Trip 无误 / Confirm this Trip")}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isTripConfirmed}
                                                                                    onChange={(e) => handleToggleTripConfirmation(td, e.target.checked)}
                                                                                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:cursor-not-allowed"
                                                                                    disabled={td.notes?.includes('[HR_APPROVED]')}
                                                                                />
                                                                            </label>
                                                                            {isAdminOrHR && (
                                                                                <label 
                                                                                    className={`flex items-center justify-center px-1.5 py-0.5 border text-[9px] font-bold uppercase rounded cursor-pointer transition-all ${td.notes?.includes('[HR_APPROVED]') ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                                                                                    title={td.notes?.includes('[HR_APPROVED]') ? "HR 已批准此 Trip (锁定) / HR Approved (Locked)" : "点击由 HR 批准此 Trip / Click to HR Approve"}
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={td.notes?.includes('[HR_APPROVED]') || false}
                                                                                        onChange={(e) => handleToggleHRApproveTrip(td, e.target.checked)}
                                                                                        className="w-3 h-3 accent-indigo-500 rounded cursor-pointer mr-1"
                                                                                    />
                                                                                    HR
                                                                                </label>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : <span className="text-gray-700 font-mono">—</span>}
                                                </td>
                                            ) : (
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {day.machinesOperated.length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-1">
                                                                {day.machinesOperated.map(m => (
                                                                    <span key={m} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono shadow-sm">{m}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            {day.rejectQty > 0 && (
                                                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold border border-amber-500/20">
                                                                    {day.rejectQty} Defect
                                                                </span>
                                                            )}
                                                            {day.alarmCount > 0 && (
                                                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px] font-bold border border-red-500/20">
                                                                    {day.alarmCount} Amaran
                                                                </span>
                                                            )}
                                                            {day.approvedClaims > 0 && (
                                                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 text-[9px] font-bold border border-teal-500/20">
                                                                    +RM{day.approvedClaims.toFixed(2)} Claim
                                                                </span>
                                                            )}
                                                        </div>
                                                        {day.machinesOperated.length === 0 && day.alarmCount === 0 && day.rejectQty === 0 && day.approvedClaims === 0 && (
                                                            <span className="text-gray-700 font-mono">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                {day.photoCount > 0 ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        {day.photos.slice(0, 3).map((photo, idx) => (
                                                            <img 
                                                                key={idx}
                                                                src={photo.photo_url} 
                                                                alt={photo.category || "Work photo"}
                                                                onClick={() => setSelectedPhotoDay(day)}
                                                                className="w-8 h-8 rounded-lg border border-white/10 hover:border-violet-500 hover:scale-110 object-cover cursor-pointer transition-all shadow"
                                                            />
                                                        ))}
                                                        {day.photoCount > 3 && (
                                                            <button 
                                                                onClick={() => setSelectedPhotoDay(day)}
                                                                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-violet-500 hover:bg-white/10 flex items-center justify-center text-[10px] font-black text-violet-400 transition-all cursor-pointer"
                                                            >
                                                                +{day.photoCount - 3}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-700">—</span>
                                                )}
                                            </td>
                                            {isAdminOrHR && (
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {hasDayPending ? (
                                                            <button
                                                                onClick={() => {
                                                                    const pTrip = day.tripDetails.find((t: any) => isTripPending(t));
                                                                    if (pTrip) setSelectedTrip(pTrip);
                                                                }}
                                                                className="text-[10px] bg-amber-500 hover:bg-amber-400 text-black font-black px-2.5 py-1 rounded-lg shadow-md shadow-amber-500/20 flex items-center gap-1 transition-all active:scale-95 animate-pulse cursor-pointer"
                                                            >
                                                                <Clock size={11} className="animate-spin" />
                                                                <span>审核 / Review</span>
                                                            </button>
                                                        ) : day.hasAttendance ? (
                                                            <button 
                                                                onClick={() => setSelectedAttendanceDay(day)}
                                                                className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 px-2 py-1 rounded font-bold transition-colors cursor-pointer"
                                                            >
                                                                ✏️ Sunting / Edit
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => setSelectedAttendanceDay(day)}
                                                                className="text-[10px] bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 px-2 py-1 rounded font-bold transition-colors cursor-pointer"
                                                            >
                                                                ➕ Log
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ); })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-900/90 border-t-2 border-slate-800">
                                        <td colSpan={isAdminOrHR ? 6 : 5} className="px-5 py-4">
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                                                        <CheckSquare size={22} />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                                            司机 Trip 逐项打钩确认 / Driver Per-Trip Confirmation
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                                            每个 Trip 按钮后方均有独立打钩框。出车无误请逐个打钩；如有数据问题请点击 Trip 按钮提交预修改（需 Admin 审核生效）。
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 shadow-md">
                                                        已确认: <span className="text-emerald-400 font-mono text-sm font-black">{confirmedTripIds.size}</span> 个 Trip
                                                    </div>
                                                    <label className="flex items-center gap-3 bg-slate-950 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-xl cursor-pointer transition-all shrink-0 shadow-md">
                                                        <input
                                                            type="checkbox"
                                                            checked={isMonthlyConfirmed}
                                                            onChange={e => handleToggleMonthlyConfirmation(e.target.checked)}
                                                            className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                                                        />
                                                        <span className={`text-xs font-black font-mono ${isMonthlyConfirmed ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                            {isMonthlyConfirmed ? '✅ 全月确认 / Confirmed' : '⬜ 全月打钩'}
                                                        </span>
                                                    </label>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CREATE / EDIT TRIP MODAL (1:1 COPIED FROM TRIP MANAGEMENT) --- */}
            {selectedTrip && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-3 lg:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-950 border-0 sm:border border-slate-800 rounded-none sm:rounded-2xl w-full max-w-6xl h-full sm:h-[min(96vh,920px)] overflow-hidden flex flex-col shadow-2xl shadow-black">
                        {/* Modal Header */}
                        <div className="py-3 px-4 sm:px-6 border-b border-slate-800 flex justify-between items-center gap-3 bg-slate-900/50">
                            <div className="min-w-0 flex-1 flex items-center gap-3">
                                <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                                    <FileText className="text-blue-400" size={18} />
                                    Edit Trip: {selectedTrip.order_number || 'DO'}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setSelectedTrip(null); setIsEditingTrip(false); }}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar bg-slate-950 min-h-0">

                            {/* Trip Price Breakdown Banner */}
                            <div className="mb-6 p-4 bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                                <div className="flex items-center gap-3 text-slate-300 font-bold text-xs">
                                    <DollarSign size={20} className="text-emerald-400 shrink-0" />
                                    <div>
                                        <div className="text-sm font-black text-white flex items-center gap-2">
                                            Trip 运费独立明细 / Price Breakdown
                                        </div>
                                        <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                                            基本运费 Base: <span className="font-mono text-emerald-400 font-bold">RM {(selectedTrip.baseRate || selectedTrip.earnings || 0).toFixed(2)}</span>
                                            {(selectedTrip.extraRate || 0) > 0 && (
                                                <span className="ml-2">
                                                    + Extra Drop 津贴 ({selectedTrip.trip_drop_count || 1} Drops): <span className="font-mono text-amber-400 font-bold">RM {selectedTrip.extraRate.toFixed(2)}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-2 shrink-0 border px-3.5 py-2 rounded-xl font-mono text-sm font-black ${
                                    (selectedTrip.status === 'Pending Approval' || selectedTrip.status === 'Pending' || selectedTrip.edit_status === 'Pending')
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                }`}>
                                    本 Trip 合计: {(selectedTrip.status === 'Pending Approval' || selectedTrip.status === 'Pending' || selectedTrip.edit_status === 'Pending') ? '⏳ 待审核' : ''} RM {(selectedTrip.earnings || 0).toFixed(2)}
                                </div>
                            </div>

                            {/* Extra Job Pending Approval Banner */}
                            {(selectedTrip.job_type === 'Extra Job' || selectedTrip.order_number?.startsWith('TRIP-JOB') || selectedTrip.order_number?.startsWith('TRIP-PU') || (selectedTrip.notes && selectedTrip.notes.startsWith('[') && (!selectedTrip.items || selectedTrip.items.length === 0))) && selectedTrip.status !== 'Delivered' && selectedTrip.status !== 'Cancelled' && (
                                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col gap-3 shadow-lg">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 text-amber-400 font-bold text-xs">
                                            <Clock size={18} className="animate-spin text-amber-400" />
                                            <div>
                                                <div className="text-sm font-black text-amber-300">⏳ 额外任务待审核 / Pending Extra Job Approval</div>
                                                <div className="text-[11px] text-amber-400/80 font-normal mt-0.5">
                                                    司机已上传完成证据（照片与GPS），等待 Admin/Manager 审核确认金额并计入普通薪资。
                                                </div>
                                            </div>
                                        </div>
                                        {isAdminOrHR ? (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const defaultVal = (selectedTrip.earnings || 10).toString();
                                                        const amountStr = window.prompt("确认批准此额外任务金额 (RM) / Confirm approved salary (RM):", defaultVal);
                                                        if (amountStr === null) return;
                                                        const val = parseFloat(amountStr) || 0;
                                                        
                                                        let updatedNotes = selectedTrip.notes || '';
                                                        if (val > 0) {
                                                            updatedNotes = updatedNotes.replace(/\[APPROVED_AMOUNT:\s*[\d.]+\]/gi, '').trim();
                                                            updatedNotes = `${updatedNotes}\n[APPROVED_AMOUNT: ${val.toFixed(2)}]`.trim();
                                                        }

                                                        const { error } = await supabase.from('sales_orders').update({
                                                            status: 'Delivered',
                                                            notes: updatedNotes
                                                        }).eq('id', selectedTrip.id);

                                                        if (error) {
                                                            alert("Approval failed: " + error.message);
                                                        } else {
                                                            alert(`✅ 额外任务已批准！RM ${val.toFixed(2)} 已直接计入当月普通薪水。`);
                                                            setSelectedTrip(null);
                                                            fetchData();
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                                                >
                                                    ✅ 批准并计入薪资 / Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const reason = window.prompt("驳回原因 / Rejection reason:", "Gambar tidak jelas / 不符合要求");
                                                        if (reason === null) return;
                                                        const updatedNotes = `${selectedTrip.notes || ''}\n[REJECTED: ${reason}]`.trim();
                                                        const { error } = await supabase.from('sales_orders').update({
                                                            status: 'Cancelled',
                                                            notes: updatedNotes
                                                        }).eq('id', selectedTrip.id);

                                                        if (error) {
                                                            alert("Reject failed: " + error.message);
                                                        } else {
                                                            alert("❌ 额外任务已驳回 / Extra job rejected.");
                                                            setSelectedTrip(null);
                                                            fetchData();
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                                                >
                                                    ❌ 驳回 / Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-amber-300 font-mono bg-amber-950/80 border border-amber-500/30 px-3 py-1.5 rounded-xl font-bold">
                                                等待 Admin 审核
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Regular Order Quantity Amendment Pending Approval Banner */}
                            {selectedTrip.status === 'Pending Approval' && !(selectedTrip.job_type === 'Extra Job' || selectedTrip.order_number?.startsWith('TRIP-JOB') || selectedTrip.order_number?.startsWith('TRIP-PU') || (selectedTrip.notes && selectedTrip.notes.startsWith('[') && (!selectedTrip.items || selectedTrip.items.length === 0))) && !selectedTrip.notes?.includes('[PENDING_EDIT_PAYLOAD]') && (
                                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col gap-3 shadow-lg">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 text-amber-400 font-bold text-xs">
                                            <Clock size={18} className="animate-spin text-amber-400" />
                                            <div>
                                                <div className="text-sm font-black text-amber-300">⚡ 司机改量待审核 / Quantity Amendment Pending Approval</div>
                                                <div className="text-[11px] text-amber-400/80 font-normal mt-0.5">
                                                    司机在送货/装车时调整了货物数量，等待 Admin 审核并自动调整库存。
                                                </div>
                                            </div>
                                        </div>
                                        {isAdminOrHR ? (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!window.confirm(`批准 ${selectedTrip.order_number} 的修改？\nApprove changes and mark as Loaded?`)) return;
                                                        const { error } = await supabase.from('sales_orders').update({ status: 'Loaded' }).eq('id', selectedTrip.id);
                                                        if (error) {
                                                            alert("Approval failed: " + error.message);
                                                        } else {
                                                            // ⚡ Deduct stock for approved loaded trip
                                                            await deductStockForOrder({
                                                                id: selectedTrip.id,
                                                                order_number: selectedTrip.order_number,
                                                                trip_origin: selectedTrip.trip_origin,
                                                                items: selectedTrip.items
                                                            });
                                                            alert("✅ 已批准并扣减库存！ / Approved & stock adjusted!");
                                                            setSelectedTrip(null);
                                                            fetchData();
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                                                >
                                                    ✅ 批准并扣减库存 / Approve
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-amber-300 font-mono bg-amber-950/80 border border-amber-500/30 px-3 py-1.5 rounded-xl font-bold">
                                                等待 Admin 审核
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Pending Admin Approval Banner */}
                            {!(selectedTrip.job_type === 'Extra Job' || selectedTrip.order_number?.startsWith('TRIP-JOB') || selectedTrip.order_number?.startsWith('TRIP-PU')) && (selectedTrip.notes?.includes('[PENDING_EDIT_PAYLOAD]') || selectedTrip.notes?.includes('[PENDING EDIT')) && (
                                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col gap-3 shadow-lg">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 text-amber-400 font-bold text-xs">
                                            <Clock size={18} className="animate-spin text-amber-400" />
                                            <div>
                                                <div className="text-sm font-black text-amber-300">⏳ 预修改审核中 / Pending Admin Approval</div>
                                                <div className="text-[11px] text-amber-400/80 font-normal mt-0.5">
                                                    司机已提交预修改申请。在 Admin 审核确定之前，系统保持原有数据不变。
                                                </div>
                                            </div>
                                        </div>
                                        {isAdminOrHR ? (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAdminApproveTrip(true)}
                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                                                >
                                                    ✅ 批准预修改 / Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAdminApproveTrip(false)}
                                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                                                >
                                                    ❌ 拒绝预修改 / Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-amber-300 font-mono bg-amber-950/80 border border-amber-500/30 px-3 py-1.5 rounded-xl font-bold">
                                                等待 Admin 审核
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Show the pending changes clearly */}
                                    {isAdminOrHR && (selectedTrip.notes?.includes('[PENDING_EDIT_PAYLOAD]') || selectedTrip.notes?.includes('[PENDING EDIT')) && (
                                        <div className="mt-2 p-3 bg-amber-950/40 rounded-xl border border-amber-500/20 text-amber-200/90 text-[11px] font-mono leading-relaxed shadow-inner">
                                            <div className="text-amber-400 font-bold mb-2 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                                <span>Proposed Changes (Before ➔ After):</span>
                                            </div>
                                            <div className="pl-2 border-l-2 border-amber-500/30 text-amber-100 flex flex-col gap-1">
                                                {(() => {
                                                    const payloadMatch = selectedTrip.notes?.match(/\[PENDING_EDIT_PAYLOAD\]:\s*(\{.*\})/is);
                                                    if (payloadMatch) {
                                                        try {
                                                            const after = JSON.parse(payloadMatch[1]);
                                                            
                                                            const oldNotes = (selectedTrip.notes || '').replace(/(?:\n\n)?\[PENDING_EDIT_PAYLOAD\]:[\s\S]*$/is, '').replace(/\[PENDING EDIT.*?\]:?[\s\S]*/gi, '').trim() || '(无/empty)';
                                                            const newNotes = (after.notes || '').replace(/(?:\n\n)?\[PENDING_EDIT_PAYLOAD\]:[\s\S]*$/is, '').replace(/\[PENDING EDIT.*?\]:?[\s\S]*/gi, '').trim() || '(无/empty)';
                                                            const oldCustomer = selectedTrip.customer || '(无/empty)';
                                                            const oldAddress = selectedTrip.delivery_address || '(无/empty)';
                                                            const oldDrops = selectedTrip.trip_drop_count || 1;
                                                            const oldZone = selectedTrip.zone || '(无/empty)';
                                                            const oldOrigin = selectedTrip.trip_origin || '(无/empty)';
                                                            
                                                            const hasCustomerChange = after.customer && after.customer !== selectedTrip.customer;
                                                            const hasAddressChange = after.delivery_address && after.delivery_address !== selectedTrip.delivery_address;
                                                            const hasDropChange = after.trip_drop_count !== undefined && after.trip_drop_count !== oldDrops;
                                                            const hasNotesChange = newNotes !== oldNotes;
                                                            const hasZoneChange = after.zone && after.zone !== selectedTrip.zone;
                                                            const hasOriginChange = after.trip_origin && after.trip_origin !== selectedTrip.trip_origin;

                                                            if (!hasCustomerChange && !hasAddressChange && !hasDropChange && !hasNotesChange && !hasZoneChange && !hasOriginChange) {
                                                                return (
                                                                    <div className="mt-1 text-[11px] text-amber-500/70 italic">
                                                                        (未检测到任何实质修改 / No actual changes detected)
                                                                    </div>
                                                                );
                                                            }
                                                            
                                                            return (
                                                                <div className="flex flex-col gap-2 mt-1">
                                                                    {hasOriginChange && (
                                                                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                                                                            <span className="text-gray-400 w-28 shrink-0 font-bold uppercase text-[9px]">起点 / Origin:</span> 
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className="line-through opacity-60 text-red-300 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-500/20">{oldOrigin}</span> 
                                                                                <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20">➔ {after.trip_origin}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {hasZoneChange && (
                                                                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                                                                            <span className="text-gray-400 w-28 shrink-0 font-bold uppercase text-[9px]">类别 / Category:</span> 
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className="line-through opacity-60 text-red-300 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-500/20">{oldZone}</span> 
                                                                                <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20">➔ {after.zone}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {hasCustomerChange && (
                                                                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                                                                            <span className="text-gray-400 w-28 shrink-0 font-bold uppercase text-[9px]">客户 / Client:</span> 
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className="line-through opacity-60 text-red-300 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-500/20">{oldCustomer}</span> 
                                                                                <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20">➔ {after.customer}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {hasAddressChange && (
                                                                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                                                                            <span className="text-gray-400 w-28 shrink-0 font-bold uppercase text-[9px]">目的地 / Dest:</span> 
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className="line-through opacity-60 text-red-300 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-500/20">{oldAddress}</span> 
                                                                                <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20">➔ {after.delivery_address}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {hasDropChange && (
                                                                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                                                                            <span className="text-gray-400 w-28 shrink-0 font-bold uppercase text-[9px]">卸货点 / Drops:</span> 
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className="line-through opacity-60 text-red-300 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-500/20">{oldDrops}</span> 
                                                                                <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20">➔ {after.trip_drop_count}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {hasNotesChange && (
                                                                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                                                                            <span className="text-gray-400 w-28 shrink-0 font-bold uppercase text-[9px]">备注 / Notes:</span> 
                                                                            <div className="flex flex-col gap-1 w-full max-w-sm">
                                                                                <span className="line-through opacity-60 text-red-300 bg-red-950/30 px-2 py-1 rounded border border-red-500/20 block">{oldNotes}</span> 
                                                                                <span className="text-emerald-400 font-bold bg-emerald-950/30 px-2 py-1 rounded border border-emerald-500/20 block">➔ {newNotes}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        } catch (e) {
                                                            return <div>Error parsing payload</div>;
                                                        }
                                                    }
                                                    // Fallback for older format
                                                    return <div className="whitespace-pre-wrap">{selectedTrip.notes.match(/(?:\[PENDING EDIT.*?\]:?)\s*([\s\S]*)/i)?.[1] || "No details provided"}</div>;
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                                <div className="space-y-6">

                                    {/* Section 1: Basic Info */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Lorry</label>
                                                <div className="relative">
                                                    <Truck className="absolute left-3 top-3.5 text-slate-600 z-10" size={16} />
                                                    <select
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                                        value={selectedLorryId}
                                                        onChange={(e) => {
                                                            const lorryId = e.target.value;
                                                            setSelectedLorryId(lorryId);
                                                            const l = lorries.find(x => x.id === lorryId);
                                                            if (l && l.driverUserId && !selectedDriverId) {
                                                                setSelectedDriverId(l.driverUserId);
                                                            }
                                                        }}
                                                        disabled={!isAdminOrHR}
                                                    >
                                                        <option value="">-- Select Lorry --</option>
                                                        {lorries.map(l => (
                                                            <option key={l.id} value={l.id}>
                                                                {l.plateNumber || l.plate_number} {l.driverName ? `(${l.driverName})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Driver</label>
                                                <div className="relative">
                                                    <UserIcon className="absolute left-3 top-3.5 text-slate-600 z-10" size={16} />
                                                    <select
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                                        value={selectedDriverId}
                                                        onChange={(e) => {
                                                            const driverId = e.target.value;
                                                            setSelectedDriverId(driverId);
                                                            const l = lorries.find(x => x.driverUserId === driverId);
                                                            if (l && !selectedLorryId) {
                                                                setSelectedLorryId(l.id);
                                                            }
                                                        }}
                                                        disabled={!isAdminOrHR}
                                                    >
                                                        <option value="">-- Select Driver --</option>
                                                        {employeesList.map(d => (
                                                            <option key={d.uid || d.id} value={d.uid || d.id}>
                                                                {d.name || d.employee_id}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
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
                                                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 focus:border-blue-500/30 outline-none appearance-none cursor-pointer [color-scheme:dark] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                                            value={newOrderDate}
                                                            onChange={e => setNewOrderDate(e.target.value)}
                                                            disabled={!isAdminOrHR}
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
                                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:border-blue-500/50 outline-none appearance-none cursor-pointer [color-scheme:dark] transition-all font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                                                            value={newOrderDeliveryDate}
                                                            onChange={e => setNewOrderDeliveryDate(e.target.value)}
                                                            disabled={!isAdminOrHR}
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
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none placeholder:text-slate-600 disabled:opacity-60 disabled:cursor-not-allowed"
                                                placeholder="-- Type or Select Customer (Auto-fills Address & Zone) --"
                                                value={orderCustomer}
                                                onChange={e => setOrderCustomer(e.target.value)}
                                                disabled={!isAdminOrHR}
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
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none placeholder:text-slate-600 mb-4 disabled:opacity-60 disabled:cursor-not-allowed"
                                            value={newOrderAddress}
                                            onChange={e => {
                                                setNewOrderAddress(e.target.value);
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
                                            disabled={!isAdminOrHR}
                                        />

                                        {/* DRIVER PAYROLL RATES: Origin, Category, Drops */}
                                        <div className="grid grid-cols-1 max-lg:gap-3 lg:grid-cols-3 gap-4 bg-slate-900/50 p-4 border border-slate-800 rounded-xl">
                                            <div>
                                                <label className="block text-[10px] font-bold text-blue-500/80 uppercase tracking-widest mb-2">Trip Category / Origin</label>
                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                    {[
                                                        { id: 'TAIPING', label: 'Taiping' },
                                                        { id: 'NILAI', label: 'Nilai' },
                                                        { id: 'KELANTAN', label: 'Kelantan' },
                                                        { id: 'JOHOR', label: 'Johor' }
                                                    ].map(loc => (
                                                        <button
                                                            type="button"
                                                            key={loc.id}
                                                            onClick={() => {
                                                                setTripOrigin(loc.id);
                                                                setCurrentItemLoc(getDefaultLocForOrigin(loc.id));
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                                tripOrigin.toUpperCase() === loc.id
                                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                                                                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                                                            }`}
                                                        >
                                                            <MapPin size={12} /> {loc.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <select
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none cursor-pointer"
                                                    value={tripOrigin}
                                                    onChange={e => {
                                                        const newOrigin = e.target.value;
                                                        setTripOrigin(newOrigin);
                                                        setCurrentItemLoc(getDefaultLocForOrigin(newOrigin));
                                                    }}
                                                >
                                                    <option value="TAIPING">Taiping</option>
                                                    <option value="NILAI">Nilai</option>
                                                    <option value="KELANTAN">Kelantan</option>
                                                    <option value="JOHOR">Johor</option>
                                                </select>
                                            </div>
                                            <div className="relative">
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
                                                    <div className="absolute mt-1 text-[9px] font-bold text-red-400">?? Unlisted category. Pay will be RM0.</div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest mb-2">Total Drops</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500/50 outline-none font-mono font-bold"
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
                                                rows={3}
                                                placeholder="Enter notes for this trip..."
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-blue-500/50 outline-none placeholder:text-slate-600 resize-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                                                value={newOrderNotes}
                                                disabled={!isAdminOrHR}
                                                onChange={e => setNewOrderNotes(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Driver Proof of Load</label>
                                            {selectedTrip.proof_of_load_url ? (
                                                <a href={selectedTrip.proof_of_load_url} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-700 h-28 bg-black">
                                                    <img src={selectedTrip.proof_of_load_url} alt="Proof of Load" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
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
                                    {(selectedTrip.pod_photo_url || selectedTrip.pod_signature_url || selectedTrip.pod_timestamp) && (
                                        <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-900/30 flex flex-col gap-3">
                                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                                                🚚 Proof of Delivery / POD (Driver Uploads)
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* POD Photos */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Delivery Photos (DO / Goods)</label>
                                                    {selectedTrip.pod_photo_url ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedTrip.pod_photo_url.split(',').map((url: string, idx: number) => (
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
                                                    {selectedTrip.pod_signature_url ? (
                                                        <a href={selectedTrip.pod_signature_url} target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-lg border border-slate-800 hover:border-blue-500 h-20 w-full max-w-[200px] bg-white flex items-center justify-center block transition-all">
                                                            <img src={selectedTrip.pod_signature_url} alt="POD Signature" className="max-h-full object-contain p-1" />
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
                                                    {selectedTrip.pod_timestamp && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Delivered At</span>
                                                            <span className="text-slate-300 font-medium font-mono">{new Date(selectedTrip.pod_timestamp).toLocaleString('en-GB')}</span>
                                                        </div>
                                                    )}
                                                    {selectedTrip.pod_signed_by && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Received By</span>
                                                            <span className="text-slate-300 font-medium font-mono">{selectedTrip.pod_signed_by}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* RIGHT COLUMN */}
                                <div className="flex flex-col min-h-0 lg:min-h-[min(72vh,680px)]">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Box size={16} /> Trip Items
                                    </h3>

                                    {/* Volume & Weight Load Progress Bars */}
                                    {(() => {
                                        const load = calculateLoad(newOrderItems, v2Items);
                                        return (
                                            <div className="space-y-2 mb-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                                                <div>
                                                    <div className="flex justify-between text-[10px] font-mono leading-none mb-1">
                                                        <span className="text-slate-400">Volume Load ({load.totalVol}/{load.maxVol} m³)</span>
                                                        <span className={getPercentColor(Number(load.percentVol))}>
                                                            {load.percentVol}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${getPercentBarColor(Number(load.percentVol))}`}
                                                            style={{ width: `${Math.min(Number(load.percentVol), 100)}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="flex justify-between text-[10px] font-mono leading-none mb-1">
                                                        <span className="text-slate-400">Weight Load ({load.totalWeight}/{load.maxWeight} kg)</span>
                                                        <span className={getPercentColor(Number(load.percentWeight))}>
                                                            {load.percentWeight}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${getPercentBarColor(Number(load.percentWeight))}`}
                                                            style={{ width: `${Math.min(Number(load.percentWeight), 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Item List Layout */}
                                    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg flex flex-col flex-1 min-h-0 overflow-hidden">
                                        {isAdminOrHR && (
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
                                                    options={v2Items.map(item => ({
                                                        value: item.sku,
                                                        label: item.name,
                                                        subLabel: `${item.sku}`,
                                                        searchText: [item.brand, item.description, item.legacy_code].filter(Boolean).join(' ')
                                                    }))}
                                                    value={selectedV2Item?.sku || ''}
                                                    onChange={(val) => {
                                                        const i = v2Items.find(x => x.sku === val);
                                                        setSelectedV2Item(i || null);
                                                    }}
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    <select
                                                        className="min-w-[5rem] bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-slate-300 outline-none focus:border-blue-50 text-xs font-bold uppercase cursor-pointer"
                                                        value={normalizeWarehouseName(currentItemLoc)}
                                                        onChange={e => setCurrentItemLoc(e.target.value)}
                                                    >
                                                        {getAvailableWarehousesForOrigin(tripOrigin).map(loc => (
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
                                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                                                    >
                                                        <Plus size={16} /> Add
                                                    </button>
                                                </div>
                                            </div>
                                        )}
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
                                                                <input
                                                                    type="number"
                                                                    disabled={!isAdminOrHR}
                                                                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-bold text-orange-400 focus:border-orange-500 outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                                    value={item.quantity}
                                                                    onChange={(e) => {
                                                                        const val = Number(e.target.value);
                                                                        const updated = [...newOrderItems];
                                                                        updated[idx].quantity = val;
                                                                        setNewOrderItems(updated);
                                                                    }}
                                                                />
                                                                <button onClick={() => handleRemoveItem(idx)} className="text-slate-600 hover:text-red-500 p-1 rounded-full hover:bg-slate-900 transition-colors cursor-pointer">
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-2 mt-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-[10px] font-bold text-slate-600 uppercase w-16">Pickup:</div>
                                                                <select
                                                                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-blue-400 font-bold focus:border-blue-500 outline-none cursor-pointer"
                                                                    value={normalizeWarehouseName(item.sourceLocation || getDefaultLocForOrigin(tripOrigin))}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const updated = [...newOrderItems];
                                                                        updated[idx].sourceLocation = val;
                                                                        setNewOrderItems(updated);
                                                                    }}
                                                                >
                                                                    {getAvailableWarehousesForOrigin(tripOrigin).map(loc => <option key={loc} value={loc}>{loc}</option>)}
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
                        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 shrink-0">
                            <button onClick={() => { setSelectedTrip(null); setIsEditingTrip(false); }} className="px-6 py-2 rounded-xl text-slate-400 hover:text-white font-bold transition-colors cursor-pointer">Cancel</button>
                            <button
                                onClick={handleSaveTrip}
                                disabled={newOrderNotes.includes('[HR_APPROVED]')}
                                className="px-8 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-bold shadow-lg shadow-orange-950/30 transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                            >
                                {newOrderNotes.includes('[HR_APPROVED]') ? '🔒 Locked by HR' : (isAdminOrHR ? '💾 保存修改 / Save Changes' : '💾 提交预修改申请 / Submit Pre-Edit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Viewer Modal / Paparan Gambar Rekod Kerja */}
            {selectedPhotoDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#09090b] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-black relative overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 bg-slate-900/50 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                    <Camera size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        Gambar Kerja / Work Photos
                                    </h2>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
                                        {new Date(selectedPhotoDay.dateStr.replace(/-/g, '/')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedPhotoDay(null)}
                                className="p-2 -mr-2 -mt-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-950 flex flex-col items-center">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                {selectedPhotoDay.photos.map((photo: any, idx: number) => (
                                    <div key={idx} className="bg-[#0d0d12] border border-white/5 rounded-xl p-3 flex flex-col gap-3 group hover:border-violet-500/30 transition-all">
                                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center border border-white/5">
                                            <img 
                                                src={photo.photo_url} 
                                                alt={photo.category || "Work log photo"} 
                                                className="max-w-full max-h-full object-contain"
                                            />
                                            {photo.risk_flag && (
                                                <span className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase rounded shadow flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle size={8} /> RISK / RISIKO
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-start text-xs">
                                            <div>
                                                <div className="font-bold text-gray-200 uppercase text-[10px] tracking-wider bg-white/5 px-2 py-0.5 rounded w-fit">
                                                    {photo.category || 'Tugasan / Job Log'}
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-1">
                                                    {new Date(photo.created_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </div>
                                            </div>
                                            <a 
                                                href={photo.photo_url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="text-[10px] text-violet-400 hover:underline font-bold uppercase tracking-wider"
                                            >
                                                Papar Penuh / Open ↗
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Edit Modal / Paparan Sunting/Tambah Kehadiran */}
            {selectedAttendanceDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#09090b] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl shadow-black relative overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 bg-slate-900/50 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white">
                                        {selectedAttendanceDay.hasAttendance ? 'Sunting Kehadiran / Edit Attendance' : 'Tambah Kehadiran / Add Attendance'}
                                    </h2>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
                                        Pekerja / Employee: {viewedProfile?.name || viewedProfile?.employee_id}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedAttendanceDay(null)}
                                className="p-2 -mr-2 -mt-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4 bg-slate-950">
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                    Tarikh / Date
                                </label>
                                <div className="text-sm font-bold text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono">
                                    {new Date(selectedAttendanceDay.dateStr.replace(/-/g, '/')).toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                        Masa Masuk / Clock In
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={editClockIn}
                                        onChange={(e) => setEditClockIn(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                        Masa Keluar / Clock Out
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={editClockOut}
                                        onChange={(e) => setEditClockOut(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                    Nota / Attendance Notes
                                </label>
                                <textarea
                                    value={editAttendanceNotes}
                                    onChange={(e) => setEditAttendanceNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Auto-Logout, Overtime remarks, etc."
                                />
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-white/5">
                                {selectedAttendanceDay.hasAttendance ? (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAttendance}
                                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/25 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        Padam / Delete
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                                
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedAttendanceDay(null)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                                    >
                                        Batal / Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAttendance}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer"
                                    >
                                        Simpan / Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payroll Breakdown Modal / Paparan Perincian Gaji & Claims */}
            {showPayrollModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#09090b] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl shadow-black relative overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 bg-slate-900/50 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white">
                                        Perincian Gaji & Claims / Payroll & Claims Breakdown
                                    </h2>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
                                        Bulan / Month: {selectedMonth}/{selectedYear} • {viewedProfile?.name || viewedProfile?.employee_id}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowPayrollModal(false)}
                                className="p-2 -mr-2 -mt-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4 bg-slate-950 font-sans text-sm">
                            <div className="bg-[#0d0d12] border border-white/5 p-4 rounded-xl space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Gaji Asas / Basic Salary</span>
                                    <span className="font-mono font-bold text-white">
                                        RM {payroll?.basic_salary ? Number(payroll.basic_salary).toFixed(2) : (payroll?.base_salary ? Number(payroll.base_salary).toFixed(2) : '0.00')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Elaun / Allowances & Overtime</span>
                                    <span className="font-mono font-bold text-emerald-400">
                                        + RM {payroll?.ot_pay ? (Number(payroll.ot_pay) + Number(payroll.allowances || 0)).toFixed(2) : (payroll?.allowances ? Number(payroll.allowances).toFixed(2) : '0.00')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Tuntutan / Approved Claims</span>
                                    <span className="font-mono font-bold text-teal-400">
                                        + RM {totalClaimsAmount.toFixed(2)}
                                    </span>
                                </div>
                                {payroll && (payroll.epf || payroll.socso || payroll.deductions) && (
                                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
                                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Potongan / Deductions (EPF/SOCSO/PCB)</span>
                                        <span className="font-mono font-bold text-rose-400">
                                            - RM {(Number(payroll.epf || 0) + Number(payroll.socso || 0) + Number(payroll.deductions || 0)).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-green-950/20 border border-green-500/30 p-4 rounded-xl flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] text-green-400 uppercase font-black tracking-widest">Jumlah Bersih / Net Earnings</div>
                                    <div className="text-xs text-gray-400">Termasuk Gaji & Claims Disahkan</div>
                                </div>
                                <div className="text-xl font-black text-green-300 font-mono">
                                    RM {(Number(payroll?.net_salary || 0) + totalClaimsAmount).toFixed(2)}
                                </div>
                            </div>

                            {claims.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Senarai Claims Disahkan ({claims.length})</div>
                                    <div className="max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                        {claims.map((c, cidx) => (
                                            <div key={cidx} className="flex justify-between items-center bg-white/5 p-2 rounded-lg text-xs">
                                                <div>
                                                    <div className="font-bold text-white">{c.type || c.category || 'Claim'}</div>
                                                    <div className="text-[9px] text-gray-500">{c.date || c.timestamp?.split('T')[0] || '-'} {c.description ? `• ${c.description}` : ''}</div>
                                                </div>
                                                <div className="font-mono font-bold text-teal-300">RM {Number(c.amount).toFixed(2)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => setShowPayrollModal(false)}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
                                >
                                    Tutup / Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINTABLE BATCH / SINGLE DRIVER REPORTS PORTAL (DIRECTLY ATTACHED TO BODY TO BYPASS LAYOUT OVERFLOW) */}
            {batchPrintData.length > 0 && createPortal(
                <div className="hidden print:block driver-print-wrapper">
                    <style>{`
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 10mm 12mm;
                            }
                            html, body {
                                height: auto !important;
                                overflow: visible !important;
                                background: white !important;
                                color: black !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                            body > *:not(.driver-print-wrapper) {
                                display: none !important;
                            }
                            .driver-print-wrapper {
                                display: block !important;
                                position: absolute !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100% !important;
                                height: auto !important;
                                overflow: visible !important;
                                background: white !important;
                                color: black !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            .driver-print-sheet {
                                display: block !important;
                                page-break-before: always !important;
                                break-before: page !important;
                                page-break-after: always !important;
                                break-after: page !important;
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                                padding: 10mm 12mm !important;
                                margin: 0 !important;
                                background: white !important;
                                color: black !important;
                                box-sizing: border-box !important;
                                width: 100% !important;
                            }
                            .driver-print-sheet:first-child {
                                page-break-before: auto !important;
                                break-before: auto !important;
                            }
                            .driver-print-sheet:last-child {
                                page-break-after: auto !important;
                                break-after: auto !important;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-top: 10px;
                                margin-bottom: 12px;
                            }
                            th, td {
                                border: 1px solid #333;
                                padding: 5px 8px;
                                font-size: 10px;
                                text-align: left;
                            }
                            th {
                                background-color: #f0f0f0 !important;
                                font-weight: bold;
                                -webkit-print-color-adjust: exact;
                            }
                        }
                    `}</style>

                    {batchPrintData.map((report, idx) => (
                        <div key={idx} className="driver-print-sheet">
                            {/* Header */}
                            <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
                                <div>
                                    <h1 className="text-xl font-bold uppercase tracking-wider text-black">PACKSECURE OS</h1>
                                    <h2 className="text-xs font-semibold text-gray-700 uppercase">Laporan Elaun Trip Pemandu Bulanan</h2>
                                    <p className="text-[10px] text-gray-600">Monthly Driver Trip Allowance Report</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold uppercase">Bulan / Month: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
                                    <p className="text-[10px] text-gray-500">Tarikh Cetak: {new Date().toLocaleDateString('en-GB')}</p>
                                </div>
                            </div>

                            {/* Driver Information Bar */}
                            <div className="grid grid-cols-4 gap-3 p-2 bg-gray-100 border border-gray-300 rounded mb-3 text-xs">
                                <div>
                                    <span className="text-gray-500 block text-[9px] uppercase font-bold">Nama Pemandu / Driver</span>
                                    <span className="font-bold text-xs text-black">{report.driverName}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-[9px] uppercase font-bold">No. Pekerja / ID</span>
                                    <span className="font-bold text-xs text-black">{report.employeeId}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-[9px] uppercase font-bold">No. Lorry / Vehicle</span>
                                    <span className="font-bold text-xs text-black">{report.plateNumber}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-[9px] uppercase font-bold">Pusat / Base Location</span>
                                    <span className="font-bold text-xs text-black">{report.baseLocation}</span>
                                </div>
                            </div>

                            {/* Summary Metrics */}
                            <div className="flex justify-between items-center mb-3 p-2 border-2 border-black bg-gray-50">
                                <div>
                                    <span className="text-xs font-bold uppercase text-gray-700">Jumlah Perjalanan / Total Trips: </span>
                                    <span className="text-sm font-extrabold text-black ml-2">{report.totalTrips} Trips</span>
                                </div>
                                <div>
                                    <span className="text-xs font-bold uppercase text-gray-700">Jumlah Elaun Trip / Total Earnings: </span>
                                    <span className="text-base font-extrabold text-black ml-2">RM {report.totalEarnings.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Trips Table */}
                            {report.tripRows.length === 0 ? (
                                <div className="p-6 text-center border border-dashed border-gray-400 text-gray-500 text-xs italic">
                                    Tiada rekod perjalanan hantaran untuk bulan ini. / No trip records found for this month.
                                </div>
                            ) : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '5%' }}>Bil</th>
                                            <th style={{ width: '12%' }}>Tarikh / Date</th>
                                            <th style={{ width: '18%' }}>No. DO / Order</th>
                                            <th style={{ width: '22%' }}>Pelanggan / Customer</th>
                                            <th style={{ width: '25%' }}>Laluan / Route</th>
                                            <th style={{ width: '8%', textAlign: 'center' }}>Drops</th>
                                            <th style={{ width: '10%', textAlign: 'right' }}>Elaun (RM)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.tripRows.map((row: any, rIdx: number) => (
                                            <tr key={rIdx}>
                                                <td>{rIdx + 1}</td>
                                                <td>{row.date}</td>
                                                <td className="font-mono font-bold">{row.orderNumber}</td>
                                                <td>{row.customer}</td>
                                                <td>{row.origin} ➞ {row.destination}</td>
                                                <td style={{ textAlign: 'center' }}>{row.drops}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                    {row.earnings > 0 ? row.earnings.toFixed(2) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
                                            <td colSpan={6} style={{ textAlign: 'right' }}>JUMLAH ELAUN / TOTAL ALLOWANCE (RM):</td>
                                            <td style={{ textAlign: 'right', fontSize: '11px' }}>RM {report.totalEarnings.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}

                            {/* Signatures Footer */}
                            <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t border-gray-300 text-xs">
                                <div>
                                    <p className="font-bold mb-8 text-[11px]">Tandatangan Pemandu / Driver Signature:</p>
                                    <div className="border-t border-black pt-1 w-3/4">
                                        <p className="font-semibold">{report.driverName}</p>
                                        <p className="text-[9px] text-gray-500">Tarikh / Date: ___________________</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="font-bold mb-8 text-[11px]">Pengesahan HR / Pengurus (HR / Manager Approval):</p>
                                    <div className="border-t border-black pt-1 w-3/4">
                                        <p className="font-semibold">Nama & Jawatan / Name & Stamp</p>
                                        <p className="text-[9px] text-gray-500">Tarikh / Date: ___________________</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default PersonalMonthlyReport;
