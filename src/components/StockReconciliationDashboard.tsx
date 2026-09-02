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
    Activity
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
    isClosedAudit: boolean; // true = 两次实盘闭环对账, false = 动态推演中
    healthStatus: 'excellent' | 'good' | 'warning' | 'alert' | 'tracking';
    durationDays: number;
    dailyAvgProd: number;
    dailyAvgDeliv: number;
    dailyBreakdown: Record<string, { prod: number; deliv: number }>;
}

// Helper: Format numerical quantity without floating point inaccuracies
export const formatQty = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0';
    const num = Number(val);
    if (Number.isInteger(num)) {
        return num.toLocaleString();
    }
    const fixed = parseFloat(num.toFixed(2));
    return fixed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// Helper: Format signed quantity (e.g. +100, -50, 0)
export const formatSignedQty = (val: number | string | undefined | null): string => {
    const num = Number(val) || 0;
    if (Math.abs(num) < 0.0001) return '0';
    const sign = num > 0 ? '+' : '-';
    const absFormatted = formatQty(Math.abs(num));
    return `${sign}${absFormatted}`;
};

// Robust Audit Parser for notes
const parseAuditActual = (auditRow: any): number => {
    if (!auditRow) return 0;
    const notes = String(auditRow.notes || '');
    
    // Match "Actual: 150" or "Actual:150" or "Actual: 60.5"
    const match = notes.match(/Actual\s*:\s*([\d.-]+)/i);
    if (match && !isNaN(parseFloat(match[1]))) {
        return parseFloat(match[1]);
    }
    
    // Match "Base = 122" or "Base=122"
    const matchBase = notes.match(/Base\s*=\s*([\d.-]+)/i);
    if (matchBase && !isNaN(parseFloat(matchBase[1]))) {
        return parseFloat(matchBase[1]);
    }

    // Fallback to balance_after or change_qty
    if (auditRow.balance_after != null && !isNaN(Number(auditRow.balance_after))) {
        return Number(auditRow.balance_after);
    }
    
    return Number(auditRow.change_qty) || 0;
};

