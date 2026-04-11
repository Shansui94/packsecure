// Core Type Definitions for Factory App

// 1. User Role (Strict Unions)
export type UserRole = 'SuperAdmin' | 'Admin' | 'Manager' | 'Operator' | 'Driver' | 'Device' | 'HR' | 'Sales' | 'Finance';

// 2. User Profile
export interface User {
    uid: string;
    id?: string; // Frontend alias for doc.id
    email: string | null;
    role: UserRole;
    createdAt?: string;
    name?: string;
    photoURL?: string;
    gps?: string; // Optional GPS coordinate string
    loginTime?: string;
    phone?: string;
    salary?: number; // Monthly salary (Admin only)
    roleModules?: string[]; // Custom module unlocks 

    // Onboarding Fields
    status?: 'Pending' | 'Active' | 'Rejected'; // Default Pending
    employeeId?: string; // Numeric ID e.g., "001"
    joinedDate?: string;
    // Personal Details (Optional)
    icNo?: string;
    dob?: string;
    gender?: 'Male' | 'Female';
    maritalStatus?: 'Single' | 'Married' | 'Divorced';
    address?: string;

    // Emergency Contact (Optional)
    emergencyName?: string;
    emergencyPhone?: string;
    emergencyRelation?: string;

    // Statutory & Bank (Optional)
    epfNo?: string;
    socsoNo?: string;
    taxNo?: string;
    bankName?: string;
    bankAccountNo?: string;
    factoryId?: string; // NEW: Assigned Factory (T1, N1, etc.)
}

// 3. Job Order (Production Task)
export type DeliveryZone = string;
export type DeliveryStatus = 'Pending' | 'In-Transit' | 'Delivered';

export interface JobOrder {
    Job_ID: string; // Document ID and display ID
    id?: string; // Additional ID field often used in loops
    salesOrderId?: string; // NEW: Link to Sales Order
    customer: string;
    product: string;
    Product_SKU?: string; // Alias or specific field
    target: number; // Target Quantity
    Target_Qty?: number; // Alias often found in older code
    produced: number;
    status: 'Pending' | 'Backlog' | 'Scheduled' | 'Production' | 'Completed' | 'Paused';
    Status?: string; // Support capitalized legacy field
    machine: string;
    Machine_ID?: string; // Alias
    Priority: 'High' | 'Normal' | 'Low';
    Start_Date?: string;
    notes?: string;
    factoryId?: string; // NEW: Multi-factory support
    recipeId?: string; // NEW: Link to specific Recipe (BOM)

    // Logistics Fields
    deliveryAddress?: string;
    deliveryZone?: string;
    deliveryStatus?: DeliveryStatus;
    driverId?: string; // ID of the assigned Lorry/Driver
    orderIndex?: number; // For Kanban ordering

    // Feed / Chat Fields
    type?: 'Production' | 'Maintenance' | 'System' | 'Note'; // Default 'Production'
    originalText?: string; // The raw text entered by user
    created_at?: string; // Timestamp
}

// 13. Sales Order (NEW)
export interface SalesOrderItem {
    product: string; // e.g. "BW-S50-CLR-ORG"
    sku?: string; // New: Explicit SKU
    layer?: ProductLayer;
    material?: ProductMaterial;
    packaging?: PackagingColor;
    size?: ProductSize;
    quantity: number; // Rolls
    remark?: string; // NEW: Remark field
    sourceLocation?: string; // NEW: Optional Multi-Location Pickup
}

export interface SalesOrder {
    id: string;
    orderNumber: string; // User friendly ID e.g., SO-2025-001
    customer: string;
    items: SalesOrderItem[];
    status: 'New' | 'Planned' | 'In-Production' | 'Ready-to-Ship' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Pending Approval';
    orderDate: string;
    deadline: string;
    notes?: string;
    totalAmount?: number; // Optional for now
    driverId?: string; // NEW: Assigned Driver ID
    driverName?: string; // NEW: Resolved Driver Name for display
    deliveryAddress?: string; // Mapped from delivery_address
    zone?: string; // Mapped from zone (Legacy/Location Region)
    trip_origin?: string; // NEW: Origin Location (e.g. TAIPING, NILAI)
    trip_drop_count?: number; // NEW: Total destinations
    factoryId?: string; // NEW: Factory ID (T1/N1)
    tripSequence?: number; // Mapped from trip_sequence
    sourceLocation?: string; // NEW: Source Location (e.g., OPM Lama, SPD)

