import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import Papa from 'papaparse';
import {
    Search, Plus, Save, Trash2, Truck, Users,
    AlertCircle, CheckCircle, X, Cloud,
    Package, Settings, LayoutGrid, FlaskConical, ChevronRight, Sparkles, Loader
} from 'lucide-react';
import { CommandDeck } from '../components/CommandDeck';

import { AIChatWidget } from '../components/AIChatWidget';
import { determineZone } from '../utils/logistics';



// --- TYPES ---
type TabType = 'items' | 'machines' | 'vehicles' | 'customers' | 'partners' | 'recipes' | 'factories';

interface DataItem {
    id: string; // Unified ID for UI
    [key: string]: any;
}

// --- CONFIG ---
const TABS = [
    { id: 'items', label: 'Master Items', icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'vehicles', label: 'Fleet / Vehicles', icon: Truck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'customers', label: 'Customers', icon: Users, color: 'text-green-400', bg: 'bg-green-500/10' },
    { id: 'machines', label: 'Machines', icon: Settings, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'factories', label: 'Factories / Hubs', icon: LayoutGrid, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { id: 'partners', label: 'Suppliers', icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { id: 'recipes', label: 'BOM Recipes', icon: FlaskConical, color: 'text-pink-400', bg: 'bg-pink-500/10' },
];

// --- SMART IMPORT MODAL ---
const SmartImportModal = ({ isOpen, onClose, onImport, activeTab }: any) => {
    const [text, setText] = useState('');
    const [preview, setPreview] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // CSV HANDLING
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data && results.data.length > 0) {
                        // Normalize
                        const p = results.data.map((r: any) => ({
                            name: r.name || r.title || r.Name || r['Company Name'],
                            phone: r.phone || r.Phone || r['Phone Number'],
                            address: r.address || r.Address || r['Full Address'],
                            ...r
                        }));
                        setPreview(p);
                    }
                }
            });
            return;
        }

        // IMAGE HANDLING (SERVER-SIDE VISION)
        if (file.type.startsWith('image/')) {
            setIsAnalyzing(true);
            try {
                const base64 = await toBase64(file);
                const result = await analyzeImageWithServer(base64);
                setPreview(result);
            } catch (err: any) {
                alert('AI Error: ' + err.message);
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const toBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

    const analyzeImageWithServer = async (base64Data: string) => {
        // Strip prefix if needed, but server expects full or partial?
        // Let's send the raw base64 data URL, let server handle splitting or stick to splitting here.
        // My server code expects stripped base64: `const base64 = imageBase64;` and calls `data: base64`.
        // Wait, in server.ts I actually wrote: `data: imageBase64`.
        // So server expects RAW BASE64 (no data:image... prefix).
        const base64Broken = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

        // Use hardcoded localhost:8080 matching server.ts default
        const response = await fetch('/api/agent/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Broken })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server Analysis Failed');
        }
        return await response.json();
    };

    const handleAnalyze = async () => {
        if (!text.trim()) return;
        setIsAnalyzing(true);

        try {
            // Call Backend Real AI
            const response = await fetch('/api/agent/parse-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    type: activeTab // Pass current tab context (e.g. 'customers')
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Analysis failed');
            }

            const parsed = await response.json();

            // Normalize result for UI Preview
            const normalized = parsed.map((r: any) => ({
                // Keep original keys but ensure required UI keys exist
                name: r.name || r.Name || r.title || r.col1 || 'Unknown',
                phone: r.phone || r.Phone || r.tel || r.col2 || '',
                address: r.address || r.Address || r.addr || r.col3 || '',
                ...r // Keep everything else
            }));

            setPreview(normalized);

        } catch (err: any) {
            console.error(err);
            alert('AI Analysis Failed: ' + err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#0c0c0e] border border-white/10 w-full max-w-3xl rounded-3xl p-8 shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden ring-1 ring-white/5">

                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-start mb-8 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20 ring-1 ring-white/20">
                            <Sparkles size={24} className="text-white animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">AI Smart Import</h3>
                            <p className="text-sm text-gray-400 font-medium">Auto-structure data from any source</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex flex-col gap-6 z-10">
                    {preview.length === 0 ? (
                        <div className="flex flex-col h-full gap-6">
                            {/* DROP ZONE */}
                            <div
                                onClick={() => fileRef.current?.click()}
                                className="h-40 border-2 border-dashed border-white/10 hover:border-pink-500/50 bg-white/[0.02] hover:bg-pink-500/[0.02] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="p-4 rounded-full bg-white/5 group-hover:bg-pink-500/10 mb-3 transition-colors ring-1 ring-white/5">
                                    <Cloud size={32} className="text-gray-400 group-hover:text-pink-400 transition-colors" />
                                </div>
                                <p className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">
                                    Drop CSV, Excel, or Photo here
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Supports .csv, .xlsx, .jpg, .png</p>
                                <input type="file" ref={fileRef} className="hidden" accept=".csv, .jpg, .jpeg, .png, .webp" onChange={handleFileUpload} />
                            </div>

                            {/* DIVIDER */}
                            <div className="flex items-center gap-4">
                                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent flex-1" />
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">OR PASTE TEXT</span>
                                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent flex-1" />
                            </div>

                            {/* TEXT AREA */}
                            <div className="flex-1 relative">
                                <textarea
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    placeholder={`Name | Phone | Address\n\nExample:\nAli Baba | 012-3456789 | 123 Jalan Ampang`}
                                    className="w-full h-full bg-[#18181b] hover:bg-[#1c1c20] focus:bg-[#18181b] border border-white/10 hover:border-white/20 focus:border-pink-500/50 rounded-2xl p-5 text-sm text-gray-200 focus:outline-none resize-none font-mono transition-all leading-relaxed"
                                />
                                <div className="absolute bottom-4 right-4 text-xs text-gray-600 bg-black/40 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                                    AI Parsing Enabled
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-hidden bg-[#18181b] border border-white/10 rounded-2xl shadow-inner flex flex-col">
                            {/* Table Header */}
                            <div className="bg-white/5 p-4 border-b border-white/5 flex gap-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <div className="w-1/4">Name</div>
                                <div className="w-1/4">Phone</div>
                                <div className="flex-1">Address</div>
                                <div className="w-24">Zone</div>
                            </div>
                            {/* Table Body */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {preview.map((row, idx) => (
                                    <div key={idx} className="flex gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors items-center text-sm group">
                                        <div className="w-1/4 font-bold text-white truncate">{row.name}</div>
                                        <div className="w-1/4 text-gray-400 font-mono text-xs">{row.phone}</div>
                                        <div className="flex-1 text-gray-300 truncate text-xs" title={row.address}>{row.address}</div>
                                        <div className="w-24">
                                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${!row.address ? 'bg-gray-800 text-gray-500 border-transparent' :
                                                determineZone(row.address) === 'North' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                                    determineZone(row.address) === 'South' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                                        'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                                }`}>
                                                {row.address ? determineZone(row.address) : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="mt-8 flex justify-end gap-3 z-10 border-t border-white/5 pt-6">
                    {preview.length > 0 && (
                        <button
                            onClick={() => { setPreview([]); setText(''); }}
                            className="px-5 py-2.5 text-gray-400 hover:text-white font-bold text-sm transition-colors hover:bg-white/5 rounded-xl"
                        >
                            Reset
                        </button>
                    )}

                    {preview.length === 0 ? (
                        <button
                            onClick={handleAnalyze}
                            disabled={!text.trim() || isAnalyzing}
                            className={`
                                h-12 px-8 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 
                                text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-pink-900/20 
                                ring-1 ring-white/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                                ${isAnalyzing ? 'animate-pulse cursor-wait' : ''}
                            `}
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader size={18} className="animate-spin" />
                                    <span>Processing Image/Text...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    <span>Analyze Data</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => onImport(preview)}
                            className="h-12 px-8 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-green-900/20 ring-1 ring-white/20 transition-all transform active:scale-95"
                        >
                            <CheckCircle size={18} />
                            Import {preview.length} Records
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function DataManagement() {
    // STATE
    const [activeTab, setActiveTab] = useState<TabType>('items');
    const [data, setData] = useState<DataItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState<DataItem | null>(null);
    const [form, setForm] = useState<any>({});
    const [, setIsDirty] = useState(false);


    // Smart Import State
    const [showSmartExport, setShowSmartImport] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [notification, setNotification] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // 1. FETCH DATA
    const fetchData = async () => {
        setLoading(true);
        setData([]);
        setSelectedItem(null);
        try {
            let query;
            let mapFn = (item: any) => ({ ...item, id: item.id });

            switch (activeTab) {
                case 'items':
                    query = supabase.from('master_items_v2').select('*').order('sku').limit(1000);
                    mapFn = (i) => ({ ...i, id: i.sku, title: i.name, subtitle: i.sku });
                    break;
                case 'vehicles':
                    query = supabase.from('sys_vehicles').select('*').order('id');
                    mapFn = (i) => ({ ...i, id: i.id, title: i.plate_number, subtitle: `${i.max_volume_m3}m³ • ${i.status}` });
                    break;
                case 'customers':
                    query = supabase.from('sys_customers').select('*').order('name').limit(1000);
                    mapFn = (i) => ({ ...i, id: i.id, title: i.name, subtitle: i.zone });
                    break;
                case 'machines':
                    query = supabase.from('sys_machines_v2').select('*').order('machine_id');
                    mapFn = (i) => ({ ...i, id: i.machine_id, title: i.name, subtitle: i.type });
                    break;
                case 'partners':
                    query = supabase.from('crm_partners_v2').select('*').order('partner_id');
                    mapFn = (i) => ({ ...i, id: i.partner_id, title: i.name, subtitle: i.type });
                    break;
                case 'recipes':
                    query = supabase.from('bom_headers_v2').select('*, bom_items_v2(*)').order('created_at', { ascending: false }).limit(1000);
                    mapFn = (i) => ({ ...i, id: i.recipe_id, title: i.product_sku, subtitle: `${i.bom_items_v2?.length || 0} Ingredients` });
                    break;
                case 'factories':
                    query = supabase.from('sys_locations_v2').select('*').order('loc_id');
                    mapFn = (i) => ({ ...i, id: i.factory_id, title: i.name, subtitle: i.location_name });
                    break;
            }

            if (query) {
                const { data: res, error } = await query;
                if (error) throw error;
                setData((res || []).map(mapFn));
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setSearch(''); // Reset search on tab change
    }, [activeTab]);

    // 2. SELECTION HANDLER
    const handleSelect = (item: DataItem) => {
        setSelectedItem(item);
        setForm({ ...item });
        setIsDirty(false);
    };

    const handleCreateNew = () => {
        const newTemplate: any = {};
        // Defaults
        if (activeTab === 'vehicles') newTemplate.status = 'Available';
        if (activeTab === 'items') newTemplate.uom = 'Roll';

        setSelectedItem({ id: 'NEW', title: 'New Record', ...newTemplate });
        setForm(newTemplate);
        setIsDirty(true);
    };

    // 3. ACTIONS
    const handleSave = async () => {
        try {
            let table = '';
            let pk = ''; // DB Primary Key Column

            switch (activeTab) {
                case 'items': table = 'master_items_v2'; pk = 'sku'; break;
                case 'vehicles': table = 'sys_vehicles'; pk = 'id'; break;
                case 'customers': table = 'sys_customers'; pk = 'id'; break;
                case 'machines': table = 'sys_machines_v2'; pk = 'machine_id'; break;
                case 'partners': table = 'crm_partners_v2'; pk = 'partner_id'; break;
                case 'recipes': table = 'bom_headers_v2'; pk = 'recipe_id'; break;
                case 'factories': table = 'sys_locations_v2'; pk = 'loc_id'; break;
            }

            const payload = { ...form };
            // Remove UI-only fields
            delete payload.title;
            delete payload.subtitle;
            delete payload.bom_items_v2; // Don't save nested relations directly here for now

            // DYNAMIC PK HANDLING: if the table's DB Primary Key is NOT 'id', we must strip the 'id' field
            // that was injected by the frontend mapFn for UI mapping purposes.
            if (pk !== 'id') {
                delete payload.id;
            }

            // Handle ID assignment for NEW items
            if (activeTab === 'customers' && selectedItem?.id === 'NEW' && !payload.id) {
                // Auto-gen UUID for customers
                delete payload.id;
                const { error } = await supabase.from(table).insert(payload);
                if (error) throw error;
            } else {
                // Use Upsert
                // Ensure PK is present
                if (activeTab !== 'customers' && !payload[pk]) {
                    showToast(`Missing Primary Key: ${pk}`, 'error');
                    return;
                }
                const { error } = await supabase.from(table).upsert(payload);
                if (error) throw error;
            }

            showToast('Record Saved Successfully', 'success');
            fetchData(); // Refresh
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleDelete = async () => {
        if (!selectedItem || selectedItem.id === 'NEW') return;
        if (!confirm('Are you sure you want to delete this record?')) return;

        try {
            let table = '';
            let pkField = '';
            switch (activeTab) {
                case 'items': table = 'master_items_v2'; pkField = 'sku'; break;
                case 'vehicles': table = 'sys_vehicles'; pkField = 'id'; break;
                case 'customers': table = 'sys_customers'; pkField = 'id'; break;
                case 'machines': table = 'sys_machines_v2'; pkField = 'machine_id'; break;
                case 'partners': table = 'crm_partners_v2'; pkField = 'partner_id'; break;
                case 'recipes': table = 'bom_headers_v2'; pkField = 'recipe_id'; break;
                case 'factories': table = 'sys_locations_v2'; pkField = 'loc_id'; break;
            }

            const id = form[pkField] || selectedItem.id;
            const { error } = await supabase.from(table).delete().eq(pkField, id);
            if (error) throw error;

            showToast('Record Deleted', 'success');
            fetchData();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };



    // --- IMPORT LOGIC ---


    // Unified Import Handler (Called by CSV or Smart Paste)
    const executeBatchImport = async (rows: any[]) => {
        if (rows.length === 0) return;

        try {
            setLoading(true);
            let table = '';
            switch (activeTab) {
                case 'items': table = 'master_items_v2'; break;
                case 'vehicles': table = 'sys_vehicles'; break;
                case 'customers': table = 'sys_customers'; break;
                case 'machines': table = 'sys_machines_v2'; break;
                case 'partners': table = 'crm_partners_v2'; break;
                case 'recipes': table = 'bom_headers_v2'; break;
                case 'factories': table = 'sys_locations_v2'; break;
            }

            // AI ENRICHMENT: Auto-Fill Zone for Customers if missing
            let finalRows = rows;
            if (activeTab === 'customers') {
                finalRows = rows.map((r: any) => {
                    // Normalize if coming from Smart Paste vs CSV (CSV keys lowercased by PapaParse usually, Smart Paste keys fixed)
                    const name = r.name;
                    const address = r.address;
                    const phone = r.phone;

                    // Infer Zone
                    let zone = r.zone;
                    if (!zone && address) zone = determineZone(address);

                    return {
                        name, address, phone, zone,
                        // Customer ID auto-gen unless provided
                        id: undefined
                    };
                }).filter((r: any) => r.name);
            }

            const { error } = await supabase.from(table).upsert(finalRows);
            if (error) throw error;

            showToast(`Successfully imported ${finalRows.length} records!`, 'success');
            fetchData();
            setShowSmartImport(false); // Close modal
        } catch (err: any) {
            showToast('Import Failed: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        parseAndImport(file);
    };

    // --- SHARED PARSER ---
    const parseAndImport = (file: File | string) => {
        Papa.parse(file as any, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(), // Remove whitespace/BOM from headers
            complete: async (results) => {
                const rows = results.data;
                if (!rows || rows.length === 0) {
                    showToast('Data is empty or invalid', 'error');
                    return;
                }

                // Map CSV headers to standard if needed (basic normalization)
                // For now passing raw rows to executeBatchImport which handles normalization for customers
                executeBatchImport(rows);
            },
            error: (err) => {
                showToast('Parse Error: ' + err.message, 'error');
            }
        });
    }

    // --- DRIVE ACTIONS ---


    // FILTER
    const filteredData = useMemo(() => {
        if (!search) return data;
        const lower = search.toLowerCase();
        return data.filter(d =>
            (d.title && d.title.toLowerCase().includes(lower)) ||
            (d.subtitle && d.subtitle.toLowerCase().includes(lower)) ||
            (d.id && String(d.id).toLowerCase().includes(lower))
        );
    }, [data, search]);

    // --- AI HANDLER (Updated) ---
    const handleAIAction = (action: any) => {
        if (action.type === 'FILTER') {
            setSearch(action.payload.keyword);
            showToast(`AI: Filtering for "${action.payload.keyword}"`, 'success');
        }
        if (action.type === 'NAVIGATE') {
            setActiveTab(action.payload.tabId);
            showToast(`AI: Switched to ${action.payload.tabId}`, 'success');
        }
        if (action.type === 'CREATE_DRAFT') {
            handleCreateNew();
            // Merge AI guess with defaults
            setTimeout(() => {
                setForm((prev: any) => ({ ...prev, ...action.payload }));
            }, 100);
            showToast('AI: Draft created with suggested data', 'success');
        }
    };

    return (
        <div className="h-full bg-[#09090b] flex flex-col md:flex-row text-slate-300 font-sans overflow-hidden relative">

            <SmartImportModal
                isOpen={showSmartExport}
                onClose={() => setShowSmartImport(false)}
                activeTab={activeTab}
                onImport={executeBatchImport}
            />

            {/* 1. SIDEBAR TABS */}
            <div className="w-full md:w-20 bg-[#121215] border-r border-white/5 flex md::flex-col items-center py-4 gap-4 overflow-x-auto md:overflow-visible shrink-0 z-20 shadow-xl">
                <div className="hidden md:flex w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 items-center justify-center font-black text-white shadow-lg shadow-indigo-500/20">AI</div>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            title={tab.label}
                            className={`p-3 rounded-xl transition-all relative group shrink-0 ${active ? `${tab.bg} ${tab.color} shadow-lg shadow-${tab.color.split('-')[1]}-500/10` : 'hover:bg-white/5 text-gray-500'}`}
                        >
                            <Icon size={22} />
                            {/* Tooltip */}
                            <div className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none hidden md:block">
                                {tab.label}
                            </div>
                            {active && <div className="absolute top-0 bottom-0 right-0 w-0.5 bg-current rounded-full hidden md:block" />}
                        </button>
                    )
                })}
            </div>

            {/* 2. LIST VIEW */}
            <div className="w-full md:w-80 lg:w-96 bg-[#0c0c0e] border-r border-white/5 flex flex-col z-10">
                <div className="p-4 border-b border-white/5 flex flex-col gap-3 z-20 bg-[#0c0c0e]">
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-400 animate-pulse" />
                        AI Data Hub
                    </h2>
                    <div className="flex flex-col gap-2">
                        <div className="relative group">
                            <Search className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-[#18181b] border-white/5 border rounded-xl py-2 pl-9 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-[#1e1e24] transition-all"
                                placeholder="Search records..."
                            />
                        </div>
                        {/* DRIVE CONNECT REMOVED */}
                    </div>
                </div>

                {/* API KEY CONFIG PANEL */}


                <div className="flex gap-2 pt-1 border-t border-white/5 mt-1">
                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv"
                        className="hidden"
                    />

                    <button
                        onClick={handleCreateNew}
                        className="flex-1 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    >
                        <Plus size={16} /> New
                    </button>
                    {/* SMART IMPORT BUTTON */}
                    <button
                        onClick={() => setShowSmartImport(true)}
                        className="p-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-lg shadow-pink-900/40 hover:shadow-pink-600/30 text-sm font-bold flex items-center justify-center gap-2 transition-all group ring-1 ring-white/20"
                        title="Smart Import (Paste Data)"
                    >
                        <Sparkles size={16} className="group-hover:animate-spin" />
                        <span className="hidden md:inline">Smart Import</span>
                    </button>

                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-800">


                {loading ? (
                    <div className="text-center py-10 text-gray-600 text-sm animate-pulse">Loading Data...</div>
                ) : filteredData.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 text-sm">No records found.</div>
                ) : (
                    filteredData.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={`w-full text-left p-3 mb-1 rounded-xl border transition-all group ${selectedItem?.id === item.id
                                ? 'bg-indigo-600/10 border-indigo-500/30 shadow-lg shadow-indigo-900/10'
                                : 'bg-transparent border-transparent hover:bg-white/5'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                    <div className={`font-bold text-sm truncate ${selectedItem?.id === item.id ? 'text-indigo-300' : 'text-gray-300 group-hover:text-white'}`}>
                                        {item.title || 'Untitled'}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate mt-0.5">{item.subtitle || `ID: ${item.id}`}</div>
                                </div>
                                {selectedItem?.id === item.id && <ChevronRight size={14} className="text-indigo-500 mt-1" />}
                            </div>
                        </button>
                    ))
                )}
            </div>
            {/* 3. DETAIL VIEW / COMMAND DECK */}
            <div className="flex-1 bg-[#09090b] flex flex-col h-full overflow-hidden relative">
                {/* Background Glow */}
                <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

                {selectedItem ? (
                    <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                        {/* Detail Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0c0c0e]/50 backdrop-blur-sm z-10">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                    {selectedItem.id === 'NEW' ? 'Create New Record' : (form.title || selectedItem.title)}
                                    {selectedItem.id === 'NEW' && <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded uppercase tracking-wider">New</span>}
                                </h3>
                                <p className="text-gray-500 text-sm font-mono mt-1">ID: {form.id || selectedItem.id}</p>
                            </div>
                            <div className="flex gap-3">
                                {selectedItem.id !== 'NEW' && (
                                    <button
                                        onClick={handleDelete}
                                        className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                >
                                    <Save size={18} />
                                    Save Record
                                </button>
                            </div>
                        </div>

                        {/* Detail Form Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-3xl space-y-8">
                                {/* DYNAMIC FORM GEN */}
                                {activeTab === 'vehicles' && (
                                    <div className="grid grid-cols-2 gap-6">
                                        <InputGroup label="Vehicle ID" name="id" value={form.id} onChange={(v: any) => setForm({ ...form, id: v })} disabled={selectedItem.id !== 'NEW'} required />
                                        <InputGroup label="Plate Number" name="plate_number" value={form.plate_number} onChange={(v: any) => setForm({ ...form, plate_number: v })} required />

                                        <SelectGroup label="Status" value={form.status} onChange={(v: any) => setForm({ ...form, status: v })}>
                                            <option value="Available">Available</option>
                                            <option value="On-Route">On-Route</option>
                                            <option value="Maintenance">Maintenance</option>
                                        </SelectGroup>

                                        <div className="col-span-2 grid grid-cols-2 gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
                                            <h4 className="col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Capacity Config</h4>
                                            <InputGroup label="Max Volume (m³)" type="number" value={form.max_volume_m3} onChange={(v: any) => setForm({ ...form, max_volume_m3: v })} />
                                            <InputGroup label="Max Weight (kg)" type="number" value={form.max_weight_kg} onChange={(v: any) => setForm({ ...form, max_weight_kg: v })} />
                                            <InputGroup label="Internal Dimensions" value={form.internal_dims} onChange={(v: any) => setForm({ ...form, internal_dims: v })} placeholder="LxWxH" />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'customers' && (
                                    <div className="grid grid-cols-2 gap-6">
                                        <InputGroup label="Customer Name" value={form.name} onChange={(v: any) => setForm({ ...form, name: v })} required colSpan={2} />

                                        <SelectGroup label="Delivery Zone" value={form.zone} onChange={(v: any) => setForm({ ...form, zone: v })}>
                                            <option value="">Select Zone...</option>
                                            <option value="North">North (Penang/Perak)</option>
                                            <option value="Central_Left">Central Left (Klang/Shah Alam)</option>
                                            <option value="Central_Right">Central Right (KL/Rawang)</option>
                                            <option value="South">South (Johor/Melaka)</option>
                                            <option value="East">East Coast</option>
                                        </SelectGroup>

                                        <InputGroup label="Contact Person" value={form.contact_person} onChange={(v: any) => setForm({ ...form, contact_person: v })} />

                                        <InputGroup label="Phone Number" value={form.phone} onChange={(v: any) => setForm({ ...form, phone: v })} />
                                        <InputGroup label="Full Address" value={form.address} onChange={(v: any) => setForm({ ...form, address: v })} colSpan={2} />
                                        <InputGroup label="Legacy Code" value={form.customer_code} onChange={(v: any) => setForm({ ...form, customer_code: v })} placeholder="e.g. 302-C0001" />

                                        <div className="col-span-2 grid grid-cols-2 gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
                                            <h4 className="col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Truck size={12} /> GPS Coordination</h4>
                                            <InputGroup label="Latitude" type="number" value={form.lat} onChange={(v: any) => setForm({ ...form, lat: v })} />
                                            <InputGroup label="Longitude" type="number" value={form.lng} onChange={(v: any) => setForm({ ...form, lng: v })} />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'items' && (
                                    <div className="grid grid-cols-2 gap-6">
                                        <InputGroup label="SKU Code" value={form.sku} onChange={(v: any) => setForm({ ...form, sku: v })} disabled={selectedItem.id !== 'NEW'} required />
                                        <InputGroup label="Product Name" value={form.name} onChange={(v: any) => setForm({ ...form, name: v })} required />

                                        <div className="col-span-2 p-4 bg-white/5 rounded-xl border border-white/5 grid grid-cols-3 gap-4">
                                            <InputGroup label="Weight (kg/unit)" type="number" value={form.weight_kg} onChange={(v: any) => setForm({ ...form, weight_kg: v })} />
                                            <InputGroup label="Volume (m³/unit)" type="number" value={form.volume_m3} onChange={(v: any) => setForm({ ...form, volume_m3: v })} />
                                            <InputGroup label="Pack Dims" value={form.pack_dims} onChange={(v: any) => setForm({ ...form, pack_dims: v })} placeholder="LxWxH" />
                                        </div>
                                        <InputGroup label="Description" value={form.description} onChange={(v: any) => setForm({ ...form, description: v })} colSpan={2} />
                                    </div>
                                )}

                                {activeTab === 'machines' && (
                                    <div className="space-y-4">
                                        <InputGroup label="Machine ID" value={form.machine_id} onChange={(v: any) => setForm({ ...form, machine_id: v })} disabled={selectedItem.id !== 'NEW'} />
                                        <InputGroup label="Machine Name" value={form.name} onChange={(v: any) => setForm({ ...form, name: v })} />
                                        <InputGroup label="Type / Model" value={form.type} onChange={(v: any) => setForm({ ...form, type: v })} />
                                        <InputGroup label="Factory ID" value={form.factory_id} onChange={(v: any) => setForm({ ...form, factory_id: v })} />
                                    </div>
                                )}

                                {activeTab === 'factories' && (
                                    <div className="grid grid-cols-2 gap-6">
                                        <InputGroup label="Factory ID" value={form.factory_id} onChange={(v: any) => setForm({ ...form, factory_id: v })} disabled={selectedItem.id !== 'NEW'} required />
                                        <InputGroup label="Factory Name" value={form.name} onChange={(v: any) => setForm({ ...form, name: v })} required />
                                        <InputGroup label="Location Name" value={form.location_name} onChange={(v: any) => setForm({ ...form, location_name: v })} colSpan={2} />

                                        <div className="col-span-2 grid grid-cols-2 gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
                                            <h4 className="col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Truck size={12} /> GPS Coordination</h4>
                                            <InputGroup label="Latitude" type="number" value={form.lat} onChange={(v: any) => setForm({ ...form, lat: v })} />
                                            <InputGroup label="Longitude" type="number" value={form.lng} onChange={(v: any) => setForm({ ...form, lng: v })} />
                                        </div>
                                    </div>
                                )}

                                {/* GENERIC FALLBACK FOR OTHERS */}
                                {['partners', 'recipes'].includes(activeTab) && (
                                    <div className="text-gray-500 italic p-4 border border-dashed border-white/10 rounded-xl">
                                        Generic editor for {activeTab} coming soon.
                                        <pre className="text-xs mt-2 text-gray-600 overflow-auto">{JSON.stringify(form, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- COMMAND DECK (Overview) ---
                    <CommandDeck totalItems={data.length} activeTab={activeTab} data={data} />
                )}
            </div>

            {/* AIChatWidget Overlay */}
            <AIChatWidget
                contextData={{ activeTab, data }}
                onAction={handleAIAction}
            />

            {/* TOAST */}
            {
                notification && (
                    <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-10 z-50 ${notification.type === 'success' ? 'bg-[#18181b] border-green-500/30 text-green-400' : 'bg-[#18181b] border-red-500/30 text-red-400'
                        }`}>
                        {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span className="font-bold text-sm">{notification.msg}</span>
                        <button onClick={() => setNotification(null)} className="ml-4 hover:text-white"><X size={14} /></button>
                    </div>
                )
            }



        </div >
    );
}

// --- UI COMPONENTS ---
const InputGroup = ({ label, value, onChange, type = 'text', required = false, disabled = false, placeholder = '', colSpan = 1, name = '' }: any) => (
    <div className={`col-span-${colSpan} group`}>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 group-focus-within:text-indigo-400 transition-colors">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            name={name}
            className={`w-full bg-[#18181b] border ${disabled ? 'border-transparent text-gray-600 cursor-not-allowed' : 'border-white/10 group-focus-within:border-indigo-500/50'} rounded-xl py-3 px-4 text-sm text-gray-200 focus:outline-none focus:bg-[#1e1e24] transition-all`}
        />
    </div>
);

const SelectGroup = ({ label, value, onChange, children, required = false }: any) => (
    <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-[#18181b] border border-white/10 rounded-xl py-3 px-4 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 appearance-none"
            >
                {children}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <ChevronRight size={14} className="rotate-90" />
            </div>
        </div>
    </div>
);
