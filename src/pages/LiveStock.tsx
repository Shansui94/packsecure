import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Search, RefreshCw, Box, Filter } from 'lucide-react';
import { WAREHOUSES } from '../data/factoryData';

// --- TYPES ---
interface StockRow {
    sku: string;
    name: string;
    type: string;
    uom: string;
    loc_id?: string;
    current_stock: number;
    last_updated: string;
}

const TYPE_COLOR: Record<string, string> = {
    FG: 'from-cyan-500/10 to-cyan-500/0 border-cyan-500/20 text-cyan-400',
    Raw: 'from-amber-500/10 to-amber-500/0 border-amber-500/20 text-amber-400',
    WiP: 'from-violet-500/10 to-violet-500/0 border-violet-500/20 text-violet-400',
    Packaging: 'from-pink-500/10 to-pink-500/0 border-pink-500/20 text-pink-400',
};

const TYPE_LABEL: Record<string, string> = {
    FG: 'FG', Raw: 'Raw Material', WiP: 'Work in Progress', Packaging: 'Packaging',
};

const LOW_STOCK_THRESHOLD = 50;

const LiveStock: React.FC = () => {
    const [rows, setRows] = useState<StockRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('All');
    const [locationFilter, setLocationFilter] = useState<string>('All');

    const fetchStock = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('v2_inventory_view')
                .select('sku, name, type, uom, loc_id, current_stock, last_updated')
                .ilike('sku', 'BW-%')
                .order('sku', { ascending: true });

            if (error) throw error;
            setRows(data || []);
            setLastUpdated(new Date().toLocaleTimeString('en-GB'));
        } catch (err) {
            console.error('LiveStock fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
        const interval = setInterval(fetchStock, 30000);
        return () => clearInterval(interval);
    }, []);

    // Derived
    const allTypes = useMemo(() => {
        const t = [...new Set(rows.map(r => r.type).filter(Boolean))];
        return t.sort();
    }, [rows]);

    const filtered = useMemo(() => {
        const preFiltered = rows.filter(r => {
            const matchType = typeFilter === 'All' || r.type === typeFilter;
            const matchSearch = !search ||
                r.sku.toLowerCase().includes(search.toLowerCase()) ||
                r.name.toLowerCase().includes(search.toLowerCase());
            return matchType && matchSearch;
        });

        if (locationFilter === 'All') {
            const map = new Map<string, StockRow>();
            preFiltered.forEach(r => {
                if (map.has(r.sku)) {
                    const existing = map.get(r.sku)!;
                    existing.current_stock += (r.current_stock || 0);
                    if (new Date(r.last_updated) > new Date(existing.last_updated)) existing.last_updated = r.last_updated;
                } else {
                    map.set(r.sku, { ...r });
                }
            });
            return Array.from(map.values()).sort((a, b) => a.sku.localeCompare(b.sku));
        } else {
            return preFiltered.filter(r => r.loc_id === locationFilter).sort((a, b) => a.sku.localeCompare(b.sku));
        }
    }, [rows, typeFilter, search, locationFilter]);

    const totalItems = filtered.length;
    const totalQty = filtered.reduce((sum, r) => sum + (r.current_stock || 0), 0);
    const lowStockCount = filtered.filter(r => r.current_stock < LOW_STOCK_THRESHOLD).length;
    const negativeCount = filtered.filter(r => r.current_stock < 0).length;

    const getStockColor = (qty: number) => {
        if (qty < 0) return 'text-red-500';
        if (qty < LOW_STOCK_THRESHOLD) return 'text-amber-400';
        return 'text-white';
    };

    const getStockBadge = (qty: number) => {
        if (qty < 0) return { label: 'NEGATIVE', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
        if (qty < LOW_STOCK_THRESHOLD) return { label: 'LOW STOCK', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
        return { label: 'IN STOCK', cls: 'bg-green-500/15 text-green-400 border-green-500/30' };
    };

    return (
        <div className="min-h-screen bg-[#0a0a0e] text-white p-4 md:p-8 pb-24">
            <div className="max-w-7xl mx-auto">

                {/* ── Header ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 mb-1">
                            LIVE STOCK
                        </h1>
                        <p className="text-gray-500 text-xs font-mono flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                            LIVE · REFRESHED: {lastUpdated || '—'}
                        </p>
                    </div>

                    {/* Stat Pills */}
                    <div className="flex gap-3 flex-wrap">
                        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-w-[100px]">
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">SKUs</div>
                            <div className="text-xl font-black">{totalItems}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-w-[100px]">
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Total Units</div>
                            <div className="text-xl font-black">{totalQty.toLocaleString()}</div>
                        </div>
                        {lowStockCount > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 min-w-[100px]">
                                <div className="text-[10px] text-amber-400 font-bold uppercase mb-0.5">Low Stock</div>
                                <div className="text-xl font-black text-amber-400">{lowStockCount}</div>
                            </div>
                        )}
                        {negativeCount > 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 min-w-[100px]">
                                <div className="text-[10px] text-red-400 font-bold uppercase mb-0.5">Negative</div>
                                <div className="text-xl font-black text-red-400">{negativeCount}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Controls ── */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search SKU or name..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500/50 text-white placeholder-gray-600"
                        />
                    </div>

                    {/* Type Filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter size={14} className="text-gray-500" />
                        {['All', ...allTypes].map(t => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all ${typeFilter === t
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'
                                    }`}
                            >
                                {t === 'All' ? 'All Types' : (TYPE_LABEL[t] || t)}
                            </button>
                        ))}
                    </div>

                    {/* Location Filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Location:</span>
                        {['All', ...WAREHOUSES].map(w => (
                            <button
                                key={w}
                                onClick={() => setLocationFilter(w)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all ${locationFilter === w
                                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                    : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'
                                    }`}
                            >
                                {w}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={fetchStock}
                        className="px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center transition-colors"
                    >
                        <RefreshCw size={16} className={`text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* ── Grid ── */}
                {loading && rows.length === 0 ? (
                    <div className="flex justify-center py-24">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-24 text-gray-600 border border-dashed border-white/5 rounded-2xl">
                        <Box size={40} className="mx-auto mb-3 opacity-20" />
                        <p>No items found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.map(item => {
                            const badge = getStockBadge(item.current_stock);
                            const typeStyle = TYPE_COLOR[item.type] || 'from-white/5 to-white/0 border-white/10 text-gray-400';
                            return (
                                <div
                                    key={item.sku}
                                    className={`relative bg-gradient-to-br ${typeStyle} border rounded-2xl p-5 hover:scale-[1.01] transition-transform`}
                                >
                                    {/* Type tag */}
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full border ${typeStyle} bg-black/30`}>
                                            {item.type}
                                        </span>
                                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badge.cls}`}>
                                            {badge.label}
                                        </span>
                                    </div>

                                    {/* SKU + Name */}
                                    <div className="mb-5">
                                        <div className="font-black text-white text-sm tracking-tight leading-tight mb-0.5">{item.sku}</div>
                                        <div className="text-[11px] text-gray-500 truncate" title={item.name}>{item.name}</div>
                                    </div>

                                    {/* Stock Number */}
                                    <div className="border-t border-white/5 pt-3 flex items-end justify-between">
                                        <div className="text-[10px] text-gray-500 font-mono uppercase">
                                            {item.uom || 'unit'}
                                        </div>
                                        <div className={`text-3xl font-black tracking-tighter ${getStockColor(item.current_stock)}`}>
                                            {Number(item.current_stock).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveStock;
