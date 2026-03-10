import { supabase } from './supabase';
import { V2Item, V2RecipeHeader, V2RecipeItem, V2Factory, V2StockLedgerEntry } from '../types/v2';

// --- Production ---
export const executeProductionV3 = async (
    sku: string,
    qty: number,
    machineId?: string,
    jobId?: string,
    note?: string,
    operatorOverride?: string // New Argument
) => {
    // Get current user (simple mock or real auth)
    const { data: { user } } = await supabase.auth.getUser();

    // CRM-MATCH FIX: The RPC expects sys_users_v2.id, NOT auth.users.id
    // We must resolve the correct ID first
    let operatorSysId = operatorOverride || null;

    // Only resolve from Auth if no override is provided
    if (!operatorSysId && user?.id) {
        const { data: profile } = await supabase
            .from('sys_users_v2')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (profile) operatorSysId = profile.id;
    }

    const { data, error } = await supabase.rpc('execute_production_run_v3', {
        p_sku: sku,
        p_qty: qty,
        p_operator_id: operatorSysId, // Use the resolved System ID
        p_machine_id: machineId || null,
        p_job_id: jobId || null,      // New Parameter
        p_note: note || null          // New Parameter
    });

    if (error) {
        console.error('Production RPC Error:', error);
        return { success: false, message: error.message };
    }
    return data;
};

// --- Items ---
export const getV2Items = async (): Promise<V2Item[]> => {
    const { data, error } = await supabase
        .from('master_items_v2')
        .select('*')
        .eq('status', 'Active');

    if (error) {
        console.error('Error fetching V2 items:', error);
        return [];
    }
    return data || [];
};

export const getV2ItemBySku = async (sku: string): Promise<V2Item | null> => {
    const { data, error } = await supabase
        .from('master_items_v2')
        .select('*')
        .eq('sku', sku)
        .single();

    if (error) return null;
    return data;
};

export const getV2ItemsByType = async (type: 'FG' | 'Raw' | 'Packaging'): Promise<V2Item[]> => {
    // Note: V2 types might differ (e.g., 'FG' vs 'Product'). Let's match typical usage.
    // Assuming DB content matches types/v2.ts: 'Raw', 'WiP', 'FG'
    // Map UI "Product" to "FG"? Or usage? 
    // Let's filter loosely or exact match if user passes exact string
    const { data, error } = await supabase
        .from('master_items_v2')
        .select('*')
        .eq('type', type)
        .eq('status', 'Active')
        .order('sku');

    if (error) return [];
    return data || [];
};

// --- Recipes ---
export const getProducibleRecipes = async (sku: string): Promise<V2RecipeHeader[]> => {
    const { data, error } = await supabase
        .from('bom_headers_v2')
        .select('*')
        .eq('sku', sku);

    if (error) return [];
    return data || [];
};

export const getRecipeDetails = async (recipeId: string): Promise<V2RecipeItem[]> => {
    const { data, error } = await supabase
        .from('bom_items_v2')
        .select(`
            *,
            material:material_sku (name, type, uom)
        `)
        .eq('recipe_id', recipeId);

    if (error) return [];
    return data || [];
};

export const createRecipeV2 = async (header: Partial<V2RecipeHeader>): Promise<V2RecipeHeader | null> => {
    // 1. Insert Header
    const { data, error } = await supabase
        .from('bom_headers_v2')
        .insert(header)
        .select()
        .single();

    if (error) {
        console.error("Error creating recipe:", error);
        return null;
    }
    return data;
};

export const updateRecipeV2 = async (recipeId: string, updates: Partial<V2RecipeHeader>): Promise<boolean> => {
    const { error } = await supabase
        .from('bom_headers_v2')
        .update(updates)
        .eq('recipe_id', recipeId);

    if (error) {
        console.error("Error updating recipe:", error);
        return false;
    }
    return true;
};

