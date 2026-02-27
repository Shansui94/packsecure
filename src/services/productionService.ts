import { supabase } from './supabase';
import { Item, Machine } from '../types';

// --- MIGRATED TO V2 TABLES (BRIDGE MODE) ---

export const getItems = async () => {
    // Redirect to V2 table
    const { data, error } = await supabase
        .from('master_items_v2')
        .select('*')
        .eq('status', 'Active')
        .order('name');

    if (error) throw error;

    // Map V2 columns to V1 interface
    return data.map((d: any) => ({
        id: d.sku, // Use SKU as ID
        sku: d.sku,
        name: d.name,
        type: d.type === 'Raw' ? 'raw' : 'FG', // Map Enum back to string
        current_stock: 0, // Stock logic is separate in V2 (ledger), placeholder for now
        unit: d.uom
    })) as Item[];
};

export const getMachines = async () => {
    const { data, error } = await supabase
        .from('sys_machines_v2')
        .select('*')
        .order('name');

    if (error) throw error;

    return data.map((m: any) => ({
        id: m.machine_id,
        code: m.machine_id,
        name: m.name,
        type: m.type,
        status: m.status,
        factory_id: m.factory_id
    })) as Machine[];
};

export const getMachineByCode = async (code: string) => {
    const { data, error } = await supabase
        .from('sys_machines_v2')
        .select('*')
        .eq('machine_id', code)
        .single();

    if (error) return null;
    return {
        id: data.machine_id,
        code: data.machine_id,
        name: data.name,
        type: data.type,
        status: data.status,
        factory_id: data.factory_id
    } as Machine;
};

export const getMachineById = async (id: string) => {
    return getMachineByCode(id);
};

// Stub other legacy functions if needed
export const getRecipesByProduct = async () => { return []; }; // Deprecated, use RecipeManager
