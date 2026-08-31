import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FileText,
    Upload,
    CheckCircle2,
    Clock,
    Folder,
    Building2,
    DollarSign,
    BarChart3,
    Truck,
    Factory,
    RefreshCw,
    Download,
    Eye,
    X,
    ChevronRight,
    Edit3,
    ExternalLink,
    Filter,
    ShieldAlert,
    TrendingUp,
    TrendingDown,
    Layers,
    Calendar,
    Sparkles,
    Check,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid
} from 'recharts';
import { supabase } from '../services/supabase';
import {
    DocumentManifestEntity,
    ExtractedDocument
} from '../types';
import * as XLSX from 'xlsx';

interface MonthCellData {
    value: number;
    source_type: string;
    file_url?: string;
    document_id?: string;
    notes?: string;
}

interface MatrixCategoryRow {
    category: DocumentManifestEntity;
    months: Record<number, MonthCellData>;
    total: number;
    average: number;
}

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function WilliamDocumentCenter() {
    const currentYear = new Date().getFullYear();
    const currentNaturalMonth = new Date().getMonth() + 1;

    // State
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(currentNaturalMonth);
    const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('ALL');
    const [matrix, setMatrix] = useState<Record<string, MatrixCategoryRow>>({});
    const [categories, setCategories] = useState<DocumentManifestEntity[]>([]);
    const [salesSummary, setSalesSummary] = useState<any>({ autocount: 0, shopee: 0, grand_total_sales: 0, monthly_total_sales: {} });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);

    // Drawers & Modals
    const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
    const [showManifestModal, setShowManifestModal] = useState<boolean>(false);
    const [selectedCardDetail, setSelectedCardDetail] = useState<{
        categoryKey: string;
        category: DocumentManifestEntity;
    } | null>(null);

    // Detail Drawer Sub-state
    const [activeDocPreview, setActiveDocPreview] = useState<ExtractedDocument | null>(null);
    const [editingMonthIndex, setEditingMonthIndex] = useState<number | null>(null);
    const [editValueInput, setEditValueInput] = useState<string>('');
    const [editNotesInput, setEditNotesInput] = useState<string>('');

    // Upload Tracking
    const [uploadQueue, setUploadQueue] = useState<Array<{
        fileName: string;
        status: 'pending' | 'uploading' | 'routing' | 'extracting' | 'completed' | 'error';
        message?: string;
        categoryName?: string;
        amount?: number;
        month?: number;
        error?: string;
    }>>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cardFileInputRef = useRef<HTMLInputElement>(null);

    // Fetch Dashboard Data
    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/v2/documents/dashboard-metrics?year=${selectedYear}`);
            if (res.ok) {
                const data = await res.json();
                setMatrix(data.matrix || {});
                setCategories(data.categories || []);
                setSalesSummary(data.salesSummary || { autocount: 0, shopee: 0, grand_total_sales: 0, monthly_total_sales: {} });
            }
        } catch (err) {
            console.error('Error fetching dashboard metrics:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();

        const channel = supabase.channel('william-metrics-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'william_dashboard_metrics' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedYear]);

    // Handle Upload
    const handleFilesSelected = async (files: FileList | File[], targetCategoryKey?: string, targetMonth?: number) => {
        if (!files || files.length === 0) return;
        setIsProcessingUpload(true);

        const newQueue = Array.from(files).map(f => ({
            fileName: f.name,
            status: 'pending' as const,
            message: 'Queued for processing...'
        }));
        setUploadQueue(newQueue);
        setShowUploadModal(true);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'uploading', message: 'Uploading to Supabase storage...' } : it));

            try {
                const base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                setUploadQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'routing', message: 'Gemini AI parsing & folder classification...' } : it));

                const response = await fetch('/api/v2/documents/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileBase64: base64Data,
                        fileName: file.name,
                        mimeType: file.type || 'application/pdf',
                        targetCategoryKey: targetCategoryKey || undefined,
                        targetMonth: targetMonth || (typeof selectedMonth === 'number' ? selectedMonth : undefined)
                    })
                });

                const resData = await response.json();

                if (response.ok && resData.success) {
                    setUploadQueue(prev => prev.map((it, idx) => idx === i ? {
                        ...it,
                        status: 'completed',
                        message: `Processed: ${resData.category_name} (${MONTH_NAMES[resData.period_month - 1]}) -> RM ${Number(resData.total_amount).toLocaleString()}`,
                        categoryName: resData.category_name,
                        amount: resData.total_amount,
                        month: resData.period_month
                    } : it));
                } else {
                    setUploadQueue(prev => prev.map((it, idx) => idx === i ? {
                        ...it,
                        status: 'error',
                        error: resData.error || 'Processing failed'
                    } : it));
                }
            } catch (err: any) {
                setUploadQueue(prev => prev.map((it, idx) => idx === i ? {
                    ...it,
                    status: 'error',
                    error: err.message || 'Upload error'
                } : it));
            }
        }

        setIsProcessingUpload(false);
        fetchDashboardData();
    };

    // Save Manual Cell Override
    const handleSaveManualMetric = async (categoryKey: string, month: number, value: number, notes: string) => {
        try {
            const res = await fetch('/api/v2/documents/dashboard-metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year: selectedYear,
                    month,
                    category_key: categoryKey,
                    metric_value: value,
                    notes
                })
            });

            if (res.ok) {
                setEditingMonthIndex(null);
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Failed to save manual metric:', err);
        }
    };

    // Fetch PDF Document for Drawer
    const handleLoadDocPreview = async (docId?: string) => {
        if (!docId) {
            setActiveDocPreview(null);
            return;
        }
        try {
            const { data } = await supabase
                .from('extracted_documents')
                .select('*, items:extracted_document_items(*)')
                .eq('id', docId)
                .single();
            if (data) setActiveDocPreview(data);
        } catch (err) {
            console.error('Error fetching document preview:', err);
        }
    };

    // Helper: Compute Month Value, Previous Month Value, and MoM %
    const getCardMetrics = (categoryKey: string) => {
        const row = matrix[categoryKey];
        if (!row) return { currentVal: 0, prevVal: 0, momPct: 0, totalVal: 0, isIncrease: false, chartData: [], isFilled: false, docId: undefined, fileUrl: undefined };

        const chartData = MONTH_NAMES.map((name, idx) => ({
            name,
            value: row.months[idx + 1]?.value || 0
        }));

        if (selectedMonth === 'ALL') {
            return {
                currentVal: row.total,
                prevVal: 0,
                momPct: 0,
                totalVal: row.total,
                isIncrease: false,
                chartData,
                isFilled: row.total > 0,
                docId: undefined,
                fileUrl: undefined
            };
        }

        const m = selectedMonth as number;
        const currentVal = row.months[m]?.value || 0;
        const prevVal = m > 1 ? (row.months[m - 1]?.value || 0) : 0;
        const momPct = prevVal > 0 ? ((currentVal - prevVal) / prevVal) * 100 : (currentVal > 0 ? 100 : 0);

        return {
            currentVal,
            prevVal,
            momPct: Math.round(momPct * 10) / 10,
            totalVal: row.total,
            isIncrease: currentVal >= prevVal,
            chartData,
            isFilled: currentVal > 0,
            docId: row.months[m]?.document_id,
            fileUrl: row.months[m]?.file_url
        };
    };

    // High Level Totals
    const heroMetrics = useMemo(() => {
        const getGroupTotal = (keys: string[]) => {
            return keys.reduce((acc, k) => {
                const r = matrix[k];
                if (!r) return acc;
                if (selectedMonth === 'ALL') return acc + r.total;
                return acc + (r.months[selectedMonth as number]?.value || 0);
            }, 0);
        };

        const fleetKeys = ['PETROL_FLEET', 'TNGO_TOLL', 'LORRY_SERVICE', 'PUSPAKOM_INSURANCE'];
        const prodKeys = ['ELECTRICITY_BILL', 'WATER_BILL', 'MYANMAR_SALARY', 'MACHINE_EXPENSES'];

        const fleetCost = getGroupTotal(fleetKeys);
        const prodCost = getGroupTotal(prodKeys);

        const autoCountSales = selectedMonth === 'ALL'
            ? (matrix['AUTOCOUNT_SALES']?.total || 0)
            : (matrix['AUTOCOUNT_SALES']?.months[selectedMonth as number]?.value || 0);

        const shopeeSales = selectedMonth === 'ALL'
            ? (matrix['SHOPEE_SALES']?.total || 0)
            : (matrix['SHOPEE_SALES']?.months[selectedMonth as number]?.value || 0);

        const totalRevenue = autoCountSales + shopeeSales;
        const netSurplus = totalRevenue - (fleetCost + prodCost);

        // Chart Data for Hero Revenue
        const revenueTrendData = MONTH_NAMES.map((name, idx) => {
            const m = idx + 1;
            const ac = matrix['AUTOCOUNT_SALES']?.months[m]?.value || 0;
            const sh = matrix['SHOPEE_SALES']?.months[m]?.value || 0;
            return { name, revenue: ac + sh, autoCount: ac, shopee: sh };
        });

        const fleetTrendData = MONTH_NAMES.map((name, idx) => {
            const m = idx + 1;
            const sum = fleetKeys.reduce((a, k) => a + (matrix[k]?.months[m]?.value || 0), 0);
            return { name, cost: sum };
        });

        const prodTrendData = MONTH_NAMES.map((name, idx) => {
            const m = idx + 1;
            const sum = prodKeys.reduce((a, k) => a + (matrix[k]?.months[m]?.value || 0), 0);
            return { name, cost: sum };
        });

        return {
            totalRevenue,
            autoCountSales,
            shopeeSales,
            fleetCost,
            prodCost,
            netSurplus,
            revenueTrendData,
            fleetTrendData,
            prodTrendData
        };
    }, [matrix, selectedMonth]);

    // Export Excel
    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        const headers = ['Category / Item', 'Owner', ...MONTH_NAMES, 'Total / Balance'];
        const rows: any[] = [];

        rows.push(['--- LOGISTICS & FLEET EXPENSES ---', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        ['PETROL_FLEET', 'TNGO_TOLL', 'LORRY_SERVICE', 'PUSPAKOM_INSURANCE'].forEach(k => {
            const r = matrix[k];
            if (r) rows.push([r.category.name, r.category.owner, ...Array.from({ length: 12 }, (_, i) => r.months[i + 1]?.value || 0), r.total]);
        });

        rows.push(['--- COMPANY & SALES ---', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        ['AUTOCOUNT_SALES', 'STOCK_BALANCE', 'TRIP_BY_STATES'].forEach(k => {
            const r = matrix[k];
            if (r) rows.push([r.category.name, r.category.owner, ...Array.from({ length: 12 }, (_, i) => r.months[i + 1]?.value || 0), r.total]);
        });

        rows.push(['--- PRODUCTION & UTILITIES ---', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        ['RECYCLE_AMOUNT', 'SF_DEFECT_AMOUNT', 'ELECTRICITY_BILL', 'WATER_BILL', 'MYANMAR_SALARY', 'MACHINE_EXPENSES'].forEach(k => {
            const r = matrix[k];
            if (r) rows.push([r.category.name, r.category.owner, ...Array.from({ length: 12 }, (_, i) => r.months[i + 1]?.value || 0), r.total]);
        });

        rows.push(['--- SALES SUMMARY ---', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        const acVals = Array.from({ length: 12 }, (_, i) => matrix['AUTOCOUNT_SALES']?.months[i + 1]?.value || 0);
        const shVals = Array.from({ length: 12 }, (_, i) => matrix['SHOPEE_SALES']?.months[i + 1]?.value || 0);
        const totVals = Array.from({ length: 12 }, (_, i) => acVals[i] + shVals[i]);

        rows.push(['AUTO COUNT', 'WINNIE', ...acVals, salesSummary.autocount]);
        rows.push(['SHOPEE', 'WINNIE', ...shVals, salesSummary.shopee]);
        rows.push(['TOTAL SALES', '-', ...totVals, salesSummary.grand_total_sales]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, `William_Matrix_${selectedYear}`);
        XLSX.writeFile(wb, `William_Executive_Matrix_${selectedYear}.xlsx`);
    };

    // Filter cards
    const shouldDisplayOwner = (owner: string) => {
        if (selectedOwnerFilter === 'ALL') return true;
        if (selectedOwnerFilter === 'YUAN YUAN') {
            return ['ELECTRICITY_BILL', 'WATER_BILL', 'MYANMAR_SALARY', 'MACHINE_EXPENSES'].includes(owner);
        }
        return owner === selectedOwnerFilter;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8 selection:bg-amber-500/30">
            {/* 1. Header & Top Controls */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 border-b border-slate-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-950/40">
                            <Sparkles className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                                William's Executive Intelligence Hub
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                                    Live Matrix
                                </span>
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Automated PDF Routing • 12-Month Analytics Cards • MoM Variance • Operations Live Sync
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
                    {/* Year Selector */}
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
                        <Calendar size={14} className="text-slate-400 mr-2" />
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                        >
                            <option value={2025} className="bg-slate-900">2025</option>
                            <option value={2026} className="bg-slate-900">2026</option>
                            <option value={2027} className="bg-slate-900">2027</option>
                        </select>
                    </div>

                    {/* Owner Filter Tabs */}
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
                        <Filter size={13} className="text-slate-400 mr-2" />
                        <select
                            value={selectedOwnerFilter}
                            onChange={e => setSelectedOwnerFilter(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL" className="bg-slate-900">All Owners (全员)</option>
                            <option value="AMY" className="bg-slate-900">Amy (车队 / 维修 / 薪资)</option>
                            <option value="WINNIE" className="bg-slate-900">Winnie (销售 / 能耗 / 库存)</option>
                            <option value="MAX TAN" className="bg-slate-900">Max Tan (生产回收 / 车次)</option>
                            <option value="YUAN YUAN" className="bg-slate-900">Yuan Yuan (月度待办)</option>
                        </select>
                    </div>

                    {/* Export Excel */}
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition active:scale-95 shadow-sm"
                    >
                        <Download size={14} className="text-emerald-400" />
                        Export Excel
                    </button>

                    {/* Storage & Manifest */}
                    <button
                        onClick={() => setShowManifestModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition active:scale-95 shadow-sm"
                    >
                        <Folder size={14} className="text-amber-400" />
                        Storage Folders
                    </button>

                    {/* Global Batch Upload */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white text-xs font-black shadow-lg shadow-orange-950/50 transition active:scale-95"
                    >
                        <Upload size={14} />
                        Batch Upload PDF
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={e => e.target.files && handleFilesSelected(e.target.files)}
                        multiple
                        accept="application/pdf,image/*"
                        className="hidden"
                    />

                    {/* Refresh */}
                    <button
                        onClick={fetchDashboardData}
                        disabled={isLoading}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                        title="Refresh All Metrics"
                    >
                        <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 2. Month Timeline Switcher (Horizontal Interactive Bar) */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2 pt-1">
                <button
                    onClick={() => setSelectedMonth('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap flex items-center gap-1.5 shadow-sm ${selectedMonth === 'ALL'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-orange-900/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                        }`}
                >
                    <Layers size={13} />
                    Full Year (全年汇总)
                </button>

                {MONTH_NAMES.map((name, idx) => {
                    const m = idx + 1;
                    const isSelected = selectedMonth === m;
                    const isCurrentNatural = m === currentNaturalMonth;
                    return (
                        <button
                            key={name}
                            onClick={() => setSelectedMonth(m)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${isSelected
                                ? 'bg-slate-100 text-slate-950 font-black shadow-lg shadow-white/10'
                                : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                                }`}
                        >
                            <span>{name}</span>
                            {isCurrentNatural && (
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-orange-600' : 'bg-amber-400 animate-pulse'}`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* 3. Top 4 Executive Summary Hero Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Hero 1: Total Sales Revenue */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 shadow-xl relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                Total Sales Revenue
                            </span>
                            <h3 className="text-2xl md:text-3xl font-black text-white mt-1 font-mono tracking-tight">
                                RM {heroMetrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <DollarSign size={20} />
                        </div>
                    </div>

                    {/* Mini Sparkline */}
                    <div className="h-10 mt-3 -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={heroMetrics.revenueTrendData}>
                                <defs>
                                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gradRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                        <span>AutoCount: <b className="text-slate-200">RM {heroMetrics.autoCountSales.toLocaleString()}</b></span>
                        <span>Shopee: <b className="text-slate-200">RM {heroMetrics.shopeeSales.toLocaleString()}</b></span>
                    </div>
                </div>

                {/* Hero 2: Total Fleet Operating Costs */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 shadow-xl relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Fleet Operating Costs (Amy)
                            </span>
                            <h3 className="text-2xl md:text-3xl font-black text-amber-400 mt-1 font-mono tracking-tight">
                                RM {heroMetrics.fleetCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Truck size={20} />
                        </div>
                    </div>

                    {/* Mini Sparkline */}
                    <div className="h-10 mt-3 -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={heroMetrics.fleetTrendData}>
                                <Bar dataKey="cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                        <span>Petrol, TnGo, Service, Puspakom</span>
                        <span className="text-amber-400/80 font-bold">4 Tracked</span>
                    </div>
                </div>

                {/* Hero 3: Production & Utilities */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 shadow-xl relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Production & Utilities
                            </span>
                            <h3 className="text-2xl md:text-3xl font-black text-rose-400 mt-1 font-mono tracking-tight">
                                RM {heroMetrics.prodCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Factory size={20} />
                        </div>
                    </div>

                    {/* Mini Sparkline */}
                    <div className="h-10 mt-3 -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={heroMetrics.prodTrendData}>
                                <defs>
                                    <linearGradient id="gradProd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="cost" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#gradProd)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                        <span>Electricity, Water, Salary, Parts</span>
                        <span className="text-emerald-400 font-bold text-[10px]">Monthly Routine</span>
                    </div>
                </div>

                {/* Hero 4: Net Operating Surplus */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 shadow-xl relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Net Operating Surplus
                            </span>
                            <h3 className={`text-2xl md:text-3xl font-black mt-1 font-mono tracking-tight ${heroMetrics.netSurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                RM {heroMetrics.netSurplus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Building2 size={20} />
                        </div>
                    </div>

                    <div className="h-10 mt-3 flex items-center">
                        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
                            <div
                                style={{ width: `${Math.min(100, (heroMetrics.fleetCost / Math.max(1, heroMetrics.totalRevenue)) * 100)}%` }}
                                className="bg-amber-500 h-full"
                                title="Fleet Cost %"
                            />
                            <div
                                style={{ width: `${Math.min(100, (heroMetrics.prodCost / Math.max(1, heroMetrics.totalRevenue)) * 100)}%` }}
                                className="bg-rose-500 h-full"
                                title="Utilities Cost %"
                            />
                            <div
                                style={{ width: `${Math.max(0, 100 - ((heroMetrics.fleetCost + heroMetrics.prodCost) / Math.max(1, heroMetrics.totalRevenue)) * 100)}%` }}
                                className="bg-emerald-500 h-full"
                                title="Surplus %"
                            />
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                        <span>Fleet: {Math.round((heroMetrics.fleetCost / Math.max(1, heroMetrics.totalRevenue)) * 100)}%</span>
                        <span>Util: {Math.round((heroMetrics.prodCost / Math.max(1, heroMetrics.totalRevenue)) * 100)}%</span>
                        <span className="text-emerald-400 font-bold">Surplus: {Math.round((heroMetrics.netSurplus / Math.max(1, heroMetrics.totalRevenue)) * 100)}%</span>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 4. GROUP 1: LOGISTICS & FLEET EXPENSES (AMY) */}
            {/* ========================================================================= */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Truck size={18} />
                        </div>
                        <div>
                            <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                                Logistics & Fleet Expenses
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold normal-case">
                                    Owner: Amy
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">
                                Petrol, TnGo toll, workshop lorry service & Puspakom insurance tracking
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                        { key: 'PETROL_FLEET', label: 'Petrol History (油费支出)', desc: 'Fleet card fuel receipts', color: '#f59e0b' },
                        { key: 'TNGO_TOLL', label: 'TnGo History (过路费支出)', desc: 'RFID & Touch n Go statements', color: '#38bdf8' },
                        { key: 'LORRY_SERVICE', label: 'Service Cost (维修保养)', desc: 'Workshop invoices & tyre repairs', color: '#ec4899' },
                        { key: 'PUSPAKOM_INSURANCE', label: 'Puspakom & Insurance (验车保费)', desc: 'Inspection certs & vehicle policies', color: '#8b5cf6' }
                    ].map(item => {
                        const row = matrix[item.key];
                        if (!row || !shouldDisplayOwner(row.category.owner)) return null;
                        const cardData = getCardMetrics(item.key);

                        return (
                            <div
                                key={item.key}
                                onClick={() => setSelectedCardDetail({ categoryKey: item.key, category: row.category })}
                                className="p-5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div className="pr-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                {row.category.owner}
                                            </span>
                                            <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                                                {item.label}
                                            </h4>
                                            <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                                        </div>
                                        {cardData.fileUrl ? (
                                            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="Linked PDF Attached">
                                                <Check size={14} />
                                            </span>
                                        ) : (
                                            <span className="p-1.5 rounded-lg bg-slate-800 text-slate-500 group-hover:text-amber-400 transition" title="Click to View / Upload">
                                                <Upload size={14} />
                                            </span>
                                        )}
                                    </div>

                                    {/* Main Amount Display */}
                                    <div className="mt-4 flex items-baseline justify-between">
                                        <div>
                                            <span className="text-xs text-slate-400 font-mono">RM </span>
                                            <span className="text-2xl font-black text-white font-mono tracking-tight">
                                                {cardData.currentVal.toLocaleString()}
                                            </span>
                                        </div>

                                        {selectedMonth !== 'ALL' && cardData.prevVal > 0 && (
                                            <div className={`flex items-center text-xs font-bold font-mono px-2 py-0.5 rounded-md ${cardData.momPct > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                {cardData.momPct > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                                <span>{Math.abs(cardData.momPct)}% MoM</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Mini 12-Month Sparkline Chart */}
                                <div className="mt-4 pt-3 border-t border-slate-800/80">
                                    <div className="h-10 -mx-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={cardData.chartData}>
                                                <Bar dataKey="value" fill={item.color} radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
                                        <span>Jan - Dec Trajectory</span>
                                        <span>Total: RM {row.total.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 5. GROUP 2: COMPANY SALES & LIVE INVENTORY (WINNIE & MAX TAN) */}
            {/* ========================================================================= */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                            <Building2 size={18} />
                        </div>
                        <div>
                            <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                                Company Sales, Stock & Fleet Trips
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30 font-bold normal-case">
                                    Owners: Winnie & Max Tan
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">
                                AutoCount sales, Shopee e-commerce, real-time stock balance & trip dispatches
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* AutoCount Sales */}
                    {matrix['AUTOCOUNT_SALES'] && shouldDisplayOwner(matrix['AUTOCOUNT_SALES'].category.owner) && (() => {
                        const cardData = getCardMetrics('AUTOCOUNT_SALES');
                        return (
                            <div
                                onClick={() => setSelectedCardDetail({ categoryKey: 'AUTOCOUNT_SALES', category: matrix['AUTOCOUNT_SALES'].category })}
                                className="p-5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/40 shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">WINNIE</span>
                                            <h4 className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">
                                                TOTAL AUTO COUNT SALES
                                            </h4>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Direct ERP monthly invoicing</p>
                                        </div>
                                        <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            <DollarSign size={15} />
                                        </span>
                                    </div>

                                    <div className="mt-4 flex items-baseline justify-between">
                                        <div>
                                            <span className="text-xs text-slate-400 font-mono">RM </span>
                                            <span className="text-2xl font-black text-white font-mono tracking-tight">
                                                {cardData.currentVal.toLocaleString()}
                                            </span>
                                        </div>
                                        {selectedMonth !== 'ALL' && cardData.prevVal > 0 && (
                                            <div className={`flex items-center text-xs font-bold font-mono px-2 py-0.5 rounded-md ${cardData.momPct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                {cardData.momPct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                                <span>{Math.abs(cardData.momPct)}% MoM</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-800/80">
                                    <div className="h-10 -mx-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={cardData.chartData}>
                                                <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
                                        <span>12-Mo Sales Listing</span>
                                        <span>Total: RM {matrix['AUTOCOUNT_SALES'].total.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Stock Balance Analysis (Live DB) */}
                    {matrix['STOCK_BALANCE'] && shouldDisplayOwner(matrix['STOCK_BALANCE'].category.owner) && (() => {
                        const cardData = getCardMetrics('STOCK_BALANCE');
                        return (
                            <div
                                onClick={() => setSelectedCardDetail({ categoryKey: 'STOCK_BALANCE', category: matrix['STOCK_BALANCE'].category })}
                                className="p-5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">WINNIE</span>
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase">Live DB</span>
                                            </div>
                                            <h4 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                                                STOCK BALANCE ANALYSIS
                                            </h4>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Real-time inventory in warehouse</p>
                                        </div>
                                        <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                            <Layers size={15} />
                                        </span>
                                    </div>

                                    <div className="mt-4 flex items-baseline justify-between">
                                        <div>
                                            <span className="text-2xl font-black text-cyan-400 font-mono tracking-tight">
                                                {cardData.currentVal.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-slate-400 font-bold ml-1.5">Rolls</span>
                                        </div>
                                        <span className="text-[11px] text-emerald-400 font-bold">In Stock</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-800/80">
                                    <div className="h-10 -mx-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={cardData.chartData}>
                                                <Bar dataKey="value" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
                                        <span>Live Stock Levels</span>
                                        <span>Current: {cardData.currentVal.toLocaleString()} Rolls</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Trip By States (Live DB) */}
                    {matrix['TRIP_BY_STATES'] && shouldDisplayOwner(matrix['TRIP_BY_STATES'].category.owner) && (() => {
                        const cardData = getCardMetrics('TRIP_BY_STATES');
                        return (
                            <div
                                onClick={() => setSelectedCardDetail({ categoryKey: 'TRIP_BY_STATES', category: matrix['TRIP_BY_STATES'].category })}
                                className="p-5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">MAX TAN</span>
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase">Live DB</span>
                                            </div>
                                            <h4 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">
                                                TRIP BY STATES
                                            </h4>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Completed lorry trips across states</p>
                                        </div>
                                        <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                            <Truck size={15} />
                                        </span>
                                    </div>

                                    <div className="mt-4 flex items-baseline justify-between">
                                        <div>
                                            <span className="text-2xl font-black text-indigo-400 font-mono tracking-tight">
                                                {cardData.currentVal.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-slate-400 font-bold ml-1.5">Trips</span>
                                        </div>
                                        <span className="text-[11px] text-indigo-300 font-mono">Dispatched</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-800/80">
                                    <div className="h-10 -mx-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={cardData.chartData}>
                                                <Bar dataKey="value" fill="#6366f1" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
                                        <span>State Dispatch Output</span>
                                        <span>Total: {matrix['TRIP_BY_STATES'].total.toLocaleString()} Trips</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* AutoCount vs Shopee Channel Comparison Strip */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/30 via-slate-900 to-orange-950/30 border border-slate-800 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-orange-500 flex items-center justify-center text-white font-bold shadow">
                            %
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase text-white tracking-wider">
                                Sales Channels Breakdown ({selectedMonth === 'ALL' ? 'Full Year' : MONTH_NAMES[(selectedMonth as number) - 1]})
                            </h4>
                            <p className="text-[11px] text-slate-400">
                                AutoCount: RM {heroMetrics.autoCountSales.toLocaleString()} vs Shopee: RM {heroMetrics.shopeeSales.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="w-full md:w-80 flex flex-col gap-1.5">
                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                            <div
                                style={{ width: `${Math.min(100, (heroMetrics.autoCountSales / Math.max(1, heroMetrics.totalRevenue)) * 100)}%` }}
                                className="bg-blue-500 h-full"
                            />
                            <div
                                style={{ width: `${Math.min(100, (heroMetrics.shopeeSales / Math.max(1, heroMetrics.totalRevenue)) * 100)}%` }}
                                className="bg-orange-500 h-full"
                            />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                            <span className="text-blue-400 font-bold">AutoCount: {Math.round((heroMetrics.autoCountSales / Math.max(1, heroMetrics.totalRevenue)) * 100)}%</span>
                            <span className="text-orange-400 font-bold">Shopee: {Math.round((heroMetrics.shopeeSales / Math.max(1, heroMetrics.totalRevenue)) * 100)}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 6. GROUP 3: PRODUCTION, MATERIALS & UTILITIES (WITH UPDATE MONTHLY TAGS) */}
            {/* ========================================================================= */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                            <Factory size={18} />
                        </div>
                        <div>
                            <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                                Production, Materials & Utilities
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold normal-case">
                                    yuan yuan - update monthly
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">
                                Electricity (TNB), water, Myanmar foreign worker salary, machine parts, recycle & scrap
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[
                        { key: 'ELECTRICITY_BILL', label: 'Electricity Bill (TNB 电费)', desc: 'TNB industrial power tariffs', owner: 'WINNIE', isMonthlyUpdate: true, color: '#10b981' },
                        { key: 'WATER_BILL', label: 'Water Bill (水费账单)', desc: 'LAP & state water supplier bills', owner: 'WINNIE', isMonthlyUpdate: true, color: '#06b6d4' },
                        { key: 'MYANMAR_SALARY', label: 'Myanmar Salary Analysis (外劳薪资)', desc: 'Hostel allowances & foreign worker payroll', owner: 'AMY', isMonthlyUpdate: true, color: '#f59e0b' },
                        { key: 'MACHINE_EXPENSES', label: 'Machine Expenses (机台备件维修)', desc: 'Extruder screws, heaters & gear parts', owner: 'AMY', isMonthlyUpdate: true, color: '#f43f5e' },
                        { key: 'RECYCLE_AMOUNT', label: 'Recycle Amount (回收造粒产出)', desc: 'T5 & N3 extruder pellet output', owner: 'MAX TAN', isLive: true, color: '#8b5cf6' },
                        { key: 'SF_DEFECT_AMOUNT', label: 'SF Defect Amount (缠绕膜废料损耗)', desc: 'Stretch film machine scrap weight', owner: 'MAX TAN', isLive: true, color: '#ef4444' }
                    ].map(item => {
                        const row = matrix[item.key];
                        if (!row || !shouldDisplayOwner(row.category.owner)) return null;
                        const cardData = getCardMetrics(item.key);

                        return (
                            <div
                                key={item.key}
                                onClick={() => setSelectedCardDetail({ categoryKey: item.key, category: row.category })}
                                className={`p-5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border transition-all duration-200 cursor-pointer flex flex-col justify-between group ${item.isMonthlyUpdate
                                    ? (cardData.isFilled ? 'border-slate-800 hover:border-emerald-500/50' : 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-400')
                                    : 'border-slate-800 hover:border-pink-500/40'
                                    }`}
                            >
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div className="pr-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    {row.category.owner}
                                                </span>
                                                {item.isMonthlyUpdate && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                                                        yuan yuan - update monthly
                                                    </span>
                                                )}
                                                {item.isLive && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold uppercase">Live DB</span>
                                                )}
                                            </div>
                                            <h4 className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors mt-0.5">
                                                {item.label}
                                            </h4>
                                            <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                                        </div>

                                        {cardData.fileUrl ? (
                                            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="Linked PDF Attached">
                                                <Check size={14} />
                                            </span>
                                        ) : item.isMonthlyUpdate ? (
                                            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 animate-pulse border border-emerald-500/40" title="Pending Monthly Submission">
                                                <Upload size={14} />
                                            </span>
                                        ) : null}
                                    </div>

                                    {/* Main Amount */}
                                    <div className="mt-4 flex items-baseline justify-between">
                                        <div>
                                            {row.category.unit === 'RM' && <span className="text-xs text-slate-400 font-mono">RM </span>}
                                            <span className="text-2xl font-black text-white font-mono tracking-tight">
                                                {cardData.currentVal.toLocaleString()}
                                            </span>
                                            {row.category.unit !== 'RM' && <span className="text-xs text-slate-400 font-bold ml-1.5">{row.category.unit}</span>}
                                        </div>

                                        {selectedMonth !== 'ALL' && cardData.prevVal > 0 && (
                                            <div className={`flex items-center text-xs font-bold font-mono px-2 py-0.5 rounded-md ${cardData.momPct > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                {cardData.momPct > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                                <span>{Math.abs(cardData.momPct)}% MoM</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Mini 12-Month Sparkline Chart */}
                                <div className="mt-4 pt-3 border-t border-slate-800/80">
                                    <div className="h-10 -mx-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={cardData.chartData}>
                                                <Bar dataKey="value" fill={item.color} radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
                                        <span>12-Mo Trajectory</span>
                                        <span>Total: {row.total.toLocaleString()} {row.category.unit !== 'RM' ? row.category.unit : 'RM'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 7. SLIDE-OVER DETAIL & PDF AUDIT DRAWER */}
            {/* ========================================================================= */}
            {selectedCardDetail && matrix[selectedCardDetail.categoryKey] && (() => {
                const catRow = matrix[selectedCardDetail.categoryKey];
                const chartData = MONTH_NAMES.map((name, idx) => ({
                    name,
                    value: catRow.months[idx + 1]?.value || 0
                }));

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm">
                        <div className="w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
                            {/* Drawer Header */}
                            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/90">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-amber-400 uppercase font-mono tracking-wider">
                                            {catRow.category.owner}
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                            {catRow.category.category_key}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-white mt-1">
                                        {catRow.category.name}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {selectedYear} Full Year Trajectory • Total: <b className="text-emerald-400 font-mono">RM {catRow.total.toLocaleString()}</b>
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setSelectedCardDetail(null); setActiveDocPreview(null); }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                {/* 12-Month Interactive Area Chart */}
                                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <BarChart3 size={15} className="text-amber-400" />
                                        12-Month Annual Trend & Trajectory
                                    </h4>
                                    <div className="h-44 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="name" stroke="#64748b" textAnchor="end" tick={{ fontSize: 11 }} />
                                                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                                                    formatter={(val: any) => [`RM ${Number(val).toLocaleString()}`, 'Amount']}
                                                />
                                                <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#detailGrad)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Quick Upload PDF for this Card */}
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/20 via-slate-900 to-orange-950/20 border border-slate-800 flex items-center justify-between">
                                    <div>
                                        <h5 className="text-xs font-bold text-white">Upload New Monthly PDF</h5>
                                        <p className="text-[11px] text-slate-400">Gemini will auto-extract the month & amount for this category</p>
                                    </div>
                                    <button
                                        onClick={() => cardFileInputRef.current?.click()}
                                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                                    >
                                        <Upload size={13} /> Upload PDF
                                    </button>
                                    <input
                                        type="file"
                                        ref={cardFileInputRef}
                                        onChange={e => e.target.files && handleFilesSelected(e.target.files, catRow.category.category_key)}
                                        accept="application/pdf,image/*"
                                        className="hidden"
                                    />
                                </div>

                                {/* 12-Month Table & Cell Editor */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        12-Month Detailed Grid (Click Month to Edit / Audit)
                                    </h4>
                                    <div className="rounded-2xl border border-slate-800 overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                                                <tr>
                                                    <th className="py-2.5 px-3">Month</th>
                                                    <th className="py-2.5 px-3 text-right">Amount ({catRow.category.unit})</th>
                                                    <th className="py-2.5 px-3 text-center">Status / PDF</th>
                                                    <th className="py-2.5 px-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/80 font-mono">
                                                {MONTH_NAMES.map((name, idx) => {
                                                    const m = idx + 1;
                                                    const cell = catRow.months[m];
                                                    const isEditing = editingMonthIndex === m;

                                                    return (
                                                        <tr key={name} className={`hover:bg-slate-800/30 ${m === selectedMonth ? 'bg-amber-500/5' : ''}`}>
                                                            <td className="py-2.5 px-3 font-sans font-bold text-slate-200">
                                                                {name} {selectedYear}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editValueInput}
                                                                        onChange={e => setEditValueInput(e.target.value)}
                                                                        className="w-28 bg-slate-800 border border-amber-500 rounded px-2 py-1 text-white font-mono text-right text-xs"
                                                                    />
                                                                ) : (
                                                                    <span className={cell?.value ? 'font-bold text-slate-100' : 'text-slate-600'}>
                                                                        {cell?.value ? cell.value.toLocaleString() : '-'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-sans">
                                                                {cell?.file_url ? (
                                                                    <button
                                                                        onClick={() => handleLoadDocPreview(cell.document_id)}
                                                                        className="text-[11px] text-emerald-400 hover:underline flex items-center justify-center gap-1 mx-auto"
                                                                    >
                                                                        <FileText size={12} /> View PDF
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[11px] text-slate-500">None</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-sans">
                                                                {isEditing ? (
                                                                    <button
                                                                        onClick={() => handleSaveManualMetric(catRow.category.category_key, m, parseFloat(editValueInput) || 0, editNotesInput)}
                                                                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingMonthIndex(m);
                                                                            setEditValueInput(String(cell?.value || ''));
                                                                            setEditNotesInput(cell?.notes || '');
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-white"
                                                                        title="Edit Value"
                                                                    >
                                                                        <Edit3 size={13} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Linked PDF Document Preview Panel */}
                                {activeDocPreview && (
                                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                                                <FileText size={14} className="text-emerald-400" />
                                                PDF Audit: {activeDocPreview.file_name}
                                            </h5>
                                            <button onClick={() => setActiveDocPreview(null)} className="text-slate-400 hover:text-white text-xs">
                                                Close
                                            </button>
                                        </div>

                                        <div className="h-64 rounded-xl border border-slate-800 overflow-hidden bg-slate-900">
                                            <iframe
                                                src={activeDocPreview.file_url}
                                                title="PDF Preview"
                                                className="w-full h-full border-0"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ========================================================================= */}
            {/* 8. BATCH INGESTION LIVE PIPELINE MODAL */}
            {/* ========================================================================= */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <Upload size={18} className="text-amber-400" />
                                    AI Document Pipeline Ingestion
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Uploaded ➔ Routed to Folder ➔ Data Extracted ➔ Dashboard Updated
                                </p>
                            </div>
                            {!isProcessingUpload && (
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {uploadQueue.map((item, idx) => (
                                <div key={idx} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-slate-200 truncate max-w-xs">{item.fileName}</span>
                                        {item.status === 'uploading' && <span className="text-[11px] text-blue-400 font-bold animate-pulse">1. Uploading...</span>}
                                        {item.status === 'routing' && <span className="text-[11px] text-amber-400 font-bold animate-pulse">2. AI Routing...</span>}
                                        {item.status === 'completed' && <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> Completed</span>}
                                        {item.status === 'error' && <span className="text-[11px] text-rose-400 font-bold flex items-center gap-1"><ShieldAlert size={13} /> Failed</span>}
                                    </div>

                                    {/* Progress Step Bar */}
                                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                                        <div className={`h-1.5 rounded-full ${item.status !== 'pending' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                        <div className={`h-1.5 rounded-full ${item.status === 'routing' || item.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                        <div className={`h-1.5 rounded-full ${item.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                        <div className={`h-1.5 rounded-full ${item.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                    </div>

                                    <p className="text-[11px] text-slate-400">{item.message || item.error}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-800">
                            <button
                                onClick={() => setShowUploadModal(false)}
                                disabled={isProcessingUpload}
                                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 9. STORAGE FOLDERS & MANIFEST RULES MODAL */}
            {/* ========================================================================= */}
            {showManifestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <Folder size={18} className="text-amber-400" />
                                    Storage Folders & Entity Routing Manifest
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Supabase Storage bucket: <code className="text-emerald-400 font-mono">documents/</code>
                                </p>
                            </div>
                            <button onClick={() => setShowManifestModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3">
                            {categories.map(cat => (
                                <div key={cat.id || cat.category_key} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-white">{cat.name}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-amber-300 font-mono">{cat.category_key}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">{cat.owner}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Target Folder: <code className="text-emerald-400 font-mono">documents/{cat.folder_slug}/YYYY/</code>
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {(cat.aliases || []).map((a, i) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{a}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-xs font-mono font-bold text-slate-300">Unit: {cat.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-800">
                            <button
                                onClick={() => setShowManifestModal(false)}
                                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