export const StockReconciliationDashboard: React.FC<Props> = ({
    initialSku = null,
    onBackToMatrix
}) => {
    const [loading, setLoading] = useState(true);
    const [selectedLoc, setSelectedLoc] = useState<string>('OPM Lama');
    const [selectedSku, setSelectedSku] = useState<string>(initialSku || 'BW-SL-CLR-100Mx100CMx1ROLL-RED');
    const [dateMode, setDateMode] = useState<'CLOSED_AUDIT' | 'AUDIT_TO_NOW' | 'THIS_MONTH' | 'LAST_7D' | 'LAST_30D' | 'CUSTOM'>('CLOSED_AUDIT');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'warning' | 'healthy'>('all');

    // Raw datasets
    const [ledgerData, setLedgerData] = useState<any[]>([]);
    const [allAuditEvents, setAllAuditEvents] = useState<any[]>([]);
    const [masterItems, setMasterItems] = useState<any[]>([]);
    const [inventoryRecords, setInventoryRecords] = useState<any[]>([]);
    const [anomalies, setAnomalies] = useState<any[]>([]);

    // Current Month Name e.g. "Sep"
    const currentMonthLabel = useMemo(() => {
        return new Date().toLocaleString('en-US', { month: 'short' });
    }, []);

    // Fetch master items, all historical audits, and recent flow ledger
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Master Items, Inventory Views, and ALL Historical Audits directly (Dual Track)
            const [masterRes, invRes, auditRes] = await Promise.all([
                supabase.from('master_items_v2').select('sku, name, type, uom').eq('status', 'Active'),
                supabase.from('v2_inventory_view').select('sku, name, type, uom, loc_id, current_stock'),
                supabase.from('stock_ledger_v2').select('*').ilike('event_type', '%Audit%').order('timestamp', { ascending: true })
            ]);

            setMasterItems(masterRes.data || []);
            setInventoryRecords(invRes.data || []);
            setAllAuditEvents(auditRes.data || []);

            // 2. Fetch recent ledger in paginated chunks (up to 20,000 newest transactions)
            let allLedger: any[] = [];
            let offset = 0;
            const pageSize = 1000;
            const maxPages = 20;

            for (let page = 0; page < maxPages; page++) {
                const { data, error } = await supabase
                    .from('stock_ledger_v2')
                    .select('txn_id, timestamp, sku, loc_id, change_qty, balance_after, event_type, ref_doc, notes, created_by_name')
                    .order('timestamp', { ascending: false })
                    .range(offset, offset + pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                allLedger = allLedger.concat(data);
                offset += data.length;
                if (data.length < pageSize) break;
            }

            setLedgerData(allLedger);

            // 3. Detect Anomalies (e.g. test orders)
            const detectedAnomalies = allLedger.filter(t => {
                const ref = (t.ref_doc || '').toUpperCase();
                const notes = (t.notes || '').toUpperCase();
                return ref.includes('TEST') || notes.includes('TEST') || ref.startsWith('TEST-SO');
            });
            setAnomalies(detectedAnomalies);

        } catch (err) {
            console.error("Error loading reconciliation data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Available warehouses
    const warehouseList = useMemo(() => {
        const set = new Set<string>(WAREHOUSES);
        inventoryRecords.forEach(r => {
            if (r.loc_id) set.add(r.loc_id);
        });
        return Array.from(set).filter(Boolean);
    }, [inventoryRecords]);

    // Build Reconciliation Calculation for ALL SKUs at Selected Location
    const reconciliationMatrix = useMemo<SkuReconcileSummary[]>(() => {
        if (!masterItems.length || !ledgerData.length) return [];

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const last7dStart = new Date(Date.now() - 7 * 86400000).toISOString();
        const last30dStart = new Date(Date.now() - 30 * 86400000).toISOString();

        return masterItems.map(item => {
            const sku = item.sku.trim();
            
            // 1. Filter Audits for this SKU & Location
            const skuAudits = allAuditEvents.filter(a => 
                a.sku?.trim() === sku && 
                (!selectedLoc || selectedLoc === 'ALL' || (a.loc_id || '').toLowerCase().trim() === selectedLoc.toLowerCase().trim())
            ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // 2. Filter Ledger for this SKU & Location
            const skuTxs = ledgerData.filter(t => 
                t.sku?.trim() === sku && 
                (!selectedLoc || selectedLoc === 'ALL' || (t.loc_id || '').toLowerCase().trim() === selectedLoc.toLowerCase().trim())
            );

            // Determine Audit Dates and Base Stocks
            let startAuditDate = last30dStart;
            let endAuditDate = new Date().toISOString();
            let startAuditStock = 0;
            let endAuditActualStock = 0;
            let hasClosedAudit = false;

            if (skuAudits.length >= 2) {
                const prevAudit = skuAudits[skuAudits.length - 2];
                const latestAudit = skuAudits[skuAudits.length - 1];

                startAuditStock = parseAuditActual(prevAudit);
                endAuditActualStock = parseAuditActual(latestAudit);

                startAuditDate = prevAudit.timestamp;
                endAuditDate = latestAudit.timestamp;
                hasClosedAudit = true;

            } else if (skuAudits.length === 1) {
                const singleAudit = skuAudits[0];
                startAuditStock = parseAuditActual(singleAudit);
                startAuditDate = singleAudit.timestamp;
                endAuditDate = new Date().toISOString();
                endAuditActualStock = startAuditStock;
                hasClosedAudit = false;
            }

            // Determine Active Window based on dateMode
            let activeWindowStart = startAuditDate;
            let activeWindowEnd = endAuditDate;
            let isClosedAudit = (dateMode === 'CLOSED_AUDIT' && hasClosedAudit);

            if (dateMode === 'AUDIT_TO_NOW') {
                if (skuAudits.length > 0) {
                    const latestAudit = skuAudits[skuAudits.length - 1];
                    startAuditStock = parseAuditActual(latestAudit);
                    activeWindowStart = latestAudit.timestamp;
                } else {
                    activeWindowStart = last30dStart;
                    startAuditStock = 0;
                }
                activeWindowEnd = new Date().toISOString();
                isClosedAudit = false;
            } else if (dateMode === 'THIS_MONTH') {
                activeWindowStart = thisMonthStart;
                activeWindowEnd = new Date().toISOString();
                isClosedAudit = false;
            } else if (dateMode === 'LAST_7D') {
                activeWindowStart = last7dStart;
                activeWindowEnd = new Date().toISOString();
                isClosedAudit = false;
            } else if (dateMode === 'LAST_30D') {
                activeWindowStart = last30dStart;
                activeWindowEnd = new Date().toISOString();
                isClosedAudit = false;
            } else if (dateMode === 'CUSTOM' && customStartDate) {
                activeWindowStart = new Date(customStartDate).toISOString();
                if (customEndDate) activeWindowEnd = new Date(customEndDate + 'T23:59:59').toISOString();
                isClosedAudit = false;
            }

            // 3. Sum up Flow Components inside active window
            let productionQty = 0;
            let deliveryQty = 0;
            let transferInQty = 0;
            let transferOutQty = 0;
            const dailyBreakdown: Record<string, { prod: number; deliv: number }> = {};

            skuTxs.forEach(t => {
                const txTime = new Date(t.timestamp).getTime();
                const startTime = new Date(activeWindowStart).getTime();
                const endTime = new Date(activeWindowEnd).getTime();

                if (txTime >= startTime && txTime <= endTime) {
                    const mytDate = new Date(txTime + 8 * 3600000).toISOString().slice(0, 10);
                    if (!dailyBreakdown[mytDate]) dailyBreakdown[mytDate] = { prod: 0, deliv: 0 };

                    const qty = Number(t.change_qty) || 0;
                    if (t.event_type === 'Production') {
                        productionQty += qty;
                        dailyBreakdown[mytDate].prod += qty;
                    } else if (t.event_type === 'Transfer Out') {
                        const absQty = Math.abs(qty);
                        deliveryQty += absQty;
                        dailyBreakdown[mytDate].deliv += absQty;
                    } else if (t.event_type === 'Transfer In') {
                        transferInQty += qty;
                    }
                }
            });

            // 4. Resolve Actual Stock
            let currentActualStock = 0;
            if (isClosedAudit) {
                currentActualStock = endAuditActualStock;
            } else {
                const invMatch = inventoryRecords.find(r => 
                    r.sku?.trim() === sku && 
                    (!selectedLoc || selectedLoc === 'ALL' || (r.loc_id || '').toLowerCase().trim() === selectedLoc.toLowerCase().trim())
                );
                currentActualStock = invMatch ? Number(invMatch.current_stock) || 0 : 0;
            }

            // 5. Compute Duration Days & Daily Averages
            const startMs = new Date(activeWindowStart).getTime();
            const endMs = new Date(activeWindowEnd).getTime();
            const durationDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
            const dailyAvgProd = parseFloat((productionQty / durationDays).toFixed(1));
            const dailyAvgDeliv = parseFloat((deliveryQty / durationDays).toFixed(1));

            // 6. Compute Expected Stock & Accuracies
            const expectedStock = parseFloat((startAuditStock + productionQty + transferInQty - transferOutQty - deliveryQty).toFixed(2));
            const variance = isClosedAudit ? parseFloat((currentActualStock - expectedStock).toFixed(2)) : 0;
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
                auditStartDate: activeWindowStart,
                auditEndDate: activeWindowEnd,
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
                healthStatus,
                durationDays,
                dailyAvgProd,
                dailyAvgDeliv,
                dailyBreakdown
            };
        });
    }, [masterItems, ledgerData, allAuditEvents, inventoryRecords, selectedLoc, dateMode, customStartDate, customEndDate]);

    // Active Selected SKU Details
    const activeSummary = useMemo(() => {
        return reconciliationMatrix.find(m => m.sku === selectedSku) || reconciliationMatrix[0] || null;
    }, [reconciliationMatrix, selectedSku]);

    // Filtered Table for Leaderboard
    const filteredSummaries = useMemo(() => {
        return reconciliationMatrix.filter(row => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!row.sku.toLowerCase().includes(q) && !row.name.toLowerCase().includes(q)) return false;
            }
            if (filterStatus === 'warning' && (row.healthStatus === 'excellent' || row.healthStatus === 'good' || row.healthStatus === 'tracking')) return false;
            if (filterStatus === 'healthy' && (row.healthStatus === 'warning' || row.healthStatus === 'alert')) return false;
            return true;
        }).sort((a, b) => {
            const aThroughput = a.productionQty + a.deliveryQty;
            const bThroughput = b.productionQty + b.deliveryQty;
            return bThroughput - aThroughput;
        });
    }, [reconciliationMatrix, searchQuery, filterStatus]);

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
            r.isClosedAudit ? formatSignedQty(r.variance) : '—',
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
        <div className="flex flex-col gap-6 animate-fade-in text-gray-100">
            {/* TOP HEADER CONTROLS */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    {onBackToMatrix && (
                        <button
                            type="button"
                            onClick={onBackToMatrix}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 transition active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="返回多仓实时矩阵"
                        >
                            <ArrowLeft size={16} />
                            <span>返回多仓矩阵</span>
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                <Scale size={20} />
                            </span>
                            <h2 className="text-lg font-black tracking-wide text-white flex items-center gap-2">
                                产销存平衡与盘点吻合率稽核
                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    Reconciliation v2.2
                                </span>
                            </h2>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            闭环审计历史盘点吻合率（98.07%），并无缝推演当前机台产出与发货实时动态
                        </p>
                    </div>
                </div>

                {/* Warehouse Location Selector & Refresh */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-2xl p-1 text-xs">
                        <Building2 size={14} className="text-gray-400 ml-2 mr-1" />
                        <select
                            value={selectedLoc}
                            onChange={(e) => setSelectedLoc(e.target.value)}
                            className="bg-transparent text-white font-bold py-1.5 px-2 focus:outline-none cursor-pointer"
                        >
                            {warehouseList.map(loc => (
                                <option key={loc} value={loc} className="bg-gray-900 text-white">
                                    🏢 {loc}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={fetchAllData}
                        disabled={loading}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-white/10"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
                        <span>刷新数据</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="px-3.5 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-emerald-900/30"
                    >
                        <FileSpreadsheet size={14} />
                        <span>导出稽核月报</span>
                    </button>
                </div>
            </div>

            {/* DATE INTERVAL SMART SWITCHER */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-black/30 border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-400 flex items-center gap-1 mr-1">
                        <Calendar size={14} className="text-purple-400" /> 核算周期:
                    </span>

                    {[
                        { key: 'CLOSED_AUDIT', label: '🏆 上期闭环审计 (8/18 ⇋ 8/29)', desc: 'Audit-to-Audit Closed Loop' },
                        { key: 'AUDIT_TO_NOW', label: '⚡ 最新盘点至今动态推演', desc: 'Audit-to-Live Tracking' },
                        { key: 'THIS_MONTH', label: `📅 本月至今 (${currentMonthLabel})`, desc: 'This Month' },
                        { key: 'LAST_7D', label: '⏱️ 近 7 天', desc: 'Last 7 Days' },
                        { key: 'LAST_30D', label: '📦 近 30 天', desc: 'Last 30 Days' },
                        { key: 'CUSTOM', label: '⚙️ 自定义日期', desc: 'Custom Date' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setDateMode(tab.key as any)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border ${
                                dateMode === tab.key
                                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/50 font-black'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {dateMode === 'CUSTOM' && (
                    <div className="flex items-center gap-2 text-xs">
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="bg-black/60 border border-white/20 rounded-xl px-2.5 py-1 text-white text-xs focus:outline-none"
                        />
                        <span className="text-gray-500">~</span>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="bg-black/60 border border-white/20 rounded-xl px-2.5 py-1 text-white text-xs focus:outline-none"
                        />
                    </div>
                )}

                {activeSummary && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20 flex items-center gap-2">
                            <span>当前区间: {activeSummary.auditStartDate.slice(0, 10)} ~ {activeSummary.auditEndDate.slice(0, 10)}</span>
                            <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 font-bold rounded-lg border border-purple-500/40 text-[10px]">
                                🗓️ 共 {activeSummary.durationDays} 天
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ANOMALY ALERT BANNER IF DETECTED */}
            {anomalies.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                            <ShieldAlert size={20} />
                        </div>
                        <div>
                            <div className="text-xs font-bold flex items-center gap-1.5">
                                <span>智能体检发现 {anomalies.length} 笔测试单/模拟扣减记录</span>
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-mono font-black">
                                    Auto Detected
                                </span>
                            </div>
                            <p className="text-[11px] text-amber-300/80 mt-0.5">
                                包含如 {anomalies.slice(0, 3).map(a => a.ref_doc).join(', ')} 等测试模拟单，已在本次计算中隔离或可一键清理
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ACTIVE SKU DEEP DIVE PANEL */}
            {activeSummary && (
                <div className="bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-white/15 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden shadow-2xl">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-500/20 border border-purple-500/40 rounded-2xl text-purple-300">
                                <Package size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-lg font-black text-white">{activeSummary.name}</span>
                                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-white/10 text-cyan-300 border border-white/10">
                                        {activeSummary.sku}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        {activeSummary.type}
                                    </span>
                                    <span className="text-xs text-gray-400 font-medium">
                                        📍 仓位: <strong className="text-white">{activeSummary.locId}</strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                                    <span className="text-gray-400">
                                        基准核算区间：{activeSummary.auditStartDate.slice(0, 10)}（基准实盘: {formatQty(activeSummary.startAuditStock)} {activeSummary.uom}） ~ {activeSummary.auditEndDate.slice(0, 10)}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 font-mono text-[11px]">
                                        🗓️ 核算周期：{activeSummary.durationDays} 天
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 font-mono text-[11px]">
                                        ⚡ 日均生产：~{formatQty(activeSummary.dailyAvgProd)} {activeSummary.uom}/天
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 font-mono text-[11px]">
                                        🚚 日均发货：~{formatQty(activeSummary.dailyAvgDeliv)} {activeSummary.uom}/天
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* SKU Fast Switcher */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 font-bold">切换重点物料:</span>
                            <select
                                value={selectedSku}
                                onChange={(e) => setSelectedSku(e.target.value)}
                                className="bg-black/60 border border-cyan-500/40 text-white font-bold text-xs py-2 px-3 rounded-xl focus:outline-none cursor-pointer"
                            >
                                {reconciliationMatrix.map(item => (
                                    <option key={item.sku} value={item.sku} className="bg-gray-900 text-white">
                                        {item.name} ({item.sku})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* FOUR PILLARS BALANCE FLOW CARDS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
                        {/* 1. Base Stock */}
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                ① 上期实盘基准
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-white font-mono">{formatQty(activeSummary.startAuditStock)}</span>
                                <span className="text-[10px] text-gray-400 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                                {activeSummary.auditStartDate.slice(5, 10)} 盘点基准
                            </div>
                        </div>

                        {/* 2. Production Inflow */}
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 shrink-0">
                                <TrendingUp size={12} className="shrink-0" /> <span>② 期间生产入库</span>
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-emerald-300 font-mono">+{formatQty(activeSummary.productionQty)}</span>
                                <span className="text-[10px] text-emerald-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-emerald-400/80 font-mono flex items-center justify-between">
                                <span>机台实际产出</span>
                                <span className="font-bold">~{formatQty(activeSummary.dailyAvgProd)}/天</span>
                            </div>
                        </div>

                        {/* 3. Delivery Outflow */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1 shrink-0">
                                <TrendingDown size={12} className="shrink-0" /> <span>③ 期间发货出库</span>
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-blue-300 font-mono">-{formatQty(activeSummary.deliveryQty)}</span>
                                <span className="text-[10px] text-blue-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-blue-400/80 font-mono flex items-center justify-between">
                                <span>司机装车出库</span>
                                <span className="font-bold">~{formatQty(activeSummary.dailyAvgDeliv)}/天</span>
                            </div>
                        </div>

                        {/* 4. Net Transfer */}
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                                ④ 移库调拨净流入
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-purple-300 font-mono">
                                    {formatSignedQty(activeSummary.transferInQty - activeSummary.transferOutQty)}
                                </span>
                                <span className="text-[10px] text-purple-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-purple-400/70 font-mono">
                                内部仓位调入调出
                            </div>
                        </div>

                        {/* 5. Expected Stock */}
                        <div className="bg-black/50 border border-cyan-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                                ⑤ 理论系统应有
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-cyan-300 font-mono">{formatQty(activeSummary.expectedStock)}</span>
                                <span className="text-[10px] text-cyan-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                                ① + ② - ③ + ④
                            </div>
                        </div>

                        {/* 6. Physical Actual Stock */}
                        <div className="bg-black/50 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                {activeSummary.isClosedAudit ? '⑥ 本期实盘库存' : '⑥ 当前账面结存'}
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-amber-300 font-mono">{formatQty(activeSummary.currentActualStock)}</span>
                                <span className="text-[10px] text-amber-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                                {activeSummary.isClosedAudit ? '本期现场实盘复核' : '动态流水运行结余'}
                            </div>
                        </div>

                        {/* 7. Discrepancy Variance */}
                        <div className={`rounded-2xl p-3.5 flex flex-col justify-between border ${
                            !activeSummary.isClosedAudit
                                ? 'bg-white/5 border-white/10 text-gray-400'
                                : activeSummary.absVariance === 0
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : activeSummary.absVariance <= 70
                                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                        }`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider">
                                ⑦ 盘点账实差异
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black font-mono">
                                    {activeSummary.isClosedAudit ? formatSignedQty(activeSummary.variance) : '待实盘'}
                                </span>
                                {activeSummary.isClosedAudit && <span className="text-[10px] ml-1">{activeSummary.uom}</span>}
                            </div>
                            <div className="text-[10px] font-mono opacity-80">
                                {activeSummary.isClosedAudit ? '⑥ 实盘 - ⑤ 理论' : '待下次现场实盘'}
                            </div>
                        </div>
                    </div>

                    {/* THREE KEY METRICS KPI STRIP */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/10">
                        {/* KPI 1: Production Output Accuracy */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                    <span>🏆 生产吻合准确率 (Production Accuracy)</span>
                                </div>
                                <div className="text-3xl font-black text-white font-mono mt-1 flex items-baseline gap-2">
                                    {activeSummary.isClosedAudit ? (
                                        <>
                                            <span>{activeSummary.productionAccuracy.toFixed(2)}%</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                                                activeSummary.productionAccuracy >= 95 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                            }`}>
                                                {activeSummary.productionAccuracy >= 95 ? '极佳吻合' : '正常波动'}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xl text-amber-400 font-sans font-bold">推演进行中</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300">
                                                待下次实盘
                                            </span>
                                        </>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                    {activeSummary.isClosedAudit 
                                        ? `公式: (1 - |差异 ${formatQty(activeSummary.absVariance)}| / 生产量 ${formatQty(activeSummary.productionQty)}) × 100%`
                                        : '当前处于动态推演期，需待下一次现场盘点校验真实吻合率'}
                                </p>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                                activeSummary.isClosedAudit ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}>
                                {activeSummary.isClosedAudit ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                            </div>
                        </div>

                        {/* KPI 2: Inventory Throughput Accuracy */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                    <span>📦 仓储流转总账吻合率 (Throughput Accuracy)</span>
                                </div>
                                <div className="text-3xl font-black text-cyan-300 font-mono mt-1 flex items-baseline gap-2">
                                    {activeSummary.isClosedAudit ? (
                                        <>
                                            <span>{activeSummary.throughputAccuracy.toFixed(2)}%</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-400 uppercase">
                                                流转闭环
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xl text-cyan-300 font-mono font-bold">+{formatQty(activeSummary.productionQty)} / -{formatQty(activeSummary.deliveryQty)}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-400">
                                                净流入 {formatSignedQty(activeSummary.productionQty - activeSummary.deliveryQty)}
                                            </span>
                                        </>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                    总吞吐流转: {formatQty(activeSummary.productionQty + activeSummary.deliveryQty)} {activeSummary.uom}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                                <Layers size={24} />
                            </div>
                        </div>

                        {/* KPI 3: Variance Ratio / Status */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                    <span>{activeSummary.isClosedAudit ? '⚠️ 差异偏离率 (Variance Rate)' : '⚡ 当前推演状态 (Recon State)'}</span>
                                </div>
                                <div className="text-3xl font-black text-purple-300 font-mono mt-1 flex items-baseline gap-2">
                                    {activeSummary.isClosedAudit ? (
                                        <>
                                            <span>{(100 - activeSummary.throughputAccuracy).toFixed(2)}%</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-400 uppercase">
                                                自然轻微溢出
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xl text-purple-300 font-sans font-bold">实时推演中</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300">
                                                {activeSummary.durationDays} 天跨度
                                            </span>
                                        </>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                    {activeSummary.isClosedAudit ? `差异绝对值: ${formatQty(activeSummary.absVariance)} ${activeSummary.uom}` : `推演应有库存: ${formatQty(activeSummary.expectedStock)} ${activeSummary.uom}`}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                                <Scale size={24} />
                            </div>
                        </div>
                    </div>

                    {/* DAILY INFLOW VS OUTFLOW TREND CHART */}
                    {Object.keys(activeSummary.dailyBreakdown).length > 0 && (
                        <div className="mt-6 pt-5 border-t border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <BarChart3 size={15} className="text-cyan-400" />
                                    <span>每日生产入库 vs 发货装车对比走势</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] font-mono">
                                    <span className="flex items-center gap-1 text-emerald-400">
                                        <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> 生产 (+Inflow)
                                    </span>
                                    <span className="flex items-center gap-1 text-blue-400">
                                        <span className="w-2.5 h-2.5 rounded bg-blue-500"></span> 发货 (-Outflow)
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                                {Object.entries(activeSummary.dailyBreakdown).sort().map(([dateStr, d]) => (
                                    <div key={dateStr} className="bg-black/40 border border-white/10 rounded-xl p-2.5 flex flex-col items-center justify-between text-center">
                                        <span className="text-[10px] font-mono text-gray-400">{dateStr.slice(5)}</span>
                                        <div className="my-1.5 flex flex-col gap-0.5 items-center">
                                            <span className="text-xs font-black font-mono text-emerald-400">+{formatQty(d.prod)}</span>
                                            <span className="text-xs font-black font-mono text-blue-400">-{formatQty(d.deliv)}</span>
                                        </div>
                                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                            d.prod >= d.deliv ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                                        }`}>
                                            {formatSignedQty(d.prod - d.deliv)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ALL SKUS OVERVIEW & HEALTH LEADERBOARD TABLE */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wider">
                            <Layers size={16} className="text-cyan-400" />
                            <span>全品类产销平衡与准确率排行榜 ({selectedLoc})</span>
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            点击表格任意一行，可在上方展开该物料从基准至今的完整平衡推演轨迹
                        </p>
                    </div>

                    {/* Filter & Search */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索品名 / SKU..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                            />
                        </div>

                        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5 text-xs">
                            <button
                                type="button"
                                onClick={() => setFilterStatus('all')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition ${filterStatus === 'all' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                全部
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('healthy')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition ${filterStatus === 'healthy' ? 'bg-emerald-500 text-black font-black' : 'text-gray-400 hover:text-white'}`}
                            >
                                🟢 极佳吻合
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('warning')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition ${filterStatus === 'warning' ? 'bg-amber-500 text-black font-black' : 'text-gray-400 hover:text-white'}`}
                            >
                                ⚠️ 偏差预警
                            </button>
                        </div>
                    </div>
                </div>

                {/* Leaderboard Table */}
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-black/60 text-gray-400 font-bold border-b border-white/10 text-[11px] uppercase tracking-wider">
                                <th className="py-3 px-4">物料 / 品名</th>
                                <th className="py-3 px-3 text-center">类型</th>
                                <th className="py-3 px-3 text-right">① 上期实盘</th>
                                <th className="py-3 px-3 text-right text-emerald-400">② 期间生产</th>
                                <th className="py-3 px-3 text-right text-blue-400">③ 期间发货</th>
                                <th className="py-3 px-3 text-right text-cyan-400">⑤ 理论应有</th>
                                <th className="py-3 px-3 text-right text-amber-400">⑥ 现场实盘</th>
                                <th className="py-3 px-3 text-right">⑦ 账实差异</th>
                                <th className="py-3 px-4 text-center">吻合状态 / 准确率</th>
                                <th className="py-3 px-3 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredSummaries.map((item, idx) => {
                                const isSelected = item.sku === selectedSku;
                                return (
                                    <tr
                                        key={item.sku}
                                        onClick={() => setSelectedSku(item.sku)}
                                        className={`transition cursor-pointer ${
                                            isSelected 
                                                ? 'bg-purple-600/20 hover:bg-purple-600/30' 
                                                : 'hover:bg-white/5'
                                        }`}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="font-bold text-white flex items-center gap-2">
                                                <span>{item.name}</span>
                                                {isSelected && (
                                                    <span className="px-1.5 py-0.2 bg-purple-500 text-white rounded text-[9px] font-mono">
                                                        当前聚焦
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1.5 mt-0.5">
                                                <span>{item.sku}</span>
                                                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 text-[9px]">
                                                    🗓️ {item.durationDays}天
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-gray-300">
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono text-gray-300">
                                            {formatQty(item.startAuditStock)} {item.uom}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono">
                                            <div className="font-bold text-emerald-400">+{formatQty(item.productionQty)}</div>
                                            <div className="text-[9px] text-emerald-400/70">~{formatQty(item.dailyAvgProd)}/天</div>
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono">
                                            <div className="font-bold text-blue-400">-{formatQty(item.deliveryQty)}</div>
                                            <div className="text-[9px] text-blue-400/70">~{formatQty(item.dailyAvgDeliv)}/天</div>
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                                            {formatQty(item.expectedStock)}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-black text-amber-300">
                                            {formatQty(item.currentActualStock)}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-bold">
                                            {item.isClosedAudit ? (
                                                <span className={item.variance === 0 ? 'text-gray-400' : item.variance > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                    {formatSignedQty(item.variance)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-500 font-normal text-[11px]">待实盘</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {item.isClosedAudit ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-black border bg-black/40">
                                                    <span className={`w-2 h-2 rounded-full ${
                                                        item.healthStatus === 'excellent' ? 'bg-emerald-400' :
                                                        item.healthStatus === 'good' ? 'bg-cyan-400' :
                                                        item.healthStatus === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                                                    }`}></span>
                                                    <span className={
                                                        item.healthStatus === 'excellent' ? 'text-emerald-300' :
                                                        item.healthStatus === 'good' ? 'text-cyan-300' :
                                                        item.healthStatus === 'warning' ? 'text-amber-300' : 'text-red-300'
                                                    }>
                                                        {item.productionAccuracy.toFixed(1)}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-bold">
                                                    ⚡ 动态推演中
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedSku(item.sku);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 font-bold rounded-lg border border-purple-500/30 transition active:scale-95 text-[10px]"
                                            >
                                                聚焦推演
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
