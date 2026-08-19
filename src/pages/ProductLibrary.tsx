
import React, { useState, useEffect } from 'react';
import { Search, Package, Layers, Info, Box, Activity, Component, Share2, Printer, Edit3, Hexagon, Download, Zap, Eye } from 'lucide-react';
import { getV2Items, getProducibleRecipes, getRecipeDetails, getInventoryStatus, createItemV2, updateItemV2 } from '../services/apiV2';
import { V2Item, V2RecipeHeader, V2RecipeItem } from '../types/v2';
import { ProductLayer, ProductMaterial, ProductSize, PackagingColor } from '../types';
import { PRODUCT_LAYERS, PRODUCT_MATERIALS, PACKAGING_COLORS, PRODUCT_SIZES } from '../data/constants';
import { getBubbleWrapSku } from '../utils/skuMapper';
import { getRollsPerSet } from '../utils/packagingRules';
import { supabase } from '../services/supabase';
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
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

// --- BW SKU GENERATOR ---
const BubbleWrapGenerator = ({
    onClose,
    onSave
}: {
    onClose: () => void;
    onSave: () => void;
}) => {
    const { t } = useTranslation();
    const [layer, setLayer] = useState<ProductLayer>('Single');
    const [material, setMaterial] = useState<ProductMaterial>('Clear');
    const [size, setSize] = useState<ProductSize>('25cm');
    const [rolls, setRolls] = useState<number>(4);
    const [packColor, setPackColor] = useState<PackagingColor>('Green');
    const [customName, setCustomName] = useState('');
    const [saving, setSaving] = useState(false);
    const [skuExists, setSkuExists] = useState<boolean | null>(null);

    // Auto-calculate rolls when size changes
    useEffect(() => {
        const defaultRolls = getRollsPerSet(size);
        setRolls(defaultRolls);
    }, [size]);

    // Generate SKU in real-time
    const generatedSku = getBubbleWrapSku(layer, material, size, rolls, packColor);

    // Check if SKU already exists (debounced)
    useEffect(() => {
        setSkuExists(null);
        const timer = setTimeout(async () => {
            const { data } = await supabase
                .from('master_items_v2')
                .select('sku')
                .eq('sku', generatedSku)
                .maybeSingle();
            setSkuExists(!!data);
        }, 300);
        return () => clearTimeout(timer);
    }, [generatedSku]);

    const layerLabel = layer === 'Single' ? 'Single Layer' : 'Double Layer';
    const matLabel = PRODUCT_MATERIALS.find(m => m.value === material)?.label.split(' ')[0] || material;
    const packLabel = PACKAGING_COLORS.find(c => c.value === packColor)?.label.split(' ')[0] || packColor;
    const autoName = `${layerLabel} ${matLabel} Bubble Wrap 100m×${size.replace('cm', '')}cm ${rolls} Roll${rolls > 1 ? 's' : ''} (${packLabel})`;
    const finalName = customName || autoName;

    const handleSave = async () => {
        if (skuExists) {
            alert('⚠️ This SKU already exists in the system!');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase.from('master_items_v2').insert({
                sku: generatedSku,
                name: finalName,
                type: 'FG',
                status: 'Active',
                uom: 'Roll',
                supply_type: 'Manufactured',
                width_mm: parseInt(size) * 10,
                length_m: 100,
            });
            if (error) throw error;
            onSave();
            onClose();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };



    return (
        <div className="p-6 space-y-6">
            {/* SKU LIVE PREVIEW */}
            <div className="relative overflow-hidden rounded-xl border-2 border-cyan-500/30 bg-gradient-to-r from-cyan-950/50 to-gray-950 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-cyan-500/5 -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-center gap-2 mb-2">
                    <Eye size={14} className="text-cyan-400" />
                    <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-widest">Live Preview</span>
                </div>
                <div className="text-2xl font-mono font-black text-white tracking-tight mb-1">
                    {generatedSku}
                </div>
                <div className="text-sm text-gray-400">{finalName}</div>
                {skuExists === true && (
                    <div className="mt-2 text-xs text-red-400 font-bold animate-pulse">⚠️ SKU already exists — Cannot create duplicate</div>
                )}
                {skuExists === false && (
                    <div className="mt-2 text-xs text-green-400 font-bold">✅ New SKU — Ready to create</div>
                )}
            </div>

            {/* ITEM NAME */}
            <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Item Name product name')}</label>
                <input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder={autoName}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white text-sm focus:border-cyan-500 outline-none placeholder:text-gray-600"
                />
                <div className="text-[10px] text-gray-600 mt-1">Leave empty to use auto-generated name</div>
            </div>

            {/* PARAMETER GRID */}
            <div className="grid grid-cols-2 gap-4">
                {/* Layer */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Layer number')}</label>
                    <div className="flex gap-2">
                        {PRODUCT_LAYERS.map(l => (
                            <button
                                key={l.value}
                                onClick={() => setLayer(l.value as ProductLayer)}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all border ${layer === l.value
                                    ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                                    : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-700'
                                    }`}
                            >
                                <div className="text-lg">{l.code}</div>
                                <div className="text-[10px] mt-0.5 opacity-70">{l.value === 'Single' ? t('single layer') : t('Double layer')}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Material */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Material material')}</label>
                    <div className="flex gap-2">
                        {PRODUCT_MATERIALS.map(m => (
                            <button
                                key={m.value}
                                onClick={() => setMaterial(m.value as ProductMaterial)}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all border ${material === m.value
                                    ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_12px_rgba(147,51,234,0.15)]'
                                    : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-700'
                                    }`}
                            >
                                <div className="text-lg">{m.code}</div>
                                <div className="text-[10px] mt-0.5 opacity-70">{m.label.split(' ')[0]}</div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Size + Rolls */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Size width')}</label>
                    <div className="flex gap-1.5">
                        {PRODUCT_SIZES.map(s => (
                            <button
                                key={s.value}
                                onClick={() => setSize(s.value as ProductSize)}
                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all border ${size === s.value
                                    ? 'bg-green-600/20 border-green-500 text-green-400'
                                    : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-700'
                                    }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Rolls')}</label>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setRolls(Math.max(1, rolls - 1))}
                            className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-800 text-white font-bold hover:bg-gray-800 text-lg"
                        >−</button>
                        <div className="flex-1 text-center">
                            <div className="text-3xl font-mono font-black text-white">{rolls}</div>
                            <div className="text-[10px] text-gray-600">ROLL{rolls > 1 ? 'S' : ''}</div>
                        </div>
                        <button
                            onClick={() => setRolls(Math.min(10, rolls + 1))}
                            className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-800 text-white font-bold hover:bg-gray-800 text-lg"
                        >+</button>
                    </div>
                </div>
            </div>

            {/* Packaging Color */}
            <div>
                <div className="mb-2">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{t('Packaging Color packaging color')}</label>
                </div>
                <div className="flex gap-2">
                    {PACKAGING_COLORS.map(c => (
                        <button
                            key={c.value}
                            onClick={() => setPackColor(c.value as PackagingColor)}
                            className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all border relative ${packColor === c.value
                                ? 'ring-2 ring-white/40 border-white/30 scale-105'
                                : 'border-gray-800 opacity-60 hover:opacity-100'
                                }`}
                            style={{ backgroundColor: c.hex + '22', color: c.hex === '#FFFFFF' ? '#999' : c.hex }}
                        >
                            <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{ backgroundColor: c.hex, border: c.hex === '#FFFFFF' ? '1px solid #444' : 'none' }} />
                            <div>{c.code}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* SAVE BUTTON */}
            <button
                onClick={handleSave}
                disabled={saving || skuExists === true}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2
                    bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500
                    shadow-lg shadow-cyan-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {saving ? <Activity className="animate-spin" size={16} /> : <Zap size={16} />}
                {saving ? 'Creating...' : skuExists ? 'SKU Already Exists' : 'Create Product'}
            </button>
        </div>
    );
};

// --- ITEM FORM MODAL (with BW Generator Tab) ---
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
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<V2Item>>({});
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'bw' | 'generic'>('bw');
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
            // If editing, always go to generic tab
            if (initialData) setActiveTab('generic');
            else setActiveTab('bw');
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
                {/* HEADER */}
                <div className="p-5 border-b border-gray-800 bg-gray-950/50">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {isEdit ? <Edit3 size={20} className="text-cyan-400" /> : <Zap size={20} className="text-cyan-400" />}
                            {isEdit ? 'Edit Blueprint' : 'New Product'}
                        </h2>
                        <button type="button" onClick={onClose} className="text-gray-500 hover:text-white text-xl">&times;</button>
                    </div>

                    {/* TABS — only show for new items */}
                    {!isEdit && (
                        <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800">
                            <button
                                onClick={() => setActiveTab('bw')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'bw'
                                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <Zap size={14} /> BW Generator
                            </button>
                            <button
                                onClick={() => setActiveTab('generic')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'generic'
                                    ? 'bg-gray-800 text-white border border-gray-700'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <Package size={14} /> Generic Item
                            </button>
                        </div>
                    )}
                </div>

                {/* BODY */}
                {activeTab === 'bw' && !isEdit ? (
                    <BubbleWrapGenerator onClose={onClose} onSave={onClose} />
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col">
                        <div className="p-6 space-y-6">
                            {/* Identity Section */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">SKU Identity</label>
                                    <input
                                        required
                                        value={formData.sku || ''}
                                        onChange={e => handleChange('sku', e.target.value.toUpperCase())}
                                        className={`w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white font-mono focus:border-cyan-500 outline-none`}
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
                                        <option value="FG">FG</option>
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
                                        <option value="Manufactured">{t('Manufactured')}</option>
                                        <option value="Purchased">{t('Purchased')}</option>
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
                )}
            </div>
        </div>
    );
};

// --- MAIN PAGE ---


const ProductLibrary: React.FC = () => {
    const { t } = useTranslation();
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

    // AI Mapping state
    const [activeTab, setActiveTab] = useState<'blueprints' | 'ai-mappings'>('blueprints');
    const [mappings, setMappings] = useState<any[]>([]);
    const [mappingsLoading, setMappingsLoading] = useState(false);
    const [mappingSearch, setMappingSearch] = useState('');
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [modalCustomer, setModalCustomer] = useState('');
    const [modalRawName, setModalRawName] = useState('');
    const [modalSelectedSku, setModalSelectedSku] = useState('');

    const fetchMappings = async () => {
        setMappingsLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_sku_mappings')
                .select('*')
                .order('updated_at', { ascending: false });
            if (error) throw error;
            setMappings(data || []);
        } catch (err) {
            console.error("Error fetching mappings:", err);
        } finally {
            setMappingsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'ai-mappings') {
            fetchMappings();
        }
    }, [activeTab]);

    const handleSaveMapping = async () => {
        if (!modalCustomer.trim() || !modalRawName.trim() || !modalSelectedSku) {
            alert('⚠️ Please fill in all fields!');
            return;
        }
        const matchedProd = items.find(x => x.sku === modalSelectedSku);
        if (!matchedProd) return;
        try {
            const { error } = await supabase.from('customer_sku_mappings').upsert({
                customer_name: modalCustomer.trim(),
                raw_product_name: modalRawName.trim(),
                mapped_sku: modalSelectedSku,
                mapped_product_name: matchedProd.name,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'customer_name,raw_product_name'
            });
            if (error) throw error;
            setShowMappingModal(false);
            setModalCustomer('');
            setModalRawName('');
            setModalSelectedSku('');
            await fetchMappings();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const handleDeleteMapping = async (id: string) => {
        if (!confirm('Are you sure you want to delete this mapping memory?')) return;
        try {
            const { error } = await supabase.from('customer_sku_mappings').delete().eq('id', id);
            if (error) throw error;
            await fetchMappings();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        setLoading(true);
        // Parallel Fetch: Items Detail + Inventory Snapshot
        const [itemsData, stockData] = await Promise.all([
            getV2Items(true), // Fetch ALL items including Obsolete
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
    const searchTerms = searchTerm.toLowerCase().trim().split(/[\s-]+/).filter(Boolean);
    const filteredItems = items.filter(item => {
        const name = (item.name || '').toLowerCase();
        const sku = (item.sku || '').toLowerCase();
        const status = (item.status || '').toLowerCase();
        const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => name.includes(term) || sku.includes(term) || status.includes(term));
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
            await updateItemV2(editingItem.sku, data);

            // Update local state
            setItems(prev => prev.map(i => i.sku === editingItem.sku ? { ...i, ...data } : i));
            if (selectedItem?.sku === editingItem.sku) setSelectedItem({ ...selectedItem, ...data });
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
                            <StatCard label="FG" value={stats.fg} icon={Package} color="green" />
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

                    {/* TABS SELECTION */}
                    <div className="flex border-b border-gray-800 bg-gray-950 px-6 shrink-0 z-10 font-bold">
                        <button
                            onClick={() => {
                                setActiveTab('blueprints');
                                setSelectedItem(null);
                            }}
                            className={`py-3.5 px-6 text-xs uppercase tracking-wider font-black border-b-2 transition-all cursor-pointer ${
                                activeTab === 'blueprints'
                                    ? 'border-cyan-500 text-cyan-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            
                                                        {t('📦 Standard Blueprints (standard product library)')}
                                                    </button>
                        <button
                            onClick={() => {
                                setActiveTab('ai-mappings');
                                setSelectedItem(null);
                            }}
                            className={`py-3.5 px-6 text-xs uppercase tracking-wider font-black border-b-2 transition-all cursor-pointer ${
                                activeTab === 'ai-mappings'
                                    ? 'border-cyan-500 text-cyan-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            
                                                        {t('🤖 AI Alias ​​Mappings (AI alias mapping)')}
                                                    </button>
                    </div>

                    {/* TABS CONTENT */}
                    {activeTab === 'ai-mappings' ? (
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Header / Actions */}
                            <div className="flex justify-between items-center gap-4 bg-gray-900/40 p-4 border border-gray-800 rounded-xl">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by Customer or Raw Name..."
                                        value={mappingSearch}
                                        onChange={(e) => setMappingSearch(e.target.value)}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg py-2 pl-10 pr-4 text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-cyan-500 outline-none text-xs"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        setModalCustomer('');
                                        setModalRawName('');
                                        setModalSelectedSku('');
                                        setShowMappingModal(true);
                                    }}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-xs font-bold rounded-lg text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                                >
                                    + Add New Mapping
                                </button>
                            </div>

                            {/* Data Table */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-gray-950/60 border-b border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
                                            <th className="p-4">{t('Customer')}</th>
                                            <th className="p-4">{t('Raw Name in WhatsApp (original name of the document)')}</th>
                                            <th className="p-4">{t('Mapped Standard Item (corresponding to system products)')}</th>
                                            <th className="p-4">{t('Standard SKU (standard material number)')}</th>
                                            <th className="p-4">{t('Last Updated (memory time)')}</th>
                                            <th className="p-4 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/60 font-medium">
                                        {mappingsLoading ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500 animate-pulse">
                                                    Loading mapping history...
                                                </td>
                                            </tr>
                                        ) : mappings.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                                    No mapping records found. Use AI Order Import to build mappings automatically!
                                                </td>
                                            </tr>
                                        ) : (
                                            mappings
                                                .filter(m => {
                                                    const query = mappingSearch.toLowerCase();
                                                    return (m.customer_name || '').toLowerCase().includes(query) ||
                                                           (m.raw_product_name || '').toLowerCase().includes(query) ||
                                                           (m.mapped_product_name || '').toLowerCase().includes(query) ||
                                                           (m.mapped_sku || '').toLowerCase().includes(query);
                                                })
                                                .map((m) => (
                                                    <tr key={m.id} className="hover:bg-gray-850/40 transition-colors">
                                                        <td className="p-4 text-white font-semibold">{m.customer_name}</td>
                                                        <td className="p-4"><span className="bg-red-950/45 text-red-400 px-2 py-0.5 rounded border border-red-500/10 font-bold font-mono">{m.raw_product_name}</span></td>
                                                        <td className="p-4 text-gray-300 font-semibold">{m.mapped_product_name}</td>
                                                        <td className="p-4"><span className="bg-cyan-950/30 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/15 font-mono">{m.mapped_sku}</span></td>
                                                        <td className="p-4 text-gray-500 font-mono">{new Date(m.updated_at).toLocaleString('zh-CN')}</td>
                                                        <td className="p-4 text-center">
                                                            <button
                                                                onClick={() => handleDeleteMapping(m.id)}
                                                                className="text-red-500 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded transition-colors font-bold cursor-pointer"
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* GRID CONTENT */
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
                    )}
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
                onClose={() => { setIsEditModalOpen(false); loadItems(); }}
                initialData={editingItem}
                onSave={handleSaveItem}
            />

            {/* --- ADD/EDIT MAPPING MODAL --- */}
            {showMappingModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-bold">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Zap className="text-cyan-400" size={16} /> Add Product Name Mapping
                            </h3>
                            <button onClick={() => setShowMappingModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
                                &times;
                            </button>
                        </div>
                        <div className="p-5 space-y-4 text-xs font-semibold">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Customer Name')}</label>
                                <input
                                    type="text"
                                    placeholder="e.g. DIY"
                                    value={modalCustomer}
                                    onChange={e => setModalCustomer(e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Raw Name in WhatsApp (original product name on the receipt)')}</label>
                                <input
                                    type="text"
                                    placeholder="e.g. oren"
                                    value={modalRawName}
                                    onChange={e => setModalRawName(e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Mapped System Product (corresponding system standard product)')}</label>
                                <select
                                    value={modalSelectedSku}
                                    onChange={e => setModalSelectedSku(e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-amber-400 font-mono outline-none cursor-pointer focus:border-cyan-500"
                                >
                                    <option value="">-- Choose Standard Product --</option>
                                    {items.map(prod => (
                                        <option key={prod.sku} value={prod.sku}>
                                            {prod.name} ({prod.sku})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end gap-3 font-bold">
                            <button onClick={() => setShowMappingModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 px-4 rounded-lg border border-slate-700 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={handleSaveMapping} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs py-1.5 px-4 rounded-lg shadow-lg transition-all cursor-pointer">
                                Save Mapping
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductLibrary;
