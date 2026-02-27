export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            items: {
                Row: {
                    id: string
                    sku: string
                    name: string
                    type: 'raw' | 'FG'
                    current_stock: number
                    unit: string
                    created_at?: string
                    updated_at?: string
                }
                Insert: {
                    id?: string
                    sku: string
                    name: string
                    type?: 'raw' | 'FG'
                    current_stock?: number
                    unit?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    sku?: string
                    name?: string
                    type?: 'raw' | 'FG'
                    current_stock?: number
                    unit?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            job_orders: {
                Row: {
                    id: string
                    job_id: string // Display ID like JOB-101
                    customer: string
                    product: string
                    target_qty: number
                    produced_qty: number
                    status: string
                    machine: string
                    priority: string
                    delivery_zone: string | null
                    delivery_status: string // 'Pending', 'In-Transit'
                    delivery_address: string | null
                    driver_id: string | null
                    order_index: number
                    created_at: string
                }
                Insert: {
                    job_id: string
                    customer: string
                    product: string
                    target_qty: number
                    produced_qty?: number
                    status?: string
                    machine?: string
                    priority?: string
                    delivery_zone?: string | null
                    delivery_status?: string
                    delivery_address?: string | null
                    driver_id?: string | null
                    order_index?: number
                    created_at?: string
                }
                Update: Partial<Database['public']['Tables']['job_orders']['Insert']>
            }
            production_logs: {
                Row: {
                    id: string
                    log_id: string
                    timestamp: string
                    job_id: string
                    operator_email: string
                    output_qty: number
                    gps_coordinates: string | null
                    verified: boolean
                    detected_rolls: number | null
                    note: string | null
                }
                Insert: {
                    log_id?: string
                    timestamp?: string
                    job_id: string
                    operator_email: string
                    output_qty: number
                    gps_coordinates?: string | null
                    verified?: boolean
                    detected_rolls?: number | null
                    note?: string | null
                }
                Update: Partial<Database['public']['Tables']['production_logs']['Insert']>
            }
            users_public: {
                Row: {
                    id: string // Maps to Firebase Auth UID
                    email: string
                    role: string
                    name: string | null
                    phone: string | null
                    salary: number | null
                    status: string
                    employee_id: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    email: string
                    role?: string
                    name?: string | null
                    phone?: string | null
                    salary?: number | null
                    status?: string
                    employee_id?: string | null
                    created_at?: string
                }
                Update: Partial<Database['public']['Tables']['users_public']['Insert']>
            }
            shifts: {
                Row: {
                    id: string
                    user_email: string
                    start_time: string
                    end_time: string | null
                    status: string
                    gps_start: string | null
                    gps_end: string | null
                    machine_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_email: string
                    start_time: string
                    end_time?: string | null
                    status?: string
                    gps_start?: string | null
                    gps_end?: string | null
                    machine_id?: string | null
                    created_at?: string
                }
                Update: Partial<Database['public']['Tables']['shifts']['Insert']>
            }
        }
    }
}