    // Logistics V2
    trip_id?: string;
    stop_sequence?: number;
    pod_signature_url?: string;
    pod_photo_url?: string;
    pod_signed_by?: string;
    pod_timestamp?: string;
}

export interface DeliveryRate {
    id: string;
    origin: string;
    location_name: string;
    base_rate: number;
    max_places: number;
    extra_rate_per_place: number;
    notes?: string;
}

export interface LogisticsTrip {
    trip_id: string;
    trip_number: string;
    driver_id?: string;
    vehicle_id?: string;
    status: 'Planning' | 'Loading' | 'Ready' | 'En-Route' | 'Completed';
    total_distance_km?: number;
    total_weight_kg?: number;
    created_at: string;
    started_at?: string;
    completed_at?: string;

    // Virtual Fields (Joined)
    driver?: User;
    vehicle?: any;
    orders?: SalesOrder[];
}

// ... existing InventoryItem ...

// 10. Logistics Structures (NEW)
// 10. Logistics Structures (NEW)
export interface Driver extends Omit<User, 'status'> {
    status: 'Available' | 'On-Route' | 'Offline';
    activeOrders?: number;
}

export interface Vehicle {
    id: string;
    plate_number: string;
    max_volume_m3: number;
    max_weight_kg: number;
    driver_id?: string;
    status: string;
}

export interface Lorry {
    id: string;
    plateNumber: string;
    driverName: string;
    driverUserId: string; // Map to User.uid
    preferredZone?: string;
    status: 'Available' | 'On-Route' | 'Maintenance';
}

// 4. Inventory Item (Raw Material)
export interface InventoryItem {
    Raw_Material_ID: string;
    Material_Name: string;
    Stock_Kg: number;
    Unit_Price?: number;
    Supplier?: string;
    Last_Updated?: string;
    factoryId?: string; // NEW: Multi-factory support

    // Legacy / Alternative Fields for backwards compatibility
    Product_Name?: string;
    name?: string;
    qty?: number;
    id?: string;
    SKU_ID?: string;

    // V2 Export Fields
    category?: string;
    status?: string;
    unit?: string;
    loc_id?: string;
}

// 5. Production Log (Audit Trail)
export interface ProductionLog {
    Log_ID: string;
    Timestamp: string;
    Job_ID: string;
    Operator_Email: string | null;
    Output_Qty: number;
    GPS_Coordinates?: string;
    AI_Verification?: {
        Verified: boolean;
        Detected_Rolls: number;
        Confidence: string;
    };
    Stock_Deduction_Status?: 'Completed' | 'Pending' | 'Failed';
    Over_Production?: number;
    Material_Deducted?: number;
    Material_ID?: string;
    Note?: string;
}


// 7. API/Scan Result
export interface ScanResult {
    text: string;
    count: number;
    conf: string;
}



// 5. Payroll Entry (NEW)
export interface PayrollEntry {
    id: string; // Document ID (usually YYYY-MM)
    month: string; // "December 2025"
    baseSalary: number;
    claimsTotal: number;
    otTotal?: number;
    deductions?: number;
    total: number;
    status: 'Paid' | 'Pending' | 'Processing';
    issuedAt?: string;
}

// 11. Claim Structure (NEW)
export interface Claim {
    id: string; // Document ID
    userId: string;
    userName: string;
    type: 'Overtime' | 'Medical' | 'Transport' | 'Meal' | 'Other';
    amount: number;
    description: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    timestamp: string;
    reviewedBy?: string;
    rejectionReason?: string;

    // Driver / Transport fields
    odometerStart?: number;
    odometerEnd?: number;
    odometerStartImg?: string;
    odometerEndImg?: string;
    distance?: number;

