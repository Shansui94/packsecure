import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { 
    Users, CheckCircle2, Clock, AlertCircle, Search, Filter, 
    RefreshCw, Calendar, ChevronLeft, ChevronRight, Edit3, 
    Check, X, Shield, Lock, Unlock, Phone, Truck, Wrench, 
    Factory, Sparkles, Building2, UserCheck, AlertTriangle,
    Eye, ShieldCheck, CheckSquare, CornerDownRight, ArrowRight, Save,
    MapPin, Layers, LayoutGrid, Building, Compass
} from 'lucide-react';
import { mytTodayYmd, addDaysYmd, formatDateTimeMyt } from '../utils/mytDate';
import { useTranslation } from 'react-i18next';
import { logActivity } from '../utils/logger';
import { User as CurrentUser } from '../types';

export type LocationKey = 'Taiping' | 'Nilai' | 'Johor' | 'Kelantan';
export type LocationFilter = 'ALL' | LocationKey;

export const LOCATION_CONFIG: Record<LocationKey, {
    label: string;
    labelEn: string;
    code: string;
    color: string;
    badgeClass: string;
    borderClass: string;
    bgClass: string;
}> = {
    Taiping: {
        label: '太平总厂',
        labelEn: 'Taiping Plant',
        code: 'T1/OPM',
        color: 'text-emerald-400',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        borderClass: 'border-emerald-500/40',
        bgClass: 'bg-emerald-500/10'
    },
    Nilai: {
        label: '汝来分厂',
        labelEn: 'Nilai Plant',
        code: 'N1',
        color: 'text-indigo-400',
        badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        borderClass: 'border-indigo-500/40',
        bgClass: 'bg-indigo-500/10'
    },
    Johor: {
        label: '柔佛分厂',
        labelEn: 'Johor Plant',
        code: 'J1',
        color: 'text-amber-400',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        borderClass: 'border-amber-500/40',
        bgClass: 'bg-amber-500/10'
    },
    Kelantan: {
        label: '吉兰丹分厂',
        labelEn: 'Kelantan Plant',
        code: 'K1',
        color: 'text-purple-400',
        badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        borderClass: 'border-purple-500/40',
        bgClass: 'bg-purple-500/10'
    }
};

interface EmployeeRecord {
    id: string;
    auth_user_id?: string;
    employee_id: string;
    name: string;
    role: string;
    photoURL?: string;
    photo_url?: string;
    phone?: string;
    factoryId?: string;
    factory_id?: string;
    base_location?: string;
    status?: string;
}

interface AttendanceRecord {
    id: string;
    operator_id: string;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    hours_worked: number;
    machine_id: string | null;
    notes: string | null;
    is_verified?: boolean;
    verified_by?: string | null;
    verified_at?: string | null;
    verification_notes?: string | null;
}

interface WorkContext {
    machineName?: string;
    sku?: string;
    outputCount?: number;
    specialTask?: string;
    deliveryTrip?: string;
    lastLogTime?: string;
}

interface StaffStatusItem {
    employee: EmployeeRecord;
    attendance: AttendanceRecord | null;
    allAttendancesForDay: AttendanceRecord[];
    status: 'ACTIVE' | 'PENDING' | 'APPROVED' | 'ABSENT' | 'LEAVE';
    location: LocationKey;
    workContext: WorkContext;
}

/** Format ISO timestamp to HH:mm in Malaysia Time (UTC+8) */
export const formatTimeOnlyMyt = (iso: string | null | undefined): string => {
    if (!iso) return '--:--';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '--:--';
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kuala_Lumpur',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(d);
    } catch {
        return '--:--';
    }
};

/** Format ISO timestamp to YYYY-MM-DDTHH:mm for HTML5 datetime-local inputs in MYT */
export const formatMytDatetimeLocal = (iso: string | null | undefined, fallbackYmd?: string): string => {
    if (!iso) return fallbackYmd ? `${fallbackYmd}T08:00` : '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return fallbackYmd ? `${fallbackYmd}T08:00` : '';
        return d.toLocaleString('sv', { timeZone: 'Asia/Kuala_Lumpur' }).replace(' ', 'T').slice(0, 16);
    } catch {
        return fallbackYmd ? `${fallbackYmd}T08:00` : '';
    }
};

interface StaffStatusSignOffProps {
    user: CurrentUser | null;
    onNavigate?: (page: string) => void;
}

