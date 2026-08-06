import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    CalendarDays, Award, AlertTriangle, Camera,
    DollarSign, Clock, ChevronLeft, ChevronRight, Activity, Users, Truck, X,
    FileSpreadsheet, Printer
} from 'lucide-react';
import { supabase } from '../services/supabase';
import * as XLSX from 'xlsx';

interface Props {
    user: any;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

interface DailyMetrics {
    dateStr: string;
    dayNum: number;
    isWeekend: boolean;
    isSunday: boolean;
    hasAttendance: boolean;
    outputQty: number;
    alarmCount: number;
    tripCount: number;
    tripEarnings: number;
    tripDetails: {
        id: string;
        order_number: string;
        customer: string;
        items: any[];
        notes: string;
        displayString: string;
        pod_photo_url?: string | null;
        pod_signature_url?: string | null;
        proof_of_load_url?: string | null;
        driver_id?: string | null;
        trip_origin?: string | null;
        zone?: string | null;
        trip_drop_count?: number;
        delivery_address?: string | null;
        earnings?: number;
    }[];
    photoCount: number;
    photos: any[];
    leaveStatus: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    notes: string | null;
    machinesOperated: string[];
}

const PersonalMonthlyReport: React.FC<Props> = ({ user }) => {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const saved = sessionStorage.getItem('pmr_selectedMonth');
        return saved ? parseInt(saved, 10) : today.getMonth() + 1;
    });
    const [selectedYear, setSelectedYear] = useState(() => {
        const saved = sessionStorage.getItem('pmr_selectedYear');
        return saved ? parseInt(saved, 10) : today.getFullYear();
    });
    const [loading, setLoading] = useState(true);

    // HR/Admin Selector States
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
        return sessionStorage.getItem('pmr_selectedEmployeeId') || '';
    });
    const [employeesList, setEmployeesList] = useState<any[]>([]);
    
    // Viewed Profile (could be self or someone else)
    const [viewedProfile, setViewedProfile] = useState<any>(null);

    // Attendance Edit Form States
    const [editClockIn, setEditClockIn] = useState<string>('');
    const [editClockOut, setEditClockOut] = useState<string>('');
    const [editAttendanceNotes, setEditAttendanceNotes] = useState<string>('');

    // Trip Edit Form States
    const [isEditingTrip, setIsEditingTrip] = useState<boolean>(false);
    const [editDriverId, setEditDriverId] = useState<string>('');
    const [editOrigin, setEditOrigin] = useState<string>('');
    const [editZone, setEditZone] = useState<string>('');
    const [editDropCount, setEditDropCount] = useState<number>(1);
    const [editNotes, setEditNotes] = useState<string>('');

    // Data states
    const [productionLogs, setProductionLogs] = useState<any[]>([]);
    const [attendanceShifts, setAttendanceShifts] = useState<any[]>([]);
    const [photoLogs, setPhotoLogs] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [plannedMachines, setPlannedMachines] = useState<any[]>([]);
    const [payroll, setPayroll] = useState<any | null>(null);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);
    const [driverLorryPlate, setDriverLorryPlate] = useState<string>('N/A');
    
    // Batch & Single Print States
    const [isPreparingBatchPrint, setIsPreparingBatchPrint] = useState(false);
    const [batchPrintData, setBatchPrintData] = useState<any[]>([]);
    
    // Modal / selection states
    const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
    const [selectedPhotoDay, setSelectedPhotoDay] = useState<any | null>(null);
    const [selectedAttendanceDay, setSelectedAttendanceDay] = useState<any | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string>('');

    const isDriver = viewedProfile?.role === 'Driver' || (!viewedProfile && user?.role === 'Driver');
    const isAdminOrHR = ['SuperAdmin', 'Admin', 'HR'].includes(currentUserRole);
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    // Sync selectedEmployeeId when user loads and handle session storage restoration safely
    useEffect(() => {
        if (user) {
            const loggedInUid = user.uid || user.id;
            const savedUserUid = sessionStorage.getItem('pmr_loggedInUserUid');
            const savedEmployeeId = sessionStorage.getItem('pmr_selectedEmployeeId');
            
            if (savedUserUid === loggedInUid && savedEmployeeId) {
                setSelectedEmployeeId(savedEmployeeId);
            } else {
                setSelectedEmployeeId(loggedInUid);
                sessionStorage.setItem('pmr_loggedInUserUid', loggedInUid);
                sessionStorage.setItem('pmr_selectedEmployeeId', loggedInUid);
            }
        }
    }, [user]);

    // Keep sessionStorage synced when filters change
    useEffect(() => {
        if (selectedEmployeeId) {
            sessionStorage.setItem('pmr_selectedEmployeeId', selectedEmployeeId);
        }
    }, [selectedEmployeeId]);

    useEffect(() => {
        sessionStorage.setItem('pmr_selectedMonth', String(selectedMonth));
    }, [selectedMonth]);

    useEffect(() => {
        sessionStorage.setItem('pmr_selectedYear', String(selectedYear));
    }, [selectedYear]);

    // Sync Attendance Edit Form when day selected
    useEffect(() => {
        if (selectedAttendanceDay) {
            const dateStr = selectedAttendanceDay.dateStr;
            const shift = attendanceShifts.find(s => s.date === dateStr);
            if (shift) {
                const toLocalDatetimeInput = (isoStr: string | null) => {
                    if (!isoStr) return '';
                    const d = new Date(isoStr);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                };
                setEditClockIn(toLocalDatetimeInput(shift.clock_in));
                setEditClockOut(toLocalDatetimeInput(shift.clock_out));
                setEditAttendanceNotes(shift.notes || '');
            } else {
                setEditClockIn(`${dateStr}T08:00`);
                setEditClockOut(`${dateStr}T17:00`);
                setEditAttendanceNotes('');
            }
        }
    }, [selectedAttendanceDay, attendanceShifts]);

    // Sync Trip Edit Form when trip selected
    useEffect(() => {
        if (selectedTrip) {
            setEditDriverId(selectedTrip.driver_id || selectedEmployeeId || '');
            setEditOrigin(selectedTrip.trip_origin || 'TAIPING');
            setEditZone(selectedTrip.zone || '');
            setEditDropCount(selectedTrip.trip_drop_count || 1);
            setEditNotes(selectedTrip.notes || '');
            setIsEditingTrip(false);
        }
    }, [selectedTrip, selectedEmployeeId]);

    // 1. Initial Load: Fetch Logged In User Profile to check permissions
    useEffect(() => {
        if (!user) return;
        const fetchPermissions = async () => {
            const { data } = await supabase
                .from('sys_users_v2')
                .select('role, auth_user_id')
                .eq('auth_user_id', user.uid || user.id)
                .single();

            // If Manager/HR/Admin/SuperAdmin, fetch all employees
            const role = data?.role || user.role;
            setCurrentUserRole(role);
            if (['SuperAdmin', 'Admin', 'Manager', 'HR'].includes(role)) {
                // HR Portal persists status as lowercase 'active'; Driver API / others may use 'Active'
                const activeStatuses = ['Active', 'active'];
                const [v2Res, pubRes] = await Promise.all([
                    supabase.from('sys_users_v2').select('auth_user_id, name, employee_id, role, status').in('status', activeStatuses),
                    supabase.from('users_public').select('id, name, employee_id, role, status').in('status', activeStatuses)
                ]);
                
                let merged: any[] = [];
                if (v2Res.data) {
                    merged = [...v2Res.data.filter(e => e.auth_user_id).map(e => ({...e, uid: e.auth_user_id}))];
                }
                if (pubRes.data) {
                    pubRes.data.forEach(p => {
                        if (!merged.find(m => m.uid === p.id)) {
                            merged.push({...p, uid: p.id, auth_user_id: p.id});
                        }
                    });
                }
                setEmployeesList(merged.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            }
        };
        fetchPermissions();
    }, [user]);

    // 2. Fetch Data whenever Employee or Month changes
    useEffect(() => {
        if (!selectedEmployeeId) return;
        fetchData();
    }, [selectedEmployeeId, selectedMonth, selectedYear]);

    const fetchData = async () => {
        setLoading(true);

        const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const lastDayObj = new Date(selectedYear, selectedMonth, 0);
        const lastDayStr = `${lastDayObj.getFullYear()}-${String(lastDayObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
        const startDateTs = `${firstDay}T00:00:00.000Z`;
        const endDateTs = `${lastDayStr}T23:59:59.999Z`;

        try {
            // A. Fetch Viewed User Profile
            let { data: profileData } = await supabase
                .from('sys_users_v2')
                .select('*')
                .eq('auth_user_id', selectedEmployeeId)
                .single();

            if (!profileData) {
                // Check users_public (for standalone Drivers)
                const { data: pubData } = await supabase
                    .from('users_public')
                    .select('*')
                    .eq('id', selectedEmployeeId)
                    .single();
                
                if (pubData) {
                    profileData = { ...pubData, auth_user_id: pubData.id };
                }
            }

            setViewedProfile(profileData);
            
            const activeEmpId = profileData ? profileData.employee_id : (selectedEmployeeId === (user.uid || user.id) ? user.employeeId : undefined);
            const dbUserId = profileData ? profileData.id : null;

            // C. Fetch Attendance First
            let attendanceData: any[] = [];
            if (activeEmpId) {
                const { data } = await supabase
                    .from('operator_attendance')
                    .select('id, date, clock_in, clock_out, hours_worked, machine_id, notes')
                    .eq('operator_id', activeEmpId)
                    .gte('date', firstDay)
                    .lte('date', lastDayStr);
                attendanceData = data || [];
            }
            setAttendanceShifts(attendanceData);
            setPlannedMachines([]);

            // B. Fetch Production Logs based on Time-matching & Explicit ID
            let prodData: any[] = [];
            if (activeEmpId || selectedEmployeeId) {
                const machinesTouched = Array.from(new Set(attendanceData.map(a => a.machine_id).filter(Boolean)));
                let rawLogs: any[] = [];
                
                if (machinesTouched.length > 0) {
                    let allRawLogs: any[] = [];
                    let hasMore = true;
                    let offset = 0;
                    
                    while (hasMore) {
                        const { data } = await supabase
                            .from('production_logs_v2')
                            .select('log_id, created_at, output_qty, reject_qty, machine_id, job_id, operator_id')
                            .in('machine_id', machinesTouched)
                            .gte('created_at', startDateTs)
                            .lte('created_at', endDateTs)
                            .range(offset, offset + 999);
                            
                        if (data && data.length > 0) {
                            allRawLogs.push(...data);
                            offset += 1000;
                            if (data.length < 1000) hasMore = false;
                        } else {
                            hasMore = false;
                        }
                    }
                    rawLogs = allRawLogs;
                }
                
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                const validIds = [selectedEmployeeId, dbUserId, activeEmpId].filter(id => id && uuidRegex.test(id));
                let explicitLogs: any[] = [];
                if (validIds.length > 0) {
                    const orStr = validIds.map(id => `operator_id.eq.${id}`).join(',');
                    let hasMoreExplicit = true;
                    let offsetExplicit = 0;
                    
                    while (hasMoreExplicit) {
                        const { data } = await supabase
                            .from('production_logs_v2')
                            .select('log_id, created_at, output_qty, reject_qty, machine_id, job_id, operator_id')
                            .or(orStr)
                            .gte('created_at', startDateTs)
                            .lte('created_at', endDateTs)
                            .range(offsetExplicit, offsetExplicit + 999);
                            
                        if (data && data.length > 0) {
                            explicitLogs.push(...data);
                            offsetExplicit += 1000;
                            if (data.length < 1000) hasMoreExplicit = false;
                        } else {
                            hasMoreExplicit = false;
                        }
                    }
                }
                    
                const allLogs = [...rawLogs, ...explicitLogs];
                
                const logMap = new Map();
                allLogs.forEach(log => {
                    const uniqueId = log.log_id || (log.created_at + log.machine_id);
                    if (logMap.has(uniqueId)) return;
                    
                    // 1. If the log explicitly belongs to the viewed operator, keep it
                    if (log.operator_id === selectedEmployeeId || log.operator_id === dbUserId || log.operator_id === activeEmpId) {
                        logMap.set(uniqueId, log);
                        return;
                    }
                    
                    // 2. If the log explicitly belongs to someone else, do NOT count it for this operator
                    if (log.operator_id && log.operator_id.trim() !== '') {
                        return;
                    }
                    
                    // 3. Fallback: If operator_id is null/blank, match by shift time
                    const logTime = new Date(log.created_at).getTime();
                    const belongsToMe = attendanceData.some(shift => {
                        if (shift.machine_id !== log.machine_id) return false;
                        const inTime = new Date(shift.clock_in).getTime();
                        const outTime = shift.clock_out 
                            ? Math.min(new Date(shift.clock_out).getTime(), inTime + (14 * 3600000))
                            : inTime + (14 * 3600000);
                        return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                    });
                    
                    if (belongsToMe) {
                        logMap.set(uniqueId, log);
                    }
                });
                
                prodData = Array.from(logMap.values());
            }
            setProductionLogs(prodData);

            // D. Photos
            if (activeEmpId) {
                const { data: photoData } = await supabase
                    .from('work_photos')
                    .select('created_at, category, risk_flag, photo_url')
                    .eq('employee_id', activeEmpId)
                    .gte('created_at', startDateTs)
                    .lte('created_at', endDateTs);
                setPhotoLogs(photoData || []);
            } else {
                setPhotoLogs([]);
            }

            // E. Leaves
            const { data: leaveData } = await supabase
                .from('employee_leave')
                .select('start_date, end_date, status, reason')
                .eq('employee_id', selectedEmployeeId)
                .eq('status', 'Approved')
                .lte('start_date', lastDayStr) 
                .gte('end_date', firstDay);   
            setLeaves(leaveData || []);

            // F. Payroll
            if (activeEmpId) {
                const { data: payrollData } = await supabase
                    .from('payroll_records')
                    .select('*')
                    .eq('employee_id', activeEmpId)
                    .eq('month', selectedMonth)
                    .eq('year', selectedYear)
                    .maybeSingle();
                setPayroll(payrollData || null);
            } else {
                setPayroll(null);
            }

            // G. Deliveries (For Drivers)
            if (profileData?.role === 'Driver' || (!profileData && user.role === 'Driver')) {
                const { data: dr } = await supabase.from('delivery_rates').select('*');
                setDeliveryRates(dr || []);

                const { data: rawDeliveryData } = await supabase
                    .from('sales_orders')
                    .select('id, order_number, customer, items, notes, order_date, pod_timestamp, deadline, zone, delivery_address, created_at, trip_origin, trip_drop_count, pod_photo_url, pod_signature_url, proof_of_load_url, driver_id')
                    .eq('driver_id', selectedEmployeeId) 
                    .eq('status', 'Delivered');

                const monthlyDeliveries = (rawDeliveryData || []).filter(d => {
                    const rawDate = d.deadline || (d.pod_timestamp ? d.pod_timestamp.split('T')[0] : (d.created_at ? d.created_at.split('T')[0] : null));
                    if (!rawDate) return false;
                    return rawDate >= firstDay && rawDate <= lastDayStr;
                });
                setDeliveries(monthlyDeliveries);

                // Fetch tied lorry for driver / Dapatkan lorry yang terikat untuk pemandu
                const { data: lorryData } = await supabase
                    .from('lorries')
                    .select('plate_number')
                    .eq('driver_id', selectedEmployeeId)
                    .maybeSingle();
                setDriverLorryPlate(lorryData?.plate_number || 'N/A');
            } else {
                setDeliveries([]);
                setDeliveryRates([]);
                setDriverLorryPlate('N/A');
            }

        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAttendance = async () => {
        if (!viewedProfile?.employee_id) {
            alert("Sila pilih pekerja yang sah. / Please select a valid employee.");
            return;
        }
        
        const dateStr = selectedAttendanceDay.dateStr;
        const shift = attendanceShifts.find(s => s.date === dateStr);
        
        let hoursWorked = 0;
        if (editClockIn && editClockOut) {
            const inTime = new Date(editClockIn).getTime();
            const outTime = new Date(editClockOut).getTime();
            if (outTime < inTime) {
                alert("Masa keluar tidak boleh sebelum masa masuk. / Clock out cannot be before clock in.");
                return;
            }
            hoursWorked = Math.round(((outTime - inTime) / 3600000) * 100) / 100;
        }
        
        const clockInIso = editClockIn ? new Date(editClockIn).toISOString() : null;
        const clockOutIso = editClockOut ? new Date(editClockOut).toISOString() : null;
        
        try {
            if (shift) {
                const { error } = await supabase
                    .from('operator_attendance')
                    .update({
                        clock_in: clockInIso,
                        clock_out: clockOutIso,
                        hours_worked: hoursWorked,
                        notes: editAttendanceNotes || null
                    })
                    .eq('id', shift.id);
                    
                if (error) throw error;
                alert("✅ Rekod kehadiran berjaya dikemas kini! / Attendance record updated successfully!");
            } else {
                const { error } = await supabase
                    .from('operator_attendance')
                    .insert({
                        operator_id: viewedProfile.employee_id,
                        date: dateStr,
                        clock_in: clockInIso,
                        clock_out: clockOutIso,
                        hours_worked: hoursWorked,
                        notes: editAttendanceNotes || null
                    });
                    
                if (error) throw error;
                alert("✅ Rekod kehadiran berjaya ditambah! / Attendance record added successfully!");
            }
            
            setSelectedAttendanceDay(null);
            fetchData();
        } catch (err: any) {
            console.error("Failed to save attendance:", err);
            alert("Ralat menyimpan rekod: / Error saving record: " + err.message);
        }
    };

    const handleDeleteAttendance = async () => {
        if (!selectedAttendanceDay) return;
        const dateStr = selectedAttendanceDay.dateStr;
        const shift = attendanceShifts.find(s => s.date === dateStr);
        if (!shift) return;
        
        if (!window.confirm("Adakah anda pasti mahu memadam rekod ini? / Are you sure you want to delete this record?")) {
            return;
        }
        
        try {
            const { error } = await supabase
                .from('operator_attendance')
                .delete()
                .eq('id', shift.id);
                
            if (error) throw error;
            alert("✅ Rekod kehadiran berjaya dipadam! / Attendance record deleted successfully!");
            setSelectedAttendanceDay(null);
            fetchData();
        } catch (err: any) {
            console.error("Failed to delete attendance:", err);
            alert("Ralat memadam rekod: / Error deleting record: " + err.message);
        }
    };

    const handleSaveTrip = async () => {
        if (!selectedTrip) return;
        
        try {
            const { error } = await supabase
                .from('sales_orders')
                .update({
                    driver_id: editDriverId || null,
                    trip_origin: editOrigin.toUpperCase(),
                    zone: editZone,
                    trip_drop_count: Math.max(1, Number(editDropCount) || 1),
                    notes: editNotes || null
                })
                .eq('id', selectedTrip.id);
                
            if (error) throw error;
            alert("✅ Rekod trip berjaya dikemas kini! / Trip record updated successfully!");
            setSelectedTrip(null);
            setIsEditingTrip(false);
            fetchData();
        } catch (err: any) {
            console.error("Failed to save trip details:", err);
            alert("Ralat menyimpan trip: / Error saving trip: " + err.message);
        }
    };

    const handleDownloadExcel = () => {
        // Collect all tripDetails from dailyMetrics
        const allTrips: any[] = [];
        dailyMetrics.forEach(day => {
            if (day.tripDetails && day.tripDetails.length > 0) {
                day.tripDetails.forEach(trip => {
                    allTrips.push({
                        date: day.dateStr,
                        plateNumber: driverLorryPlate,
                        origin: trip.trip_origin || 'TAIPING',
                        destinations: trip.delivery_address || 'Unknown',
                        tripCategory: trip.zone || 'Unknown',
                        totalDrops: trip.trip_drop_count || 1,
                        price: trip.earnings || 0
                    });
                });
            }
        });

        if (allTrips.length === 0) {
            alert("Tiada data perjalanan untuk dieksport. / No trip data to export.");
            return;
        }

        // Format data for sheet
        const excelRows = allTrips.map(t => ({
            'Tarikh / Date': t.date,
            'No. Pendaftaran Lorry / Lorry Plate Number': t.plateNumber,
            'Tempat Asal / Origin': t.origin,
            'Destinasi / Destinations': t.destinations,
            'Kategori Trip / Trip Category': t.tripCategory,
            'Jumlah Drops / Total Drops': t.totalDrops,
            'Harga / Price (RM)': t.price
        }));

        const ws = XLSX.utils.json_to_sheet(excelRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Trip Logs');

        // Set column widths for better layout
        ws['!cols'] = [
            { wch: 15 }, // Date
            { wch: 25 }, // Lorry Plate Number
            { wch: 20 }, // Origin
            { wch: 35 }, // Destinations
            { wch: 20 }, // Trip Category
            { wch: 15 }, // Total Drops
            { wch: 15 }  // Price
        ];

        const driverName = viewedProfile?.name || user?.name || 'Driver';
        const fileName = `Laporan_Trip_Pemandu_${driverName.replace(/\s+/g, '_')}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const handlePrintSingleDriver = () => {
        const allTrips: any[] = [];
        dailyMetrics.forEach(day => {
            if (day.tripDetails && day.tripDetails.length > 0) {
                day.tripDetails.forEach(trip => {
                    allTrips.push({
                        date: day.dateStr,
                        orderNumber: trip.order_number || 'N/A',
                        customer: trip.customer || 'N/A',
                        origin: trip.trip_origin || 'TAIPING',
                        destination: trip.zone || trip.delivery_address || 'Unknown',
                        drops: trip.trip_drop_count || 1,
                        earnings: trip.earnings || 0
                    });
                });
            }
        });

        allTrips.sort((a, b) => a.date.localeCompare(b.date));
        const totalEarnings = allTrips.reduce((sum, t) => sum + (t.earnings || 0), 0);

        const singleReport = {
            driverName: viewedProfile?.name || user?.name || 'Driver',
            employeeId: viewedProfile?.employee_id || user?.employeeId || 'N/A',
            baseLocation: viewedProfile?.base_location || 'Taiping',
            plateNumber: driverLorryPlate || 'N/A',
            totalTrips: allTrips.length,
            totalEarnings,
            tripRows: allTrips
        };

        setBatchPrintData([singleReport]);
        setTimeout(() => {
            window.print();
        }, 400);
    };

    const handlePrintAllDrivers = async () => {
        setIsPreparingBatchPrint(true);
        try {
            const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDayObj = new Date(selectedYear, selectedMonth, 0);
            const lastDayStr = `${lastDayObj.getFullYear()}-${String(lastDayObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

            // Fetch drivers from both tables
            const [v2Res, pubRes] = await Promise.all([
                supabase.from('sys_users_v2').select('auth_user_id, name, employee_id, role, base_location').eq('role', 'Driver').in('status', ['Active', 'active']),
                supabase.from('users_public').select('id, name, employee_id, role, base_location').eq('role', 'Driver').in('status', ['Active', 'active'])
            ]);

            let mergedDrivers: any[] = [];
            if (v2Res.data) {
                mergedDrivers = [...v2Res.data.filter(e => e.auth_user_id).map(e => ({ ...e, uid: e.auth_user_id }))];
            }
            if (pubRes.data) {
                pubRes.data.forEach(p => {
                    if (!mergedDrivers.find(m => m.uid === p.id)) {
                        mergedDrivers.push({ ...p, uid: p.id, auth_user_id: p.id });
                    }
                });
            }

            let driversList = mergedDrivers;

            if (driversList.length === 0) {
                alert("Tiada pemandu dijumpai untuk dicetak. / No drivers found to print.");
                setIsPreparingBatchPrint(false);
                return;
            }

            const { data: dr } = await supabase.from('delivery_rates').select('*');
            const rates = dr || [];
            const rateMap: Record<string, any> = {};
            rates.forEach(r => { rateMap[`${r.origin}-${r.location_name}`.toLowerCase()] = r; });

            const { data: lorryData } = await supabase.from('lorries').select('driver_id, plate_number');
            const lorryMap: Record<string, string> = {};
            (lorryData || []).forEach(l => {
                if (l.driver_id) lorryMap[l.driver_id] = l.plate_number;
            });

            const driverIds = driversList.map(d => d.uid || d.auth_user_id || d.id).filter(Boolean);
            const { data: rawDeliveryData } = await supabase
                .from('sales_orders')
                .select('id, order_number, customer, items, notes, order_date, pod_timestamp, deadline, zone, delivery_address, created_at, trip_origin, trip_drop_count, driver_id')
                .in('driver_id', driverIds)
                .eq('status', 'Delivered');

            const allDeliveries = (rawDeliveryData || []).filter(order => {
                const rawDate = order.deadline || (order.pod_timestamp ? order.pod_timestamp.split('T')[0] : (order.created_at ? order.created_at.split('T')[0] : null));
                if (!rawDate) return false;
                return rawDate >= firstDay && rawDate <= lastDayStr;
            });

            const batchReports = driversList.map(driver => {
                const driverUid = driver.uid || driver.auth_user_id || driver.id;
                const driverDeliveries = allDeliveries.filter(d => d.driver_id === driverUid);
                const plate = lorryMap[driverUid] || 'N/A';

                let totalEarnings = 0;
                const tripRows: any[] = [];

                driverDeliveries.forEach(t => {
                    const originRaw = t.trip_origin || 'TAIPING';
                    const origin = originRaw.toLowerCase();
                    const zoneRaw = t.zone || t.delivery_address || 'Unknown';
                    let calcZone = zoneRaw.toLowerCase();
                    const key = `${origin}-${calcZone}`;
                    const rateInfo = rateMap[key];
                    const drops = Math.max(1, t.trip_drop_count || 1);

                    let tEarnings = 0;
                    if (rateInfo) {
                        const base = Number(rateInfo.base_rate) || 0;
                        const maxPlaces = Number(rateInfo.max_places) || 0;
                        const extraPlaces = Math.max(0, drops - maxPlaces);
                        const extraRate = extraPlaces * (Number(rateInfo.extra_rate_per_place) || 0);
                        tEarnings = base + extraRate;
                    }

                    totalEarnings += tEarnings;

                    const dateStr = t.deadline || (t.pod_timestamp ? t.pod_timestamp.split('T')[0] : t.created_at.split('T')[0]);

                    tripRows.push({
                        date: dateStr,
                        orderNumber: t.order_number || 'N/A',
                        customer: t.customer || 'N/A',
                        origin: originRaw,
                        destination: zoneRaw,
                        drops,
                        earnings: tEarnings
                    });
                });

                tripRows.sort((a, b) => a.date.localeCompare(b.date));

                return {
                    driverName: driver.name || driver.employee_id || 'Pemandu',
                    employeeId: driver.employee_id || 'N/A',
                    baseLocation: driver.base_location || 'Taiping',
                    plateNumber: plate,
                    totalTrips: tripRows.length,
                    totalEarnings,
                    tripRows
                };
            });

            setBatchPrintData(batchReports);

            setTimeout(() => {
                window.print();
                setIsPreparingBatchPrint(false);
            }, 500);

        } catch (err: any) {
            console.error("Batch print error:", err);
            alert("Ralat menyediakan laporan cetakan: " + err.message);
            setIsPreparingBatchPrint(false);
        }
    };

    const changeMonth = (offset: number) => {
        let m = selectedMonth + offset;
        let y = selectedYear;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        setSelectedMonth(m);
        setSelectedYear(y);
    };

    // Calculate Daily Matrix
    const dailyMetrics = useMemo(() => {
        const matrix: DailyMetrics[] = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dateObj = new Date(selectedYear, selectedMonth - 1, i);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isSunday = dateObj.getDay() === 0;

            const matchDate = (utcIsoString: string | null | undefined, targetDateStr: string) => {
                if (!utcIsoString) return false;
                // Convert UTC timestamp to local Date object, then format as YYYY-MM-DD
                const d = new Date(utcIsoString);
                const localY = d.getFullYear();
                const localM = String(d.getMonth() + 1).padStart(2, '0');
                const localD = String(d.getDate()).padStart(2, '0');
                return `${localY}-${localM}-${localD}` === targetDateStr;
            };

            const dayDeliveries = deliveries.filter(d => {
                const ts = d.deadline || d.created_at;
                if (!ts) return false;
                if (d.deadline) return ts.startsWith(dateStr); // deadline is usually purely 'YYYY-MM-DD'
                return matchDate(ts, dateStr);
            });

            // Prod
            const dayProd = productionLogs.filter(p => {
                const logTime = new Date(p.created_at).getTime();
                
                // Find shifts on this specific day (dateStr)
                const shiftsOnThisDay = attendanceShifts.filter(s => s.date === dateStr);
                
                if (shiftsOnThisDay.length > 0) {
                    // If there are shifts on this day, the log MUST fall within at least one of these shifts (with 5 min buffer)
                    return shiftsOnThisDay.some(shift => {
                        if (p.machine_id && shift.machine_id && p.machine_id !== shift.machine_id) return false;
                        const inTime = new Date(shift.clock_in).getTime();
                        const outTime = shift.clock_out 
                            ? Math.min(new Date(shift.clock_out).getTime(), inTime + (14 * 3600000))
                            : inTime + (14 * 3600000);
                        return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                    });
                }
                
                // If there are no shifts on this day, check if this log belongs to a known shift on ANOTHER day
                const matchingShiftOnOtherDay = attendanceShifts.find(shift => {
                    if (p.machine_id && shift.machine_id && p.machine_id !== shift.machine_id) return false;
                    const inTime = new Date(shift.clock_in).getTime();
                    const outTime = shift.clock_out 
                        ? Math.min(new Date(shift.clock_out).getTime(), inTime + (14 * 3600000))
                        : inTime + (14 * 3600000);
                    return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
                });

                if (matchingShiftOnOtherDay) {
                    return false;
                }
                
                // Otherwise, fallback to matching the creation date
                return matchDate(p.created_at, dateStr);
            });
            const outputQty = dayProd.reduce((sum, p) => sum + (Number(p.output_qty) || 0), 0);
            const alarmCount = dayProd.reduce((sum, p) => sum + (Number(p.alarm_count) || Number(p.reject_qty) || 0), 0);

            // Photos
            const dayPhotos = [...photoLogs.filter(p => matchDate(p.created_at, dateStr))];
            if (isDriver) {
                dayDeliveries.forEach(d => {
                    if (d.proof_of_load_url) {
                        dayPhotos.push({
                            created_at: d.pod_timestamp || d.created_at || `${dateStr}T12:00:00.000Z`,
                            category: 'Proof of Load / Muatan',
                            photo_url: d.proof_of_load_url,
                            risk_flag: false
                        });
                    }
                    if (d.pod_photo_url) {
                        d.pod_photo_url.split(',').forEach((url: string, index: number) => {
                            const trimmed = url.trim();
                            if (trimmed) {
                                dayPhotos.push({
                                    created_at: d.pod_timestamp || d.created_at || `${dateStr}T12:00:00.000Z`,
                                    category: `Proof of Delivery / POD (${index + 1})`,
                                    photo_url: trimmed,
                                    risk_flag: false
                                });
                            }
                        });
                    }
                    if (d.pod_signature_url) {
                        dayPhotos.push({
                            created_at: d.pod_timestamp || d.created_at || `${dateStr}T12:00:00.000Z`,
                            category: 'Tandatangan / Signature',
                            photo_url: d.pod_signature_url,
                            risk_flag: false
                        });
                    }
                });
            }

            // Shift
            const dayShift = attendanceShifts.find(s => s.date === dateStr);
            const dayPlans = plannedMachines.filter(s => s.shift_date === dateStr);

            const machinesOperated = Array.from(new Set([
                ...dayPlans.map(p => p.machine_id),
                ...dayProd.map(p => {
                    if (p.machine_id && p.machine_id.trim() !== '') return p.machine_id;
                    if (p.job_id && String(p.job_id).startsWith('JOB-')) return String(p.job_id).split('-')[1];
                    return null;
                })
            ].filter(Boolean)));

            // Leave
            const dayLeave = leaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);

            const tripCount = dayDeliveries.length;
            const tripDetails: any[] = [];

            let tripEarnings = 0;
            const rateMap: Record<string, any> = {};
            deliveryRates.forEach(r => { rateMap[`${r.origin}-${r.location_name}`.toLowerCase()] = r; });

            dayDeliveries.forEach(t => {
                const originRaw = t.trip_origin || 'TAIPING';
                const origin = originRaw.toLowerCase();
                const zoneRaw = t.zone || t.delivery_address || 'Unknown';
                let calcZone = zoneRaw.toLowerCase();
                let displayZone = zoneRaw;

                const key = `${origin}-${calcZone}`;
                const rateInfo = rateMap[key];
                const drops = Math.max(1, t.trip_drop_count || 1);

                let tEarnings = 0;
                if (rateInfo) {
                    const base = Number(rateInfo.base_rate) || 0;
                    const maxPlaces = Number(rateInfo.max_places) || 0;
                    const extraPlaces = Math.max(0, drops - maxPlaces);
                    const extraRate = extraPlaces * (Number(rateInfo.extra_rate_per_place) || 0);
                    tEarnings = base + extraRate;
                    tripEarnings += tEarnings;
                }

                // Push formatting: "TAIPING ➞ KL (2 Drops)"
                tripDetails.push({
                    id: t.id,
                    order_number: t.order_number,
                    customer: t.customer,
                    items: t.items,
                    notes: t.notes,
                    pod_photo_url: t.pod_photo_url || null,
                    pod_signature_url: t.pod_signature_url || null,
                    proof_of_load_url: t.proof_of_load_url || null,
                    driver_id: t.driver_id || null,
                    trip_origin: t.trip_origin || null,
                    zone: t.zone || null,
                    trip_drop_count: t.trip_drop_count || 1,
                    delivery_address: t.delivery_address || null,
                    earnings: tEarnings,
                    displayString: `${originRaw} ➞ ${displayZone} (${drops} Drop${drops > 1 ? 's' : ''})`
                });
            });

            matrix.push({
                dateStr,
                dayNum: i,
                isWeekend,
                isSunday,
                hasAttendance: !!dayShift,
                shiftStart: (dayShift && dayShift.clock_in) ? new Date(dayShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                shiftEnd: (dayShift && dayShift.clock_out) ? new Date(dayShift.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                notes: dayShift?.notes || null,
                outputQty,
                alarmCount,
                tripCount,
                tripEarnings,
                tripDetails,
                photoCount: dayPhotos.length,
                photos: dayPhotos,
                leaveStatus: dayLeave ? dayLeave.status : null,
                machinesOperated
            });
        }
        return matrix;
    }, [productionLogs, attendanceShifts, photoLogs, leaves, plannedMachines, deliveries, deliveryRates, daysInMonth, selectedYear, selectedMonth, isDriver]);

    // Summary Aggregates
    const totalOutput = dailyMetrics.reduce((sum, d) => sum + d.outputQty, 0);
    const totalAlarms = dailyMetrics.reduce((sum, d) => sum + d.alarmCount, 0);
    const totalTrips = dailyMetrics.reduce((sum, d) => sum + d.tripCount, 0);
    const presentDays = dailyMetrics.filter(d => d.hasAttendance).length;
    const leaveDays = dailyMetrics.filter(d => d.leaveStatus).length;
    const totalPhotos = dailyMetrics.reduce((sum, d) => sum + d.photoCount, 0);

    const canSelectEmployee = employeesList.length > 0;
    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-6 font-sans pmr-no-print">
            {/* Header Area / Kawasan Kepala Halaman */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-1 flex items-center gap-3">
                        <Activity className="text-blue-500 animate-pulse" size={28} />
                        Laporan Bulanan / Monthly Report
                    </h1>
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-500">
                            Analisis untuk: / Analytics for:
                        </p>
                        {canSelectEmployee ? (
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Users size={14} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
                                </div>
                                <select 
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    className="pl-9 pr-8 py-1.5 bg-[#0d0d12]/90 border border-white/10 hover:border-blue-500/50 rounded-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer transition-all backdrop-blur-md"
                                >
                                    {employeesList.map(emp => {
                                        const rowKey = emp.uid || emp.auth_user_id || emp.id;
                                        return (
                                            <option key={rowKey} value={rowKey}>
                                                {emp.name || emp.employee_id} ({emp.role === 'Driver' ? 'Pemandu / Driver' : emp.role})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        ) : (
                            <span className="text-sm font-bold text-gray-300 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                                {viewedProfile?.name || user?.name} ({viewedProfile?.role === 'Driver' ? 'Pemandu / Driver' : (viewedProfile?.role || user?.role)})
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {isDriver && (
                        <button
                            onClick={handleDownloadExcel}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-600 text-white border border-emerald-500/30 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-950/20 active:scale-95 cursor-pointer"
                        >
                            <FileSpreadsheet size={16} className="text-emerald-400" />
                            <span>Excel</span>
                        </button>
                    )}

                    {(isDriver || viewedProfile?.role === 'Driver') && (
                        <button
                            onClick={handlePrintSingleDriver}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-500/80 to-indigo-600/80 hover:from-blue-500 hover:to-indigo-600 text-white border border-blue-500/30 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-950/20 active:scale-95 cursor-pointer"
                            title="Cetak Laporan Pemandu Ini / Print Current Driver Report"
                        >
                            <Printer size={16} className="text-blue-300" />
                            <span>Cetak Driver</span>
                        </button>
                    )}

                    {(isAdminOrHR || canSelectEmployee) && (
                        <button
                            onClick={handlePrintAllDrivers}
                            disabled={isPreparingBatchPrint}
                            className="flex items-center gap-2 bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 text-white border border-purple-500/30 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-purple-950/20 active:scale-95 cursor-pointer disabled:opacity-50"
                            title="Cetak Laporan Semua Pemandu / Print All Drivers Reports"
                        >
                            <Printer size={16} className="text-purple-300" />
                            <span>{isPreparingBatchPrint ? 'Menyedia...' : 'Cetak Semua Driver (Batch)'}</span>
                        </button>
                    )}

                    <div className="flex items-center gap-3 bg-[#0d0d12]/80 border border-white/10 rounded-2xl px-5 py-3 shadow-lg backdrop-blur-md">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="text-center min-w-[140px]">
                            <div className="text-xl font-black text-white">
                                {(() => {
                                    const msNames: Record<string, string> = {
                                        'January': 'Januari / January', 'February': 'Februari / February', 'March': 'Mac / March',
                                        'April': 'April / April', 'May': 'Mei / May', 'June': 'Jun / June', 'July': 'Julai / July',
                                        'August': 'Ogos / August', 'September': 'September / September', 'October': 'Oktober / October',
                                        'November': 'November / November', 'December': 'Disember / December'
                                    };
                                    return msNames[MONTH_NAMES[selectedMonth - 1]] || MONTH_NAMES[selectedMonth - 1];
                                })()}
                            </div>
                            <div className="text-xs text-blue-400 tracking-widest uppercase font-bold">{selectedYear}</div>
                        </div>
                        <button onClick={() => changeMonth(1)} disabled={selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()}
                            className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer active:scale-95">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-r-2 border-indigo-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}></div>
                    </div>
                    <p className="text-blue-400 font-bold tracking-widest uppercase text-sm animate-pulse">Sila tunggu, sedang dikira... / Calculating Metrics...</p>
                </div>
            ) : (
                <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* Performance Badges Row / Barisan Lencana Prestasi */}
                    {(() => {
                        const badges = [];
                        const totalWorkingDays = dailyMetrics.filter(d => !d.isSunday).length;
                        const attendRate = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0;
                        
                        if (attendRate >= 90) {
                            badges.push({
                                icon: <CalendarDays size={14} className="text-emerald-400" />,
                                text: "Juara Kehadiran / Attendance Champion",
                                desc: "Hadir >= 90% hari bekerja (Isnin-Sabtu) / Attended >= 90% of working days (Mon-Sat)",
                                color: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                            });
                        }
                        if (isDriver && totalTrips >= 15) {
                            badges.push({
                                icon: <Truck size={14} className="text-amber-400" />,
                                text: "Pemandu Emas / Gold Driver",
                                desc: "Melakukan >= 15 trip penghantaran bulan ini / Made >= 15 trips this month",
                                color: "bg-amber-500/10 border-amber-500/25 text-amber-400"
                            });
                        } else if (!isDriver && totalOutput >= 5000) {
                            badges.push({
                                icon: <Award size={14} className="text-blue-400" />,
                                text: "Pengendali Bintang / Star Operator",
                                desc: "Jumlah output >= 5,000 unit bulan ini / Total output >= 5,000 units this month",
                                color: "bg-blue-500/10 border-blue-500/25 text-blue-400"
                            });
                        }
                        if (totalPhotos >= 15) {
                            badges.push({
                                icon: <Camera size={14} className="text-purple-400" />,
                                text: "Pemberita Visual / Visual Reporter",
                                desc: "Memuat naik >= 15 gambar rekod kerja / Uploaded >= 15 work photos",
                                color: "bg-purple-500/10 border-purple-500/25 text-purple-400"
                            });
                        }
                        if (totalAlarms === 0 && presentDays >= 5) {
                            badges.push({
                                icon: <AlertTriangle size={14} className="text-teal-400" />,
                                text: "Bebas Ralat / Error-Free Pro",
                                desc: "Tiada sebarang ralat atau amaran dikesan / Zero alarms or rejects handled",
                                color: "bg-teal-500/10 border-teal-500/25 text-teal-400"
                            });
                        }

                        if (badges.length === 0) return null;

                        return (
                            <div className="flex flex-wrap gap-2.5 bg-[#0d0d12]/50 border border-white/5 p-3 rounded-2xl">
                                {badges.map((b, idx) => (
                                    <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold shadow-sm cursor-help relative group transition-all hover:scale-105 hover:bg-white/5 ${b.color}`} title={b.desc}>
                                        {b.icon}
                                        <span>{b.text}</span>
                                        {/* Floating Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-[#09090b] border border-slate-800 p-2.5 rounded-xl text-[10px] text-gray-400 font-normal leading-normal opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-2xl z-20">
                                            {b.desc}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {/* Top Row: Metrics Overview / Ringkasan Metrik */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Attendance Card */}
                        <div className="bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-1">Kehadiran / Attendance</p>
                                    <h3 className="text-3xl font-black text-white">{presentDays} <span className="text-xs font-normal text-gray-500">hari / days</span></h3>
                                    <p className="text-[10px] text-gray-400 mt-2">{leaveDays} Cuti diluluskan / Approved leaves</p>
                                </div>
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                                    <CalendarDays size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Production / Deliveries Card */}
                        <div className={`bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300 ${isDriver ? 'hover:border-amber-500/30' : 'hover:border-blue-500/30'}`}>
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all ${isDriver ? 'bg-amber-500/10 group-hover:bg-amber-500/20' : 'bg-blue-500/10 group-hover:bg-blue-500/20'}`}></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${isDriver ? 'text-amber-400' : 'text-blue-400'}`}>
                                        {isDriver ? 'Penghantaran / Deliveries' : 'Jumlah Output / Total Output'}
                                    </p>
                                    <h3 className="text-3xl font-black text-white">{isDriver ? totalTrips : totalOutput.toLocaleString()}</h3>
                                    <p className="text-[10px] text-gray-400 mt-2">{isDriver ? 'Selesai / Completed trips' : 'Unit dikesan / Units produced'}</p>
                                </div>
                                <div className={`p-3 rounded-2xl border ${isDriver ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    {isDriver ? <Truck size={20} /> : <Award size={20} />}
                                </div>
                            </div>
                        </div>

                        {/* Alarms / Zones Card */}
                        <div className={`bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300 ${isDriver ? 'hover:border-cyan-500/30' : 'hover:border-red-500/30'}`}>
                            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all ${isDriver ? 'bg-cyan-500/10 group-hover:bg-cyan-500/20' : 'bg-red-500/10 group-hover:bg-red-500/20'}`}></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${isDriver ? 'text-cyan-400' : 'text-red-400'}`}>
                                        {isDriver ? 'Destinasi / Zones' : 'Anomali / Anomalies'}
                                    </p>
                                    <h3 className="text-3xl font-black text-white">
                                        {isDriver ? Array.from(new Set(deliveries.map(d => d.zone).filter(Boolean))).length : totalAlarms}
                                    </h3>
                                    <p className="text-[10px] text-gray-400 mt-2">{isDriver ? 'Zon dihantar / Regions covered' : 'Ralat & amaran / Alarms & rejects'}</p>
                                </div>
                                <div className={`p-3 rounded-2xl border ${isDriver ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                    {isDriver ? <Truck size={20} /> : <AlertTriangle size={20} />}
                                </div>
                            </div>
                        </div>

                        {/* Photo Logs Card */}
                        <div className="bg-gradient-to-br from-[#0d0d12] to-black border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] text-violet-400 uppercase tracking-widest font-black mb-1">Rekod Bergambar / Photo Logs</p>
                                    <h3 className="text-3xl font-black text-white">{totalPhotos} <span className="text-xs font-normal text-gray-500">fail / logs</span></h3>
                                    <p className="text-[10px] text-gray-400 mt-2">Gambar tugasan / Visual job proofs</p>
                                </div>
                                <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-400 border border-violet-500/20">
                                    <Camera size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Payroll Estimate Card */}
                        <div className="bg-gradient-to-br from-green-950/30 to-black border border-green-500/20 rounded-3xl p-5 shadow-2xl relative overflow-hidden group hover:border-green-500/40 transition-all duration-300">
                            <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] text-green-400 uppercase tracking-widest font-black mb-1">Gaji Diproses / Processed Wallet</p>
                                    {payroll ? (
                                        <>
                                            <h3 className="text-2xl font-black text-green-300">RM {Number(payroll.net_salary).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</h3>
                                            <p className="text-[9px] text-green-500/80 mt-2 uppercase font-bold tracking-wider">Telah Disahkan HR / Confirmed by HR</p>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-lg font-black text-gray-400 italic mt-2">Belum Dikira / Pending</h3>
                                            <p className="text-[9px] text-gray-500 mt-2 uppercase">Menunggu akhir bulan / Subject to HR review</p>
                                        </>
                                    )}
                                </div>
                                <div className="p-3 bg-green-500/10 rounded-2xl text-green-400 border border-green-500/30">
                                    <DollarSign size={20} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Chart & Calendar Grid / Graf Trend & Grid Bulanan */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Interactive Trend Chart Card (SVG) */}
                        <div className="lg:col-span-2 bg-[#0d0d12]/80 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/20">
                                        <Activity size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-white">
                                            {isDriver ? 'Analisis Pendapatan Harian / Daily Trip Earnings Trend' : 'Carta Output Harian / Daily Output Trend'}
                                        </h2>
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mt-0.5">
                                            {isDriver ? 'Carta Pendapatan Trip / Trip Earnings Chart' : 'Carta Output Kerja / Work Output Chart'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* SVG Render */}
                            <div className="w-full flex-1 min-h-[180px] flex items-center">
                                {(() => {
                                    const chartData = dailyMetrics.map(d => ({
                                        day: d.dayNum,
                                        val: isDriver ? d.tripEarnings : d.outputQty
                                    }));
                                    const maxChartVal = Math.max(...chartData.map(c => c.val), 10);

                                    return (
                                        <div className="w-full overflow-hidden">
                                            <svg viewBox="0 0 800 200" className="w-full overflow-visible">
                                                <defs>
                                                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={isDriver ? '#f59e0b' : '#3b82f6'} stopOpacity="0.25"/>
                                                        <stop offset="100%" stopColor={isDriver ? '#f59e0b' : '#3b82f6'} stopOpacity="0.00"/>
                                                    </linearGradient>
                                                </defs>

                                                {/* Gridlines */}
                                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                                    const y = 20 + ratio * 140;
                                                    const labelVal = maxChartVal - ratio * maxChartVal;
                                                    return (
                                                        <g key={i} className="opacity-20">
                                                            <line x1="55" y1={y} x2="770" y2={y} stroke="#fff" strokeDasharray="4 4" strokeWidth="0.5" />
                                                            <text x="10" y={y + 4} fill="#fff" className="text-[9px] font-mono font-bold">{isDriver ? 'RM' : ''}{Math.round(labelVal)}</text>
                                                        </g>
                                                    );
                                                })}

                                                {/* Path Drawing */}
                                                {(() => {
                                                    const points = chartData.map((c, idx) => {
                                                        const x = 55 + (idx / (chartData.length - 1)) * 715;
                                                        const y = 160 - (c.val / maxChartVal) * 140;
                                                        return { x, y, day: c.day, val: c.val };
                                                    });

                                                    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                                    const areaD = `${pathD} L ${points[points.length - 1].x} 160 L 55 160 Z`;

                                                    return (
                                                        <>
                                                            {/* Area Fill */}
                                                            <path d={areaD} fill="url(#chartGlow)" />

                                                            {/* Line */}
                                                            <path d={pathD} fill="none" stroke={isDriver ? '#f59e0b' : '#3b82f6'} strokeWidth="2.5" className="drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />

                                                            {/* Interactive/Visual Dots */}
                                                            {points.map((p, idx) => (
                                                                <g key={idx} className="group/dot cursor-pointer">
                                                                    <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={isDriver ? '#f59e0b' : '#3b82f6'} strokeWidth="2" className="transition-all duration-300 transform origin-center hover:scale-[2]" />
                                                                    <circle cx={p.x} cy={p.y} r="9" fill={isDriver ? '#f59e0b' : '#3b82f6'} className="opacity-0 hover:opacity-20 transition-opacity" />
                                                                    <title>{`Hari / Day ${p.day}: ${isDriver ? 'RM ' : ''}${p.val.toLocaleString()}`}</title>
                                                                </g>
                                                            ))}
                                                        </>
                                                    );
                                                })()}

                                                {/* X-axis Labels */}
                                                {chartData.map((c, idx) => {
                                                    if (idx % 3 !== 0 && idx !== chartData.length - 1) return null;
                                                    const x = 55 + (idx / (chartData.length - 1)) * 715;
                                                    return (
                                                        <text key={idx} x={x} y="185" fill="#fff" className="text-[9px] font-mono font-bold opacity-30 text-center" textAnchor="middle">
                                                            {c.day}
                                                        </text>
                                                    );
                                                })}
                                            </svg>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* GitHub-Style Attendance Grid / Grid Visual Kehadiran */}
                        <div className="bg-[#0d0d12]/80 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20">
                                    <CalendarDays size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white">Visual Kehadiran / Attendance Grid</h2>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mt-0.5">Status Harian / Daily Status</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1.5 max-w-sm mx-auto w-full">
                                {/* Weekday headers */}
                                {['Ahd/Sun', 'Isn/Mon', 'Sel/Tue', 'Rab/Wed', 'Kha/Thu', 'Jum/Fri', 'Sab/Sat'].map((d, i) => (
                                    <div key={i} className="text-[8px] font-black uppercase text-slate-500 tracking-wider text-center">{d.slice(0, 3)}</div>
                                ))}

                                {/* Blanks */}
                                {(() => {
                                    const firstDayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
                                    const firstDayIdx = new Date(firstDayStr.replace(/-/g, '/')).getDay();
                                    return Array.from({ length: firstDayIdx }).map((_, i) => (
                                        <div key={`blank-${i}`} className="aspect-square rounded-md bg-white/[0.01] border border-dashed border-white/[0.03]"></div>
                                    ));
                                })()}

                                {/* Days */}
                                {dailyMetrics.map((day) => {
                                    let colorClass = "bg-white/[0.02] border-white/5 text-gray-500";
                                    
                                    if (day.leaveStatus) {
                                        colorClass = "bg-amber-500/10 border-amber-500/35 text-amber-400 shadow-sm shadow-amber-950/20";
                                    } else if (day.hasAttendance) {
                                        if (day.notes === 'System Auto-Logout') {
                                            colorClass = "bg-rose-500/10 border-rose-500/35 text-rose-400 shadow-sm shadow-rose-950/20 border-dashed";
                                        } else {
                                            colorClass = "bg-emerald-500/10 border-emerald-500/35 text-emerald-400 shadow-sm shadow-emerald-950/20";
                                        }
                                    } else if (day.isWeekend) {
                                        colorClass = "bg-white/[0.04] border-white/10 text-slate-500";
                                    }

                                    return (
                                        <div 
                                            key={day.dateStr} 
                                            className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative group cursor-pointer transition-all hover:scale-110 hover:z-10 ${colorClass}`}
                                        >
                                            <span className="text-[10px] font-black">{day.dayNum}</span>
                                            
                                            {/* Floating Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#09090b] border border-slate-800 p-3 rounded-xl text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-2xl z-30 leading-relaxed font-sans">
                                                <div className="font-bold text-white mb-1 flex items-center justify-between border-b border-white/5 pb-1">
                                                    <span>{new Date(day.dateStr.replace(/-/g, '/')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    <span className="text-[9px] text-gray-500 uppercase tracking-widest">{new Date(day.dateStr.replace(/-/g, '/')).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                                </div>
                                                
                                                <div className="space-y-1 mt-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Status:</span>
                                                        <span className={`font-bold uppercase text-[9px] ${
                                                            day.leaveStatus ? 'text-amber-400' :
                                                            day.hasAttendance ? 'text-emerald-400' :
                                                            day.isWeekend ? 'text-slate-500' : 'text-gray-500'
                                                        }`}>
                                                            {day.leaveStatus ? `Cuti / Leave` :
                                                             day.hasAttendance ? 'Hadir / Present' :
                                                             day.isWeekend ? 'Weekend' : 'Rest'}
                                                        </span>
                                                    </div>

                                                    {day.hasAttendance && (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Masa / Time:</span>
                                                                <span className="font-mono text-white text-[9px]">{day.shiftStart} → {day.shiftEnd || 'Aktif'}</span>
                                                            </div>
                                                            {day.notes && (
                                                                <div className="text-[8px] text-rose-400 font-bold bg-rose-950/20 px-1 py-0.5 rounded mt-0.5 border border-rose-500/10">
                                                                    ⚠️ {day.notes === 'System Auto-Logout' ? 'Log Keluar Automatik' : day.notes}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}

                                                    {isDriver ? (
                                                        day.tripCount > 0 && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Trip:</span>
                                                                    <span className="font-bold text-amber-400">{day.tripCount} trip{day.tripCount > 1 ? 's' : ''}</span>
                                                                </div>
                                                                {day.tripEarnings > 0 && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Gaji Trip:</span>
                                                                        <span className="font-bold text-green-400">RM {day.tripEarnings.toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )
                                                    ) : (
                                                        day.outputQty > 0 && (
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Output:</span>
                                                                <span className="font-bold text-blue-400">{day.outputQty.toLocaleString()}</span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Daily Breakdown Table Section / Seksyen Jadual Harian */}
                    <div className="bg-[#0d0d12] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                                <Clock size={18} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white">Garis Masa Harian / Daily Timeline</h2>
                                <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mt-0.5">Perincian Rekod Kerja / Detailed Job Logs</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/40">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02]">
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-24">Tarikh / Date</th>
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500 w-32">Status / Status</th>
                                        <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-gray-500">Masa Kerja / Working Time (Scan In/Out)</th>
                                        <th className="px-5 py-4 text-right font-black text-[10px] uppercase tracking-widest text-gray-500">{isDriver ? 'Trip / Perjalanan' : 'Output / Output'}</th>
                                        <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500">{isDriver ? 'Butiran Trip / Trip Details' : 'Mesin & Ralat / Machines & Alarms'}</th>
                                        <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500">Gambar / Photos</th>
                                        {isAdminOrHR && <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-500 w-28">Tindakan / Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {dailyMetrics.map((day) => (
                                        <tr key={day.dateStr} className={`transition-colors hover:bg-white/[0.03] ${day.isWeekend ? 'bg-white/[0.01]' : ''}`}>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className={`font-black text-lg ${day.isWeekend ? 'text-gray-600' : 'text-gray-300'}`}>{day.dayNum}</span>
                                                    <span className="text-[9px] uppercase tracking-widest font-bold text-gray-600">
                                                        {new Date(day.dateStr.replace(/-/g, '/')).toLocaleDateString('ms-MY', { weekday: 'short' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {day.leaveStatus ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider animate-pulse">
                                                        Cuti / Leave ({day.leaveStatus === 'Approved' ? 'Lulus' : day.leaveStatus})
                                                    </span>
                                                ) : day.hasAttendance ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                                        Hadir / Present
                                                    </span>
                                                ) : day.isWeekend ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-white/5 border border-white/5 text-gray-500 text-[10px] font-black uppercase tracking-wider">
                                                        Weekend
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-gray-800 text-gray-500 text-[10px] font-black uppercase tracking-wider">
                                                        Tiada Log / No Log
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {day.hasAttendance ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 font-mono text-xs">
                                                            <span className="text-green-400">{day.shiftStart || '-'}</span>
                                                            <span className="text-gray-600">→</span>
                                                            <span className="text-orange-400">{day.shiftEnd || 'Aktif / Active'}</span>
                                                        </div>
                                                        {day.notes === 'System Auto-Logout' && (
                                                            <span className="text-[9px] uppercase font-bold text-red-500/80 bg-red-500/10 px-1.5 py-0.5 rounded w-fit border border-red-500/20">
                                                                Log Keluar Automatik / Auto-Logout
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-700 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                {isDriver ? (
                                                    day.tripCount > 0 ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-mono text-amber-400 font-bold">{day.tripCount} <span className="text-[10px] text-gray-500">trip</span></span>
                                                            {day.tripEarnings > 0 && (
                                                                <span className="text-[10px] text-green-400 font-mono mt-0.5">+ RM{day.tripEarnings.toFixed(2)}</span>
                                                            )}
                                                        </div>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                ) : (
                                                    day.outputQty > 0 ? (
                                                        <span className="font-mono text-blue-400 font-bold">{day.outputQty.toLocaleString()}</span>
                                                    ) : <span className="text-gray-700 font-mono">—</span>
                                                )}
                                            </td>
                                            {isDriver ? (
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    {day.tripDetails && day.tripDetails.length > 0 ? (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            {day.tripDetails.map((td, idx) => (
                                                                <button 
                                                                    key={idx} 
                                                                    onClick={() => setSelectedTrip(td)}
                                                                    className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 px-2 py-0.5 rounded font-mono shadow-sm cursor-pointer transition-colors"
                                                                >
                                                                    {td.displayString}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : <span className="text-gray-700 font-mono">—</span>}
                                                </td>
                                            ) : (
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {day.machinesOperated.length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-1">
                                                                {day.machinesOperated.map(m => (
                                                                    <span key={m} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono shadow-sm">{m}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {day.alarmCount > 0 && (
                                                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20" title={`${day.alarmCount} anomalies recorded`}>
                                                                {day.alarmCount} Amaran / Alarms
                                                            </span>
                                                        )}
                                                        {day.machinesOperated.length === 0 && day.alarmCount === 0 && (
                                                            <span className="text-gray-700 font-mono">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                {day.photoCount > 0 ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        {day.photos.slice(0, 3).map((photo, idx) => (
                                                            <img 
                                                                key={idx}
                                                                src={photo.photo_url} 
                                                                alt={photo.category || "Work photo"}
                                                                onClick={() => setSelectedPhotoDay(day)}
                                                                className="w-8 h-8 rounded-lg border border-white/10 hover:border-violet-500 hover:scale-110 object-cover cursor-pointer transition-all shadow"
                                                            />
                                                        ))}
                                                        {day.photoCount > 3 && (
                                                            <button 
                                                                onClick={() => setSelectedPhotoDay(day)}
                                                                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-violet-500 hover:bg-white/10 flex items-center justify-center text-[10px] font-black text-violet-400 transition-all cursor-pointer"
                                                            >
                                                                +{day.photoCount - 3}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-700">—</span>
                                                )}
                                            </td>
                                            {isAdminOrHR && (
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    {day.hasAttendance ? (
                                                        <button 
                                                            onClick={() => setSelectedAttendanceDay(day)}
                                                            className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 px-2 py-1 rounded font-bold transition-colors cursor-pointer"
                                                        >
                                                            ✏️ Sunting / Edit
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setSelectedAttendanceDay(day)}
                                                            className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 px-2 py-1 rounded font-bold transition-colors cursor-pointer"
                                                        >
                                                            ➕ Tambah Log / Add
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Trip Detail Modal / Paparan Butiran Trip */}
            {selectedTrip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#09090b] border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl shadow-black relative overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 bg-slate-900/50 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <Truck size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        {selectedTrip.order_number || 'DO Tidak Diketahui'}
                                    </h2>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
                                        Butiran Trip / Trip Details
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 -mr-2 -mt-2">
                                {isAdminOrHR && (
                                    <button 
                                        onClick={() => setIsEditingTrip(!isEditingTrip)}
                                        className="text-xs bg-violet-600 hover:bg-violet-500 px-2.5 py-1.5 rounded-lg font-bold text-white transition-colors cursor-pointer"
                                    >
                                        {isEditingTrip ? 'Batal / Cancel' : '✏️ Sunting / Edit'}
                                    </button>
                                )}
                                <button 
                                    onClick={() => { setSelectedTrip(null); setIsEditingTrip(false); }}
                                    className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-950">
                            
                            {isEditingTrip ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                            Pemandu / Driver
                                        </label>
                                        <select
                                            value={editDriverId}
                                            onChange={(e) => setEditDriverId(e.target.value)}
                                            className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                                        >
                                            <option value="">-- Pilih Pemandu / Select Driver --</option>
                                            {employeesList.filter(e => e.role === 'Driver' || e.role === 'driver').map(drv => (
                                                <option key={drv.uid} value={drv.uid}>
                                                    {drv.name || drv.employee_id} ({drv.employee_id})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                                Asal Trip / Trip Origin
                                            </label>
                                            <input
                                                type="text"
                                                value={editOrigin}
                                                onChange={(e) => setEditOrigin(e.target.value)}
                                                className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 uppercase font-bold"
                                                placeholder="TAIPING / NILAI / KELANTAN / JOHOR"
                                            />
                                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                                {['TAIPING', 'NILAI', 'KELANTAN', 'JOHOR'].map(loc => (
                                                    <button
                                                        key={loc}
                                                        type="button"
                                                        onClick={() => setEditOrigin(loc)}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                                            editOrigin.toUpperCase() === loc
                                                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                                : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
                                                        }`}
                                                    >
                                                        {loc}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                                Zon / Destination Zone
                                            </label>
                                            <input
                                                type="text"
                                                value={editZone}
                                                onChange={(e) => setEditZone(e.target.value)}
                                                className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-bold"
                                                placeholder="e.g. KL, SITIAWAN"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                            Bilangan Drop / Drop Count
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={editDropCount}
                                            onChange={(e) => setEditDropCount(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                            Nota Perjalanan / Trip Notes
                                        </label>
                                        <textarea
                                            value={editNotes}
                                            onChange={(e) => setEditNotes(e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                                            placeholder="Notes"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingTrip(false)}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                                        >
                                            Batal / Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveTrip}
                                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer"
                                        >
                                            Simpan / Save
                                        </button>
                                    </div>

                                    {/* Render DO Photos inside edit mode for reference */}
                                    {(selectedTrip.proof_of_load_url || selectedTrip.pod_photo_url || selectedTrip.pod_signature_url) && (
                                        <div className="pt-4 border-t border-white/5 space-y-3">
                                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                Rujukan Gambar DO / DO Photos Reference
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {selectedTrip.proof_of_load_url && (
                                                    <div className="bg-[#121214] border border-[#27272a] p-2 rounded-xl flex flex-col gap-1">
                                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider text-center">Gambar Muatan / Proof of Load</span>
                                                        <a href={selectedTrip.proof_of_load_url} target="_blank" rel="noreferrer" className="relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-black flex items-center justify-center cursor-zoom-in">
                                                            <img src={selectedTrip.proof_of_load_url} alt="Proof of Load" className="max-w-full max-h-full object-contain" />
                                                        </a>
                                                    </div>
                                                )}
                                                {selectedTrip.pod_photo_url && selectedTrip.pod_photo_url.split(',').map((url: string, idx: number) => {
                                                    const trimmed = url.trim();
                                                    if (!trimmed) return null;
                                                    const isDo = idx % 2 === 0;
                                                    const label = isDo ? 'Gambar DO / DO Proof' : 'Gambar Barang / Cargo Proof';
                                                    return (
                                                        <div key={idx} className="bg-[#121214] border border-[#27272a] p-2 rounded-xl flex flex-col gap-1">
                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider text-center">{label} ({Math.floor(idx / 2) + 1})</span>
                                                            <a href={trimmed} target="_blank" rel="noreferrer" className="relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-black flex items-center justify-center cursor-zoom-in">
                                                                <img src={trimmed} alt={`Proof of Delivery ${idx + 1}`} className="max-w-full max-h-full object-contain" />
                                                            </a>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Route & Customer */}
                                    <div className="space-y-4 bg-[#0d0d12] border border-white/5 p-4 rounded-xl">
                                        <div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Ringkasan Laluan / Route Summary</div>
                                            <div className="text-sm font-bold text-blue-400 font-mono bg-blue-500/10 inline-block px-3 py-1 rounded border border-blue-500/20">
                                                {selectedTrip.displayString}
                                            </div>
                                        </div>
                                        {selectedTrip.customer && (
                                            <div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Pelanggan / Customer</div>
                                                <div className="text-sm font-bold text-gray-200">
                                                    {selectedTrip.customer}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Items List */}
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Barangan Dimuatkan / Loaded Items
                                        </h3>
                                        
                                        {selectedTrip.items && selectedTrip.items.length > 0 ? (
                                            <div className="space-y-2">
                                                {selectedTrip.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="bg-[#121214] border border-[#27272a] p-3 rounded-lg flex items-center justify-between gap-3 group hover:border-blue-500/30 transition-colors">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-bold text-gray-200 truncate">{item.product}</div>
                                                            {(item.remark || item.sourceLocation) && (
                                                                <div className="text-[10px] font-mono text-gray-500 mt-1 truncate">
                                                                    {item.sourceLocation && <span className="text-blue-400 mr-2">[{item.sourceLocation}]</span>}
                                                                    {item.remark}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 pl-3 border-l border-white/5 shrink-0">
                                                            <span className="text-lg font-black font-mono text-white">x{item.quantity}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-center text-xs text-gray-500 font-bold">
                                                Tiada barangan direkodkan untuk trip ini. / No items recorded for this trip.
                                            </div>
                                        )}
                                    </div>

                                    {/* Photos section / Seksyen Gambar DO */}
                                    {(selectedTrip.proof_of_load_url || selectedTrip.pod_photo_url || selectedTrip.pod_signature_url) && (
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></div> Gambar DO / DO Photos
                                            </h3>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {/* Proof of Load */}
                                                {selectedTrip.proof_of_load_url && (
                                                    <div className="bg-[#121214] border border-[#27272a] p-2.5 rounded-xl flex flex-col gap-1.5">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider text-center">Gambar Muatan / Proof of Load</span>
                                                        <a href={selectedTrip.proof_of_load_url} target="_blank" rel="noreferrer" className="relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-black flex items-center justify-center cursor-zoom-in group-hover:border-violet-500/50 transition-colors">
                                                            <img src={selectedTrip.proof_of_load_url} alt="Proof of Load" className="max-w-full max-h-full object-contain" />
                                                        </a>
                                                    </div>
                                                )}

                                                {/* POD Photo */}
                                                {selectedTrip.pod_photo_url && selectedTrip.pod_photo_url.split(',').map((url: string, idx: number) => {
                                                    const trimmed = url.trim();
                                                    if (!trimmed) return null;
                                                    const isDo = idx % 2 === 0;
                                                    const label = isDo ? 'Gambar DO / DO Proof' : 'Gambar Barang / Cargo Proof';
                                                    return (
                                                        <div key={idx} className="bg-[#121214] border border-[#27272a] p-2.5 rounded-xl flex flex-col gap-1.5">
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider text-center">{label} ({Math.floor(idx / 2) + 1})</span>
                                                            <a href={trimmed} target="_blank" rel="noreferrer" className="relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-black flex items-center justify-center cursor-zoom-in group-hover:border-violet-500/50 transition-colors">
                                                                <img src={trimmed} alt={`Proof of Delivery ${idx + 1}`} className="max-w-full max-h-full object-contain" />
                                                            </a>
                                                        </div>
                                                    );
                                                })}

                                                {/* Signature */}
                                                {selectedTrip.pod_signature_url && (
                                                    <div className="bg-[#121214] border border-[#27272a] p-2.5 rounded-xl flex flex-col gap-1.5 sm:col-span-2">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider text-center font-sans">Tandatangan Penerima / Signature</span>
                                                        <div className="relative h-24 rounded-lg overflow-hidden bg-white/95 flex items-center justify-center border border-white/10 shadow-inner">
                                                            <img src={selectedTrip.pod_signature_url} alt="POD Signature" className="max-h-full object-contain p-1" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    {selectedTrip.notes && (
                                        <div>
                                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                Nota Perjalanan / Trip Notes
                                            </h3>
                                            <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-200/80 leading-relaxed font-medium">
                                                {selectedTrip.notes}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Photo Viewer Modal / Paparan Gambar Rekod Kerja */}
            {selectedPhotoDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#09090b] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-black relative overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 bg-slate-900/50 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                    <Camera size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                                        Gambar Kerja / Work Photos
                                    </h2>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
                                        {new Date(selectedPhotoDay.dateStr.replace(/-/g, '/')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedPhotoDay(null)}
                                className="p-2 -mr-2 -mt-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-950 flex flex-col items-center">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                {selectedPhotoDay.photos.map((photo: any, idx: number) => (
                                    <div key={idx} className="bg-[#0d0d12] border border-white/5 rounded-xl p-3 flex flex-col gap-3 group hover:border-violet-500/30 transition-all">
                                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center border border-white/5">
                                            <img 
                                                src={photo.photo_url} 
                                                alt={photo.category || "Work log photo"} 
                                                className="max-w-full max-h-full object-contain"
                                            />
                                            {photo.risk_flag && (
                                                <span className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase rounded shadow flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle size={8} /> RISK / RISIKO
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-start text-xs">
                                            <div>
                                                <div className="font-bold text-gray-200 uppercase text-[10px] tracking-wider bg-white/5 px-2 py-0.5 rounded w-fit">
                                                    {photo.category || 'Tugasan / Job Log'}
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-1">
                                                    {new Date(photo.created_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </div>
                                            </div>
                                            <a 
                                                href={photo.photo_url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="text-[10px] text-violet-400 hover:underline font-bold uppercase tracking-wider"
                                            >
                                                Papar Penuh / Open ↗
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Edit Modal / Paparan Sunting/Tambah Kehadiran */}
            {selectedAttendanceDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#09090b] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl shadow-black relative overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 bg-slate-900/50 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white">
                                        {selectedAttendanceDay.hasAttendance ? 'Sunting Kehadiran / Edit Attendance' : 'Tambah Kehadiran / Add Attendance'}
                                    </h2>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">
                                        Pekerja / Employee: {viewedProfile?.name || viewedProfile?.employee_id}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedAttendanceDay(null)}
                                className="p-2 -mr-2 -mt-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4 bg-slate-950">
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                    Tarikh / Date
                                </label>
                                <div className="text-sm font-bold text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono">
                                    {new Date(selectedAttendanceDay.dateStr.replace(/-/g, '/')).toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                        Masa Masuk / Clock In
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={editClockIn}
                                        onChange={(e) => setEditClockIn(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                        Masa Keluar / Clock Out
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={editClockOut}
                                        onChange={(e) => setEditClockOut(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                                    Nota / Attendance Notes
                                </label>
                                <textarea
                                    value={editAttendanceNotes}
                                    onChange={(e) => setEditAttendanceNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Auto-Logout, Overtime remarks, etc."
                                />
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-white/5">
                                {selectedAttendanceDay.hasAttendance ? (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAttendance}
                                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/25 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        Padam / Delete
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                                
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedAttendanceDay(null)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                                    >
                                        Batal / Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAttendance}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer"
                                    >
                                        Simpan / Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINTABLE BATCH / SINGLE DRIVER REPORTS PORTAL (DIRECTLY ATTACHED TO BODY TO BYPASS LAYOUT OVERFLOW) */}
            {batchPrintData.length > 0 && createPortal(
                <div className="hidden print:block driver-print-wrapper">
                    <style>{`
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 10mm 12mm;
                            }
                            html, body {
                                height: auto !important;
                                overflow: visible !important;
                                background: white !important;
                                color: black !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                            body > *:not(.driver-print-wrapper) {
                                display: none !important;
                            }
                            .driver-print-wrapper {
                                display: block !important;
                                position: absolute !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100% !important;
                                height: auto !important;
                                overflow: visible !important;
                                background: white !important;
                                color: black !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            .driver-print-sheet {
                                display: block !important;
                                page-break-before: always !important;
                                break-before: page !important;
                                page-break-after: always !important;
                                break-after: page !important;
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                                padding: 10mm 12mm !important;
                                margin: 0 !important;
                                background: white !important;
                                color: black !important;
                                box-sizing: border-box !important;
                                width: 100% !important;
                            }
                            .driver-print-sheet:first-child {
                                page-break-before: auto !important;
                                break-before: auto !important;
                            }
                            .driver-print-sheet:last-child {
                                page-break-after: auto !important;
                                break-after: auto !important;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-top: 10px;
                                margin-bottom: 12px;
                            }
                            th, td {
                                border: 1px solid #333;
                                padding: 5px 8px;
                                font-size: 10px;
                                text-align: left;
                            }
                            th {
                                background-color: #f0f0f0 !important;
                                font-weight: bold;
                                -webkit-print-color-adjust: exact;
                            }
                        }
                    `}</style>

                    {batchPrintData.map((report, idx) => (
                        <div key={idx} className="driver-print-sheet">
                            {/* Header */}
                            <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
                                <div>
                                    <h1 className="text-xl font-bold uppercase tracking-wider text-black">PACKSECURE OS</h1>
                                    <h2 className="text-xs font-semibold text-gray-700 uppercase">Laporan Elaun Trip Pemandu Bulanan</h2>
                                    <p className="text-[10px] text-gray-600">Monthly Driver Trip Allowance Report</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold uppercase">Bulan / Month: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
                                    <p className="text-[10px] text-gray-500">Tarikh Cetak: {new Date().toLocaleDateString('en-GB')}</p>
                                </div>
                            </div>

                            {/* Driver Information Bar */}
                            <div className="grid grid-cols-4 gap-3 p-2 bg-gray-100 border border-gray-300 rounded mb-3 text-xs">
                                <div>
                                    <span className="text-gray-500 block text-[9px] uppercase font-bold">Nama Pemandu / Driver</span>
                                    <span className="font-bold text-xs text-black">{report.driverName}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-[9px] uppercase font-bold">No. Pekerja / ID</span>
                                    <span className="font-bold text-xs text-black">{report.employeeId}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-[9px] uppercase font-bold">No. Lorry / Vehicle</span>
                                    <span className="font-bold text-xs text-black">{report.plateNumber}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-[9px] uppercase font-bold">Pusat / Base Location</span>
                                    <span className="font-bold text-xs text-black">{report.baseLocation}</span>
                                </div>
                            </div>

                            {/* Summary Metrics */}
                            <div className="flex justify-between items-center mb-3 p-2 border-2 border-black bg-gray-50">
                                <div>
                                    <span className="text-xs font-bold uppercase text-gray-700">Jumlah Perjalanan / Total Trips: </span>
                                    <span className="text-sm font-extrabold text-black ml-2">{report.totalTrips} Trips</span>
                                </div>
                                <div>
                                    <span className="text-xs font-bold uppercase text-gray-700">Jumlah Elaun Trip / Total Earnings: </span>
                                    <span className="text-base font-extrabold text-black ml-2">RM {report.totalEarnings.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Trips Table */}
                            {report.tripRows.length === 0 ? (
                                <div className="p-6 text-center border border-dashed border-gray-400 text-gray-500 text-xs italic">
                                    Tiada rekod perjalanan hantaran untuk bulan ini. / No trip records found for this month.
                                </div>
                            ) : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '5%' }}>Bil</th>
                                            <th style={{ width: '12%' }}>Tarikh / Date</th>
                                            <th style={{ width: '18%' }}>No. DO / Order</th>
                                            <th style={{ width: '22%' }}>Pelanggan / Customer</th>
                                            <th style={{ width: '25%' }}>Laluan / Route</th>
                                            <th style={{ width: '8%', textAlign: 'center' }}>Drops</th>
                                            <th style={{ width: '10%', textAlign: 'right' }}>Elaun (RM)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.tripRows.map((row: any, rIdx: number) => (
                                            <tr key={rIdx}>
                                                <td>{rIdx + 1}</td>
                                                <td>{row.date}</td>
                                                <td className="font-mono font-bold">{row.orderNumber}</td>
                                                <td>{row.customer}</td>
                                                <td>{row.origin} ➞ {row.destination}</td>
                                                <td style={{ textAlign: 'center' }}>{row.drops}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                    {row.earnings > 0 ? row.earnings.toFixed(2) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
                                            <td colSpan={6} style={{ textAlign: 'right' }}>JUMLAH ELAUN / TOTAL ALLOWANCE (RM):</td>
                                            <td style={{ textAlign: 'right', fontSize: '11px' }}>RM {report.totalEarnings.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}

                            {/* Signatures Footer */}
                            <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t border-gray-300 text-xs">
                                <div>
                                    <p className="font-bold mb-8 text-[11px]">Tandatangan Pemandu / Driver Signature:</p>
                                    <div className="border-t border-black pt-1 w-3/4">
                                        <p className="font-semibold">{report.driverName}</p>
                                        <p className="text-[9px] text-gray-500">Tarikh / Date: ___________________</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="font-bold mb-8 text-[11px]">Pengesahan HR / Pengurus (HR / Manager Approval):</p>
                                    <div className="border-t border-black pt-1 w-3/4">
                                        <p className="font-semibold">Nama & Jawatan / Name & Stamp</p>
                                        <p className="text-[9px] text-gray-500">Tarikh / Date: ___________________</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default PersonalMonthlyReport;
