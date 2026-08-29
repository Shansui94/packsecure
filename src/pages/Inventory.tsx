import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { WAREHOUSES } from '../data/factoryData';
import { StockReconciliationDashboard } from '../components/StockReconciliationDashboard';
import {
    Search,
    RefreshCw,
    Download,
    Layers,
    AlertTriangle,
    Package,
    Hexagon,
    Boxes,
    Building2,
    CheckCircle2,
    SlidersHorizontal,
    ArrowUpDown,
    ExternalLink,
    Scale
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// --- TYPES ---
interface MasterItem {
    sku: string;
    name: string;
    type: string;
    uom: string;
    status: string;
    min_stock_level?: number;
    nickname?: string;
}

interface InventoryRecord {
    sku: string;
    name?: string;
    type?: string;
    uom?: string;
    loc_id?: string;
    current_stock: number;
    last_updated?: string;
}

interface MatrixRow {
    sku: string;
    name: string;
    type: string;
    uom: string;
    min_stock_level: number;
    factoryStocks: Record<string, number>;
    totalStock: number;
    status: 'healthy' | 'low' | 'out_of_stock';
    lastUpdated: string;
}

type HealthFilter = 'all' | 'healthy' | 'low' | 'out';

const TYPE_BADGE_STYLE: Record<string, string> = {
    FG: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    Raw: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    WiP: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Packaging: 'bg-pink-500/10 text-pink-400 border-pink-500/30'
};

const normalizeLoc = (loc?: string): string => {
    if (!loc) return 'OPM Lama';
    const l = loc.toLowerCase().trim();
    if (
        l === 'opm lama' ||
        l === 'opm_lama' ||
        l === 't1' ||
        l === 't2' ||
        l === 't3' ||
        l === 't4' ||
        l === 't5' ||
        l === 'taiping'
    )
        return 'OPM Lama';
    if (l === 'spd') return 'SPD';
    if (l === 'opm corner' || l === 'opm_corner') return 'OPM Corner';
    if (l === 'opm ali' || l === 'opm_ali') return 'OPM Ali';
    if (l === 'nilai') return 'Nilai';
    if (l === 'kelantan') return 'Kelantan';
    if (l === 'johor') return 'Johor';
    return loc.trim();
};

const Inventory: React.FC = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [lastRefreshTime, setLastRefreshTime] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('All');
    const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
    const [visibleLocations, setVisibleLocations] = useState<string[]>(WAREHOUSES);
    const [showLocPicker, setShowLocPicker] = useState(false);
    const [sortField, setSortField] = useState<'sku' | 'name' | 'totalStock' | 'type'>('totalStock');
    const [sortAsc, setSortAsc] = useState(false);
    const [activeTab, setActiveTab] = useState<'matrix' | 'reconciliation'>('matrix');
    const [reconcileSku, setReconcileSku] = useState<string | null>(null);

    const handleOpenReconcile = (sku: string) => {
        setReconcileSku(sku);
        setActiveTab('reconciliation');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Raw data
    const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
    const [inventoryRecords, setInventoryRecords] = useState<InventoryRecord[]>([]);

    // 1. Fetch data from Supabase
    const fetchData = async () => {
        setLoading(true);
        try {
            const [masterRes, invRes] = await Promise.all([
                supabase
                    .from('master_items_v2')
                    .select('sku, name, type, uom, status, min_stock_level, nickname')
                    .eq('status', 'Active')
                    .order('sku', { ascending: true }),
                supabase
                    .from('v2_inventory_view')
                    .select('sku, name, type, uom, loc_id, current_stock, last_updated')
            ]);

            if (masterRes.error) throw masterRes.error;
            if (invRes.error) throw invRes.error;

            setMasterItems(masterRes.data || []);
            setInventoryRecords(invRes.data || []);
            setLastRefreshTime(new Date().toLocaleTimeString('en-GB'));
        } catch (err) {
            console.error('Error fetching inventory matrix data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 45000);
        return () => clearInterval(interval);
    }, []);

    // 2. Discover all distinct normalized warehouse locations
    const allLocations = useMemo(() => {
        const set = new Set<string>(WAREHOUSES);
        inventoryRecords.forEach(r => {
            if (r.loc_id) set.add(normalizeLoc(r.loc_id));
        });
        return Array.from(set);
    }, [inventoryRecords]);

    // 3. Build Pivot Matrix
    const matrixRows: MatrixRow[] = useMemo(() => {
        if (!masterItems.length) return [];

        // Build a lookup map of [sku|normLoc] -> current_stock
        const stockMap = new Map<string, number>();
        const lastUpdatedMap = new Map<string, string>();

        inventoryRecords.forEach(r => {
            if (!r.sku) return;
            const sku = r.sku.trim();
            const normLoc = normalizeLoc(r.loc_id);
            const key = `${sku}|${normLoc}`;
            const qty = Number(r.current_stock) || 0;
            stockMap.set(key, (stockMap.get(key) || 0) + qty);

            if (r.last_updated) {
                const cur = lastUpdatedMap.get(sku);
                if (!cur || new Date(r.last_updated) > new Date(cur)) {
                    lastUpdatedMap.set(sku, r.last_updated);
                }
            }
        });

        return masterItems.map(item => {
            const trimmedSku = item.sku.trim();
            const factoryStocks: Record<string, number> = {};
            let totalStock = 0;

            allLocations.forEach(loc => {
                const key = `${trimmedSku}|${loc}`;
                const qty = stockMap.get(key) || 0;
                factoryStocks[loc] = qty;
                totalStock += qty;
            });

            const minLevel = Number(item.min_stock_level) || 0;
            let status: 'healthy' | 'low' | 'out_of_stock' = 'healthy';
            if (totalStock < 0) {
                status = 'out_of_stock';
            } else if (minLevel > 0 && totalStock < minLevel) {
                status = 'low';
            }

            return {
                sku: trimmedSku,
                name: item.name || trimmedSku,
                type: item.type || 'FG',
                uom: item.uom || 'Unit',
                min_stock_level: minLevel,
                factoryStocks,
                totalStock,
                status,
                lastUpdated: lastUpdatedMap.get(trimmedSku) || ''
            };
        });
    }, [masterItems, inventoryRecords, allLocations]);

    // 4. Global KPIs & Summary Metrics
    const kpis = useMemo(() => {
        let totalUnits = 0;
        let fgCount = 0;
        let rawCount = 0;
        let rawUnits = 0;
        let lowAlerts = 0;
        let outAlerts = 0;

        matrixRows.forEach(row => {
            totalUnits += row.totalStock;
            if (row.type === 'FG') {
                fgCount += row.totalStock;
            } else if (row.type === 'Raw') {
                rawCount++;
                rawUnits += row.totalStock;
            }

            if (row.status === 'out_of_stock') {
                outAlerts++;
            } else if (row.status === 'low') {
                lowAlerts++;
            }
        });

        return {
            totalUnits,
            fgCount,
            rawCount,
            rawUnits,
            lowAlerts,
            outAlerts,
            totalSkus: matrixRows.length
        };
    }, [matrixRows]);

    // 5. Filtering & Sorting
    const filteredRows = useMemo(() => {
        const searchTerms = search.toLowerCase().trim().split(/[\s-]+/).filter(Boolean);

        return matrixRows
            .filter(row => {
                // Search filter
                if (searchTerms.length > 0) {
                    const sku = row.sku.toLowerCase();
                    const name = row.name.toLowerCase();
                    const isMatch = searchTerms.every(t => sku.includes(t) || name.includes(t));
                    if (!isMatch) return false;
                }

                // Type filter
                if (typeFilter !== 'All' && row.type !== typeFilter) {
                    return false;
                }

                // Health filter
                if (healthFilter === 'healthy' && row.status !== 'healthy') return false;
                if (healthFilter === 'low' && row.status !== 'low') return false;
                if (healthFilter === 'out' && row.status !== 'out_of_stock') return false;

                return true;
            })
            .sort((a, b) => {
                let diff = 0;
                if (sortField === 'totalStock') diff = a.totalStock - b.totalStock;
                else if (sortField === 'sku') diff = a.sku.localeCompare(b.sku);
                else if (sortField === 'name') diff = a.name.localeCompare(b.name);
                else if (sortField === 'type') diff = a.type.localeCompare(b.type);
                return sortAsc ? diff : -diff;
            });
    }, [matrixRows, search, typeFilter, healthFilter, sortField, sortAsc]);

    // 6. CSV Export
    const handleExportCSV = () => {
        if (!filteredRows.length) {
            alert('No inventory items to export.');
            return;
        }

        const headers = [
            'SKU',
            'Item Name',
            'Type',
            'UOM',
            'Min Stock Alert',
            ...visibleLocations,
            'Global Total Stock',
            'Health Status'
        ];

        const rows = filteredRows.map(r => {
            const safeName = r.name.includes(',') ? `"${r.name}"` : r.name;
            const factoryValues = visibleLocations.map(loc => r.factoryStocks[loc] || 0);
            return [
                r.sku,
                safeName,
                r.type,
                r.uom,
                r.min_stock_level,
                ...factoryValues,
                r.totalStock,
                r.status
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `global_inventory_matrix_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSort = (field: 'sku' | 'name' | 'totalStock' | 'type') => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const toggleLocation = (loc: string) => {
        if (visibleLocations.includes(loc)) {
            if (visibleLocations.length === 1) return; // keep at least 1
            setVisibleLocations(visibleLocations.filter(l => l !== loc));
        } else {
            setVisibleLocations([...visibleLocations, loc]);
        }
    };

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 font-sans selection:bg-cyan-500/30">
            <div className="max-w-[1600px] mx-auto space-y-6">
                {/* --- HEADER --- */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-900/20">
                                <Boxes size={22} />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                                    Global Inventory Matrix
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                                        Multi-Factory
                                    </span>
                                </h1>
                                <p className="text-gray-400 text-xs md:text-sm mt-0.5">
                                    Cross-factory multi-warehouse live inventory pivot matrix & safety alerts.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-mono hidden sm:inline">
                            Synced: {lastRefreshTime || 'Loading...'}
                        </span>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            title="Refresh Matrix"
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all flex items-center gap-2 text-xs font-bold"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin text-cyan-400' : ''} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl text-white font-bold text-xs shadow-lg shadow-green-900/30 transition-all cursor-pointer"
                        >
                            <Download size={15} />
                            Export Matrix CSV
                        </button>
                    </div>
                </div>

                {/* --- EXECUTIVE KPI CARDS --- */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    {/* Total Inventory */}
                    <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Layers size={13} className="text-cyan-400" />
                            Total Items (SKUs)
                        </div>
                        <div className="mt-2 text-2xl md:text-3xl font-black font-mono text-white tracking-tight">
                            {kpis.totalSkus.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">Active registered master items</div>
                    </div>

                    {/* Finished Goods */}
                    <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden group">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Package size={13} className="text-cyan-400" />
                            Finished Goods (FG)
                        </div>
                        <div className="mt-2 text-2xl md:text-3xl font-black font-mono text-cyan-400 tracking-tight">
                            {kpis.fgCount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">Total FG across all factories</div>
                    </div>

                    {/* Raw Materials */}
                    <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden group">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Hexagon size={13} className="text-amber-400" />
                            Raw Materials
                        </div>
                        <div className="mt-2 text-2xl md:text-3xl font-black font-mono text-amber-400 tracking-tight">
                            {kpis.rawUnits.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                            {kpis.rawCount} active raw material grades
                        </div>
                    </div>

                    {/* Low Stock Alerts */}
                    <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden group">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <AlertTriangle size={13} className="text-amber-500" />
                            Low Stock Alerts
                        </div>
                        <div
                            className={`mt-2 text-2xl md:text-3xl font-black font-mono tracking-tight ${
                                kpis.lowAlerts > 0 ? 'text-amber-400 animate-pulse' : 'text-gray-400'
                            }`}
                        >
                            {kpis.lowAlerts}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">Below minimum threshold</div>
                    </div>

                    {/* Stockout / Negative */}
                    <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden group col-span-2 sm:col-span-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <AlertTriangle size={13} className="text-red-500" />
                            Stockout / Negative
                        </div>
                        <div
                            className={`mt-2 text-2xl md:text-3xl font-black font-mono tracking-tight ${
                                kpis.outAlerts > 0 ? 'text-red-400' : 'text-green-400'
                            }`}
                        >
                            {kpis.outAlerts}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                            {kpis.outAlerts === 0 ? 'All stocks non-negative' : 'Requires immediate attention'}
                        </div>
                    </div>
                </div>

                {/* --- FILTERS & COMMAND DECK --- */}
                <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xl">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search SKU or Product Name..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs md:text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                    </div>

                    {/* Type Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                        {['All', 'FG', 'Raw', 'WiP', 'Packaging'].map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(type)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                    typeFilter === type
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                                        : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                                }`}
                            >
                                {type === 'All'
                                    ? 'All Types'
                                    : type === 'FG'
                                    ? 'Finished Goods'
                                    : type === 'Raw'
                                    ? 'Raw Materials'
                                    : type}
                            </button>
                        ))}
                    </div>

                    {/* Health Filter */}
                    <div className="flex items-center gap-2">
                        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                            <button
                                onClick={() => setHealthFilter('all')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                                    healthFilter === 'all'
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setHealthFilter('low')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                                    healthFilter === 'low'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                Low Stock
                            </button>
                            <button
                                onClick={() => setHealthFilter('out')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                                    healthFilter === 'out'
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                Negative
                            </button>
                        </div>

                        {/* Location Columns Toggle Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowLocPicker(!showLocPicker)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
                                title="Select Visible Factory Columns"
                            >
                                <SlidersHorizontal size={14} />
                                <span className="hidden sm:inline">Columns ({visibleLocations.length})</span>
                            </button>

                            {showLocPicker && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-[#12121a] border border-white/15 rounded-2xl p-3 shadow-2xl z-30 space-y-1.5">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                                        Visible Warehouse Columns
                                    </div>
                                    {allLocations.map(loc => {
                                        const isChecked = visibleLocations.includes(loc);
                                        return (
                                            <label
                                                key={loc}
                                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-xs font-bold cursor-pointer text-gray-300 hover:text-white"
                                            >
                                                <span>{loc}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleLocation(loc)}
                                                    className="rounded border-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 bg-gray-900 cursor-pointer"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- PIVOT MATRIX TABLE --- */}
                <div className="bg-[#0d0d14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="border-b border-white/10 bg-black/40 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                                    <th
                                        onClick={() => handleSort('sku')}
                                        className="py-4 px-4 pl-6 cursor-pointer hover:text-white transition-colors"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            SKU Identity
                                            <ArrowUpDown size={12} className="opacity-60" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('name')}
                                        className="py-4 px-4 cursor-pointer hover:text-white transition-colors"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            Item Name
                                            <ArrowUpDown size={12} className="opacity-60" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('type')}
                                        className="py-4 px-3 cursor-pointer hover:text-white transition-colors"
                                    >
                                        Type
                                    </th>
                                    <th className="py-4 px-3">UOM</th>

                                    {/* Factory Columns */}
                                    {visibleLocations.map(loc => (
                                        <th
                                            key={loc}
                                            className="py-4 px-3 text-right font-mono tracking-tight text-gray-300"
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <Building2 size={12} className="text-cyan-400/80" />
                                                <span>{loc}</span>
                                            </div>
                                        </th>
                                    ))}

                                    {/* Total Column */}
                                    <th
                                        onClick={() => handleSort('totalStock')}
                                        className="py-4 px-4 text-right cursor-pointer hover:text-white bg-cyan-950/20 text-cyan-300 font-black border-l border-white/5"
                                    >
                                        <div className="flex items-center justify-end gap-1.5">
                                            Global Total
                                            <ArrowUpDown size={12} className="opacity-60" />
                                        </div>
                                    </th>

                                    {/* Status */}
                                    <th className="py-4 px-4 pr-6 text-center">Health</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs font-medium">
                                {loading && matrixRows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={visibleLocations.length + 6}
                                            className="py-24 text-center text-gray-500"
                                        >
                                            <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto mb-3" />
                                            Loading Global Inventory Matrix...
                                        </td>
                                    </tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={visibleLocations.length + 6}
                                            className="py-24 text-center text-gray-500"
                                        >
                                            No matching items found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map(row => {
                                        const badgeStyle =
                                            TYPE_BADGE_STYLE[row.type] ||
                                            'bg-gray-500/10 text-gray-400 border-gray-500/30';

                                        return (
                                            <tr
                                                key={row.sku}
                                                className="hover:bg-white/[0.03] transition-colors group"
                                            >
                                                {/* SKU */}
                                                <td className="py-3.5 px-4 pl-6 font-mono font-bold text-white tracking-tight">
                                                    {row.sku}
                                                </td>

                                                {/* Name */}
                                                <td className="py-3.5 px-4 text-gray-300 max-w-xs truncate" title={row.name}>
                                                    {row.name}
                                                </td>

                                                {/* Type */}
                                                <td className="py-3.5 px-3">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${badgeStyle}`}
                                                    >
                                                        {row.type}
                                                    </span>
                                                </td>

                                                {/* UOM */}
                                                <td className="py-3.5 px-3 text-gray-400 font-mono">
                                                    {row.uom}
                                                </td>

                                                {/* Factory Columns */}
                                                {visibleLocations.map(loc => {
                                                    const stock = row.factoryStocks[loc] || 0;
                                                    let cellStyle = 'text-gray-500';
                                                    if (stock > 0) cellStyle = 'text-gray-200 font-bold';
                                                    else if (stock < 0)
                                                        cellStyle = 'text-red-400 font-black bg-red-500/10 px-2 py-0.5 rounded';

                                                    return (
                                                        <td
                                                            key={loc}
                                                            className="py-3.5 px-3 text-right font-mono"
                                                        >
                                                            <span className={cellStyle}>
                                                                {stock.toLocaleString()}
                                                            </span>
                                                        </td>
                                                    );
                                                })}

                                                {/* Total Stock */}
                                                <td className="py-3.5 px-4 text-right font-mono font-black text-sm bg-cyan-950/10 border-l border-white/5">
                                                    <span
                                                        className={
                                                            row.totalStock < 0
                                                                ? 'text-red-400'
                                                                : row.totalStock === 0
                                                                ? 'text-gray-500'
                                                                : 'text-cyan-300'
                                                        }
                                                    >
                                                        {row.totalStock.toLocaleString()}
                                                    </span>
                                                </td>

                                                {/* Status / Health */}
                                                <td className="py-3.5 px-4 pr-6 text-center">
                                                    {row.status === 'out_of_stock' ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                                            <AlertTriangle size={10} /> Out / Neg
                                                        </span>
                                                    ) : row.status === 'low' ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                                            <AlertTriangle size={10} /> Low Stock
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                                                            <CheckCircle2 size={10} /> OK
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer */}
                    <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
                        <div>
                            Showing <span className="text-white font-bold">{filteredRows.length}</span> of{' '}
                            <span className="text-white font-bold">{matrixRows.length}</span> items
                        </div>
                        <div className="text-[11px] text-gray-600">
                            💡 Physical inventory aggregated from <code className="text-gray-400">stock_ledger_v2</code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Inventory;
