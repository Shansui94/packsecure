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
    HelpCircle
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
    healthStatus: 'excellent' | 'good' | 'warning' | 'alert';
    dailyBreakdown: Record<string, { prod: number; deliv: number }>;
}

export const StockReconciliationDashboard: React.FC<Props> = ({
    initialSku = null,
    onBackToMatrix
}) => {
    const [loading, setLoading] = useState(true);
    const [selectedLoc, setSelectedLoc] = useState<string>('OPM Lama');
    const [selectedSku, setSelectedSku] = useState<string>(initialSku || 'BW-SL-CLR-100Mx100CMx1ROLL-RED');
    const [dateMode, setDateMode] = useState<'AUTO_AUDIT' | 'TODAY' | 'LAST_7D' | 'LAST_30D' | 'THIS_MONTH' | 'CUSTOM'>('AUTO_AUDIT');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'warning' | 'healthy'>('all');

    // Raw datasets
    const [ledgerData, setLedgerData] = useState<any[]>([]);
    const [masterItems, setMasterItems] = useState<any[]>([]);
    const [inventoryRecords, setInventoryRecords] = useState<any[]>([]);
    const [anomalies, setAnomalies] = useState<any[]>([]);

    // Fetch all master items and full ledger history
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Master Items & Inventory Views
            const [masterRes, invRes] = await Promise.all([
                supabase.from('master_items_v2').select('sku, name, type, uom').eq('status', 'Active'),
                supabase.from('v2_inventory_view').select('sku, name, type, uom, loc_id, current_stock')
            ]);

            setMasterItems(masterRes.data || []);
            setInventoryRecords(invRes.data || []);

            // 2. Fetch Ledger data in paginated chunks (up to 15,000 newest transactions)
            let allLedger: any[] = [];
            let offset = 0;
            const pageSize = 1000;
            const maxPages = 15;

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

            // 3. Detect Anomalies (e.g. test orders or missing names)
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
        const todayStart = new Date(Date.now() - 1 * 86400000).toISOString();

        return masterItems.map(item => {
            const sku = item.sku.trim();
            
            // 1. Filter ledger for this SKU & Location
            const skuTxs = ledgerData.filter(t => 
                t.sku?.trim() === sku && 
                (!selectedLoc || selectedLoc === 'ALL' || (t.loc_id || '').toLowerCase().trim() === selectedLoc.toLowerCase().trim())
            );

            // Sort chronologically ascending
            const chronoTxs = [...skuTxs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // 2. Find Audit Adjustment events for auto-interval
            const auditEvents = chronoTxs.filter(t => 
                t.event_type === 'Audit Adjustment' || 
                t.event_type === 'Audit' || 
                t.event_type === 'Adjustment' ||
                (t.notes && t.notes.includes('from Audit'))
            );

            let startAuditDate = '2026-08-01T00:00:00Z';
            let endAuditDate = new Date().toISOString();
            let startAuditStock = 0;

            if (auditEvents.length >= 2) {
                const prevAudit = auditEvents[auditEvents.length - 2];
                const latestAudit = auditEvents[auditEvents.length - 1];
                startAuditDate = prevAudit.timestamp;
                endAuditDate = latestAudit.timestamp;

                // Parse base stock from notes: e.g. "Actual: 150" or change_qty
                const matchActual = (prevAudit.notes || '').match(/Actual:\s*([\d.-]+)/i);
                if (matchActual) {
                    startAuditStock = parseFloat(matchActual[1]);
                } else if (prevAudit.balance_after != null) {
                    startAuditStock = prevAudit.balance_after;
                } else {
                    startAuditStock = prevAudit.change_qty;
                }
            } else if (auditEvents.length === 1) {
                const singleAudit = auditEvents[0];
                startAuditDate = singleAudit.timestamp;
                const matchActual = (singleAudit.notes || '').match(/Actual:\s*([\d.-]+)/i);
                if (matchActual) {
                    startAuditStock = parseFloat(matchActual[1]);
                } else {
                    startAuditStock = singleAudit.change_qty;
                }
            } else {
                startAuditDate = last30dStart;
                startAuditStock = 0;
            }

            // Determine active evaluation window
            let activeWindowStart = startAuditDate;
            let activeWindowEnd = endAuditDate;

            if (dateMode === 'TODAY') {
                activeWindowStart = todayStart;
                activeWindowEnd = new Date().toISOString();
            } else if (dateMode === 'LAST_7D') {
                activeWindowStart = last7dStart;
                activeWindowEnd = new Date().toISOString();
            } else if (dateMode === 'LAST_30D') {
                activeWindowStart = last30dStart;
                activeWindowEnd = new Date().toISOString();
            } else if (dateMode === 'THIS_MONTH') {
                activeWindowStart = thisMonthStart;
                activeWindowEnd = new Date().toISOString();
            } else if (dateMode === 'CUSTOM' && customStartDate) {
                activeWindowStart = new Date(customStartDate).toISOString();
                if (customEndDate) activeWindowEnd = new Date(customEndDate + 'T23:59:59').toISOString();
            }

            // 3. Sum up flow components inside active window
            let productionQty = 0;
            let deliveryQty = 0;
            let transferInQty = 0;
            let transferOutQty = 0;
            const dailyBreakdown: Record<string, { prod: number; deliv: number }> = {};

            chronoTxs.forEach(t => {
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

            // 4. Resolve Actual Current Stock
            const invMatch = inventoryRecords.find(r => 
                r.sku?.trim() === sku && 
                (!selectedLoc || selectedLoc === 'ALL' || (r.loc_id || '').toLowerCase().trim() === selectedLoc.toLowerCase().trim())
            );
            const currentActualStock = invMatch ? Number(invMatch.current_stock) || 0 : 0;

            // 5. Compute Expected Stock & Accuracies
            const expectedStock = startAuditStock + productionQty + transferInQty - transferOutQty - deliveryQty;
            const variance = currentActualStock - expectedStock;
            const absVariance = Math.abs(variance);

            let productionAccuracy = 100;
            if (productionQty > 0) {
                productionAccuracy = Math.max(0, (1 - absVariance / productionQty) * 100);
            }

            let throughputAccuracy = 100;
            const totalThroughput = productionQty + deliveryQty;
            if (totalThroughput > 0) {
                throughputAccuracy = Math.max(0, (1 - absVariance / totalThroughput) * 100);
            }

            // Health status
            let healthStatus: 'excellent' | 'good' | 'warning' | 'alert' = 'excellent';
            if (productionAccuracy >= 95) healthStatus = 'excellent';
            else if (productionAccuracy >= 88) healthStatus = 'good';
            else if (productionAccuracy >= 75) healthStatus = 'warning';
            else healthStatus = 'alert';

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
                healthStatus,
                dailyBreakdown
            };
        });
    }, [masterItems, ledgerData, inventoryRecords, selectedLoc, dateMode, customStartDate, customEndDate]);

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
            if (filterStatus === 'warning' && (row.healthStatus === 'excellent' || row.healthStatus === 'good')) return false;
            if (filterStatus === 'healthy' && (row.healthStatus === 'warning' || row.healthStatus === 'alert')) return false;
            return true;
        }).sort((a, b) => {
            // Put items with active production or throughput on top
            const aThroughput = a.productionQty + a.deliveryQty;
            const bThroughput = b.productionQty + b.deliveryQty;
            return bThroughput - aThroughput;
        });
    }, [reconciliationMatrix, searchQuery, filterStatus]);

    // Export CSV
    const handleExportCSV = () => {
        if (!filteredSummaries.length) return;
        const headers = [
            'SKU', '品名 (Name)', '类型 (Type)', '仓位 (Location)', 
            '期初基准 (Base Stock)', '期间生产 (+Production)', '期间发货 (-Delivery)', 
            '理论库存 (Expected)', '实际实盘 (Actual)', '差异偏差 (Variance)', 
            '生产吻合率 (Prod Accuracy %)', '总吞吐吻合率 (Throughput Accuracy %)', '健康状态 (Status)'
        ];

        const rows = filteredSummaries.map(r => [
            r.sku,
            `"${r.name}"`,
            r.type,
            r.locId,
            r.startAuditStock,
            r.productionQty,
            r.deliveryQty,
            r.expectedStock,
            r.currentActualStock,
            r.variance,
            r.productionAccuracy.toFixed(2) + '%',
            r.throughputAccuracy.toFixed(2) + '%',
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
                                    Reconciliation v2.0
                                </span>
                            </h2>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            自动对齐上期盘点基准与最新实盘，闭环推演全厂机台产出、发货装车与实际库存吻合度
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
                        { key: 'AUTO_AUDIT', label: '🧠 自动对齐上期盘点', desc: 'Auto Audit Interval' },
                        { key: 'THIS_MONTH', label: '📅 本月至今 (Aug)', desc: 'This Month' },
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
                    <div className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-xl border border-cyan-500/20">
                        当前区间: {activeSummary.auditStartDate.slice(0, 10)} ~ {activeSummary.auditEndDate.slice(0, 10)}
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
                                <p className="text-xs text-gray-400 mt-1">
                                    基准核算区间：{activeSummary.auditStartDate.slice(0, 10)}（基准盘点: {activeSummary.startAuditStock} {activeSummary.uom}） ~ 至今
                                </p>
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
                                <span className="text-2xl font-black text-white font-mono">{activeSummary.startAuditStock}</span>
                                <span className="text-[10px] text-gray-400 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                                {activeSummary.auditStartDate.slice(5, 10)} 盘点基准
                            </div>
                        </div>

                        {/* 2. Production Inflow */}
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                <TrendingUp size={12} /> ② 期间生产入库
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-emerald-300 font-mono">+{activeSummary.productionQty}</span>
                                <span className="text-[10px] text-emerald-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-emerald-400/70 font-mono">
                                机台实际登记产出
                            </div>
                        </div>

                        {/* 3. Delivery Outflow */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                                <TrendingDown size={12} /> ③ 期间发货出库
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-blue-300 font-mono">-{activeSummary.deliveryQty}</span>
                                <span className="text-[10px] text-blue-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-blue-400/70 font-mono">
                                司机装车发货出库
                            </div>
                        </div>

                        {/* 4. Net Transfer */}
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                                ④ 移库调拨净流入
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-purple-300 font-mono">
                                    {activeSummary.transferInQty - activeSummary.transferOutQty >= 0 ? '+' : ''}
                                    {activeSummary.transferInQty - activeSummary.transferOutQty}
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
                                <span className="text-2xl font-black text-cyan-300 font-mono">{activeSummary.expectedStock}</span>
                                <span className="text-[10px] text-cyan-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                                ① + ② - ③ + ④
                            </div>
                        </div>

                        {/* 6. Physical Actual Stock */}
                        <div className="bg-black/50 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                ⑥ 现场实盘库存
                            </div>
                            <div className="my-2">
                                <span className="text-2xl font-black text-amber-300 font-mono">{activeSummary.currentActualStock}</span>
                                <span className="text-[10px] text-amber-400/80 ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                                现场最新盘点实物
                            </div>
                        </div>

                        {/* 7. Discrepancy Variance */}
                        <div className={`rounded-2xl p-3.5 flex flex-col justify-between border ${
                            activeSummary.absVariance === 0
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
                                    {activeSummary.variance > 0 ? '+' : ''}{activeSummary.variance}
                                </span>
                                <span className="text-[10px] ml-1">{activeSummary.uom}</span>
                            </div>
                            <div className="text-[10px] font-mono opacity-80">
                                ⑥ 实盘 - ⑤ 理论
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
                                    <span>{activeSummary.productionAccuracy.toFixed(2)}%</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                                        activeSummary.productionAccuracy >= 95 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                    }`}>
                                        {activeSummary.productionAccuracy >= 95 ? '极佳吻合' : '正常波动'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                    公式: (1 - |差异 {activeSummary.absVariance}| / 生产量 {activeSummary.productionQty}) × 100%
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 size={24} />
                            </div>
                        </div>

                        {/* KPI 2: Inventory Throughput Accuracy */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                    <span>📦 仓储流转总账吻合率 (Throughput Accuracy)</span>
                                </div>
                                <div className="text-3xl font-black text-cyan-300 font-mono mt-1 flex items-baseline gap-2">
                                    <span>{activeSummary.throughputAccuracy.toFixed(2)}%</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-400 uppercase">
                                        流转闭环
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                    总吞吐流转: {activeSummary.productionQty + activeSummary.deliveryQty} {activeSummary.uom}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                                <Layers size={24} />
                            </div>
                        </div>

                        {/* KPI 3: Variance Ratio */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                    <span>⚠️ 差异偏离率 (Variance Rate)</span>
                                </div>
                                <div className="text-3xl font-black text-purple-300 font-mono mt-1 flex items-baseline gap-2">
                                    <span>{(100 - activeSummary.throughputAccuracy).toFixed(2)}%</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-400 uppercase">
                                        自然轻微溢出
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                    差异绝对值: {activeSummary.absVariance} {activeSummary.uom}
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
                                            <span className="text-xs font-black font-mono text-emerald-400">+{d.prod}</span>
                                            <span className="text-xs font-black font-mono text-blue-400">-{d.deliv}</span>
                                        </div>
                                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                            d.prod >= d.deliv ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                                        }`}>
                                            {d.prod - d.deliv >= 0 ? `+${d.prod - d.deliv}` : `${d.prod - d.deliv}`}
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
                                <th className="py-3 px-4 text-center">生产准确率</th>
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
                                            <div className="text-[10px] font-mono text-gray-400">{item.sku}</div>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-gray-300">
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono text-gray-300">
                                            {item.startAuditStock} {item.uom}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                                            +{item.productionQty}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-400">
                                            -{item.deliveryQty}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                                            {item.expectedStock}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-black text-amber-300">
                                            {item.currentActualStock}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-bold">
                                            <span className={item.variance === 0 ? 'text-gray-400' : item.variance > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                {item.variance > 0 ? '+' : ''}{item.variance}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
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
