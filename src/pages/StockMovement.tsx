import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { V2Item } from '../types/v2';
import { ArrowDownCircle, ArrowUpCircle, ClipboardList, Search, Check, AlertCircle } from 'lucide-react';

type Mode = 'in' | 'out';

interface LedgerRow {
    txn_id: string;
    sku: string;
    timestamp: string;
    txn_type: string;
    change_qty: number;
    ref_doc?: string;
    notes?: string;
}

const StockMovement: React.FC = () => {
    const [mode, setMode] = useState<Mode>('in');
    const [items, setItems] = useState<V2Item[]>([]);
    const [ledger, setLedger] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    // Form state
    const [skuSearch, setSkuSearch] = useState('');
    const [selectedSku, setSelectedSku] = useState<V2Item | null>(null);
    const [qty, setQty] = useState('');
    const [refDoc, setRefDoc] = useState('');
    const [notes, setNotes] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load items + ledger
    useEffect(() => {
        getV2Items().then(setItems);
        fetchLedger();
    }, []);

    const fetchLedger = async () => {
        const { data } = await supabase
            .from('stock_ledger_v2')
            .select('txn_id, sku, timestamp, txn_type, change_qty, ref_doc, notes')
            .in('txn_type', ['Stock In', 'Stock Out'])
            .order('timestamp', { ascending: false })
            .limit(50);
        setLedger(data || []);
    };

    // SKU autocomplete filter
    const filteredItems = items.filter(i =>
        !skuSearch ||
        i.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
        i.name.toLowerCase().includes(skuSearch.toLowerCase())
    ).slice(0, 10);

    const selectSku = (item: V2Item) => {
        setSelectedSku(item);
        setSkuSearch(item.sku);
        setShowDropdown(false);
    };

    const showToast = (msg: string, type: 'ok' | 'err') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSku) return showToast('Please select a SKU', 'err');
        const numQty = parseInt(qty);
        if (!numQty || numQty <= 0) return showToast('Enter a valid quantity', 'err');

        setLoading(true);
        try {
            const change = mode === 'in' ? numQty : -numQty;
            const txnType = mode === 'in' ? 'Stock In' : 'Stock Out';

            const { error } = await supabase.from('stock_ledger_v2').insert({
                sku: selectedSku.sku,
                change_qty: change,
                txn_type: txnType,
                ref_doc: refDoc || null,
                notes: notes || null,
            });

            if (error) throw error;

            showToast(`${txnType} recorded: ${selectedSku.sku} × ${numQty}`, 'ok');
            // Reset form
            setSelectedSku(null);
            setSkuSearch('');
            setQty('');
            setRefDoc('');
            setNotes('');
            fetchLedger();
        } catch (err: any) {
            showToast('Error: ' + err.message, 'err');
        } finally {
            setLoading(false);
        }
    };

    const isIn = mode === 'in';

    return (
        <div className="min-h-screen bg-[#0a0a0e] text-white p-4 md:p-8 pb-24">
            <div className="max-w-5xl mx-auto">

                {/* Toast */}
                {toast && (
                    <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold border transition-all ${toast.type === 'ok'
                            ? 'bg-green-950 border-green-500/40 text-green-300'
                            : 'bg-red-950 border-red-500/40 text-red-300'
                        }`}>
                        {toast.type === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
                        {toast.msg}
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black tracking-tighter text-white mb-1">Stock Movement</h1>
                    <p className="text-gray-500 text-sm">Manually record stock in and stock out transactions</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* ── LEFT: Form ── */}
                    <div className="lg:col-span-2">
                        {/* Mode Toggle */}
                        <div className="flex rounded-2xl overflow-hidden border border-white/10 mb-6">
                            <button
                                onClick={() => setMode('in')}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm uppercase tracking-wider transition-all ${isIn
                                        ? 'bg-green-600/20 text-green-400 border-r border-green-500/20'
                                        : 'bg-transparent text-gray-500 hover:text-gray-300 border-r border-white/5'
                                    }`}
                            >
                                <ArrowDownCircle size={18} /> Stock In
                            </button>
                            <button
                                onClick={() => setMode('out')}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm uppercase tracking-wider transition-all ${!isIn
                                        ? 'bg-red-600/20 text-red-400'
                                        : 'bg-transparent text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <ArrowUpCircle size={18} /> Stock Out
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="bg-white/3 border border-white/8 rounded-2xl p-6 space-y-4">

                            {/* SKU Search */}
                            <div className="relative" ref={dropdownRef}>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">SKU / Item</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                                    <input
                                        type="text"
                                        value={skuSearch}
                                        onChange={e => { setSkuSearch(e.target.value); setSelectedSku(null); setShowDropdown(true); }}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder="Search SKU or name..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 text-white placeholder-gray-600"
                                    />
                                </div>
                                {showDropdown && skuSearch && filteredItems.length > 0 && (
                                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-[#141418] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-52 overflow-y-auto">
                                        {filteredItems.map(item => (
                                            <button
                                                key={item.sku}
                                                type="button"
                                                onClick={() => selectSku(item)}
                                                className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex justify-between items-center gap-2 border-b border-white/5 last:border-0"
                                            >
                                                <div>
                                                    <div className="font-bold text-white">{item.sku}</div>
                                                    <div className="text-xs text-gray-500">{item.name}</div>
                                                </div>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 shrink-0">{item.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected SKU badge */}
                            {selectedSku && (
                                <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-2.5">
                                    <Check size={14} className="text-cyan-400" />
                                    <span className="text-sm text-cyan-300 font-bold">{selectedSku.sku}</span>
                                    <span className="text-xs text-gray-500">— {selectedSku.name}</span>
                                </div>
                            )}

                            {/* Quantity */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={qty}
                                    onChange={e => setQty(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-mono font-bold focus:outline-none focus:border-cyan-500/50 text-white placeholder-gray-600"
                                />
                            </div>

                            {/* Ref Doc */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reference Doc <span className="font-normal text-gray-600">(optional)</span></label>
                                <input
                                    type="text"
                                    value={refDoc}
                                    onChange={e => setRefDoc(e.target.value)}
                                    placeholder="e.g. PO-2026-001 or DO-001"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 text-white placeholder-gray-600"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Notes <span className="font-normal text-gray-600">(optional)</span></label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Reason, supplier, batch no..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 text-white placeholder-gray-600 resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${isIn
                                        ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30'
                                        : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30'
                                    } disabled:opacity-50`}
                            >
                                {loading ? 'Recording...' : isIn ? '▼ Record Stock In' : '▲ Record Stock Out'}
                            </button>
                        </form>
                    </div>

                    {/* ── RIGHT: History ── */}
                    <div className="lg:col-span-3">
                        <div className="flex items-center gap-2 mb-4">
                            <ClipboardList size={16} className="text-gray-500" />
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Recent Transactions</h2>
                        </div>

                        <div className="space-y-2">
                            {ledger.length === 0 ? (
                                <div className="text-center py-16 text-gray-600 border border-dashed border-white/5 rounded-2xl">
                                    No manual stock movements yet.
                                </div>
                            ) : ledger.map(row => {
                                const isPositive = row.change_qty > 0;
                                return (
                                    <div key={row.txn_id} className="bg-white/3 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPositive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                                            }`}>
                                            {isPositive ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-white truncate">{row.sku}</span>
                                                {row.ref_doc && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 font-mono shrink-0">{row.ref_doc}</span>
                                                )}
                                            </div>
                                            {row.notes && <p className="text-xs text-gray-500 truncate mt-0.5">{row.notes}</p>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={`text-lg font-black ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                {isPositive ? '+' : ''}{row.change_qty.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-gray-600 font-mono">
                                                {new Date(row.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockMovement;
