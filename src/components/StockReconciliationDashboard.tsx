import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { WAREHOUSES } from '../data/factoryData';
import {
    Scale,
    TrendingUp,
    TrendingDown,
    BarChart3,
    ArrowRight,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    Calendar,
    Building2,
    Package,
    Download,
    RefreshCw,
    FileSpreadsheet,
    Sparkles,
    ShieldAlert,
    Layers,
    Search,
    SlidersHorizontal,
    ArrowUpDown,
    Check,
    ChevronRight,
    ArrowLeft,
    HelpCircle,
    Clock,
    Activity,
    Info,
    X,
    BookOpen,
    History
} from 'lucide-react';

interface Props {
    initialSku?: string | null;
    onBackToMatrix?: () => void;
}

interface SkuReconcileSummary {
    sku: string;
    name: string;
    type: string;
    uom: string;
    locId: string;
    auditStartDate: string;
    auditEndDate: string;
    startAuditStock: number;
    productionQty: number;
    deliveryQty: number;
    transferInQty: number;
    transferOutQty: number;
    expectedStock: number;
    currentActualStock: number;
    variance: number;
    absVariance: number;
    productionAccuracy: number;
    throughputAccuracy: number;
    isClosedAudit: boolean; // true = 拥有真实历史盘点闭环 (>=2次盘点)
    hasAnyAudit: boolean;   // true = 拥有至少1次真实实盘记录
    healthStatus: 'excellent' | 'good' | 'warning' | 'alert' | 'tracking';
    durationDays: number;
    dailyAvgProd: number;
    dailyAvgDeliv: number;
    dailyBreakdown: Record<string, { prod: number; deliv: number }>;
}

import { formatQty, formatSignedQty, parseAuditActual } from '../utils/stockFormat';