    // Finance / Audit Fields (New)
    company_name?: string;
    invoice_no?: string;
    tax_amount?: number;
    currency?: string;
    receipt_date?: string;

    // Attachments
    receiptUrl: string; // Mandatory receipt image
    itemPhotoUrl?: string; // Optional item photo
}

// 12. Product Variants (NEW for Production Control)
export type ProductLayer = 'Single' | 'Double';
export type ProductMaterial = 'Clear' | 'Black' | 'Silver';
export type PackagingColor = 'Orange' | 'Pink' | 'Blue' | 'Yellow' | 'Green' | 'Transparent';
export type ProductSize = '100cm' | '50cm' | '33cm' | '25cm' | '20cm';

export interface ProductVariant {
    layer: ProductLayer;
    material: ProductMaterial;
    packaging: PackagingColor;
    size: ProductSize;
    rollsPerSet: number;
}

// 14. Factory Types (Supabase)
// --- Factory & Machine Types (Inlined) ---
export type ItemType = 'raw' | 'FG';
export type RecipeStatus = 'active' | 'draft' | 'archived';
export type TransactionType = 'production_in' | 'production_out' | 'adjustment' | 'purchase';

// A. 物品主表 (Items Table)
export interface Item {
    id: string; // UUID
    name: string;
    sku: string;
    type: ItemType;
    current_stock: number;
    unit: string;
    created_at?: string;
}

// B. 配方头表 (Recipes Table)
export interface Recipe {
    id: string; // UUID
    product_id: string; // Reference to Item
    name: string;
    is_default: boolean;
    status: RecipeStatus;
    created_at?: string;

    // Optional: Expanded relation
    product?: Item;
    items?: RecipeItem[];
}

// C. 配方详情表 (Recipe Items Table)
export interface RecipeItem {
    id: string;
    recipe_id: string;
    material_id: string;
    quantity: number; // Qty required to make 1 unit of product

    // Optional: Expanded relation
    material?: Item;
}

// D. 库存流水表 (Inventory Transactions)
export interface InventoryTransaction {
    id: string;
    item_id: string;
    change_amount: number;
    action_type: TransactionType;
    reference_id?: string; // e.g., recipe_id or order_id
    created_at: string;
}

// Result from the stored procedure
export interface ProductionRunResult {
    success: boolean;
    message: string;
    product_id?: string;
    quantity_produced?: number;
    factory_updated?: string;
    recipe_id?: string;
}

// E. 工厂表 (Factories Table)
export interface Factory {
    id: string; // UUID
    name: string;
    address?: string;
    type: 'Production' | 'Warehouse' | 'Mixed';
    created_at?: string;
}

// F. 机器表 (Machines Table)
export interface Machine {
    id: string; // UUID
    name: string;
    factory_id: string; // Reference to Factory
    type: 'Extruder' | 'Slitter' | 'Other';
    status: 'Running' | 'Idle' | 'Maintenance' | 'Offline';
    created_at?: string;
}

// G. 工厂库存表 (Factory Inventory Table)
export interface FactoryInventory {
    id: string;
    item_id: string;
    factory_id: string;
    quantity: number;
    min_stock?: number;
    updated_at?: string;
}






export interface Partner {
    partner_id: string;
    name: string;
    type: 'Customer' | 'Supplier' | 'Other';
    contact_person?: string;
    phone?: string;
    created_at?: string;
}

// 14. Note System
export interface Note {
    id: string;
    title: string;
    content: string;
    tags?: string[];
    is_public: boolean;
    created_by: string; // User ID
    created_at?: string;
    updated_at?: string;
    // Joined fields
    author_name?: string;
}

// 15. Task System
export interface Task {
    id: string;
    title: string;
    description?: string;
    assigned_to?: string; // User ID
    created_by: string; // User ID
    status: 'To Do' | 'In Progress' | 'Done';
    priority: 'Low' | 'Normal' | 'High';
    due_date?: string;
    created_at?: string;
    // Joined fields
    assignee_name?: string;
    creator_name?: string;
}
