import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { V2Item } from '../types/v2';
import { WAREHOUSES } from '../data/factoryData';
import { ArrowDownCircle, ArrowUpCircle, ClipboardList, Search, Check, AlertCircle, Plus, Minus, X, ShoppingCart } from 'lucide-react';

type Mode = 'in' | 'out';

interface LedgerRow {
    txn_id: string;
    sku: string;
    timestamp: string;
    event_type: string;
    change_qty: number;
    ref_doc?: string;
    notes?: string;
    created_by_name?: string;
}

interface CartItem extends V2Item {
    qty: number;
}

const StockMovement: React.FC<{ user?: any }> = ({ user }) => {
    const [mode, setMode] = useState<Mode>('in');
    const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
    const [items, setItems] = useState<V2Item[]>([]);
    const [ledger, setLedger] = useState<LedgerRow[]>([]);
    const [myHistory, setMyHistory] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    // Form state
    const [skuSearch, setSkuSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [refDoc, setRefDoc] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Load items + ledger
    useEffect(() => {
        getV2Items().then(setItems);
        fetchLedger();

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchLedger = async () => {
        const { data } = await supabase
            .from('stock_ledger_v2')
            .select('txn_id, sku, timestamp, event_type, change_qty, ref_doc, notes, created_by_name')
            .in('event_type', ['Stock In', 'Stock Out'])
            .order('timestamp', { ascending: false })
            .limit(80);
        setLedger(data || []);

        // My history: only current user's stock outs
        if (user?.uid) {
            const { data: mine } = await supabase
                .from('stock_ledger_v2')
                .select('txn_id, sku, timestamp, event_type, change_qty, ref_doc, notes, created_by_name')
                .eq('created_by', user.uid)
                .order('timestamp', { ascending: false })
                .limit(100);
            setMyHistory(mine || []);
        }
    };

    // SKU autocomplete filter
    const filteredItems = items.filter(i =>
        !skuSearch ||
        i.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
        i.name.toLowerCase().includes(skuSearch.toLowerCase())
    ).slice(0, 10);

    const addToCart = (item: V2Item) => {
        const existing = cart.find(c => c.sku === item.sku);
        if (existing) {
            setCart(cart.map(c => c.sku === item.sku ? { ...c, qty: c.qty + 1 } : c));
        } else {
            setCart([{ ...item, qty: 1 }, ...cart]);
        }
        setSkuSearch('');
        setShowDropdown(false);
        searchInputRef.current?.focus();
    };

    const updateCartQty = (sku: string, delta: number) => {
        setCart(cart.map(c => {
            if (c.sku === sku) {
                const newQty = Math.max(0, c.qty + delta);
                return { ...c, qty: newQty };
            }
            return c;
        }));
    };

    const setManualQty = (sku: string, value: string) => {
        if (value === '') {
            setCart(cart.map(c => c.sku === sku ? { ...c, qty: 0 } : c));
            return;
        }
        const num = parseInt(value);
        if (!isNaN(num) && num >= 0) {
            setCart(cart.map(c => c.sku === sku ? { ...c, qty: num } : c));
        }
    };

    const removeFromCart = (sku: string) => {
        setCart(cart.filter(c => c.sku !== sku));
    };

    const showToast = (msg: string, type: 'ok' | 'err') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validItems = cart.filter(item => item.qty > 0);
        if (validItems.length === 0) return showToast('No items with a valid quantity to submit.', 'err');
        if (!selectedLocation) return showToast('Please select a warehouse location.', 'err');

        setLoading(true);
        try {
            const txnType = mode === 'in' ? 'Stock In' : 'Stock Out';
            const multiplier = mode === 'in' ? 1 : -1;

            const inserts = validItems.map(item => ({
                sku: item.sku,
                change_qty: item.qty * multiplier,
                event_type: txnType,
                loc_id: selectedLocation,
                ref_doc: refDoc || null,
                notes: notes || null,
                created_by: user?.uid || null,
                created_by_name: user?.name || null,
            }));

            const { error } = await supabase.from('stock_ledger_v2').insert(inserts);

            if (error) throw error;

            showToast(`${txnType} recorded for ${validItems.length} items!`, 'ok');

            setCart([]);
            setSkuSearch('');
            setRefDoc('');
            setNotes('');
            // We intentionally do NOT reset selectedLocation for user convenience
            fetchLedger();
        } catch (err: any) {
            showToast('Error: ' + err.message, 'err');
        } finally {
            setLoading(false);
        }
    };

    const isIn = mode === 'in';
    const borderClass = isIn ? 'border-green-500/30' : 'border-orange-500/30';
    const textClass = isIn ? 'text-green-400' : 'text-orange-400';
    const bgClass = isIn ? 'bg-green-500/10' : 'bg-orange-500/10';

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 pb-24 font-sans">
            <div className="max-w-7xl mx-auto">

                {/* Toast */}
                {toast && (
                    <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold border transition-all ${toast.type === 'ok'
                        ? 'bg-green-950/90 border-green-500/50 text-green-300 backdrop-blur-md'
                        : 'bg-red-950/90 border-red-500/50 text-red-300 backdrop-blur-md'
                        }`}>
                        {toast.type === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
                        {toast.msg}
                    </div>
                )}

                {/* Header */}
                <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white mb-1 md:mb-2 flex items-center gap-2 md:gap-3">
                            <ShoppingCart className={textClass} size={28} />
                            Stock Movement
                        </h1>
                        <p className="text-gray-500 text-xs md:text-sm">Batch process multi-SKU inward and outward movements.</p>
                    </div>
                    {/* Mode Toggle */}
                    <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 shadow-xl w-full md:w-auto">
                        <button
                            onClick={() => setMode('in')}
                            className={`flex flex-1 md:flex-none justify-center items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wider transition-all ${isIn
                                ? 'bg-green-600/20 text-green-400 border border-green-500/30 shadow-lg shadow-green-900/20'
                                : 'text-gray-500 hover:text-gray-300 border border-transparent'
                                }`}
                        >
                            <ArrowDownCircle size={16} /> INWARD
                        </button>
                        <button
                            onClick={() => setMode('out')}
                            className={`flex flex-1 md:flex-none justify-center items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wider transition-all ${!isIn
                                ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-900/20'
                                : 'text-gray-500 hover:text-gray-300 border border-transparent'
                                }`}
                        >
                            <ArrowUpCircle size={16} /> OUTWARD
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* ── LEFT: Staging Cart (8 cols) ── */}
                    <div className="lg:col-span-8 flex flex-col gap-6">

                        {/* Search Bar */}
                        <div className="relative" ref={dropdownRef}>
                            <div className={`relative flex items-center bg-[#0d0d12] border ${cart.length === 0 ? borderClass : 'border-white/10'} rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 focus-within:border-white/30 focus-within:shadow-white/5`}>
                                <div className={`pl-5 ${textClass}`}>
                                    <Search size={20} />
                                </div>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={skuSearch}
                                    onChange={e => { setSkuSearch(e.target.value); setShowDropdown(true); }}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder="Scan barcode or type SKU / Item Name to add to list..."
                                    className="w-full bg-transparent border-none py-5 pl-4 pr-6 text-base font-medium focus:outline-none text-white placeholder-gray-600"
                                />
                                <div className="pr-5 hidden md:flex items-center">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-600 border border-gray-700/50 rounded px-2 py-1 bg-white/5">Auto-focus</div>
                                </div>
                            </div>

                            {/* Dropdown */}
                            {showDropdown && skuSearch && filteredItems.length > 0 && (
                                <div className="absolute z-30 top-full mt-2 left-0 right-0 bg-[#16161e] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-80 overflow-y-auto">
                                    {filteredItems.map(item => (
                                        <button
                                            key={item.sku}
                                            type="button"
                                            onClick={() => addToCart(item)}
                                            className="w-full text-left px-5 py-4 hover:bg-white/5 flex justify-between items-center gap-4 border-b border-white/5 last:border-0 transition-colors group"
                                        >
                                            <div>
                                                <div className="font-bold text-white text-base group-hover:text-cyan-400 transition-colors">{item.sku}</div>
                                                <div className="text-sm text-gray-500 mt-0.5">{item.name}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-gray-400 shrink-0 font-medium tracking-widest uppercase">{item.type}</span>
                                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
                                                    <Plus size={16} />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cart List */}
                        <div className={`flex-1 bg-[#0d0d12] border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-xl ${cart.length > 0 ? `ring-1 ring-inset ${isIn ? 'ring-green-500/10' : 'ring-orange-500/10'}` : ''}`}>
                            <div className={`px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20`}>
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <ClipboardList size={14} /> Staging List
                                </h2>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${bgClass} ${textClass}`}>
                                    {cart.length} ITEMS
                                </span>
                            </div>

                            <div className="flex-1 p-2">
                                {cart.length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-gray-600 gap-4">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                            <ShoppingCart size={24} className="opacity-50" />
                                        </div>
                                        <div className="text-sm font-medium">List is empty. Scan an item above.</div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {cart.map((item, index) => (
                                            <div key={`${item.sku}-${index}`} className="group flex flex-col sm:flex-row sm:items-center bg-white/5 hover:bg-white-[0.07] border border-transparent hover:border-white/10 rounded-xl p-3 sm:pr-4 gap-3 sm:gap-0 transition-all duration-200">

                                                {/* Top Row on Mobile / Left Side on Desktop */}
                                                <div className="flex items-center justify-between w-full sm:w-auto sm:flex-1 min-w-0 pr-0 sm:pr-6">
                                                    <div className="flex items-center min-w-0 flex-1">
                                                        {/* Number */}
                                                        <div className="w-8 shrink-0 text-center text-[10px] sm:text-xs font-mono text-gray-600 font-bold">
                                                            {(index + 1).toString().padStart(2, '0')}
                                                        </div>
                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0 pl-2">
                                                            <div className="font-bold text-white text-sm sm:text-base truncate">{item.sku}</div>
                                                            <div className="text-[10px] sm:text-xs text-gray-300 truncate mt-0.5">{item.name}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Mobile-only Remove (top right) */}
                                                    <button type="button" onClick={() => removeFromCart(item.sku)} className="sm:hidden w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 transition-colors ml-2">
                                                        <X size={16} />
                                                    </button>
                                                </div>

                                                {/* Bottom Row on Mobile / Right Side on Desktop */}
                                                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto pl-10 sm:pl-0">
                                                    {/* Qty Controls */}
                                                    <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5 sm:mr-4 ring-1 ring-inset ring-transparent focus-within:ring-white/20 transition-all">
                                                        <button type="button" onClick={() => updateCartQty(item.sku, -1)} className="w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                                            <Minus size={14} className="sm:hidden" />
                                                            <Minus size={16} className="hidden sm:block" />
                                                        </button>
                                                        <input
                                                            type="text"
                                                            value={item.qty}
                                                            onChange={(e) => setManualQty(item.sku, e.target.value)}
                                                            className="w-12 sm:w-14 text-center bg-transparent border-none text-base sm:text-lg font-black font-mono focus:outline-none text-white"
                                                        />
                                                        <button type="button" onClick={() => updateCartQty(item.sku, 1)} className="w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                                            <Plus size={14} className="sm:hidden" />
                                                            <Plus size={16} className="hidden sm:block" />
                                                        </button>
                                                    </div>

                                                    {/* Total Change visual */}
                                                    <div className={`text-right font-black font-mono text-base sm:text-lg ${textClass} sm:mr-6`}>
                                                        {isIn ? '+' : '-'}{item.qty}
                                                    </div>

                                                    {/* Desktop Remove */}
                                                    <button type="button" onClick={() => removeFromCart(item.sku)} className="hidden sm:flex w-8 h-8 shrink-0 flex items-center justify-center rounded-full hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors opacity-50 group-hover:opacity-100 ml-4 lg:ml-0">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* ── RIGHT: Meta & History (4 cols) ── */}
                    <div className="lg:col-span-4 flex flex-col gap-6">

                        {/* Transaction Meta Card */}
                        <form onSubmit={handleSubmit} className={`bg-[#0d0d12] border ${cart.length > 0 ? borderClass : 'border-white/5'} rounded-2xl p-6 flex flex-col gap-5 shadow-2xl relative overflow-hidden transition-all duration-500`}>

                            {/* Ambient Glow */}
                            <div className={`absolute -top-24 -right-24 w-48 h-48 ${bgClass} blur-3xl rounded-full opacity-50 pointer-events-none transition-all duration-500`} />

                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-white/5 pb-3">Transaction Details</h2>

                            {/* Location (Required) */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Location <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedLocation}
                                    onChange={(e) => setSelectedLocation(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 text-white transition-colors cursor-pointer appearance-none"
                                    required
                                >
                                    <option value="" disabled>Select Warehouse...</option>
                                    {WAREHOUSES.map(w => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Ref Doc */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Reference Document (Optional)</label>
                                <input
                                    type="text"
                                    value={refDoc}
                                    onChange={e => setRefDoc(e.target.value)}
                                    placeholder="e.g. PO-8890, DO-123"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 text-white placeholder-gray-700 transition-colors"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Internal Notes (Optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Remarks, supplier info, reason for adjustment..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 text-white placeholder-gray-700 resize-none transition-colors"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading || cart.length === 0}
                                className={`mt-2 w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all duration-300 ${cart.length === 0
                                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                    : isIn
                                        ? 'bg-green-600 hover:bg-green-500 text-white shadow-xl shadow-green-900/30 hover:shadow-green-900/50 hover:-translate-y-0.5'
                                        : 'bg-orange-600 hover:bg-orange-500 text-white shadow-xl shadow-orange-900/30 hover:shadow-orange-900/50 hover:-translate-y-0.5'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        PROCESSING...
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} />
                                        SUBMIT {cart.length} ITEMS
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Recent History */}
                        <div className="flex-1 bg-[#0d0d12] border border-white/5 rounded-2xl flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/5 bg-black/20 flex items-center gap-2">
                                {(['all', 'mine'] as const).map(t => (
                                    <button key={t} onClick={() => setActiveTab(t)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === t
                                            ? 'bg-white/10 text-white'
                                            : 'text-gray-600 hover:text-gray-400'}`}>
                                        {t === 'all' ? `All (${ledger.length})` : `My History (${myHistory.length})`}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[500px] p-2 custom-scrollbar">
                                {(() => {
                                    const rows = activeTab === 'mine' ? myHistory : ledger;
                                    if (rows.length === 0) return (
                                        <div className="text-center py-12 text-gray-600 text-sm">
                                            {activeTab === 'mine' ? 'No personal transactions yet' : 'No recent transactions'}
                                        </div>
                                    );
                                    return (
                                        <div className="space-y-1">
                                            {rows.map(row => {
                                                const isPositive = row.change_qty > 0;
                                                return (
                                                    <div key={row.txn_id} className="px-4 py-3 rounded-xl hover:bg-white/5 transition-colors flex items-start gap-3">
                                                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isPositive ? 'bg-green-500' : 'bg-orange-500'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start mb-0.5">
                                                                <span className="font-bold text-white text-sm truncate pr-2" title={row.sku}>{row.sku}</span>
                                                                <span className={`font-black font-mono text-sm shrink-0 ${isPositive ? 'text-green-400' : 'text-orange-400'}`}>
                                                                    {isPositive ? '+' : ''}{row.change_qty.toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-1 gap-2 flex-wrap">
                                                                <span className="text-[10px] text-gray-500 font-mono">
                                                                    {new Date(row.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(row.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                                    {row.created_by_name && <span className="text-blue-400/70"> · {row.created_by_name}</span>}
                                                                </span>
                                                                {row.ref_doc && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono truncate max-w-[100px]">{row.ref_doc}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockMovement;
