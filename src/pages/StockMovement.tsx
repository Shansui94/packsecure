import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { V2Item } from '../types/v2';
import { WAREHOUSES } from '../data/factoryData';
import { 
    ArrowDownCircle, ArrowUpCircle, ClipboardList, Search, Check, AlertCircle, 
    Plus, Minus, X, ShoppingCart, Camera, Sparkles, RefreshCw, Image as ImageIcon,
    CheckCircle2, Trash2, Eye
} from 'lucide-react';
import { compressImage, dataUrlToBase64Payload, dataURLtoBlob } from '../utils/imageCompress';

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

interface ScannedItem {
    id: string;
    sku: string;
    product: string;
    quantity: number;
    confidence?: number;
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

    // AI Photo Scanning State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [scanPhotoUrl, setScanPhotoUrl] = useState<string | null>(null);
    const [scannedRefDoc, setScannedRefDoc] = useState('');
    const [scannedLocation, setScannedLocation] = useState('');
    const [scannedNotes, setScannedNotes] = useState('');
    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(null);
    const [showFullPhotoModal, setShowFullPhotoModal] = useState<string | null>(null);
    const [previewHistoryPhoto, setPreviewHistoryPhoto] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Helper to get name from SKU
    const getItemName = (sku: string) => {
        const item = items.find(i => i.sku === sku);
        return item ? item.name : (sku || 'Unknown Product');
    };

