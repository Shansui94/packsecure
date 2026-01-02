import React, { useEffect, useState } from 'react';
import {
    getV2ItemsByType,
    getProducibleRecipes,
    getRecipeDetails,
    createRecipeV2,
    updateRecipeV2,
    setRecipeItemsV2,
    setDefaultRecipeV2,
    deleteRecipeV2
} from '../services/apiV2';
import { V2Item, V2RecipeHeader, V2RecipeItem } from '../types/v2';
import { Plus, Edit, CheckCircle, Search, Save, X, Trash2, Copy, FlaskConical, Box } from 'lucide-react';

const RecipeManager: React.FC = () => {
    // --- State ---
    const [products, setProducts] = useState<V2Item[]>([]);
    const [materials, setMaterials] = useState<V2Item[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<V2Item | null>(null);
    const [recipes, setRecipes] = useState<V2RecipeHeader[]>([]);
    const [loading, setLoading] = useState(false);

    // --- Modal State ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Partial<V2RecipeHeader> | null>(null);
    const [recipeItems, setRecipeItems] = useState<{ material_sku: string, qty_calculated: number }[]>([]);

    // --- Init ---
    useEffect(() => {
        loadMasterData();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            loadRecipes(selectedProduct.sku);
        } else {
            setRecipes([]);
        }
    }, [selectedProduct]);

    const loadMasterData = async () => {
        // Fetch Product (Finished Goods) and Raw Materials
        const [fg, raw] = await Promise.all([
            getV2ItemsByType('Product'),
            getV2ItemsByType('Raw'),
        ]);
        setProducts(fg);
        setMaterials(raw);
    };

    const loadRecipes = async (sku: string) => {
        setLoading(true);
        const data = await getProducibleRecipes(sku);
        setRecipes(data);
        setLoading(false);
    };

    // --- Handlers ---

    const handleSetDefault = async (r: V2RecipeHeader) => {
        if (!selectedProduct) return;
        setLoading(true);
        await setDefaultRecipeV2(selectedProduct.sku, r.recipe_id);
        await loadRecipes(selectedProduct.sku);
        setLoading(false);
    };

    const handleDelete = async (r: V2RecipeHeader) => {
        if (!confirm(`Delete recipe "${r.name}"? This cannot be undone.`)) return;
        await deleteRecipeV2(r.recipe_id);
        if (selectedProduct) loadRecipes(selectedProduct.sku);
    };

    // --- Modal Logic ---

    const openNewModal = () => {
        if (!selectedProduct) return;
        setEditingRecipe({
            sku: selectedProduct.sku,
            name: `${selectedProduct.name} (Ver ${recipes.length + 1})`,
            is_default: recipes.length === 0 // If first recipe, make it default
        });
        setRecipeItems([]);
        setIsModalOpen(true);
    };

    const openEditModal = async (r: V2RecipeHeader) => {
        setEditingRecipe(r);
        // Fetch existing items
        const details = await getRecipeDetails(r.recipe_id);
        setRecipeItems(details.map(d => ({
            material_sku: d.material_sku,
            qty_calculated: d.qty_calculated || 0
        })));
        setIsModalOpen(true);
    };

    const saveRecipe = async () => {
        if (!editingRecipe || !editingRecipe.name || !selectedProduct) return;

        try {
            let recipeId = editingRecipe.recipe_id;

            if (recipeId) {
                // Update
                await updateRecipeV2(recipeId, { name: editingRecipe.name });
            } else {
                // Create
                const newRecipe = await createRecipeV2({
                    sku: selectedProduct.sku,
                    name: editingRecipe.name,
                    is_default: editingRecipe.is_default
                });
                if (newRecipe) recipeId = newRecipe.recipe_id;
            }

            if (recipeId) {
                // Save Items
                await setRecipeItemsV2(recipeId, recipeItems);
                setIsModalOpen(false);
                loadRecipes(selectedProduct.sku);
                alert("Recipe Saved Successfully!");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to save recipe.");
        }
    };

    // --- Render Helpers ---

    const addItemRow = () => setRecipeItems([...recipeItems, { material_sku: '', qty_calculated: 0 }]);
    const updateRow = (idx: number, field: keyof typeof recipeItems[0], val: any) => {
        const copy = [...recipeItems];
        // @ts-ignore
        copy[idx][field] = val;
        setRecipeItems(copy);
    };
    const removeRow = (idx: number) => setRecipeItems(recipeItems.filter((_, i) => i !== idx));

    return (
        <div className="p-6 h-full flex flex-col gap-6 animate-fade-in bg-[#0f1014] text-gray-100">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 flex items-center gap-2">
                        <FlaskConical className="text-purple-400" /> RECIPE MANAGER (V2)
                    </h1>
                    <p className="text-gray-500 text-sm font-mono mt-1">
                        Master Data Source: <span className="text-green-400">master_items_v2</span> •
                        Engine: <span className="text-blue-400">bom_headers_v2</span>
                    </p>
                </div>
            </div>

            <div className="flex gap-6 h-full min-h-0">

                {/* Left: Product List (V2) */}
                <div className="w-1/3 bg-[#18181b] rounded-xl border border-white/10 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-[#18181b] sticky top-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <input
                                type="text"
                                placeholder="Search V2 Products..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {products.map(prod => (
                            <button
                                key={prod.sku}
                                onClick={() => setSelectedProduct(prod)}
                                className={`w-full text-left p-3 rounded-lg flex justify-between items-center transition-all group ${selectedProduct?.sku === prod.sku
                                    ? 'bg-purple-500/10 border border-purple-500/50'
                                    : 'hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                <div>
                                    <p className={`font-bold ${selectedProduct?.sku === prod.sku ? 'text-purple-400' : 'text-gray-300'}`}>
                                        {prod.sku}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate w-48">{prod.name}</p>
                                </div>
                                {selectedProduct?.sku === prod.sku && (
                                    <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_purple]"></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Recipe Details */}
                <div className="flex-1 bg-[#18181b] rounded-xl border border-white/10 flex flex-col overflow-hidden relative">
                    {!selectedProduct ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4 opacity-50">
                            <FlaskConical size={64} className="opacity-20" />
                            <p>Select a product to view BOMs</p>
                        </div>
                    ) : (
                        <>
                            {/* Toolbar */}
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#202024]">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold text-white tracking-tight">{selectedProduct.sku}</h2>
                                    <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-gray-400">{selectedProduct.name}</span>
                                </div>
                                <button
                                    onClick={openNewModal}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-purple-900/20 transition-all text-sm"
                                >
                                    <Plus size={16} /> New Recipe
                                </button>
                            </div>

                            {/* Recipes List */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {loading && <div className="text-center text-gray-500 animate-pulse">Loading V2 Data...</div>}

                                {!loading && recipes.length === 0 && (
                                    <div className="text-center p-12 border-2 border-dashed border-white/5 rounded-2xl">
                                        <p className="text-gray-400 mb-2">No recipes found for {selectedProduct.sku}.</p>
                                        <button onClick={openNewModal} className="text-purple-400 font-bold hover:underline">Create First Recipe</button>
                                    </div>
                                )}

                                {recipes.map(recipe => (
                                    <div key={recipe.recipe_id} className={`p-5 rounded-xl border transition-all ${recipe.is_default
                                        ? 'border-green-500/30 bg-green-500/5'
                                        : 'border-white/5 bg-white/[0.02]'
                                        }`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="text-lg font-bold text-white">{recipe.name}</h3>
                                                    {recipe.is_default && (
                                                        <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded font-bold border border-green-500/30 flex items-center gap-1">
                                                            <CheckCircle size={10} /> DEFAULT
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-600 font-mono select-all">UUID: {recipe.recipe_id}</p>
                                            </div>

                                            <div className="flex gap-2">
                                                {!recipe.is_default && (
                                                    <button onClick={() => handleSetDefault(recipe)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-600/50 text-gray-400 hover:text-green-400 hover:border-green-500/50 transition-colors">
                                                        Set Default
                                                    </button>
                                                )}
                                                <button onClick={() => openEditModal(recipe)} className="p-2 hover:bg-white/10 rounded-lg text-blue-400 transition-colors">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(recipe)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* MODAL */}
            {isModalOpen && editingRecipe && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#18181b] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingRecipe.recipe_id ? <Edit className="text-blue-400" /> : <Plus className="text-purple-400" />}
                                {editingRecipe.recipe_id ? 'Edit BOM' : 'New BOM'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div>
                                <label className="text-gray-400 text-xs font-bold uppercase mb-1 block">Recipe Name</label>
                                <input
                                    type="text"
                                    value={editingRecipe.name}
                                    onChange={e => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    placeholder="e.g. Standard V2"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-gray-400 text-xs font-bold uppercase">Raw Materials (BOM)</label>
                                    <button onClick={addItemRow} className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1">
                                        <Plus size={12} /> Add Item
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {recipeItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-center group">
                                            <div className="flex-1 relative">
                                                <select
                                                    value={item.material_sku}
                                                    onChange={(e) => updateRow(idx, 'material_sku', e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-sm appearance-none"
                                                >
                                                    <option value="">Select Material...</option>
                                                    {materials.map(mat => (
                                                        <option key={mat.sku} value={mat.sku}>{mat.sku} ({mat.name})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <input
                                                type="number"
                                                placeholder="Qty"
                                                value={item.qty_calculated}
                                                onChange={(e) => updateRow(idx, 'qty_calculated', parseFloat(e.target.value))}
                                                className="w-24 bg-black/40 border border-white/10 rounded-lg p-2 text-white text-sm"
                                            />
                                            <button onClick={() => removeRow(idx)} className="text-gray-600 group-hover:text-red-500 p-2 transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                    {recipeItems.length === 0 && (
                                        <div className="text-center py-6 border border-dashed border-white/5 rounded-lg text-gray-600 bg-white/[0.02]">
                                            No materials added.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-[#202024] rounded-b-2xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold">Cancel</button>
                            <button onClick={saveRecipe} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2">
                                <Save size={18} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecipeManager;
