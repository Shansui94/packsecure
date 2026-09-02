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
    ArrowDownRight,
    BookOpen,
    Camera,
    MessageCircle,
    CheckSquare,
    Users,
    Tag,
    HelpCircle,
    ChevronDown,
    Plus
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

interface DocumentVoucher {
    id: string;
    file_name: string;
    file_url: string;
    category_key: string;
    period_year: number;
    period_month: number;
    total_amount: number;
    doc_date?: string;
    doc_number?: string;
    vendor_name?: string;
    vehicle_plate?: string;
    location_tag?: string;
    created_at?: string;
}

interface MonthCellData {
    value: number;
    source_type: string;
    file_url?: string;
    document_id?: string;
    notes?: string;
    vouchers?: DocumentVoucher[];
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
    const currentDayOfMonth = new Date().getDate();

    // Main States
    const [activeViewMode, setActiveViewMode] = useState<'MATRIX' | 'CHECKLIST'>('MATRIX');
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(currentNaturalMonth);
    const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('ALL');
    const [matrix, setMatrix] = useState<Record<string, MatrixCategoryRow>>({});
    const [categories, setCategories] = useState<DocumentManifestEntity[]>([]);
    const [salesSummary, setSalesSummary] = useState<any>({ autocount: 0, shopee: 0, grand_total_sales: 0, monthly_total_sales: {} });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);

    // Modals & Drawers
    const [showSOPModal, setShowSOPModal] = useState<boolean>(false);
    const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
    const [showManifestModal, setShowManifestModal] = useState<boolean>(false);
    const [selectedCardDetail, setSelectedCardDetail] = useState<{
        categoryKey: string;
        category: DocumentManifestEntity;
    } | null>(null);

    // Filter inside Detail Drawer
    const [drawerPlateFilter, setDrawerPlateFilter] = useState<string>('ALL');

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
        vendorName?: string;
        vehiclePlate?: string;
        error?: string;
    }>>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const cardFileInputRef = useRef<HTMLInputElement>(null);
    const [targetUploadMeta, setTargetUploadMeta] = useState<{ categoryKey?: string; month?: number }>({});

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

        const channel = supabase.channel('william-metrics-sync-p2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'william_dashboard_metrics' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'extracted_documents' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedYear]);

    // Handle Upload
    const handleFilesSelected = async (files: FileList | File[], targetCatKey?: string, targetM?: number) => {
        if (!files || files.length === 0) return;
        setIsProcessingUpload(true);

        const newQueue = Array.from(files).map(f => ({
            fileName: f.name,
            status: 'pending' as const,
            message: 'Queued for processing...'
        }));
        setUploadQueue(newQueue);
        setShowUploadModal(true);

        const activeCatKey = targetCatKey || targetUploadMeta.categoryKey;
        const activeM = targetM || targetUploadMeta.month || (typeof selectedMonth === 'number' ? selectedMonth : undefined);

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

                setUploadQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'routing', message: 'Gemini 2.5 Flash parsing & folder classification...' } : it));

                const response = await fetch('/api/v2/documents/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileBase64: base64Data,
                        fileName: file.name,
                        mimeType: file.type || 'application/pdf',
                        targetCategoryKey: activeCatKey || undefined,
                        targetMonth: activeM || undefined
                    })
                });

                const resData = await response.json();

                if (response.ok && resData.success) {
                    const tagInfo = resData.vehicle_plate ? ` [Plate: ${resData.vehicle_plate}]` : (resData.vendor_name ? ` [${resData.vendor_name}]` : '');
                    setUploadQueue(prev => prev.map((it, idx) => idx === i ? {
                        ...it,
                        status: 'completed',
                        message: `Processed: ${resData.category_name} (${MONTH_NAMES[resData.period_month - 1]}) -> RM ${Number(resData.total_amount).toLocaleString()}${tagInfo}`,
                        categoryName: resData.category_name,
                        amount: resData.total_amount,
                        month: resData.period_month,
                        vendorName: resData.vendor_name,
                        vehiclePlate: resData.vehicle_plate
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
        setTargetUploadMeta({});
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

    // Fetch PDF Document for Drawer Preview
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

    // Helper: Compute Month Status & Completion
    const getMonthStatus = (categoryKey: string, month: number) => {
        const row = matrix[categoryKey];
        if (!row) return 'MISSING';
        const cell = row.months[month];
        if (cell && cell.value > 0) return 'COMPLETED';

        // If current natural month: 1st-10th is 'WINDOW', >10th is 'OVERDUE'
        if (selectedYear === currentYear && month === currentNaturalMonth) {
            return currentDayOfMonth <= 10 ? 'WINDOW' : 'OVERDUE';
        }
        // Past months with 0 value are OVERDUE
        if (selectedYear < currentYear || (selectedYear === currentYear && month < currentNaturalMonth)) {
            return 'OVERDUE';
        }
        return 'UPCOMING';
    };

    // Helper: Compute Month Value, Previous Month Value, and MoM %
    const getCardMetrics = (categoryKey: string) => {
        const row = matrix[categoryKey];
        if (!row) return { currentVal: 0, prevVal: 0, momPct: 0, totalVal: 0, isIncrease: false, chartData: [], isFilled: false, docId: undefined, fileUrl: undefined, vouchers: [] };

        const chartData = MONTH_NAMES.map((name, idx) => ({
            name,
            value: row.months[idx + 1]?.value || 0
        }));

        if (selectedMonth === 'ALL') {
            const allVouchers = Object.values(row.months).flatMap(m => m.vouchers || []);
            return {
                currentVal: row.total,
                prevVal: 0,
                momPct: 0,
                totalVal: row.total,
                isIncrease: false,
                chartData,
                isFilled: row.total > 0,
                docId: undefined,
                fileUrl: undefined,
                vouchers: allVouchers
            };
        }

        const m = selectedMonth as number;
        const currentCell = row.months[m];
        const currentVal = currentCell?.value || 0;
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
            docId: currentCell?.document_id,
            fileUrl: currentCell?.file_url,
            vouchers: currentCell?.vouchers || []
        };
    };

    // High Level Totals & Completion Score
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
        const allTrackedKeys = [...fleetKeys, ...prodKeys, 'AUTOCOUNT_SALES', 'SHOPEE_SALES'];

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

        // Completion Score Calculation
        const targetMonth = selectedMonth === 'ALL' ? currentNaturalMonth : selectedMonth;
        let completedCount = 0;
        let windowCount = 0;
        let overdueCount = 0;

        allTrackedKeys.forEach(k => {
            const st = getMonthStatus(k, targetMonth);
            if (st === 'COMPLETED') completedCount++;
            else if (st === 'WINDOW') windowCount++;
            else if (st === 'OVERDUE') overdueCount++;
        });

        const totalTracked = allTrackedKeys.length;
        const completionRate = Math.round((completedCount / totalTracked) * 100);

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
            prodTrendData,
            completedCount,
            windowCount,
            overdueCount,
            totalTracked,
            completionRate
        };
    }, [matrix, selectedMonth]);

    // Send WhatsApp Reminder
    const sendWhatsAppReminder = (ownerName: string, categoryName: string, monthNum: number) => {
        const monthStr = MONTH_NAMES[monthNum - 1];
        const text = encodeURIComponent(
            `Hi ${ownerName}，Packsecure OS 经营管理系统提醒您：\n\n` +
            `📌 【${selectedYear} 年 ${monthStr} 月】的【${categoryName}】单据尚未完成归档。\n` +
            `请您尽快点击以下链接，通过手机直接拍照或上传 PDF 发票完成核验：\n` +
            `👉 https://packsecure.vercel.app/ \n\n` +
            `感谢配合与支持！`
        );
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };

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

    // Filter cards by owner
    const shouldDisplayOwner = (owner: string) => {
        if (selectedOwnerFilter === 'ALL') return true;
        if (selectedOwnerFilter === 'YUAN YUAN') {
            return ['ELECTRICITY_BILL', 'WATER_BILL', 'MYANMAR_SALARY', 'MACHINE_EXPENSES'].includes(owner);
        }
        return owner === selectedOwnerFilter;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-7 selection:bg-amber-500/30 font-sans">
            {/* 1. Header & Top Controls */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 border-b border-slate-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-950/40">
                            <Sparkles className="text-white" size={26} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                                William's Executive Intelligence Hub
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                                    Phase 2 SOP
                                </span>
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                12-Month Matrix • AI Multi-Receipt Sum • WhatsApp Reminders • Plate/Plant Tagging
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
                    {/* View Switcher: Matrix vs Checklist */}
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
                        <button
                            onClick={() => setActiveViewMode('MATRIX')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeViewMode === 'MATRIX' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <BarChart3 size={13} />
                            Matrix View
                        </button>
                        <button
                            onClick={() => setActiveViewMode('CHECKLIST')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeViewMode === 'CHECKLIST' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <CheckSquare size={13} />
                            My Checklist
                        </button>
                    </div>

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

                    {/* Owner Filter */}
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
                        <Users size={13} className="text-slate-400 mr-2" />
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

                    {/* 📘 SOP Playbook Button */}
                    <button
                        onClick={() => setShowSOPModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-950/80 to-indigo-950/80 hover:from-blue-900 hover:to-indigo-900 text-blue-300 hover:text-white text-xs font-bold border border-blue-800/80 transition active:scale-95 shadow-sm"
                    >
                        <BookOpen size={14} className="text-blue-400" />
                        SOP & Rules Guide
                    </button>

                    {/* Export Excel */}
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition active:scale-95 shadow-sm"
                    >
                        <Download size={14} className="text-emerald-400" />
                        Export Excel
                    </button>

                    {/* Storage Folders */}
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

                    {/* Camera Capture Input */}
                    <input
                        type="file"
                        ref={cameraInputRef}
                        onChange={e => e.target.files && handleFilesSelected(e.target.files)}
                        accept="image/*"
                        capture="environment"
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

            {/* 2. Top Completion Score & Traffic Light Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                            {selectedMonth === 'ALL' ? 'Full Year' : `${selectedYear} 年 ${MONTH_NAMES[(selectedMonth as number) - 1]} 月`} 单据归档完成度
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${heroMetrics.completionRate >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            {heroMetrics.completionRate}% 达成
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                            🟢 已核验完成: <b className="text-white font-mono">{heroMetrics.completedCount}</b> 项
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                            🟡 当月收集期 (1~10号): <b className="text-white font-mono">{heroMetrics.windowCount}</b> 项
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                            🔴 逾期待催单 (&gt;10号): <b className="text-rose-400 font-mono font-bold">{heroMetrics.overdueCount}</b> 项
                        </span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full md:w-72 space-y-1.5">
                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex shadow-inner">
                        <div
                            style={{ width: `${heroMetrics.completionRate}%` }}
                            className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-500"
                        />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-slate-400">
                        <span>{heroMetrics.completedCount} / {heroMetrics.totalTracked} 科目已就绪</span>
                        <span>{100 - heroMetrics.completionRate}% 待归档</span>
                    </div>
                </div>
            </div>

            {/* 3. Month Timeline Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
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

            {/* ========================================================================= */}
            {/* VIEW MODE 1: MATRIX & HERO KPI DASHBOARD */}
            {/* ========================================================================= */}
            {activeViewMode === 'MATRIX' && (
                <div className="space-y-8">
                    {/* Top 4 Hero Executive Cards */}
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

                            <div className="h-10 mt-3 -mx-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={heroMetrics.revenueTrendData}>
                                        <defs>
                                            <linearGradient id="gradRev2" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gradRev2)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                                <span>AutoCount: <b className="text-slate-200">RM {heroMetrics.autoCountSales.toLocaleString()}</b></span>
                                <span>Shopee: <b className="text-slate-200">RM {heroMetrics.shopeeSales.toLocaleString()}</b></span>
                            </div>
                        </div>

                        {/* Hero 2: Total Fleet Costs */}
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

                            <div className="h-10 mt-3 -mx-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={heroMetrics.fleetTrendData}>
                                        <Bar dataKey="cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                                <span>Petrol, TnGo, Service, Puspakom</span>
                                <span className="text-amber-400/80 font-bold">Multi-Sum</span>
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

                            <div className="h-10 mt-3 -mx-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={heroMetrics.prodTrendData}>
                                        <defs>
                                            <linearGradient id="gradProd2" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="cost" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#gradProd2)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                                <span>Electricity, Water, Salary, Parts</span>
                                <span className="text-emerald-400 font-bold text-[10px]">Monthly Routine</span>
                            </div>
                        </div>

                        {/* Hero 4: Net Surplus */}
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

                    {/* Group 1: Fleet Expenses (Amy) */}
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
                                        Multi-receipt auto accumulation, fuel cards, workshop invoices & vehicle inspection
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            {[
                                { key: 'PETROL_FLEET', label: 'Petrol History (油费支出)', desc: 'Fleet card fuel receipts & statements', color: '#f59e0b' },
                                { key: 'TNGO_TOLL', label: 'TnGo History (过路费支出)', desc: 'RFID & Touch n Go statements', color: '#38bdf8' },
                                { key: 'LORRY_SERVICE', label: 'Service Cost (维修保养)', desc: 'Workshop invoices & tyre repairs', color: '#ec4899' },
                                { key: 'PUSPAKOM_INSURANCE', label: 'Puspakom & Insurance (验车保费)', desc: 'Inspection certs & vehicle policies', color: '#8b5cf6' }
                            ].map(item => {
                                const row = matrix[item.key];
                                if (!row || !shouldDisplayOwner(row.category.owner)) return null;
                                const cardData = getCardMetrics(item.key);
                                const curM = selectedMonth === 'ALL' ? currentNaturalMonth : (selectedMonth as number);
                                const status = getMonthStatus(item.key, curM);

                                return (
                                    <div
                                        key={item.key}
                                        onClick={() => setSelectedCardDetail({ categoryKey: item.key, category: row.category })}
                                        className="p-5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                                    >
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <div className="pr-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                            {row.category.owner}
                                                        </span>
                                                        {cardData.vouchers.length > 1 && (
                                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                                                                {cardData.vouchers.length} Vouchers Sum
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors mt-0.5">
                                                        {item.label}
                                                    </h4>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                                                </div>

                                                {/* Traffic Light Badge */}
                                                {status === 'COMPLETED' ? (
                                                    <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="Completed & Verified">
                                                        <Check size={14} />
                                                    </span>
                                                ) : status === 'OVERDUE' ? (
                                                    <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse" title="Overdue Submission">
                                                        <AlertCircle size={14} />
                                                    </span>
                                                ) : (
                                                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300" title="In Collection Window">
                                                        <Clock size={14} />
                                                    </span>
                                                )}
                                            </div>

                                            {/* Amount */}
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

                                        {/* 12-Month Sparkline Chart */}
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

                    {/* Group 2: Company Sales & Live Stock */}
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
                    </div>

                    {/* Group 3: Production & Utilities */}
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
                                const curM = selectedMonth === 'ALL' ? currentNaturalMonth : (selectedMonth as number);
                                const status = getMonthStatus(item.key, curM);

                                return (
                                    <div
                                        key={item.key}
                                        onClick={() => setSelectedCardDetail({ categoryKey: item.key, category: row.category })}
                                        className={`p-5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border transition-all duration-200 cursor-pointer flex flex-col justify-between group ${item.isMonthlyUpdate
                                            ? (status === 'COMPLETED' ? 'border-slate-800 hover:border-emerald-500/50' : status === 'OVERDUE' ? 'border-rose-500/40 bg-rose-950/10 hover:border-rose-400' : 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-400')
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

                                                {/* Status Badge */}
                                                {status === 'COMPLETED' ? (
                                                    <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="Completed">
                                                        <Check size={14} />
                                                    </span>
                                                ) : status === 'OVERDUE' ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            sendWhatsAppReminder(row.category.owner, row.category.name, curM);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/40 transition"
                                                        title="Click to Send WhatsApp Reminder"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </button>
                                                ) : (
                                                    <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 animate-pulse border border-emerald-500/40" title="Pending Collection">
                                                        <Clock size={14} />
                                                    </span>
                                                )}
                                            </div>

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
                </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 2: RESPONSIBLE OWNER CHECKLIST (MY CHECKLIST) */}
            {/* ========================================================================= */}
            {activeViewMode === 'CHECKLIST' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
                        <div>
                            <h3 className="text-base font-black text-white flex items-center gap-2">
                                <CheckSquare size={18} className="text-amber-400" />
                                责任人月度交单待办清单 ({selectedMonth === 'ALL' ? 'Full Year' : `${selectedYear} 年 ${MONTH_NAMES[(selectedMonth as number) - 1]} 月`})
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                点击拍照或上传发票凭证，AI 自动核验归档并点亮经营大盘
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {categories.map(cat => {
                            if (!shouldDisplayOwner(cat.owner)) return null;
                            const curM = selectedMonth === 'ALL' ? currentNaturalMonth : (selectedMonth as number);
                            const row = matrix[cat.category_key];
                            const monthData = row?.months[curM];
                            const status = getMonthStatus(cat.category_key, curM);
                            const voucherCount = monthData?.vouchers?.length || 0;

                            return (
                                <div
                                    key={cat.category_key}
                                    className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-between space-y-4 ${status === 'COMPLETED'
                                        ? 'bg-slate-900/60 border-slate-800'
                                        : status === 'OVERDUE'
                                            ? 'bg-rose-950/20 border-rose-500/40'
                                            : 'bg-amber-950/20 border-amber-500/40'
                                        }`}
                                >
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                                        {cat.owner}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                                        {cat.section}
                                                    </span>
                                                </div>
                                                <h4 className="text-base font-black text-white mt-1">
                                                    {cat.name}
                                                </h4>
                                            </div>

                                            {/* Status Pill */}
                                            {status === 'COMPLETED' ? (
                                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                                                    <CheckCircle2 size={13} /> 已完成
                                                </span>
                                            ) : status === 'OVERDUE' ? (
                                                <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1 animate-pulse">
                                                    <AlertCircle size={13} /> 逾期未交
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1">
                                                    <Clock size={13} /> 收集期
                                                </span>
                                            )}
                                        </div>

                                        {/* Current Amount & Vouchers */}
                                        <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between font-mono">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block font-sans">当月归档金额</span>
                                                <span className="text-lg font-black text-white">
                                                    RM {(monthData?.value || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400 block font-sans">已收凭证</span>
                                                <span className="text-xs font-bold text-amber-400">
                                                    {voucherCount} 张单据
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                                        <button
                                            onClick={() => {
                                                setTargetUploadMeta({ categoryKey: cat.category_key, month: curM });
                                                cameraInputRef.current?.click();
                                            }}
                                            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
                                        >
                                            <Camera size={14} /> 拍照秒传
                                        </button>

                                        <button
                                            onClick={() => {
                                                setTargetUploadMeta({ categoryKey: cat.category_key, month: curM });
                                                fileInputRef.current?.click();
                                            }}
                                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
                                            title="Upload PDF File"
                                        >
                                            <Upload size={13} />
                                        </button>

                                        {status === 'OVERDUE' && (
                                            <button
                                                onClick={() => sendWhatsAppReminder(cat.owner, cat.name, curM)}
                                                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow"
                                                title="Send WhatsApp Reminder to Owner"
                                            >
                                                <MessageCircle size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 4. SLIDE-OVER DETAIL & MULTI-VOUCHER AUDIT DRAWER */}
            {/* ========================================================================= */}
            {selectedCardDetail && matrix[selectedCardDetail.categoryKey] && (() => {
                const catRow = matrix[selectedCardDetail.categoryKey];
                const chartData = MONTH_NAMES.map((name, idx) => ({
                    name,
                    value: catRow.months[idx + 1]?.value || 0
                }));

                const curM = selectedMonth === 'ALL' ? currentNaturalMonth : (selectedMonth as number);
                const curMonthCell = catRow.months[curM];
                const vouchers = curMonthCell?.vouchers || [];

                // Filter vouchers by vehicle plate
                const filteredVouchers = vouchers.filter(v => {
                    if (drawerPlateFilter === 'ALL') return true;
                    return v.vehicle_plate === drawerPlateFilter;
                });

                // Unique vehicle plates in vouchers
                const uniquePlates = Array.from(new Set(vouchers.map(v => v.vehicle_plate).filter(Boolean)));

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm">
                        <div className="w-full max-w-3xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
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
                                        {selectedYear} Annual Trajectory • Total: <b className="text-emerald-400 font-mono">RM {catRow.total.toLocaleString()}</b>
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
                                                    <linearGradient id="detailGrad2" x1="0" y1="0" x2="0" y2="1">
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
                                                <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#detailGrad2)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Multi-Receipt Underlyings for this Month */}
                                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                                <FileText size={14} className="text-amber-400" />
                                                {selectedYear} 年 {MONTH_NAMES[curM - 1]} 月底层凭证列表 ({vouchers.length} 张单据)
                                            </h4>
                                            <p className="text-[11px] text-slate-400">同月份多张单据自动累加求和</p>
                                        </div>

                                        {/* Plate Filter */}
                                        {uniquePlates.length > 0 && (
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className="text-slate-400">车牌筛选:</span>
                                                <select
                                                    value={drawerPlateFilter}
                                                    onChange={e => setDrawerPlateFilter(e.target.value)}
                                                    className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                                                >
                                                    <option value="ALL">全部车牌 (All)</option>
                                                    {uniquePlates.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {filteredVouchers.length > 0 ? (
                                        <div className="rounded-xl border border-slate-800 overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                                                    <tr>
                                                        <th className="py-2 px-3">Date / File</th>
                                                        <th className="py-2 px-3">Merchant / Vendor</th>
                                                        <th className="py-2 px-3">Plate / Loc</th>
                                                        <th className="py-2 px-3 text-right">Amount</th>
                                                        <th className="py-2 px-3 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800 font-mono">
                                                    {filteredVouchers.map(v => (
                                                        <tr key={v.id} className="hover:bg-slate-850">
                                                            <td className="py-2 px-3 text-slate-200">
                                                                <div>{v.doc_date || v.created_at?.substring(0, 10)}</div>
                                                                <span className="text-[10px] text-slate-500 truncate max-w-xs block font-sans">{v.file_name}</span>
                                                            </td>
                                                            <td className="py-2 px-3 text-slate-300 font-sans">
                                                                {v.vendor_name || '-'}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                {v.vehicle_plate ? (
                                                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">
                                                                        {v.vehicle_plate}
                                                                    </span>
                                                                ) : v.location_tag ? (
                                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                                                                        {v.location_tag}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                                                                RM {Number(v.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-2 px-3 text-center font-sans">
                                                                <button
                                                                    onClick={() => handleLoadDocPreview(v.id)}
                                                                    className="text-amber-400 hover:underline flex items-center justify-center gap-1 mx-auto text-[11px]"
                                                                >
                                                                    <Eye size={12} /> View
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-slate-500 text-xs bg-slate-900/40 rounded-xl">
                                            当前月份暂无明细凭证，点击下方按钮上传发票
                                        </div>
                                    )}

                                    {/* Upload More for this Month */}
                                    <div className="pt-2 flex justify-end">
                                        <button
                                            onClick={() => {
                                                setTargetUploadMeta({ categoryKey: catRow.category.category_key, month: curM });
                                                cardFileInputRef.current?.click();
                                            }}
                                            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                                        >
                                            <Plus size={13} /> 上传并累加本月新发票
                                        </button>
                                        <input
                                            type="file"
                                            ref={cardFileInputRef}
                                            onChange={e => e.target.files && handleFilesSelected(e.target.files, catRow.category.category_key, curM)}
                                            accept="application/pdf,image/*"
                                            className="hidden"
                                        />
                                    </div>
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
            {/* 5. 📘 BUILT-IN SOP & BUSINESS LOGIC PLAYBOOK MODAL */}
            {/* ========================================================================= */}
            {showSOPModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow">
                                    <BookOpen size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                                        William's Dashboard 业务规则与单据流转指南 (SOP Playbook)
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        全厂核心经营指标分工、单据流转、红绿灯机制与 AI 自动分类规则手册
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSOPModal(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-slate-300">
                            {/* Section 1: Responsibility Matrix */}
                            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                    <Users size={16} /> 1. 责任人分工矩阵 (Responsibility Matrix)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-amber-400">AMY (车队与机台)</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">6 项核心科目</span>
                                        </div>
                                        <ul className="mt-2 space-y-1 text-slate-300 list-disc list-inside">
                                            <li><b>车队油费 (Petrol History)</b>：Fleet Card / Diesel 发票</li>
                                            <li><b>车队过路费 (TnGo History)</b>：Touch 'n Go / RFID 对账单</li>
                                            <li><b>罗里维修保养 (Service Cost)</b>：车厂发票、换机油/轮胎</li>
                                            <li><b>验车保费 (Puspakom & Insurance)</b>：验车单与车险保单</li>
                                            <li><b>外劳月度薪资 (Myanmar Salary)</b>：外劳薪资与津贴总表</li>
                                            <li><b>机台备件维修 (Machine Expenses)</b>：螺杆、加热圈、轴承备件</li>
                                        </ul>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-blue-400">WINNIE (销售与公用事业)</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">4 项核心科目</span>
                                        </div>
                                        <ul className="mt-2 space-y-1 text-slate-300 list-disc list-inside">
                                            <li><b>AutoCount 销售总额 (Total Sales)</b>：ERP 月度开票总和</li>
                                            <li><b>Shopee 销售渠道</b>：电商平台月度结算单</li>
                                            <li><b>库存结存 (Stock Balance)</b>：系统实时自动同步 (Rolls)</li>
                                            <li><b>TNB 电费账单 (Electricity)</b>：工厂工业电费账单</li>
                                            <li><b>水费账单 (Water Bill)</b>：LAP 水务账单</li>
                                        </ul>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-indigo-400">MAX TAN (生产与车次)</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300">3 项实时科目</span>
                                        </div>
                                        <ul className="mt-2 space-y-1 text-slate-300 list-disc list-inside">
                                            <li><b>回收造粒产出 (Recycle Amount)</b>：T5/N3 机台日志实时聚合 (kg)</li>
                                            <li><b>缠绕膜废品损耗 (SF Defect Amount)</b>：报废日志实时聚合 (kg)</li>
                                            <li><b>各州出车班次 (Trip By States)</b>：物流派送日志实时聚合 (Trips)</li>
                                        </ul>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-emerald-400">YUAN YUAN (月度待办催办)</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">全流程核验</span>
                                        </div>
                                        <ul className="mt-2 space-y-1 text-slate-300 list-disc list-inside">
                                            <li><b>月度待办核验 (update monthly)</b>：重点跟进水电、外劳薪资与备件</li>
                                            <li><b>催收逾期账单</b>：每月 10 号后使用 WhatsApp 快速催收未办单据</li>
                                            <li><b>核对单据凭证</b>：检查单据金额是否与系统大盘吻合</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Deadlines & Traffic Light */}
                            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                <h4 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                    <Clock size={16} /> 2. 截止日与三色红绿灯规则 (Deadlines & Traffic Light)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1">
                                        <span className="font-bold text-amber-400 flex items-center gap-1.5">
                                            🟡 1 ~ 10 号：正常收集期
                                        </span>
                                        <p className="text-slate-400 text-[11px]">
                                            供应商月结单（如 TNB、Petronas）陆续到达，员工在手机或电脑端拍照/拖拽上传，系统显示黄色待办。
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1">
                                        <span className="font-bold text-rose-400 flex items-center gap-1.5">
                                            🔴 10 号后：逾期警报 & 催办
                                        </span>
                                        <p className="text-slate-400 text-[11px]">
                                            超过 10 号仍未提交的单据将变为红色警示，管理员可一键点击「📲 WhatsApp 催单」发送提醒。
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                                        <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                                            🟢 已交单：100% 闭环
                                        </span>
                                        <p className="text-slate-400 text-[11px]">
                                            AI 提取成功后，大盘对应单元格自动点亮绿色打勾，关联原件预览，完成度进度条递增。
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Single Bill vs Multi-Receipt */}
                            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                <h4 className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                                    <Plus size={16} /> 3. 单张月结单 vs 多张累加求和逻辑 (Single Bill vs Multi-Receipt Sum)
                                </h4>
                                <div className="space-y-2 text-slate-300 text-xs">
                                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                                        <b className="text-white">📄 单一月结单模式 (Single Monthly Statement)</b>：
                                        <span className="text-slate-400 block mt-0.5">适用科目：TNB 电费、水费账单、外劳薪资表。每个月只需上传 1 份月结账单，上传成功即代表该月份 100% 完成。</span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                                        <b className="text-white">📑 多张单据自动累加模式 (Multi-Receipt Auto-Sum)</b>：
                                        <span className="text-slate-400 block mt-0.5">适用科目：车队油费、罗里维修保养、机台备件。支持同一个月份随时上传多张小收据，AI 自动将所有单据金额求和累加（Total = 收据1 + 收据2 + ...），并在侧边抽屉中列出完整的底层凭证子清单。</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Vehicle Plate & Location Tagging */}
                            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                <h4 className="text-sm font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                                    <Tag size={16} /> 4. 车牌号、厂区地点与供应商自动识别 (Tagging & Breakdown)
                                </h4>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    当上传发票时，Gemini 2.5 Flash 会自动提取发票中的**车牌号（如 AKB 8821, WVT 3122）**、**厂区地点（Plant 1 怡保, Plant 2）**和**供应商名称（Petronas, Ban Lee Hin）**。在侧边抽屉中，您可以按车牌号筛选，精准透视每一辆罗里的花费走势！
                                </p>
                            </div>

                            {/* Section 5: Cloud Storage Hierarchy */}
                            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                <h4 className="text-sm font-black text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                    <Folder size={16} /> 5. 云端文件夹结构与永久追溯 (Cloud Storage)
                                </h4>
                                <p className="text-slate-400 text-xs">
                                    所有单据统一存储在 Supabase Storage 的 <code className="text-emerald-400 font-mono">documents/</code> 桶中，严格按照科目与年份分层：
                                </p>
                                <div className="p-3 rounded-xl bg-slate-900 font-mono text-[11px] text-slate-300 space-y-1">
                                    <div>📁 documents/fleet/petrol/2026/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(车队油费按年归档)</div>
                                    <div>📁 documents/utilities/electricity/2026/ &nbsp;&nbsp;&nbsp;(TNB 电费按年归档)</div>
                                    <div>📁 documents/payroll/myanmar_salary/2026/ &nbsp;&nbsp;&nbsp;(外劳薪资按年归档)</div>
                                    <div>📁 documents/Unassigned_Review/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(低置信度/待人工复核区)</div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950">
                            <button
                                onClick={() => setShowSOPModal(false)}
                                className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition active:scale-95"
                            >
                                我已了解 (Got It)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 6. BATCH INGESTION LIVE PIPELINE MODAL */}
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
                                        {item.status === 'routing' && <span className="text-[11px] text-amber-400 font-bold animate-pulse">2. AI Routing & Extracting...</span>}
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
            {/* 7. STORAGE FOLDERS & MANIFEST RULES MODAL */}
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
