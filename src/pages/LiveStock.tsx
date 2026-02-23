
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Search, RefreshCw, Package, Layers, Box } from 'lucide-react';

// Types
interface StockItem {
    id?: string; // Optional or removed
    sku: string;
    name: string;
    current_stock: number;
    reserved_stock?: number;
    layer?: string;
    material?: string;
    size?: string;
}

const LiveStock: React.FC = () => {
    const [items, setItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastUpdated, setLastUpdated] = useState<string>('');

    // Fetch Data
    const fetchStock = async () => {
        setLoading(true);
        try {
            console.log("Fetching Live Stock via RPC...");
            // Use RPC to bypass RLS policies on 'items' table
            const { data, error } = await supabase.rpc('get_live_stock_viewer');

            if (error) throw error;

            console.log("Stock Items Fetched:", data?.length);

            const parsedItems: StockItem[] = (data || []).map((item: any) => {
                // Parse SKU: BW-2L-CLR-50CM
                const parts = item.sku?.split('-') || [];
                return {
                    id: item.sku, // Use SKU as ID
                    sku: item.sku,
                    name: item.name,
                    current_stock: Number(item.current_stock) || 0,
                    reserved_stock: Number(item.reserved_stock) || 0,
                    // Auto-detect attributes
                    layer: parts.length > 1 ? parts[1] : undefined,
                    material: parts.length > 2 ? parts[2] : undefined,
                    size: parts.length > 3 ? parts[3] : undefined,
                };
            });

            setItems(parsedItems);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err) {
            console.error("Error loading stock:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
        const interval = setInterval(fetchStock, 30000); // 30s Auto Refresh
        return () => clearInterval(interval);
    }, []);

    // Helper for Filters
    const filteredItems = items.filter(item =>
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Stats
    const totalQty = filteredItems.reduce((acc, i) => acc + i.current_stock, 0);
    const lowStockCount = filteredItems.filter(i => i.current_stock < 100).length;

    return (
        <div className="min-h-screen bg-[#0f1014] text-white p-4 md:p-8 pb-24">

            {/* Header / Stats Bar */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
                            LIVE STOCK MONITOR
                        </h1>
                        <p className="text-gray-400 text-sm font-mono flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            SYSTEM OPERATIONAL • LAST UPDATED: {lastUpdated}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-xl min-w-[140px]">
                            <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Items</div>
                            <div className="text-2xl font-black text-white">{totalQty.toLocaleString()}</div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl min-w-[140px]">
                            <div className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">Low Stock</div>
                            <div className="text-2xl font-black text-red-500">{lowStockCount}</div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-3 mb-8">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search SKU or Name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors text-white placeholder-gray-600"
                        />
                    </div>
                    <button
                        onClick={fetchStock}
                        className="px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-colors"
                    >
                        <RefreshCw size={18} className={`text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* GRID VIEW */}
                {loading && items.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredItems.map(item => (
                            <div key={item.id} className="relative group bg-gray-900/80 hover:bg-gray-800 border border-white/10 rounded-2xl p-5 hover:border-cyan-500/50 transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] overflow-hidden">

                                {/* Background Glow on Hover */}
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/5 group-hover:to-purple-500/5 transition-all duration-500 opacity-0 group-hover:opacity-100"></div>

                                <div className="relative z-10">
                                    {/* Top Row: SKU & Icon */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-black/40 rounded-lg border border-white/5">
                                            <Package size={20} className="text-cyan-400" />
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-bold border ${item.current_stock < 100 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'
                                            }`}>
                                            {item.current_stock < 100 ? 'LOW STOCK' : 'IN STOCK'}
                                        </div>
                                    </div>

                                    {/* SKU Name */}
                                    <h3 className="text-lg font-bold text-white mb-1 tracking-tight">{item.sku}</h3>
                                    <p className="text-xs text-gray-500 mb-6 truncate">{item.name}</p>

                                    {/* Attributes Tags */}
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {item.layer && (
                                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                                                <Layers size={10} /> {item.layer}
                                            </span>
                                        )}
                                        {item.material && (
                                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 bg-pink-500/10 text-pink-400 rounded border border-pink-500/20">
                                                {item.material}
                                            </span>
                                        )}
                                        {item.size && (
                                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                                                {item.size}
                                            </span>
                                        )}
                                    </div>

                                    {/* Quantity - BIG */}
                                    <div className="pt-4 border-t border-white/5 flex items-end justify-between">
                                        <div className="flex flex-col">
                                            <div className="text-xs text-gray-500 font-mono">AVAILABLE</div>
                                            {(item.reserved_stock || 0) > 0 && (
                                                <div className="text-[10px] text-yellow-500/80 font-mono mt-0.5" title="Reserved for Pending Orders">
                                                    (Rsrv: {item.reserved_stock})
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-3xl font-black text-white tracking-tighter">
                                            {item.current_stock.toLocaleString()}
                                            <span className="text-sm font-medium text-gray-600 ml-1">unit</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filteredItems.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                        <Box size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No items found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveStock;