const StaffStatusSignOff: React.FC<StaffStatusSignOffProps> = ({ user, onNavigate }) => {
    const { t, i18n } = useTranslation();
    const [currentLang, setCurrentLang] = useState<string>(() => i18n.language || localStorage.getItem('packsecure_lang') || 'zh-CN');

    useEffect(() => {
        const handleLangChange = (e: any) => {
            const newLang = e?.detail || localStorage.getItem('packsecure_lang') || 'zh-CN';
            setCurrentLang(newLang);
        };
        window.addEventListener('packsecure:lang-change', handleLangChange);
        return () => window.removeEventListener('packsecure:lang-change', handleLangChange);
    }, []);

    const getLocLabel = useCallback((loc: LocationKey) => {
        const conf = LOCATION_CONFIG[loc];
        if (!conf) return loc;
        if (currentLang === 'zh-CN') return conf.label;
        if (currentLang === 'en') return conf.labelEn || conf.label;
        const translated = t(conf.label);
        return (translated && translated !== conf.label) ? translated : (conf.labelEn || conf.label);
    }, [currentLang, t]);
    
    // Core filter state
    const [selectedDate, setSelectedDate] = useState<string>(mytTodayYmd());
    const [locationFilter, setLocationFilter] = useState<LocationFilter>('ALL');
    const [roleFilter, setRoleFilter] = useState<'ALL' | 'Operator' | 'Driver' | 'Warehouse' | 'Office'>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'APPROVED' | 'ABSENT'>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Raw data
    const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
    const [pubLocations, setPubLocations] = useState<Map<string, string>>(new Map());
    const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
    const [activeMachines, setActiveMachines] = useState<any[]>([]);
    const [productionLogs, setProductionLogs] = useState<any[]>([]);
    const [driverTrips, setDriverTrips] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [mileageLogs, setMileageLogs] = useState<any[]>([]);

    // Modal state for adjust hours / manual check-in
    const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
    const [editingStaffItem, setEditingStaffItem] = useState<StaffStatusItem | null>(null);
    const [editForm, setEditForm] = useState<{
        clock_in: string;
        clock_out: string;
        hours_worked: number;
        machine_id: string;
        location: LocationKey;
        verification_notes: string;
        autoApprove: boolean;
    }>({
        clock_in: '',
        clock_out: '',
        hours_worked: 8,
        machine_id: '',
        location: 'Taiping',
        verification_notes: '',
        autoApprove: true
    });
    const [savingAdjust, setSavingAdjust] = useState<boolean>(false);
    const [batchLoading, setBatchLoading] = useState<boolean>(false);

    // Helper: Check if record is verified
    const isRecordVerified = (att: AttendanceRecord | null): boolean => {
        if (!att) return false;
        if (att.is_verified === false) return false;
        if (att.is_verified === true) return true;
        return Boolean(att.notes && att.notes.includes('[Verified'));
    };

    // Helper: Determine location for an employee
    const resolveLocation = useCallback((
        emp: EmployeeRecord, 
        att: AttendanceRecord | null, 
        machineId?: string
    ): LocationKey => {
        // 1. If currently working on a machine on the day, machine prefix takes precedence
        const m = (machineId || att?.machine_id || '').toUpperCase();
        if (m.startsWith('N')) return 'Nilai';
        if (m.startsWith('J')) return 'Johor';
        if (m.startsWith('K')) return 'Kelantan';
        if (m.startsWith('T') || m.startsWith('OPM')) return 'Taiping';

        // 2. Check factory_id / factoryId on emp
        const f = (emp.factory_id || emp.factoryId || '').toUpperCase();
        if (f.startsWith('N') || f === 'NILAI') return 'Nilai';
        if (f.startsWith('J') || f === 'JOHOR') return 'Johor';
        if (f.startsWith('K') || f === 'KELANTAN') return 'Kelantan';
        if (f.startsWith('T') || f === 'TAIPING' || f === 'OPM') return 'Taiping';

        // 3. Check base_location from users_public
        const pubLoc = emp.base_location || 
            pubLocations.get(emp.employee_id) || 
            pubLocations.get(emp.auth_user_id || '') || 
            pubLocations.get(emp.id);
        if (pubLoc) {
            const pl = pubLoc.toLowerCase();
            if (pl.includes('nilai')) return 'Nilai';
            if (pl.includes('johor')) return 'Johor';
            if (pl.includes('kelantan')) return 'Kelantan';
            if (pl.includes('taiping')) return 'Taiping';
        }

        // Default to Taiping (main plant)
        return 'Taiping';
    }, [pubLocations]);

    // Load all data for the selected date
    const loadData = useCallback(async (showIndicator = true) => {
        if (showIndicator) setLoading(true);
        setIsRefreshing(true);

        try {
            const dateStr = selectedDate;
            const startMytIso = new Date(`${dateStr}T00:00:00+08:00`).toISOString();
            const endMytIso = new Date(`${dateStr}T23:59:59.999+08:00`).toISOString();

            // Run queries concurrently
            const [
                { data: empsData, error: empsErr },
                { data: pubData, error: pubErr },
                { data: attData, error: attErr },
                { data: mActiveData },
                { data: logsData },
                { data: tripsData },
                { data: leavesData },
                { data: logsMileageData }
            ] = await Promise.all([
                // 1. Active employees
                supabase
                    .from('sys_users_v2')
                    .select('id, auth_user_id, employee_id, name, role, photo_url, phone, factory_id, status')
                    .eq('status', 'Active')
                    .order('name'),

                // 2. Public locations reference
                supabase
                    .from('users_public')
                    .select('id, employee_id, base_location, factory_id'),

                // 3. Attendance records
                supabase
                    .from('operator_attendance')
                    .select('*')
                    .eq('date', dateStr),

                // 4. Active machines
                supabase
                    .from('machine_active_products')
                    .select('*'),

                // 5. Production logs (full MYT day from 00:00 to 23:59 in UTC)
                supabase
                    .from('production_logs_v2')
                    .select('operator_id, output_qty, created_at, job_id')
                    .gte('created_at', startMytIso)
                    .lte('created_at', endMytIso),

                // 6. Driver delivery orders (Capture all active, loaded, and completed orders for the day)
                supabase
                    .from('sales_orders')
                    .select('id, order_number, driver_id, status, zone, delivery_address, created_at, pod_timestamp, deadline, order_date, notes, trip_drop_count')
                    .not('driver_id', 'is', null)
                    .or(`deadline.eq.${dateStr},order_date.eq.${dateStr},created_at.gte.${startMytIso},pod_timestamp.gte.${startMytIso}`),

                // 7. Approved leaves
                supabase
                    .from('employee_leave')
                    .select('employee_id, reason, count_days, status, start_date, end_date')
                    .eq('status', 'Approved')
                    .lte('start_date', dateStr)
                    .gte('end_date', dateStr),

                // 8. Lorry mileage logs (Driver start & end shift scans)
                supabase
                    .from('lorry_mileage_logs')
                    .select('id, lorry_id, driver_id, mileage, photo_url, log_type, created_at')
                    .gte('created_at', startMytIso)
                    .lte('created_at', endMytIso)
            ]);

            if (empsErr) console.warn("Error fetching employees:", empsErr);
            if (pubErr) console.warn("Error fetching users_public:", pubErr);
            if (attErr) console.warn("Error fetching attendance:", attErr);

            // Build public location map
            const locMap = new Map<string, string>();
            (pubData || []).forEach((p: any) => {
                if (p.base_location) {
                    if (p.id) locMap.set(p.id, p.base_location);
                    if (p.employee_id) locMap.set(p.employee_id, p.base_location);
                }
            });
            setPubLocations(locMap);

            setEmployees((empsData || []).map((e: any) => ({
                ...e,
                photoURL: e.photo_url || e.photoURL,
                factoryId: e.factory_id || e.factoryId
            })));
            setAttendances(attData || []);
            setActiveMachines(mActiveData || []);
            setProductionLogs(logsData || []);
            setDriverTrips(tripsData || []);
            setLeaves(leavesData || []);
            setMileageLogs(logsMileageData || []);

        } catch (err) {
            console.error("StaffStatusSignOff loadData error:", err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedDate]);

    // Initial fetch & Realtime subscription
    useEffect(() => {
        loadData();

        // Supabase Realtime channel for live updates
        const channel = supabase.channel(`staff-status-sync-${selectedDate}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'operator_attendance' }, () => {
                loadData(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'machine_active_products' }, () => {
                loadData(false);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_logs_v2' }, () => {
                loadData(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => {
                loadData(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lorry_mileage_logs' }, () => {
                loadData(false);
            })
            .subscribe();

        // 30-second polling fallback
        const pollTimer = setInterval(() => {
            loadData(false);
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollTimer);
        };
    }, [selectedDate, loadData]);

    // Aggregate staff status list with location
    const staffList: StaffStatusItem[] = useMemo(() => {
        return employees.map(emp => {
            // Find all attendance records for this employee today
            const myAtts = attendances.filter(a => 
                (a.operator_id && emp.employee_id && a.operator_id.toLowerCase() === emp.employee_id.toLowerCase()) ||
                (a.operator_id && emp.auth_user_id && a.operator_id === emp.auth_user_id) ||
                (a.operator_id && emp.id && a.operator_id === emp.id)
            );

            // Primary active or latest attendance record
            let primaryAtt: AttendanceRecord | null = myAtts.length > 0
                ? (myAtts.find(a => !a.clock_out) || myAtts[myAtts.length - 1])
                : null;

            // Check if employee is on leave
            const isOnLeave = leaves.some(l => 
                l.employee_id === emp.employee_id || 
                l.employee_id === emp.auth_user_id ||
                l.employee_id === emp.id
            );

            // Compute work context
            const workContext: WorkContext = {};

            // 1. Check machine active
            const activeMachine = activeMachines.find(m => 
                (m.operator_id && emp.id && m.operator_id === emp.id) ||
                (m.operator_id && emp.auth_user_id && m.operator_id === emp.auth_user_id) ||
                (m.operator_id && emp.employee_id && m.operator_id === emp.employee_id)
            );
            if (activeMachine) {
                workContext.machineName = activeMachine.machine_id;
                workContext.sku = activeMachine.product_name || activeMachine.sku;
            } else if (primaryAtt?.machine_id) {
                workContext.machineName = primaryAtt.machine_id;
            }

            // 2. Check production logs
            const empLogs = productionLogs.filter(l => 
                (l.operator_id && emp.id && l.operator_id === emp.id) ||
                (l.operator_id && emp.employee_id && l.operator_id.toLowerCase() === emp.employee_id.toLowerCase()) ||
                (l.operator_id && emp.auth_user_id && l.operator_id === emp.auth_user_id)
            );
            if (empLogs.length > 0) {
                const totalQty = empLogs.reduce((acc, cur) => acc + (Number(cur.output_qty) || 0), 0);
                workContext.outputCount = totalQty;
                workContext.lastLogTime = empLogs[0].created_at;
            }

            // 3. Driver Logic: Trips, Drops, and Virtual Attendance
            let driverOrdersForToday: any[] = [];
            if (emp.role === 'Driver') {
                const dids = [emp.id, emp.auth_user_id, emp.employee_id, emp.name]
                    .filter(Boolean)
                    .map(x => String(x).toLowerCase());

                driverOrdersForToday = driverTrips.filter(o => 
                    o.driver_id && dids.includes(String(o.driver_id).toLowerCase()) && o.status !== 'Cancelled'
                );
                const empMileage = mileageLogs.filter(l => 
                    l.driver_id && dids.includes(String(l.driver_id).toLowerCase())
                );

                if (driverOrdersForToday.length > 0) {
                    const deliveredCount = driverOrdersForToday.filter(o => o.status === 'Delivered').length;
                    const totalCount = driverOrdersForToday.length;
                    const primaryZone = driverOrdersForToday[0].zone || t('配送中');
                    const hasOngoing = driverOrdersForToday.some(o => o.status === 'Loaded' || o.status === 'In-Transit');
                    workContext.deliveryTrip = `${primaryZone} · ${deliveredCount}/${totalCount} Drop (${hasOngoing ? t('配送中') : t('已完成')})`;
                }

                // If Driver has no explicit machine attendance record, synthesize from mileage logs and sales orders
                if (!primaryAtt && (driverOrdersForToday.length > 0 || empMileage.length > 0)) {
                    const startLog = empMileage.find(l => l.log_type === 'start');
                    const endLog = [...empMileage].reverse().find(l => l.log_type === 'end');

                    const startMytIso = new Date(`${selectedDate}T00:00:00+08:00`).toISOString();
                    const endMytIso = new Date(`${selectedDate}T23:59:59.999+08:00`).toISOString();

                    const todayActivityTimes = driverOrdersForToday
                        .flatMap(o => [o.created_at, o.pod_timestamp])
                        .filter(t => t && t >= startMytIso && t <= endMytIso)
                        .sort();

                    let clockIn: string | null = null;
                    if (startLog?.created_at) {
                        clockIn = startLog.created_at;
                    } else if (todayActivityTimes.length > 0) {
                        clockIn = todayActivityTimes[0];
                    } else if (driverOrdersForToday.length > 0) {
                        clockIn = `${selectedDate}T08:00:00+08:00`;
                    }

                    const deliveredOrders = driverOrdersForToday.filter(o => o.status === 'Delivered');
                    const allDelivered = driverOrdersForToday.length > 0 && deliveredOrders.length === driverOrdersForToday.length;
                    let clockOut: string | null = null;
                    if (endLog?.created_at) {
                        clockOut = endLog.created_at;
                    } else if (allDelivered && deliveredOrders.length > 0) {
                        const podTimes = deliveredOrders.map(o => o.pod_timestamp).filter(Boolean).sort();
                        clockOut = podTimes[podTimes.length - 1] || null;
                    }

                    let hoursWorked = 0;
                    if (clockIn && clockOut) {
                        const inMs = new Date(clockIn).getTime();
                        const outMs = new Date(clockOut).getTime();
                        if (outMs > inMs) {
                            hoursWorked = Math.max(0.5, Math.round(((outMs - inMs) / 3600000) * 10) / 10);
                        }
                    } else if (clockIn) {
                        const inMs = new Date(clockIn).getTime();
                        const nowMs = Date.now();
                        if (nowMs > inMs) {
                            hoursWorked = Math.max(0.5, Math.min(16, Math.round(((nowMs - inMs) / 3600000) * 10) / 10));
                        }
                    }

                    if (clockIn) {
                        primaryAtt = {
                            id: `virtual-driver-${emp.id || emp.employee_id}-${selectedDate}`,
                            operator_id: emp.employee_id || emp.auth_user_id || emp.id,
                            date: selectedDate,
                            clock_in: clockIn,
                            clock_out: clockOut,
                            hours_worked: hoursWorked,
                            machine_id: null,
                            notes: endLog 
                                ? `[Lorry Shift Selesai] ${deliveredOrders.length}/${driverOrdersForToday.length} Drops`
                                : (driverOrdersForToday.some(o => o.status === 'In-Transit' || o.status === 'Loaded')
                                    ? `[Delivery In-Progress] ${deliveredOrders.length}/${driverOrdersForToday.length} Drops`
                                    : `[Driver Schedule] ${driverOrdersForToday.length} Orders`),
                            is_verified: false,
                            verified_by: null,
                            verified_at: null,
                            verification_notes: null
                        };
                    }
                }
            }

            // 4. Check special tasks in notes
            if (primaryAtt?.notes && primaryAtt.notes.includes('SpecialTask:')) {
                workContext.specialTask = primaryAtt.notes.replace('SpecialTask:', '').split(';')[0];
            }

            // Compute status
            let status: 'ACTIVE' | 'PENDING' | 'APPROVED' | 'ABSENT' | 'LEAVE' = 'ABSENT';

            if (isOnLeave) {
                status = 'LEAVE';
            } else if (primaryAtt) {
                if (isRecordVerified(primaryAtt)) {
                    status = 'APPROVED'; // Shift finished & verified
                } else if (!primaryAtt.clock_out || (emp.role === 'Driver' && driverOrdersForToday.some(o => o.status === 'Loaded' || o.status === 'In-Transit'))) {
                    status = 'ACTIVE'; // In progress / delivery in-transit
                } else {
                    status = 'PENDING'; // Shift finished, waiting for Manager check-off!
                }
            } else {
                status = 'ABSENT';
            }

            // Resolve Location
            const loc = resolveLocation(emp, primaryAtt, workContext.machineName);

            return {
                employee: emp,
                attendance: primaryAtt,
                allAttendancesForDay: myAtts,
                status,
                location: loc,
                workContext
            };
        });
    }, [employees, attendances, leaves, activeMachines, productionLogs, driverTrips, mileageLogs, selectedDate, resolveLocation, t]);

    // Location distribution counts across entire staff
    const locationCounts = useMemo(() => {
        const counts: Record<LocationFilter, number> = {
            ALL: staffList.length,
            Taiping: 0,
            Nilai: 0,
            Johor: 0,
            Kelantan: 0
        };
        staffList.forEach(item => {
            if (counts[item.location] !== undefined) {
                counts[item.location]++;
            }
        });
        return counts;
    }, [staffList]);

    // Pending counts by location (for batch approval buttons)
    const pendingCountsByLocation = useMemo(() => {
        const counts: Record<LocationKey, number> = {
            Taiping: 0,
            Nilai: 0,
            Johor: 0,
            Kelantan: 0
        };
        staffList.forEach(item => {
            if (item.status === 'PENDING' && item.attendance) {
                counts[item.location]++;
            }
        });
        return counts;
    }, [staffList]);

    // KPI Summary Metrics (Dynamic based on selected location filter)
    const metrics = useMemo(() => {
        const targetList = locationFilter === 'ALL' 
            ? staffList 
            : staffList.filter(s => s.location === locationFilter);

        const total = targetList.length;
        const active = targetList.filter(s => s.status === 'ACTIVE').length;
        const pending = targetList.filter(s => s.status === 'PENDING').length;
        const approved = targetList.filter(s => s.status === 'APPROVED').length;
        const absent = targetList.filter(s => s.status === 'ABSENT' || s.status === 'LEAVE').length;

        return { total, active, pending, approved, absent };
    }, [staffList, locationFilter]);

    // Filtered items (Location + Role + Status + Search)
    const filteredStaffList = useMemo(() => {
        return staffList.filter(item => {
            // Location filter
            if (locationFilter !== 'ALL' && item.location !== locationFilter) {
                return false;
            }

            // Role filter
            if (roleFilter !== 'ALL') {
                if (roleFilter === 'Operator' && item.employee.role !== 'Operator') return false;
                if (roleFilter === 'Driver' && item.employee.role !== 'Driver') return false;
                if (roleFilter === 'Warehouse' && !['Warehouse', 'LogisticsCoordinator'].includes(item.employee.role)) return false;
                if (roleFilter === 'Office' && !['Admin', 'SuperAdmin', 'Manager', 'HR', 'Sales', 'Finance'].includes(item.employee.role)) return false;
            }

            // Status filter
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'PENDING' && item.status !== 'PENDING') return false;
                if (statusFilter === 'ACTIVE' && item.status !== 'ACTIVE') return false;
                if (statusFilter === 'APPROVED' && item.status !== 'APPROVED') return false;
                if (statusFilter === 'ABSENT' && !['ABSENT', 'LEAVE'].includes(item.status)) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = (item.employee.name || '').toLowerCase();
                const empId = (item.employee.employee_id || '').toLowerCase();
                const machine = (item.attendance?.machine_id || item.workContext.machineName || '').toLowerCase();
                const role = (item.employee.role || '').toLowerCase();
                const locName = `${getLocLabel(item.location)} ${LOCATION_CONFIG[item.location]?.labelEn || ''} ${item.location}`.toLowerCase();
                if (!name.includes(q) && !empId.includes(q) && !machine.includes(q) && !role.includes(q) && !locName.includes(q)) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            // Prioritize PENDING items at top for quick manager action!
            const order = { PENDING: 0, ACTIVE: 1, APPROVED: 2, ABSENT: 3, LEAVE: 4 };
            return order[a.status] - order[b.status];
        });
    }, [staffList, locationFilter, roleFilter, statusFilter, searchQuery]);

    // Grouped items by location (for Grouped View mode)
    const groupedByLocation = useMemo(() => {
        const groups: Record<LocationKey, StaffStatusItem[]> = {
            Taiping: [],
            Nilai: [],
            Johor: [],
            Kelantan: []
        };
        filteredStaffList.forEach(item => {
            groups[item.location].push(item);
        });
        return groups;
    }, [filteredStaffList]);

    // Helper: Safe Update Attendance (Gracefully degrades to notes tag if is_verified columns don't exist in DB)
    const safeUpdateAttendance = async (id: string, payload: Record<string, any>) => {
        const { error } = await supabase
            .from('operator_attendance')
            .update(payload)
            .eq('id', id);

        if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('is_verified'))) {
            // Strip out schema extension columns that do not exist yet in DB
            const { is_verified, verified_by, verified_at, verification_notes, ...fallbackPayload } = payload;
            const { error: fallbackError } = await supabase
                .from('operator_attendance')
                .update(fallbackPayload)
                .eq('id', id);
            if (fallbackError) throw fallbackError;
            return;
        }
        if (error) throw error;
    };

    // Helper: Safe Insert Attendance (Gracefully degrades to notes tag if is_verified columns don't exist in DB)
    const safeInsertAttendance = async (payload: Record<string, any>) => {
        const { error } = await supabase
            .from('operator_attendance')
            .insert(payload);

        if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('is_verified'))) {
            const { is_verified, verified_by, verified_at, verification_notes, ...fallbackPayload } = payload;
            const { error: fallbackError } = await supabase
                .from('operator_attendance')
                .insert(fallbackPayload);
            if (fallbackError) throw fallbackError;
            return;
        }
        if (error) throw error;
    };

    // Handle Single Sign-Off (打钩核准)
    const handleSignOff = async (item: StaffStatusItem) => {
        if (!item.attendance) return;

        const record = item.attendance;
        const nowIso = new Date().toISOString();
        const verifierName = user?.name || user?.employeeId || 'Manager';

        try {
            const cleanNotes = (record.notes || '').replace(/\[Verified by [^\]]+\]/g, '').trim();
            const updatedNotes = cleanNotes 
                ? `${cleanNotes} [Verified by ${verifierName} at ${nowIso.slice(11, 16)}]`.trim()
                : `[Verified by ${verifierName} at ${nowIso.slice(11, 16)}]`;

            // Optimistic UI update
            setAttendances(prev => prev.map(a => {
                if (a.id === record.id) {
                    return {
                        ...a,
                        is_verified: true,
                        verified_by: verifierName,
                        verified_at: nowIso,
                        notes: updatedNotes
                    };
                }
                return a;
            }));

            // If virtual driver record, crystallize by inserting into operator_attendance
            if (record.id.startsWith('virtual-driver-')) {
                await safeInsertAttendance({
                    operator_id: item.employee.employee_id || item.employee.auth_user_id || item.employee.id,
                    date: selectedDate,
                    clock_in: record.clock_in,
                    clock_out: record.clock_out,
                    hours_worked: record.hours_worked,
                    machine_id: null,
                    is_verified: true,
                    verified_by: verifierName,
                    verified_at: nowIso,
                    verification_notes: record.verification_notes || null,
                    notes: updatedNotes
                });
            } else {
                await safeUpdateAttendance(record.id, {
                    is_verified: true,
                    verified_by: verifierName,
                    verified_at: nowIso,
                    notes: updatedNotes
                });
            }

            if (user) {
                logActivity(user, 'APPROVE_ATTENDANCE', {
                    operator_id: record.operator_id,
                    attendance_id: record.id,
                    hours_worked: record.hours_worked,
                    location: item.location
                });
            }

            // Reload data to reflect DB changes
            await loadData(false);
        } catch (err: any) {
            console.error("Failed to sign off:", err);
            alert(`${t('核准更新失败')}: ${err?.message || err}`);
            loadData(false);
        }
    };

    // Handle Un-approve (撤销核准)
    const handleUnapprove = async (item: StaffStatusItem) => {
        if (!item.attendance) return;
        const record = item.attendance;

        const confirmed = window.confirm(`${t('确定要撤销员工')}【${item.employee.name}】${t('的工时核准标记吗？\n撤销后将回到待审核状态。')}`);
        if (!confirmed) return;

        try {
            const cleanNotes = (record.notes || '').replace(/\[Verified by [^\]]+\]/g, '').trim();

            // Optimistic UI update
            setAttendances(prev => prev.map(a => {
                if (a.id === record.id) {
                    return { 
                        ...a, 
                        is_verified: false, 
                        verified_by: null, 
                        verified_at: null, 
                        notes: cleanNotes 
                    };
                }
                return a;
            }));

            await safeUpdateAttendance(record.id, {
                is_verified: false,
                verified_by: null,
                verified_at: null,
                notes: cleanNotes
            });
        } catch (err) {
            console.error("Failed to un-approve:", err);
            loadData(false);
        }
    };

    // Handle Batch Approve All (可针对全厂或某个特定厂区一键全部打钩核准)
    const handleBatchApprove = async (targetLoc?: LocationKey) => {
        // Collect all pending items matching location scope
        const pendingItems = staffList.filter(s => {
            if (s.status !== 'PENDING' || !s.attendance) return false;
            if (targetLoc) return s.location === targetLoc;
            if (locationFilter !== 'ALL') return s.location === locationFilter;
            return true;
        });

        if (pendingItems.length === 0) {
            alert(t('当前视图下没有待审核的员工记录。'));
            return;
        }

        const locLabel = targetLoc ? `【${getLocLabel(targetLoc)}】` : '';
        const confirmed = window.confirm(`${t('确定要一键核准')}${locLabel}${t('当前厂区的')} ${pendingItems.length} ${t('位员工下班工时吗？\n核准后将自动锁定考勤记录并归档。')}`);
        if (!confirmed) return;

        setBatchLoading(true);
        const nowIso = new Date().toISOString();
        const verifierName = user?.name || user?.employeeId || 'Manager';

        try {
            for (const item of pendingItems) {
                if (!item.attendance) continue;
                const rec = item.attendance;
                const cleanNotes = (rec.notes || '').replace(/\[Verified by [^\]]+\]/g, '').trim();
                const updatedNotes = cleanNotes 
                    ? `${cleanNotes} [Verified by ${verifierName} at ${nowIso.slice(11, 16)}]`.trim()
                    : `[Verified by ${verifierName} at ${nowIso.slice(11, 16)}]`;

                if (rec.id.startsWith('virtual-driver-')) {
                    await safeInsertAttendance({
                        operator_id: item.employee.employee_id || item.employee.auth_user_id || item.employee.id,
                        date: selectedDate,
                        clock_in: rec.clock_in,
                        clock_out: rec.clock_out,
                        hours_worked: rec.hours_worked,
                        machine_id: null,
                        is_verified: true,
                        verified_by: verifierName,
                        verified_at: nowIso,
                        verification_notes: rec.verification_notes || null,
                        notes: updatedNotes
                    });
                } else {
                    await safeUpdateAttendance(rec.id, {
                        is_verified: true,
                        verified_by: verifierName,
                        verified_at: nowIso,
                        notes: updatedNotes
                    });
                }
            }

            await loadData(false);
            alert(`✅ ${t('成功批量核准')} ${pendingItems.length} ${t('条下班记录！')}`);
        } catch (err) {
            console.error("Batch sign-off error:", err);
            alert(t('批量核准过程中出现问题，请刷新重试。'));
        } finally {
            setBatchLoading(false);
        }
    };

    // Open Adjust Hours Modal
    const handleOpenAdjustModal = (item: StaffStatusItem) => {
        setEditingStaffItem(item);
        const att = item.attendance;

        const defaultClockIn = formatMytDatetimeLocal(att?.clock_in, selectedDate);
        const defaultClockOut = formatMytDatetimeLocal(att?.clock_out, selectedDate);

        setEditForm({
            clock_in: defaultClockIn,
            clock_out: defaultClockOut,
            hours_worked: att?.hours_worked !== undefined && att?.hours_worked !== null ? Number(att.hours_worked) : 8,
            machine_id: att?.machine_id || item.workContext.machineName || '',
            location: item.location,
            verification_notes: att?.verification_notes || '',
            autoApprove: true
        });
        setAdjustModalOpen(true);
    };

    // Recalculate hours worked when times change in adjust modal
    const handleTimeChange = (type: 'clock_in' | 'clock_out', val: string) => {
        setEditForm(prev => {
            const nextForm = { ...prev, [type]: val };
            if (nextForm.clock_in && nextForm.clock_out) {
                const inTime = new Date(nextForm.clock_in).getTime();
                const outTime = new Date(nextForm.clock_out).getTime();
                if (outTime > inTime) {
                    const diffHours = Math.round(((outTime - inTime) / 3600000) * 100) / 100;
                    nextForm.hours_worked = diffHours;
                }
            }
            return nextForm;
        });
    };

    // Save Adjustment & Sign-Off
    const handleSaveAdjust = async () => {
        if (!editingStaffItem) return;
        setSavingAdjust(true);

        const emp = editingStaffItem.employee;
        const att = editingStaffItem.attendance;
        const nowIso = new Date().toISOString();
        const verifierName = user?.name || user?.employeeId || 'Manager';

        try {
            const clockInIso = editForm.clock_in ? new Date(editForm.clock_in).toISOString() : null;
            const clockOutIso = editForm.clock_out ? new Date(editForm.clock_out).toISOString() : null;
            const hoursVal = Number(editForm.hours_worked) || 0;

            if (att && !att.id.startsWith('virtual-driver-')) {
                // Update existing record
                const cleanNotes = att.notes || '';
                const updatedNotes = editForm.autoApprove
                    ? (cleanNotes.includes('[Verified') ? cleanNotes : `${cleanNotes} [Verified by ${verifierName} at ${nowIso.slice(11, 16)}]`.trim())
                    : cleanNotes;

                await safeUpdateAttendance(att.id, {
                    clock_in: clockInIso,
                    clock_out: clockOutIso,
                    hours_worked: hoursVal,
                    machine_id: editForm.machine_id || att.machine_id || null,
                    is_verified: editForm.autoApprove ? true : att.is_verified,
                    verified_by: editForm.autoApprove ? verifierName : att.verified_by,
                    verified_at: editForm.autoApprove ? nowIso : att.verified_at,
                    verification_notes: editForm.verification_notes || att.verification_notes || null,
                    notes: updatedNotes
                });
            } else {
                // Insert new manual / 补卡 record (or virtual driver crystallization)
                const newNotes = `Manual entry by ${verifierName}${editForm.autoApprove ? ` [Verified by ${verifierName}]` : ''}`;

                await safeInsertAttendance({
                    operator_id: emp.employee_id || emp.auth_user_id || emp.id,
                    date: selectedDate,
                    clock_in: clockInIso,
                    clock_out: clockOutIso,
                    hours_worked: hoursVal,
                    machine_id: editForm.machine_id || null,
                    is_verified: editForm.autoApprove,
                    verified_by: editForm.autoApprove ? verifierName : null,
                    verified_at: editForm.autoApprove ? nowIso : null,
                    verification_notes: editForm.verification_notes || null,
                    notes: newNotes
                });
            }

            setAdjustModalOpen(false);
            await loadData(false);
            alert(t('✅ 工时记录调整已成功保存！'));
        } catch (err: any) {
            console.error("Save adjust error:", err);
            alert(`${t('保存失败')}: ${err.message || err}`);
        } finally {
            setSavingAdjust(false);
        }
    };

    // Render Single Staff Card
    const renderStaffCard = (item: StaffStatusItem) => {
        const { employee: emp, attendance: att, status, location, workContext } = item;
        const locConfig = LOCATION_CONFIG[location];

        // Card styling by status
        const borderColors = {
            PENDING: 'border-amber-500/40 bg-amber-500/[0.03] hover:border-amber-500',
            ACTIVE: 'border-emerald-500/30 bg-emerald-500/[0.02] hover:border-emerald-500/60',
            APPROVED: 'border-blue-500/20 bg-blue-500/[0.02] hover:border-blue-500/50',
            ABSENT: 'border-white/5 bg-white/[0.01] hover:border-white/10 opacity-70',
            LEAVE: 'border-purple-500/20 bg-purple-500/[0.02] opacity-80'
        };

        return (
            <div
                key={emp.id || emp.employee_id}
                className={`p-4 md:p-5 rounded-3xl border transition-all shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 apple-glass ${borderColors[status]}`}
            >
                {/* LEFT: Employee Info, Role & Location Badge */}
                <div className="flex items-center gap-3.5 min-w-[240px]">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-base font-black text-white overflow-hidden shrink-0 shadow-inner">
                        {emp.photoURL ? (
                            <img src={emp.photoURL} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                            <span>{(emp.name || 'Emp').slice(0, 2).toUpperCase()}</span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white tracking-wide">
                                {emp.name}
                            </h3>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300 border border-white/10">
                                {emp.employee_id || 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                            {/* Role Badge */}
                            <span className="px-2 py-0.5 rounded-lg bg-white/5 text-gray-300 border border-white/10 font-medium">
                                {t(emp.role) || emp.role}
                            </span>

                            {/* Location Badge (High-contrast Factory Tag) */}
                            <span className={`px-2 py-0.5 rounded-lg font-bold border flex items-center gap-1 ${locConfig.badgeClass}`}>
                                <MapPin size={10} />
                                <span>{getLocLabel(location)}</span>
                                <span className="text-[9px] opacity-70">({locConfig.code})</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* MIDDLE: Work Status & Context Details */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 border-y lg:border-y-0 lg:border-x border-white/10 py-3 lg:py-0 lg:px-4">
                    {/* 1. Status Indicator */}
                    <div>
                        <span className="text-[10px] text-gray-400 font-semibold block mb-0.5">{t('当前状态')}</span>
                        {status === 'ACTIVE' && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>{t('在岗作业中')}</span>
                            </div>
                        )}
                        {status === 'PENDING' && (
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 animate-pulse">
                                <AlertCircle size={14} className="text-amber-400" />
                                <span>{t('已下班 · 待审核')}</span>
                            </div>
                        )}
                        {status === 'APPROVED' && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                                <CheckCircle2 size={14} className="text-blue-400" />
                                <span>{t('已核准结班')}</span>
                            </div>
                        )}
                        {status === 'ABSENT' && (
                            <div className="text-xs font-medium text-gray-500">
                                {t('未出勤 (无打卡)')}
                            </div>
                        )}
                        {status === 'LEAVE' && (
                            <div className="text-xs font-bold text-purple-400">
                                {t('休假中 (Approved Leave)')}
                            </div>
                        )}
                    </div>

                    {/* 2. Clock-In & Clock-Out Timestamps */}
                    <div>
                        <span className="text-[10px] text-gray-400 font-semibold block mb-0.5">{t('打卡时间 / 工时')}</span>
                        {att ? (
                            <div className="text-xs text-gray-200 font-mono">
                                <div className="flex items-center flex-wrap gap-y-0.5">
                                    <span className="text-gray-400">{t('入')}: </span>
                                    <span className="text-white font-medium">{formatTimeOnlyMyt(att.clock_in)}</span>
                                    <span className="text-gray-400 ml-2">{t('出')}: </span>
                                    <span className="text-white font-medium">{att.clock_out ? formatTimeOnlyMyt(att.clock_out) : (status === 'ACTIVE' ? t('进行中') : '--:--')}</span>
                                    {att.id.startsWith('virtual-driver-') && (
                                        <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                            {t('物流自动计算')}
                                        </span>
                                    )}
                                </div>
                                <div className="text-[11px] text-gray-400 mt-0.5">
                                    {t('核算工时')}: <strong className="text-emerald-300 font-black">{att.hours_worked || 0} h</strong>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-gray-500">--</span>
                        )}
                    </div>

                    {/* 3. Realtime Machine / Work Context */}
                    <div>
                        <span className="text-[10px] text-gray-400 font-semibold block mb-0.5">{t('现场作业详情')}</span>
                        <div className="text-xs text-gray-300 space-y-0.5">
                            {workContext.machineName && (
                                <p className="flex items-center gap-1 font-semibold text-white">
                                    <Factory size={12} className="text-indigo-400" />
                                    <span>{t('机台')}: {workContext.machineName}</span>
                                </p>
                            )}
                            {workContext.sku && (
                                <p className="text-[11px] text-gray-400 truncate max-w-[180px]">
                                    {t('产品')}: {workContext.sku}
                                </p>
                            )}
                            {workContext.outputCount !== undefined && (
                                <p className="text-[11px] text-cyan-300 font-mono">
                                    {t('产出')}: {workContext.outputCount} {t('卷')}
                                </p>
                            )}
                            {workContext.deliveryTrip && (
                                <p className="text-[11px] text-amber-300 flex items-center gap-1">
                                    <Truck size={12} />
                                    <span>{workContext.deliveryTrip}</span>
                                </p>
                            )}
                            {workContext.specialTask && (
                                <p className="text-[11px] text-purple-300">
                                    {t('专项')}: {workContext.specialTask}
                                </p>
                            )}
                            {!workContext.machineName && !workContext.deliveryTrip && !workContext.specialTask && att && (
                                <p className="text-[11px] text-gray-400">
                                    {att.notes || t('日常考勤打卡')}
                                </p>
                            )}
                            {!att && <span className="text-gray-500">--</span>}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Verification Status & Actions */}
                <div className="flex items-center gap-2 shrink-0 justify-end flex-wrap sm:flex-nowrap">
                    {/* Case 1: PENDING SIGN-OFF -> Huge Green Checkmark */}
                    {status === 'PENDING' && (
                        <>
                            <button
                                type="button"
                                onClick={() => handleSignOff(item)}
                                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xl shadow-emerald-600/30 active:scale-95 transition cursor-pointer border border-emerald-400/30"
                            >
                                <Check size={16} />
                                <span>{t('打钩核准')}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleOpenAdjustModal(item)}
                                className="px-3 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                title={t('微调工时或补充说明')}
                            >
                                <Edit3 size={13} />
                                <span className="hidden sm:inline">{t('微调工时')}</span>
                            </button>
                        </>
                    )}

                    {/* Case 2: APPROVED -> Verified Badge with Revert & Edit */}
                    {status === 'APPROVED' && (
                        <div className="flex items-center gap-2">
                            <div className="text-right hidden sm:block">
                                <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                                    <ShieldCheck size={14} />
                                    <span>{t('已核准锁定')}</span>
                                </div>
                                <p className="text-[10px] text-gray-500 font-mono">
                                    {att?.verified_by || 'Manager'} · {att?.verified_at ? att.verified_at.slice(11, 16) : ''}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleOpenAdjustModal(item)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition cursor-pointer"
                                title={t('修改记录')}
                            >
                                <Edit3 size={14} />
                            </button>

                            <button
                                type="button"
                                onClick={() => handleUnapprove(item)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 border border-white/10 transition cursor-pointer"
                                title={t('撤销核准')}
                            >
                                <Unlock size={14} />
                            </button>
                        </div>
                    )}

                    {/* Case 3: ACTIVE WORKING -> In Progress Indicator with Manual Action */}
                    {status === 'ACTIVE' && (
                        <button
                            type="button"
                            onClick={() => handleOpenAdjustModal(item)}
                            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <Clock size={13} className="text-emerald-400" />
                            <span>{t('现场补卡 / 结班')}</span>
                        </button>
                    )}

                    {/* Case 4: ABSENT -> Manual Clock In */}
                    {status === 'ABSENT' && (
                        <button
                            type="button"
                            onClick={() => handleOpenAdjustModal(item)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 text-xs font-medium transition cursor-pointer"
                        >
                            + {t('补录考勤')}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen text-apple-textMain dark:text-white font-sans selection:bg-apple-blue/30 overflow-x-hidden p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            
            {/* 1. TOP HEADER & DATE BAR */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 apple-glass p-5 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3.5 z-10">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                        <CheckSquare size={26} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
                                {t('员工状态与交班核准')}
                            </h1>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                Manager Hub
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {t('全厂多岗位状态实时监控 · 厂区分类透视 · 下班工时核验 · 现场打钩交班')}
                        </p>
                    </div>
                </div>

                {/* Date Controls & Action Buttons */}
                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full md:w-auto justify-between md:justify-end z-10">
                    {/* Date Navigation */}
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-2xl p-1 shadow-inner">
                        <button
                            type="button"
                            onClick={() => setSelectedDate(prev => addDaysYmd(prev, -1))}
                            className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                            title={t('前一天')}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="flex items-center gap-1.5 px-2">
                            <Calendar size={14} className="text-indigo-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="bg-transparent text-xs font-mono font-bold text-white border-none outline-none cursor-pointer focus:ring-0"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setSelectedDate(prev => addDaysYmd(prev, 1))}
                            className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                            title={t('后一天')}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Quick Today Button */}
                    {selectedDate !== mytTodayYmd() && (
                        <button
                            type="button"
                            onClick={() => setSelectedDate(mytTodayYmd())}
                            className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition cursor-pointer"
                        >
                            {t('回到今天')}
                        </button>
                    )}

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={() => loadData(true)}
                        disabled={isRefreshing}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition cursor-pointer disabled:opacity-50"
                        title={t('刷新数据')}
                    >
                        <RefreshCw size={15} className={isRefreshing ? "animate-spin text-indigo-400" : ""} />
                    </button>

                    {/* Batch Approve All Button */}
                    {metrics.pending > 0 && (
                        <button
                            type="button"
                            onClick={() => handleBatchApprove()}
                            disabled={batchLoading}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                        >
                            <Check size={14} />
                            <span>{t('一键全审')} ({metrics.pending})</span>
                        </button>
                    )}
                </div>
            </header>

            {/* 2. REGION / LOCATION CLASSIFICATION BAR (地区分类导航) */}
            <div className="apple-glass p-3 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
                {/* Location Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <span className="text-xs font-bold text-gray-400 flex items-center gap-1 mr-1 shrink-0">
                        <MapPin size={13} className="text-indigo-400" />
                        <span>{t('厂区地区')}:</span>
                    </span>

                    {/* All Locations */}
                    <button
                        type="button"
                        onClick={() => setLocationFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                            locationFilter === 'ALL'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <span>{t('全部地区')}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            locationFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                        }`}>
                            {locationCounts.ALL}
                        </span>
                    </button>

                    {/* Specific Locations */}
                    {(['Taiping', 'Nilai', 'Johor', 'Kelantan'] as const).map(loc => {
                        const conf = LOCATION_CONFIG[loc];
                        const count = locationCounts[loc];
                        const pendingCount = pendingCountsByLocation[loc];
                        const isSelected = locationFilter === loc;

                        return (
                            <button
                                key={loc}
                                type="button"
                                onClick={() => setLocationFilter(loc)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                                    isSelected
                                        ? `${conf.bgClass} ${conf.color} border ${conf.borderClass} shadow-md`
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-current' : 'bg-gray-500'}`}></span>
                                <span>{getLocLabel(loc)}</span>
                                <span className="text-[10px] opacity-70">({conf.code})</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                                }`}>
                                    {count}
                                </span>
                                {pendingCount > 0 && (
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title={`${pendingCount} ${t('人待审核')}`}></span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* View Mode Toggle: Flat vs Grouped by Location */}
                <div className="flex items-center gap-1 self-end sm:self-center shrink-0 bg-black/40 p-1 rounded-xl border border-white/10">
                    <button
                        type="button"
                        onClick={() => setViewMode('flat')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                            viewMode === 'flat' 
                                ? 'bg-white/15 text-white shadow-sm' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                        title={t('紧凑列表视图')}
                    >
                        <LayoutGrid size={13} />
                        <span>{t('列表')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('grouped')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                            viewMode === 'grouped' 
                                ? 'bg-white/15 text-white shadow-sm' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                        title={t('按地区分栏看板')}
                    >
                        <Layers size={13} />
                        <span>{t('按厂区分栏')}</span>
                    </button>
                </div>
            </div>

            {/* Location Focus Notification Banner (if specific location selected) */}
            {locationFilter !== 'ALL' && (
                <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${LOCATION_CONFIG[locationFilter].bgClass} ${LOCATION_CONFIG[locationFilter].borderClass}`}>
                    <div className="flex items-center gap-2">
                        <Building size={16} className={LOCATION_CONFIG[locationFilter].color} />
                        <span className="text-white font-bold">
                            {t('当前专注厂区')}: <span className={LOCATION_CONFIG[locationFilter].color}>{getLocLabel(locationFilter)} ({LOCATION_CONFIG[locationFilter].labelEn} · {LOCATION_CONFIG[locationFilter].code})</span>
                        </span>
                        <span className="text-gray-400">{t('· 统计卡片与列表已自动联动过滤')}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setLocationFilter('ALL')}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition"
                    >
                        {t('清除筛选 (查看全厂)')}
                    </button>
                </div>
            )}

            {/* 3. STATISTICAL KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* Total Employees */}
                <div 
                    onClick={() => { setStatusFilter('ALL'); setRoleFilter('ALL'); }}
                    className="apple-glass p-4 rounded-2xl border border-white/10 hover:border-indigo-500/40 transition cursor-pointer group"
                >
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                        <span>{locationFilter === 'ALL' ? t('全厂在册员工') : `${getLocLabel(locationFilter)} ${t('在册')}`}</span>
                        <Users size={16} className="text-gray-400 group-hover:text-indigo-400 transition" />
                    </div>
                    <p className="text-2xl font-black text-white font-mono">{metrics.total}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{t('激活状态员工总数')}</p>
                </div>

                {/* Active Working */}
                <div 
                    onClick={() => setStatusFilter('ACTIVE')}
                    className={`apple-glass p-4 rounded-2xl border transition cursor-pointer group ${
                        statusFilter === 'ACTIVE' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-500/40'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            {t('在岗作业中')}
                        </span>
                        <Clock size={16} className="text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-emerald-300 font-mono">{metrics.active}</p>
                    <p className="text-[11px] text-emerald-400/80 mt-1">{t('机台/司机/专项作业')}</p>
                </div>

                {/* Pending Sign-Off (High Priority) */}
                <div 
                    onClick={() => setStatusFilter('PENDING')}
                    className={`apple-glass p-4 rounded-2xl border transition cursor-pointer relative overflow-hidden group ${
                        statusFilter === 'PENDING' ? 'border-amber-500 bg-amber-500/15' : 'border-amber-500/40 hover:border-amber-500'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                        <span className="text-amber-300 font-bold flex items-center gap-1">
                            {metrics.pending > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>}
                            {t('下班待审核')}
                        </span>
                        <AlertCircle size={16} className="text-amber-400" />
                    </div>
                    <p className="text-2xl font-black text-amber-300 font-mono">{metrics.pending}</p>
                    <p className="text-[11px] text-amber-400/80 mt-1">{t('需经理逐项打钩核准')}</p>
                </div>

                {/* Approved Today */}
                <div 
                    onClick={() => setStatusFilter('APPROVED')}
                    className={`apple-glass p-4 rounded-2xl border transition cursor-pointer group ${
                        statusFilter === 'APPROVED' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:border-blue-500/40'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                        <span>{t('已核准结班')}</span>
                        <CheckCircle2 size={16} className="text-blue-400" />
                    </div>
                    <p className="text-2xl font-black text-blue-300 font-mono">{metrics.approved}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{t('经理已确认锁定')}</p>
                </div>

                {/* Absent / Leave */}
                <div 
                    onClick={() => setStatusFilter('ABSENT')}
                    className={`apple-glass p-4 rounded-2xl border transition cursor-pointer group ${
                        statusFilter === 'ABSENT' ? 'border-zinc-500 bg-white/5' : 'border-white/10 hover:border-zinc-500/40'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
                        <span>{t('未出勤 / 请假')}</span>
                        <Users size={16} className="text-gray-500" />
                    </div>
                    <p className="text-2xl font-black text-gray-400 font-mono">{metrics.absent}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{t('今日无打卡记录')}</p>
                </div>
            </div>

            {/* 4. ROLE & STATUS FILTER BAR & SEARCH */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 apple-glass p-3.5 rounded-2xl border border-white/10">
                {/* Role Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                    <span className="text-xs text-gray-400 mr-1 hidden sm:inline flex items-center gap-1 shrink-0">
                        <Filter size={12} /> {t('岗位')}:
                    </span>
                    {(['ALL', 'Operator', 'Driver', 'Warehouse', 'Office'] as const).map(role => {
                        const labels = {
                            ALL: t('全部岗位'),
                            Operator: t('机台操作员'),
                            Driver: t('物流司机'),
                            Warehouse: t('仓库仓管'),
                            Office: t('行政/管理')
                        };
                        const isActive = roleFilter === role;
                        return (
                            <button
                                key={role}
                                type="button"
                                onClick={() => setRoleFilter(role)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                                    isActive 
                                        ? 'bg-indigo-600 text-white shadow-sm' 
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {labels[role]}
                            </button>
                        );
                    })}
                </div>

                {/* Status Filter Tabs & Search */}
                <div className="flex items-center gap-2.5">
                    {/* Status dropdown */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="bg-zinc-900 border border-white/10 text-xs font-semibold text-white px-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                        <option value="ALL">{t('全部状态')}</option>
                        <option value="PENDING">🟡 {t('待审核')} ({metrics.pending})</option>
                        <option value="ACTIVE">🟢 {t('在岗中')} ({metrics.active})</option>
                        <option value="APPROVED">🔵 {t('已核准')} ({metrics.approved})</option>
                        <option value="ABSENT">⚪ {t('未出勤/请假')} ({metrics.absent})</option>
                    </select>

                    {/* Search Input */}
                    <div className="relative flex-1 sm:w-56">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('搜索姓名 / 工号 / 机台 / 地区...')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 text-xs pl-8 pr-3 py-1.5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 5. MAIN STAFF CARDS & LIST */}
            {loading ? (
                <div className="p-16 text-center apple-glass rounded-3xl border border-white/10 flex flex-col items-center justify-center gap-3">
                    <RefreshCw size={28} className="animate-spin text-indigo-400" />
                    <p className="text-sm text-gray-400 font-medium">{t('正在实时拉取各厂区全员考勤与工作流状态...')}</p>
                </div>
            ) : filteredStaffList.length === 0 ? (
                <div className="p-16 text-center apple-glass rounded-3xl border border-white/10 flex flex-col items-center justify-center gap-3">
                    <Users size={32} className="text-gray-500" />
                    <p className="text-sm text-gray-300 font-bold">{t('未找到符合条件的员工记录')}</p>
                    <p className="text-xs text-gray-500">{t('请尝试调整上方地区、岗位或状态筛选条件')}</p>
                </div>
            ) : viewMode === 'grouped' && locationFilter === 'ALL' ? (
                /* GROUPED BY LOCATION VIEW (按厂区分栏展示) */
                <div className="space-y-6">
                    {(['Taiping', 'Nilai', 'Johor', 'Kelantan'] as const).map(loc => {
                        const locItems = groupedByLocation[loc];
                        if (locItems.length === 0) return null;

                        const conf = LOCATION_CONFIG[loc];
                        const locPending = locItems.filter(i => i.status === 'PENDING').length;
                        const locActive = locItems.filter(i => i.status === 'ACTIVE').length;

                        return (
                            <div key={loc} className="space-y-3">
                                {/* Group Header */}
                                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${conf.bgClass} ${conf.borderClass} backdrop-blur-md`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-2 rounded-xl bg-black/40 border ${conf.borderClass}`}>
                                            <Building size={18} className={conf.color} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-base font-black text-white">
                                                    {getLocLabel(loc)}
                                                </h2>
                                                <span className="text-[11px] font-bold text-gray-400">
                                                    ({conf.labelEn} · {conf.code})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs mt-0.5">
                                                <span className="text-gray-300">{t('共')} <strong>{locItems.length}</strong> {t('人')}</span>
                                                <span className="text-emerald-400">🟢 <strong>{locActive}</strong> {t('人在岗')}</span>
                                                {locPending > 0 ? (
                                                    <span className="text-amber-300 font-bold animate-pulse">🟡 <strong>{locPending}</strong> {t('人待审核')}</span>
                                                ) : (
                                                    <span className="text-blue-400">🔵 {t('全部已审核')}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Location specific batch approve */}
                                    {locPending > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleBatchApprove(loc)}
                                            disabled={batchLoading}
                                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                                        >
                                            <Check size={14} />
                                            <span>{t('本厂一键全审')} ({locPending})</span>
                                        </button>
                                    )}
                                </div>

                                {/* Cards in this location */}
                                <div className="space-y-3">
                                    {locItems.map(item => renderStaffCard(item))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* FLAT VIEW (单列表，带突出地区标签) */
                <div className="space-y-3">
                    {filteredStaffList.map(item => renderStaffCard(item))}
                </div>
            )}

            {/* 6. ADJUST HOURS & VERIFICATION MODAL */}
            {adjustModalOpen && editingStaffItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-zinc-900 border border-white/15 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                    <Edit3 size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        {t('微调考勤工时与核对')}
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        {editingStaffItem.employee.name} ({editingStaffItem.employee.employee_id || 'No ID'}) · {selectedDate}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAdjustModalOpen(false)}
                                className="p-1 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Form Inputs */}
                        <div className="space-y-4">
                            {/* Location & Machine row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-300 font-semibold mb-1 block">
                                        {t('所属厂区地区')}
                                    </label>
                                    <select
                                        value={editForm.location}
                                        onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value as LocationKey }))}
                                        className="w-full bg-white/5 border border-white/10 text-xs px-3 py-2.5 rounded-xl text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="Taiping">{getLocLabel('Taiping')} (Taiping · T1)</option>
                                        <option value="Nilai">{getLocLabel('Nilai')} (Nilai · N1)</option>
                                        <option value="Johor">{getLocLabel('Johor')} (Johor · J1)</option>
                                        <option value="Kelantan">{getLocLabel('Kelantan')} (Kelantan · K1)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-300 font-semibold mb-1 block">
                                        {t('绑定机台 (可选)')}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={t('例: J1 / T1-M03')}
                                        value={editForm.machine_id}
                                        onChange={e => setEditForm(prev => ({ ...prev, machine_id: e.target.value.toUpperCase() }))}
                                        className="w-full bg-white/5 border border-white/10 text-xs px-3.5 py-2.5 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500 uppercase"
                                    />
                                </div>
                            </div>

                            {/* Clock In */}
                            <div>
                                <label className="text-xs text-gray-300 font-semibold mb-1 block">
                                    {t('上班打卡时间 (Clock In)')}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={editForm.clock_in}
                                    onChange={e => handleTimeChange('clock_in', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 text-xs px-3.5 py-2.5 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                                />
                            </div>

                            {/* Clock Out */}
                            <div>
                                <label className="text-xs text-gray-300 font-semibold mb-1 block">
                                    {t('下班打卡时间 (Clock Out)')}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={editForm.clock_out}
                                    onChange={e => handleTimeChange('clock_out', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 text-xs px-3.5 py-2.5 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                                />
                            </div>

                            {/* Calculated / Override Hours Worked */}
                            <div>
                                <label className="text-xs text-gray-300 font-semibold mb-1 block">
                                    {t('核算有效工时 (小时)')}
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="24"
                                    value={editForm.hours_worked}
                                    onChange={e => setEditForm(prev => ({ ...prev, hours_worked: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-white/5 border border-white/10 text-xs px-3.5 py-2.5 rounded-xl text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Verification Notes */}
                            <div>
                                <label className="text-xs text-gray-300 font-semibold mb-1 block">
                                    {t('微调备注说明 / 核验记录')}
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder={t('选填: 现场漏打卡原因、工时调整说明...')}
                                    value={editForm.verification_notes}
                                    onChange={e => setEditForm(prev => ({ ...prev, verification_notes: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 text-xs px-3.5 py-2 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                                />
                            </div>

                            {/* Auto Approve Checkbox */}
                            <label className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-3 rounded-xl cursor-pointer hover:bg-white/10 transition">
                                <input
                                    type="checkbox"
                                    checked={editForm.autoApprove}
                                    onChange={e => setEditForm(prev => ({ ...prev, autoApprove: e.target.checked }))}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 border-white/20"
                                />
                                <span className="text-xs text-white font-semibold">
                                    {t('保存并直接完成打钩核准 (锁定结班)')}
                                </span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                            <button
                                type="button"
                                onClick={() => setAdjustModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-semibold transition"
                            >
                                {t('取消')}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAdjust}
                                disabled={savingAdjust}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition disabled:opacity-50"
                            >
                                {savingAdjust ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>{t('保存记录')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffStatusSignOff;
