export type UserRole = 'Admin' | 'Manager' | 'Operator' | 'Driver' | 'Sales';
export type ItemType = 'Raw' | 'WiP' | 'FG';
export type SupplyType = 'Manufactured' | 'Purchased';
export type MachineStatus = 'Running' | 'Idle' | 'Maintenance' | 'Off';
export type DeliveryStatus = 'Pending' | 'Loading' | 'In_Transit' | 'Delivered' | 'Cancelled';

export interface V2User {
    id: string; // UUID
    auth_user_id?: string;
    employee_id: string;
    name: string;
    role: UserRole;
    department?: string;
    status: 'Active' | 'Resigned' | 'Suspended';
    photo_url?: string;
}

export interface V2Item {
    sku: string; // PK
    name: string;
    type: ItemType;
    supply_type: SupplyType;
    uom: string;

    // Physical Specs
    width_mm?: number;
    length_m?: number;
    thickness_mic?: number;
    net_weight_kg?: number;
    core_weight_kg?: number;
    gross_weight_kg?: number;

    // Packaging & Logistics
    pack_qty?: number;
    volume_cbm?: number;
    box_dims?: string;

    // Optimization
    min_stock_level?: number;
    reorder_qty?: number;
    estimated_cost?: number;

    status: 'Active' | 'Obsolete';

    // V3 Architecture Extensions
    supplier?: string;
    brand?: string;
    function_usage?: string;
    legacy_code?: string;
    packaging_type?: string;
    description?: string;
    min_stock_alert?: number;
}

export interface V2RecipeHeader {
    recipe_id: string; // UUID
    sku: string; // FK -> V2Item
    name: string;
    is_default: boolean;
    machine_type?: string; // "Extruder-A"
}

export interface V2RecipeItem {
    id: string;
    recipe_id: string;
    material_sku: string; // FK -> V2Item
    layer_name: string; // "Main", "Inner", "Outer"
    qty_calculated?: number;
    ratio_percentage?: number;
    notes?: string;

    // V3 Extensions
    scrap_percent?: number;
    usage_note?: string;
}

export interface V2Factory {
    factory_id: string;
    name: string;
    address?: string;
}

export interface V2Location {
    loc_id: string;
    name: string;
    type: string;
    factory_id?: string;
}

export interface V2Machine {
    machine_id: string;
    name: string;
    type: string;
    status: MachineStatus;
    factory_id?: string;
    current_operator_id?: string;
}

export interface V2Vehicle {
    vehicle_id: string;
    type: string;
    capacity_cbm?: number;
    status: string;
}

// Transactional Types
export interface V2ProductionOrder {
    job_id: string;
    sku: string;
    recipe_id?: string;
    plan_qty: number;
    due_date?: string;
    status: string;
    machine_id?: string;
}

export interface V2ProductionLog {
    log_id: string;
    job_id?: string;
    sku: string;
    machine_id: string;
    operator_id: string;
    output_qty: number;
    reject_qty: number;
    start_time?: string;
    end_time?: string;
    batch_code?: string;
    created_at: string;
}

export interface V2Delivery {
    delivery_id: string;
    vehicle_id?: string;
    driver_id?: string;
    route_name?: string;
    status: DeliveryStatus;
    start_time?: string;
    end_time?: string;
}

export interface V2StockLedgerEntry {
    txn_id: string;
    timestamp: string;
    sku: string;
    loc_id?: string;
    change_qty: number;
    balance_after?: number;
    event_type: string;
    ref_doc?: string;
    notes?: string;
}