// Interactive Tooltip Component with High-Contrast Adaptive Styling
const HoverExplainer: React.FC<{
    title: string;
    formula?: string;
    description: string;
    highlight?: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom';
}> = ({ title, formula, description, highlight, children, position = 'top' }) => {
    return (
        <div className="group relative cursor-help">
            {children}
            <div className={`pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out transform group-hover:scale-100 scale-95 w-72 sm:w-80 p-3.5 rounded-2xl bg-slate-900/95 dark:bg-gray-950/95 border border-purple-400/40 text-left shadow-2xl backdrop-blur-xl ${
                position === 'top' ? 'bottom-full mb-2.5' : 'top-full mt-2.5'
            }`}>
                <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/10 text-xs font-bold text-white">
                    <Info size={13} className="text-purple-400 shrink-0" />
                    <span>{title}</span>
                </div>
                <p className="text-[11px] text-gray-200 mt-2 leading-relaxed">
                    {description}
                </p>
                {formula && (
                    <div className="mt-2 p-1.5 rounded-lg bg-black/40 border border-white/10 font-mono text-[10px] text-cyan-300 leading-snug break-all">
                        {formula}
                    </div>
                )}
                {highlight && (
                    <div className="mt-1.5 text-[10px] text-amber-300 font-medium flex items-center gap-1">
                        <span>💡</span>
                        <span>{highlight}</span>
                    </div>
                )}
                {/* Arrow Pointer */}
                <div className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900 dark:bg-gray-950 border-purple-400/40 rotate-45 ${
                    position === 'top' ? 'top-full -mt-1.5 border-r border-b' : 'bottom-full -mb-1.5 border-l border-t'
                }`}></div>
            </div>
        </div>
    );
};

export const StockReconciliationDashboard: React.FC<Props> = ({
    initialSku = null,
    onBackToMatrix
}) => {
    const [loading, setLoading] = useState(true);
    const [selectedLoc, setSelectedLoc] = useState<string>('OPM Lama');
    const [selectedSku, setSelectedSku] = useState<string>(initialSku || 'BW-SL-CLR-100Mx100CMx1ROLL-RED');
    // Mode 1: CLOSED_AUDIT (Default & Primary Focus)
    const [dateMode, setDateMode] = useState<'CLOSED_AUDIT' | 'AUDIT_TO_NOW' | 'THIS_MONTH' | 'LAST_7D' | 'LAST_30D' | 'CUSTOM'>('CLOSED_AUDIT');
    const [selectedAuditTxnId, setSelectedAuditTxnId] = useState<string>('LATEST');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'closed' | 'warning' | 'healthy'>('all');
    const [showGuideModal, setShowGuideModal] = useState(false);

    // Datasets
    const [warehouseSummaries, setWarehouseSummaries] = useState<any[]>([]);
    const [allAuditEvents, setAllAuditEvents] = useState<any[]>([]);
    const [masterItems, setMasterItems] = useState<any[]>([]);
    const [inventoryRecords, setInventoryRecords] = useState<any[]>([]);
    const [anomalies, setAnomalies] = useState<any[]>([]);

    // Focused SKU Drilldown State
    const [skuDrilldownLoading, setSkuDrilldownLoading] = useState(false);
    const [skuDailyBreakdown, setSkuDailyBreakdown] = useState<Record<string, { prod: number; deliv: number }>>({});
    const [skuCustomAuditFlow, setSkuCustomAuditFlow] = useState<any[] | null>(null);

    // If initialSku passed, set it
    useEffect(() => {
        if (initialSku) {
            setSelectedSku(initialSku);
        }
    }, [initialSku]);

    // Current Month Name e.g. "Sep"
    const currentMonthLabel = useMemo(() => {
        return new Date().toLocaleString('en-US', { month: 'short' });
    }, []);

    // 1. Warehouse Global Data Fetching (Fast RPC + Views, independent of selectedSku)
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const now = new Date();
            let effectiveStart: string | null = null;
            let effectiveEnd: string | null = null;

            if (dateMode === 'THIS_MONTH') {
                effectiveStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                effectiveEnd = now.toISOString();
            } else if (dateMode === 'LAST_7D') {
                effectiveStart = new Date(Date.now() - 7 * 86400000).toISOString();
                effectiveEnd = now.toISOString();
            } else if (dateMode === 'LAST_30D') {
                effectiveStart = new Date(Date.now() - 30 * 86400000).toISOString();
                effectiveEnd = now.toISOString();
            } else if (dateMode === 'CUSTOM' && customStartDate) {
                effectiveStart = new Date(customStartDate).toISOString();
                effectiveEnd = customEndDate ? new Date(customEndDate + 'T23:59:59').toISOString() : now.toISOString();
            }

            const [masterRes, invRes, auditRes, summaryRes, anomalyRes] = await Promise.all([
                supabase.from('master_items_v2').select('sku, name, type, uom').eq('status', 'Active'),
                supabase.from('v2_inventory_view').select('sku, name, type, uom, loc_id, current_stock'),
                supabase.from('stock_ledger_v2').select('*').ilike('event_type', '%Audit%').order('timestamp', { ascending: true }),
                supabase.rpc('get_warehouse_reconciliation_summary', {
                    p_loc_id: selectedLoc,
                    p_mode: dateMode,
                    p_start_time: effectiveStart,
                    p_end_time: effectiveEnd
                }),
                supabase.from('stock_ledger_v2')
                    .select('txn_id, sku, loc_id, ref_doc, notes, change_qty, timestamp')
                    .or('ref_doc.ilike.%TEST%,notes.ilike.%TEST%')
                    .order('timestamp', { ascending: false })
                    .limit(10)
            ]);

            setMasterItems(masterRes.data || []);
            setInventoryRecords(invRes.data || []);
            setAllAuditEvents(auditRes.data || []);
            setWarehouseSummaries(summaryRes.data || []);
            setAnomalies(anomalyRes.data || []);

        } catch (err) {
            console.error("Error loading reconciliation data:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedLoc, dateMode, customStartDate, customEndDate]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Available warehouses (include 'ALL' option)
    const warehouseList = useMemo(() => {
        const set = new Set<string>(WAREHOUSES);
        inventoryRecords.forEach(r => {
            if (r.loc_id) set.add(r.loc_id);
        });
        const list = Array.from(set).filter(Boolean);
        return ['ALL', ...list];
    }, [inventoryRecords]);

    // Available Historical Audits for the CURRENTLY selected SKU & Location
    const activeSkuAudits = useMemo(() => {
        return allAuditEvents.filter(a => 
            a.sku?.trim() === selectedSku && 
            (!selectedLoc || selectedLoc === 'ALL' || (a.loc_id || '').toLowerCase().trim() === selectedLoc.toLowerCase().trim())
        ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first
    }, [allAuditEvents, selectedSku, selectedLoc]);

    // 2. Focused SKU Drilldown Loading (Daily In/Out Flow & Historical Flow)
    useEffect(() => {
        if (!selectedSku) return;

        let cancelled = false;
        const fetchSkuDrilldown = async () => {
            setSkuDrilldownLoading(true);
            try {
                const now = new Date();
                const last30dStart = new Date(Date.now() - 30 * 86400000).toISOString();
                let drillStart = last30dStart;
                let drillEnd = now.toISOString();

                if (dateMode === 'CLOSED_AUDIT') {
                    if (activeSkuAudits.length >= 2) {
                        let targetIdx = 0; // Newest is index 0
                        if (selectedAuditTxnId !== 'LATEST') {
                            const found = activeSkuAudits.findIndex(a => a.txn_id === selectedAuditTxnId);
                            if (found !== -1) targetIdx = found;
                        }
                        const curAudit = activeSkuAudits[targetIdx];
                        const prevAudit = activeSkuAudits[targetIdx + 1] || curAudit;
                        drillStart = prevAudit.timestamp;
                        drillEnd = curAudit.timestamp;
                    } else if (activeSkuAudits.length === 1) {
                        drillStart = activeSkuAudits[0].timestamp;
                        drillEnd = now.toISOString();
                    }
                } else if (dateMode === 'THIS_MONTH') {
                    drillStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                    drillEnd = now.toISOString();
                } else if (dateMode === 'LAST_7D') {
                    drillStart = new Date(Date.now() - 7 * 86400000).toISOString();
                    drillEnd = now.toISOString();
                } else if (dateMode === 'LAST_30D') {
                    drillStart = last30dStart;
                    drillEnd = now.toISOString();
                } else if (dateMode === 'CUSTOM' && customStartDate) {
                    drillStart = new Date(customStartDate).toISOString();
                    drillEnd = customEndDate ? new Date(customEndDate + 'T23:59:59').toISOString() : now.toISOString();
                }

                const promises: Promise<any>[] = [
                    supabase.rpc('get_sku_reconciliation_daily', {
                        p_sku: selectedSku,
                        p_loc_id: selectedLoc === 'ALL' ? null : selectedLoc,
                        p_start_time: drillStart,
                        p_end_time: drillEnd
                    })
                ];

                // If non-latest historical audit selected, fetch exact flow for that period
                if (dateMode === 'CLOSED_AUDIT' && selectedAuditTxnId !== 'LATEST') {
                    promises.push(
                        supabase.rpc('get_stock_reconciliation_flow', {
                            p_loc_id: selectedLoc === 'ALL' ? null : selectedLoc,
                            p_start_time: drillStart,
                            p_end_time: drillEnd
                        })
                    );
                }

                const [dailyRes, flowRes] = await Promise.all(promises);
                if (cancelled) return;

                const breakdown: Record<string, { prod: number; deliv: number }> = {};
                if (dailyRes.data) {
                    dailyRes.data.forEach((r: any) => {
                        breakdown[r.day] = {
                            prod: Number(r.production_qty) || 0,
                            deliv: Number(r.delivery_qty) || 0
                        };
                    });
                }
                setSkuDailyBreakdown(breakdown);

                if (flowRes && flowRes.data) {
                    const match = flowRes.data.filter((r: any) => r.sku === selectedSku);
                    setSkuCustomAuditFlow(match);
                } else {
                    setSkuCustomAuditFlow(null);
                }
            } catch (err) {
                console.error("Error loading SKU drilldown:", err);
            } finally {
                if (!cancelled) setSkuDrilldownLoading(false);
            }
        };

        fetchSkuDrilldown();
        return () => {
            cancelled = true;
        };
    }, [selectedSku, selectedAuditTxnId, selectedLoc, dateMode, customStartDate, customEndDate, activeSkuAudits]);

    // 3. Build Reconciliation Calculation for ALL SKUs (Pure Memory, Instant & Deterministic)
    const reconciliationMatrix = useMemo<SkuReconcileSummary[]>(() => {
        if (!masterItems.length) return [];

        const summaryMap = new Map<string, any>();
        warehouseSummaries.forEach(s => summaryMap.set(s.sku?.trim(), s));

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const last7dStart = new Date(Date.now() - 7 * 86400000).toISOString();
        const last30dStart = new Date(Date.now() - 30 * 86400000).toISOString();

        return masterItems.map(item => {
            const sku = item.sku.trim();
            const isTargetSku = (sku === selectedSku);
            const summary = summaryMap.get(sku);

            const skuAudits = allAuditEvents.filter(a => 
                a.sku?.trim() === sku && 
                (!selectedLoc || selectedLoc === 'ALL' || (a.loc_id || '').toLowerCase().trim() === selectedLoc.toLowerCase().trim())
            ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            let startAuditDate = summary?.start_time || last30dStart;
            let endAuditDate = summary?.end_time || now.toISOString();
            let startAuditStock = Number(summary?.start_stock) || 0;
            let currentActualStock = Number(summary?.actual_stock) || 0;
            let productionQty = Number(summary?.prod_qty) || 0;
            let deliveryQty = Number(summary?.deliv_qty) || 0;
            let transferInQty = Number(summary?.transfer_in_qty) || 0;
            let transferOutQty = 0;
            let otherQty = Number(summary?.other_qty) || 0;
            let isClosedAudit = summary ? Boolean(summary.has_closed_audit) : false;
            let hasAnyAudit = summary ? Boolean(summary.has_any_audit) : (skuAudits.length > 0);

            // Fallback actual stock from inventory view if not closed audit or no summary
            if (!isClosedAudit) {
                const invMatch = inventoryRecords.find(r => 
                    r.sku?.trim() === sku && 
                    (!selectedLoc || selectedLoc === 'ALL' || (r.loc_id || '').toLowerCase().trim() === selectedLoc.toLowerCase().trim())
                );
                currentActualStock = invMatch ? Number(invMatch.current_stock) || 0 : 0;
            }

            // If this is the focused SKU and a non-latest historical audit was selected
            if (isTargetSku && dateMode === 'CLOSED_AUDIT' && selectedAuditTxnId !== 'LATEST') {
                const foundIdx = skuAudits.findIndex(a => a.txn_id === selectedAuditTxnId);
                if (foundIdx >= 1) {
                    const prevAudit = skuAudits[foundIdx - 1];
                    const curAudit = skuAudits[foundIdx];
                    startAuditDate = prevAudit.timestamp;
                    endAuditDate = curAudit.timestamp;
                    startAuditStock = parseAuditActual(prevAudit);
                    currentActualStock = parseAuditActual(curAudit);
                    isClosedAudit = true;

                    if (skuCustomAuditFlow) {
                        let p = 0, d = 0, tin = 0, oth = 0;
                        skuCustomAuditFlow.forEach((cf: any) => {
                            const q = Number(cf.total_qty) || 0;
                            if (cf.event_type === 'Production') p += q;
                            else if (cf.event_type === 'Transfer Out') d += Math.abs(q);
                            else if (cf.event_type === 'Transfer In') tin += q;
                            else if (!cf.event_type.includes('Audit')) oth += q;
                        });
                        productionQty = p;
                        deliveryQty = d;
                        transferInQty = tin;
                        otherQty = oth;
                    }
                }
            }

            // Duration Days & Daily Averages
            const startMs = new Date(startAuditDate).getTime();
            const endMs = new Date(endAuditDate).getTime();
            const durationDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
            const dailyAvgProd = parseFloat((productionQty / durationDays).toFixed(1));
            const dailyAvgDeliv = parseFloat((deliveryQty / durationDays).toFixed(1));

            // Expected Stock & Accuracies (Account for start, production, delivery, transfer in, and adjustments)
            const expectedStock = parseFloat((startAuditStock + productionQty + transferInQty + otherQty - deliveryQty).toFixed(2));
            const variance = parseFloat((currentActualStock - expectedStock).toFixed(2));
            const absVariance = Math.abs(variance);

            let productionAccuracy = 100;
            let throughputAccuracy = 100;

            if (isClosedAudit) {
                if (productionQty > 0) {
                    productionAccuracy = Math.max(0, (1 - absVariance / productionQty) * 100);
                }
                const totalThroughput = productionQty + deliveryQty;
                if (totalThroughput > 0) {
                    throughputAccuracy = Math.max(0, (1 - absVariance / totalThroughput) * 100);
                }
            }

            // Health Status
            let healthStatus: 'excellent' | 'good' | 'warning' | 'alert' | 'tracking' = 'tracking';
            if (isClosedAudit) {
                if (productionAccuracy >= 95) healthStatus = 'excellent';
                else if (productionAccuracy >= 88) healthStatus = 'good';
                else if (productionAccuracy >= 75) healthStatus = 'warning';
                else healthStatus = 'alert';
            } else {
                healthStatus = 'tracking';
            }

            return {
                sku,
                name: item.name || sku,
                type: item.type || 'FG',
                uom: item.uom || 'Unit',
                locId: selectedLoc,
                auditStartDate: startAuditDate,
                auditEndDate: endAuditDate,
                startAuditStock,
                productionQty,
                deliveryQty,
                transferInQty,
                transferOutQty,
                expectedStock,
                currentActualStock,
                variance,
                absVariance,
                productionAccuracy,
                throughputAccuracy,
                isClosedAudit,
                hasAnyAudit,
                healthStatus,
                durationDays,
                dailyAvgProd,
                dailyAvgDeliv,
                dailyBreakdown: isTargetSku ? skuDailyBreakdown : {}
            };
        });
    }, [masterItems, warehouseSummaries, allAuditEvents, inventoryRecords, selectedLoc, dateMode, selectedSku, selectedAuditTxnId, skuCustomAuditFlow, skuDailyBreakdown]);

    // Filtered Table for Leaderboard
    const filteredSummaries = useMemo(() => {
        return reconciliationMatrix.filter(row => {
            if (dateMode === 'CLOSED_AUDIT') {
                if (filterStatus === 'closed') return row.isClosedAudit;
                // Show items that have an audit history or flow
                if (!row.hasAnyAudit && row.productionQty === 0 && row.deliveryQty === 0) {
                    return false;
                }
            }

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!row.sku.toLowerCase().includes(q) && !row.name.toLowerCase().includes(q)) return false;
            }
            if (filterStatus === 'warning' && (row.healthStatus === 'excellent' || row.healthStatus === 'good')) return false;
            if (filterStatus === 'healthy' && (row.healthStatus === 'warning' || row.healthStatus === 'alert')) return false;
            return true;
        }).sort((a, b) => {
            // Prioritize closed audits first
            if (a.isClosedAudit !== b.isClosedAudit) return a.isClosedAudit ? -1 : 1;
            const aThroughput = a.productionQty + a.deliveryQty;
            const bThroughput = b.productionQty + b.deliveryQty;
            return bThroughput - aThroughput;
        });
    }, [reconciliationMatrix, dateMode, searchQuery, filterStatus]);

    // Active Selected SKU Details (Auto fallback to first audited item if current has no audit)
    const activeSummary = useMemo(() => {
        const found = reconciliationMatrix.find(m => m.sku === selectedSku);
        if (dateMode === 'CLOSED_AUDIT' && (!found || !found.hasAnyAudit)) {
            return filteredSummaries[0] || found || null;
        }
        return found || filteredSummaries[0] || null;
    }, [reconciliationMatrix, filteredSummaries, selectedSku, dateMode]);

    // Export CSV
    const handleExportCSV = () => {
        if (!filteredSummaries.length) return;
        const headers = [
            'SKU', '品名 (Name)', '类型 (Type)', '仓位 (Location)', '核算模式 (Mode)', '核算天数 (Days)',
            '期初基准 (Base Stock)', '期间生产 (+Production)', '日均生产 (Avg Prod/Day)', '期间发货 (-Delivery)', '日均发货 (Avg Deliv/Day)',
            '理论库存 (Expected)', '实际实盘 (Actual)', '差异偏差 (Variance)', 
            '生产吻合率 (Prod Accuracy %)', '总吞吐吻合率 (Throughput Accuracy %)', '健康状态 (Status)'
        ];

        const rows = filteredSummaries.map(r => [
            r.sku,
            `"${r.name}"`,
            r.type,
            r.locId,
            r.isClosedAudit ? '闭环实盘审计' : '动态推演',
            `${r.durationDays} 天`,
            formatQty(r.startAuditStock),
            formatQty(r.productionQty),
            formatQty(r.dailyAvgProd),
            formatQty(r.deliveryQty),
            formatQty(r.dailyAvgDeliv),
            formatQty(r.expectedStock),
            formatQty(r.currentActualStock),
            formatSignedQty(r.variance),
            r.isClosedAudit ? r.productionAccuracy.toFixed(2) + '%' : '动态推演中',
            r.isClosedAudit ? r.throughputAccuracy.toFixed(2) + '%' : '动态推演中',
            r.healthStatus
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Stock_Reconciliation_${selectedLoc}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in text-slate-900 dark:text-gray-100">
            {/* TOP HEADER CONTROLS */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                    {onBackToMatrix && (
                        <button
                            type="button"
                            onClick={onBackToMatrix}
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 rounded-xl text-slate-700 dark:text-gray-300 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-white/10 shadow-sm"
                            title="返回多仓实时矩阵"
                        >
                            <ArrowLeft size={16} />
                            <span>返回多仓矩阵</span>
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="p-2 rounded-2xl bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30">
                                <Scale size={20} />
                            </span>
                            <h2 className="text-lg font-black tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
                                产销存平衡与盘点吻合率稽核
                                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                                    Reconciliation v2.5
                                </span>
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                            严格核对实物物理盘点底数、机台生产进账与出库销账，呈现最真实的账实闭环
                        </p>
                    </div>
                </div>

                {/* Warehouse Location Selector, Guide & Refresh */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Visual Guide Button */}
                    <button
                        type="button"
                        onClick={() => setShowGuideModal(true)}
                        className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-600/20 dark:hover:bg-purple-600/30 text-purple-700 dark:text-purple-300 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-purple-200 dark:border-purple-500/40 shadow-sm"
                    >
                        <BookOpen size={14} className="text-purple-600 dark:text-purple-300" />
                        <span>💡 看板新手指南</span>
                    </button>

                    <div className="flex items-center bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-1 text-xs shadow-sm">
                        <Building2 size={14} className="text-slate-500 dark:text-gray-400 ml-2 mr-1" />
                        <select
                            value={selectedLoc}
                            onChange={(e) => setSelectedLoc(e.target.value)}
                            className="bg-transparent text-slate-900 dark:text-white font-bold py-1.5 px-2 focus:outline-none cursor-pointer text-xs"
                        >
                            {warehouseList.map(loc => (
                                <option key={loc} value={loc} className="bg-white dark:bg-gray-900 text-slate-900 dark:text-white">
                                    {loc === 'ALL' ? '🏢 全部仓位 (All Warehouses)' : `🏢 ${loc}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={fetchAllData}
                        disabled={loading}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-slate-200 dark:border-white/10 shadow-sm"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-600 dark:text-cyan-400' : ''} />
                        <span>{loading ? '计算中...' : '刷新数据'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                    >
                        <FileSpreadsheet size={14} />
                        <span>导出稽核月报</span>
                    </button>
                </div>
            </div>

            {/* DATE INTERVAL SMART SWITCHER (Mode 1 Default) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-600 dark:text-gray-400 flex items-center gap-1 mr-1">
                        <Calendar size={14} className="text-purple-600 dark:text-purple-400" /> 核算周期:
                    </span>

                    {[
                        { 
                            key: 'CLOSED_AUDIT', 
                            label: '🏆 历史盘点闭环审计 (推荐)', 
                            desc: '仅展示做过真实盘点的品类', 
                            tip: '严格对比两次实地盘点，核算此期间机台生产、出货与实物的吻合准确率'
                        },
                        { 
                            key: 'AUDIT_TO_NOW', 
                            label: '⚡ 最新盘点至今动态结存', 
                            desc: '盘点后最新流水监控', 
                            tip: '从最近一次实盘底数出发，推演至今天生产了多少、发了多少、实时应剩多少'
                        },
                        { key: 'THIS_MONTH', label: `📅 本月至今 (${currentMonthLabel})`, desc: '当月产销流水', tip: '从本月 1 号至今的累计进出' },
                        { key: 'LAST_7D', label: '⏱️ 近 7 天', desc: '最近7日流水', tip: '近 7 天内的生产与发货汇总' },
                        { key: 'LAST_30D', label: '📦 近 30 天', desc: '最近30日全貌', tip: '近 30 天内的总产出与出库' },
                        { key: 'CUSTOM', label: '⚙️ 自定义日期', desc: '自定义起止日期', tip: '自由指定任意起始与截止日期' }
                    ].map(tab => (
                        <HoverExplainer
                            key={tab.key}
                            title={tab.label}
                            description={tab.tip}
                            highlight={tab.desc}
                            position="bottom"
                        >
                            <button
                                type="button"
                                onClick={() => setDateMode(tab.key as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border ${
                                    dateMode === tab.key
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-black'
                                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10'
                                }`}
                            >
                                {tab.label}
                            </button>
                        </HoverExplainer>
                    ))}
                </div>

                {/* Right Side: Historical Audit Events Dropdown & Active Window Badge */}
                <div className="flex items-center gap-2 flex-wrap">
                    {dateMode === 'CLOSED_AUDIT' && activeSkuAudits.length > 0 && (
                        <div className="flex items-center bg-white dark:bg-black/60 border border-purple-200 dark:border-purple-500/40 rounded-xl px-2 py-1 text-xs shadow-sm">
                            <History size={13} className="text-purple-600 dark:text-purple-400 mr-1.5" />
                            <span className="text-slate-600 dark:text-gray-400 font-bold mr-1">盘点档期:</span>
                            <select
                                value={selectedAuditTxnId}
                                onChange={(e) => setSelectedAuditTxnId(e.target.value)}
                                className="bg-transparent text-purple-700 dark:text-purple-200 font-mono font-bold focus:outline-none cursor-pointer text-xs"
                            >
                                <option value="LATEST" className="bg-white dark:bg-gray-900 text-slate-900 dark:text-white">
                                    [最新期] {activeSkuAudits[0]?.timestamp.slice(0, 10)} (实盘: {parseAuditActual(activeSkuAudits[0])} {activeSummary?.uom})
                                </option>
                                {activeSkuAudits.slice(1).map((a) => (
                                    <option key={a.txn_id} value={a.txn_id} className="bg-white dark:bg-gray-900 text-slate-900 dark:text-white">
                                        [历史] {a.timestamp.slice(0, 10)} (实盘: {parseAuditActual(a)} {activeSummary?.uom})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {dateMode === 'CUSTOM' && (
                        <div className="flex items-center gap-2 text-xs">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="bg-white dark:bg-black/60 border border-slate-300 dark:border-white/20 rounded-xl px-2.5 py-1 text-slate-900 dark:text-white text-xs focus:outline-none shadow-sm"
                            />
                            <span className="text-slate-400">~</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="bg-white dark:bg-black/60 border border-slate-300 dark:border-white/20 rounded-xl px-2.5 py-1 text-slate-900 dark:text-white text-xs focus:outline-none shadow-sm"
                            />
                        </div>
                    )}

                    {activeSummary && (
                        <HoverExplainer
                            title="当前评估核算时间窗"
                            description={`系统当前正在审计从 ${activeSummary.auditStartDate.slice(0, 10)} 至 ${activeSummary.auditEndDate.slice(0, 10)} 这 ${activeSummary.durationDays} 天内的全部生产与发货流水。`}
                            position="bottom"
                        >
                            <div className="text-[11px] font-mono text-cyan-800 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-200 dark:border-cyan-500/20 flex items-center gap-2 shadow-sm">
                                <span>区间: {activeSummary.auditStartDate.slice(0, 10)} ~ {activeSummary.auditEndDate.slice(0, 10)}</span>
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300 font-bold rounded-lg border border-purple-200 dark:border-purple-500/40 text-[10px]">
                                    🗓️ 共 {activeSummary.durationDays} 天
                                </span>
                            </div>
                        </HoverExplainer>
                    )}
                </div>
            </div>

            {/* ANOMALY ALERT BANNER IF DETECTED */}
            {anomalies.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-900 dark:text-amber-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            <ShieldAlert size={20} />
                        </div>
                        <div>
                            <div className="text-xs font-bold flex items-center gap-1.5">
                                <span>智能体检发现 {anomalies.length} 笔测试单/模拟扣减记录</span>
                                <span className="px-2 py-0.5 bg-amber-200/80 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded text-[10px] font-mono font-black">
                                    Auto Detected
                                </span>
                            </div>
                            <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                                包含如 {anomalies.slice(0, 3).map(a => a.ref_doc).join(', ')} 等测试模拟单，已在本次计算中隔离或可一键清理
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* LOADING SKELETON */}
            {loading && warehouseSummaries.length === 0 ? (
                <div className="space-y-6 animate-pulse">
                    <div className="bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-3xl p-6 h-36" />
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className="bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 h-28" />
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-2xl p-6 h-32" />
                        ))}
                    </div>
                    <div className="bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-3xl p-6 h-64" />
                </div>
            ) : null}

            {/* ACTIVE SKU DEEP DIVE PANEL */}
            {activeSummary && (
                <div className="bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/15 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-50 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/40 rounded-2xl text-purple-600 dark:text-purple-300">
                                <Package size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-lg font-black text-slate-900 dark:text-white">{activeSummary.name}</span>
                                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-cyan-300 border border-slate-200 dark:border-white/10 font-bold">
                                        {activeSummary.sku}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                        {activeSummary.type}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                                        📍 仓位: <strong className="text-slate-900 dark:text-white">{activeSummary.locId}</strong>
                                    </span>
                                    {activeSummary.isClosedAudit ? (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                            🏆 闭环实盘审计
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                                            ⚡ 动态盘点推演
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                                    <span className="text-slate-500 dark:text-gray-400">
                                        基准核算区间：{activeSummary.auditStartDate.slice(0, 10)}（基准实盘: {formatQty(activeSummary.startAuditStock)} {activeSummary.uom}） ~ {activeSummary.auditEndDate.slice(0, 10)}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-500/30 font-mono text-[11px]">
                                        🗓️ 核算周期：{activeSummary.durationDays} 天
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30 font-mono text-[11px]">
                                        ⚡ 日均生产：~{formatQty(activeSummary.dailyAvgProd)} {activeSummary.uom}/天
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-500/30 font-mono text-[11px]">
                                        🚚 日均发货：~{formatQty(activeSummary.dailyAvgDeliv)} {activeSummary.uom}/天
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* SKU Fast Switcher */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-gray-400 font-bold">切换重点物料:</span>
                            <select
                                value={activeSummary.sku}
                                onChange={(e) => {
                                    setSelectedSku(e.target.value);
                                    setSelectedAuditTxnId('LATEST');
                                }}
                                className="bg-slate-50 dark:bg-black/60 border border-slate-300 dark:border-cyan-500/40 text-slate-900 dark:text-white font-bold text-xs py-2 px-3 rounded-xl focus:outline-none cursor-pointer shadow-sm max-w-[260px] truncate"
                            >
                                {filteredSummaries.map(item => (
                                    <option key={item.sku} value={item.sku} className="bg-white dark:bg-gray-900 text-slate-900 dark:text-white">
                                        {item.name} ({item.sku})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* FOUR PILLARS BALANCE FLOW CARDS WITH INTERACTIVE HOVER EXPLAINERS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
                        {/* 1. Base Stock */}
                        <HoverExplainer
                            title="① 上期实盘基准 (期初底数)"
                            description={`上一次现场物理盘点数出来的底数基准（相当于银行账户的期初本金）。${activeSummary.auditStartDate.slice(5, 10)} 现场清点实盘为 ${formatQty(activeSummary.startAuditStock)} ${activeSummary.uom}。`}
                            highlight="作为本次核算区间的推演起点"
                        >
                            <div className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 hover:border-purple-400/50 transition rounded-2xl p-3.5 flex flex-col justify-between h-full shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center justify-between">
                                    <span>① 上期实盘基准</span>
                                    <Info size={11} className="text-slate-400 dark:text-gray-500" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{formatQty(activeSummary.startAuditStock)}</span>
                                    <span className="text-[10px] text-slate-500 dark:text-gray-400 ml-1">{activeSummary.uom}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">
                                    {activeSummary.auditStartDate.slice(5, 10)} 盘点基准
                                </div>
                            </div>
                        </HoverExplainer>

                        {/* 2. Production Inflow */}
                        <HoverExplainer
                            title="② 期间生产入库 (机台实际产出)"
                            description={`该核算周期（${activeSummary.durationDays}天）内，机台工人实际登记做出来的物料总数（相当于进账）。期间累计产出 +${formatQty(activeSummary.productionQty)} ${activeSummary.uom}。`}
                            formula={`日均生产产出：~${formatQty(activeSummary.dailyAvgProd)} ${activeSummary.uom}/天`}
                            highlight="真实反映工厂机台在此区间的生产速度"
                        >
                            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400/60 transition rounded-2xl p-3.5 flex flex-col justify-between h-full shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                                    <span className="flex items-center gap-1 shrink-0"><TrendingUp size={12} /> ② 期间生产入库</span>
                                    <Info size={11} className="text-emerald-500" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">+{formatQty(activeSummary.productionQty)}</span>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80 ml-1">{activeSummary.uom}</span>
                                </div>
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400/80 font-mono flex items-center justify-between">
                                    <span>机台实际产出</span>
                                    <span className="font-bold">~{formatQty(activeSummary.dailyAvgProd)}/天</span>
                                </div>
                            </div>
                        </HoverExplainer>

                        {/* 3. Delivery Outflow */}
                        <HoverExplainer
                            title="③ 期间发货出库 (司机装车出库)"
                            description={`该核算周期（${activeSummary.durationDays}天）内，司机装车配送完成、从仓库实地拉走扣账的总量（相当于出账消费）。期间累计出货 -${formatQty(activeSummary.deliveryQty)} ${activeSummary.uom}。`}
                            formula={`日均发货出库：~${formatQty(activeSummary.dailyAvgDeliv)} ${activeSummary.uom}/天`}
                            highlight="真实反映客户拉货与物流流转速度"
                        >
                            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 hover:border-blue-400/60 transition rounded-2xl p-3.5 flex flex-col justify-between h-full shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center justify-between">
                                    <span className="flex items-center gap-1 shrink-0"><TrendingDown size={12} /> ③ 期间发货出库</span>
                                    <Info size={11} className="text-blue-500" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">-{formatQty(activeSummary.deliveryQty)}</span>
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400/80 ml-1">{activeSummary.uom}</span>
                                </div>
                                <div className="text-[10px] text-blue-600 dark:text-blue-400/80 font-mono flex items-center justify-between">
                                    <span>司机装车出库</span>
                                    <span className="font-bold">~{formatQty(activeSummary.dailyAvgDeliv)}/天</span>
                                </div>
                            </div>
                        </HoverExplainer>

                        {/* 4. Net Transfer */}
                        <HoverExplainer
                            title="④ 移库调拨净流入 (跨仓流动)"
                            description="核算期间内从其他工厂/仓库（如 Nilai、SPD、Taiping）调入本仓，减去从本仓调出到其他仓的净轧差额。"
                            formula="净调拨 = 调入总量 - 调出总量"
                            highlight="确保跨工厂移库时总账不漏不重"
                        >
                            <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 hover:border-purple-400/60 transition rounded-2xl p-3.5 flex flex-col justify-between h-full shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center justify-between">
                                    <span>④ 移库调拨净流入</span>
                                    <Info size={11} className="text-purple-500" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono">
                                        {formatSignedQty(activeSummary.transferInQty - activeSummary.transferOutQty)}
                                    </span>
                                    <span className="text-[10px] text-purple-600 dark:text-purple-400/80 ml-1">{activeSummary.uom}</span>
                                </div>
                                <div className="text-[10px] text-purple-600 dark:text-purple-400/70 font-mono">
                                    内部仓位调入调出
                                </div>
                            </div>
                        </HoverExplainer>

                        {/* 5. Expected Stock */}
                        <HoverExplainer
                            title="⑤ 理论系统应有 (电脑公式计算值)"
                            description="电脑根据数学公式推演，仓库在盘点日理应剩余的理论库存。"
                            formula={`公式: ①(${formatQty(activeSummary.startAuditStock)}) + ②(+${formatQty(activeSummary.productionQty)}) - ③(${formatQty(activeSummary.deliveryQty)}) + ④(${formatSignedQty(activeSummary.transferInQty - activeSummary.transferOutQty)}) = ${formatQty(activeSummary.expectedStock)} ${activeSummary.uom}`}
                            highlight="若出现负数通常因司机提前扣单或机台录入轻微滞后"
                        >
                            <div className="bg-slate-50 dark:bg-black/50 border border-cyan-200 dark:border-cyan-500/30 hover:border-cyan-400/60 transition rounded-2xl p-3.5 flex flex-col justify-between h-full shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center justify-between">
                                    <span>⑤ 理论系统应有</span>
                                    <Info size={11} className="text-cyan-500" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black text-cyan-700 dark:text-cyan-300 font-mono">{formatQty(activeSummary.expectedStock)}</span>
                                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400/80 ml-1">{activeSummary.uom}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">
                                    ① + ② - ③ + ④
                                </div>
                            </div>
                        </HoverExplainer>

                        {/* 6. Physical Actual Stock */}
                        <HoverExplainer
                            title="⑥ 本期实盘库存 (现场实地清点)"
                            description={`在盘点截止日（${activeSummary.auditEndDate.slice(5, 10)}），工人在仓库现场实地清点数出的物理真实现存量。现场数出 ${formatQty(activeSummary.currentActualStock)} ${activeSummary.uom}。`}
                            highlight="作为期末真实考核的最终依据"
                        >
                            <div className="bg-slate-50 dark:bg-black/50 border border-amber-200 dark:border-amber-500/30 hover:border-amber-400/60 transition rounded-2xl p-3.5 flex flex-col justify-between h-full shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-between">
                                    <span>⑥ 本期实盘库存</span>
                                    <Info size={11} className="text-amber-500" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">{formatQty(activeSummary.currentActualStock)}</span>
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400/80 ml-1">{activeSummary.uom}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">
                                    本期现场实盘复核
                                </div>
                            </div>
                        </HoverExplainer>

                        {/* 7. Discrepancy Variance */}
                        <HoverExplainer
                            title="⑦ 盘点账实差异 (现场实盘 vs 理论应有)"
                            description="实际数到的物料 与 电脑理论推算值 之间的偏离差额。"
                            formula={`公式: ⑥(${formatQty(activeSummary.currentActualStock)}) - ⑤(${formatQty(activeSummary.expectedStock)}) = ${formatSignedQty(activeSummary.variance)} ${activeSummary.uom}`}
                            highlight={`现场与理论相差 ${formatQty(activeSummary.absVariance)} ${activeSummary.uom}`}
                        >
                            <div className={`rounded-2xl p-3.5 flex flex-col justify-between h-full border transition shadow-sm ${
                                activeSummary.absVariance === 0
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
                                    : activeSummary.absVariance <= 90
                                        ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 hover:border-purple-400/60 text-purple-700 dark:text-purple-300'
                                        : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 hover:border-red-400/60 text-red-700 dark:text-red-300'
                            }`}>
                                <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
                                    <span>⑦ 盘点账实差异</span>
                                    <Info size={11} className="opacity-60" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black font-mono">
                                        {formatSignedQty(activeSummary.variance)}
                                    </span>
                                    <span className="text-[10px] ml-1">{activeSummary.uom}</span>
                                </div>
                                <div className="text-[10px] font-mono opacity-80">
                                    ⑥ 实盘 - ⑤ 理论
                                </div>
                            </div>
                        </HoverExplainer>
                    </div>

                    {/* THREE KEY METRICS KPI STRIP WITH INTERACTIVE HOVER EXPLAINERS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-200 dark:border-white/10">
                        {/* KPI 1: Production Output Accuracy */}
                        <HoverExplainer
                            title="🏆 生产吻合准确率 (Production Accuracy)"
                            description="评估机台工人生产报工的真实度与可信度。用总偏差绝对值与总产出量对比，衡量机台登记是否有漏记、多记或瞒报。"
                            formula={`公式: (1 - |差异 ${formatQty(activeSummary.absVariance)}| / 生产总量 ${formatQty(activeSummary.productionQty)}) × 100% = ${activeSummary.productionAccuracy.toFixed(2)}%`}
                            highlight="≥ 95% 为极佳吻合，说明机台报产数据高度真实可靠！"
                        >
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-purple-400/40 transition rounded-2xl p-4 flex items-center justify-between h-full shadow-sm">
                                <div>
                                    <div className="text-xs font-bold text-slate-600 dark:text-gray-400 flex items-center gap-1">
                                        <span>🏆 生产吻合准确率 (Production Accuracy)</span>
                                        <Info size={12} className="text-slate-400 dark:text-gray-500" />
                                    </div>
                                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono mt-1 flex items-baseline gap-2">
                                        <span>{activeSummary.productionAccuracy.toFixed(2)}%</span>
                                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                            activeSummary.productionAccuracy >= 95 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                        }`}>
                                            {activeSummary.productionAccuracy >= 95 ? '极佳吻合' : '正常波动'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-mono">
                                        生产 {formatQty(activeSummary.productionQty)} {activeSummary.uom} · 差异偏差 {formatQty(activeSummary.absVariance)} {activeSummary.uom}
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30">
                                    <CheckCircle2 size={24} />
                                </div>
                            </div>
                        </HoverExplainer>

                        {/* KPI 2: Inventory Throughput Accuracy */}
                        <HoverExplainer
                            title="📦 仓储流转总账吻合率 (Throughput Accuracy)"
                            description="衡量工厂在生产进货、司机出货的大吞吐量流转下，整厂物料总账闭环的能力。"
                            formula={`公式: (1 - |差异 ${formatQty(activeSummary.absVariance)}| / (生产 ${formatQty(activeSummary.productionQty)} + 发货 ${formatQty(activeSummary.deliveryQty)})) × 100% = ${activeSummary.throughputAccuracy.toFixed(2)}%`}
                            highlight="进出吞吐量越大，更能体现仓储进销存账目的严密性"
                        >
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-cyan-400/40 transition rounded-2xl p-4 flex items-center justify-between h-full shadow-sm">
                                <div>
                                    <div className="text-xs font-bold text-slate-600 dark:text-gray-400 flex items-center gap-1">
                                        <span>📦 仓储流转总账吻合率 (Throughput Accuracy)</span>
                                        <Info size={12} className="text-slate-400 dark:text-gray-500" />
                                    </div>
                                    <div className="text-3xl font-black text-cyan-700 dark:text-cyan-300 font-mono mt-1 flex items-baseline gap-2">
                                        <span>{activeSummary.throughputAccuracy.toFixed(2)}%</span>
                                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 uppercase">
                                            流转闭环
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-mono">
                                        总吞吐流转: {formatQty(activeSummary.productionQty + activeSummary.deliveryQty)} {activeSummary.uom}
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 shrink-0">
                                    <Layers size={24} />
                                </div>
                            </div>
                        </HoverExplainer>

                        {/* KPI 3: Variance Ratio / Status */}
                        <HoverExplainer
                            title="⚠️ 差异偏离率 (Variance Rate)"
                            description="整厂流转总吞吐中的自然偏离或损耗比例。等于 100% 减去流转吻合率。"
                            formula={`偏离率: 100% - ${activeSummary.throughputAccuracy.toFixed(2)}% = ${(100 - activeSummary.throughputAccuracy).toFixed(2)}%`}
                            highlight="低偏离率证明工厂进出货损耗和记账误差被严格锁定在极小范围"
                        >
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-purple-400/40 transition rounded-2xl p-4 flex items-center justify-between h-full shadow-sm">
                                <div>
                                    <div className="text-xs font-bold text-slate-600 dark:text-gray-400 flex items-center gap-1">
                                        <span>⚠️ 差异偏离率 (Variance Rate)</span>
                                        <Info size={12} className="text-slate-400 dark:text-gray-500" />
                                    </div>
                                    <div className="text-3xl font-black text-purple-700 dark:text-purple-300 font-mono mt-1 flex items-baseline gap-2">
                                        <span>{(100 - activeSummary.throughputAccuracy).toFixed(2)}%</span>
                                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 uppercase">
                                            自然轻微溢出
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-mono">
                                        差异绝对值: {formatQty(activeSummary.absVariance)} {activeSummary.uom} · 跨度 {activeSummary.durationDays} 天
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 shrink-0">
                                    <Scale size={24} />
                                </div>
                            </div>
                        </HoverExplainer>
                    </div>

                    {/* DAILY INFLOW VS OUTFLOW TREND CHART */}
                    {(Object.keys(activeSummary.dailyBreakdown).length > 0 || skuDrilldownLoading) && (
                        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <BarChart3 size={15} className="text-cyan-600 dark:text-cyan-400" />
                                    <span>每日生产入库 vs 发货装车对比走势</span>
                                    {skuDrilldownLoading && (
                                        <RefreshCw size={12} className="animate-spin text-purple-600 dark:text-purple-400 ml-1.5" />
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] font-mono">
                                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                                        <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span> 生产 (+Inflow)
                                    </span>
                                    <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-bold">
                                        <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block"></span> 发货 (-Outflow)
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                                {Object.entries(activeSummary.dailyBreakdown).sort().map(([dateStr, d]) => (
                                    <HoverExplainer
                                        key={dateStr}
                                        title={`${dateStr} 产销日报`}
                                        description={`当日机台生产入库 +${formatQty(d.prod)} ${activeSummary.uom}，司机发货出库 -${formatQty(d.deliv)} ${activeSummary.uom}。`}
                                        formula={`当日净变动: ${formatSignedQty(d.prod - d.deliv)} ${activeSummary.uom}`}
                                    >
                                        <div className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 hover:border-purple-400/40 transition rounded-xl p-2.5 flex flex-col items-center justify-between text-center h-full shadow-sm">
                                            <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400">{dateStr.slice(5)}</span>
                                            <div className="my-1.5 flex flex-col gap-0.5 items-center">
                                                <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400">+{formatQty(d.prod)}</span>
                                                <span className="text-xs font-black font-mono text-blue-700 dark:text-blue-400">-{formatQty(d.deliv)}</span>
                                            </div>
                                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                                d.prod >= d.deliv ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                            }`}>
                                                {formatSignedQty(d.prod - d.deliv)}
                                            </span>
                                        </div>
                                    </HoverExplainer>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ALL SKUS OVERVIEW & HEALTH LEADERBOARD TABLE */}
            <div className="bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                            <Layers size={16} className="text-cyan-600 dark:text-cyan-400" />
                            <span>实盘对账与物料健康度排行榜 ({selectedLoc === 'ALL' ? '全部仓位' : selectedLoc}) · 共 {filteredSummaries.length} 个品类</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            综合考核两次实物盘点之间的机台真实报产率与仓储闭环率
                        </p>
                    </div>

                    {/* Filter & Search */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400 dark:text-gray-500" />
                            <input
                                type="text"
                                placeholder="搜索品名 / SKU..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 shadow-sm"
                            />
                        </div>

                        <div className="flex items-center bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl p-0.5 text-xs shadow-sm">
                            <button
                                type="button"
                                onClick={() => setFilterStatus('all')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${filterStatus === 'all' ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-sm font-black' : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                全部 ({reconciliationMatrix.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('closed')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${filterStatus === 'closed' ? 'bg-purple-600 text-white shadow-sm font-black' : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                🏆 闭环实盘
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('healthy')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${filterStatus === 'healthy' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                🟢 极佳吻合
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('warning')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${filterStatus === 'warning' ? 'bg-amber-600 text-white shadow-sm font-black' : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                ⚠️ 偏差预警
                            </button>
                        </div>
                    </div>
                </div>

                {/* Leaderboard Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-black/60 text-slate-700 dark:text-gray-300 font-bold border-b border-slate-200 dark:border-white/10 text-[11px] uppercase tracking-wider">
                                <th className="py-3 px-4">物料 / 品名</th>
                                <th className="py-3 px-3 text-center">类型</th>
                                <th className="py-3 px-3 text-right">① 上期实盘</th>
                                <th className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400">② 期间生产</th>
                                <th className="py-3 px-3 text-right text-blue-700 dark:text-blue-400">③ 期间发货</th>
                                <th className="py-3 px-3 text-right text-cyan-700 dark:text-cyan-400">⑤ 理论应有</th>
                                <th className="py-3 px-3 text-right text-amber-700 dark:text-amber-400">⑥ 现场实盘</th>
                                <th className="py-3 px-3 text-right">⑦ 盘点盈亏差异</th>
                                <th className="py-3 px-4 text-center">状态 / 吻合率</th>
                                <th className="py-3 px-3 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredSummaries.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-gray-500 text-xs font-medium">
                                        <Scale size={32} className="mx-auto mb-2 opacity-30" />
                                        暂无符合条件的盘点对账数据，可尝试切换核算周期或切换仓位
                                    </td>
                                </tr>
                            ) : (
                                filteredSummaries.map((item) => {
                                    const isSelected = item.sku === activeSummary?.sku;
                                    return (
                                        <tr
                                            key={item.sku}
                                            onClick={() => {
                                                setSelectedSku(item.sku);
                                                setSelectedAuditTxnId('LATEST');
                                            }}
                                            className={`transition cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-purple-50 dark:bg-purple-600/20 hover:bg-purple-100/60 dark:hover:bg-purple-600/30' 
                                                    : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                    <span>{item.name}</span>
                                                    {isSelected && (
                                                        <span className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[9px] font-mono font-bold">
                                                            当前聚焦
                                                        </span>
                                                    )}
                                                    {item.isClosedAudit && (
                                                        <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded text-[9px] font-bold">
                                                            闭环
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                                                    <span>{item.sku}</span>
                                                    <span className="px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-500/30 text-[9px]">
                                                        🗓️ {item.durationDays}天
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300">
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-gray-300">
                                                {formatQty(item.startAuditStock)} {item.uom}
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono">
                                                <div className="font-bold text-emerald-700 dark:text-emerald-400">+{formatQty(item.productionQty)}</div>
                                                <div className="text-[9px] text-emerald-600 dark:text-emerald-400/70">~{formatQty(item.dailyAvgProd)}/天</div>
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono">
                                                <div className="font-bold text-blue-700 dark:text-blue-400">-{formatQty(item.deliveryQty)}</div>
                                                <div className="text-[9px] text-blue-600 dark:text-blue-400/70">~{formatQty(item.dailyAvgDeliv)}/天</div>
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono font-bold text-cyan-700 dark:text-cyan-300">
                                                {formatQty(item.expectedStock)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono font-black text-amber-700 dark:text-amber-300">
                                                {formatQty(item.currentActualStock)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono font-bold">
                                                <span className={item.variance === 0 ? 'text-slate-500 dark:text-gray-400' : item.variance > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                                    {formatSignedQty(item.variance)}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {item.isClosedAudit ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-black border bg-slate-50 dark:bg-black/40 shadow-sm">
                                                        <span className={`w-2 h-2 rounded-full ${
                                                            item.healthStatus === 'excellent' ? 'bg-emerald-500' :
                                                            item.healthStatus === 'good' ? 'bg-cyan-500' :
                                                            item.healthStatus === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                                                        }`}></span>
                                                        <span className={
                                                            item.healthStatus === 'excellent' ? 'text-emerald-700 dark:text-emerald-300' :
                                                            item.healthStatus === 'good' ? 'text-cyan-700 dark:text-cyan-300' :
                                                            item.healthStatus === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-red-600 dark:text-red-300'
                                                        }>
                                                            {item.productionAccuracy.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-400">
                                                        动态推演
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSku(item.sku);
                                                        setSelectedAuditTxnId('LATEST');
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/20 dark:hover:bg-purple-500/40 text-purple-700 dark:text-purple-300 font-bold rounded-lg border border-purple-200 dark:border-purple-500/30 transition active:scale-95 text-[10px] cursor-pointer shadow-sm"
                                                >
                                                    聚焦推演
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* VISUAL GUIDE POPUP MODAL */}
            {showGuideModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-[#121215] border border-slate-300 dark:border-purple-500/40 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800 dark:text-gray-200">
                        <button
                            type="button"
                            onClick={() => setShowGuideModal(false)}
                            className="absolute right-5 top-5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-gray-300 transition cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
                            <span className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30">
                                <BookOpen size={22} />
                            </span>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">产销存平衡看板 · 极简通俗指南</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-400">像看银行流水账单一样，轻松读懂工厂实盘对账</p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-4 text-xs leading-relaxed">
                            <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-purple-900 dark:text-purple-200">
                                <strong className="text-purple-950 dark:text-white block mb-1">🎯 这张大屏帮您解决什么？</strong>
                                帮助老板与管理层核算：<strong>“从上一次盘点到这一次盘点期间，机台报的产量、司机拉走的货，和仓库现场数出来的实物到底能不能对得上？”</strong>
                            </div>

                            <div className="space-y-2.5">
                                <h4 className="font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                                    <span>🔢 七步平衡流转链条（步步相扣）：</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <strong className="text-slate-900 dark:text-white">① 上期实盘基准</strong>
                                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">上一次现场盘点数出来的底数（期初本金）。</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <strong className="text-emerald-700 dark:text-emerald-400">② 期间生产入库</strong>
                                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">机台工人实际登记做出来的总产量（进账）。</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <strong className="text-blue-700 dark:text-blue-400">③ 期间发货出库</strong>
                                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">司机装车配送完成、扣账拉走的总量（出账）。</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <strong className="text-purple-700 dark:text-purple-400">④ 移库调拨净流入</strong>
                                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">从其他工厂（如 Nilai/SPD）转入转出的净货。</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 sm:col-span-2">
                                        <strong className="text-cyan-700 dark:text-cyan-400">⑤ 理论系统应有 = ① + ② - ③ + ④</strong>
                                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">电脑按纯数学公式推算的仓库理论应剩库存。</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <strong className="text-amber-700 dark:text-amber-400">⑥ 本期现场实盘</strong>
                                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">工人拿盘点单在现场实地清点数出的实物。</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <strong className="text-purple-700 dark:text-purple-300">⑦ 盘点账实差异 = ⑥ - ⑤</strong>
                                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">现场实物与电脑理论值的差额（正数代表现场多出）。</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                                <h4 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                    <span>🏆 三大核心成绩单指标：</span>
                                </h4>
                                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 dark:text-gray-300">
                                    <li><strong className="text-slate-900 dark:text-white">生产吻合准确率（≥95% 为极佳）</strong>：证明机台生产报工真实可信，无严重瞒报漏记。</li>
                                    <li><strong className="text-slate-900 dark:text-white">仓储流转总账吻合率（接近 99%）</strong>：证明进出大吞吐量下，整厂物料闭环受控。</li>
                                    <li><strong className="text-slate-900 dark:text-white">差异偏离率（&lt; 2%）</strong>：证明自然损耗或记账公差被严格锁定在极小范围内。</li>
                                </ul>
                            </div>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowGuideModal(false)}
                                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
                                >
                                    我知道了，开始使用
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