export const setRecipeItemsV2 = async (recipeId: string, items: { material_sku: string, qty_calculated: number }[]): Promise<boolean> => {
    // Transaction-like approach: Delete all then insert
    // 1. Delete existing
    const { error: delError } = await supabase
        .from('bom_items_v2')
        .delete()
        .eq('recipe_id', recipeId);

    if (delError) {
        console.error("Error clearing recipe items:", delError);
        return false;
    }

    if (items.length === 0) return true;

    // 2. Insert new
    const toInsert = items.map(i => ({
        recipe_id: recipeId,
        material_sku: i.material_sku,
        qty_calculated: i.qty_calculated,
        layer_name: 'Main' // Default for now
    }));

    const { error: insError } = await supabase
        .from('bom_items_v2')
        .insert(toInsert);

    if (insError) {
        console.error("Error inserting recipe items:", insError);
        return false;
    }
    return true;
};

export const setDefaultRecipeV2 = async (sku: string, recipeId: string): Promise<boolean> => {
    // 1. Unset all for this SKU
    await supabase.from('bom_headers_v2').update({ is_default: false }).eq('sku', sku);

    // 2. Set target
    const { error } = await supabase.from('bom_headers_v2').update({ is_default: true }).eq('recipe_id', recipeId);

    return !error;
};

export const deleteRecipeV2 = async (recipeId: string): Promise<boolean> => {
    // Cascade delete should handle items if configured, but let's be safe
    await supabase.from('bom_items_v2').delete().eq('recipe_id', recipeId);
    const { error } = await supabase.from('bom_headers_v2').delete().eq('recipe_id', recipeId);
    return !error;
};

// --- Inventory ---
export const getStockBalance = async (sku: string, locId?: string): Promise<number> => {
    let query = supabase
        .from('stock_ledger_v2')
        .select('change_qty');

    query = query.eq('sku', sku);
    if (locId) query = query.eq('loc_id', locId);

    const { data, error } = await query;
    if (error || !data) return 0;

    return data.reduce((sum, txn) => sum + Number(txn.change_qty), 0);
};

export interface V2InventorySnapshot {
    sku: string;
    loc_id?: string;
    current_stock: number;
    last_updated: string;
}

export const getInventoryStatus = async (): Promise<V2InventorySnapshot[]> => {
    const { data, error } = await supabase
        .from('v2_inventory_view')
        .select('sku, loc_id, current_stock, last_updated');

    if (error) {
        console.error('Error fetching inventory snapshot:', error);
        return [];
    }
    return data || [];
};

export const getLedgerHistory = async (sku: string): Promise<V2StockLedgerEntry[]> => {
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .order('timestamp', { ascending: false });

    if (error) return [];
    return data || [];
};

// --- Factories ---
export const getV2Factories = async (): Promise<V2Factory[]> => {
    const { data, error } = await supabase.from('sys_locations_v2').select('*');
    if (error) return [];
    return data || [];
};

// --- Items Management (Create/Update) ---

// Create new Item
export const createItemV2 = async (item: Partial<V2Item>): Promise<V2Item | null> => {
    // 1. Validate mandatory fields
    if (!item.sku || !item.name || !item.type) {
        throw new Error("Missing mandatory fields: SKU, Name, Type");
    }

    // 2. Strip generated/computed columns
    const safeItem = { ...item };
    delete (safeItem as any).volume_m3;
    delete (safeItem as any).created_at;
    delete (safeItem as any).updated_at;

    // 3. Insert
    const { data, error } = await supabase
        .from('master_items_v2')
        .insert(safeItem)
        .select()
        .single();

    if (error) {
        console.error("Error creating item:", error);
        throw error; // Rethrow to let UI handle alerts
    }
    return data;
};

// Update existing Item
export const updateItemV2 = async (sku: string, updates: Partial<V2Item>): Promise<V2Item | null> => {
    // Remove generated or read-only columns before updating
    const safeUpdates = { ...updates };
    delete (safeUpdates as any).volume_m3;
    delete (safeUpdates as any).created_at;
    delete (safeUpdates as any).updated_at;

    const { data, error } = await supabase
        .from('master_items_v2')
        .update(safeUpdates)
        .eq('sku', sku)
        .select()
        .single();

    if (error) {
        console.error("Error updating item:", error);
        throw error;
    }
    return data;
};