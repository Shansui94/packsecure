import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { determineState, findBestFactory, calculateLoad } from '../utils/logistics';
import { generateDraftTrips, generateDraftTripsWithDrivers, DraftTrip } from '../utils/autoRouting';
import {
    generateBalancedDriverAssignments,
    loadDispatchRules,
    saveDispatchRules,
    resetDispatchRules,
    validateManualDriverAssignment,
    isShortDistanceTrip,
    DispatchRuleConfig,
    DriverStats,
    BalancedTripDraft
} from '../utils/driverBalanceDispatch';
import { parsePrepPhotos } from '../utils/prepPhotos';
import {
    Plus, Search, Calendar, FileText, X, Truck, Package,
    User as UserIcon, Box, Zap, Trash2, Scissors, AlertTriangle, MapPin, Wrench, LayoutGrid, List, ArrowUp, ArrowDown,
    CheckCircle, XCircle, Camera, Sparkles, ImagePlus, Download,
    RotateCcw, RefreshCw, Settings, ShieldCheck, Clock, Award, TrendingUp, Info,
    ChevronDown, ChevronUp, Edit3, Phone, MessageSquare
} from 'lucide-react';
import WhatsAppDispatchModal from '../components/WhatsAppDispatchModal';
import { WAREHOUSES } from '../data/factoryData';
import {
    SalesOrder,
    User,
    Lorry,
    ParsedTripDOBatch,
    ParsedDeliveryOrder
} from '../types';
import { V2Item } from '../types/v2';
import { compressImage, dataUrlToBase64Payload, dataURLtoBlob } from '../utils/imageCompress';
import * as XLSX from 'xlsx';
import { useTranslation } from "react-i18next";
import { deductStockForOrder, reverseStockForOrder, adjustStockForOrderDelta } from '../services/stockService';
import { logActivity } from '../utils/logger';

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

const normalizeWarehouseName = (loc: string): string => {
    if (!loc) return 'OPM Lama';
    const lower = loc.trim().toLowerCase();
    if (lower === 'johor' || lower === 'j1') return 'Johor';
    if (lower === 'kelantan' || lower === 'k1') return 'Kelantan';
    if (lower === 'nilai' || lower === 'n1') return 'Nilai';
    if (lower === 'spd') return 'SPD';
    if (lower === 'opm lama' || lower === 'opm_lama' || lower === 'taiping' || lower === 't1') return 'OPM Lama';
    if (lower === 'opm corner' || lower === 'opm_corner') return 'OPM Corner';
    if (lower === 'opm ali' || lower === 'opm_ali') return 'OPM Ali';
    return loc;
};

const normalizeLoc = (locId: string): string => {
    return normalizeWarehouseName(locId);
};

const getDefaultLocForOrigin = (origin: string): string => {
    const u = (origin || '').toUpperCase().trim();
    if (u === 'NILAI' || u === 'N1') return 'Nilai';
    if (u === 'KELANTAN' || u === 'K1') return 'Kelantan';
    if (u === 'JOHOR' || u === 'J1') return 'Johor';
    if (u === 'TAIPING' || u === 'T1' || u === 'SPD' || u === 'OPM') return 'OPM Lama';
    return normalizeWarehouseName(origin);
};

const getVehicleRollCapacity = (plateNumber?: string): number => {
    const cleanPlate = (plateNumber || '').toLowerCase().replace(/\s+/g, '');
    if (cleanPlate === 'vpc9821') return 65;
    if (cleanPlate === 'aph9821') return 92;
    return 82;
};

export const guessItemLocation = (item: { sku?: string; product?: string; rawProductName?: string }, origin: string): string => {
    const orig = (origin || '').toUpperCase().trim();
    if (orig === 'NILAI' || orig === 'N1') return 'Nilai';
    if (orig === 'KELANTAN' || orig === 'K1') return 'Kelantan';
    if (orig === 'JOHOR' || orig === 'J1') return 'Johor';

    // Taiping Factory Hub:
    const sku = (item.sku || '').toUpperCase();
    const prod = (item.product || item.rawProductName || '').toUpperCase();

    // 1. Bubble Wrap -> OPM Lama (T1/T2/T3 main lines and storage)
    if (sku.startsWith('BW-') || prod.includes('BUBBLE') || prod.includes('MERAH') || prod.includes('DL-') || prod.includes('SL-') || prod.includes('OREN') || prod.includes('HITAM') || prod.includes('SILVER')) {
        return 'OPM Lama';
    }

    // 2. Stretch Film -> OPM Lama (T1/T4 stretch film lines and storage)
    if (sku.startsWith('SF-') || prod.includes('STRETCH') || prod.includes('FILM') || prod.includes('BABY ROLL') || prod.includes('BABYROLL')) {
        return 'OPM Lama';
    }

    // 3. Tapes / Air tube / Converted products -> OPM Corner or SPD
    if (sku.includes('TAPE') || sku.includes('CUKUPP') || prod.includes('TAPE') || sku.includes('AWB') || prod.includes('AWB') || sku.includes('AIRTUBE') || prod.includes('AIRTUBE')) {
        return 'OPM Corner';
    }

    // Default for Taiping is OPM Lama
    return 'OPM Lama';
};

const normalizeLocationCode = (loc?: string | null): string => {
    if (!loc) return 'Taiping';
    const l = loc.trim().toUpperCase();
    if (l.includes('TAIPING') || l === 'T1' || l === 'SPD' || l.includes('OPM')) return 'Taiping';
    if (l.includes('NILAI') || l === 'N1') return 'Nilai';
    if (l.includes('JOHOR') || l === 'J1') return 'Johor';
    if (l.includes('KELANTAN') || l === 'K1') return 'Kelantan';
    return loc.trim();
};

const getAvailableWarehousesForOrigin = (origin: string): string[] => {
    const u = (origin || '').toUpperCase().trim();
    if (u === 'NILAI') return ['Nilai'];
    if (u === 'KELANTAN') return ['Kelantan'];
    if (u === 'JOHOR') return ['Johor'];
    if (u === 'TAIPING' || u === 'SPD' || u === 'T1') {
        return ['OPM Lama', 'OPM Corner', 'OPM Ali', 'SPD'];
    }
    return ['OPM Lama', 'OPM Corner', 'OPM Ali', 'SPD'];
};


const getPercentColor = (percent: number): string => {
    if (percent < 70) {
        return 'text-red-400 font-bold';
    } else if (percent >= 70 && percent < 90) {
        return 'text-amber-400 font-bold';
    } else if (percent >= 90 && percent <= 100) {
        return 'text-emerald-400 font-bold';
    } else {
        return 'text-red-400 font-black';
    }
};

