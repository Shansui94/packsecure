import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import Papa from 'papaparse';
import {
    Search, Plus, Save, Trash2, Database, Truck, Users,
    Package, Settings, Box, ChevronRight, LayoutGrid, FlaskConical,
    AlertCircle, CheckCircle, X, Download, Upload
} from 'lucide-react';

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

export default function DataManagement() {
    // STATE
    const [activeTab, setActiveTab] = useState<TabType>('items');
    const [data, setData] = useState<DataItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState<DataItem | null>(null);
    const [form, setForm] = useState<any>({});
    const [isDirty, setIsDirty] = useState(false);

    // NOTIFICATION
    const [notification, setNotification] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                    query = supabase.from('master_items_v2').select('*').order('sku').limit(200);
                    mapFn = (i) => ({ ...i, id: i.sku, title: i.name, subtitle: i.sku });
                    break;
                case 'vehicles':
                    query = supabase.from('sys_vehicles').select('*').order('id');
                    mapFn = (i) => ({ ...i, id: i.id, title: i.plate_number, subtitle: `${i.max_volume_m3}m³ • ${i.status}` });
                    break;
                case 'customers':
                    query = supabase.from('sys_customers').select('*').order('name').limit(200);
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
                    query = supabase.from('bom_headers_v2').select('*, bom_items_v2(*)').order('created_at', { ascending: false }).limit(50);
                    mapFn = (i) => ({ ...i, id: i.recipe_id, title: i.product_sku, subtitle: `${i.bom_items_v2?.length || 0} Ingredients` });
                    break;
                case 'factories':
                    query = supabase.from('sys_factories_v2').select('*').order('factory_id');
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
                case 'factories': table = 'sys_factories_v2'; pk = 'factory_id'; break;
            }

            const payload = { ...form };
            // Remove UI-only fields
            delete payload.title;
            delete payload.subtitle;
            delete payload.bom_items_v2; // Don't save nested relations directly here for now

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
                case 'factories': table = 'sys_factories_v2'; pkField = 'factory_id'; break;
            }

            const id = form[pkField] || selectedItem.id;
            const { error } = await supabase.from(table).delete().eq(pkField, id);
            if (error) throw error;

            showToast('Record Deleted', 'success');
            fetchData();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
        const handleExport = () => {
            if (!filteredData || filteredData.length === 0) {
                showToast('No data to export', 'error');
                return;
            }

            // Clean data for export: Remove internal UI fields like 'title', 'subtitle'
        };

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

        return (
            <div className="h-full bg-[#09090b] flex flex-col md:flex-row text-slate-300 font-sans overflow-hidden">

                {/* 1. SIDEBAR TABS */}
                <div className="w-full md:w-20 bg-[#121215] border-r border-white/5 flex md:flex-col items-center py-4 gap-4 overflow-x-auto md:overflow-visible shrink-0 z-20 shadow-xl">
                    <div className="hidden md:flex w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 items-center justify-center font-black text-white shadow-lg shadow-indigo-500/20">D</div>
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
                    <div className="p-4 border-b border-white/5 flex flex-col gap-3 backdrop-blur-md sticky top-0 bg-[#0c0c0e]/95 z-20">
                        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            {TABS.find(t => t.id === activeTab)?.label}
                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-400 font-normal">{data.length}</span>
                        </h2>
                        <div className="relative group">
                            <Search className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-[#18181b] border-white/5 border rounded-xl py-2 pl-9 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-[#1e1e24] transition-all"
                                placeholder="Search records..."
                            />
                        </div>

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
                                className="flex-1 p-2.5 rounded-xl border border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-gray-400 hover:text-indigo-400 text-sm font-bold flex items-center justify-center gap-2 transition-all bg-[#0c0c0e]"
                            >
                                <Plus size={16} /> New
                            </button>
                            <button
                                onClick={handleExport}
                                className="p-2.5 rounded-xl border border-dashed border-white/10 hover:border-green-500/50 hover:bg-green-500/5 text-gray-400 hover:text-green-400 text-sm font-bold flex items-center justify-center gap-2 transition-all bg-[#0c0c0e]"
                                title="Export CSV"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={handleImportClick}
                                className="p-2.5 rounded-xl border border-dashed border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 text-gray-400 hover:text-orange-400 text-sm font-bold flex items-center justify-center gap-2 transition-all bg-[#0c0c0e]"
                                title="Import CSV"
                            >
                                <Upload size={16} />
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
                </div>

                {/* 3. DETAIL VIEW */}
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
                                            <InputGroup label="Vehicle ID" name="id" value={form.id} onChange={(v) => setForm({ ...form, id: v })} disabled={selectedItem.id !== 'NEW'} required />
                                            <InputGroup label="Plate Number" name="plate_number" value={form.plate_number} onChange={(v) => setForm({ ...form, plate_number: v })} required />

                                            <SelectGroup label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
                                                <option value="Available">Available</option>
                                                <option value="On-Route">On-Route</option>
                                                <option value="Maintenance">Maintenance</option>
                                            </SelectGroup>

                                            <div className="col-span-2 grid grid-cols-2 gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
                                                <h4 className="col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Capacity Config</h4>
                                                <InputGroup label="Max Volume (m³)" type="number" value={form.max_volume_m3} onChange={(v) => setForm({ ...form, max_volume_m3: v })} />
                                                <InputGroup label="Max Weight (kg)" type="number" value={form.max_weight_kg} onChange={(v) => setForm({ ...form, max_weight_kg: v })} />
                                                <InputGroup label="Internal Dimensions" value={form.internal_dims} onChange={(v) => setForm({ ...form, internal_dims: v })} placeholder="LxWxH" />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'customers' && (
                                        <div className="grid grid-cols-2 gap-6">
                                            <InputGroup label="Customer Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required colSpan={2} />

                                            <SelectGroup label="Delivery Zone" value={form.zone} onChange={(v) => setForm({ ...form, zone: v })}>
                                                <option value="">Select Zone...</option>
                                                <option value="North">North (Penang/Perak)</option>
                                                <option value="Central_Left">Central Left (Klang/Shah Alam)</option>
                                                <option value="Central_Right">Central Right (KL/Rawang)</option>
                                                <option value="South">South (Johor/Melaka)</option>
                                                <option value="East">East Coast</option>
                                            </SelectGroup>

                                            <InputGroup label="Contact Person" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} />

                                            <InputGroup label="Phone Number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                                            <InputGroup label="Full Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} colSpan={2} />

                                            <div className="col-span-2 grid grid-cols-2 gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
                                                <h4 className="col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Truck size={12} /> GPS Coordination</h4>
                                                <InputGroup label="Latitude" type="number" value={form.lat} onChange={(v) => setForm({ ...form, lat: v })} />
                                                <InputGroup label="Longitude" type="number" value={form.lng} onChange={(v) => setForm({ ...form, lng: v })} />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'items' && (
                                        <div className="grid grid-cols-2 gap-6">
                                            <InputGroup label="SKU Code" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} disabled={selectedItem.id !== 'NEW'} required />
                                            <InputGroup label="Product Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />

                                            <div className="col-span-2 p-4 bg-white/5 rounded-xl border border-white/5 grid grid-cols-3 gap-4">
                                                <InputGroup label="Weight (kg/unit)" type="number" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} />
                                                <InputGroup label="Volume (m³/unit)" type="number" value={form.volume_m3} onChange={(v) => setForm({ ...form, volume_m3: v })} />
                                                <InputGroup label="Pack Dims" value={form.pack_dims} onChange={(v) => setForm({ ...form, pack_dims: v })} placeholder="LxWxH" />
                                            </div>
                                            <InputGroup label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} colSpan={2} />
                                        </div>
                                    )}

                                    {activeTab === 'machines' && (
                                        <div className="space-y-4">
                                            <InputGroup label="Machine ID" value={form.machine_id} onChange={(v) => setForm({ ...form, machine_id: v })} disabled={selectedItem.id !== 'NEW'} />
                                            <InputGroup label="Machine Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                                            <InputGroup label="Type / Model" value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
                                            <InputGroup label="Factory ID" value={form.factory_id} onChange={(v) => setForm({ ...form, factory_id: v })} />
                                        </div>
                                    )}

                                    {activeTab === 'factories' && (
                                        <div className="grid grid-cols-2 gap-6">
                                            <InputGroup label="Factory ID" value={form.factory_id} onChange={(v) => setForm({ ...form, factory_id: v })} disabled={selectedItem.id !== 'NEW'} required />
                                            <InputGroup label="Factory Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
                                            <InputGroup label="Location Name" value={form.location_name} onChange={(v) => setForm({ ...form, location_name: v })} colSpan={2} />

                                            <div className="col-span-2 grid grid-cols-2 gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
                                                <h4 className="col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Truck size={12} /> GPS Coordination</h4>
                                                <InputGroup label="Latitude" type="number" value={form.lat} onChange={(v) => setForm({ ...form, lat: v })} />
                                                <InputGroup label="Longitude" type="number" value={form.lng} onChange={(v) => setForm({ ...form, lng: v })} />
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
                        // EMPTY STATE
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 animate-pulse">
                                <Database size={40} className="opacity-20" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-500">Select an item to view details</h3>
                            <p className="text-sm text-gray-700 mt-2">Or click "Create New" to add a record</p>
                        </div>
                    )}
                </div>

                {/* TOAST */}
                {notification && (
                    <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-10 z-50 ${notification.type === 'success' ? 'bg-[#18181b] border-green-500/30 text-green-400' : 'bg-[#18181b] border-red-500/30 text-red-400'
                        }`}>
                        {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span className="font-bold text-sm">{notification.msg}</span>
                        <button onClick={() => setNotification(null)} className="ml-4 hover:text-white"><X size={14} /></button>
                    </div>
                )}
            </div>
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


