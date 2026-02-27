import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { V2Item } from '../types/v2';
import { ClipboardCheck, Search, Filter, Warehouse, CheckCircle2, ChevronRight, Calculator, Check, AlertCircle } from 'lucide-react';

import { WAREHOUSES } from '../data/factoryData';



interface AuditItem extends V2Item {
    systemQty: number;
    physicalQty: string;
}

// Removed local WAREHOUSES const, using imported one
const ITEM_TYPES = ['All', 'Raw', 'WiP', 'FG'];

const StockAudit: React.FC = () => {
    const [items, setItems] = useState<V2Item[]>([]);
    const [systemBalances, setSystemBalances] = useState<Record<string, Record<string, number>>>({});

    // Filters
    const [warehouse, setWarehouse] = useState(WAREHOUSES[0] || 'Main Location');
    const [itemType, setItemType] = useState('FG');
    const [search, setSearch] = useState('');

    // Audit Data
    const [auditList, setAuditList] = useState<AuditItem[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const [step, setStep] = useState<1 | 2>(1); // 1: Setup, 2: Counting

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const rawItems = await getV2Items();
            setItems(rawItems);

            // Calculate system quantities from inventory view
            const { data: viewData } = await supabase
                .from('v2_inventory_view')
                .select('sku, loc_id, current_stock');

            const balances: Record<string, Record<string, number>> = {};
            if (viewData) {
                viewData.forEach(row => {
                    if (!balances[row.sku]) balances[row.sku] = {};
                    balances[row.sku][row.loc_id || 'Unassigned'] = row.current_stock;
                });
            }
            setSystemBalances(balances);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg: string, type: 'ok' | 'err') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleStartAudit = () => {
        // Filter items based on ItemType requirement
        let filtered = items;
        if (itemType !== 'All') {
            filtered = filtered.filter(i => i.type === itemType);
        }

        // Map to AuditItem
        const initialAudit: AuditItem[] = filtered.map(item => {
            const skuBalances = systemBalances[item.sku] || {};
            return {
                ...item,
                systemQty: skuBalances[warehouse] || 0,
                physicalQty: '', // Empty initially so user must count
            };
        });

        // Sort alphabetically by SKU
        initialAudit.sort((a, b) => a.sku.localeCompare(b.sku));

        setAuditList(initialAudit);
        setStep(2);
        setSearch('');
    };

    const handlePhysicalQtyChange = (sku: string, val: string) => {
        setAuditList(prev => prev.map(item =>
            item.sku === sku ? { ...item, physicalQty: val } : item
        ));
    };

    const handlePostAudit = async () => {
        // Find all items with a typed physicalQty and a variance
        const adjustments = auditList
            .filter(item => item.physicalQty.trim() !== '')
            .map(item => {
                const physical = parseInt(item.physicalQty);
                if (isNaN(physical)) return null;
                const variance = physical - item.systemQty;
                return {
                    sku: item.sku,
                    physical,
                    variance,
                    systemQty: item.systemQty
                };
            })
            .filter(item => item !== null && item.variance !== 0);

        if (adjustments.length === 0) {
            return showToast('No variances found to post.', 'ok');
        }

        if (!confirm(`Are you sure you want to post ${adjustments.length} adjustment(s)?`)) return;

        setProcessing(true);
        try {
            const inserts = adjustments.map(adj => ({
                sku: adj?.sku,
                change_qty: adj?.variance,
                event_type: 'Audit Adjustment',
                loc_id: warehouse, // NEW: Apply to specific location
                ref_doc: `AUDIT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`,
                notes: `Auto-adjusted from Audit at [${warehouse}]. System: ${adj?.systemQty}, Actual: ${adj?.physical}`,
            }));

            const { error } = await supabase.from('stock_ledger_v2').insert(inserts);
            if (error) throw error;

            showToast(`Successfully posted ${adjustments.length} adjustment(s)!`, 'ok');

            // Go back to setup and reload Data
            setStep(1);
            loadData();
        } catch (error: any) {
            showToast('Error posting audit: ' + error.message, 'err');
        } finally {
            setProcessing(false);
        }
    };

    // Filter audit list by search during counting
    const visibleAuditList = auditList.filter(item =>
        search === '' ||
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        item.name.toLowerCase().includes(search.toLowerCase())
    );

    const countedItemsCount = auditList.filter(a => a.physicalQty.trim() !== '').length;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#07070a] flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-cyan-400 border-solid animate-spin" />
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Initializing Audit Engine...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 pb-32 font-sans selection:bg-cyan-500/30">
            <div className="max-w-5xl mx-auto">

                {/* Toast Notification */}
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
                <div className="mb-8">
                    <div className="flex items-center gap-3 text-cyan-500 mb-2">
                        <ClipboardCheck size={28} className="drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                        <h1 className="text-3xl font-black tracking-tighter text-white">Stock Audit</h1>
                    </div>
                    <p className="text-gray-500 text-sm">Align system ledger with physical warehouse counts seamlessly.</p>
                </div>

                {/* ── STEP 1: AUDIT CONFIGURATION ── */}
                {step === 1 && (
                    <div className="bg-[#0f0f13] border border-white/5 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto mt-12 relative overflow-hidden group">

                        {/* Ambient Background Blur */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-600/10 blur-3xl rounded-full opacity-50 group-hover:opacity-70 transition-opacity" />

                        <div className="relative z-10 flex flex-col gap-8">
                            <div>
                                <h2 className="text-lg font-black text-white flex items-center gap-2 mb-1">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">1</span>
                                    Configure Session
                                </h2>
                                <p className="text-gray-500 text-sm pl-8">Define the location and category to generate your checklist.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-8">
                                {/* Warehouse Select */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Warehouse size={14} /> Target Location
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={warehouse}
                                            onChange={(e) => setWarehouse(e.target.value)}
                                            className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-cyan-500/50 text-white font-bold"
                                        >
                                            {WAREHOUSES.map(wh => <option key={wh} value={wh}>{wh}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">▼</div>
                                    </div>
                                </div>

                                {/* Item Type Select */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Filter size={14} /> Item Category
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={itemType}
                                            onChange={(e) => setItemType(e.target.value)}
                                            className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-cyan-500/50 text-white font-bold"
                                        >
                                            {ITEM_TYPES.map(type => <option key={type} value={type}>{type === 'All' ? 'All Types' : type}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">▼</div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-6 pl-8 mt-2">
                                <button
                                    onClick={handleStartAudit}
                                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2"
                                >
                                    Generate Checklist <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: AUDIT EXECUTION ── */}
                {step === 2 && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        {/* Info Ribbon */}
                        <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="px-3 py-1 rounded bg-white/5 text-gray-300 text-xs font-mono border border-white/10">{warehouse}</span>
                                    <span className="px-3 py-1 rounded bg-white/5 text-gray-300 text-xs font-mono border border-white/10">{itemType === 'All' ? 'All Items' : itemType}</span>
                                </div>
                                <p className="text-gray-500 text-xs mt-2 font-medium">Leave physical count blank if item is missing or uncounted.</p>
                            </div>

                            {/* Search In-Audit */}
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Filter SKU..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500/50 text-white placeholder-gray-600"
                                />
                            </div>
                        </div>

                        {/* Checklist Container */}
                        <div className="bg-[#0f0f13] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                            {/* Desktop Headers */}
                            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-black/40 border-b border-white/5 text-[10px] uppercase tracking-widest font-bold text-gray-500">
                                <div className="col-span-5">Product Details</div>
                                <div className="col-span-2 text-center text-blue-400">System Qty</div>
                                <div className="col-span-3 text-center text-cyan-400">Physical Count (Actual)</div>
                                <div className="col-span-2 text-right">Variance</div>
                            </div>

                            {/* List items */}
                            <div className="divide-y divide-white/5">
                                {visibleAuditList.length === 0 ? (
                                    <div className="p-12 text-center text-gray-600 text-sm">No items found matching criteria.</div>
                                ) : (
                                    visibleAuditList.map((item) => {
                                        const physical = parseInt(item.physicalQty);
                                        const isCounted = !isNaN(physical);
                                        const variance = isCounted ? physical - item.systemQty : 0;

                                        return (
                                            <div key={item.sku} className={`p-4 md:px-6 transition-colors ${item.physicalQty !== '' ? 'bg-white/[0.02]' : 'hover:bg-white/[0.01]'}`}>
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">

                                                    {/* Product Info */}
                                                    <div className="col-span-1 md:col-span-5 flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-white text-base truncate pr-2">{item.sku}</span>
                                                            {item.physicalQty !== '' && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
                                                        </div>
                                                        <span className="text-xs text-gray-500 truncate">{item.name}</span>
                                                    </div>

                                                    {/* System Qty (Mobile vs Desktop) */}
                                                    <div className="col-span-1 md:col-span-2 flex justify-between md:justify-center items-center">
                                                        <span className="md:hidden text-xs text-gray-500 font-bold uppercase">System:</span>
                                                        <span className="font-mono text-sm font-bold text-blue-400/80">{item.systemQty.toLocaleString()}</span>
                                                    </div>

                                                    {/* Physical Input */}
                                                    <div className="col-span-1 md:col-span-3 flex justify-center">
                                                        <input
                                                            type="number"
                                                            placeholder="—"
                                                            value={item.physicalQty}
                                                            onChange={(e) => handlePhysicalQtyChange(item.sku, e.target.value)}
                                                            className={`w-full md:w-3/4 max-w-[200px] text-center bg-black/40 border-2 rounded-xl py-3 md:py-2 text-lg font-black font-mono focus:outline-none transition-all placeholder-gray-700
                                                                ${item.physicalQty === '' ? 'border-white/10 text-gray-300' :
                                                                    variance === 0 ? 'border-green-500/40 text-green-300' : 'border-orange-500/40 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                                                                }
                                                                focus:border-cyan-400/60 focus:bg-white/5`}
                                                        />
                                                    </div>

                                                    {/* Variance */}
                                                    <div className="col-span-1 md:col-span-2 flex justify-between md:justify-end items-center">
                                                        <span className="md:hidden text-xs text-gray-500 font-bold uppercase">Variance:</span>
                                                        {isCounted ? (
                                                            <div className={`font-mono text-lg md:text-base font-black px-3 py-1 rounded bg-black/50 ${variance > 0 ? 'text-green-400' : variance < 0 ? 'text-orange-400' : 'text-gray-500'
                                                                }`}>
                                                                {variance > 0 ? '+' : ''}{variance.toLocaleString()}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-700 font-mono text-sm">—</div>
                                                        )}
                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Sticky Action Footer */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#07070a] via-[#07070a] to-transparent pointer-events-none z-40">
                            <div className="max-w-5xl mx-auto flex justify-end pointer-events-auto">
                                <button
                                    onClick={handlePostAudit}
                                    disabled={processing || countedItemsCount === 0}
                                    className={`flex items-center gap-3 px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm transition-all shadow-2xl ${processing || countedItemsCount === 0
                                        ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                        : 'bg-cyan-600 text-white hover:bg-cyan-500 hover:-translate-y-1 shadow-cyan-900/50'
                                        }`}
                                >
                                    {processing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Syncing Database...
                                        </>
                                    ) : (
                                        <>
                                            <Calculator size={18} />
                                            Post Audit ({countedItemsCount} Counted)
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockAudit;