const getPercentBarColor = (percent: number): string => {
    if (percent < 70) {
        return 'bg-red-500 shadow-md shadow-red-500/20';
    } else if (percent >= 70 && percent < 90) {
        return 'bg-amber-500';
    } else if (percent >= 90 && percent <= 100) {
        return 'bg-emerald-500 shadow-md shadow-emerald-500/30';
    } else {
        return 'bg-red-500 shadow-md shadow-red-500/30';
    }
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
    const { t } = useTranslation();
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

interface DeliveryOrderManagementProps {
    user?: User | null;
}

const DeliveryOrderManagement: React.FC<DeliveryOrderManagementProps> = ({ user }) => {
    const { t } = useTranslation();
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

    // Dispatch Planner & Balanced Driver States
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [autoDispatchDrafts, setAutoDispatchDrafts] = useState<BalancedTripDraft[] | null>(null);
    const [isAutoDispatchModalOpen, setIsAutoDispatchModalOpen] = useState(false);
    const [dispatchDriverStats, setDispatchDriverStats] = useState<Record<string, DriverStats>>({});
    const [dispatchGroupAvg, setDispatchGroupAvg] = useState<number>(0);
    const [dispatchRules, setDispatchRules] = useState<DispatchRuleConfig>(loadDispatchRules);
    const [isDispatchRulesOpen, setIsDispatchRulesOpen] = useState(false);
    const [isDispatchLoading, setIsDispatchLoading] = useState(false);
    const [isDashboardCollapsed, setIsDashboardCollapsed] = useState(false);
    const [showDoubleConfirmModal, setShowDoubleConfirmModal] = useState(false);
    const [pendingConfirmWarnings, setPendingConfirmWarnings] = useState<string[]>([]);

    // Location Split State
    const [activeLocation, setActiveLocation] = useState<string>(() => localStorage.getItem('tripActiveLocation') || 'Taiping');

    useEffect(() => {
        localStorage.setItem('tripActiveLocation', activeLocation);
        const origin = activeLocation.toUpperCase();
        setTripOrigin(origin);
        setParsedTripOrigin(activeLocation);
        setCurrentItemLoc(origin === 'NILAI' ? 'Nilai' : origin === 'KELANTAN' ? 'Kelantan' : origin === 'JOHOR' ? 'Johor' : 'SPD');
        setSelectedOrderIds([]); // Clear selection when location changes
    }, [activeLocation]);



    const [isTripPhotoScanning, setIsTripPhotoScanning] = useState(false);
    const tripPhotoInputRef = useRef<HTMLInputElement>(null);
    const [isTripExcelImporting, setIsTripExcelImporting] = useState(false);
    const tripExcelInputRef = useRef<HTMLInputElement>(null);
    const [isScanReviewOpen, setIsScanReviewOpen] = useState(false);
    const [scanReview, setScanReview] = useState<ScanSheetReview | null>(null);
    const [isBatchCreating, setIsBatchCreating] = useState(false);

    const getTodayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD 本地时间
    const getTomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); };

    // DO PDF Upload & Trip Review State (Max 15 PDFs)
    const [isTripPdfParsing, setIsTripPdfParsing] = useState(false);
    const [pdfParseProgress, setPdfParseProgress] = useState('');
    const tripPdfInputRef = useRef<HTMLInputElement>(null);
    const headerTripPdfInputRef = useRef<HTMLInputElement>(null);
    const appendTripPdfInputRef = useRef<HTMLInputElement>(null);
    const [isAppendingPdf, setIsAppendingPdf] = useState(false);
    const [appendProgress, setAppendProgress] = useState('');
    const [parsedTripBatch, setParsedTripBatch] = useState<ParsedTripDOBatch | null>(null);
    const [isParsedTripModalOpen, setIsParsedTripModalOpen] = useState(false);
    const [parsedTripNumber, setParsedTripNumber] = useState('');
    const [parsedTripDate, setParsedTripDate] = useState(getTodayStr);
    const [parsedDeliveryDate, setParsedDeliveryDate] = useState(getTomorrowStr);
    const [parsedDriverId, setParsedDriverId] = useState('');
    const [parsedLorryId, setParsedLorryId] = useState('');
    const [parsedTripOrigin, setParsedTripOrigin] = useState('Taiping');
    const [parsedZone, setParsedZone] = useState('');
    const [parsedTripRemark, setParsedTripRemark] = useState('');
    const [parsedDeliveryMethod, setParsedDeliveryMethod] = useState<'DELIVERY' | 'SELF_PICKUP'>('DELIVERY');
    const [isCreatingTrip, setIsCreatingTrip] = useState(false);

    // Editing State
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [editingOrderPhoto, setEditingOrderPhoto] = useState<string | null>(null);

    // Admin POD Manual Upload
    const [adminPodUploadTarget, setAdminPodUploadTarget] = useState<{ orderId: string; photoIndex: number } | null>(null);
    const adminPodUploadTargetRef = useRef<{ orderId: string; photoIndex: number } | null>(null);
    const [isAdminPodUploading, setIsAdminPodUploading] = useState(false);
    const adminPodFileInputRef = useRef<HTMLInputElement>(null);

    const handleTriggerAdminPodUpload = (orderId: string, idx: number) => {
        adminPodUploadTargetRef.current = { orderId, photoIndex: idx };
        setAdminPodUploadTarget({ orderId, photoIndex: idx });
        adminPodFileInputRef.current?.click();
    };

    const handleAdminPodFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const target = adminPodUploadTargetRef.current || adminPodUploadTarget;
        if (!file || !target) return;

        setIsAdminPodUploading(true);
        try {
            const compressedDataUrl = await compressImage(file, 1600, 0.85);
            const blob = dataURLtoBlob(compressedDataUrl);
            const targetOrder = orders.find(o => o.id === target.orderId);
            const orderNum = targetOrder?.orderNumber || (targetOrder as any)?.order_number || 'DO';

            const fileName = `admin_pod_${orderNum}_${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const publicUrl = urlData.publicUrl;

            // Fetch latest sales_order
            const { data: freshOrder, error: fetchErr } = await supabase
                .from('sales_orders')
                .select('pod_photo_url, notes')
                .eq('id', target.orderId)
                .single();

            if (fetchErr) throw fetchErr;

            const currentPhotos = freshOrder.pod_photo_url ? freshOrder.pod_photo_url.split(',') : [];
            while (currentPhotos.length <= target.photoIndex) {
                currentPhotos.push('');
            }
            currentPhotos[target.photoIndex] = publicUrl;
            const updatedPodUrl = currentPhotos.join(',');

            const { error: updateErr } = await supabase
                .from('sales_orders')
                .update({ 
                    pod_photo_url: updatedPodUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', target.orderId);

            if (updateErr) throw updateErr;

            // Update local orders state
            setOrders(prev => prev.map(o => o.id === target.orderId ? { ...o, pod_photo_url: updatedPodUrl } : o));
            alert("✅ Gambar DO/POD berjaya dimuat naik oleh Admin! / POD Photo successfully uploaded by Admin!");
        } catch (err: any) {
            alert("Gagal memuat naik gambar POD: " + err.message);
        } finally {
            setIsAdminPodUploading(false);
            setAdminPodUploadTarget(null);
            adminPodUploadTargetRef.current = null;
            if (e.target) e.target.value = '';
        }
    };

    // New Order Form State
    const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'SELF_PICKUP'>('DELIVERY');
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [selectedLorryId, setSelectedLorryId] = useState('');

    const isSelfPickupOrderDOM = (order?: Partial<SalesOrder> | null) => {
        if (!order) return false;
        if ((order as any)?.delivery_method === 'SELF_PICKUP') return true;
        const noteText = `${order.notes || ''} ${order.customer || ''} ${order.deliveryAddress || ''}`.toLowerCase();
        return noteText.includes('pickup') || 
            noteText.includes('pick up') || 
            noteText.includes('self-pickup') || 
            noteText.includes('self pickup') || 
            noteText.includes('ambil sendiri') || 
            noteText.includes('customer ambil') || 
            noteText.includes('自提') || 
            noteText.includes('walk in') || 
            noteText.includes('walk-in');
    };
    const [newOrderDate, setNewOrderDate] = useState(getTodayStr); // 默认今天
    const [newOrderDeliveryDate, setNewOrderDeliveryDate] = useState(getTomorrowStr); // 默认明天
    const [newOrderItems, setNewOrderItems] = useState<SalesOrder['items']>([]);
    const [orderCustomer, setOrderCustomer] = useState('');
    const [newOrderAddress, setNewOrderAddress] = useState('');
    const [newOrderNotes, setNewOrderNotes] = useState(''); // Batch Note
    const [currentItemQty, setCurrentItemQty] = useState<number>(0);
    const [currentItemRemark, setCurrentItemRemark] = useState('');
    const [selectedV2Item, setSelectedV2Item] = useState<V2Item | null>(null);
    const [currentItemLoc, setCurrentItemLoc] = useState(() => getDefaultLocForOrigin(activeLocation)); // New Location state

    // --- Driver Payroll Rate State ---
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);
    const [allUsersMap, setAllUsersMap] = useState<Record<string, string>>({});
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

    // Extra Job Review State
    const [reviewingExtraJob, setReviewingExtraJob] = useState<any>(null);
    const [extraJobAmountInput, setExtraJobAmountInput] = useState<string>('');

    // Driver Leave & Service State
    const [driverLeaves, setDriverLeaves] = useState<any[]>([]);
    const [scheduledServices, setScheduledServices] = useState<any[]>([]);


    // AI Autocomplete State
    const [customerDB, setCustomerDB] = useState<any[]>([]);

    // Hybrid Item Entry State (Unused)
    // const [entryMode, setEntryMode] = useState<'search' | 'manual'>('search');

    // -- Mode A: V2 Search --
    const [v2Items, setV2Items] = useState<V2Item[]>([]);
    const [skuMappings, setSkuMappings] = useState<any[]>([]);
    const [tripsV2List, setTripsV2List] = useState<any[]>([]);
    const [expandedTripKeys, setExpandedTripKeys] = useState<Record<string, boolean>>({});

    // WhatsApp Dispatch & Customer Template Modal States
    const [whatsappTripModal, setWhatsappTripModal] = useState<{
        tripId: string;
        tripNumber: string;
        driverName: string;
        driverPhone: string;
    } | null>(null);

    const [whatsappCustomerModal, setWhatsappCustomerModal] = useState<{
        orderNumber: string;
        customerName: string;
        customerPhone: string;
        orderStatus: string;
        tripNumber?: string;
        driverName?: string;
        driverPhone?: string;
        deliveryDate?: string;
    } | null>(null);

    const parsedCargoSummary = React.useMemo(() => {
        if (!parsedTripBatch) return [];
        const prodMap = new Map<string, { name: string; sku: string; qty: number; uom: string; warehouse: string }>();
        
        parsedTripBatch.deliveryOrders.forEach(o => {
            (o.items || []).forEach(it => {
                const key = it.sku || it.rawProductName || it.product || 'Unknown';
                const loc = it.sourceLocation || guessItemLocation(it, parsedTripOrigin);
                const q = Number(it.quantity) || 0;
                const existing = prodMap.get(key);
                if (existing) {
                    existing.qty += q;
                } else {
                    prodMap.set(key, {
                        name: it.product || it.rawProductName || key,
                        sku: it.sku || key,
                        qty: q,
                        uom: it.uom || 'Rolls',
                        warehouse: loc
                    });
                }
            });
        });

        return Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty);
    }, [parsedTripBatch, parsedTripOrigin]);

    // 🚨 计算当前车次审核批次中未匹配标准料号的货品数量 (用于防呆拦截)
    const parsedUnmappedItemsCount = React.useMemo(() => {
        if (!parsedTripBatch) return 0;
        let count = 0;
        parsedTripBatch.deliveryOrders.forEach(o => {
            (o.items || []).forEach(it => {
                const cleanSku = (it.sku || '').trim().toLowerCase();
                const isRealSku = v2Items.some(v => v.sku.toLowerCase() === cleanSku);
                if (!isRealSku) count++;
            });
        });
        return count;
    }, [parsedTripBatch, v2Items]);

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

            const [usersRes, sysUsersRes, activeOrdersRes, recentCompletedOrdersRes, itemsRes, leavesRes, lorriesRes, servicesRes, ratesRes, customersRes, mappingsRes, tripsRes] = await Promise.all([
                supabase.from('users_public').select('*'),
                supabase.from('sys_users_v2').select('id, auth_user_id, role_modules'),
                supabase.from('sales_orders').select('*').not('status', 'in', '("Delivered","Cancelled")').order('created_at', { ascending: false }),
                supabase.from('sales_orders').select('*').in('status', ['Delivered', 'Cancelled']).order('created_at', { ascending: false }).limit(1000),
                getV2Items(),
                supabase.from('employee_leave').select('*'),
                supabase.from('lorries').select('*'),
                supabase.from('lorry_service_requests').select('*').eq('status', 'Scheduled'),
                supabase.from('delivery_rates').select('*').order('location_name'),
                supabase.from('sys_customers').select('*').order('name'),
                supabase.from('customer_sku_mappings').select('*'),
                supabase.from('trips_v2').select('*').order('created_at', { ascending: false })
            ]);

            // ... (rest of existing logic)
            if (tripsRes?.data) setTripsV2List(tripsRes.data);
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
            if (mappingsRes?.data) setSkuMappings(mappingsRes.data);
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
                const userMap: Record<string, string> = {};
                usersRes.data.forEach((u: any) => {
                    userMap[u.id] = (u.name && u.name.trim() !== '') ? u.name : (u.email?.split('@')[0] || `User (${u.id.substring(0, 6)})`);
                });
                setAllUsersMap(userMap);

                // Driver capability set from role_modules in sys_users_v2
                const driverCapableSet = new Set<string>();
                (sysUsersRes.data || []).forEach((su: any) => {
                    if (su.role_modules && Array.isArray(su.role_modules) && su.role_modules.includes('delivery-driver')) {
                        if (su.id) driverCapableSet.add(su.id);
                        if (su.auth_user_id) driverCapableSet.add(su.auth_user_id);
                    }
                });

                // Filter drivers: anyone with Driver role OR having 'delivery-driver' module capability
                const filteredUsers = usersRes.data.filter(u =>
                    u.role === 'Driver' || driverCapableSet.has(u.id)
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

            // Combine active orders (100% complete) and recent completed orders (up to 1000)
            const combinedOrderMap = new Map<string, any>();
            (activeOrdersRes.data || []).forEach((o: any) => combinedOrderMap.set(o.id, o));
            (recentCompletedOrdersRes.data || []).forEach((o: any) => combinedOrderMap.set(o.id, o));
            const rawOrdersList = Array.from(combinedOrderMap.values());

            if (rawOrdersList.length > 0 || (activeOrdersRes.data && recentCompletedOrdersRes.data)) {
                const mappedOrders: SalesOrder[] = rawOrdersList.map(o => ({
                    ...o,
                    id: o.id,
                    orderNumber: o.order_number || o.id.substring(0, 8),
                    customer: o.customer,
                    driverId: o.driver_id,
                    driver_id: o.driver_id,
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
                    pod_timestamp: o.pod_timestamp,
                    trip_id: o.trip_id,
                    stop_sequence: o.stop_sequence || o.trip_sequence || 0
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
            const proceed = window.confirm(`⚠️ PERINGATAN CUTI / LEAVE WARNING:\n\n${driverName} sedang bercuti dari ${formatDateDMY(strictConflict.start_date)} hingga ${formatDateDMY(strictConflict.end_date)}.\n(${driverName} is on leave from ${formatDateDMY(strictConflict.start_date)} to ${formatDateDMY(strictConflict.end_date)}).\n\nAdakah anda mahu meneruskan tugasan ini atas sebab kecemasan/penggantian?\n(Override and assign anyway for emergency/replacement?)`);
            if (!proceed) return false;
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

        let debounceTimer: any = null;
        const debouncedFetchData = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData();
            }, 1000);
        };

        // 1. Subscribe to Orders (Debounced)
        const orderInfo = supabase.channel('do-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => {
                debouncedFetchData();
            })
            .subscribe();

        // 2. Subscribe to Drivers (users_public)
        const userInfo = supabase.channel('driver-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users_public' }, () => {
                debouncedFetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_leave' }, () => debouncedFetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lorry_service_requests' }, () => debouncedFetchData())
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(orderInfo);
            supabase.removeChannel(userInfo);
        };
    }, []);

    // Filter Logic
    const isSearching = Boolean(searchTerm.trim());
    const filteredOrders = orders.filter(o => {
        // When actively searching, if status filter is "All" (Active), allow finding Delivered & Cancelled orders too
        const matchesStatus = isSearching && statusFilter === 'All'
            ? true
            : (statusFilter === 'All' ? !['Delivered', 'Cancelled'].includes(o.status) : o.status === statusFilter);

        const matchesSearch = tripMatchesSearch(o, searchTerm, getDriverName(o.driverId));
        const matchesDeliveryDate = isSearching && deliveryDateFilter === 'all' && !deliveryMonthPick
            ? true
            : orderMatchesDeliveryDateFilter(
                o,
                deliveryDateFilter,
                deliveryMonthPick || undefined
            );

        const originLoc = o.trip_origin || 'TAIPING';
        const matchesLocation = normalizeLocationCode(originLoc) === normalizeLocationCode(activeLocation);

        return matchesStatus && matchesSearch && matchesDeliveryDate && matchesLocation;
    });

    // Cross-location search detector: when user searches, see if matching orders exist in other factory locations
    const crossLocationMatches = React.useMemo(() => {
        if (!isSearching) return [];
        return orders.filter(o => {
            const matchesStatus = statusFilter === 'All' ? true : o.status === statusFilter;
            const matchesSearch = tripMatchesSearch(o, searchTerm, getDriverName(o.driverId));
            const originLoc = o.trip_origin || 'TAIPING';
            const isDifferentLocation = normalizeLocationCode(originLoc) !== normalizeLocationCode(activeLocation);
            return matchesStatus && matchesSearch && isDifferentLocation;
        });
    }, [orders, isSearching, searchTerm, statusFilter, activeLocation, drivers]);

    // Real-time active order counts across all 4 factory locations
    const locationCounts = React.useMemo(() => {
        const counts: Record<string, number> = { Taiping: 0, Nilai: 0, Kelantan: 0, Johor: 0 };
        orders.forEach(o => {
            const loc = normalizeLocationCode(o.trip_origin || 'TAIPING');
            if (counts[loc] !== undefined) {
                if (!['Delivered', 'Cancelled'].includes(o.status)) {
                    counts[loc]++;
                }
            }
        });
        return counts;
    }, [orders]);

    // Status counts for current active location
    const statusCounts = React.useMemo(() => {
        const locOrders = orders.filter(o => 
            normalizeLocationCode(o.trip_origin || 'TAIPING') === normalizeLocationCode(activeLocation)
        );
        return {
            All: locOrders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).length,
            Loaded: locOrders.filter(o => o.status === 'Loaded').length,
            'Pending Approval': locOrders.filter(o => o.status === 'Pending Approval').length,
            Delivered: locOrders.filter(o => o.status === 'Delivered').length,
            Cancelled: locOrders.filter(o => o.status === 'Cancelled').length,
        };
    }, [orders, activeLocation]);

    // Date filter counts for current active location and current status filter
    const dateFilterCounts = React.useMemo(() => {
        const baseOrders = orders.filter(o => {
            const matchesLocation = normalizeLocationCode(o.trip_origin || 'TAIPING') === normalizeLocationCode(activeLocation);
            const matchesStatus = statusFilter === 'All' 
                ? !['Delivered', 'Cancelled'].includes(o.status) 
                : o.status === statusFilter;
            return matchesLocation && matchesStatus;
        });

        return {
            all: baseOrders.length,
            today: baseOrders.filter(o => orderMatchesDeliveryDateFilter(o, 'today')).length,
            tomorrow: baseOrders.filter(o => orderMatchesDeliveryDateFilter(o, 'tomorrow')).length,
            week: baseOrders.filter(o => orderMatchesDeliveryDateFilter(o, 'week')).length,
            month: baseOrders.filter(o => orderMatchesDeliveryDateFilter(o, 'month')).length,
            no_date: baseOrders.filter(o => orderMatchesDeliveryDateFilter(o, 'no_date')).length,
        };
    }, [orders, activeLocation, statusFilter]);

    // Deep search fallback: if searching a query not yet loaded in state, query DB directly
    useEffect(() => {
        const term = searchTerm.trim();
        if (term.length < 3) return;

        const timer = setTimeout(async () => {
            try {
                const { data: dbFound } = await supabase
                    .from('sales_orders')
                    .select('*')
                    .or(`order_number.ilike.%${term}%,customer.ilike.%${term}%,delivery_address.ilike.%${term}%`)
                    .limit(30);

                if (dbFound && dbFound.length > 0) {
                    setOrders(prev => {
                        const existingIds = new Set(prev.map(o => o.id));
                        const newItems = dbFound.filter(o => !existingIds.has(o.id)).map(o => ({
                            ...o,
                            id: o.id,
                            orderNumber: o.order_number || o.id.substring(0, 8),
                            customer: o.customer,
                            driverId: o.driver_id,
                            driver_id: o.driver_id,
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
                            pod_timestamp: o.pod_timestamp,
                            trip_id: o.trip_id,
                            stop_sequence: o.stop_sequence || o.trip_sequence || 0
                        } as SalesOrder));
                        if (newItems.length === 0) return prev;
                        return [...prev, ...newItems];
                    });
                }
            } catch (searchErr) {
                console.warn("Deep search fallback warning:", searchErr);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const activeDriversForLanes = React.useMemo(() => {
        // 1. Base drivers for the current active location
        const baseDrivers = drivers.filter(
            d => normalizeLocationCode(d.base_location) === normalizeLocationCode(activeLocation)
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
                 normalizeLocationCode(d.base_location) !== normalizeLocationCode(activeLocation)
        );

        // 4. Handle any driver IDs assigned but not present in the driver list (unregistered/missing role)
        const knownDriverIds = new Set(drivers.map(d => d.uid));
        const unknownDriverIds = Array.from(assignedDriverIds).filter(id => !knownDriverIds.has(id));
        const unknownDrivers: User[] = unknownDriverIds.map(id => ({
            uid: id,
            name: allUsersMap[id] || `Driver (${id.substring(0, 6)})`,
            email: '',
            role: 'Driver',
            base_location: activeLocation
        } as any));

        return [...baseDrivers, ...additionalDrivers, ...unknownDrivers];
    }, [drivers, filteredOrders, activeLocation, allUsersMap]);

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
        const oldDriverId = source.droppableId === 'unassigned' ? null : source.droppableId;

        // Identify if dragged element is a Trip Group or standalone Order
        const isTrip = draggableId.startsWith('trip_');
        const tripV2Id = isTrip ? draggableId.replace('trip_', '') : null;
        const targetOrderId = draggableId.startsWith('order_') ? draggableId.replace('order_', '') : (!isTrip ? draggableId : null);

        let movedOrders: SalesOrder[] = [];
        if (tripV2Id) {
            movedOrders = orders.filter(o => o.trip_id === tripV2Id);
        } else if (targetOrderId) {
            const found = orders.find(o => o.id === targetOrderId);
            if (found) movedOrders = [found];
        }

        if (movedOrders.length === 0) return;
        const movedOrderIds = movedOrders.map(o => o.id);

        // Smart Reminder & Cross-Location Guard
        if (newDriverId && newDriverId !== oldDriverId) {
            const targetDriver = drivers.find(d => d.uid === newDriverId);
            const orderOrigin = normalizeLocationCode(movedOrders[0]?.trip_origin || activeLocation);
            if (targetDriver && targetDriver.base_location) {
                const driverLoc = normalizeLocationCode(targetDriver.base_location);
                if (driverLoc !== orderOrigin) {
                    const confirmed = window.confirm(
                        `⚠️ 跨厂区派单确认：\n\n该车次/单据属于【${orderOrigin}】，但司机 ${targetDriver.name} 的基地属地为【${driverLoc}】。\n\n是否确认将此任务跨厂区指派给该司机？`
                    );
                    if (!confirmed) return;
                }
            }
            const anyDeadline = movedOrders.find(o => o.deadline)?.deadline;
            if (!checkDriverAvailability(newDriverId, anyDeadline)) return;
        }

        // Optimistic update of local orders state
        const updatedOrders = orders.map(o => {
            if (movedOrderIds.includes(o.id)) {
                return { ...o, driverId: newDriverId || undefined };
            }
            return o;
        });
        setOrders(updatedOrders);

        // Update database
        try {
            console.log("onDragEnd: Updating driver_id for orders:", movedOrderIds, "to:", newDriverId);
            const { error: soErr } = await supabase
                .from('sales_orders')
                .update({ driver_id: newDriverId })
                .in('id', movedOrderIds);

            if (soErr) {
                console.error("onDragEnd: sales_orders driver update error", soErr);
                throw soErr;
            }

            if (tripV2Id) {
                await supabase
                    .from('trips_v2')
                    .update({ driver_id: newDriverId })
                    .eq('id', tripV2Id);
            }

            // Sync trips list state
            if (tripV2Id) {
                setTripsV2List(prev => prev.map(t => t.id === tripV2Id ? { ...t, driver_id: newDriverId } : t));
            }

        } catch (err: any) {
            console.error("Failed to update trip driver:", err);
            alert(`Sync error: ${err.message || err}. Refreshing...`);
            fetchData();
        }
    };

    // DELETE TRIP (Soft Delete all orders in trip)
    const handleDeleteTrip = async (tripId: string, tripNumber: string) => {
        if (!window.confirm(`Are you sure you want to CANCEL Trip ${tripNumber} and all its Delivery Orders?\nThis will move all orders in this trip to the Cancelled tab and reverse deducted stock if loaded.`)) return;

        try {
            const tripOrders = orders.filter(o => o.trip_id === tripId);
            const orderIds = tripOrders.map(o => o.id);

            // Soft Delete: Update status to 'Cancelled'
            const { error } = await supabase.from('sales_orders').update({ status: 'Cancelled' }).in('id', orderIds);
            if (error) throw error;

            await supabase.from('trips_v2').update({ status: 'Cancelled' }).eq('id', tripId);

            for (const target of tripOrders) {
                if (['Loaded', 'Delivered', 'Pending Approval'].includes(target.status)) {
                    await reverseStockForOrder({
                        id: target.id,
                        order_number: target.orderNumber,
                        trip_origin: (target as any).trip_origin || (target as any).tripOrigin,
                        items: target.items,
                        reason: `Trip ${tripNumber} Cancelled by Admin`
                    });
                }
            }

            setToast({ type: 'success', message: `Trip ${tripNumber} cancelled successfully.` });
            fetchData();
        } catch (err: any) {
            console.error("Failed to delete trip:", err);
            alert(`Failed to delete trip: ${err.message}`);
        }
    };

    // DELETE ORDER (Soft Delete)
    const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
        if (!window.confirm(`Are you sure you want to CANCEL Order ${orderNumber}?\nThis will move it to the Cancelled tab and reverse deducted stock if loaded.`)) return;

        try {
            const target = orders.find(o => o.id === orderId);

            // Soft Delete: Update status to 'Cancelled'
            const { error } = await supabase.from('sales_orders').update({ status: 'Cancelled' }).eq('id', orderId);
            if (error) throw error;

            // ⚡ Cascade: If this order was part of a multi-drop trip, automatically recalibrate trip_drop_count for remaining active sibling orders
            const tripId = (target as any)?.trip_id;
            if (tripId) {
                const remainingActive = orders.filter(o => (o as any).trip_id === tripId && o.id !== orderId && o.status !== 'Cancelled');
                const newCount = remainingActive.length;
                if (newCount > 0) {
                    await supabase.from('sales_orders')
                        .update({ trip_drop_count: newCount })
                        .eq('trip_id', tripId)
                        .neq('status', 'Cancelled');

                    setOrders(prev => prev.map(o => {
                        if (o.id === orderId) return { ...o, status: 'Cancelled' };
                        if ((o as any).trip_id === tripId && o.status !== 'Cancelled') {
                            return { ...o, trip_drop_count: newCount };
                        }
                        return o;
                    }));
                }
            } else if (target?.driverId && target?.orderDate) {
                const remainingActive = orders.filter(o =>
                    o.id !== orderId &&
                    o.driverId === target.driverId &&
                    o.orderDate === target.orderDate &&
                    o.status !== 'Cancelled'
                );
                const newCount = remainingActive.length;
                if (newCount > 0) {
                    const siblingIds = remainingActive.map(o => o.id);
                    await supabase.from('sales_orders')
                        .update({ trip_drop_count: newCount })
                        .in('id', siblingIds);

                    setOrders(prev => prev.map(o => {
                        if (o.id === orderId) return { ...o, status: 'Cancelled' };
                        if (siblingIds.includes(o.id)) {
                            return { ...o, trip_drop_count: newCount };
                        }
                        return o;
                    }));
                }
            }

            // ⚡ If order was already Loaded or Delivered, reverse stock back to warehouse
            if (target && ['Loaded', 'Delivered', 'Pending Approval'].includes(target.status)) {
                await reverseStockForOrder({
                    id: target.id,
                    order_number: target.orderNumber,
                    trip_origin: (target as any).trip_origin || (target as any).tripOrigin,
                    items: target.items,
                    reason: 'Order Cancelled by Admin'
                });
            }

            // Optimistic Remove (or move to Cancelled if checking that tab)
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Cancelled' } : o));

            logActivity(user, {
                action: 'CANCEL_DELIVERY_ORDER',
                module: '送货调度中心 (Trip & Delivery Orders)',
                target: `DO #${orderNumber}`,
                status: 'WARNING',
                resultSummary: `${user?.name || '管理员'} 取消/作废送货单 #${orderNumber}`,
                location: (target as any)?.destination || (target as any)?.deliveryAddress,
                details: {
                    orderId,
                    orderNumber,
                    customer: target?.customer,
                    items: target?.items
                }
            });

            // Soft Refresh
            await fetchData();

        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };

    // Restore Cancelled/Delivered Order to Loaded Status
    const handleRestoreToLoaded = async (order: SalesOrder) => {
        if (!window.confirm(`Are you sure you want to restore Order ${order.orderNumber} to LOADED status?\nThis will make it active under the assigned driver and deduct stock.`)) return;

        try {
            const { error } = await supabase
                .from('sales_orders')
                .update({ status: 'Loaded' })
                .eq('id', order.id);

            if (error) throw error;

            alert(`✅ Order ${order.orderNumber} restored to Loaded (Stock synced via trigger)!`);

            // Optimistic update
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Loaded' } : o));
            await fetchData();
        } catch (err: any) {
            alert("Restore failed: " + err.message);
        }
    };

    // Reset Order to New Status and clear driver
    const handleResetToNew = async (order: SalesOrder) => {
        if (!window.confirm(`Are you sure you want to reset Order ${order.orderNumber} to NEW status?\nThis will clear driver assignments, restore stock to warehouse, and return it to the unassigned pool.`)) return;

        try {
            const { error } = await supabase
                .from('sales_orders')
                .update({ 
                    status: 'New',
                    driver_id: null,
                    trip_sequence: 999
                })
                .eq('id', order.id);

            if (error) throw error;

            // ⚡ If order was Loaded, reverse stock back into warehouse
            if (['Loaded', 'Delivered', 'Pending Approval'].includes(order.status)) {
                await reverseStockForOrder({
                    id: order.id,
                    order_number: order.orderNumber,
                    trip_origin: (order as any).trip_origin || (order as any).tripOrigin,
                    items: order.items,
                    reason: 'Reset to New / Cargo Unloaded'
                });
            }

            alert(`✅ Order ${order.orderNumber} reset to New status & stock restored!`);

            // Optimistic update
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'New', driverId: undefined, driver_id: undefined } : o));
            await fetchData();
        } catch (err: any) {
            alert("Reset failed: " + err.message);
        }
    };

    // APPROVE AMENDMENT
    const handleApproveAmendment = async (order: SalesOrder) => {
        if ((order as any).job_type === 'Extra Job' || (order.orderNumber && order.orderNumber.startsWith('TRIP-JOB'))) {
            setReviewingExtraJob(order);
            const driverOrigin = ((order as any).trip_origin || (order as any).tripOrigin || 'TAIPING').toUpperCase();
            const orderZone = (order.zone || '').toUpperCase();
            const matched = deliveryRates.find(r => {
                if (r.origin?.toUpperCase() !== driverOrigin) return false;
                const rLoc = r.location_name?.toUpperCase();
                if (orderZone === 'SHOPEE' || orderZone === 'SHOPEE / SPD') {
                    return rLoc === 'SHOPEE / SPD' || rLoc === 'SHOPEE';
                }
                return rLoc === orderZone;
            });
            const fallbackRate = (
                orderZone.includes('TAIPING TRIP') ? '7' :
                orderZone.includes('SHOPEE') ? '20' :
                orderZone.includes('PALLET') ? '10' :
                orderZone.includes('SERVICE') ? '15' : '0'
            );
            const parsedNoteAmount = order.notes?.match(/\[APPROVED_AMOUNT:\s*([\d.]+)\]/)?.[1];
            setExtraJobAmountInput(parsedNoteAmount || (matched ? matched.base_rate.toString() : fallbackRate));
            return;
        }

        const isAlreadyDelivered = Boolean(order.pod_photo_url || (order as any).pod_timestamp);
        const targetStatus = isAlreadyDelivered ? 'Delivered' : 'Loaded';
        if (!window.confirm(`Approve changes for Order ${order.orderNumber}? \nThis will adjust stock for amendments and mark as ${targetStatus}.`)) return;

        try {
            // 1. Let V6 DB Trigger handle the stock deduction/adjustment automatically.

            // 2. Update Status
            const { error } = await supabase.from('sales_orders').update({
                status: targetStatus
            }).eq('id', order.id);

            if (error) throw error;

            alert("✅ Approved & Stock Adjusted!");

            // Optimistic Update
            setOrders(prev => prev.map(o => {
                if (o.id === order.id) {
                    return { ...o, status: targetStatus };
                }
                return o;
            }));

            // fetchData(); // Optional debounce

        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleApproveExtraJob = async (order: any, amount?: number) => {
        try {
            const finalAmount = amount !== undefined ? amount : (parseFloat(extraJobAmountInput) || 0);
            let updatedNotes = order.notes || '';
            if (finalAmount > 0) {
                updatedNotes = updatedNotes.replace(/\[APPROVED_AMOUNT:\s*[\d.]+\]/gi, '').trim();
                updatedNotes = `${updatedNotes}\n[APPROVED_AMOUNT: ${finalAmount.toFixed(2)}]`.trim();
            }

            const { error } = await supabase.from('sales_orders').update({
                status: 'Delivered',
                notes: updatedNotes
            }).eq('id', order.id);

            if (error) throw error;

            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Delivered', notes: updatedNotes } : o));
            setReviewingExtraJob(null);
            setToast({ type: 'success', message: `✅ Tugasan Tambahan Diluluskan! (Gaji RM ${finalAmount.toFixed(2)} dikreditkan)` });
            fetchData();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleRejectExtraJob = async (order: any) => {
        const reason = window.prompt("Sebab penolakan / Rejection reason:", "Gambar tidak jelas / Tidak sah");
        if (reason === null) return;

        try {
            const updatedNotes = `${order.notes || ''}\n[REJECTED: ${reason}]`.trim();
            const { error } = await supabase.from('sales_orders').update({
                status: 'Cancelled',
                notes: updatedNotes
            }).eq('id', order.id);

            if (error) throw error;

            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Cancelled', notes: updatedNotes } : o));
            setReviewingExtraJob(null);
            setToast({ type: 'error', message: `❌ Tugasan Tambahan Ditolak / Extra job rejected.` });
            fetchData();
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

    const handleUpdateModalItemSku = (index: number, rawInput: string) => {
        const parts = rawInput.split(' - ');
        const inputSku = parts[0].trim().toLowerCase();
        const matched = v2Items.find(v => v.sku.toLowerCase() === inputSku);

        setNewOrderItems(prev => {
            const updated = [...prev];
            if (matched) {
                updated[index] = {
                    ...updated[index],
                    sku: matched.sku,
                    product: matched.name,
                    packaging: (matched.uom as any) || updated[index].packaging || 'Unit'
                };
            } else {
                updated[index] = {
                    ...updated[index],
                    sku: rawInput.trim()
                };
            }
            return updated;
        });
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

    const matchV2ItemFromScan = (sku?: string, product?: string, remark?: string): V2Item | null => {
        // Alias normalization: shorthand "SF CLEAR" or "SF BLACK" without explicit weight defaults to 2.2KG
        const raw = `${sku || ''} ${product || ''} ${remark || ''}`.toLowerCase().replace(/[-_]/g, ' ');
        if (raw.includes('baby') || raw.includes('babyroll')) {
            if (raw.includes('black') || raw.includes('hitam')) {
                const found = v2Items.find(i => i.sku === 'SF-BABYROLL-BLACK');
                if (found) return found;
            }
            if (raw.includes('clear')) {
                const found = v2Items.find(i => i.sku === 'SF-BABYROLL-CLEAR');
                if (found) return found;
            }
            const defaultBaby = v2Items.find(i => i.sku === 'SF-BABYROLL-CLEAR' || i.sku === 'SF-BABYROLL');
            if (defaultBaby) return defaultBaby;
        }

        // Slitting Bubble Wrap: 25cm (4 units) / 50cm (2 in 1 / half)
        if (raw.includes('25cm') || raw.includes('25 cm') || raw.includes('4 units') || raw.includes('4 unit')) {
            const isDouble = raw.includes('double') || raw.includes('dl');
            const isBlack = raw.includes('black') || raw.includes('hitam') || raw.includes('blk');
            if (isDouble && isBlack) {
                const found = v2Items.find(i => i.sku === 'BW-DL-BLK-100Mx25CMx4ROLL-RED' || i.sku === 'DL-HITAM-25CM');
                if (found) return found;
            }
            if (isDouble && !isBlack) {
                const found = v2Items.find(i => i.sku === 'BW-DL-CLR-100Mx25CMx4ROLL-BLU' || i.sku === 'DL-25CM');
                if (found) return found;
            }
            if (!isDouble && isBlack) {
                const found = v2Items.find(i => i.sku === 'BW-SL-BLK-100Mx25CMx4ROLL-GRN' || i.sku === 'HITAM-25CM');
                if (found) return found;
            }
            if (!isDouble && !isBlack) {
                const found = v2Items.find(i => i.sku === 'BW-SL-CLR-100Mx25CMx4ROLL-GRN' || i.sku === 'SL-25CM');
                if (found) return found;
            }
        }
        if (raw.includes('50cm') || raw.includes('50 cm') || raw.includes('half') || raw.includes('2 in 1') || raw.includes('2 units')) {
            const isDouble = raw.includes('double') || raw.includes('dl');
            const isBlack = raw.includes('black') || raw.includes('hitam') || raw.includes('blk');
            if (isDouble && isBlack) {
                const found = v2Items.find(i => i.sku.includes('DL') && i.sku.includes('BLK') && (i.sku.includes('50CM') || i.sku.includes('HALF')));
                if (found) return found;
            }
            if (isDouble && !isBlack) {
                const found = v2Items.find(i => i.sku.includes('DL') && i.sku.includes('CLR') && (i.sku.includes('50CM') || i.sku.includes('HALF')));
                if (found) return found;
            }
            if (!isDouble && isBlack) {
                const found = v2Items.find(i => i.sku.includes('SL') && i.sku.includes('BLK') && (i.sku.includes('50CM') || i.sku.includes('HALF')));
                if (found) return found;
            }
            if (!isDouble && !isBlack) {
                const found = v2Items.find(i => i.sku.includes('SL') && i.sku.includes('CLR') && (i.sku.includes('50CM') || i.sku.includes('HALF')));
                if (found) return found;
            }
        }

        // Stretch Film standard matching (defaults to 2.2KG)
        if (raw.includes('stretch film') || raw.includes('sf')) {
            if (raw.includes('black') || raw.includes('hitam')) {
                if (raw.includes('2.0') || raw.includes('2.0kg') || raw.includes('2kg')) {
                    const found = v2Items.find(i => i.sku === 'SF-BLACK-2.0');
                    if (found) return found;
                }
                const found = v2Items.find(i => i.sku === 'SF-BLACK-2.2');
                if (found) return found;
            }
            if (raw.includes('clear') || raw.includes('putih')) {
                if (raw.includes('2.0') || raw.includes('2.0kg') || raw.includes('2kg')) {
                    const found = v2Items.find(i => i.sku === 'SF-CLEAR-2.0');
                    if (found) return found;
                }
                const found = v2Items.find(i => i.sku === 'SF-CLEAR-2.2');
                if (found) return found;
            }
        }

        if (raw.includes('sf clear') && !raw.includes('2.0')) {
            const found = v2Items.find(i => i.sku === 'SF-CLEAR-2.2');
            if (found) return found;
        }
        if (raw.includes('sf black') && !raw.includes('2.0')) {
            const found = v2Items.find(i => i.sku === 'SF-BLACK-2.2');
            if (found) return found;
        }
        return matchV2ItemByName(product) || matchV2ItemByName(sku) || matchV2ItemBySku(sku);
    };

    const alignDOItemWithCatalog = (
        customerName: string,
        rawProduct: string,
        aiSuggestedSku?: string,
        currentMappings: any[] = skuMappings,
        itemsCatalog: V2Item[] = v2Items,
        origin: string = parsedTripOrigin || activeLocation
    ): { sku: string; product: string; rawProductName: string; sourceLocation: string; isMatched: boolean } => {
        let resultSku = '';
        let resultProduct = rawProduct;
        let resultMatched = false;

        const custLower = (customerName || '').trim().toLowerCase();
        const rawLower = (rawProduct || '').trim().toLowerCase();

        // Tier 1: Customer-specific alias mapping from customer_sku_mappings
        if (custLower && rawLower && currentMappings && currentMappings.length > 0) {
            const aliasMatch = currentMappings.find(m => {
                const mCust = (m.customer_name || '').trim().toLowerCase();
                const mRaw = (m.raw_product_name || '').trim().toLowerCase();
                const custMatched = mCust === custLower || custLower.includes(mCust) || mCust.includes(custLower);
                const itemMatched = mRaw === rawLower || rawLower.includes(mRaw) || mRaw.includes(rawLower);
                return custMatched && itemMatched;
            });
            if (aliasMatch && aliasMatch.mapped_sku) {
                resultSku = aliasMatch.mapped_sku;
                resultProduct = aliasMatch.mapped_product_name || rawProduct;
                resultMatched = true;
            }
        }

        // Tier 1.5: If AI provided a valid SKU in itemsCatalog
        if (!resultMatched && aiSuggestedSku) {
            const exactSku = itemsCatalog.find(i => i.sku.toLowerCase() === aiSuggestedSku.trim().toLowerCase());
            if (exactSku) {
                resultSku = exactSku.sku;
                resultProduct = exactSku.name;
                resultMatched = true;
            }
        }

        // Tier 2: Algorithmic catalog match using matchV2ItemFromScan
        if (!resultMatched) {
            const fuzzyV2 = matchV2ItemFromScan(aiSuggestedSku, rawProduct);
            if (fuzzyV2) {
                resultSku = fuzzyV2.sku;
                resultProduct = fuzzyV2.name;
                resultMatched = true;
            } else {
                resultSku = aiSuggestedSku || '';
                resultProduct = rawProduct;
                resultMatched = false;
            }
        }

        const sourceLoc = guessItemLocation({ sku: resultSku, product: resultProduct, rawProductName: rawProduct }, origin);

        return {
            sku: resultSku,
            product: resultProduct,
            rawProductName: rawProduct,
            sourceLocation: sourceLoc,
            isMatched: resultMatched
        };
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
                r.product != null ? String(r.product) : undefined,
                r.remark != null ? String(r.remark) : undefined
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
            const defaultLoc = getDefaultLocForOrigin(tripOrigin);
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

            const defaultLoc = getDefaultLocForOrigin(tripOrigin);

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
                const rawTripDate = findValue(row, ['tripdate', 'date', 'orderdate', 'triporderdate', t('Travel date'), t('date')]);
                const rawDeliveryDate = findValue(row, ['deliverydate', 'deadline', 'duedate', 'targetdate', t('Delivery date'), t('Delivery date'), t('date_to')]);
                const driverName = String(findValue(row, ['driver', 'drivername', 'assigneddriver', 'staff', 'driverid', t('driver'), t('driver name')]) || '').trim();
                const tripLabel = String(findValue(row, ['triplabel', 'tripname', 'label', 'trip', 'tripno', 'tripnumber', t('journey'), t('itinerary tag'), t('trips'), t('trip')]) || '').trim();
                const customerName = String(findValue(row, ['customer', 'customername', 'client', 'clientname', 'company', 'companyname', t('client'), t('Customer name'), t('company')]) || '').trim();
                const destinations = String(findValue(row, ['destinations', 'destination', 'address', 'deliveryaddress', 'place', 'places', t('destination'), t('Shipping Address'), t('address')]) || '').trim();
                const tripCategory = String(findValue(row, ['tripcategory', 'category', 'zone', 'ratezone', 'destinationzone', t('area'), t('Classification')]) || '').trim();
                const tripDropCountVal = findValue(row, ['tripdropcount', 'dropcount', 'drops', 'placescount', 'drop', t('landing point'), t('Unloading points'), t('Number of points dropped')]);
                const notes = String(findValue(row, ['notes', 'note', 'remark', 'remarks', 'comment', 'comments', 'sheetnotes', t('Remark')]) || '').trim();

                const sku = findValue(row, ['sku', 'productsku', 'itemsku', 'code', 'itemcode', 'productcode', t('product code'), t('Product code'), t('coding')]);
                const product = findValue(row, ['product', 'productname', 'item', 'itemname', 'description', 'name', t('Product name'), t('Product name'), t('Product name')]);
                const quantity = Number(findValue(row, ['quantity', 'qty', 'amount', 'pcs', 'rolls', 'count', t('quantity'), t('Number of pieces')])) || 1;
                const itemLoc = findValue(row, ['sourcelocation', 'location', 'factory', 'hub', 'origin', 'warehouse', t('Shipping warehouse'), t('Shipping warehouse'), t('storehouse')]);

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
                        product != null ? String(product) : undefined,
                        notes != null ? String(notes) : undefined
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
            [t('Trip Date / trip date'), t('Delivery Date / delivery date'), t('Driver Name / driver name'), t('Trip Label / trip label'), t('Customer Name/Customer Name'), t('Destinations / Shipping destinations'), t('Trip Category/Region Category'), t('Trip Drop Count/drop points'), t('Notes / itinerary notes'), t('SKU / product code'), t('Product Name / product name'), t('Quantity / quantity'), t('Source Location / Shipping warehouse')]
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

    // --- DO & PHOTOS (MAX 15) UPLOAD & TRIP DISPATCH HANDLERS ---
    const handleTripPdfUpload = async (e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        let fileList: File[] = [];
        if (Array.isArray(e)) {
            fileList = e;
        } else {
            const rawFiles = e.target.files;
            if (!rawFiles || rawFiles.length === 0) return;
            fileList = Array.from(rawFiles);
            e.target.value = '';
        }

        if (fileList.length > 15) {
            alert(t('Maksimum 15 fail (PDF/Foto) dibenarkan untuk satu Trip! Sila pilih semula.\nMaximum 15 files (PDF/Photos) allowed per trip! Please select again.'));
            return;
        }

        const totalSizeBytes = fileList.reduce((acc, f) => acc + f.size, 0);
        if (totalSizeBytes > 4.5 * 1024 * 1024) {
            alert(t('Saiz fail melebihi had 4.5MB untuk satu muat naik. Sila kurangkan bilangan fail atau mampatkan dokumen.\nTotal file size exceeds 4.5MB serverless limit. Please upload fewer or compressed files.'));
            return;
        }

        setIsTripPdfParsing(true);
        setPdfParseProgress(t('Reading {{count}} files...', { count: fileList.length }));
        setToast(null);

        try {
            const filePayloads = await Promise.all(
                fileList.map(async (file) => {
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const res = reader.result as string;
                            const data = res.includes(',') ? res.split(',')[1] : res;
                            resolve(data);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    let mime = file.type;
                    if (!mime || mime === 'application/octet-stream') {
                        const nameLower = file.name.toLowerCase();
                        if (nameLower.endsWith('.pdf')) mime = 'application/pdf';
                        else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) mime = 'image/jpeg';
                        else if (nameLower.endsWith('.png')) mime = 'image/png';
                        else if (nameLower.endsWith('.webp')) mime = 'image/webp';
                        else mime = 'application/pdf';
                    }

                    return {
                        name: file.name,
                        base64,
                        mimeType: mime
                    };
                })
            );

            setPdfParseProgress(t('AI analyzing DO details and mapping SKUs...'));

            const response = await fetch('/api/agent/parse-trip-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'parse-trip-pdf',
                    files: filePayloads,
                    productsList: v2Items.map(i => ({ sku: i.sku, name: i.name })),
                    driversList: drivers.map(d => ({ uid: d.uid, name: d.name || d.email || '' }))
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data: ParsedTripDOBatch = await response.json();
            if (!data.deliveryOrders || data.deliveryOrders.length === 0) {
                throw new Error(t('No valid Delivery Orders detected in the uploaded PDFs. Try a clearer PDF.'));
            }

            const initialOrigin = normalizeLocationCode(activeLocation || parsedTripOrigin || 'Taiping');

            // Execute 2-tier mapping alignment (customer_sku_mappings + master_items_v2)
            const processedOrders: ParsedDeliveryOrder[] = data.deliveryOrders.map(doOrder => {
                const alignedItems: ParsedDOItem[] = (doOrder.items || []).map(it => {
                    const matchRes = alignDOItemWithCatalog(
                        doOrder.customer,
                        it.product,
                        it.sku,
                        skuMappings,
                        v2Items
                    );
                    return {
                        ...it,
                        rawProductName: it.rawProductName || it.product,
                        product: matchRes.product,
                        sku: matchRes.sku,
                        sourceLocation: it.sourceLocation || matchRes.sourceLocation || guessItemLocation({ sku: matchRes.sku, product: matchRes.product, rawProductName: it.product }, initialOrigin),
                        isMatched: matchRes.isMatched
                    };
                });
                return {
                    ...doOrder,
                    items: alignedItems
                };
            });

            const alignedBatch: ParsedTripDOBatch = {
                ...data,
                deliveryOrders: processedOrders
            };

            // Generate clean standard trip number
            const now = new Date();
            const dateCode = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const randomSeq = String(Math.floor(Math.random() * 900) + 100);
            const genTripNo = `TRIP-${dateCode}-${randomSeq}`;

            setParsedTripBatch(alignedBatch);
            setParsedTripNumber(genTripNo);
            setParsedTripDate(getTodayStr());
            setParsedDeliveryDate(getTomorrowStr());
            setParsedTripOrigin(initialOrigin);
            setParsedZone(data.primaryZone || '');
            setParsedTripRemark(data.tripRemarks || '');
            setIsParsedTripModalOpen(true);

            if (data.isFallback) {
                setToast({
                    type: 'info',
                    message: t('⚠️ 单据使用备用草稿解析（提取到 {{count}} 张 DO），请核对各停靠点。', { count: data.deliveryOrders.length })
                });
            } else {
                setToast({
                    type: 'success',
                    message: t('✅ AI 成功解析 {{count}} 张单据 (模型: {{model}})。请核对并确认车次。', {
                        count: data.deliveryOrders.length,
                        model: data.modelUsed || 'gemini-2.5-flash'
                    })
                });
            }
        } catch (err: any) {
            console.error("Failed to parse DO & Photos:", err);
            const errMsg = err.message || t('Failed to parse DO & Photos');
            setToast({
                type: 'error',
                message: errMsg
            });
            alert(`单据与照片识别失败 / Failed: ${errMsg}`);
        } finally {
            setIsTripPdfParsing(false);
            setPdfParseProgress('');
        }
    };

    const handleOpenNewTripModal = () => {
        const now = new Date();
        const dateCode = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const randomSeq = String(Math.floor(Math.random() * 900) + 100);
        const genTripNo = `TRIP-${dateCode}-${randomSeq}`;
        const initialOrigin = normalizeLocationCode(activeLocation || 'TAIPING');
        const defaultLoc = getDefaultLocForOrigin(initialOrigin);

        const initialBatch: ParsedTripDOBatch = {
            deliveryOrders: [
                {
                    doNumber: `DO-${dateCode}-01`,
                    customer: '',
                    deliveryAddress: '',
                    phone: '',
                    remarks: '',
                    items: [
                        {
                            product: '',
                            rawProductName: '',
                            quantity: 1,
                            uom: 'Rolls',
                            sku: '',
                            sourceLocation: defaultLoc,
                            isMatched: false
                        }
                    ],
                    doTotal: 1
                }
            ],
            totalDrops: 1,
            totalRolls: 1,
            primaryZone: '',
            tripRemarks: ''
        };

        setParsedTripBatch(initialBatch);
        setParsedTripNumber(genTripNo);
        setParsedTripDate(getTodayStr());
        setParsedDeliveryDate(getTomorrowStr());
        setParsedTripOrigin(initialOrigin);
        setParsedZone('');
        setParsedTripRemark('');
        setParsedDriverId('');
        setParsedLorryId('');
        setParsedDeliveryMethod('DELIVERY');
        setIsParsedTripModalOpen(true);
    };

    const handleUpdateParsedCustomer = (idx: number, customerName: string) => {
        handleUpdateParsedDO(idx, 'customer', customerName);
        const matched = customerDB.find(
            c => (c.name || '').toLowerCase().trim() === customerName.toLowerCase().trim()
        );
        if (matched) {
            if (matched.address) {
                handleUpdateParsedDO(idx, 'deliveryAddress', matched.address);
            }
            if (matched.zone) {
                handleUpdateParsedDO(idx, 'zone', matched.zone);
            }
            if (matched.phone) {
                handleUpdateParsedDO(idx, 'phone', matched.phone);
            }
        }
    };

    const handleAddNewParsedDO = () => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            if (prev.deliveryOrders.length >= 15) {
                alert(t('Maksimum 15 DO untuk satu trip. Sila cipta trip berasingan untuk DO selebihnya.\nMaximum 15 DOs per trip. Please create a separate trip for additional orders.'));
                return prev;
            }
            const now = new Date();
            const dateCode = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
            const seq = String(prev.deliveryOrders.length + 1).padStart(3, '0');
            const defaultLoc = getDefaultLocForOrigin(parsedTripOrigin);

            const newDO: ParsedDeliveryOrder = {
                doNumber: `MANUAL-${dateCode}-${seq}`,
                customer: '',
                deliveryAddress: '',
                phone: '',
                remarks: '',
                items: [
                    {
                        product: '',
                        rawProductName: '',
                        quantity: 1,
                        uom: 'Rolls',
                        sku: '',
                        sourceLocation: defaultLoc,
                        isMatched: false
                    }
                ],
                doTotal: 1
            };

            const updated = [...prev.deliveryOrders, newDO];
            const newTotalRolls = updated.reduce((sum, o) => {
                return sum + (o.items || []).reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
            }, 0);

            return {
                ...prev,
                deliveryOrders: updated,
                totalDrops: updated.length,
                totalRolls: newTotalRolls
            };
        });
        setToast({
            type: 'info',
            message: t('已添加 1 个空白停靠点，请填写客户与货品信息。')
        });
    };

    const handleAppendTripPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !parsedTripBatch) return;

        const fileList = Array.from(files);
        e.target.value = '';

        const currentCount = parsedTripBatch.deliveryOrders.length;
        if (currentCount + fileList.length > 15) {
            alert(t('Maksimum 15 DO untuk satu trip. Anda kini mempunyai {{current}} DO dan cuba menambah {{new}} lagi.\nMaximum 15 DOs per trip limit. Current has {{current}} DOs, cannot append {{new}} more.', {
                current: currentCount,
                new: fileList.length
            }));
            return;
        }

        const totalSizeBytes = fileList.reduce((acc, f) => acc + f.size, 0);
        if (totalSizeBytes > 4.5 * 1024 * 1024) {
            alert(t('Saiz fail melebihi had 4.5MB untuk satu muat naik. Sila kurangkan bilangan fail atau mampatkan dokumen.\nTotal file size exceeds 4.5MB serverless limit. Please upload fewer or compressed files.'));
            return;
        }

        setIsAppendingPdf(true);
        setAppendProgress(t('Reading {{count}} files...', { count: fileList.length }));
        setToast(null);

        try {
            const filePayloads = await Promise.all(
                fileList.map(async (file) => {
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const res = reader.result as string;
                            const data = res.includes(',') ? res.split(',')[1] : res;
                            resolve(data);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    let mime = file.type;
                    if (!mime || mime === 'application/octet-stream') {
                        const nameLower = file.name.toLowerCase();
                        if (nameLower.endsWith('.pdf')) mime = 'application/pdf';
                        else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) mime = 'image/jpeg';
                        else if (nameLower.endsWith('.png')) mime = 'image/png';
                        else if (nameLower.endsWith('.webp')) mime = 'image/webp';
                        else mime = 'application/pdf';
                    }

                    return {
                        name: file.name,
                        base64,
                        mimeType: mime
                    };
                })
            );

            setAppendProgress(t('AI analyzing DO details and mapping SKUs...'));

            const response = await fetch('/api/agent/parse-trip-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'parse-trip-pdf',
                    files: filePayloads,
                    productsList: v2Items.map(i => ({ sku: i.sku, name: i.name })),
                    driversList: drivers.map(d => ({ uid: d.uid, name: d.name || d.email || '' }))
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data: ParsedTripDOBatch = await response.json();
            if (!data.deliveryOrders || data.deliveryOrders.length === 0) {
                throw new Error(t('No valid Delivery Orders detected in the uploaded files.'));
            }

            const currentOrigin = parsedTripOrigin || activeLocation || 'Taiping';

            // Execute 2-tier mapping alignment (customer_sku_mappings + master_items_v2)
            const newProcessedOrders: ParsedDeliveryOrder[] = data.deliveryOrders.map(doOrder => {
                const alignedItems: ParsedDOItem[] = (doOrder.items || []).map(it => {
                    const matchRes = alignDOItemWithCatalog(
                        doOrder.customer,
                        it.product,
                        it.sku,
                        skuMappings,
                        v2Items
                    );
                    return {
                        ...it,
                        rawProductName: it.rawProductName || it.product,
                        product: matchRes.product,
                        sku: matchRes.sku,
                        sourceLocation: it.sourceLocation || matchRes.sourceLocation || guessItemLocation({ sku: matchRes.sku, product: matchRes.product, rawProductName: it.product }, currentOrigin),
                        isMatched: matchRes.isMatched
                    };
                });
                return {
                    ...doOrder,
                    items: alignedItems,
                    doTotal: alignedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
                };
            });

            // Append to existing batch without overwriting trip metadata or existing orders
            setParsedTripBatch(prev => {
                if (!prev) return null;
                const mergedOrders = [...prev.deliveryOrders, ...newProcessedOrders];
                const totalRolls = mergedOrders.reduce((sum, o) => {
                    return sum + (o.items || []).reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
                }, 0);
                return {
                    ...prev,
                    deliveryOrders: mergedOrders,
                    totalDrops: mergedOrders.length,
                    totalRolls
                };
            });

            setToast({
                type: 'success',
                message: t('✅ 成功追加 {{count}} 张单据至当前车次！', { count: newProcessedOrders.length })
            });
        } catch (err: any) {
            console.error("Failed to append DO & Photos:", err);
            const errMsg = err.message || t('Failed to parse DO & Photos');
            setToast({
                type: 'error',
                message: errMsg
            });
            alert(`追加单据识别失败 / Failed: ${errMsg}`);
        } finally {
            setIsAppendingPdf(false);
            setAppendProgress('');
        }
    };

    const handleCloseParsedTripModal = () => {
        setIsParsedTripModalOpen(false);
        setParsedTripBatch(null);
        setParsedTripRemark('');
        setIsAppendingPdf(false);
        setAppendProgress('');
    };

    const handleRemoveParsedDO = (index: number) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const updated = prev.deliveryOrders.filter((_, idx) => idx !== index);
            if (updated.length === 0) {
                handleCloseParsedTripModal();
                return null;
            }
            const totalRolls = updated.reduce((sum, d) => sum + (d.doTotal || 0), 0);
            return {
                ...prev,
                deliveryOrders: updated,
                totalDrops: updated.length,
                totalRolls
            };
        });
    };

    const handleMoveParsedDO = (index: number, direction: 'up' | 'down') => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const list = [...prev.deliveryOrders];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= list.length) return prev;
            const temp = list[index];
            list[index] = list[targetIndex];
            list[targetIndex] = temp;
            return { ...prev, deliveryOrders: list };
        });
    };

    const handleUpdateParsedDO = (index: number, field: keyof ParsedDeliveryOrder, value: any) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const list = [...prev.deliveryOrders];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, deliveryOrders: list };
        });
    };

    const handleUpdateParsedItemQty = (doIndex: number, itemIndex: number, newQty: number) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const orders = [...prev.deliveryOrders];
            const order = { ...orders[doIndex] };
            const items = [...(order.items || [])];
            items[itemIndex] = { ...items[itemIndex], quantity: Math.max(0, newQty) };
            order.items = items;
            order.doTotal = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            orders[doIndex] = order;

            // Recalculate totalRolls for entire trip
            const newTotalRolls = orders.reduce((sum, o) => {
                return sum + (o.items || []).reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
            }, 0);

            return { ...prev, deliveryOrders: orders, totalRolls: newTotalRolls };
        });
    };

    const handleUpdateParsedItemName = (doIndex: number, itemIndex: number, newName: string) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const orders = [...prev.deliveryOrders];
            const order = { ...orders[doIndex] };
            const items = [...(order.items || [])];
            items[itemIndex] = { ...items[itemIndex], product: newName, rawProductName: newName };
            order.items = items;
            orders[doIndex] = order;
            return { ...prev, deliveryOrders: orders };
        });
    };

    const handleUpdateParsedItemUom = (doIndex: number, itemIndex: number, newUom: string) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const orders = [...prev.deliveryOrders];
            const order = { ...orders[doIndex] };
            const items = [...(order.items || [])];
            items[itemIndex] = { ...items[itemIndex], uom: newUom };
            order.items = items;
            orders[doIndex] = order;
            return { ...prev, deliveryOrders: orders };
        });
    };

    const handleDeleteParsedItem = (doIndex: number, itemIndex: number) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const orders = [...prev.deliveryOrders];
            const order = { ...orders[doIndex] };
            const items = (order.items || []).filter((_, idx) => idx !== itemIndex);
            order.items = items;
            order.doTotal = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            orders[doIndex] = order;

            const newTotalRolls = orders.reduce((sum, o) => {
                return sum + (o.items || []).reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
            }, 0);

            return { ...prev, deliveryOrders: orders, totalRolls: newTotalRolls };
        });
    };

    const handleAddNewParsedItem = (doIndex: number) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const orders = [...prev.deliveryOrders];
            const order = { ...orders[doIndex] };
            const defaultLoc = getDefaultLocForOrigin(parsedTripOrigin);
            const newItem: ParsedDOItem = {
                product: '',
                rawProductName: '',
                quantity: 1,
                uom: 'Rolls',
                sku: '',
                sourceLocation: defaultLoc,
                isMatched: false
            };
            const items = [...(order.items || []), newItem];
            order.items = items;
            order.doTotal = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            orders[doIndex] = order;

            const newTotalRolls = orders.reduce((sum, o) => {
                return sum + (o.items || []).reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
            }, 0);

            return { ...prev, deliveryOrders: orders, totalRolls: newTotalRolls };
        });
    };

    const handleClearParsedItems = (doIndex: number) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const orders = [...prev.deliveryOrders];
            const order = { ...orders[doIndex] };
            order.items = [];
            order.doTotal = 0;
            orders[doIndex] = order;

            const newTotalRolls = orders.reduce((sum, o) => {
                return sum + (o.items || []).reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
            }, 0);

            return { ...prev, deliveryOrders: orders, totalRolls: newTotalRolls };
        });
    };

    const handleUpdateParsedItemSku = (doIndex: number, itemIndex: number, inputVal: string) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const orders = [...prev.deliveryOrders];
            const order = { ...orders[doIndex] };
            const items = [...(order.items || [])];
            const currentItem = { ...items[itemIndex] };

            const trimmed = (inputVal || '').trim();
            const matchedProd = v2Items.find(x => 
                x.sku.toLowerCase() === trimmed.toLowerCase() || 
                x.name.toLowerCase() === trimmed.toLowerCase() ||
                `${x.name} (${x.sku})`.toLowerCase() === trimmed.toLowerCase() ||
                `${x.sku} - ${x.name}`.toLowerCase() === trimmed.toLowerCase()
            );

            if (matchedProd) {
                currentItem.sku = matchedProd.sku;
                currentItem.product = matchedProd.name;
                currentItem.isMatched = true;
                currentItem.sourceLocation = guessItemLocation({ sku: matchedProd.sku, product: matchedProd.name, rawProductName: currentItem.rawProductName }, parsedTripOrigin);
            } else if (trimmed) {
                const exactCatalogMatch = v2Items.find(x => x.sku.toLowerCase() === trimmed.toLowerCase());
                if (exactCatalogMatch) {
                    currentItem.sku = exactCatalogMatch.sku;
                    currentItem.product = exactCatalogMatch.name;
                    currentItem.isMatched = true;
                    currentItem.sourceLocation = guessItemLocation({ sku: exactCatalogMatch.sku, product: exactCatalogMatch.name, rawProductName: currentItem.rawProductName }, parsedTripOrigin);
                } else {
                    currentItem.sku = trimmed;
                    currentItem.isMatched = false;
                    currentItem.sourceLocation = guessItemLocation({ sku: trimmed, rawProductName: currentItem.rawProductName }, parsedTripOrigin);
                }
            } else {
                currentItem.sku = '';
                currentItem.isMatched = false;
            }

            items[itemIndex] = currentItem;
            order.items = items;
            orders[doIndex] = order;
            return { ...prev, deliveryOrders: orders };
        });
    };

    const handleUpdateParsedItemLocation = (doIndex: number, itemIndex: number, newLocation: string) => {
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const orders = [...prev.deliveryOrders];
            const order = { ...orders[doIndex] };
            const items = [...(order.items || [])];
            items[itemIndex] = { ...items[itemIndex], sourceLocation: newLocation };
            order.items = items;
            orders[doIndex] = order;
            return { ...prev, deliveryOrders: orders };
        });
    };

    const handleUpdateParsedTripOrigin = (newOrigin: string) => {
        setParsedTripOrigin(newOrigin);
        if (parsedDriverId) {
            const curDriver = drivers.find(d => d.uid === parsedDriverId);
            if (curDriver && normalizeLocationCode(curDriver.base_location) !== normalizeLocationCode(newOrigin)) {
                setParsedDriverId('');
                setParsedLorryId('');
            }
        }
        if (!parsedTripBatch) return;
        const validWarehouses = getAvailableWarehousesForOrigin(newOrigin);
        const defaultLoc = getDefaultLocForOrigin(newOrigin);
        setParsedTripBatch(prev => {
            if (!prev) return null;
            const updatedOrders = prev.deliveryOrders.map(order => ({
                ...order,
                items: (order.items || []).map(it => {
                    const currentLoc = it.sourceLocation;
                    if (!currentLoc || !validWarehouses.includes(currentLoc)) {
                        return { ...it, sourceLocation: guessItemLocation(it, newOrigin) || defaultLoc };
                    }
                    return it;
                })
            }));
            return { ...prev, deliveryOrders: updatedOrders };
        });
    };

    const handleConfirmCreateTrip = async () => {
        if (!parsedTripBatch || parsedTripBatch.deliveryOrders.length === 0) return;

        // 🚨 严密硬防呆校验：车次内所有物料必须严格属于系统标准品库 (v2Items)
        const invalidItems: { dropIndex: number; customer: string; product: string; sku: string }[] = [];
        parsedTripBatch.deliveryOrders.forEach((order, oIdx) => {
            (order.items || []).forEach(it => {
                const cleanSku = (it.sku || '').trim().toLowerCase();
                const isRealSku = v2Items.some(v => v.sku.toLowerCase() === cleanSku);
                if (!isRealSku) {
                    invalidItems.push({
                        dropIndex: oIdx + 1,
                        customer: order.customer || `Drop #${oIdx + 1}`,
                        product: it.product || it.rawProductName || '未知物料',
                        sku: it.sku || '未填料号'
                    });
                }
            });
        });

        if (invalidItems.length > 0) {
            const first = invalidItems[0];
            alert(
                `🚨 出车拦截：发现 ${invalidItems.length} 个非标/未识别料号的货品！\n\n` +
                `停靠点 #${first.dropIndex} (${first.customer}):\n` +
                `品名: "${first.product}"\n` +
                `当前料号: "${first.sku}" (非系统标准料号)\n\n` +
                `⚠️ 系统严禁使用非标物料（如单个字母 M/O）出车！请在标红的 SKU 输入框中从标准料号下拉列表中选择有效物料后再提交。`
            );
            setToast({
                type: 'error',
                message: `存在 ${invalidItems.length} 个非标物料，请修正标红品项后再出车！`
            });
            return;
        }

        setIsCreatingTrip(true);
        setToast(null);

        try {
            const tripId = crypto.randomUUID();
            const totalDrops = parsedTripBatch.deliveryOrders.length;
            const defaultLoc = getDefaultLocForOrigin(parsedTripOrigin);
            const validWarehouses = getAvailableWarehousesForOrigin(parsedTripOrigin);

            // 1. Insert into trips_v2
            const { error: tripError } = await supabase
                .from('trips_v2')
                .insert({
                    id: tripId,
                    trip_number: parsedTripNumber,
                    driver_id: parsedDriverId || null,
                    lorry_id: parsedLorryId || null,
                    trip_origin: normalizeLocationCode(parsedTripOrigin) || 'TAIPING',
                    status: 'Planning',
                    created_at: new Date().toISOString()
                });

            if (tripError) {
                console.warn("trips_v2 insert non-fatal notice:", tripError.message);
            }

            // 2. Insert each DO into sales_orders
            for (let i = 0; i < parsedTripBatch.deliveryOrders.length; i++) {
                const doItem = parsedTripBatch.deliveryOrders[i];
                const orderId = crypto.randomUUID();

                const noteParts: string[] = [];
                if (doItem.isExchange && doItem.exchangeReturnNotes) {
                    noteParts.push(`[EXCHANGE / 换货: ${doItem.exchangeReturnNotes.trim()}]`);
                } else if (doItem.isExchange) {
                    noteParts.push(`[EXCHANGE / 换货]`);
                }
                if (doItem.isHandwritten) {
                    noteParts.push(`[HANDWRITTEN / 手写便签]`);
                }
                if (doItem.remarks && doItem.remarks.trim()) {
                    if (!noteParts.some(p => p.includes(doItem.remarks!.trim()))) {
                        noteParts.push(doItem.remarks.trim());
                    }
                }
                if (parsedTripRemark && parsedTripRemark.trim() && !noteParts.some(p => p.includes(parsedTripRemark.trim()))) {
                    noteParts.push(`[Trip: ${parsedTripRemark.trim()}]`);
                }
                if (doItem.phone && !noteParts.some(p => p.includes(doItem.phone))) {
                    noteParts.push(`Tel: ${doItem.phone}`);
                }
                if (doItem.terms && !noteParts.some(p => p.includes(doItem.terms))) {
                    noteParts.push(`Terms: ${doItem.terms}`);
                }
                const doSpecificNote = [doItem.remarks, doItem.customer, doItem.deliveryAddress].filter(Boolean).join(' ');
                const isSelfPickup = parsedDeliveryMethod === 'SELF_PICKUP' || 
                    /(?:self[- ]?pickup|自提|ambil\s+sendiri|customer\s+ambil)/i.test(doSpecificNote);

                const orderPayload: any = {
                    id: orderId,
                    trip_id: isSelfPickup ? null : tripId,
                    order_number: doItem.doNumber || `DO-${parsedTripNumber}-${i + 1}`,
                    customer: doItem.customer || 'General Customer',
                    delivery_address: doItem.deliveryAddress || '',
                    zone: doItem.zone || parsedZone || (isSelfPickup ? 'SELF-PICKUP' : 'Central'),
                    driver_id: isSelfPickup ? null : (parsedDriverId || null),
                    status: 'Planned',
                    order_date: parsedTripDate,
                    deadline: parsedDeliveryDate,
                    trip_origin: parsedTripOrigin.toUpperCase(),
                    trip_drop_count: isSelfPickup ? 1 : totalDrops,
                    stop_sequence: isSelfPickup ? 999 : i + 1,
                    trip_sequence: isSelfPickup ? 999 : i + 1,
                    delivery_method: isSelfPickup ? 'SELF_PICKUP' : 'Company Delivery',
                    job_type: isSelfPickup ? 'Pickup' : 'Delivery',
                    items: (doItem.items || []).map(it => {
                        let loc = it.sourceLocation;
                        if (!loc || !validWarehouses.includes(loc)) {
                            loc = guessItemLocation(it, parsedTripOrigin) || defaultLoc;
                        }
                        return {
                            product: it.product,
                            quantity: Number(it.quantity) || 1,
                            sku: it.sku || '',
                            packaging: it.uom || 'Unit',
                            sourceLocation: loc
                        };
                    }),
                    notes: noteParts.join(' | ')
                };

                const { error: soError } = await supabase
                    .from('sales_orders')
                    .insert(orderPayload);

                if (soError) {
                    throw new Error(`Failed to save DO ${doItem.doNumber}: ${soError.message}`);
                }

                // 3. Keep trip_stops_v2 in sync
                try {
                    await supabase.from('trip_stops_v2').insert({
                        trip_id: tripId,
                        sales_order_id: orderId,
                        stop_sequence: i + 1,
                        status: 'Pending'
                    });
                } catch {
                    // Non-blocking sync
                }

                // 4. Auto-Learning: Remember confirmed/adjusted item mappings for this customer in customer_sku_mappings
                if (doItem.customer && Array.isArray(doItem.items)) {
                    for (const it of doItem.items) {
                        const rawName = (it.rawProductName || it.product || '').trim();
                        const finalSku = (it.sku || '').trim();
                        if (finalSku && rawName && finalSku !== 'GENERIC-ITEM') {
                            const matchedProd = v2Items.find(x => x.sku === finalSku);
                            try {
                                await supabase.from('customer_sku_mappings').upsert({
                                    customer_name: doItem.customer.trim(),
                                    raw_product_name: rawName,
                                    mapped_sku: finalSku,
                                    mapped_product_name: matchedProd ? matchedProd.name : (it.product || rawName),
                                    updated_at: new Date().toISOString()
                                }, {
                                    onConflict: 'customer_name,raw_product_name'
                                });
                            } catch (upsertErr) {
                                console.warn("Failed to auto-learn mapping for DO:", upsertErr);
                            }
                        }
                    }
                }
            }

            handleCloseParsedTripModal();
            handleCloseModal();
            const targetOrigin = normalizeLocationCode(parsedTripOrigin);
            if (targetOrigin && targetOrigin !== normalizeLocationCode(activeLocation)) {
                setActiveLocation(targetOrigin);
                localStorage.setItem('tripActiveLocation', targetOrigin);
            }
            await fetchData();
            setToast({
                type: 'success',
                message: t('Trip {{trip}} with {{count}} DOs created successfully (Factory: {{factory}})!', {
                    trip: parsedTripNumber,
                    count: totalDrops,
                    factory: targetOrigin
                })
            });
        } catch (err: any) {
            console.error("Failed to create trip from DO PDFs:", err);
            setToast({
                type: 'error',
                message: err.message || t('Failed to create trip')
            });
        } finally {
            setIsCreatingTrip(false);
        }
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
        const defaultLoc = getDefaultLocForOrigin(tripOrigin);
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

        const isSelfPickup = draft.tripCategory === 'SELF-PICKUP' || 
            (draft.notes && /(?:self[- ]?pickup|自提|ambil\s+sendiri|customer\s+ambil)/i.test(draft.notes));

        const payload: Record<string, unknown> = {
            order_number: doNumber,
            customer: finalCustomer,
            delivery_address: draft.destinations,
            zone: isSelfPickup ? (draft.tripCategory || 'SELF-PICKUP') : draft.tripCategory,
            trip_origin: tripOrigin,
            trip_drop_count: isSelfPickup ? 1 : draft.tripDropCount,
            factory_id: finalFactoryId,
            driver_id: isSelfPickup ? null : (draft.driverId || null),
            items: draft.items,
            order_date: draft.orderDate,
            deadline: draft.deliveryDate || null,
            notes: draft.notes,
            status: 'New',
            delivery_method: isSelfPickup ? 'SELF_PICKUP' : 'Company Delivery',
            job_type: isSelfPickup ? 'Pickup' : 'Delivery',
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
            const targetOrigin = normalizeLocationCode(tripOrigin);
            if (targetOrigin && targetOrigin !== normalizeLocationCode(activeLocation)) {
                setActiveLocation(targetOrigin);
                localStorage.setItem('tripActiveLocation', targetOrigin);
            }
            await fetchData();
            setToast({
                type: 'success',
                message: `Created ${created} trip(s) from photo (Factory: ${targetOrigin}).`,
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

        // Check availability & cross-location guard
        const targetDriver = drivers.find(d => d.uid === driverId);
        if (targetDriver && targetDriver.base_location) {
            const driverLoc = normalizeLocationCode(targetDriver.base_location);
            const currentLoc = normalizeLocationCode(activeLocation);
            if (driverLoc !== currentLoc) {
                const confirmed = window.confirm(
                    `⚠️ 跨厂区批量派单确认：\n\n当前调度批次属于【${currentLoc}】，但司机 ${targetDriver.name} 基地属地为【${driverLoc}】。\n\n是否确认将这 ${selectedOrderIds.length} 笔单据跨厂区指派给该司机？`
                );
                if (!confirmed) return;
            }
        }

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
            setToast({ type: 'success', message: t('Batch assign success') });
        } catch (err) {
            console.error("Failed to batch assign:", err);
            setToast({ type: 'error', message: t('Batch assign failed') });
            fetchData();
        }
    };

    const handleMoveOrderSequence = async (orderId: string, direction: 'up' | 'down') => {
        const orderToMove = orders.find(o => o.id === orderId);
        if (!orderToMove || !orderToMove.driverId) return;

        const driverId = orderToMove.driverId;
        const driverOrders = filteredOrders
            .filter(o => o.driverId === driverId)
            .sort((a, b) => {
                const dateA = a.deadline || '';
                const dateB = b.deadline || '';
                if (dateA !== dateB) {
                    return dateB.localeCompare(dateA); // Date descending (newest on top)
                }
                return (a.tripSequence || 0) - (b.tripSequence || 0);
            });

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
                    .sort((a, b) => {
                        const dateA = a.deadline || '';
                        const dateB = b.deadline || '';
                        if (dateA !== dateB) {
                            return dateB.localeCompare(dateA); // Date descending (newest on top)
                        }
                        return (a.tripSequence || 0) - (b.tripSequence || 0);
                    });

                const updates = remainingOrders.map((o, index) =>
                    supabase.from('sales_orders').update({ trip_sequence: index + 1 }).eq('id', o.id)
                );
                await Promise.all(updates);
            }

            await fetchData();
            setToast({ type: 'success', message: t('Order unassigned') });
        } catch (err) {
            console.error("Unassign failed:", err);
            setToast({ type: 'error', message: t('Unassign failed') });
            fetchData();
        }
    };

    const handleTriggerAutoDispatch = async (overrideRules?: DispatchRuleConfig) => {
        const rulesToUse = overrideRules || dispatchRules;
        const unassigned = selectedOrderIds.length > 0
            ? filteredOrders.filter(o => selectedOrderIds.includes(o.id))
            : filteredOrders.filter(o => !o.driverId && normalizeLocationCode(o.trip_origin) === normalizeLocationCode(activeLocation));
        const activeDrivers = drivers.filter(d => normalizeLocationCode(d.base_location) === normalizeLocationCode(activeLocation));

        if (unassigned.length === 0) {
            setToast({ type: 'info', message: t('No unassigned orders found for current factory.') });
            return;
        }
        if (activeDrivers.length === 0) {
            setToast({ type: 'warning', message: t('No available drivers found for current factory.') });
            return;
        }

        setIsDispatchLoading(true);
        try {
            // 1. 获取近 72 小时的交车解绑日志与考勤下班打卡
            const driverIds = activeDrivers.map(d => d.uid || d.id).filter(Boolean);
            const employeeIds = activeDrivers.map(d => (d as any).employee_id || (d as any).employeeId).filter(Boolean);
            const attendanceQueryIds = Array.from(new Set([...driverIds, ...employeeIds]));
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

            const [shiftLogsRes, attendanceRes] = await Promise.all([
                driverIds.length > 0
                    ? supabase.from('lorry_mileage_logs')
                        .select('*')
                        .in('driver_id', driverIds)
                        .gte('created_at', threeDaysAgo)
                        .order('created_at', { ascending: false })
                    : Promise.resolve({ data: [] }),
                attendanceQueryIds.length > 0
                    ? supabase.from('operator_attendance')
                        .select('*')
                        .in('operator_id', attendanceQueryIds)
                        .gte('date', threeDaysAgo.split('T')[0])
                        .order('date', { ascending: false })
                    : Promise.resolve({ data: [] })
            ]);

            // 2. 将订单按区域与地址城镇智能聚合为车次并打包
            const baseDrafts = generateDraftTrips(unassigned);

            // 3. 执行智能休息保护与本月运费平衡派单算法
            const result = generateBalancedDriverAssignments(
                baseDrafts,
                activeDrivers,
                orders,
                deliveryRates,
                shiftLogsRes.data || [],
                attendanceRes.data || [],
                driverLeaves || [],
                activeLocation,
                rulesToUse
            );

            setAutoDispatchDrafts(result.trips);
            setDispatchDriverStats(result.driverStatsMap);
            setDispatchGroupAvg(result.groupAverageEarnings);
            setIsAutoDispatchModalOpen(true);
        } catch (err) {
            console.error("Failed to calculate balanced auto dispatch:", err);
            const fallbackDrafts = generateDraftTripsWithDrivers(unassigned, activeDrivers);
            setAutoDispatchDrafts(fallbackDrafts as any);
            setIsAutoDispatchModalOpen(true);
        } finally {
            setIsDispatchLoading(false);
        }
    };

    const handleUpdateDraftTripDriver = (tripId: string, driverId: string) => {
        if (!autoDispatchDrafts) return;
        const selectedDriver = drivers.find(d => (d.uid || d.id) === driverId);

        setAutoDispatchDrafts(prev => {
            if (!prev) return null;
            const targetTrip = prev.find(t => t.id === tripId);
            if (!targetTrip) return prev;

            const validation = validateManualDriverAssignment(
                driverId,
                targetTrip.targetDate,
                targetTrip,
                prev,
                dispatchDriverStats,
                dispatchRules
            );

            const updated = prev.map(trip => {
                if (trip.id === tripId) {
                    return {
                        ...trip,
                        recommendedDriverId: driverId || null,
                        recommendedDriverName: selectedDriver?.name || t('Not assigned'),
                        recommendationReason: validation.reason,
                        recommendationBadgeColor: validation.severity as any,
                        hasFatigueWarning: !validation.isValid,
                        fatigueWarningDetail: !validation.isValid ? validation.reason : undefined
                    };
                }
                return trip;
            });

            // 联动重算每位司机在本次方案下的预估总运费
            setDispatchDriverStats(oldStats => {
                const newStats = { ...oldStats };
                Object.keys(newStats).forEach(dId => {
                    newStats[dId] = {
                        ...newStats[dId],
                        projectedEarnings: newStats[dId].currentMtdEarnings,
                        assignedNewTripsCount: 0
                    };
                });
                updated.forEach(t => {
                    if (t.recommendedDriverId && newStats[t.recommendedDriverId]) {
                        newStats[t.recommendedDriverId].projectedEarnings += (t.estimatedEarnings || 0);
                        newStats[t.recommendedDriverId].assignedNewTripsCount += 1;
                    }
                });
                return newStats;
            });

            return updated;
        });
    };

    const handleUpdateTripEarnings = (tripId: string, customRateStr: string) => {
        const customRate = parseFloat(customRateStr);
        if (isNaN(customRate) || customRate < 0) return;

        setAutoDispatchDrafts(prev => {
            if (!prev) return null;
            const updated = prev.map(t => {
                if (t.id === tripId) {
                    return {
                        ...t,
                        estimatedEarnings: customRate,
                        isShortTrip: isShortDistanceTrip(t.originWarehouse, t.destinationsSummary, customRate, dispatchRules.shortTripMaxRate)
                    };
                }
                return t;
            });

            setDispatchDriverStats(oldStats => {
                const newStats = { ...oldStats };
                Object.keys(newStats).forEach(dId => {
                    newStats[dId] = {
                        ...newStats[dId],
                        projectedEarnings: newStats[dId].currentMtdEarnings,
                        assignedNewTripsCount: 0
                    };
                });
                updated.forEach(t => {
                    if (t.recommendedDriverId && newStats[t.recommendedDriverId]) {
                        newStats[t.recommendedDriverId].projectedEarnings += (t.estimatedEarnings || 0);
                        newStats[t.recommendedDriverId].assignedNewTripsCount += 1;
                    }
                });
                return newStats;
            });

            return updated;
        });
        setToast({ type: 'success', message: t('Trip rate updated successfully') });
    };

    const handleQuickUpdateOrderAddress = async (orderId: string, currentAddr: string) => {
        const inputAddr = window.prompt(t('Enter delivery address:'), currentAddr || '');
        if (inputAddr === null) return;
        const trimmed = inputAddr.trim();
        if (!trimmed) return;

        try {
            await supabase.from('sales_orders').update({ delivery_address: trimmed }).eq('id', orderId);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, deliveryAddress: trimmed } : o));
            setAutoDispatchDrafts(prev => {
                if (!prev) return null;
                return prev.map(trip => ({
                    ...trip,
                    orders: trip.orders.map(o => o.id === orderId ? { ...o, deliveryAddress: trimmed } : o)
                }));
            });
            setToast({ type: 'success', message: t('Address updated successfully') });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', message: t('Failed to update address') });
        }
    };

    const handleQuickUpdateOrderNotes = async (orderId: string, currentNotes: string) => {
        const input = window.prompt(t('Edit / Add Remark for this DO (订单备注与司机须知):'), currentNotes || '');
        if (input === null) return;
        const trimmed = input.trim();
        try {
            await supabase.from('sales_orders').update({ notes: trimmed || null }).eq('id', orderId);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, notes: trimmed || null } : o));
            setToast({ type: 'success', message: t('Remark updated successfully') });
        } catch (e: any) {
            console.error("Failed to update remark:", e);
            setToast({ type: 'error', message: e.message || t('Failed to update remark') });
        }
    };

    const handleSaveRulesAndRecalculate = (newRules: DispatchRuleConfig) => {
        setDispatchRules(newRules);
        saveDispatchRules(newRules);
        handleTriggerAutoDispatch(newRules);
    };

    const handleResetRules = () => {
        const def = resetDispatchRules();
        setDispatchRules(def);
        handleTriggerAutoDispatch(def);
    };

    const handleApplyAutoDispatch = async (forceApproved = false) => {
        if (!autoDispatchDrafts) return;

        // 检查是否存在疲劳/长途超限风险
        if (!forceApproved) {
            const riskWarnings: string[] = [];
            autoDispatchDrafts.forEach(t => {
                if (t.hasFatigueWarning && t.fatigueWarningDetail) {
                    riskWarnings.push(`${t.name} (${t.recommendedDriverName}): ${t.fatigueWarningDetail}`);
                }
            });

            if (riskWarnings.length > 0) {
                setPendingConfirmWarnings(riskWarnings);
                setShowDoubleConfirmModal(true);
                return;
            }
        }

        setShowDoubleConfirmModal(false);
        setIsSubmitting(true);
        try {
            const updates: any[] = [];
            const assignedDriverIds = new Set<string>();
            let assignedTripsCount = 0;

            autoDispatchDrafts.forEach(trip => {
                const driverId = trip.recommendedDriverId;
                if (!driverId) return;

                assignedDriverIds.add(driverId);
                assignedTripsCount += 1;

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
            setToast({
                type: 'success',
                message: t(`Successfully scheduled {{trips}} trips for {{drivers}} drivers!`, {
                    trips: assignedTripsCount,
                    drivers: assignedDriverIds.size,
                    defaultValue: `🎉 智能排单完成！成功为 ${assignedDriverIds.size} 位司机指派了 ${assignedTripsCount} 趟车次。`
                })
            });
            await fetchData();
        } catch (err) {
            console.error("Failed to apply auto dispatch:", err);
            setToast({ type: 'error', message: t('Application of order scheduling plan failed. (Failed to apply auto dispatch.)') });
        } finally {
            setIsSubmitting(false);
        }
    };

    // REASSIGN DRIVER HANDLER
    const handleReassignDriver = async (driverId: string) => {
        if (!reassignOrder) return;

        // Smart Reminder / Blocker
        if (!checkDriverAvailability(driverId, reassignOrder.deadline)) return;

        try {
            const tripId = reassignOrder.trip_id;
            const targetOrders = tripId ? orders.filter(o => o.trip_id === tripId) : [reassignOrder];
            const targetOrderIds = targetOrders.map(o => o.id);

            // Optimistic Update
            setOrders(prev => prev.map(o => {
                if (targetOrderIds.includes(o.id)) {
                    return { ...o, driverId: driverId };
                }
                return o;
            }));

            // Close Modal
            setIsReassignModalOpen(false);
            setReassignOrder(null);

            // DB Update
            const { error } = await supabase.from('sales_orders').update({ driver_id: driverId }).in('id', targetOrderIds);
            if (error) throw error;

            if (tripId) {
                await supabase.from('trips_v2').update({ driver_id: driverId }).eq('id', tripId);
            }

            await fetchData();

        } catch (err: any) {
            alert("Error reassigning driver: " + err.message);
            fetchData();
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

        // 🛡️ HARD SKU VALIDATION GUARD: Prohibit saving if any item is not a real SKU
        const invalidItems = (newOrderItems || []).filter(it => {
            const cleanSku = (it.sku || '').trim().toLowerCase();
            return !cleanSku || !v2Items.some(v => v.sku.toLowerCase() === cleanSku);
        });

        if (invalidItems.length > 0) {
            const itemNames = invalidItems.map((it, i) => `${i + 1}. [${it.sku || '无料号'}] ${it.product || '未命名物料'}`).join('\n');
            alert(
                `【系统防呆拦截 · 禁止出车/保存】\n\n` +
                `检测到本单包含 ${invalidItems.length} 项【非标准物料】（未匹配标准料号库）：\n` +
                itemNames + `\n\n` +
                `所有出车物料必须为系统标准 SKU。请在右侧物料列表中点击选择标准料号后再保存！`
            );
            return;
        }

        // Remind if Customer or Destinations is not filled
        const isCustomerMissing = !orderCustomer.trim() || orderCustomer.trim() === 'General Customer';
        const isAddressMissing = !newOrderAddress.trim();

        if (isCustomerMissing || isAddressMissing) {
            const missingFields = [];
            if (isCustomerMissing) missingFields.push(t('Customer / Client (customer name)'));
            if (isAddressMissing) missingFields.push(t('Destinations (destination/delivery address)'));
            
            const warningMsg = t('⚠️ Reminder: You have not filled in the following fields:\n- {{var0}}\n\nDo you want to continue creating this trip anyway?\n(Reminder: You have not filled in the above fields. Do you still want to continue creating this itinerary?)', { var0: missingFields.join('\n- ') });
            if (!window.confirm(warningMsg)) {
                return; // Cancel submission
            }
        }

        // Force assign default location if somehow blank and validate against origin
        const defaultLoc = getDefaultLocForOrigin(tripOrigin);
        const validWarehouses = getAvailableWarehousesForOrigin(tripOrigin);
        const finalizedItems = newOrderItems.map(item => {
            let loc = (item.sourceLocation && item.sourceLocation.trim() !== '') ? item.sourceLocation.trim() : defaultLoc;
            if (!validWarehouses.includes(loc)) {
                loc = guessItemLocation(item, tripOrigin) || defaultLoc;
            }
            return {
                ...item,
                sourceLocation: loc
            };
        });

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

            let finalNotes = newOrderNotes;
            if (deliveryMethod === 'SELF_PICKUP') {
                const low = finalNotes.toLowerCase();
                if (!low.includes('pickup') && !low.includes('pick up') && !low.includes('自提') && !low.includes('ambil sendiri')) {
                    finalNotes = `[Self Pickup] ${finalNotes}`.trim();
                }
            }

            const isSelfPickup = deliveryMethod === 'SELF_PICKUP' || /(?:self[- ]?pickup|自提|ambil\s+sendiri|customer\s+ambil)/i.test(finalNotes);

            const payload: any = {
                order_number: doNumber,
                customer: finalCustomer,
                delivery_address: newOrderAddress,
                zone: isSelfPickup ? (tripCategory || 'SELF-PICKUP') : (tripCategory || ''),
                trip_origin: tripOrigin,
                trip_drop_count: isSelfPickup ? 1 : tripDropCount,
                factory_id: finalFactoryId,
                driver_id: isSelfPickup ? null : (selectedDriverId || null),
                items: finalizedItems,
                order_date: newOrderDate || new Date().toISOString().split("T")[0],
                deadline: newOrderDeliveryDate || null,
                notes: finalNotes,
                delivery_method: isSelfPickup ? 'SELF_PICKUP' : 'Company Delivery',
                job_type: isSelfPickup ? 'Pickup' : 'Delivery',
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
                const existingOrder = orders.find(o => o.id === editingOrderId);
                const { error } = await supabase.from('sales_orders').update(payload).eq('id', editingOrderId);
                if (error) throw error;

                // ⚡ Cascade: If this order belongs to a multi-drop trip, cascade the updated trip_drop_count to all active sibling orders
                const tripId = (existingOrder as any)?.trip_id;
                if (tripId) {
                    await supabase.from('sales_orders')
                        .update({ trip_drop_count: payload.trip_drop_count })
                        .eq('trip_id', tripId)
                        .neq('status', 'Cancelled');
                } else if (existingOrder?.driverId && existingOrder?.orderDate) {
                    const siblingIds = orders
                        .filter(o => o.id !== editingOrderId && o.driverId === existingOrder.driverId && o.orderDate === existingOrder.orderDate && o.status !== 'Cancelled')
                        .map(o => o.id);
                    if (siblingIds.length > 0) {
                        await supabase.from('sales_orders')
                            .update({ trip_drop_count: payload.trip_drop_count })
                            .in('id', siblingIds);
                    }
                }

                // ⚡ If order is Loaded/Delivered/Pending, adjust stock ledger delta (e.g. partial delivery return)
                if (existingOrder && ['Loaded', 'Delivered', 'Pending Approval'].includes(existingOrder.status)) {
                    await adjustStockForOrderDelta(
                        doNumber,
                        (existingOrder as any).trip_origin || (existingOrder as any).tripOrigin || tripOrigin,
                        existingOrder.items,
                        payload.items
                    );
                }

                alert(`Order Updated!\nAssigned to ${finalFactoryName}`);

                // Optimistic Update: Edit (including sibling orders)
                newOrderObj = { ...orders.find(o => o.id === editingOrderId)!, ...payload, id: editingOrderId, orderNumber: doNumber };
                setOrders(prev => prev.map(o => {
                    if (o.id === editingOrderId) return newOrderObj!;
                    if (tripId && (o as any).trip_id === tripId && o.status !== 'Cancelled') {
                        return { ...o, trip_drop_count: payload.trip_drop_count };
                    }
                    if (!tripId && existingOrder?.driverId && o.driverId === existingOrder.driverId && o.orderDate === existingOrder.orderDate && o.status !== 'Cancelled') {
                        return { ...o, trip_drop_count: payload.trip_drop_count };
                    }
                    return o;
                }));

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

            const targetOrigin = normalizeLocationCode(tripOrigin);
            if (targetOrigin && targetOrigin !== normalizeLocationCode(activeLocation)) {
                setActiveLocation(targetOrigin);
                localStorage.setItem('tripActiveLocation', targetOrigin);
            }

            // Log 5W1H Activity
            const totalQty = finalizedItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
            const selectedDriverName = drivers.find(d => d.uid === selectedDriverId)?.name || '未指派';
            const actionType = editingOrderId ? 'UPDATE_DELIVERY_ORDER' : 'CREATE_DELIVERY_ORDER';
            
            logActivity(user, {
                action: actionType,
                module: '送货调度中心 (Trip & Delivery Orders)',
                target: `DO #${doNumber} - 客户: ${finalCustomer}`,
                status: 'SUCCESS',
                resultSummary: `${user?.name || '管理员'} ${editingOrderId ? '修改并保存' : '编制并创建'}送货单 #${doNumber} (客户: ${finalCustomer}，共 ${finalizedItems.length} 项 / ${totalQty} 件，指派司机: ${selectedDriverName})`,
                location: newOrderAddress || tripOrigin,
                details: {
                    orderNumber: doNumber,
                    customer: finalCustomer,
                    driverId: selectedDriverId || null,
                    driverName: selectedDriverName,
                    destination: newOrderAddress,
                    tripOrigin: tripOrigin,
                    items: finalizedItems.map(i => ({
                        sku: i.sku || 'N/A',
                        name: i.name || i.product || '商品',
                        quantity: i.quantity,
                        unit: (i as any).uom || '件',
                        sourceLocation: i.sourceLocation
                    })),
                    totalQuantity: totalQty,
                    notes: newOrderNotes || null,
                    isEdit: !!editingOrderId
                }
            });

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
        setDeliveryMethod('DELIVERY');
        setEditingOrderId(null); setNewOrderDate(getTodayStr());
        setSelectedDriverId('');
        setSelectedLorryId('');
        setOrderCustomer('');
        setNewOrderAddress('');
        setNewOrderDeliveryDate(getTomorrowStr());
        setNewOrderItems([]);
        setNewOrderNotes(''); // Reset Notes
        setTripOrigin(activeLocation.toUpperCase());
        setCurrentItemLoc(getDefaultLocForOrigin(activeLocation));
        setTripCategory('');
        setTripDropCount(1);
        setToast(null); // Clear toast on close
    };

    function getDriverName(driverId?: string) {
        if (!driverId) return 'Unassigned';
        const d = drivers.find(u => u.uid === driverId);
        if (d?.name) return d.name;
        if (allUsersMap[driverId]) return allUsersMap[driverId];
        return `Driver (${driverId.substring(0, 6)})`;
    }

    // ... (rest of functions) ...

    function getStateColor(state: string) {
        switch (state) {
            case 'Selangor': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'K. Lumpur': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'Johor': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            case 'Penang': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'Melaka': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'Perak': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
            case 'Kedah': return 'text-lime-400 bg-lime-500/10 border-lime-500/20';
            case 'Kelantan': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'N. Sembilan': return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
            case 'Pahang': return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
            case 'Terengganu': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
            case 'Perlis': return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
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

    const pendingExtraJobs = orders.filter(o => 
        ((o as any).job_type === 'Extra Job' || (o.orderNumber && o.orderNumber.startsWith('TRIP-JOB')) || (o.notes && o.notes.startsWith('[') && !o.items?.length)) && 
        o.status === 'Pending Approval'
    );

    // Driver & Lorry options for modals: STRICTLY filter to only show drivers matching the selected location
    const allDriversForModal = drivers
        .filter(d => normalizeLocationCode(d.base_location) === normalizeLocationCode(tripOrigin))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const allLorriesForModal = lorries
        .filter(l => {
            const driver = drivers.find(x => x.uid === l.driverUserId);
            if (driver) return normalizeLocationCode(driver.base_location) === normalizeLocationCode(tripOrigin);
            return true;
        })
        .sort((a, b) => (a.plateNumber || '').localeCompare(b.plateNumber || ''));

    const allDriversForParsedModal = drivers
        .filter(d => normalizeLocationCode(d.base_location) === normalizeLocationCode(parsedTripOrigin))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const modalLorry = lorries.find(l => l.id === selectedLorryId);
    const modalLoad = calculateLoad(newOrderItems || [], modalLorry);
    const modalMaxRolls = getVehicleRollCapacity(modalLorry?.plateNumber);
    const modalTotalRolls = (newOrderItems || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    const modalRollPercent = modalMaxRolls > 0 ? ((modalTotalRolls / modalMaxRolls) * 100).toFixed(1) : '0';
    const isModalOverloaded = modalTotalRolls > modalMaxRolls;
    const isModalNearCapacity = !isModalOverloaded && modalTotalRolls >= modalMaxRolls * 0.9;

    const modalUnmappedItemsCount = useMemo(() => {
        return (newOrderItems || []).reduce((count, it) => {
            const cleanSku = (it.sku || '').trim().toLowerCase();
            const isReal = Boolean(cleanSku && v2Items.some(v => v.sku.toLowerCase() === cleanSku));
            return isReal ? count : count + 1;
        }, 0);
    }, [newOrderItems, v2Items]);

    const currentEditingOrder = useMemo(() => {
        return editingOrderId ? orders.find(o => o.id === editingOrderId) : null;
    }, [editingOrderId, orders]);

    const editingTripContext = useMemo(() => {
        if (!currentEditingOrder) return null;
        const tripId = currentEditingOrder.trip_id;
        const activeSiblings = orders.filter(o =>
            o.id !== currentEditingOrder.id &&
            o.status !== 'Cancelled' &&
            (
                (tripId && o.trip_id === tripId) ||
                (!tripId && currentEditingOrder.driverId && o.driverId === currentEditingOrder.driverId && o.orderDate === currentEditingOrder.orderDate)
            )
        );
        const totalDrops = tripDropCount || Number(currentEditingOrder.trip_drop_count) || (activeSiblings.length + 1);
        const stopSeq = currentEditingOrder.stop_sequence || currentEditingOrder.tripSequence || 1;
        return {
            tripId,
            totalDrops,
            stopSeq,
            siblings: activeSiblings
        };
    }, [currentEditingOrder, orders, tripDropCount]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans selection:bg-blue-500/30">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white italic flex items-center gap-2">
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 w-3 h-10 rounded-full"></div>
                        {t('Trip Management')}
                    </h1>
                    <p className="text-slate-400 mt-1 font-medium">{t('Assign trips, track deliveries, and manage fleet.')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        ref={headerTripPdfInputRef}
                        type="file"
                        accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        multiple
                        className="hidden"
                        onChange={handleTripPdfUpload}
                    />
                    <button
                        onClick={handleOpenNewTripModal}
                        className="group relative bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl flex items-center gap-3 font-bold shadow-xl shadow-blue-900/25 transition-all active:scale-95 cursor-pointer"
                        title={t('Create a new trip (Upload DOs, Scan, or Manual Entry)')}
                    >
                        <Plus size={20} className="transition-transform group-hover:rotate-90 duration-300 shrink-0" />
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-sm font-black tracking-wide">{t('New Trip')}</span>
                            <span className="text-[10px] text-blue-200/90 font-medium">{t('AI单据解析 · 手工填单 · Excel')}</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* --- PENDING EXTRA JOBS BANNER --- */}
            {pendingExtraJobs.length > 0 && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col gap-3 shadow-lg animate-in slide-in-from-top">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <Camera size={18} className="text-emerald-400" />
                            <span>Pending Extra Job Approvals ({pendingExtraJobs.length})</span>
                        </div>
                        <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono px-2.5 py-0.5 rounded-full uppercase font-bold">
                            Perlu Kelulusan Gaji & Bukti Gambar
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingExtraJobs.map(job => {
                            const driverName = getDriverName(job.driverId);
                            const driverOrigin = ((job as any).trip_origin || (job as any).tripOrigin || 'TAIPING').toUpperCase();
                            const matched = deliveryRates.find(r => r.origin?.toUpperCase() === driverOrigin && r.location_name?.toUpperCase() === job.zone?.toUpperCase());
                            const presetAmount = matched ? matched.base_rate : 0;
                            const jobPhoto = (job as any).proof_of_load_url || (job as any).proofOfLoadUrl;

                            return (
                                <div key={job.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-slate-700 transition-all">
                                    <div className="flex gap-3 items-start">
                                        {jobPhoto ? (
                                            <a href={jobPhoto} target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-lg border border-slate-700 w-16 h-16 bg-black shrink-0">
                                                <img src={jobPhoto} alt="Proof" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[8px] bg-blue-500 text-white font-bold px-1 rounded">View</span>
                                                </div>
                                            </a>
                                        ) : (
                                            <div className="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700/50 flex flex-col items-center justify-center text-slate-600 shrink-0">
                                                <Camera size={18} />
                                                <span className="text-[7px] uppercase font-bold mt-0.5">No Photo</span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className="text-xs font-black text-white truncate">{driverName}</span>
                                                <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                                    {job.zone || 'Extra Job'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-mono">{job.deadline || job.orderDate} • {job.deliveryAddress || 'GPS Address'}</p>
                                            {job.notes && <p className="text-[10px] text-slate-300 italic line-clamp-2 mt-1">"{job.notes}"</p>}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                                        <span className="text-xs font-mono text-emerald-400 font-bold">
                                            {job.zone === 'OTHER' ? 'RM (Admin Tetap)' : `RM ${presetAmount.toFixed(2)}`}
                                        </span>
                                        <div className="flex gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReviewingExtraJob(job);
                                                    setExtraJobAmountInput(presetAmount > 0 ? presetAmount.toString() : '0');
                                                }}
                                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                            >
                                                Semak & Lulus / Review
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
                                    <div className="text-xs font-bold text-amber-500/80 flex flex-col gap-1 mt-1">
                                        {upcomingLeaves.map(l => (
                                            <div key={l.id} className="flex items-baseline gap-2">
                                                <span>{l.driverName} ({l.start_date}{l.start_date !== l.end_date ? ' ➔ ' + l.end_date : ''})</span>
                                                <span className="text-[9px] text-amber-500/60 uppercase tracking-widest break-all">"{l.reason || 'No Reason'}"</span>
                                            </div>
                                        ))}
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
            </div>            {/* Control Bar: Location Tabs, View Mode, Search & Status Filters */}
            <div className="flex flex-col gap-4 mb-6">
                {/* Row 1: Location Tabs & View Toggle */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    {/* Location Split Toggle (Taiping, Nilai, Kelantan, Johor) - ALWAYS FLEX-NOWRAP */}
                    <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 self-start md:self-center shrink-0 flex-nowrap overflow-x-auto custom-scrollbar gap-1 shadow-lg shadow-black/40">
                        {['Taiping', 'Nilai', 'Kelantan', 'Johor'].map(loc => {
                            const count = locationCounts[loc] || 0;
                            const isSelected = activeLocation === loc;
                            return (
                                <button
                                    key={loc}
                                    onClick={() => setActiveLocation(loc)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 ${
                                        isSelected
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 scale-[1.02]'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                                >
                                    <MapPin size={14} className={isSelected ? 'text-emerald-200' : 'text-slate-500'} />
                                    <span>{loc}</span>
                                    <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold transition-all ${
                                            isSelected
                                                ? 'bg-white/20 text-white'
                                                : count > 0
                                                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                                    : 'bg-slate-800/80 text-slate-500'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* View Mode & Global Auto-Dispatch */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
                        <button
                            onClick={() => handleTriggerAutoDispatch()}
                            disabled={isDispatchLoading}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-violet-950/30 transition-all active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
                            title={t('One-click smart order scheduling')}
                        >
                            <Sparkles size={14} className={isDispatchLoading ? "animate-spin" : "animate-pulse"} />
                            <span>{isDispatchLoading ? t('Calculating optimal dispatch...') : t('One-click smart order scheduling')}</span>
                            {filteredOrders.filter(o => !o.driverId).length > 0 && (
                                <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                                    {filteredOrders.filter(o => !o.driverId).length}
                                </span>
                            )}
                        </button>

                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1">
                            <button
                                onClick={() => setViewMode('dispatch')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${viewMode === 'dispatch' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
                                title={t('Dispatch Planner (intelligent/manual order scheduling)')}
                            >
                                <Truck size={14} /> {t('Dispatch Planner')}
                            </button>
                            <button
                                onClick={() => setViewMode('kanban')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
                                title={t('Kanban Board')}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
                                title={t('Table View')}
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Row 2: Search Bar & Status Filter Tabs */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
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

                    {/* Filter Tabs */}
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 self-start lg:self-center overflow-x-auto max-w-full gap-1">
                        {([
                            { key: 'All', label: 'Active' },
                            { key: 'Loaded', label: 'Loaded' },
                            { key: 'Pending Approval', label: 'Pending' },
                            { key: 'Delivered', label: 'Delivered' },
                            { key: 'Cancelled', label: 'Cancelled' },
                        ] as const).map(({ key, label }) => {
                            const count = statusCounts[key] || 0;
                            const isSelected = statusFilter === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setStatusFilter(key)}
                                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                        isSelected
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                                >
                                    <span>{label}</span>
                                    <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold transition-all ${
                                            isSelected
                                                ? 'bg-white/20 text-white'
                                                : key === 'Pending Approval' && count > 0
                                                    ? 'bg-red-500 text-white animate-pulse'
                                                    : count > 0
                                                        ? 'bg-slate-700 text-slate-300'
                                                        : 'bg-slate-900 text-slate-600'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Cross-location search alert banner */}
                {crossLocationMatches.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-300 animate-in fade-in">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base shrink-0">💡</span>
                            <span className="font-semibold">
                                {t('在当前厂区 ({{current}}) 之外找到 {{count}} 条匹配单据：', { current: activeLocation, count: crossLocationMatches.length })}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {Array.from(new Set(crossLocationMatches.map(o => normalizeLocationCode(o.trip_origin)))).map(locName => {
                                    const countInLoc = crossLocationMatches.filter(o => normalizeLocationCode(o.trip_origin) === locName).length;
                                    return (
                                        <button
                                            key={locName}
                                            onClick={() => setActiveLocation(locName)}
                                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold transition-all cursor-pointer flex items-center gap-1 text-xs"
                                        >
                                            <span>{locName}</span>
                                            <span className="bg-amber-500/40 text-amber-100 text-[10px] px-1.5 py-0.2 rounded-full font-mono">{countInLoc}</span>
                                            <span>↗</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
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
                ).map(({ id, label }) => {
                    const isSelected = !deliveryMonthPick && deliveryDateFilter === id;
                    const count = dateFilterCounts[id] || 0;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => selectDeliveryDateChip(id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5
                                ${isSelected
                                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-200 shadow-sm'
                                    : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                                }`}
                        >
                            <span>{label}</span>
                            <span
                                className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                                    isSelected
                                        ? 'bg-blue-500/40 text-blue-100'
                                        : count > 0
                                            ? 'bg-slate-800 text-slate-400'
                                            : 'text-slate-600'
                                }`}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
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

            {/* Schedule Notice: When a date filter is hiding other active orders in this factory */}
            {deliveryDateFilter !== 'all' && !deliveryMonthPick && dateFilterCounts.all > (dateFilterCounts[deliveryDateFilter] || 0) && (
                <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 text-xs text-slate-400 mb-6 animate-in fade-in">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm shrink-0">📅</span>
                        <span>
                            {t('当前按【{{filter}}】筛选仅显示 {{shown}} 笔单据。当前厂区另有 {{hidden}} 笔单据排期在其他日期。', {
                                filter: deliveryDateFilter === 'today' ? t('Today') : deliveryDateFilter === 'tomorrow' ? t('Tomorrow') : deliveryDateFilter === 'week' ? t('This week') : deliveryDateFilter === 'month' ? t('This month') : deliveryDateFilter,
                                shown: dateFilterCounts[deliveryDateFilter] || 0,
                                hidden: dateFilterCounts.all - (dateFilterCounts[deliveryDateFilter] || 0)
                            })}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => selectDeliveryDateChip('all')}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 text-[11px] font-bold shrink-0 transition-all cursor-pointer"
                    >
                        {t('查看全部 ({{total}})', { total: dateFilterCounts.all })}
                    </button>
                </div>
            )}

            {/* --- MAIN GRID / TABLE --- */}
            {viewMode === 'dispatch' ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start animate-in fade-in duration-300">
                    {/* LEFT PANEL: Unassigned Orders Pool */}
                    <div className="xl:col-span-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 min-h-[600px]">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                            <div>
                                <h2 className="text-base font-bold text-white flex items-center gap-2">
                                    <Box size={18} className="text-blue-500" />
                                    
                                                                        {t('Unassigned Order Pool (Unassigned Pool)')}
                                                                    </h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">{t('There are no valid orders assigned to the current warehouse')}</p>
                            </div>
                            <span className="bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono px-2.5 py-1 rounded-full font-bold">
                                {filteredOrders.filter(o => !o.driverId).length}  {t('one')}
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
                                <span className="text-xs font-bold text-slate-400">{t('Select All')}</span>
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
                                    <option value="">{t('-- Assign drivers in batches --')}</option>
                                    {drivers
                                        .filter(d => normalizeLocationCode(d.base_location) === normalizeLocationCode(activeLocation))
                                        .map(d => (
                                            <option key={d.uid} value={d.uid}>
                                                {d.name || d.email}
                                            </option>
                                        ))
                                    }
                                </select>

                                <button
                                    onClick={() => handleTriggerAutoDispatch()}
                                    disabled={isDispatchLoading}
                                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-950/30 transition-all active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                    <Sparkles size={13} className={isDispatchLoading ? "animate-spin" : "animate-pulse"} />
                                    {isDispatchLoading ? t('Calculating optimal dispatch...') : t('One-click smart order scheduling')}
                                </button>
                            </div>
                        </div>

                        {/* Unassigned List */}
                        <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1 custom-scrollbar">
                            {filteredOrders.filter(o => !o.driverId).length === 0 ? (
                                <div className="text-center py-12 text-slate-600 text-xs italic border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                                    
                                                                        {t('No unallocated orders')}
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
                                                        <option value="">{t('Assign a driver...')}</option>
                                                        {drivers
                                                            .filter(d => normalizeLocationCode(d.base_location) === normalizeLocationCode(activeLocation))
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
                                                    <div>{t('volume:')} <span className="text-slate-200 font-bold">{orderLoad.totalVol} m³</span></div>
                                                    <div className="border-l border-slate-800 pl-3">{t('weight:')} <span className="text-slate-200 font-bold">{orderLoad.totalWeight} kg</span></div>
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
                                    .sort((a, b) => {
                                        const dateA = a.deadline || '';
                                        const dateB = b.deadline || '';
                                        if (dateA !== dateB) {
                                            return dateB.localeCompare(dateA); // Date descending (newest on top)
                                        }
                                        return (a.tripSequence || 0) - (b.tripSequence || 0);
                                    });
                                
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
                                                        {lorry?.preferredZone || t('Unassigned area')}
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
                                                        <span className="text-slate-400">{t('Volume Vol (')}{loadStats.totalVol}/20 m³)</span>
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
                                                        <span className="text-slate-400">{t('Weight (')}{loadStats.totalWeight}/3000 kg)</span>
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
                                                    <span className="text-xs font-bold uppercase tracking-wider">{t('No orders yet (Empty)')}</span>
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
                                                                
                                                                                                                                {t('No.')} {idx + 1}  {t('trip')}
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
                                                            {order.notes && (
                                                                <div className="text-[10px] text-amber-500/80 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 mt-1 break-all">
                                                                    📝 {order.notes}
                                                                </div>
                                                            )}

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
                                                                        title={t('Move Up')}
                                                                    >
                                                                        <ArrowUp size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleMoveOrderSequence(order.id, 'down')}
                                                                        disabled={idx === driverOrders.length - 1}
                                                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                                                        title={t('Move Down')}
                                                                    >
                                                                        <ArrowDown size={14} />
                                                                    </button>
                                                                </div>

                                                                <button
                                                                    onClick={() => handleUnassignOrder(order.id)}
                                                                    className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded transition-colors"
                                                                    title={t('Unassign')}
                                                                >
                                                                    
                                                                                                                                        {t('Unassign')}
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
                                    return !o.driverId;
                                }
                                return o.driverId === driver.uid;
                            })
                            .sort((a, b) => {
                                const dateA = a.deadline || '';
                                const dateB = b.deadline || '';
                                if (dateA !== dateB) {
                                    return dateB.localeCompare(dateA); // Date descending (newest on top)
                                }
                                return (a.tripSequence || 0) - (b.tripSequence || 0);
                            });

                        // Group driverOrders by trip_id into board trip groups
                        const driverTrips: {
                            key: string;
                            tripId?: string;
                            tripNumber: string;
                            driverId?: string;
                            isMultiDrop: boolean;
                            orders: SalesOrder[];
                            totalDrops: number;
                            totalRolls: number;
                            status: string;
                            zone?: string;
                            tripOrigin?: string;
                            orderDate?: string;
                            deadline?: string;
                            notes?: string;
                        }[] = [];

                        const tripGroupMap = new Map<string, typeof driverTrips[0]>();

                        driverOrders.forEach(order => {
                            if (order.trip_id) {
                                if (!tripGroupMap.has(order.trip_id)) {
                                    const v2Trip = tripsV2List.find(t => t.id === order.trip_id);
                                    const group = {
                                        key: `trip_${order.trip_id}`,
                                        tripId: order.trip_id,
                                        tripNumber: v2Trip?.trip_number || `TRIP-${order.orderNumber || order.trip_id.slice(0, 8)}`,
                                        driverId: order.driverId,
                                        isMultiDrop: true,
                                        orders: [] as SalesOrder[],
                                        totalDrops: 0,
                                        totalRolls: 0,
                                        status: order.status || 'Planned',
                                        zone: order.zone,
                                        tripOrigin: order.trip_origin,
                                        orderDate: order.orderDate,
                                        deadline: order.deadline,
                                        notes: order.notes
                                    };
                                    tripGroupMap.set(order.trip_id, group);
                                    driverTrips.push(group);
                                }
                                const grp = tripGroupMap.get(order.trip_id)!;
                                grp.orders.push(order);
                                const specifiedDrops = grp.orders.map(o => Number(o.trip_drop_count)).filter(d => Boolean(d) && d > 0);
                                const allSameExplicit = specifiedDrops.length > 0 && specifiedDrops.every(d => d === specifiedDrops[0]);
                                grp.totalDrops = (allSameExplicit && specifiedDrops[0] > 0) ? specifiedDrops[0] : grp.orders.length;
                                const rolls = (order.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
                                grp.totalRolls += rolls;
                            } else {
                                const rolls = (order.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
                                const orderDrops = Math.max(1, Number(order.trip_drop_count) || 1);
                                driverTrips.push({
                                    key: `order_${order.id}`,
                                    tripId: undefined,
                                    tripNumber: order.orderNumber,
                                    driverId: order.driverId,
                                    isMultiDrop: orderDrops > 1,
                                    orders: [order],
                                    totalDrops: orderDrops,
                                    totalRolls: rolls,
                                    status: order.status || 'New',
                                    zone: order.zone,
                                    tripOrigin: order.trip_origin,
                                    orderDate: order.orderDate,
                                    deadline: order.deadline,
                                    notes: order.notes
                                });
                            }
                        });

                        // Sort drops inside multi-drop trips by stop_sequence
                        driverTrips.forEach(t => {
                            if (t.isMultiDrop) {
                                t.orders.sort((a, b) => ((a as any).stop_sequence || a.tripSequence || 0) - ((b as any).stop_sequence || b.tripSequence || 0));
                            }
                        });

                        if (driverTrips.length === 0 && hasActiveListFilters && driver.uid !== 'unassigned') return null;
                        // Always show Unassigned column if there are orders, or if we are in default view
                        if (driver.uid === 'unassigned' && driverTrips.length === 0 && hasActiveListFilters) return null;

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
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-sm ${isUnassigned ? 'text-slate-400' : 'text-white'}`}>{isUnassigned ? t('📦 Unassigned / New') : (driver.name || 'Unknown')}</span>
                                                {!isUnassigned && driverLeaves.some(l => l.employee_id === driver.uid && l.status === 'Approved' && (() => {
                                                    const today = new Date().toLocaleDateString('en-CA');
                                                    const start = (l.start_date || '').slice(0, 10);
                                                    const end = (l.end_date || '').slice(0, 10);
                                                    return today >= start && today <= end;
                                                })()) && (
                                                    <span className="text-[9px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1.5 py-0.5 rounded shadow-sm">
                                                        🏖️ On Leave
                                                    </span>
                                                )}
                                            </div>
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
                                                            <><Truck size={10} /> {driverTrips.length} {driverTrips.length <= 1 ? 'Trip' : 'Trips'}</>
                                                        )}
                                                    </>
                                                )}
                                                {isUnassigned && <><Box size={10} /> {t('Pending Assign')}</>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-2xl font-black text-white">{driverTrips.length}</div>
                                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                                            {driverTrips.length <= 1 ? 'Trip' : 'Trips'} ({driverOrders.length} {driverOrders.length <= 1 ? 'DO' : 'DOs'})
                                        </div>
                                    </div>
                                </div>

                                {/* One-click Smart Auto-Dispatch Button for Unassigned Column */}
                                {isUnassigned && (
                                    <div className="pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => handleTriggerAutoDispatch()}
                                            disabled={isDispatchLoading || driverOrders.length === 0}
                                            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-violet-950/30 transition-all active:scale-98 cursor-pointer"
                                        >
                                            <Sparkles size={13} className={isDispatchLoading ? "animate-spin" : "animate-pulse"} />
                                            {isDispatchLoading ? t('Calculating optimal dispatch...') : t('One-click smart order scheduling')}
                                        </button>
                                    </div>
                                )}

                                {/* Trips List (Droppable) */}
                                <Droppable droppableId={driver.uid}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={`flex-1 p-3 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar bg-[#09090b] ${snapshot.isDraggingOver ? 'bg-slate-900/50' : ''}`}
                                        >
                                            {driverTrips.map((tripGroup, tripIndex) => {
                                                const isMulti = tripGroup.isMultiDrop;
                                                const order = tripGroup.orders[0];
                                                const isExpanded = expandedTripKeys[tripGroup.key] !== false;

                                                return (
                                                    <Draggable key={tripGroup.key} draggableId={tripGroup.key} index={tripIndex}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                style={{ ...provided.draggableProps.style }}
                                                                className={`bg-[#18181b] border ${isMulti ? 'border-blue-500/30 hover:border-blue-500/60' : 'border-[#27272a] hover:border-blue-500/50'} p-4 rounded-xl hover:bg-[#202024] cursor-pointer transition-all relative group/card shadow-sm ${snapshot.isDragging ? 'shadow-2xl border-blue-500 z-50' : ''}`}
                                                            >
                                                                {/* Trip Sequence Badge */}
                                                                <div className="absolute -top-2 -right-2 bg-slate-950 border border-blue-500/60 text-blue-300 text-[9px] font-black uppercase py-0.5 px-2.5 rounded-full shadow-lg z-10 flex items-center gap-1">
                                                                    <span>🚚</span> {tripIndex + 1}{tripIndex === 0 ? 'st' : tripIndex === 1 ? 'nd' : tripIndex === 2 ? 'rd' : 'th'} Trip
                                                                </div>

                                                                {isMulti ? (
                                                                    /* MULTI-DROP TRIP CARD */
                                                                    <div>
                                                                        {/* Trip Header */}
                                                                        <div className="flex justify-between items-start mb-2.5">
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <div className="font-mono text-sm font-black text-blue-400 bg-blue-500/15 px-2.5 py-1 rounded border border-blue-500/30 tracking-wide">
                                                                                    {tripGroup.tripNumber}
                                                                                </div>
                                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                                                    {tripGroup.totalDrops} Drops
                                                                                </span>
                                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                                                    {tripGroup.totalRolls} {t('Rolls')}
                                                                                </span>
                                                                                {tripGroup.zone && (
                                                                                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getStateColor(determineState(tripGroup.zone))}`}>
                                                                                        {tripGroup.zone}
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <div className="flex items-center gap-1">
                                                                                {/* Delete Trip Button */}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (tripGroup.tripId) handleDeleteTrip(tripGroup.tripId, tripGroup.tripNumber);
                                                                                    }}
                                                                                    className="p-1.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300 rounded-md transition-colors"
                                                                                    title="Cancel Entire Trip"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>

                                                                                {/* WhatsApp Dispatch Button */}
                                                                                {tripGroup.tripId && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const driverObj = drivers.find(d => d.uid === tripGroup.driverId);
                                                                                            setWhatsappTripModal({
                                                                                                tripId: tripGroup.tripId!,
                                                                                                tripNumber: tripGroup.tripNumber,
                                                                                                driverName: driverObj?.name || driver.name || 'Pemandu',
                                                                                                driverPhone: (driverObj as any)?.phone || (driver as any)?.phone || ''
                                                                                            });
                                                                                        }}
                                                                                        className="px-2 py-1 text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 hover:text-emerald-300 rounded-md transition-colors flex items-center gap-1 text-[11px] font-bold border border-emerald-500/30 shadow-sm"
                                                                                        title="Hantar Jadual ke WhatsApp Pemandu"
                                                                                    >
                                                                                        <span>📱</span>
                                                                                        <span className="hidden sm:inline">Hantar WA</span>
                                                                                    </button>
                                                                                )}

                                                                                {/* Reassign Driver Button */}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setReassignOrder(tripGroup.orders[0]);
                                                                                        setIsReassignModalOpen(true);
                                                                                    }}
                                                                                    className="p-1.5 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors"
                                                                                    title="Reassign Entire Trip"
                                                                                >
                                                                                    <UserIcon size={14} />
                                                                                </button>

                                                                                {/* Toggle Expand */}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setExpandedTripKeys(prev => ({ ...prev, [tripGroup.key]: !isExpanded }));
                                                                                    }}
                                                                                    className="p-1 text-slate-400 hover:text-white"
                                                                                    title={isExpanded ? "Collapse" : "Expand"}
                                                                                >
                                                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        {/* Trip Product Breakdown Summary */}
                                                                        {(() => {
                                                                            const summary: Record<string, number> = {};
                                                                            tripGroup.orders.forEach(o => {
                                                                                (o.items || []).forEach(it => {
                                                                                    const name = it.product || it.sku || 'Item';
                                                                                    summary[name] = (summary[name] || 0) + (Number(it.quantity) || 0);
                                                                                });
                                                                            });
                                                                            const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);
                                                                            if (entries.length === 0) return null;

                                                                            return (
                                                                                <div className="flex flex-wrap items-center gap-1.5 my-2 pt-2 border-t border-slate-800/80">
                                                                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1 mr-0.5">
                                                                                        <span>📦</span> {t('Cargo')}:
                                                                                    </span>
                                                                                    {entries.map(([prodName, qty]) => (
                                                                                        <span
                                                                                            key={prodName}
                                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono shadow-sm"
                                                                                            title={prodName}
                                                                                        >
                                                                                            <span className="text-slate-300 font-bold truncate max-w-[120px]">{prodName}</span>
                                                                                            <span className="text-amber-400 font-black">x{qty}</span>
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Trip Info Strip */}
                                                                        <div className="text-xs text-slate-500 flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Calendar size={13} className="text-slate-500" />
                                                                                <span className="text-[10px] font-bold text-blue-400">
                                                                                    Del: {formatDateDMY(tripGroup.deadline || tripGroup.orders[0]?.deadline) || "Today"}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                                Origin: <span className="text-white font-bold">{tripGroup.tripOrigin || 'TAIPING'}</span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Trip Master Remark Banner */}
                                                                        {(() => {
                                                                            const tripNoteMatch = tripGroup.orders.find(o => o.notes?.includes('[Trip:'))?.notes?.match(/\[Trip:\s*([^\]]+)\]/)?.[1];
                                                                            if (!tripNoteMatch) return null;
                                                                            return (
                                                                                <div className="text-[10px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 mb-2 font-mono flex items-center gap-1.5">
                                                                                    <span className="shrink-0">📢</span>
                                                                                    <span className="font-bold text-amber-400">{t('Trip Note')}:</span>
                                                                                    <span className="truncate">{tripNoteMatch}</span>
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Drops List */}
                                                                        {isExpanded && (
                                                                            <div className="space-y-2 pt-1">
                                                                                {tripGroup.orders.map((doOrder, dropIdx) => (
                                                                                    <div
                                                                                        key={doOrder.id}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setEditingOrderId(doOrder.id);
                                                                                            setDeliveryMethod(isSelfPickupOrderDOM(doOrder) ? 'SELF_PICKUP' : 'DELIVERY');
                                                                                            setNewOrderDate(doOrder.orderDate || '');
                                                                                            setSelectedDriverId(doOrder.driverId || '');
                                                                                            const initialLorry = lorries.find(l => l.driverUserId === doOrder.driverId);
                                                                                            setSelectedLorryId(initialLorry ? initialLorry.id : '');
                                                                                            setOrderCustomer(doOrder.customer);
                                                                                            setNewOrderAddress(doOrder.deliveryAddress || '');
                                                                                            setNewOrderDeliveryDate(doOrder.deadline || '');
                                                                                            setNewOrderNotes(doOrder.notes || '');
                                                                                            const orderOrigin = doOrder.trip_origin || 'TAIPING';
                                                                                            setTripOrigin(orderOrigin);
                                                                                            setCurrentItemLoc(getDefaultLocForOrigin(orderOrigin));
                                                                                            setTripCategory(doOrder.zone || '');
                                                                                            setTripDropCount(doOrder.trip_drop_count || 1);
                                                                                            const defaultLoc = getDefaultLocForOrigin(orderOrigin);
                                                                                            const itemsWithExtractedLoc = (doOrder.items || []).map(item => {
                                                                                                let loc = item.sourceLocation;
                                                                                                if (!loc && item.remark && item.remark.includes('(Loc:')) {
                                                                                                    const locMatch = item.remark.match(/\(Loc:\s*(.*?)\)/);
                                                                                                    if (locMatch && locMatch[1]) loc = locMatch[1];
                                                                                                }
                                                                                                let sku = (item.sku || '').trim();
                                                                                                if (!sku && item.product) {
                                                                                                    const matched = matchV2ItemByName(item.product);
                                                                                                    if (matched) sku = matched.sku;
                                                                                                }
                                                                                                return { ...item, sku, sourceLocation: loc || defaultLoc };
                                                                                            });
                                                                                            setNewOrderItems(itemsWithExtractedLoc);
                                                                                            setEditingOrderPhoto(doOrder.proof_of_load_url || null);
                                                                                            setIsCreateModalOpen(true);
                                                                                        }}
                                                                                        className="p-2.5 rounded-lg bg-[#0f0f12] border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer space-y-1.5"
                                                                                    >
                                                                                        <div className="flex items-center justify-between gap-1">
                                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[9px] font-black shrink-0">
                                                                                                    Drop #{dropIdx + 1}
                                                                                                </span>
                                                                                                <span className="font-mono text-xs font-bold text-amber-300 truncate">
                                                                                                    {doOrder.orderNumber}
                                                                                                </span>
                                                                                                {doOrder.deliveryAddress && (
                                                                                                    <span className={`text-[9px] font-bold px-1 rounded uppercase shrink-0 ${getStateColor(determineState(doOrder.deliveryAddress))}`}>
                                                                                                        {determineState(doOrder.deliveryAddress)}
                                                                                                    </span>
                                                                                                )}
                                                                                                {doOrder.status === 'Delivered' && (
                                                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                                                                                        ✓ Delivered
                                                                                                    </span>
                                                                                                )}
                                                                                                {doOrder.status === 'Cancelled' && (
                                                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                                                                                                        ✕ Cancelled
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        const driverObj = drivers.find(d => d.uid === tripGroup.driverId);
                                                                                                        setWhatsappCustomerModal({
                                                                                                            orderNumber: doOrder.orderNumber,
                                                                                                            customerName: doOrder.customer || '',
                                                                                                            customerPhone: (doOrder as any).customer_phone || (doOrder as any).phone || '',
                                                                                                            orderStatus: doOrder.status || 'Planned',
                                                                                                            tripNumber: tripGroup.tripNumber,
                                                                                                            driverName: driverObj?.name || driver.name,
                                                                                                            driverPhone: (driverObj as any)?.phone || (driver as any)?.phone,
                                                                                                            deliveryDate: doOrder.deadline
                                                                                                        });
                                                                                                    }}
                                                                                                    className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                                                                                                    title="WhatsApp Mesej Pelanggan"
                                                                                                >
                                                                                                    <MessageSquare size={12} className="text-emerald-400/80 hover:text-emerald-400" />
                                                                                                </button>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleDeleteOrder(doOrder.id, doOrder.orderNumber);
                                                                                                    }}
                                                                                                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                                                                                    title="Cancel this DO"
                                                                                                >
                                                                                                    <Trash2 size={12} />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>

                                                                                        <div className="text-xs text-white font-bold truncate">
                                                                                            {doOrder.customer || t('Unnamed Customer')}
                                                                                        </div>

                                                                                        {doOrder.deliveryAddress && (
                                                                                            <div className="text-[11px] text-slate-400 flex items-start gap-1">
                                                                                                <MapPin size={11} className="text-slate-500 shrink-0 mt-0.5" />
                                                                                                <span className="line-clamp-1 flex-1">{doOrder.deliveryAddress}</span>
                                                                                            </div>
                                                                                        )}

                                                                                        {doOrder.notes ? (
                                                                                            <div
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleQuickUpdateOrderNotes(doOrder.id, doOrder.notes || '');
                                                                                                }}
                                                                                                className="group/note flex items-center justify-between gap-1 text-[10px] text-amber-400/90 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 break-words font-mono cursor-pointer transition-colors"
                                                                                                title={t('Click to edit remark')}
                                                                                            >
                                                                                                <span className="truncate flex-1">📝 {doOrder.notes.replace(/^\|\s*/, '').trim()}</span>
                                                                                                <Edit3 size={10} className="opacity-0 group-hover/note:opacity-100 text-amber-300 shrink-0" />
                                                                                            </div>
                                                                                        ) : (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleQuickUpdateOrderNotes(doOrder.id, '');
                                                                                                }}
                                                                                                className="text-[9px] text-slate-500 hover:text-amber-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer w-fit"
                                                                                                title={t('Add Remark')}
                                                                                            >
                                                                                                <Edit3 size={10} />
                                                                                                <span>+ {t('Remark')}</span>
                                                                                            </button>
                                                                                        )}

                                                                                        {/* Items preview inside drop */}
                                                                                        <div className="space-y-1 pt-1 border-t border-slate-800/60">
                                                                                            {(doOrder.items || []).slice(0, 3).map((item, i) => (
                                                                                                <div key={i} className="text-[10px] flex justify-between items-center gap-1">
                                                                                                    <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                                                                                                        <div className="w-1 h-1 rounded-full bg-slate-500 shrink-0"></div>
                                                                                                        <span className="text-slate-400 truncate">{item.product}</span>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                                        {item.sourceLocation && (
                                                                                                            <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-widest font-black">
                                                                                                                {item.sourceLocation}
                                                                                                            </span>
                                                                                                        )}
                                                                                                        <span className="text-slate-200 font-bold font-mono">x{item.quantity}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                            {(doOrder.items || []).length > 3 && (
                                                                                                <div className="text-[8px] text-zinc-500 font-bold text-center pt-0.5">
                                                                                                    + {(doOrder.items || []).length - 3} more items
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    /* STANDALONE SINGLE ORDER CARD */
                                                                    <div onClick={() => {
                                                                        setEditingOrderId(order.id);
                                                                        setDeliveryMethod(isSelfPickupOrderDOM(order) ? 'SELF_PICKUP' : 'DELIVERY');
                                                                        setNewOrderDate(order.orderDate || '');
                                                                        setSelectedDriverId(order.driverId || '');
                                                                        const initialLorry = lorries.find(l => l.driverUserId === order.driverId);
                                                                        setSelectedLorryId(initialLorry ? initialLorry.id : '');
                                                                        setOrderCustomer(order.customer);
                                                                        setNewOrderAddress(order.deliveryAddress || '');
                                                                        setNewOrderDeliveryDate(order.deadline || '');
                                                                        setNewOrderNotes(order.notes || '');
                                                                        const orderOrigin = order.trip_origin || 'TAIPING';
                                                                        setTripOrigin(orderOrigin);
                                                                        setCurrentItemLoc(getDefaultLocForOrigin(orderOrigin));
                                                                        setTripCategory(order.zone || '');
                                                                        setTripDropCount(order.trip_drop_count || 1);

                                                                        const defaultLoc = getDefaultLocForOrigin(orderOrigin);
                                                                        const itemsWithExtractedLoc = (order.items || []).map(item => {
                                                                            let loc = item.sourceLocation;
                                                                            if (!loc && item.remark && item.remark.includes('(Loc:')) {
                                                                                const locMatch = item.remark.match(/\(Loc:\s*(.*?)\)/);
                                                                                if (locMatch && locMatch[1]) loc = locMatch[1];
                                                                            }
                                                                            let sku = (item.sku || '').trim();
                                                                            if (!sku && item.product) {
                                                                                const matched = matchV2ItemByName(item.product);
                                                                                if (matched) sku = matched.sku;
                                                                            }
                                                                            return { ...item, sku, sourceLocation: loc || defaultLoc };
                                                                        });
                                                                        setNewOrderItems(itemsWithExtractedLoc);
                                                                        setEditingOrderPhoto(order.proof_of_load_url || null);
                                                                        setIsCreateModalOpen(true);
                                                                    }}>
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

                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setSplitOrder(order);
                                                                                        setSplitItems({});
                                                                                        setSplitTargetDriverId('');
                                                                                        setSplitTargetDate('');
                                                                                        setIsSplitModalOpen(true);
                                                                                    }}
                                                                                    className="p-1.5 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 hover:text-orange-300 rounded-md transition-colors ml-1"
                                                                                    title="Split Order / Partial Delivery"
                                                                                >
                                                                                    <Scissors size={14} />
                                                                                </button>

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const driverObj = drivers.find(d => d.uid === order.driverId);
                                                                                        setWhatsappCustomerModal({
                                                                                            orderNumber: order.orderNumber,
                                                                                            customerName: order.customer || '',
                                                                                            customerPhone: (order as any).customer_phone || (order as any).phone || '',
                                                                                            orderStatus: order.status || 'New',
                                                                                            tripNumber: order.orderNumber,
                                                                                            driverName: driverObj?.name || driver.name,
                                                                                            driverPhone: (driverObj as any)?.phone || (driver as any)?.phone,
                                                                                            deliveryDate: order.deadline
                                                                                        });
                                                                                    }}
                                                                                    className="p-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-md transition-colors ml-1"
                                                                                    title="WhatsApp Mesej Pelanggan"
                                                                                >
                                                                                    <MessageSquare size={14} />
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

                                                                        <div className="mb-2.5">
                                                                            <div className="text-xs text-white font-bold truncate">{order.customer || t('Unnamed Customer')}</div>
                                                                            {order.deliveryAddress && order.deliveryAddress.trim() ? (
                                                                                <div className="text-[11px] text-slate-400 flex items-start gap-1 mt-0.5 group/addr">
                                                                                    <MapPin size={11} className="text-slate-500 shrink-0 mt-0.5" />
                                                                                    <span className="line-clamp-1 flex-1">{order.deliveryAddress}</span>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleQuickUpdateOrderAddress(order.id, '');
                                                                                    }}
                                                                                    className="mt-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                                                                                    title={t('Click to fill address')}
                                                                                >
                                                                                    <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                                                                                    <span>⚠️ {t('Missing Delivery Address')} ({t('Click to fill address')})</span>
                                                                                </button>
                                                                            )}
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

                                                                        {order.notes ? (
                                                                            <div 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleQuickUpdateOrderNotes(order.id, order.notes || '');
                                                                                }}
                                                                                className="group/note flex items-center justify-between gap-1 text-[10px] text-amber-400/90 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/20 mb-3 break-words font-mono leading-relaxed cursor-pointer transition-colors"
                                                                                title={t('Click to edit remark')}
                                                                            >
                                                                                <span className="truncate flex-1">📝 {order.notes.replace(/^\|\s*/, '').trim()}</span>
                                                                                <Edit3 size={11} className="opacity-0 group-hover/note:opacity-100 text-amber-300 shrink-0" />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="mb-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleQuickUpdateOrderNotes(order.id, '');
                                                                                    }}
                                                                                    className="text-[10px] text-slate-500 hover:text-amber-300 px-2 py-0.5 rounded hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                                                                                    title={t('Add Remark')}
                                                                                >
                                                                                    <Edit3 size={11} />
                                                                                    <span>+ {t('Add Remark')}</span>
                                                                                </button>
                                                                            </div>
                                                                        )}

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

                                                                        {/* Approve driver quantity amendments or Extra Job */}
                                                                        {order.status === 'Pending Approval' && (() => {
                                                                            const isExtraJob = (order as any).job_type === 'Extra Job' || (order.orderNumber && order.orderNumber.startsWith('TRIP-JOB')) || (order.notes && order.notes.startsWith('[') && (!order.items || order.items.length === 0));

                                                                            if (isExtraJob) {
                                                                                return (
                                                                                    <div className="mt-4">
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleApproveAmendment(order);
                                                                                            }}
                                                                                            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-95 border border-emerald-500/30 cursor-pointer"
                                                                                        >
                                                                                            <span>📸</span> Semak & Lulus Tugasan / Review Extra Job
                                                                                        </button>
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            return (
                                                                                <div className="mt-4">
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleApproveAmendment(order);
                                                                                        }}
                                                                                        className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all active:scale-95 border border-amber-500/30 cursor-pointer"
                                                                                    >
                                                                                        <Zap size={14} className="fill-white" /> Lulus Pindaan & Tolak Stok / Approve & Deduct Stock
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                                {driverTrips.length === 0 && (
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
                                                setEditingOrderId(order.id);
                                                setDeliveryMethod(isSelfPickupOrderDOM(order) ? 'SELF_PICKUP' : 'DELIVERY');
                                                setNewOrderDate(order.orderDate || '');
                                                setSelectedDriverId(order.driverId || '');
                                                const initialLorry = lorries.find(l => l.driverUserId === order.driverId);
                                                setSelectedLorryId(initialLorry ? initialLorry.id : '');
                                                setOrderCustomer(order.customer);
                                                setNewOrderAddress(order.deliveryAddress || '');
                                                setNewOrderDeliveryDate(order.deadline || '');
                                                setNewOrderNotes(order.notes || '');
                                                const orderOrigin = order.trip_origin || 'TAIPING';
                                                setTripOrigin(orderOrigin);
                                                setCurrentItemLoc(getDefaultLocForOrigin(orderOrigin));
                                                setTripCategory(order.zone || '');
                                                setTripDropCount(order.trip_drop_count || 1);

                                                const defaultLoc = getDefaultLocForOrigin(orderOrigin);
                                                const itemsWithExtractedLoc = (order.items || []).map(item => {
                                                    let loc = item.sourceLocation;
                                                    if (!loc && item.remark && item.remark.includes('(Loc:')) {
                                                        const locMatch = item.remark.match(/\(Loc:\s*(.*?)\)/);
                                                        if (locMatch && locMatch[1]) {
                                                            loc = locMatch[1];
                                                        }
                                                    }
                                                    let sku = (item.sku || '').trim();
                                                    if (!sku && item.product) {
                                                        const matched = matchV2ItemByName(item.product);
                                                        if (matched) sku = matched.sku;
                                                    }
                                                    return { ...item, sku, sourceLocation: loc || defaultLoc };
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
                                                    {order.notes && (
                                                        <div className="text-[10px] text-amber-400 mt-0.5 truncate" title={order.notes}>
                                                            📝 {order.notes}
                                                        </div>
                                                    )}
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
                                                    <div className={`flex items-center justify-end gap-1.5 ${['Cancelled', 'Delivered'].includes(order.status) ? '' : 'opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                                                        {order.status === 'Cancelled' ? (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleRestoreToLoaded(order); }}
                                                                    className="px-2.5 py-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                                                    title="Restore to Loaded status under the assigned driver"
                                                                >
                                                                    <RotateCcw size={13} /> Re-Activate (Loaded)
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleResetToNew(order); }}
                                                                    className="px-2.5 py-1.5 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                                                    title="Reset to New status and clear driver"
                                                                >
                                                                    <RefreshCw size={13} /> Reset to New
                                                                </button>
                                                            </>
                                                        ) : order.status === 'Delivered' ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRestoreToLoaded(order); }}
                                                                className="px-2.5 py-1.5 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-300 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                                                title="Revert back to Loaded status (Undeliver)"
                                                            >
                                                                <RotateCcw size={13} /> Revert to Loaded
                                                            </button>
                                                        ) : (
                                                            <>
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
                                                            </>
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
                    <div role="dialog" aria-label={editingOrderId ? 'Edit Trip Modal' : 'Create Trip Modal'} className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-3 lg:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-slate-950 border-0 sm:border border-slate-800 rounded-none sm:rounded-2xl w-full max-w-6xl h-full sm:h-[min(96vh,920px)] overflow-hidden flex flex-col shadow-2xl shadow-black">
                            {/* Modal Header */}
                            <div className="py-3 px-4 sm:px-6 border-b border-slate-800 flex justify-between items-center gap-3 bg-slate-900/50">
                                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2 sm:gap-3">
                                    <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                                        <FileText className="text-blue-400 shrink-0" size={18} />
                                        <span>{editingOrderId ? t('Edit Delivery Order / 查看与编辑送货单') : t('Create Trip & Delivery Order / 新建送货单')}</span>
                                    </h2>
                                    {editingOrderId && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                #{currentEditingOrder?.orderNumber || editingOrderId.slice(0, 8)}
                                            </span>
                                            {currentEditingOrder?.status && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                                    currentEditingOrder.status === 'New' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                                                    currentEditingOrder.status === 'Delivered' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                                                    currentEditingOrder.status === 'Loaded' ? 'text-blue-400 border-blue-500/20 bg-blue-500/10' :
                                                    currentEditingOrder.status === 'Pending Approval' ? 'text-red-400 border-red-500/20 bg-red-500/10 animate-pulse' :
                                                    'text-slate-400 border-slate-700 bg-slate-800'
                                                }`}>
                                                    {currentEditingOrder.status}
                                                </span>
                                            )}
                                            {editingTripContext && editingTripContext.totalDrops > 1 && (
                                                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
                                                    <Truck size={11} className="text-indigo-400" />
                                                    <span>多点车次 · 第 {editingTripContext.stopSeq} 站 / 共 {editingTripContext.totalDrops} 站</span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {toast && (
                                        <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[10px] font-bold border ${toast.type === 'error' ? 'bg-red-900/40 text-red-200 border-red-500/30' : 'bg-emerald-900/40 text-emerald-200 border-emerald-500/30'}`}>
                                            <AlertTriangle size={12} />
                                            {toast.message}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleCloseModal} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all cursor-pointer" title="Close">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar bg-slate-950 min-h-0">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                                <div className="space-y-6">

                                {/* Section 1: Basic Info (Simpler) */}
                                <div className="space-y-4">
                                     {/* Delivery Method Selector (🚚 罗里派送 vs 📦 客户自提) */}
                                     <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 space-y-2">
                                         <div className="flex items-center justify-between">
                                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                 <Truck size={13} className="text-blue-400" />
                                                 <span>{t('Delivery Method')}</span>
                                             </label>
                                             {deliveryMethod === 'SELF_PICKUP' && (
                                                 <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                                                     <Package size={11} /> {t('Customer Self-Pickup')}
                                                 </span>
                                             )}
                                         </div>
                                         <div className="grid grid-cols-2 gap-2">
                                             <button
                                                 type="button"
                                                 onClick={() => setDeliveryMethod('DELIVERY')}
                                                 className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                                     deliveryMethod === 'DELIVERY'
                                                         ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                                                         : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                                                 }`}
                                             >
                                                 <Truck size={14} />
                                                 <span>{t('Lorry Delivery')}</span>
                                             </button>
                                             <button
                                                 type="button"
                                                 onClick={() => {
                                                     setDeliveryMethod('SELF_PICKUP');
                                                     setSelectedDriverId('');
                                                     setSelectedLorryId('');
                                                     if (!newOrderNotes.toLowerCase().includes('pickup') && !newOrderNotes.toLowerCase().includes('自提')) {
                                                         setNewOrderNotes(prev => prev ? `[Self Pickup] ${prev}` : '[Self Pickup]');
                                                     }
                                                 }}
                                                 className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                                     deliveryMethod === 'SELF_PICKUP'
                                                         ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40 border border-amber-400/30'
                                                         : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                                                 }`}
                                             >
                                                 <Package size={14} />
                                                 <span>{t('Customer Self-Pickup')}</span>
                                             </button>
                                         </div>

                                         {/* Dedicated Self-Pickup Bay Helper Card */}
                                         {deliveryMethod === 'SELF_PICKUP' && (
                                             <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-2.5 flex flex-col gap-1.5 animate-in fade-in">
                                                 <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                                                     <span className="flex items-center gap-1.5"><Package size={13} /> {t('客户到厂自提配置 (Self-Pickup Bay)')}</span>
                                                     <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">BAY-COLLECT</span>
                                                 </div>
                                                 <div className="text-[11px] text-amber-200/80 leading-tight">
                                                     {t('提货厂区')}: <span className="font-bold text-amber-200">{tripOrigin || 'TAIPING (OPM Lama)'}</span> · {t('自提无需指派罗里与司机，出厂凭客户签名签收放行。')}
                                                 </div>
                                             </div>
                                         )}
                                     </div>

                                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                             <div>
                                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('Assigned Lorry (license plate)')}</label>
                                                 <div className="relative">
                                                     <Truck className="absolute left-3 top-3.5 text-slate-600 z-10" size={16} />
                                                     {deliveryMethod === 'SELF_PICKUP' ? (
                                                         <input
                                                             type="text"
                                                             disabled
                                                             value="— 自提无需派车 (N/A) —"
                                                             className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl pl-10 pr-3 py-3 text-xs text-amber-400/80 font-mono italic cursor-not-allowed"
                                                         />
                                                     ) : (
                                                         <select
                                                             className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none appearance-none cursor-pointer"
                                                             value={selectedLorryId}
                                                             onChange={(e) => {
                                                                 const lorryId = e.target.value;
                                                                 setSelectedLorryId(lorryId);
                                                                 const l = lorries.find(x => x.id === lorryId);
                                                                 if (l && l.driverUserId && !selectedDriverId) {
                                                                     setSelectedDriverId(l.driverUserId);
                                                                 }
                                                             }}
                                                         >
                                                             <option value="">-- Select Lorry --</option>
                                                             {allLorriesForModal.map(l => {
                                                                 const cap = getVehicleRollCapacity(l.plateNumber);
                                                                 return (
                                                                     <option key={l.id} value={l.id}>
                                                                         {l.plateNumber} ({cap} 卷) {l.driverName ? `- ${l.driverName}` : ''}
                                                                     </option>
                                                                 );
                                                             })}
                                                         </select>
                                                     )}
                                                 </div>
                                             </div>
                                             <div>
                                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('Assigned Driver')}</label>
                                                 <div className="relative">
                                                     <UserIcon className="absolute left-3 top-3.5 text-slate-600 z-10" size={16} />
                                                     {deliveryMethod === 'SELF_PICKUP' ? (
                                                         <input
                                                             type="text"
                                                             disabled
                                                             value="— 客户到厂自提 (Customer Self-Pickup) —"
                                                             className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl pl-10 pr-3 py-3 text-xs text-amber-400/80 font-bold italic cursor-not-allowed"
                                                         />
                                                     ) : (
                                                         <select
                                                             className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm text-slate-200 focus:border-blue-500/50 outline-none appearance-none cursor-pointer"
                                                             value={selectedDriverId}
                                                             onChange={(e) => {
                                                                 const driverId = e.target.value;
                                                                 setSelectedDriverId(driverId);
                                                                 const l = lorries.find(x => x.driverUserId === driverId);
                                                                 if (l && !selectedLorryId) {
                                                                     setSelectedLorryId(l.id);
                                                                 }
                                                             }}
                                                         >
                                                             <option value="">-- Select Driver --</option>
                                                             {allDriversForModal.map(d => (
                                                                 <option key={d.uid} value={d.uid}>
                                                                     {d.name || d.email} ({d.base_location || 'Taiping'})
                                                                 </option>
                                                             ))}
                                                         </select>
                                                     )}
                                                 </div>
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
                                            // Only auto-calc drops for newly created orders so editing existing drop counts isn't overwritten
                                            if (!editingOrderId) {
                                                const drops = e.target.value.split(',').reduce((total, s) => {
                                                    if (s.trim().length === 0) return total;
                                                    const match = s.match(/[x*]\s*(\d+)/i);
                                                    if (match && match[1]) {
                                                        return total + parseInt(match[1], 10);
                                                    }
                                                    return total + 1;
                                                }, 0) || 1;
                                                setTripDropCount(drops);
                                            }
                                        }}
                                    />

                                    {/* DRIVER PAYROLL RATES: Origin, Category, Drops */}
                                    <div className="grid grid-cols-1 max-lg:gap-3 lg:grid-cols-3 gap-4 bg-slate-900/50 p-4 border border-slate-800 rounded-xl">
                                        <div>
                                            <label className="block text-[10px] font-bold text-blue-500/80 uppercase tracking-widest mb-2">{t('Origin (trip departure point)')}</label>
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
                                                            setSelectedLorryId('');
                                                            setSelectedDriverId('');
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                                            tripOrigin === loc.id
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
                                                    setSelectedLorryId('');
                                                    setSelectedDriverId('');
                                                }}
                                            >
                                                <option value="TAIPING">Taiping</option>
                                                <option value="NILAI">Nilai</option>
                                                <option value="KELANTAN">Kelantan</option>
                                                <option value="JOHOR">Johor</option>
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
                                             onChange={e => {
                                                 const val = e.target.value;
                                                 setNewOrderNotes(val);
                                                 const low = val.toLowerCase();
                                                 if ((low.includes('pickup') || low.includes('pick up') || low.includes('self-pickup') || low.includes('ambil sendiri') || low.includes('customer ambil') || low.includes('自提') || low.includes('walk in')) && deliveryMethod !== 'SELF_PICKUP') {
                                                     setDeliveryMethod('SELF_PICKUP');
                                                     setSelectedDriverId('');
                                                     setSelectedLorryId('');
                                                 }
                                             }}
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

                                {/* TRIP PREPARATION PHOTOS */}
                                {(() => {
                                    const currentOrder = orders.find(o => o.id === editingOrderId);
                                    const prepPhotos = parsePrepPhotos(currentOrder?.preparation_photo_url);
                                    if (prepPhotos.length === 0) return null;
                                    return (
                                        <div className="mt-3 p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-950/10 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <span>📦 Trip Preparation Photos / Gambar Penyediaan</span>
                                                    <span className="text-[10px] text-cyan-300/70 font-mono">({prepPhotos.length} {prepPhotos.length > 1 ? 'Photos' : 'Photo'})</span>
                                                </label>
                                            </div>
                                            <div className="flex flex-wrap gap-2.5">
                                                {prepPhotos.map((p, pIdx) => (
                                                    <div key={pIdx} className="relative group">
                                                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="block relative overflow-hidden rounded-xl border border-cyan-500/30 hover:border-cyan-400 h-24 w-24 bg-black">
                                                            <img src={p.url} alt={`Prep ${pIdx + 1}`} className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                                <span className="bg-cyan-600 text-white font-bold text-[9px] px-2 py-0.5 rounded shadow uppercase tracking-wider">Enlarge</span>
                                                            </div>
                                                            {p.location && (
                                                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/80 text-cyan-300 font-mono text-[8px] font-bold rounded border border-cyan-500/20">
                                                                    {p.location}
                                                                </span>
                                                            )}
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

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
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                            Delivery Photos (DO / Goods)
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const photos = currentOrder.pod_photo_url ? currentOrder.pod_photo_url.split(',') : [];
                                                                const nextIdx = photos.findIndex(p => !p || !p.trim());
                                                                handleTriggerAdminPodUpload(currentOrder.id, nextIdx >= 0 ? nextIdx : photos.length);
                                                            }}
                                                            disabled={isAdminPodUploading}
                                                            className="px-2 py-0.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 rounded text-[9px] font-bold uppercase transition-all flex items-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50"
                                                            title="Upload or attach DO / POD photo directly from WhatsApp/PC"
                                                        >
                                                            <Plus size={10} />
                                                            <span>{isAdminPodUploading ? 'Uploading...' : 'Upload DO / POD'}</span>
                                                        </button>
                                                    </div>
                                                    {currentOrder.pod_photo_url ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {currentOrder.pod_photo_url.split(',').map((url, idx) => {
                                                                const cleanUrl = url.trim();
                                                                const isDo = idx % 2 === 0;
                                                                if (!cleanUrl) {
                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            onClick={() => handleTriggerAdminPodUpload(currentOrder.id, idx)}
                                                                            className="h-20 w-20 rounded-lg border border-dashed border-amber-500/40 bg-amber-950/20 hover:bg-amber-900/30 hover:border-amber-400 flex flex-col items-center justify-center p-1 text-center shrink-0 cursor-pointer transition-all group"
                                                                            title={isDo ? t('Klik untuk muat naik DO / Click to upload DO') : t('Klik untuk muat naik gambar barang / Click to upload Goods photo')}
                                                                        >
                                                                            <span className="text-base group-hover:scale-110 transition-transform">📄</span>
                                                                            <span className="text-[9px] font-bold text-amber-400 mt-0.5 uppercase leading-tight group-hover:text-amber-300">
                                                                                {isDo ? t('Muat Naik DO') : t('Muat Naik')}
                                                                            </span>
                                                                            <span className="text-[8px] text-amber-300/60 font-mono">Slot {idx + 1} (Upload)</span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <div key={idx} className="relative group/pod">
                                                                        <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-lg border border-slate-800 hover:border-blue-500 h-20 w-20 bg-black flex-shrink-0 block transition-all">
                                                                            <img src={cleanUrl} alt={`POD Photo ${idx + 1}`} className="w-full h-full object-cover opacity-85 group-hover/pod:opacity-100 transition-opacity" />
                                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/pod:opacity-100 transition-opacity pointer-events-none">
                                                                                <span className="text-[9px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded shadow">View</span>
                                                                            </div>
                                                                        </a>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleTriggerAdminPodUpload(currentOrder.id, idx);
                                                                            }}
                                                                            className="absolute bottom-1 right-1 bg-black/80 hover:bg-blue-600 text-white p-1 rounded text-[8px] font-bold border border-white/20 opacity-0 group-hover/pod:opacity-100 transition-opacity cursor-pointer"
                                                                            title="Ganti gambar ini / Replace this photo"
                                                                        >
                                                                            <Edit3 size={10} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-xs text-slate-600 italic">No delivery photos uploaded</div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleTriggerAdminPodUpload(currentOrder.id, 0)}
                                                                className="text-[10px] text-blue-400 underline hover:text-blue-300 font-bold cursor-pointer"
                                                            >
                                                                Upload Now
                                                            </button>
                                                        </div>
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

                                    {/* 🚚 Roll-based Vehicle Load Dashboard (BUSINESS_RULES.md 4.1) */}
                                    <div className={`space-y-2 mb-4 p-3.5 rounded-2xl border transition-all ${
                                        isModalOverloaded 
                                            ? 'bg-red-950/30 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                            : isModalNearCapacity
                                            ? 'bg-amber-950/20 border-amber-500/40'
                                            : 'bg-slate-900/60 border-slate-800/90'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                                    <Truck size={14} className={isModalOverloaded ? 'text-red-400' : 'text-blue-400'} />
                                                    <span>{t('车辆装载率 (Roll Capacity)')}</span>
                                                </span>
                                                {modalLorry && (
                                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                                        {modalLorry.plateNumber} · 额定 {modalMaxRolls} 卷
                                                    </span>
                                                )}
                                            </div>
                                            {deliveryMethod === 'SELF_PICKUP' ? (
                                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                                    📦 客户自提 · 合计 {modalTotalRolls} 卷
                                                </span>
                                            ) : isModalOverloaded ? (
                                                <span className="text-[10px] font-black uppercase text-red-400 bg-red-950/60 border border-red-500/60 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle size={11} className="text-red-400" />
                                                    {t('超载 {{count}} 卷', { count: modalTotalRolls - modalMaxRolls })} ({modalRollPercent}%)
                                                </span>
                                            ) : isModalNearCapacity ? (
                                                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <span>⚡ 接近满载</span> ({modalRollPercent}%)
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <span>🟢 容量健康</span> ({modalRollPercent}%)
                                                </span>
                                            )}
                                        </div>

                                        {/* Primary Roll Progress Bar */}
                                        <div>
                                            <div className="flex justify-between text-[11px] font-mono font-bold leading-none mb-1.5">
                                                <span className="text-slate-300">
                                                    {t('总装载卷数')}: <span className={isModalOverloaded ? 'text-red-400 font-black' : 'text-blue-400'}>{modalTotalRolls}</span> / {modalMaxRolls} {t('卷 (Rolls)')}
                                                </span>
                                                <span className={isModalOverloaded ? 'text-red-400 font-black' : isModalNearCapacity ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                                    {modalRollPercent}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        isModalOverloaded
                                                            ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse'
                                                            : isModalNearCapacity
                                                            ? 'bg-amber-500'
                                                            : 'bg-gradient-to-r from-blue-500 to-emerald-400'
                                                    }`}
                                                    style={{ width: `${Math.min(Number(modalRollPercent), 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Secondary Volume and Weight stats */}
                                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-0.5 border-t border-slate-800/50">
                                            <span>{t('参考体积')}: {modalLoad.totalVol}/{modalLoad.maxVol} m³</span>
                                            <span>{t('参考承重')}: {modalLoad.totalWeight}/{modalLoad.maxWeight} kg</span>
                                        </div>
                                    </div>

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
                                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shrink-0"
                                                >
                                                    <Plus size={16} /> Add
                                                </button>
                                            </div>
                                        </div>
                                        <div className="px-4 py-2 border-b border-slate-800/80 text-[10px] font-bold text-slate-400 uppercase shrink-0 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Box size={12} className="text-blue-400" />
                                                <span>{t('Line items / 单内物料明细')} ({newOrderItems.length})</span>
                                            </div>
                                            {modalUnmappedItemsCount > 0 ? (
                                                <span className="text-[9px] font-black uppercase text-red-400 bg-red-950/80 border border-red-500/60 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle size={10} className="text-red-400" />
                                                    {t('需修正 {{count}} 项非标物料', { count: modalUnmappedItemsCount })}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <CheckCircle size={10} className="text-emerald-400" />
                                                    {t('全项匹配标准品')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-h-0 p-4 space-y-2.5 overflow-y-auto custom-scrollbar max-h-[min(42vh,380px)] xl:max-h-none">
                                            {newOrderItems.length === 0 ? (
                                                <div className="text-center py-12 text-slate-700 text-sm italic border-2 border-dashed border-slate-800/50 rounded-xl">
                                                    No items yet. Use Quick Add above or Scan Photo.
                                                </div>
                                            ) : (
                                                newOrderItems.map((item, idx) => {
                                                    const cleanSku = (item.sku || '').trim().toLowerCase();
                                                    const isRealSku = Boolean(cleanSku && v2Items.some(x => x.sku.toLowerCase() === cleanSku));
                                                    const matchedV2 = v2Items.find(x => x.sku.toLowerCase() === cleanSku);

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                                                                !isRealSku
                                                                    ? 'bg-red-950/25 border-2 border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                                                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                                            }`}
                                                        >
                                                            <div className="flex justify-between items-start gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-bold text-white text-sm leading-tight truncate">
                                                                        {item.product || matchedV2?.name || '未知物料'}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                        {isRealSku ? (
                                                                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                                <CheckCircle size={10} className="text-emerald-400" />
                                                                                <span>{item.sku}</span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[9px] font-black uppercase text-red-300 bg-red-600/30 border border-red-500/60 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                                                                <AlertTriangle size={10} className="text-red-400 shrink-0" />
                                                                                <span>{t('非标/必须选标准SKU')}</span>
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold border border-blue-500/20">
                                                                            {item.packaging || matchedV2?.uom || 'Unit'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {/* INLINE QUANTITY EDIT */}
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">Qty:</span>
                                                                        <input
                                                                            type="number"
                                                                            min={1}
                                                                            className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-bold text-orange-400 focus:border-orange-500 outline-none text-sm"
                                                                            value={item.quantity}
                                                                            onChange={(e) => {
                                                                                const val = Number(e.target.value);
                                                                                const updated = [...newOrderItems];
                                                                                updated[idx].quantity = val;
                                                                                setNewOrderItems(updated);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveItem(idx)}
                                                                        className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                                                                        title={t('Delete item')}
                                                                    >
                                                                        <X size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Inline standard SKU selection if invalid */}
                                                            {!isRealSku && (
                                                                <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/40 flex flex-col gap-1 mt-1">
                                                                    <label className="text-[10px] font-bold text-red-300 uppercase flex items-center gap-1">
                                                                        <AlertTriangle size={11} /> {t('重选标准料号 (匹配后允许出车):')}
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        list="global-v2items-datalist"
                                                                        className="w-full bg-red-950/80 border-2 border-red-500 text-red-100 placeholder:text-red-400 focus:border-red-400 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none animate-pulse"
                                                                        placeholder={t('-- 键入或选择标准物料 (如 BW-S50 或 SF-CLEAR) --')}
                                                                        value={item.sku ? `${item.sku} - ${item.product || ''}` : ''}
                                                                        onChange={e => handleUpdateModalItemSku(idx, e.target.value)}
                                                                    />
                                                                </div>
                                                            )}

                                                            {/* INLINE LOCATION & REMARK EDIT */}
                                                            <div className="flex flex-col sm:flex-row gap-2 mt-0.5 pt-2 border-t border-slate-900">
                                                                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                                                                    <div className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Pickup:</div>
                                                                    <select
                                                                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-blue-400 font-bold focus:border-blue-500 outline-none cursor-pointer"
                                                                        value={normalizeWarehouseName(item.sourceLocation || getDefaultLocForOrigin(tripOrigin))}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            const updated = [...newOrderItems];
                                                                            updated[idx].sourceLocation = val;
                                                                            setNewOrderItems(updated);
                                                                        }}
                                                                    >
                                                                        {getAvailableWarehousesForOrigin(tripOrigin).map(loc => (
                                                                            <option key={loc} value={loc}>{loc}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 flex-[2]">
                                                                    <div className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Remark:</div>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Add remark..."
                                                                        className="w-full bg-transparent border-b border-slate-800 text-xs text-slate-300 focus:border-blue-500 outline-none py-0.5 placeholder:text-slate-600"
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
                                                    );
                                                })
                                            )}
                                        </div>

                                    </div>
                                </div>
                                </div>
                            </div>

                            {/* Global V2 Items Datalist for Modal */}
                            <datalist id="global-v2items-datalist">
                                {v2Items.map(prod => (
                                    <option key={prod.sku} value={`${prod.sku} - ${prod.name}`}>
                                        {prod.name}
                                    </option>
                                ))}
                            </datalist>

                            {/* Modal Footer */}
                            <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs text-slate-400 flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-300">
                                        {t('合计')}: <span className="text-blue-400 font-bold">{modalTotalRolls}</span> / {modalMaxRolls} {t('卷')}
                                    </span>
                                    {modalUnmappedItemsCount > 0 && (
                                        <span className="text-[10px] font-black text-red-400 bg-red-950/60 border border-red-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                                            <AlertTriangle size={11} className="text-red-400" />
                                            {t('包含 {{count}} 项非标物料', { count: modalUnmappedItemsCount })}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                    <button onClick={handleCloseModal} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold transition-colors cursor-pointer text-xs sm:text-sm">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmitOrder}
                                        disabled={isSubmitting || modalUnmappedItemsCount > 0}
                                        data-action="SAVE_TRIP_ORDER"
                                        data-action-name={editingOrderId ? '保存送货单修改' : '创建并确认送货单'}
                                        data-target={editingOrderId ? `DO #${editingOrderId}` : `新建行程 (客户: ${orderCustomer || 'General Customer'})`}
                                        className={`px-6 sm:px-8 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer ${
                                            modalUnmappedItemsCount > 0
                                                ? 'bg-red-950/80 text-red-300 border-2 border-red-500/80 cursor-not-allowed opacity-90'
                                                : isSubmitting
                                                ? 'bg-blue-600/50 text-white cursor-not-allowed'
                                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/30'
                                        }`}
                                        title={modalUnmappedItemsCount > 0 ? `尚有 ${modalUnmappedItemsCount} 项未匹配标准料号，禁止保存！` : ''}
                                    >
                                        {isSubmitting ? (
                                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                                        ) : modalUnmappedItemsCount > 0 ? (
                                            <><AlertTriangle size={16} className="text-red-400" />存在非标物料 (禁止保存 · 需修正 {modalUnmappedItemsCount} 项)</>
                                        ) : (
                                            editingOrderId 
                                                ? `${t('Save Changes / 保存修改')} (${modalTotalRolls} 卷 · ${modalLorry?.plateNumber || '自提/未派车'})` 
                                                : `${t('Confirm Trip / 确认创建')} (${modalTotalRolls} 卷)`
                                        )}
                                    </button>
                                </div>
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
                                                    {drivers.filter(d => normalizeLocationCode(d.base_location) === normalizeLocationCode(tripOrigin)).map(d => (
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

            {/* --- DO PDF TRIP DISPATCH REVIEW (Max 15 DOs -> 1 Trip) --- */}
            {isParsedTripModalOpen && parsedTripBatch && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            handleTripPdfUpload(Array.from(e.dataTransfer.files));
                        }
                    }}
                >
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[min(94vh,860px)] overflow-hidden flex flex-col shadow-2xl shadow-black/80">
                        {/* Hidden input for appending DO PDFs / photos */}
                        <input
                            ref={appendTripPdfInputRef}
                            type="file"
                            accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            multiple
                            className="hidden"
                            onChange={handleAppendTripPdfUpload}
                        />

                        {/* Hidden input for main trip PDF / photo upload inside modal */}
                        <input
                            ref={tripPdfInputRef}
                            type="file"
                            accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            multiple
                            className="hidden"
                            onChange={handleTripPdfUpload}
                        />
                        <input
                            ref={tripPhotoInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleTripPdfUpload}
                        />
                        <input
                            ref={tripExcelInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={handleTripExcelImport}
                        />

                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-start gap-3 bg-slate-900/60">
                            <div>
                                <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 flex-wrap">
                                    <Truck className="text-blue-400" size={22} />
                                    <span>{t('Create New Trip (新建出车调度工作台)')}</span>
                                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full font-mono border border-blue-500/30 font-bold">
                                        {parsedTripBatch.deliveryOrders.length} Drops · Max 15
                                    </span>
                                    {parsedTripBatch.isFallback ? (
                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                                            ⚠️ 备用草稿 / Fallback Draft
                                        </span>
                                    ) : parsedTripBatch.modelUsed ? (
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                                            ✨ AI 识别 ({parsedTripBatch.modelUsed})
                                        </span>
                                    ) : (
                                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/30">
                                            ✍️ 手工编制模式
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {t('One trip dispatch with {{drops}} drop point(s). Total {{rolls}} rolls detected.', {
                                        drops: parsedTripBatch.deliveryOrders.length,
                                        rolls: parsedTripBatch.totalRolls
                                    })}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseParsedTripModal}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar bg-slate-950">
                            {/* Quick Intake Toolbar */}
                            <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/20 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                        <Sparkles size={18} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-slate-200 flex items-center gap-2">
                                            <span>{t('智能识别与批量导入 (Intake & Import)')}</span>
                                            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                                                AI OCR · Excel
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {t('拖拽或上传 1~15 张 DO (PDF/照片) 由 AI 自动填单，或直接在下方手工填单')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end shrink-0">
                                    <button
                                        type="button"
                                        disabled={isTripPdfParsing}
                                        onClick={() => tripPdfInputRef.current?.click()}
                                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-amber-950/40 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                        title={t('上传 1~15 张 DO PDF 或送货照片，AI 自动提取')}
                                    >
                                        {isTripPdfParsing ? (
                                            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <ImagePlus size={15} />
                                        )}
                                        <span>{isTripPdfParsing ? (pdfParseProgress || t('Parsing…')) : t('📄 上传单据/照片 (AI解析)')}</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={isTripPdfParsing}
                                        onClick={() => tripPhotoInputRef.current?.click()}
                                        className="px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                        title={t('现场调用相机拍照')}
                                    >
                                        <Camera size={15} />
                                        <span>{t('📷 拍照')}</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={isTripExcelImporting}
                                        onClick={() => tripExcelInputRef.current?.click()}
                                        className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                        title={t('导入 Excel 批量排单')}
                                    >
                                        {isTripExcelImporting ? (
                                            <span className="w-3.5 h-3.5 border-2 border-emerald-300/30 border-t-emerald-200 rounded-full animate-spin" />
                                        ) : (
                                            <FileText size={15} />
                                        )}
                                        <span>{isTripExcelImporting ? t('Importing…') : t('📊 Excel 导入')}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleDownloadTemplate}
                                        className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                        title={t('下载 Excel 导入标准模板')}
                                    >
                                        <Download size={14} />
                                        <span className="hidden sm:inline">{t('模板')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Fallback Mode Notice if AI was restricted */}
                            {parsedTripBatch.isFallback && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-300 text-xs">
                                    <AlertTriangle size={20} className="shrink-0 mt-0.5 text-amber-400" />
                                    <div className="space-y-1">
                                        <div className="font-bold text-sm text-amber-200">
                                            ⚠️ {t('自动拆分草稿模式（已提取 {{count}} 个停靠点）', { count: parsedTripBatch.deliveryOrders.length })}
                                        </div>
                                        <div className="text-amber-300/80 leading-relaxed">
                                            {parsedTripBatch.isKeyBlocked || parsedTripBatch.debugError?.includes('403') || parsedTripBatch.debugError?.includes('denied')
                                                ? t('原因：服务端配置的 Google Gemini API 密钥被 Google 限制访问 (403 Forbidden: Your project has been denied access)。需在 Google AI Studio (aistudio.google.com) 创建新 API Key 并更新，方可恢复自动 OCR 与品名数量提取。当前已自动为您拆分出各页单据，请手动核对品名与数量。')
                                                : t('原因：AI 模型暂不可用或多页识别异常，已为您生成包含 {{count}} 个停靠点的草稿单据，请核对各 DO 详情。', { count: parsedTripBatch.deliveryOrders.length })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Trip Master Settings */}
                            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                        <Truck size={16} className="text-blue-400" />
                                        <span>{t('Trip Master Settings / 车次主信息')}</span>
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                                            parsedTripBatch.totalRolls > 82 
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        }`}>
                                            📦 {parsedTripBatch.totalRolls} / 82 {t('Rolls')} ({Math.round((parsedTripBatch.totalRolls / 82) * 100)}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            {t('Trip Number / 车次编号')}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 outline-none focus:border-amber-500"
                                            value={parsedTripNumber}
                                            onChange={e => setParsedTripNumber(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            {t('Trip Date / 出车日期')}
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 [color-scheme:dark]"
                                            value={parsedTripDate}
                                            onChange={e => setParsedTripDate(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            {t('Delivery Date / 送达日期')}
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 [color-scheme:dark]"
                                            value={parsedDeliveryDate}
                                            onChange={e => setParsedDeliveryDate(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            {t('Origin Factory / 出发厂区')}
                                        </label>
                                        <input
                                            type="text"
                                            list="parsed-origin-datalist"
                                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                                            value={parsedTripOrigin}
                                            onChange={e => handleUpdateParsedTripOrigin(e.target.value)}
                                            placeholder="Taiping"
                                        />
                                        <datalist id="parsed-origin-datalist">
                                            {['Taiping', 'Nilai', 'Kelantan', 'Johor'].map(loc => (
                                                 <option key={loc} value={loc} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                 {/* Delivery Method Toggle for Trip */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <Truck size={12} className="text-blue-400" />
                                        <span>{t('Delivery Method')}:</span>
                                    </span>
                                    <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setParsedDeliveryMethod('DELIVERY')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                parsedDeliveryMethod === 'DELIVERY'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <Truck size={13} />
                                            <span>{t('Lorry Delivery')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setParsedDeliveryMethod('SELF_PICKUP');
                                                setParsedDriverId('');
                                                setParsedLorryId('');
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                parsedDeliveryMethod === 'SELF_PICKUP'
                                                    ? 'bg-amber-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <Package size={13} />
                                            <span>{t('Customer Self-Pickup')}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800/60">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            {t('Assign Driver / 指派司机')}
                                        </label>
                                        {parsedDeliveryMethod === 'SELF_PICKUP' ? (
                                            <input
                                                type="text"
                                                disabled
                                                value="— 客户到厂自提 (Self-Pickup) —"
                                                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400/80 font-bold italic cursor-not-allowed"
                                            />
                                        ) : (
                                            <select
                                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 cursor-pointer"
                                                value={parsedDriverId}
                                                onChange={e => {
                                                    const driverId = e.target.value;
                                                    setParsedDriverId(driverId);
                                                    if (driverId) {
                                                        const matchedLorry = lorries.find(l => l.driverUserId === driverId);
                                                        if (matchedLorry) setParsedLorryId(matchedLorry.id);
                                                    }
                                                }}
                                            >
                                                <option value="">{t('-- 选择司机 (可选) --')}</option>
                                                {allDriversForParsedModal.map(d => (
                                                    <option key={d.uid} value={d.uid}>
                                                        {d.name || d.email} ({d.base_location || 'Taiping'})
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            {t('Assign Lorry / 绑定车辆')}
                                        </label>
                                        {parsedDeliveryMethod === 'SELF_PICKUP' ? (
                                            <input
                                                type="text"
                                                disabled
                                                value="— 自提无需派车 (N/A) —"
                                                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400/80 font-mono italic cursor-not-allowed"
                                            />
                                        ) : (
                                            <select
                                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 cursor-pointer"
                                                value={parsedLorryId}
                                                onChange={e => setParsedLorryId(e.target.value)}
                                            >
                                                <option value="">{t('-- 选择车牌 (可选) --')}</option>
                                                {allLorriesForModal.map(l => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.plateNumber} {l.driverName ? `(${l.driverName})` : ''} {(l as any).capacity ? `· ${(l as any).capacity} rolls` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            {t('Primary Zone / 目的地主区域')}
                                        </label>
                                        <input
                                            type="text"
                                            list="modal-zone-datalist"
                                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                                            value={parsedZone}
                                            onChange={e => setParsedZone(e.target.value)}
                                            placeholder="e.g. KELANTAN, SELANGOR"
                                        />
                                        <datalist id="modal-zone-datalist">
                                            {Array.from(new Set(deliveryRates.map(r => r.location_name).filter(Boolean))).map(zone => (
                                                <option key={zone} value={zone} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                {/* Trip Master Remark / Notes */}
                                <div className="pt-2 border-t border-slate-800/60">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                                        <Edit3 size={12} className="text-amber-400" />
                                        <span>{t('Trip Remark / 车次总说明与司机指引')}</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-200 outline-none focus:border-amber-500 placeholder:text-slate-600"
                                        value={parsedTripRemark}
                                        onChange={e => setParsedTripRemark(e.target.value)}
                                        placeholder={t('例如：整车派送注意事项、回程收栈板、司机指引等...')}
                                    />
                                </div>
                            </div>

                            {/* 🚨 UNMAPPED ITEMS CRITICAL ALERT BANNER */}
                            {parsedUnmappedItemsCount > 0 && (
                                <div className="bg-gradient-to-r from-red-950/80 via-red-900/40 to-slate-900/80 border-2 border-red-500/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-200 text-xs shadow-xl shadow-red-950/50 animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-red-600/30 border border-red-500/50 text-red-400 shrink-0">
                                            <AlertTriangle size={22} className="text-red-400" />
                                        </div>
                                        <div>
                                            <div className="font-black text-sm text-red-100 flex items-center gap-2">
                                                <span>{t('🚨 严密防呆拦截：发现 {{count}} 个非标/未知料号物料！', { count: parsedUnmappedItemsCount })}</span>
                                            </div>
                                            <div className="text-[11px] text-red-300/90 mt-1 leading-relaxed">
                                                {t('系统禁止使用非标物料（如单个字母 M/O、手写代号或未录入料号）创建车次！请在下方标红的品项中从标准 SKU 下拉列表中选择有效物料后再提交。')}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="px-3.5 py-1.5 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-wider shrink-0 shadow-md shadow-red-600/30">
                                        {t('必须逐一修正')}
                                    </span>
                                </div>
                            )}

                            {/* 📦 Trip Cargo Breakdown Summary (车次装车总数清单) */}
                            {parsedCargoSummary.length > 0 && (
                                <div className="bg-slate-900/60 border border-blue-500/30 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-blue-300 uppercase tracking-wider flex items-center gap-2">
                                            <span>📦</span>
                                            <span>{t('Trip Cargo Breakdown / 各产品装车总数清单')}</span>
                                            <span className="text-[10px] font-bold text-slate-400 normal-case font-mono">
                                                ({parsedCargoSummary.length} {t('品类')}, {parsedTripBatch.totalRolls} {t('总件数')})
                                            </span>
                                        </h4>
                                        <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                                            {t('出库备货与装车核对')}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                        {parsedCargoSummary.map((prod, pIdx) => (
                                            <div
                                                key={pIdx}
                                                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800"
                                            >
                                                <div className="min-w-0 flex-1 pr-2">
                                                    <div className="text-xs font-bold text-white truncate" title={prod.name}>
                                                        {prod.name}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[9px] font-mono font-bold text-slate-400 truncate max-w-[130px]">
                                                            {prod.sku}
                                                        </span>
                                                        <span className="text-[9px] font-bold px-1 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                                                            {prod.warehouse}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-base font-mono font-black text-amber-300">
                                                        {prod.qty}
                                                    </div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">
                                                        {prod.uom}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Drops Sequence List */}
                            <div className="space-y-3">
                                {isAppendingPdf && (
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-blue-300 text-xs animate-pulse">
                                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                        <div className="font-bold">
                                            {appendProgress || t('正在追加解析单据与照片，请稍候...')}
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                            <MapPin size={16} className="text-emerald-400" />
                                            <span>{t('Drops & Delivery Orders / 经停卸货点清单')} ({parsedTripBatch.deliveryOrders.length})</span>
                                        </h4>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {t('Use arrow buttons to adjust delivery sequence (Drop 1 ➔ Drop 2)')}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={isAppendingPdf || parsedTripBatch.deliveryOrders.length >= 15}
                                            onClick={() => appendTripPdfInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-950/40 transition-all active:scale-95"
                                            title={t('追加上传 DO PDF 或送货照片')}
                                        >
                                            {isAppendingPdf ? (
                                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <ImagePlus size={14} />
                                            )}
                                            <span>{isAppendingPdf ? (appendProgress || t('正在追加解析...')) : t('+ 追加上传 (PDF/照片)')}</span>
                                        </button>

                                        <button
                                            type="button"
                                            disabled={parsedTripBatch.deliveryOrders.length >= 15}
                                            onClick={handleAddNewParsedDO}
                                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 disabled:opacity-50 text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                                            title={t('手动新增一个空白停靠点')}
                                        >
                                            <Plus size={14} />
                                            <span>{t('+ 手工添加停靠点')}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {parsedTripBatch.deliveryOrders.map((doItem, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all space-y-3"
                                        >
                                            {/* Drop Row Header */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs uppercase tracking-wider">
                                                        Drop #{idx + 1}
                                                    </span>
                                                    {doItem.isExchange && (
                                                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/50 text-purple-300 font-bold text-[11px] flex items-center gap-1 shadow-sm">
                                                            <span>🔄</span> {t('换货 (Exchange)')}
                                                        </span>
                                                    )}
                                                    {doItem.isHandwritten && (
                                                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold text-[11px] flex items-center gap-1 shadow-sm">
                                                            <span>📝</span> {t('手写便签 / 临时加单')}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-slate-400">DO:</span>
                                                        <input
                                                            type="text"
                                                            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-amber-300 w-36 outline-none focus:border-amber-500"
                                                            value={doItem.doNumber}
                                                            onChange={e => handleUpdateParsedDO(idx, 'doNumber', e.target.value)}
                                                            placeholder="OPM2609-xxxx"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                        Total: {doItem.doTotal || (doItem.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0)} {t('Rolls')}
                                                    </span>
                                                    <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                                                        <button
                                                            type="button"
                                                            disabled={idx === 0}
                                                            onClick={() => handleMoveParsedDO(idx, 'up')}
                                                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
                                                            title="Move Up in sequence"
                                                        >
                                                            <ArrowUp size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={idx === parsedTripBatch.deliveryOrders.length - 1}
                                                            onClick={() => handleMoveParsedDO(idx, 'down')}
                                                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
                                                            title="Move Down in sequence"
                                                        >
                                                            <ArrowDown size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveParsedDO(idx)}
                                                            className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors ml-1"
                                                            title="Remove DO from Trip"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Exchange Return Goods Alert Banner */}
                                            {doItem.isExchange && (
                                                <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-500/40 text-purple-200 text-xs flex items-start gap-2.5">
                                                    <span className="text-base leading-none mt-0.5">🔄</span>
                                                    <div className="flex-1">
                                                        <div className="font-bold flex flex-wrap items-center gap-1.5">
                                                            <span className="text-purple-300">{t('司机取回旧货须知 / Return Goods Task')}:</span>
                                                            <span className="font-mono bg-purple-900/60 px-1.5 py-0.5 rounded border border-purple-500/40 text-purple-100 font-bold">
                                                                {doItem.exchangeReturnNotes || t('须取回对应货物并拍照')}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-purple-300/80 mt-1">
                                                            {t('送达新货时，请司机务必向客户取回上述旧货，并在司机端上传取货照片。')}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Customer & Address */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">{t('Customer Name')}</label>
                                                    <input
                                                        type="text"
                                                        list="customers-list"
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500"
                                                        value={doItem.customer}
                                                        onChange={e => handleUpdateParsedCustomer(idx, e.target.value)}
                                                        placeholder={t('Customer name (Auto-fills address)')}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">{t('Contact Phone')}</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                                                            value={doItem.phone || ''}
                                                            onChange={e => handleUpdateParsedDO(idx, 'phone', e.target.value)}
                                                            placeholder="e.g. 011-56324303"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">{t('Delivery Zone / State')}</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                                                        value={doItem.zone || ''}
                                                        onChange={e => handleUpdateParsedDO(idx, 'zone', e.target.value)}
                                                        placeholder="Zone"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">{t('Delivery Address')}</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500"
                                                    value={doItem.deliveryAddress}
                                                    onChange={e => handleUpdateParsedDO(idx, 'deliveryAddress', e.target.value)}
                                                    placeholder="Detailed address"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                                    <Edit3 size={11} className="text-amber-400" />
                                                    <span>{t('DO Remark / 订单备注与司机须知')}</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 placeholder:text-slate-600 outline-none focus:border-amber-500 transition-all"
                                                    value={doItem.remarks || ''}
                                                    onChange={e => handleUpdateParsedDO(idx, 'remarks', e.target.value)}
                                                    placeholder={t('例如：货款现结、到达前先致电、放门卫处等...')}
                                                />
                                            </div>

                                            {/* Items List with Standard SKU Selector & Flexible Edit */}
                                            <div className="pt-2 border-t border-slate-800/60 space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <span>{t('Items & SKU Mapping / 货物与料号对应')} ({doItem.items?.length || 0})</span>
                                                    </span>
                                                    <span className="text-slate-400 text-[10px]">
                                                        💡 {t('可自由增删商品或修改品名/数量/料号，确认车次后将自动沉淀映射')}
                                                    </span>
                                                </div>

                                                {(!doItem.items || doItem.items.length === 0) ? (
                                                    <div className="p-3 rounded-xl bg-amber-950/20 border border-dashed border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                                                        <span>⚠️ {t('此停靠点暂无货品，请点击下方“+ 添加货品”手动录入。')}</span>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {doItem.items.map((it, itemIdx) => {
                                                            const cleanSku = (it.sku || '').trim().toLowerCase();
                                                            const isRealSku = Boolean(cleanSku && v2Items.some(x => x.sku.toLowerCase() === cleanSku));
                                                            return (
                                                            <div
                                                                key={itemIdx}
                                                                className={`flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-2.5 rounded-xl text-xs transition-all ${
                                                                    !isRealSku
                                                                        ? 'bg-red-950/25 border-2 border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                                                                        : 'bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80'
                                                                }`}
                                                            >
                                                                {/* Qty, UOM, and Product Name (Editable) */}
                                                                <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1 shrink-0 bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-1">
                                                                        <span className="text-[10px] font-black text-amber-400">Qty:</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            className="w-12 bg-transparent text-xs font-mono font-black text-amber-300 outline-none text-center"
                                                                            value={it.quantity}
                                                                            onChange={e => handleUpdateParsedItemQty(idx, itemIdx, Number(e.target.value) || 0)}
                                                                        />
                                                                    </div>

                                                                    <select
                                                                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-300 outline-none cursor-pointer shrink-0"
                                                                        value={it.uom || 'Rolls'}
                                                                        onChange={e => handleUpdateParsedItemUom(idx, itemIdx, e.target.value)}
                                                                    >
                                                                        <option value="Rolls">{t('Rolls / 卷')}</option>
                                                                        <option value="Box">{t('Box / 箱')}</option>
                                                                        <option value="Carton">{t('Carton / 箱')}</option>
                                                                        <option value="Units">{t('Units / 件')}</option>
                                                                        <option value="Bundle">{t('Bundle / 捆')}</option>
                                                                    </select>

                                                                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                                                                        <input
                                                                            type="text"
                                                                            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1 text-xs font-medium text-white outline-none placeholder:text-slate-600"
                                                                            placeholder={t('Product description / 货品名称描述')}
                                                                            value={it.product || it.rawProductName || ''}
                                                                            onChange={e => handleUpdateParsedItemName(idx, itemIdx, e.target.value)}
                                                                            title={it.rawProductName || it.product}
                                                                        />
                                                                        {(() => {
                                                                            const text = `${it.product || ''} ${it.rawProductName || ''}`.toLowerCase();
                                                                            let breakdownBadge: string | null = null;
                                                                            const qty = Number(it.quantity) || 0;
                                                                            if (text.includes('six rolls') || text.includes('6 rolls') || text.includes('6 roll') || text.includes('6rolls') || text.includes('carton') || text.includes('ctn')) {
                                                                                breakdownBadge = `📦 ${qty} 箱 = ${qty * 6} 卷 (6 rolls/ctn)`;
                                                                            } else if (text.includes('4 units') || text.includes('4 unit') || text.includes('4 roll') || text.includes('4roll') || text.includes('25cm')) {
                                                                                breakdownBadge = `🧻 ${qty} 捆 = ${qty * 4} 小卷 (4 units/bundle)`;
                                                                            } else if (text.includes('2 in 1') || text.includes('2 units') || text.includes('50cm')) {
                                                                                breakdownBadge = `🧻 ${qty} 捆 = ${qty * 2} 小卷 (2 in 1)`;
                                                                            }
                                                                            if (!breakdownBadge || qty <= 0) return null;
                                                                            return (
                                                                                <span className="text-[10px] text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md font-mono flex items-center gap-1 w-fit">
                                                                                    <span>💡</span>
                                                                                    <span>{breakdownBadge}</span>
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>

                                                                {/* SKU, Warehouse & Delete action */}
                                                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">
                                                                            SKU:
                                                                        </label>
                                                                        <div className="flex flex-col gap-1">
                                                                            <input
                                                                                type="text"
                                                                                list="global-v2items-datalist"
                                                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold outline-none transition-all w-44 sm:w-56 ${
                                                                                    isRealSku
                                                                                        ? 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 focus:border-emerald-400'
                                                                                        : 'bg-red-950/70 border-2 border-red-500 text-red-100 placeholder:text-red-400 focus:border-red-400 animate-pulse'
                                                                                }`}
                                                                                placeholder={t('-- 请选择标准料号 --')}
                                                                                value={it.sku ? `${it.sku} - ${it.product || ''}` : ''}
                                                                                onChange={e => handleUpdateParsedItemSku(idx, itemIdx, e.target.value)}
                                                                            />
                                                                            {!isRealSku && (
                                                                                <span className="text-[9px] font-black uppercase text-red-300 bg-red-600/30 border border-red-500/60 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                                                                    <AlertTriangle size={10} className="text-red-400 shrink-0" />
                                                                                    <span>{t('非标/必须选标准SKU')}</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">
                                                                            {t('Whs')}:
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            list="modal-warehouse-datalist"
                                                                            className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-900 border border-slate-700 text-blue-400 outline-none focus:border-blue-500 w-24 sm:w-28"
                                                                            value={it.sourceLocation || guessItemLocation(it, parsedTripOrigin)}
                                                                            onChange={e => handleUpdateParsedItemLocation(idx, itemIdx, e.target.value)}
                                                                            placeholder="Warehouse"
                                                                        />
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteParsedItem(idx, itemIdx)}
                                                                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors shrink-0"
                                                                        title={t('Delete item / 删除货品')}
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Bottom Action Toolbar for each DO */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/40">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddNewParsedItem(idx)}
                                                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                                                    >
                                                        <Plus size={13} />
                                                        <span>{t('+ 添加货品 (+ Add Product)')}</span>
                                                    </button>
                                                    {doItem.items && doItem.items.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (confirm(t('确定清空此停靠点的全部货品吗？\nAre you sure you want to clear all items for this drop?'))) {
                                                                    handleClearParsedItems(idx);
                                                                }
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 text-xs font-medium transition-colors"
                                                        >
                                                            {t('清空货品 (Clear All)')}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Bottom Append & Add Drop Card */}
                                    <div className="p-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left transition-colors">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-bold text-slate-300 flex items-center justify-center sm:justify-start gap-1.5">
                                                <Sparkles size={14} className="text-amber-400" />
                                                <span>{t('还有遗漏的单据或紧急加单？')}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {t('支持继续追加上传单据/照片，或直接手动新建空白停靠点。当前 {{count}}/15 个停靠点', { count: parsedTripBatch.deliveryOrders.length })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                disabled={isAppendingPdf || parsedTripBatch.deliveryOrders.length >= 15}
                                                onClick={() => appendTripPdfInputRef.current?.click()}
                                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-950/40 transition-all active:scale-95"
                                            >
                                                {isAppendingPdf ? (
                                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <ImagePlus size={14} />
                                                )}
                                                <span>{isAppendingPdf ? (appendProgress || t('正在追加解析...')) : t('+ 追加上传 (PDF/照片)')}</span>
                                            </button>

                                            <button
                                                type="button"
                                                disabled={parsedTripBatch.deliveryOrders.length >= 15}
                                                onClick={handleAddNewParsedDO}
                                                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                                            >
                                                <Plus size={14} />
                                                <span>{t('+ 手工添加停靠点')}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Shared Datalists for Combobox Selection */}
                        <datalist id="customers-list">
                            {customerDB.map((c, i) => (
                                <option key={c.id || i} value={c.name} />
                            ))}
                        </datalist>

                        <datalist id="global-v2items-datalist">
                            {v2Items.map(prod => (
                                <option key={prod.sku} value={`${prod.sku} - ${prod.name}`}>
                                    {prod.name}
                                </option>
                            ))}
                        </datalist>

                        <datalist id="modal-warehouse-datalist">
                            {getAvailableWarehousesForOrigin(parsedTripOrigin).map(loc => (
                                <option key={loc} value={loc} />
                            ))}
                        </datalist>

                        {/* Footer */}
                        <div className="p-4 sm:p-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
                            <div className="text-xs text-slate-400 flex items-center gap-2">
                                <CheckCircle size={16} className="text-emerald-400" />
                                <span>
                                    {t('Ready to create 1 Trip with {{count}} Delivery Orders', {
                                        count: parsedTripBatch.deliveryOrders.length
                                    })}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={handleCloseParsedTripModal}
                                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors"
                                >
                                    {t('Cancel')}
                                </button>
                                <button
                                    type="button"
                                    disabled={isCreatingTrip || parsedTripBatch.deliveryOrders.length === 0 || parsedUnmappedItemsCount > 0}
                                    onClick={handleConfirmCreateTrip}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                                        parsedUnmappedItemsCount > 0
                                            ? 'bg-slate-800 text-red-300 border-2 border-red-500/60 cursor-not-allowed opacity-90'
                                            : isCreatingTrip || parsedTripBatch.deliveryOrders.length === 0
                                            ? 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                                    }`}
                                    title={parsedUnmappedItemsCount > 0 ? `尚有 ${parsedUnmappedItemsCount} 个物料未匹配标准料号，禁止出车！` : ''}
                                >
                                    {isCreatingTrip ? (
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : parsedUnmappedItemsCount > 0 ? (
                                        <AlertTriangle size={16} className="text-red-400" />
                                    ) : (
                                        <Truck size={16} />
                                    )}
                                    <span>
                                        {isCreatingTrip
                                            ? t('Creating Trip…')
                                            : parsedUnmappedItemsCount > 0
                                            ? t('存在非标物料 (禁止出车 · 需修正 {{count}} 项)', { count: parsedUnmappedItemsCount })
                                            : t('Confirm & Dispatch Trip (确认创建车次)')}
                                    </span>
                                </button>
                            </div>
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
                                        {drivers
                                            .filter(d => normalizeLocationCode(d.base_location) === normalizeLocationCode(activeLocation))
                                            .map(d => <option key={d.uid} value={d.uid}>{d.name || d.email}</option>)}
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
                    <div className="bg-[#09090b] w-full max-w-5xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Sparkles size={20} className="text-violet-400" />
                                    {t('Smart Auto-Dispatch Recommendation')}
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                                        {t('Earnings Balanced & Rest Protected')}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {t('Prioritizes drivers with lower MTD earnings while ensuring 10h rest and daily trip limits.')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsDispatchRulesOpen(!isDispatchRulesOpen)}
                                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                                        isDispatchRulesOpen
                                            ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40'
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <Settings size={14} className={isDispatchRulesOpen ? 'animate-spin' : ''} />
                                    {t('Rules Config')}
                                </button>
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
                        </div>

                        {/* Rules Config Drawer */}
                        {isDispatchRulesOpen && (
                            <div className="bg-slate-950/95 border-b border-slate-800 p-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="max-w-4xl mx-auto space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                            <ShieldCheck size={16} className="text-violet-400" />
                                            <span>{t('Dispatch & Fatigue Protection Rules')}</span>
                                            <span className="text-[10px] text-slate-500">({t('Adjust parameters and re-calculate')})</span>
                                        </div>
                                        <button
                                            onClick={handleResetRules}
                                            className="text-[11px] text-slate-400 hover:text-white underline decoration-slate-600 transition-colors"
                                        >
                                            {t('Reset to Defaults')}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                                {t('Min Rest Hours (h)')}
                                            </label>
                                            <input
                                                type="number"
                                                min="4"
                                                max="24"
                                                step="0.5"
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold"
                                                value={dispatchRules.minRestHours}
                                                onChange={(e) => setDispatchRules({ ...dispatchRules, minRestHours: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                                {t('Short Trip Threshold (RM)')}
                                            </label>
                                            <input
                                                type="number"
                                                min="50"
                                                max="1000"
                                                step="10"
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold"
                                                value={dispatchRules.shortTripMaxRate}
                                                onChange={(e) => setDispatchRules({ ...dispatchRules, shortTripMaxRate: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                                {t('Max Short Trips / Day')}
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="5"
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold"
                                                value={dispatchRules.maxShortTripsPerDay}
                                                onChange={(e) => setDispatchRules({ ...dispatchRules, maxShortTripsPerDay: parseInt(e.target.value) || 1 })}
                                            />
                                        </div>
                                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                                {t('Max Daily Work Hours (h)')}
                                            </label>
                                            <input
                                                type="number"
                                                min="4"
                                                max="24"
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold"
                                                value={dispatchRules.maxDailyWorkHours}
                                                onChange={(e) => setDispatchRules({ ...dispatchRules, maxDailyWorkHours: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <button
                                            onClick={() => handleSaveRulesAndRecalculate(dispatchRules)}
                                            disabled={isDispatchLoading}
                                            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-violet-900/30 transition-all cursor-pointer"
                                        >
                                            <RefreshCw size={12} className={isDispatchLoading ? 'animate-spin' : ''} />
                                            {t('Save & Re-calculate')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            {/* Driver Month-to-Date Earnings & Rest Status Overview Bar */}
                            {Object.keys(dispatchDriverStats).length > 0 && (
                                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={16} className="text-emerald-400" />
                                            <span className="text-xs font-bold text-slate-200">
                                                {t('Driver Month-to-Date Earnings & Balance Overview')}
                                            </span>
                                            {dispatchGroupAvg > 0 && (
                                                <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                                    {t('Group Avg:')} RM {Math.round(dispatchGroupAvg).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-slate-500 hidden sm:inline">
                                                {t('Dynamic live recalculation upon reassignment')}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setIsDashboardCollapsed(!isDashboardCollapsed)}
                                                className="text-xs text-slate-300 hover:text-white flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 cursor-pointer transition-colors"
                                            >
                                                {isDashboardCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                                <span>{isDashboardCollapsed ? t('Expand Dashboard') : t('Collapse Dashboard')}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {!isDashboardCollapsed && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[175px] overflow-y-auto pr-1 custom-scrollbar mt-3 pt-3 border-t border-slate-800/60">
                                            {Object.values(dispatchDriverStats).map(ds => {
                                                const newlyAdded = ds.projectedEarnings - ds.currentMtdEarnings;
                                                return (
                                                    <div
                                                        key={ds.driverId}
                                                        className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between"
                                                    >
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <div className="font-bold text-xs text-white truncate max-w-[120px]">
                                                                {ds.driverName}
                                                            </div>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                                ds.isRestSufficient
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                            }`}>
                                                                {ds.restStatusText}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-baseline text-[10px] font-mono">
                                                                <span className="text-slate-400">{t('Current MTD:')}</span>
                                                                <span className="text-slate-300 font-bold">RM {Math.round(ds.currentMtdEarnings).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between items-baseline text-[10px] font-mono border-t border-slate-800/60 pt-1">
                                                                <span className="text-slate-400">{t('Projected:')}</span>
                                                                <span className="text-emerald-400 font-black">
                                                                    RM {Math.round(ds.projectedEarnings).toLocaleString()}
                                                                    {newlyAdded > 0 && (
                                                                        <span className="text-[9px] text-emerald-500 font-normal ml-1">
                                                                            (+{Math.round(newlyAdded)})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {autoDispatchDrafts.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 italic">
                                    {t('No recommended carpool itineraries were generated.')}
                                </div>
                            ) : (
                                autoDispatchDrafts.map((trip, tIdx) => (
                                    <div key={trip.id || tIdx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                                            <div>
                                                <div className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                                                    <Truck size={16} className="text-violet-400" />
                                                    {trip.name}
                                                    
                                                    {/* Trip Rate with Quick Edit & 0-rate Warning */}
                                                    <div className="flex items-center gap-1.5">
                                                        {(!trip.estimatedEarnings || trip.estimatedEarnings <= 0) ? (
                                                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded animate-pulse flex items-center gap-1">
                                                                ⚠️ {t('No delivery rate configured')}
                                                            </span>
                                                        ) : null}
                                                        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 focus-within:border-violet-500" title={t('Click to edit rate')}>
                                                            <span className="text-[10px] text-slate-500 font-bold">RM</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="10"
                                                                defaultValue={trip.estimatedEarnings ? Math.round(trip.estimatedEarnings) : 0}
                                                                onBlur={(e) => handleUpdateTripEarnings(trip.id, e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleUpdateTripEarnings(trip.id, (e.target as HTMLInputElement).value);
                                                                        (e.target as HTMLInputElement).blur();
                                                                    }
                                                                }}
                                                                className={`w-16 bg-transparent text-xs font-mono font-black focus:outline-none text-right ${
                                                                    trip.estimatedEarnings && trip.estimatedEarnings > 0 ? 'text-amber-400' : 'text-amber-300'
                                                                }`}
                                                            />
                                                            <Edit3 size={11} className="text-slate-600 ml-0.5 pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                        trip.isShortTrip 
                                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                                            : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                    }`}>
                                                        {trip.isShortTrip ? t('Local Short Trip') : t('Outstation Long Trip')}
                                                    </span>
                                                </div>

                                                {/* Structured Route Distribution */}
                                                <div className="text-xs text-slate-300 font-medium mt-1.5 flex flex-wrap items-center gap-2">
                                                    <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center gap-1.5">
                                                        <MapPin size={12} className="text-violet-400 shrink-0" />
                                                        <span className="text-slate-400">{t('Route:')}</span>
                                                        <strong className="text-slate-100">{trip.destinationsSummary || trip.zone}</strong>
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        ({t('Zone:')} {trip.zone})
                                                    </span>
                                                </div>

                                                {trip.recommendationReason && (
                                                    <div className="mt-1.5">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                                                            trip.recommendationBadgeColor === 'emerald'
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                : trip.recommendationBadgeColor === 'purple'
                                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                                : trip.recommendationBadgeColor === 'amber'
                                                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                : trip.recommendationBadgeColor === 'red'
                                                                ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse font-black'
                                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                        }`}>
                                                            {trip.recommendationBadgeColor === 'red' ? (
                                                                <AlertTriangle size={11} className="text-red-400" />
                                                            ) : (
                                                                <Sparkles size={11} />
                                                            )}
                                                            {trip.recommendationReason}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                                                <div className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-[11px]">
                                                    {t('Drops:')} <span className="font-bold text-slate-200">{trip.dropCount || trip.orders?.length || 1}</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{t('Driver:')}</span>
                                                    <select
                                                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-violet-500 font-sans"
                                                        value={trip.recommendedDriverId || ''}
                                                        onChange={(e) => handleUpdateDraftTripDriver(trip.id, e.target.value)}
                                                    >
                                                        <option value="">{t('-- Unassigned --')}</option>
                                                        {drivers
                                                            .filter(d => normalizeLocationCode(d.base_location) === normalizeLocationCode(activeLocation))
                                                            .map(d => {
                                                                const stat = dispatchDriverStats[d.uid || d.id];
                                                                const mtd = stat ? Math.round(stat.currentMtdEarnings) : 0;
                                                                const rest = stat && stat.restHoursFromLastWork < 90 ? `(休${stat.restHoursFromLastWork.toFixed(0)}h)` : '';
                                                                return (
                                                                    <option key={d.uid || d.id} value={d.uid || d.id}>
                                                                        {d.name} - RM {mtd} {rest}
                                                                    </option>
                                                                );
                                                            })
                                                        }
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Orders inside this trip */}
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('Contains delivery note (')}{trip.orders.length}  {t('one)')}</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {trip.orders.map((order, oIdx) => (
                                                    <div key={order.id || oIdx} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs flex flex-col justify-between">
                                                        <div>
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
                                                            <div className="font-bold text-slate-200 mb-1 truncate">{order.customer || t('Customer')}</div>
                                                            
                                                            {/* Delivery Address with Missing Warning & Quick Edit */}
                                                            {order.deliveryAddress && order.deliveryAddress.trim() ? (
                                                                <div className="text-[10px] text-slate-400 flex items-start gap-1 mb-2 group/addr">
                                                                    <MapPin size={11} className="text-slate-500 shrink-0 mt-0.5" />
                                                                    <span className="line-clamp-2 flex-1">{order.deliveryAddress}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleQuickUpdateOrderAddress(order.id, order.deliveryAddress || '')}
                                                                        className="opacity-0 group-hover/addr:opacity-100 text-slate-500 hover:text-violet-400 p-0.5 transition-opacity cursor-pointer"
                                                                        title={t('Click to fill address')}
                                                                    >
                                                                        <Edit3 size={11} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="mb-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleQuickUpdateOrderAddress(order.id, '')}
                                                                        className="text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded flex items-center gap-1.5 transition-colors cursor-pointer w-full text-left"
                                                                        title={t('Click to fill address')}
                                                                    >
                                                                        <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                                                                        <span>⚠️ {t('Missing Delivery Address')} ({t('Click to fill address')})</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="space-y-0.5 border-t border-slate-900 pt-1.5 mt-1">
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
                        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-slate-400 flex items-center gap-3">
                                <span>{t('Total Recommended Trips:')} <strong className="text-white">{autoDispatchDrafts.length}</strong></span>
                                <span className="text-slate-600">|</span>
                                <span>{t('Total Estimated Earnings:')} <strong className="text-emerald-400 font-mono">RM {Math.round(autoDispatchDrafts.reduce((acc, t) => acc + (t.estimatedEarnings || 0), 0)).toLocaleString()}</strong></span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setIsAutoDispatchModalOpen(false);
                                        setAutoDispatchDrafts(null);
                                    }}
                                    className="px-6 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-sm transition-colors cursor-pointer"
                                >
                                    {t('Cancel')}
                                </button>
                                <button
                                    onClick={handleApplyAutoDispatch}
                                    disabled={isSubmitting || autoDispatchDrafts.length === 0}
                                    className="px-8 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-900/30 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                                >
                                    {isSubmitting ? (
                                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('Applying...')}</>
                                    ) : (
                                        <>
                                            <CheckCircle size={16} />
                                            {t('Apply Scheme')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DOUBLE CONFIRMATION MODAL (FATIGUE / OVER-LIMIT SPECIAL APPROVAL) */}
            {showDoubleConfirmModal && (
                <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-5 border-b border-slate-800 bg-amber-500/10 flex items-center gap-3">
                            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white">
                                    {t('Double Confirmation: Fatigue/Trip Limit Risk')}
                                </h3>
                                <p className="text-xs text-amber-400/90 mt-0.5">
                                    {t('Are you sure you want to approve special dispatch?')}
                                </p>
                            </div>
                        </div>

                        <div className="p-5 overflow-y-auto max-h-[350px] space-y-2.5">
                            {pendingConfirmWarnings.map((warning, idx) => (
                                <div key={idx} className="bg-slate-950 border border-amber-500/30 rounded-xl p-3 text-xs text-slate-200 flex items-start gap-2.5">
                                    <span className="text-amber-400 font-bold shrink-0">#{idx + 1}</span>
                                    <div className="leading-relaxed">{warning}</div>
                                </div>
                            ))}
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300">
                                <p className="font-bold mb-1">⚠️ {t('Dispatch Safety Reminder:')}</p>
                                <p className="text-[11px] text-red-300/80">
                                    {t('Assigning multiple long trips or scheduling drivers with insufficient rest (<10h) increases safety risks. Proceed only if fully evaluated.')}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDoubleConfirmModal(false)}
                                className="px-5 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                            >
                                {t('Back to Adjust')}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyAutoDispatch(true)}
                                className="px-6 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-amber-950/40 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                            >
                                <CheckCircle size={15} />
                                {t('Special Approval & Apply Dispatch')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REVIEW EXTRA JOB MODAL */}
            {reviewingExtraJob && (() => {
                const driverName = getDriverName(reviewingExtraJob.driverId);
                const driverOrigin = ((reviewingExtraJob as any).trip_origin || (reviewingExtraJob as any).tripOrigin || 'TAIPING').toUpperCase();
                const matched = deliveryRates.find(r => r.origin?.toUpperCase() === driverOrigin && r.location_name?.toUpperCase() === reviewingExtraJob.zone?.toUpperCase());
                const jobPhoto = (reviewingExtraJob as any).proof_of_load_url || (reviewingExtraJob as any).proofOfLoadUrl;

                return (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        📸 Semakan Tugasan Tambahan / Extra Job Review
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-mono">{reviewingExtraJob.orderNumber}</p>
                                </div>
                                <button onClick={() => setReviewingExtraJob(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-5 overflow-y-auto space-y-4 text-xs">
                                {/* Driver & Category Info */}
                                <div className="grid grid-cols-2 gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
                                    <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Pemandu / Driver</span>
                                        <span className="text-sm font-black text-white">{driverName}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Kategori Tugasan</span>
                                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-black border border-emerald-500/30 text-xs">
                                            {reviewingExtraJob.zone || 'Extra Job'}
                                        </span>
                                    </div>
                                </div>

                                {/* Photo Proof */}
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1.5">
                                        Bukti Gambar / Photo Proof:
                                    </span>
                                    {jobPhoto ? (
                                        <a href={jobPhoto} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-700 bg-black h-56">
                                            <img src={jobPhoto} alt="Extra Job Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="bg-blue-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg">Klik untuk Zoom</span>
                                            </div>
                                        </a>
                                    ) : (
                                        <div className="h-32 bg-slate-950 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600">
                                            Tiada Gambar Dimuat Naik
                                        </div>
                                    )}
                                </div>

                                {/* Details & Notes */}
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Lokasi & Tarikh:</span>
                                        <span className="text-slate-300 font-mono text-[11px]">{reviewingExtraJob.deliveryAddress || 'GPS'} • {reviewingExtraJob.deadline || reviewingExtraJob.orderDate}</span>
                                    </div>
                                    {reviewingExtraJob.notes && (
                                        <div>
                                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Catatan Pemandu / Notes:</span>
                                            <p className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 italic text-[11px] whitespace-pre-line">{reviewingExtraJob.notes}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Salary Amount Input / Confirmation */}
                                <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl space-y-2">
                                    <label className="text-xs font-black text-emerald-400 uppercase tracking-wide block">
                                        💵 Sahkan Jumlah Gaji / Approved Salary Amount (RM):
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-slate-400 font-mono">RM</span>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={extraJobAmountInput}
                                            onChange={e => setExtraJobAmountInput(e.target.value)}
                                            className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-base font-mono font-bold text-emerald-300 outline-none focus:ring-1 focus:ring-emerald-400"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic">
                                        * Jumlah ini akan dimasukkan terus ke dalam gaji biasa pemandu (Trip/Basic Earnings) untuk bulan ini.
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleRejectExtraJob(reviewingExtraJob)}
                                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-xl font-bold transition-all text-xs cursor-pointer"
                                >
                                    ❌ Tolak / Reject
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApproveExtraJob(reviewingExtraJob, parseFloat(extraJobAmountInput) || 0)}
                                    className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black transition-all text-xs shadow-lg shadow-emerald-950/40 active:scale-95 cursor-pointer"
                                >
                                    ✅ Luluskan & Kredit Gaji (RM {(parseFloat(extraJobAmountInput) || 0).toFixed(2)})
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Global Floating Toast */}
            {toast && (
                <div className="fixed top-20 right-6 z-[200] animate-in fade-in slide-in-from-top-4 duration-300 max-w-md">
                    <div className={`px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl border backdrop-blur-md ${
                        toast.type === 'error'
                            ? 'bg-rose-950/95 text-rose-100 border-rose-500/50 shadow-rose-950/60'
                            : 'bg-emerald-950/95 text-emerald-100 border-emerald-500/50 shadow-emerald-950/60'
                    }`}>
                        {toast.type === 'error' ? <AlertTriangle size={20} className="shrink-0 text-rose-400" /> : <CheckCircle size={20} className="shrink-0 text-emerald-400" />}
                        <div className="text-sm font-semibold flex-1 leading-snug">{toast.message}</div>
                        <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
                    </div>
                </div>
            )}

            {/* DO PDF Parsing Full-Screen Loading Overlay */}
            {isTripPdfParsing && (
                <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-amber-950/50 text-center flex flex-col items-center gap-5">
                        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center relative">
                            <FileText className="text-amber-400 animate-pulse" size={38} />
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
                            </span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-white">AI 智能解析送货单 (DO PDF)</h3>
                            <p className="text-sm font-bold text-amber-300 animate-pulse">
                                {pdfParseProgress || t('Reading and analyzing PDF files...')}
                            </p>
                            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                                正在深度识别客户名称、送达地址、联系电话、DO单号并自动匹配物料SKU，请稍候...
                            </p>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-amber-500 to-amber-300 h-full w-2/3 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Input for Admin POD Upload */}
            <input
                ref={adminPodFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAdminPodFileSelect}
            />

            {/* WhatsApp Trip Dispatch Modal */}
            {whatsappTripModal && (
                <WhatsAppDispatchModal
                    mode="trip"
                    tripId={whatsappTripModal.tripId}
                    tripNumber={whatsappTripModal.tripNumber}
                    driverName={whatsappTripModal.driverName}
                    driverPhone={whatsappTripModal.driverPhone}
                    onClose={() => setWhatsappTripModal(null)}
                    onSuccess={() => {
                        setToast({ message: `Jadual WhatsApp berjaya dihantar kepada ${whatsappTripModal.driverName}!`, type: 'success' });
                        setWhatsappTripModal(null);
                    }}
                />
            )}

            {/* WhatsApp Customer Template Modal */}
            {whatsappCustomerModal && (
                <WhatsAppDispatchModal
                    mode="customer"
                    orderNumber={whatsappCustomerModal.orderNumber}
                    customerName={whatsappCustomerModal.customerName}
                    customerPhone={whatsappCustomerModal.customerPhone}
                    orderStatus={whatsappCustomerModal.orderStatus}
                    tripNumber={whatsappCustomerModal.tripNumber}
                    driverName={whatsappCustomerModal.driverName}
                    driverPhone={whatsappCustomerModal.driverPhone}
                    deliveryDate={whatsappCustomerModal.deliveryDate}
                    onClose={() => setWhatsappCustomerModal(null)}
                />
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
