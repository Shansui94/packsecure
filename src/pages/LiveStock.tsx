import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Search, RefreshCw, Box, Filter, X, TrendingUp, TrendingDown, Package, Clipboard, ArrowUpDown } from 'lucide-react';
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

interface LedgerRow {
    txn_id: string;
    sku: string;
    change_qty: number;
    event_type: string;
    loc_id: string;
    ref_doc: string;
    notes: string;
    timestamp: string;
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

const EVENT_STYLE: Record<string, { icon: React.FC<any>; color: string; bg: string }> = {
    'Production': { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    'Stock In': { icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    'Stock Out': { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
    'Audit Adjustment': { icon: Clipboard, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    'Transfer': { icon: ArrowUpDown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

const getEventStyle = (type: string, qty: number) => {
    if (EVENT_STYLE[type]) return EVENT_STYLE[type];
    return qty >= 0
        ? { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' }
        : { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' };
};

const LOW_STOCK_THRESHOLD = 50;

// --- DETAIL PANEL ---
const DetailPanel: React.FC<{ item: StockRow; locFilter: string; onClose: () => void }> = ({ item, locFilter, onClose }) => {
    const [ledger, setLedger] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        let q = supabase
            .from('stock_ledger_v2')
            .select('txn_id, sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp')
            .eq('sku', item.sku)
            .order('timestamp', { ascending: false })
            .limit(50);

        if (locFilter !== 'All') q = q.eq('loc_id', locFilter);

        q.then(({ data }) => {
            setLedger(data || []);
            setLoading(false);
        });
    }, [item.sku, locFilter]);

    const totalIn = ledger.filter(r => r.change_qty > 0).reduce((s, r) => s + r.change_qty, 0);
    const totalOut = ledger.filter(r => r.change_qty < 0).reduce((s, r) => s + r.change_qty, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-[#0a0a0f] border-l border-white/10 flex flex-col overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-start justify-between shrink-0">
                    <div className="flex-1 min-w-0 pr-3">
                        <div className="text-white font-black text-base leading-tight truncate" title={item.name}>{item.name}</div>
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">{item.sku}</div>
                        {locFilter !== 'All' && (
                            <div className="text-[10px] text-violet-400 font-mono mt-1 uppercase tracking-widest">📍 {locFilter}</div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all shrink-0">
                        <X size={16} />
                    </button>
                </div>

                {/* Summary Strip */}
                <div className="grid grid-cols-3 border-b border-white/5 shrink-0">
                    <div className="px-4 py-3 border-r border-white/5 text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Stock</div>
                        <div className={`text-xl font-black ${item.current_stock < 0 ? 'text-red-400' : item.current_stock < LOW_STOCK_THRESHOLD ? 'text-amber-400' : 'text-white'}`}>
                            {Number(item.current_stock).toLocaleString()}
                        </div>
                    </div>
                    <div className="px-4 py-3 border-r border-white/5 text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">In</div>
                        <div className="text-xl font-black text-green-400">+{totalIn.toLocaleString()}</div>
                    </div>
                    <div className="px-4 py-3 text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Out</div>
                        <div className="text-xl font-black text-red-400">{totalOut.toLocaleString()}</div>
                    </div>
                </div>

                {/* Ledger */}
                <div className="px-5 py-3 border-b border-white/5 shrink-0">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Recent Movements (last 50)</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                        </div>
                    ) : ledger.length === 0 ? (
                        <div className="text-center py-16 text-gray-600">
                            <Package size={32} className="mx-auto mb-2 opacity-30" />
                            <div className="text-sm">No movements found</div>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {ledger.map(row => {
                                const style = getEventStyle(row.event_type, row.change_qty);
                                const Icon = style.icon;
                                const isPos = row.change_qty > 0;
                                return (
                                    <div key={row.txn_id} className="px-5 py-3 flex items-start gap-3 hover:bg-white/[0.02]">
                                        <div className={`mt-0.5 w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center shrink-0`}>
                                            <Icon size={13} className={style.color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <span className={`text-xs font-bold ${style.color}`}>{row.event_type}</span>
                                                <span className={`text-sm font-black tabular-nums shrink-0 ${isPos ? 'text-green-400' : 'text-red-400'}`}>
                                                    {isPos ? '+' : ''}{row.change_qty}
                                                </span>
                                            </div>
                                            {row.loc_id && locFilter === 'All' && (
                                                <div className="text-[10px] text-gray-500 mt-0.5">📍 {row.loc_id}</div>
                                            )}
                                            {row.ref_doc && (
                                                <div className="text-[10px] text-gray-600 font-mono mt-0.5 truncate">{row.ref_doc}</div>
                                            )}
                                            {row.notes && (
                                                <div className="text-[10px] text-gray-700 mt-0.5 truncate" title={row.notes}>{row.notes}</div>
                                            )}
                                            <div className="text-[10px] text-gray-600 mt-0.5 font-mono">
                                                {new Date(row.timestamp).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN ---
const LiveStock: React.FC = () => {
    const [rows, setRows] = useState<StockRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('All');
    const [locationFilter, setLocationFilter] = useState<string>('All');
    const [selectedItem, setSelectedItem] = useState<StockRow | null>(null);

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
                                <button
                                    key={item.sku}
                                    onClick={() => setSelectedItem(item)}
                                    className={`relative bg-gradient-to-br ${typeStyle} border rounded-2xl p-5 hover:scale-[1.02] hover:brightness-110 active:scale-[0.99] transition-all text-left cursor-pointer w-full`}
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
                                        <div className="font-black text-white text-base tracking-tight leading-tight mb-0.5 truncate" title={item.name}>{item.name}</div>
                                        <div className="text-[11px] text-gray-400 truncate font-mono" title={item.sku}>{item.sku}</div>
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
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Detail Panel */}
            {selectedItem && (
                <DetailPanel
                    item={selectedItem}
                    locFilter={locationFilter}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
};

export default LiveStock;