    // Helper to parse photo url from notes/refDoc
    const extractPhotoUrl = (notes?: string, refDoc?: string): string | null => {
        if (!notes && !refDoc) return null;
        const match = (notes || '').match(/\[Photo:\s*([^\]]+)\]/i) || (refDoc || '').match(/\[Photo:\s*([^\]]+)\]/i);
        if (match) return match[1].trim();
        return null;
    };

    // SKU autocomplete filter
    const searchTerms = skuSearch.toLowerCase().trim().split(/[\s-]+/).filter(Boolean);
    const filteredItems = items.filter(i => {
        if (searchTerms.length === 0) return true;
        const s = i.sku.toLowerCase();
        const n = i.name.toLowerCase();
        const nick = (i as any).nickname ? (i as any).nickname.toLowerCase() : '';
        return searchTerms.every(term => s.includes(term) || n.includes(term) || nick.includes(term));
    }).slice(0, 50);

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
        setTimeout(() => setToast(null), 3500);
    };

    // --- AI PHOTO SCANNING HANDLER ---
    const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsAnalyzing(true);
            showToast('AI is analyzing photo and extracting items...', 'ok');

            // 1. Compress Image
            const compressedDataUrl = await compressImage(file, 2048, 0.85);
            setScanPhotoUrl(compressedDataUrl);

            // 2. Prepare Payload
            const { base64, mimeType } = dataUrlToBase64Payload(compressedDataUrl);

            // 3. Call Vision API
            const response = await fetch('/api/agent/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: base64,
                    mimeType,
                    type: 'stock_movement',
                    productsList: items.map(i => ({ sku: i.sku, name: i.name }))
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'AI Analysis Failed');
            }

            const result = await response.json();

            // 4. Process result
            setScannedRefDoc(result.refDoc || '');

            // Auto-match warehouse location
            let matchedLocation = '';
            if (result.location) {
                const lowerLoc = result.location.toLowerCase();
                const found = WAREHOUSES.find(w => w.toLowerCase().includes(lowerLoc) || lowerLoc.includes(w.toLowerCase()));
                if (found) matchedLocation = found;
            }
            setScannedLocation(matchedLocation || selectedLocation || '');
            setScannedNotes(result.notes || '');

            // Match items with catalog
            const rawItemsList = Array.isArray(result.items) ? result.items : (Array.isArray(result) ? result : []);
            const parsedItems: ScannedItem[] = rawItemsList.map((it: any, index: number) => {
                const matched = items.find(catalogItem => 
                    (it.sku && catalogItem.sku.toLowerCase() === it.sku.toLowerCase()) ||
                    (catalogItem.name.toLowerCase() === (it.product || '').toLowerCase())
                );
                return {
                    id: `scan_${Date.now()}_${index}`,
                    sku: matched ? matched.sku : (it.sku || ''),
                    product: matched ? matched.name : (it.product || 'Unknown Item'),
                    quantity: typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1,
                    confidence: it.confidence
                };
            });

            setScannedItems(parsedItems.length > 0 ? parsedItems : [{ id: `scan_${Date.now()}_0`, sku: '', product: '', quantity: 1 }]);
            setShowReviewModal(true);
        } catch (err: any) {
            console.error('Vision analysis error:', err);
            showToast('AI Scan Error: ' + err.message, 'err');
        } finally {
            setIsAnalyzing(false);
            if (e.target) e.target.value = '';
        }
    };

    const updateScannedItem = (id: string, field: 'sku' | 'product' | 'quantity', val: any) => {
        setScannedItems(prev => prev.map(it => {
            if (it.id === id) {
                if (field === 'sku') {
                    const matched = items.find(i => i.sku === val);
                    return { ...it, sku: val, product: matched ? matched.name : it.product };
                }
                return { ...it, [field]: val };
            }
            return it;
        }));
    };

    const removeScannedItem = (id: string) => {
        setScannedItems(prev => prev.filter(it => it.id !== id));
    };

    const addScannedItemRow = () => {
        setScannedItems(prev => [
            ...prev,
            { id: `scan_${Date.now()}_${prev.length}`, sku: '', product: '', quantity: 1 }
        ]);
    };

    const handleConfirmScan = () => {
        const validScanned = scannedItems.filter(s => s.quantity > 0 && (s.sku || s.product));
        if (validScanned.length === 0) {
            showToast('Please specify at least one valid item and quantity.', 'err');
            return;
        }

        let newCart = [...cart];
        validScanned.forEach(scanned => {
            const catalogItem = items.find(i => i.sku === scanned.sku) || {
                sku: scanned.sku || `CUSTOM-${Date.now()}`,
                name: scanned.product || 'Custom Item',
                type: 'FG' as any,
                supply_type: 'Manufactured' as any,
                uom: 'Roll',
                status: 'Active' as any
            };

            const existingIdx = newCart.findIndex(c => c.sku === catalogItem.sku);
            if (existingIdx >= 0) {
                newCart[existingIdx].qty += scanned.quantity;
            } else {
                newCart.unshift({
                    ...catalogItem,
                    qty: scanned.quantity
                });
            }
        });

        setCart(newCart);

        // Autofill meta
        if (scannedRefDoc && !refDoc) {
            setRefDoc(scannedRefDoc);
        }
        if (scannedLocation) {
            setSelectedLocation(scannedLocation);
        }
        if (scannedNotes && !notes) {
            setNotes(scannedNotes);
        }

        // Attach proof photo
        if (scanPhotoUrl) {
            setProofPhotoUrl(scanPhotoUrl);
        }

        setShowReviewModal(false);
        showToast(`AI successfully added ${validScanned.length} items to staging list!`, 'ok');
    };

    // --- SUBMISSION HANDLER ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validItems = cart.filter(item => item.qty > 0);
        if (validItems.length === 0) return showToast('No items with a valid quantity to submit.', 'err');
        if (!selectedLocation) return showToast('Please select a warehouse location.', 'err');

        setLoading(true);
        try {
            const txnType = mode === 'in' ? 'Stock In' : 'Stock Out';
            const multiplier = mode === 'in' ? 1 : -1;

            // Upload proof photo to Supabase storage if present
            let uploadedPhotoUrl: string | null = null;
            if (proofPhotoUrl) {
                try {
                    const blob = dataURLtoBlob(proofPhotoUrl);
                    const fileName = `stock_movement/PROOF_${Date.now()}_${user?.uid || 'anon'}.jpg`;
                    const { error: uploadErr } = await supabase.storage
                        .from('work-photos')
                        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

                    if (!uploadErr) {
                        const { data: pubUrlData } = supabase.storage
                            .from('work-photos')
                            .getPublicUrl(fileName);
                        uploadedPhotoUrl = pubUrlData?.publicUrl || null;
                    } else {
                        console.warn('Proof photo upload skipped:', uploadErr.message);
                    }
                } catch (pErr) {
                    console.warn('Failed to upload proof photo:', pErr);
                }
            }

            // Format notes with proof photo link if uploaded
            let finalNotes = notes || '';
            if (uploadedPhotoUrl) {
                finalNotes = finalNotes ? `${finalNotes} [Photo: ${uploadedPhotoUrl}]` : `[Photo: ${uploadedPhotoUrl}]`;
            }

            const inserts = validItems.map(item => ({
                sku: item.sku,
                change_qty: item.qty * multiplier,
                event_type: txnType,
                loc_id: selectedLocation,
                ref_doc: refDoc || null,
                notes: finalNotes || null,
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
            setProofPhotoUrl(null);
            setScanPhotoUrl(null);
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
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 pb-24 font-sans relative">
            <div className="max-w-7xl mx-auto">

                {/* Hidden File Upload Inputs */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoCapture}
                    accept="image/*"
                    className="hidden"
                />

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
                        <p className="text-gray-500 text-xs md:text-sm">Batch process multi-SKU inward and outward movements with AI photo recognition.</p>
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

                        {/* Search & AI Scan Bar */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1" ref={dropdownRef}>
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
                                        placeholder="Scan barcode or type SKU / Item Name..."
                                        className="w-full bg-transparent border-none py-4 md:py-5 pl-4 pr-6 text-sm md:text-base font-medium focus:outline-none text-white placeholder-gray-600"
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
                                                    <div className="font-bold text-white text-base group-hover:text-cyan-400 transition-colors">{item.name}</div>
                                                    <div className="text-sm text-gray-500 mt-0.5 font-mono">{item.sku}</div>
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

                            {/* AI PHOTO SCAN TRIGGER BUTTON */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isAnalyzing}
                                className={`
                                    h-[54px] md:h-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 
                                    text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-pink-900/30 ring-1 ring-white/20 
                                    transition-all transform active:scale-95 shrink-0 ${isAnalyzing ? 'opacity-75 cursor-wait' : ''}
                                `}
                                title="Snap photo of DO, Invoices, Pallets or goods to Auto-Fill with AI"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin text-pink-200" />
                                        <span>AI Reading...</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Camera size={19} />
                                            <Sparkles size={11} className="text-pink-300 absolute -top-1 -right-1.5 animate-ping" />
                                        </div>
                                        <span>AI Photo Fill</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Cart List */}
                        <div className={`flex-1 bg-[#0d0d12] border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-xl ${cart.length > 0 ? `ring-1 ring-inset ${isIn ? 'ring-green-500/10' : 'ring-orange-500/10'}` : ''}`}>
                            <div className={`px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20`}>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <ClipboardList size={14} /> Staging List
                                    </h2>
                                    {proofPhotoUrl && (
                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-[10px] font-bold">
                                            <ImageIcon size={11} />
                                            <span>Photo Proof Attached</span>
                                            <button
                                                type="button"
                                                onClick={() => setShowFullPhotoModal(proofPhotoUrl)}
                                                className="hover:text-white underline ml-1"
                                            >
                                                View
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setProofPhotoUrl(null)}
                                                className="hover:text-red-400 ml-1"
                                                title="Remove attached photo"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    )}
                                </div>
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
                                        <div className="text-sm font-medium text-center px-4">
                                            List is empty. Scan an item above or click <span className="text-pink-400 font-bold">AI Photo Fill</span> to capture a document.
                                        </div>
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
                                                            <div className="font-bold text-white text-sm sm:text-base truncate">{item.name}</div>
                                                            <div className="text-[10px] sm:text-xs text-gray-300 truncate mt-0.5 font-mono">{item.sku}</div>
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

                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Transaction Details</h2>
                                {proofPhotoUrl && (
                                    <span className="text-[10px] text-pink-400 flex items-center gap-1 font-mono">
                                        <ImageIcon size={12} /> Photo Attached
                                    </span>
                                )}
                            </div>

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
                                    placeholder="e.g. PO-8890, DO-123, Transfer Slip"
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
                                                const photoUrl = extractPhotoUrl(row.notes, row.ref_doc);
                                                return (
                                                    <div key={row.txn_id} className="px-4 py-3 rounded-xl hover:bg-white/5 transition-colors flex items-start gap-3">
                                                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isPositive ? 'bg-green-500' : 'bg-orange-500'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start mb-0.5 gap-2">
                                                                <div className="flex flex-col flex-1 min-w-0">
                                                                    <span className="font-bold text-white text-sm truncate" title={getItemName(row.sku)}>{getItemName(row.sku)}</span>
                                                                    <span className="text-[10px] text-gray-500 font-mono truncate">{row.sku}</span>
                                                                </div>
                                                                <span className={`font-black font-mono text-sm shrink-0 ${isPositive ? 'text-green-400' : 'text-orange-400'}`}>
                                                                    {isPositive ? '+' : ''}{row.change_qty.toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-1 gap-2 flex-wrap">
                                                                <span className="text-[10px] text-gray-500 font-mono">
                                                                    {new Date(row.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(row.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                                    {row.created_by_name && <span className="text-blue-400/70"> · {row.created_by_name}</span>}
                                                                </span>
                                                                <div className="flex items-center gap-1.5">
                                                                    {photoUrl && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setPreviewHistoryPhoto(photoUrl)}
                                                                            className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 transition-colors font-semibold"
                                                                            title="View Proof Photo"
                                                                        >
                                                                            <ImageIcon size={10} /> Photo Proof
                                                                        </button>
                                                                    )}
                                                                    {row.ref_doc && (
                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono truncate max-w-[100px]">{row.ref_doc}</span>
                                                                    )}
                                                                </div>
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

            {/* ── AI SCAN REVIEW & CONFIRMATION MODAL ── */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0e0e12] border border-white/10 w-full max-w-4xl rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col max-h-[92vh] relative overflow-hidden ring-1 ring-white/5">
                        
                        {/* Background Decorative Glow */}
                        <div className="absolute top-0 right-0 w-80 h-80 bg-pink-600/10 rounded-full blur-[120px] pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

                        {/* Modal Header */}
                        <div className="flex justify-between items-start mb-6 z-10 border-b border-white/5 pb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-pink-500/20 ring-1 ring-white/20">
                                    <Sparkles size={24} className="text-white animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                                        AI Recognition Review
                                    </h3>
                                    <p className="text-xs md:text-sm text-gray-400">Review and adjust recognized document data and item counts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar z-10 space-y-6 pr-1">
                            
                            {/* Meta Grid: Image Thumbnail + Form Details */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                
                                {/* Photo Thumbnail Preview */}
                                <div className="md:col-span-4 flex flex-col items-center justify-center bg-black/40 border border-white/10 rounded-xl p-3 relative group overflow-hidden">
                                    {scanPhotoUrl ? (
                                        <div className="relative w-full h-36 flex items-center justify-center cursor-pointer" onClick={() => setShowFullPhotoModal(scanPhotoUrl)}>
                                            <img src={scanPhotoUrl} alt="Scanned Document" className="max-h-full max-w-full object-contain rounded-lg shadow" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 text-white text-xs font-bold rounded-lg transition-opacity">
                                                <Eye size={16} /> View Full
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-gray-600 text-xs">No Photo</div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="mt-2 text-[11px] text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1 transition-colors"
                                    >
                                        <RefreshCw size={12} /> Retake / Choose Other
                                    </button>
                                </div>

                                {/* Form Fields: RefDoc, Location, Notes */}
                                <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            Reference Document / DO No.
                                        </label>
                                        <input
                                            type="text"
                                            value={scannedRefDoc}
                                            onChange={e => setScannedRefDoc(e.target.value)}
                                            placeholder="e.g. DO-99881"
                                            className="w-full bg-[#16161c] border border-white/10 focus:border-pink-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            Warehouse Location
                                        </label>
                                        <select
                                            value={scannedLocation}
                                            onChange={e => setScannedLocation(e.target.value)}
                                            className="w-full bg-[#16161c] border border-white/10 focus:border-pink-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none cursor-pointer"
                                        >
                                            <option value="">Select Location...</option>
                                            {WAREHOUSES.map(w => (
                                                <option key={w} value={w}>{w}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            Notes / Remarks
                                        </label>
                                        <input
                                            type="text"
                                            value={scannedNotes}
                                            onChange={e => setScannedNotes(e.target.value)}
                                            placeholder="Supplier, remarks or carrier details..."
                                            className="w-full bg-[#16161c] border border-white/10 focus:border-pink-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* Recognized Items Table */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        Recognized Items ({scannedItems.length})
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={addScannedItemRow}
                                        className="text-xs font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 transition-colors"
                                    >
                                        <Plus size={14} /> Add Row
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar p-1">
                                    {scannedItems.map((item, index) => (
                                        <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[#15151b] border border-white/5 hover:border-white/10 p-3 rounded-xl transition-all">
                                            
                                            {/* Index number */}
                                            <div className="text-xs font-mono text-gray-500 font-bold w-6 shrink-0 hidden sm:block text-center">
                                                {index + 1}
                                            </div>

                                            {/* SKU / Product Selector */}
                                            <div className="flex-1 w-full sm:w-auto">
                                                <select
                                                    value={item.sku}
                                                    onChange={e => updateScannedItem(item.id, 'sku', e.target.value)}
                                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-pink-500/50"
                                                >
                                                    <option value="">{item.product ? `[Scanned]: ${item.product}` : '-- Select Matching SKU --'}</option>
                                                    {items.map(cat => (
                                                        <option key={cat.sku} value={cat.sku}>
                                                            {cat.name} ({cat.sku})
                                                        </option>
                                                    ))}
                                                </select>
                                                {item.product && item.sku && (
                                                    <div className="text-[10px] text-gray-500 mt-1 truncate">
                                                        Raw text: <span className="text-gray-400 font-mono">{item.product}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Qty Stepper */}
                                            <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                                                <div className="flex items-center bg-black/60 rounded-lg p-1 border border-white/10">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateScannedItem(item.id, 'quantity', Math.max(0, item.quantity - 1))}
                                                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white"
                                                    >
                                                        <Minus size={13} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={e => updateScannedItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                                        className="w-14 text-center bg-transparent border-none text-sm font-black font-mono focus:outline-none text-white"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => updateScannedItem(item.id, 'quantity', item.quantity + 1)}
                                                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white"
                                                    >
                                                        <Plus size={13} />
                                                    </button>
                                                </div>

                                                {/* Delete Row */}
                                                <button
                                                    type="button"
                                                    onClick={() => removeScannedItem(item.id)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                                    title="Delete item"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="mt-6 flex justify-end items-center gap-3 z-10 border-t border-white/5 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowReviewModal(false)}
                                className="px-5 py-2.5 text-gray-400 hover:text-white font-bold text-sm transition-colors hover:bg-white/5 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmScan}
                                className="h-12 px-8 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-green-900/30 ring-1 ring-white/20 transition-all transform active:scale-95"
                            >
                                <CheckCircle2 size={18} />
                                Confirm & Add to Staging List
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* ── FULL PHOTO MODAL ── */}
            {showFullPhotoModal && (
                <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowFullPhotoModal(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowFullPhotoModal(null)}
                            className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <img src={showFullPhotoModal} alt="Full Document" className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10" />
                    </div>
                </div>
            )}

            {/* ── HISTORY PHOTO PROOF PREVIEW MODAL ── */}
            {previewHistoryPhoto && (
                <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewHistoryPhoto(null)}>
                    <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <div className="w-full flex justify-between items-center text-white mb-3">
                            <span className="text-sm font-bold flex items-center gap-2">
                                <ImageIcon size={16} className="text-pink-400" />
                                Transaction Proof Photo
                            </span>
                            <button
                                onClick={() => setPreviewHistoryPhoto(null)}
                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <img src={previewHistoryPhoto} alt="Proof" className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10" />
                    </div>
                </div>
            )}

        </div>
    );
};

export default StockMovement;
