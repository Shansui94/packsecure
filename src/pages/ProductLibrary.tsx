
import React, { useState, useEffect } from 'react';
import { Search, Package, Layers, Info, Box, Activity, Component, Share2, Printer, Edit3, Hexagon, Download } from 'lucide-react';
import { getV2Items, getProducibleRecipes, getRecipeDetails, getInventoryStatus, createItemV2, updateItemV2 } from '../services/apiV2';
import { V2Item, V2RecipeHeader, V2RecipeItem } from '../types/v2';

// --- COMPONENTS ---

const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4 flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-${color}-500/10 text-${color}-400`}>
            <Icon size={20} />
        </div>
        <div>
            <div className="text-gray-500 text-xs uppercase tracking-wider font-bold mb-1">{label}</div>
            <div className="text-2xl font-mono font-bold text-white">{value}</div>
        </div>
    </div>
);

const HoloCard = ({ item, stock, onClick }: { item: V2Item, stock?: number, onClick: () => void }) => {
    const isRaw = item.type === 'Raw';
    const accentColor = isRaw ? 'blue' : item.type === 'FG' ? 'green' : 'purple';

    // Real Stock Logic
    const currentStock = stock || 0;
    const isLowStock = currentStock < (item.min_stock_level || 500);

    return (
        <div
            onClick={onClick}
            className={`group relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-${accentColor}-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:-translate-y-1`}
        >
            {/* Top Decoration Line */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-${accentColor}-500 to-transparent opacity-50`} />

            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-gray-950 p-2 rounded-lg border border-gray-800 group-hover:border-gray-700">
                        {isRaw ? <Hexagon size={24} className="text-blue-400" /> : <Package size={24} className={`text-${accentColor}-400`} />}
                    </div>
                    <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded bg-${accentColor}-900/30 text-${accentColor}-400 border border-${accentColor}-500/20`}>
                        {item.type}
                    </div>
                </div>

                <h3 className="font-mono text-lg font-bold text-white mb-1">{item.sku}</h3>
                <p className="text-sm text-gray-400 line-clamp-1 mb-4 h-5">{item.name}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <div className="text-right w-full">
                        <span className={`text-xs font-mono font-bold ${isLowStock ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                            {currentStock} {item.uom}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- ITEM FORM MODAL ---
const ItemFormModal = ({
    isOpen,
    onClose,
    initialData,
    onSave
}: {
    isOpen: boolean;
    onClose: () => void;
    initialData: V2Item | null;
    onSave: (data: V2Item) => Promise<void>;
}) => {
    const [formData, setFormData] = useState<Partial<V2Item>>({});
    const [loading, setLoading] = useState(false);
    const isEdit = !!initialData;

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData || {
                sku: '',
                name: '',
                type: 'Raw',
                supply_type: 'Purchased',
                status: 'Active',
                uom: 'kg',
                min_stock_level: 1000
            });
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData as V2Item);
            onClose();
        } catch (err: any) {
            alert("Error saving: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof V2Item, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {isEdit ? <Edit3 size={20} className="text-cyan-400" /> : <Package size={20} className="text-green-400" />}
                            {isEdit ? 'Edit Blueprint' : 'New Blueprint'}
                        </h2>
                        <button type="button" onClick={onClose} className="text-gray-500 hover:text-white"><Hexagon size={20} className="rotate-45" /></button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Identity Section */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">SKU Identity</label>
                                <input
                                    required
                                    disabled={isEdit}
                                    value={formData.sku || ''}
                                    onChange={e => handleChange('sku', e.target.value.toUpperCase())}
                                    className={`w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white font-mono focus:border-cyan-500 outline-none ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="e.g. R-ABS-001"
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Item Name</label>
                                <input
                                    required
                                    value={formData.name || ''}
                                    onChange={e => handleChange('name', e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                                    placeholder="Descriptive Name"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Type</label>
                                <select
                                    value={formData.type || 'Raw'}
                                    onChange={e => {
                                        const newType = e.target.value as any;
                                        setFormData(prev => ({
                                            ...prev,
                                            type: newType,
                                            supply_type: newType === 'Raw' ? 'Purchased' : 'Manufactured'
                                        }));
                                    }}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500"
                                >
                                    <option value="Raw">Raw Material</option>
                                    <option value="FG">Finished Good</option>
                                    <option value="WiP">Work in Progress</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Source</label>
                                <select
                                    value={formData.supply_type || 'Manufactured'}
                                    onChange={e => handleChange('supply_type', e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500"
                                >
                                    <option value="Manufactured">Manufactured (自产)</option>
                                    <option value="Purchased">Purchased (外购)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Status</label>
                                <select
                                    value={formData.status || 'Active'}
                                    onChange={e => handleChange('status', e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Obsolete">Obsolete</option>
                                </select>
                            </div>
                        </div>

                        {/* Specs Section */}
                        <div className="p-4 bg-gray-950/50 rounded-xl border border-gray-800">
                            <h3 className="text-xs font-bold text-cyan-400 uppercase mb-4 flex items-center gap-2"><Activity size={14} /> Technical Specs</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Width (mm)</label>
                                    <input type="number" step="any" value={formData.width_mm || ''} onChange={e => handleChange('width_mm', parseFloat(e.target.value))} className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Length (m)</label>
                                    <input type="number" step="any" value={formData.length_m || ''} onChange={e => handleChange('length_m', parseFloat(e.target.value))} className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Thickness (mic)</label>
                                    <input type="number" step="any" value={formData.thickness_mic || ''} onChange={e => handleChange('thickness_mic', parseFloat(e.target.value))} className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Net Weight (kg)</label>
                                    <input type="number" step="any" value={formData.net_weight_kg || ''} onChange={e => handleChange('net_weight_kg', parseFloat(e.target.value))} className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Gross Weight (kg)</label>
                                    <input type="number" step="any" value={formData.gross_weight_kg || ''} onChange={e => handleChange('gross_weight_kg', parseFloat(e.target.value))} className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Unit (UOM)</label>
                                    <input type="text" value={formData.uom || 'kg'} onChange={e => handleChange('uom', e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white text-sm" />
                                </div>
                            </div>
                        </div>

                        {/* Commercial Section */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Supplier / Brand</label>
                                <input value={formData.supplier || ''} onChange={e => handleChange('supplier', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-sm text-white" placeholder="Supplier Name" />
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Min Stock (Alert Level)</label>
                                <input type="number" value={formData.min_stock_level || ''} onChange={e => handleChange('min_stock_level', parseFloat(e.target.value))} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-sm text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-800 bg-gray-950/50 flex justify-end gap-3 mt-auto">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white font-medium">Cancel</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-900/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? <Activity className="animate-spin" size={16} /> : <Share2 size={16} />}
                            {isEdit ? 'Save Changes' : 'Create Blueprint'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---

const ProductLibrary: React.FC = () => {
    const [items, setItems] = useState<V2Item[]>([]);
    const [stockMap, setStockMap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('All');

    // Selected Item state
    const [selectedItem, setSelectedItem] = useState<V2Item | null>(null);
    const [recipes, setRecipes] = useState<V2RecipeHeader[]>([]);
    const [selectedRecipe, setSelectedRecipe] = useState<V2RecipeHeader | null>(null);
    const [recipeDetails, setRecipeDetails] = useState<V2RecipeItem[]>([]);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<V2Item | null>(null);

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        setLoading(true);
        // Parallel Fetch: Items Detail + Inventory Snapshot
        const [itemsData, stockData] = await Promise.all([
            getV2Items(),
            getInventoryStatus()
        ]);

        setItems(itemsData);

        // Transform stock array to map for O(1) lookup
        const sMap: Record<string, number> = {};
        stockData.forEach(s => {
            sMap[s.sku] = s.current_stock;
        });
        setStockMap(sMap);

        setLoading(false);
    };

    // Data Filtering
    const filteredItems = items.filter(item => {
        const matchesSearch =
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'All' || item.type === filterType;
        return matchesSearch && matchesType;
    });

    // Stats Calculation using Real Data
    const lowStockCount = items.filter(i => {
        const stock = stockMap[i.sku] || 0;
        return stock < (i.min_stock_level || 500);
    }).length;

    const stats = {
        total: items.length,
        raw: items.filter(i => i.type === 'Raw').length,
        fg: items.filter(i => i.type === 'FG').length
    };

    const handleItemClick = async (item: V2Item) => {
        setSelectedItem(item);
        setRecipes([]);
        setSelectedRecipe(null);
        setRecipeDetails([]);

        if (item.type === 'FG' || item.type === 'WiP') {
            const itemRecipes = await getProducibleRecipes(item.sku);
            setRecipes(itemRecipes);
            if (itemRecipes.length > 0) {
                const def = itemRecipes.find(r => r.is_default) || itemRecipes[0];
                handleRecipeSelect(def);
            }
        }
    };

    const handleRecipeSelect = async (recipe: V2RecipeHeader) => {
        setSelectedRecipe(recipe);
        const details = await getRecipeDetails(recipe.recipe_id);
        setRecipeDetails(details);
    };

    // ITEM CRUD HANDLERS
    const handleCreateNew = () => {
        setEditingItem(null); // Empty for new
        setIsEditModalOpen(true);
    };

    const handleEditItem = (item?: V2Item) => {
        const target = item || selectedItem;
        if (!target) return;
        setEditingItem(target);
        setIsEditModalOpen(true);
    };

    const handleSaveItem = async (data: V2Item) => {
        if (editingItem) {
            // Update
            await updateItemV2(data.sku, data);

            // Update local state
            setItems(prev => prev.map(i => i.sku === data.sku ? { ...i, ...data } : i));
            if (selectedItem?.sku === data.sku) setSelectedItem({ ...selectedItem, ...data });
        } else {
            // Create
            if (items.some(i => i.sku === data.sku)) {
                throw new Error("SKU already exists!");
            }
            await createItemV2(data);
            setItems(prev => [...prev, data]);
        }
        loadItems(); // Refresh full data to be safe
    };

    const handleExport = () => {
        if (!items.length) {
            alert('No items to export.');
            return;
        }

        const headers = ['SKU', 'Name', 'Type', 'Unit', 'Net Weight (kg)', 'Gross Weight (kg)', 'Status'];

        const rows = items.map(item => {
            const safeName = item.name.includes(',') ? `"${item.name}"` : item.name;
            return [
                item.sku,
                safeName,
                item.type,
                item.uom,
                item.net_weight_kg || 0,
                item.gross_weight_kg || 0,
                item.status
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `product_library_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-cyan-500/30">
            {/* Background Grid */}
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            <div className="relative flex h-screen overflow-hidden">

                {/* --- LEFT: MAIN DASHBOARD --- */}
                <div className={`flex-1 flex flex-col transition-all duration-500 ${selectedItem ? 'mr-[500px]' : ''}`}>

                    {/* COMMAND DECK (Header) */}
                    <header className="p-6 border-b border-gray-800 bg-gray-950/80 backdrop-blur z-10">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <Component className="text-cyan-400" />
                                    Blueprint Archive <span className="text-gray-600 text-sm font-normal">v3.0</span>
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">Master Data & Technical Specifications</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleExport}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg text-gray-300 border border-gray-700 transition-colors"
                                >
                                    <Download size={16} />
                                    Export CSV
                                </button>
                                <button
                                    onClick={handleCreateNew}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-sm font-medium rounded-lg text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all"
                                >
                                    + New Item
                                </button>
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <StatCard label="Total Items" value={stats.total} icon={Box} color="cyan" />
                            <StatCard label="Raw Materials" value={stats.raw} icon={Hexagon} color="blue" />
                            <StatCard label="Finished Goods" value={stats.fg} icon={Package} color="green" />
                            <StatCard label="Low Stock Alerts" value={lowStockCount} icon={Activity} color="red" />
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-3 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by SKU, Name, or Brand..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-gray-200 placeholder-gray-600 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
                                {['All', 'FG', 'WiP', 'Raw', 'Spare'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filterType === type
                                            ? 'bg-gray-800 text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </header>

                    {/* GRID CONTENT */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse">
                                Loading Blueprints...
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                {filteredItems.map(item => (
                                    <HoloCard
                                        key={item.sku}
                                        item={item}
                                        stock={stockMap[item.sku]}
                                        onClick={() => handleItemClick(item)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- RIGHT: BLUEPRINT DETAIL PANEL --- */}
                <div className={`fixed top-0 right-0 h-full w-[500px] bg-gray-950/95 backdrop-blur-xl border-l border-gray-800 shadow-2xl transform transition-transform duration-300 z-20 ${selectedItem ? 'translate-x-0' : 'translate-x-full'}`}>
                    {selectedItem && (
                        <div className="h-full flex flex-col">
                            {/* Detail Header */}
                            <div className="p-6 border-b border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`text-xs font-bold px-2 py-1 rounded bg-gray-800 text-blue-400 border border-blue-500/30`}>
                                        {selectedItem.type.toUpperCase()}
                                    </div>
                                    <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white">
                                        &times; Close
                                    </button>
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">{selectedItem.sku}</h2>
                                <p className="text-gray-400 text-sm mb-4">{selectedItem.name}</p>

                                {/* Quick Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditItem()}
                                        className="flex-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-2"
                                    >
                                        <Edit3 size={14} /> Edit
                                    </button>
                                    <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-2">
                                        <Printer size={14} /> Label
                                    </button>
                                </div>
                            </div>

                            {/* Detail Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                                {/* Spec Sheet Grid */}
                                <section>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Info size={14} /> Specifications
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                                            <div className="text-gray-500 text-xs mb-1">Dimensions</div>
                                            <div className="text-white font-mono">{selectedItem.width_mm || '-'}mm x {selectedItem.length_m || '-'}m</div>
                                        </div>
                                        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                                            <div className="text-gray-500 text-xs mb-1">Thickness</div>
                                            <div className="text-white font-mono">{selectedItem.thickness_mic || '-'} mic</div>
                                        </div>
                                        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                                            <div className="text-gray-500 text-xs mb-1">Net Weight</div>
                                            <div className="text-white font-mono">{selectedItem.net_weight_kg || '-'} kg</div>
                                        </div>
                                        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                                            <div className="text-gray-500 text-xs mb-1">Gross Weight</div>
                                            <div className="text-white font-mono">{selectedItem.gross_weight_kg || '-'} kg</div>
                                        </div>
                                    </div>
                                </section>

                                {/* V3 Data: Commercial Info */}
                                <section>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Share2 size={14} /> Commercial
                                    </h3>
                                    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
                                        <div className="p-4 flex justify-between">
                                            <span className="text-gray-500 text-sm">Supplier</span>
                                            <span className="text-white font-medium">{selectedItem.supplier || '-'}</span>
                                        </div>
                                        <div className="p-4 flex justify-between">
                                            <span className="text-gray-500 text-sm">Brand</span>
                                            <span className="text-white font-medium">{selectedItem.brand || '-'}</span>
                                        </div>
                                        <div className="p-4 flex justify-between">
                                            <span className="text-gray-500 text-sm">Legacy Code</span>
                                            <span className="text-purple-400 font-mono text-sm">{selectedItem.legacy_code || '-'}</span>
                                        </div>
                                    </div>
                                </section>

                                {/* Recipe Layer Stack (For Products) */}
                                {(selectedItem.type === 'FG' || selectedItem.type === 'WiP') && (
                                    <section>
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Layers size={14} /> Recipe Composition
                                        </h3>

                                        {!loading && recipes.length > 0 ? (
                                            <div className="space-y-4">
                                                <select
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 outline-none"
                                                    value={selectedRecipe?.recipe_id}
                                                    onChange={(e) => {
                                                        const r = recipes.find(rec => rec.recipe_id === e.target.value);
                                                        if (r) handleRecipeSelect(r);
                                                    }}
                                                >
                                                    {recipes.map(r => (
                                                        <option key={r.recipe_id} value={r.recipe_id}>
                                                            {r.name} {r.is_default ? '(Default)' : ''}
                                                        </option>
                                                    ))}
                                                </select>

                                                <div className="space-y-2">
                                                    {recipeDetails.map((layer, idx) => (
                                                        <div key={idx} className="relative group">
                                                            {/* Layer Visualization Bar */}
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-l" />

                                                            <div className="bg-gray-800/40 p-3 pl-5 rounded-r border border-gray-800/50 flex justify-between items-center group-hover:bg-gray-800 transition-colors">
                                                                <div>
                                                                    <div className="text-white font-mono text-sm font-bold">{layer.material_sku}</div>
                                                                    <div className="text-gray-500 text-xs">{(layer as any).material?.name}</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-blue-400 font-mono text-sm">{layer.qty_calculated} kg</div>
                                                                    <div className="text-gray-600 text-[10px]">Ratio: {layer.ratio_percentage || '-'}%</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 border border-dashed border-gray-800 rounded-xl text-center text-gray-600 text-sm">
                                                No recipe data linked.
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* MODAL */}
            <ItemFormModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                initialData={editingItem}
                onSave={handleSaveItem}
            />
        </div>
    );
};

export default ProductLibrary;
