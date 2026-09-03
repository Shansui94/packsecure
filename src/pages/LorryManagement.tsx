
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { 
    Truck, Plus, Trash2, Edit2, Search, User, MapPin, QrCode as QrIcon, 
    Printer, X, AlertTriangle, Check, FileText, Image as ImageIcon, 
    FileSpreadsheet, LayoutGrid, Table as TableIcon, ChevronLeft, ChevronRight,
    Calendar, ArrowRight, TrendingUp, RefreshCw, Eye, Copy, 
    CheckCircle2, AlertCircle, Info, ExternalLink, Filter, SlidersHorizontal
} from 'lucide-react';
import QRCode from 'react-qr-code';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';

const LorryManagement: React.FC = () => {
    const { t } = useTranslation();
    const [lorries, setLorries] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // Current Date Defaults
    const now = new Date();
    const currentRealMonth = now.getMonth() + 1;
    const currentRealYear = now.getFullYear();

    // Tabs: 'fleet' (车队列表) | 'monthly-odoo' (全月里程追踪) | 'mileage' (日志与预警)
    const [activeTab, setActiveTab] = useState<'fleet' | 'monthly-odoo' | 'mileage'>('fleet');

    // Monthly Odometer Tracker State
    const [selectedOdoMonth, setSelectedOdoMonth] = useState<number>(currentRealMonth);
    const [selectedOdoYear, setSelectedOdoYear] = useState<number>(currentRealYear);
    const [monthlyLogs, setMonthlyLogs] = useState<any[]>([]);
    const [loadingMonthly, setLoadingMonthly] = useState(false);
    const [monthlySearchTerm, setMonthlySearchTerm] = useState('');
    const [monthlyFilterStatus, setMonthlyFilterStatus] = useState<'all' | 'active' | 'no-logs' | 'discrepancy'>('all');
    const [copySuccess, setCopySuccess] = useState(false);

    // Timeline & Calibration Modals
    const [timelineModalLorry, setTimelineModalLorry] = useState<any | null>(null);
    const [calibrationModalLorry, setCalibrationModalLorry] = useState<any | null>(null);
    const [calibrationData, setCalibrationData] = useState({
        mileage: '',
        log_type: 'start' as 'start' | 'end',
        date: `${currentRealYear}-${String(currentRealMonth).padStart(2, '0')}-01T08:00`,
        notes: ''
    });
    const [isSavingCalibration, setIsSavingCalibration] = useState(false);

    // Odometer Logs & Alerts State
    const [mileageLogs, setMileageLogs] = useState<any[]>([]);
    const [mileageAlerts, setMileageAlerts] = useState<any[]>([]);
    const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
    const [resolveNotes, setResolveNotes] = useState('');
    const [isResolving, setIsResolving] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [selectedLorryPlate, setSelectedLorryPlate] = useState<string>('All');
    const [logsPage, setLogsPage] = useState<number>(1);
    const LOGS_PER_PAGE = 15;
    const [alertsPage, setAlertsPage] = useState<number>(1);
    const ALERTS_PER_PAGE = 6;
    const [odoSubTab, setOdoSubTab] = useState<'alerts' | 'logs'>('alerts');

    const [, setLangTick] = useState(0);
    useEffect(() => {
        const handleLang = () => setLangTick(v => v + 1);
        window.addEventListener('packsecure:lang-change', handleLang);
        return () => window.removeEventListener('packsecure:lang-change', handleLang);
    }, []);

    // Monthly Odometer Summary Modal State
    const [isMonthlyOdoModalOpen, setIsMonthlyOdoModalOpen] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [editingLorry, setEditingLorry] = useState<any>(null);
    const [formData, setFormData] = useState({
        plate_number: '',
        driver_id: '',
        preferred_zone: 'Not Specified',
        status: 'Available',
        max_volume_m3: 36.8098,
        max_weight_kg: 3000
    });

    const handlePrintQR = (lorry: any) => {
        setEditingLorry(lorry);
        setIsQrModalOpen(true);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [lorriesRes, driversRes, logsRes, alertsRes] = await Promise.all([
            supabase.from('lorries').select('*').order('created_at', { ascending: false }),
            supabase.from('users_public').select('*').order('name'),
            supabase.from('lorry_mileage_logs').select('*, lorries(plate_number), driver:driver_id(name, email)').order('created_at', { ascending: false }),
            supabase.from('lorry_mileage_alerts').select('*, lorries(plate_number), driver:driver_id(name, email), resolver:resolved_by(name, email)').order('created_at', { ascending: false })
        ]);

        if (lorriesRes.data) setLorries(lorriesRes.data);
        if (driversRes.data) {
            const filteredDrivers = driversRes.data.filter((u: any) =>
                u.role === 'Driver' ||
                u.email === 'neosonchun@gmail.com' ||
                u.email === 'ericsoobaolin0219@gmail.com' ||
                u.name?.toLowerCase().includes('neoson')
            );
            setDrivers(filteredDrivers);
        }
        if (logsRes.data) setMileageLogs(logsRes.data);
        if (alertsRes.data) setMileageAlerts(alertsRes.data);
        setLoading(false);
    };

    const handleExportExcel = () => {
        const logsToExport = selectedLorryPlate === 'All'
            ? mileageLogs
            : mileageLogs.filter(log => log.lorries?.plate_number === selectedLorryPlate);

        if (logsToExport.length === 0) {
            alert("Tiada rekod log odometer untuk dieksport. / No mileage logs found to export.");
            return;
        }

        const excelRows = logsToExport.map(log => ({
            'Tarikh & Masa / Timestamp': new Date(log.created_at).toLocaleString('en-GB'),
            'No. Plate Lorry / Lorry Plate': log.lorries?.plate_number || 'N/A',
            'Nama Pemandu / Driver': log.driver?.name || log.driver?.email || 'Unassigned',
            'Jenis Log / Log Type': log.log_type === 'start' ? 'Start Shift (Mula Shift)' : 'End Shift (Tamat Shift)',
            'Bacaan Odometer (KM)': log.mileage != null ? Number(log.mileage) : (log.mileage_km != null ? Number(log.mileage_km) : 0),
            'Gambar Odometer / Photo URL': log.photo_url || '',
            'Nota / Notes': log.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(excelRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Odometer Logs');

        ws['!cols'] = [
            { wch: 22 }, // Date & Time
            { wch: 18 }, // Lorry Plate
            { wch: 22 }, // Driver
            { wch: 24 }, // Log Type
            { wch: 22 }, // Mileage
            { wch: 45 }, // Photo URL
            { wch: 30 }  // Notes
        ];

        const todayStr = new Date().toISOString().split('T')[0];
        const plateSuffix = selectedLorryPlate === 'All' ? 'Semua_Lorry' : selectedLorryPlate.replace(/\s+/g, '_');
        const fileName = `Laporan_Odometer_Lorry_${plateSuffix}_${todayStr}.xlsx`;

        XLSX.writeFile(wb, fileName);
    };

    const normalizePlate = (plate: string) => (plate || '').replace(/\s+/g, '').toUpperCase();

    // Fetch monthly logs specifically for the selected month/year without 1000 limit truncations
    const fetchMonthlyLogs = async (year: number, month: number) => {
        setLoadingMonthly(true);
        try {
            // Precise local month boundary (handles UTC+8 local time without cross-month overlap)
            const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);
            const startStr = startDate.toISOString();
            const endStr = endDate.toISOString();

            const { data, error } = await supabase
                .from('lorry_mileage_logs')
                .select('*, lorries(id, plate_number, driver_name), driver:driver_id(name, email)')
                .gte('created_at', startStr)
                .lte('created_at', endStr)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMonthlyLogs(data || []);
        } catch (err) {
            console.error("Error fetching monthly logs:", err);
        } finally {
            setLoadingMonthly(false);
        }
    };

    useEffect(() => {
        fetchMonthlyLogs(selectedOdoYear, selectedOdoMonth);
    }, [selectedOdoYear, selectedOdoMonth]);

    const defaultPlates = [
        "ANW 9821", "ANX 9821", "APD 9821", "APH 9821", "BSQ 9821", 
        "DFK 9821", "JYH 9821", "KGG 9821", "NEH 9821", "PETRA 9821", 
        "RAU 9821", "RBC 9821", "TDE 9821", "VPC 9821"
    ];

    const monthlySummaries = useMemo(() => {
        const plateMap = new Map<string, any>();

        lorries.forEach(l => {
            const norm = normalizePlate(l.plate_number);
            if (norm) {
                plateMap.set(norm, {
                    id: l.id,
                    plate_number: l.plate_number,
                    driver_name: l.driver_name,
                    preferred_zone: l.preferred_zone || 'Not Specified',
                    status: l.status || 'Available',
                    max_volume_m3: l.max_volume_m3,
                    max_weight_kg: l.max_weight_kg
                });
            }
        });

        defaultPlates.forEach(p => {
            const norm = normalizePlate(p);
            if (!plateMap.has(norm)) {
                plateMap.set(norm, {
                    id: null,
                    plate_number: p,
                    driver_name: null,
                    preferred_zone: 'Not Specified',
                    status: 'Available',
                    max_volume_m3: 36.8098,
                    max_weight_kg: 3000
                });
            }
        });

        const list = Array.from(plateMap.values()).map(l => {
            const norm = normalizePlate(l.plate_number);
            const pLogs = monthlyLogs.filter(log => {
                const logPlate = normalizePlate(log.lorries?.plate_number || '');
                const directMatch = l.id && log.lorry_id === l.id;
                return directMatch || (logPlate && logPlate === norm);
            });

            pLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const startLog = pLogs.length > 0 ? pLogs[0] : null;
            const endLog = pLogs.length > 0 ? pLogs[pLogs.length - 1] : null;

            const startMileage = startLog ? (startLog.mileage != null ? Number(startLog.mileage) : (startLog.mileage_km != null ? Number(startLog.mileage_km) : null)) : null;
            const endMileage = endLog ? (endLog.mileage != null ? Number(endLog.mileage) : (endLog.mileage_km != null ? Number(endLog.mileage_km) : null)) : null;

            const diff = (startMileage !== null && endMileage !== null) ? (endMileage - startMileage) : null;
            const isDiscrepancy = diff !== null && diff < 0;

            const activeDriver = endLog?.driver?.name || endLog?.driver?.email || startLog?.driver?.name || startLog?.driver?.email || l.driver_name || '未分配';

            return {
                ...l,
                normalizedPlate: norm,
                logs: pLogs,
                logCount: pLogs.length,
                startLog: startLog ? {
                    ...startLog,
                    mileage: startMileage,
                    timeFormatted: new Date(startLog.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }),
                    driverName: startLog.driver?.name || startLog.driver?.email || 'N/A'
                } : null,
                endLog: endLog ? {
                    ...endLog,
                    mileage: endMileage,
                    timeFormatted: new Date(endLog.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }),
                    driverName: endLog.driver?.name || endLog.driver?.email || 'N/A'
                } : null,
                diff,
                isDiscrepancy,
                activeDriver
            };
        });

        list.sort((a, b) => a.plate_number.localeCompare(b.plate_number));
        return list;
    }, [lorries, monthlyLogs]);

    const totalTrackedLorries = monthlySummaries.length;
    const activeLorriesCount = monthlySummaries.filter(s => s.logCount > 0).length;
    const totalNetDistance = monthlySummaries.reduce((sum, s) => (s.diff !== null && s.diff > 0 ? sum + s.diff : sum), 0);
    const discrepanciesCount = monthlySummaries.filter(s => s.isDiscrepancy).length;

    const filteredMonthlySummaries = useMemo(() => {
        return monthlySummaries.filter(item => {
            const matchesSearch = 
                item.plate_number.toLowerCase().includes(monthlySearchTerm.toLowerCase()) ||
                item.activeDriver.toLowerCase().includes(monthlySearchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            if (monthlyFilterStatus === 'active') return item.logCount > 0;
            if (monthlyFilterStatus === 'no-logs') return item.logCount === 0;
            if (monthlyFilterStatus === 'discrepancy') return item.isDiscrepancy;
            return true;
        });
    }, [monthlySummaries, monthlySearchTerm, monthlyFilterStatus]);

    const handleSaveCalibration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!calibrationModalLorry) return;
        const mileageNum = parseInt(calibrationData.mileage, 10);
        if (isNaN(mileageNum) || mileageNum < 0) {
            alert("请输入有效的里程读数 (公里数)！");
            return;
        }

        setIsSavingCalibration(true);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const targetLorryId = calibrationModalLorry.id || lorries.find(l => normalizePlate(l.plate_number) === calibrationModalLorry.normalizedPlate)?.id;
            
            if (!targetLorryId) {
                alert("未找到该车辆数据库ID，请先确保车辆已保存在系统中！");
                setIsSavingCalibration(false);
                return;
            }

            const { error } = await supabase
                .from('lorry_mileage_logs')
                .insert({
                    lorry_id: targetLorryId,
                    driver_id: authUser?.id || targetLorryId,
                    mileage: mileageNum,
                    photo_url: '',
                    log_type: calibrationData.log_type,
                    created_at: new Date(calibrationData.date).toISOString()
                });

            if (error) throw error;

            alert("✅ 里程校准/补录成功！");
            setCalibrationModalLorry(null);
            fetchMonthlyLogs(selectedOdoYear, selectedOdoMonth);
            fetchData();
        } catch (err: any) {
            alert("校准失败: " + err.message);
        } finally {
            setIsSavingCalibration(false);
        }
    };

    const handleGenerateMonthlyOdometerReport = () => {
        const lastDayObj = new Date(selectedOdoYear, selectedOdoMonth, 0);
        const lastDay = lastDayObj.getDate();

        const summaryRows = monthlySummaries.map(s => {
            const startStr = s.startLog?.mileage != null ? s.startLog.mileage : '_____';
            const endStr = s.endLog?.mileage != null ? s.endLog.mileage : '_____';
            const diffStr = s.diff != null ? s.diff : '-';
            const formattedSummary = `${s.plate_number}: 1/${selectedOdoMonth} ODO ${startStr} , ${lastDay}/${selectedOdoMonth} ODO ${endStr}`;

            return {
                'No. Plate Lori / Lorry Plate': s.plate_number,
                'Pemandu / Driver': s.activeDriver,
                [`1/${selectedOdoMonth} ODO (Awal Bulan / Start KM)`]: startStr,
                'Tarikh & Masa Mula / Start Time': s.startLog?.timeFormatted || 'N/A',
                [`${lastDay}/${selectedOdoMonth} ODO (Akhir Bulan / End KM)`]: endStr,
                'Tarikh & Masa Tamat / End Time': s.endLog?.timeFormatted || 'N/A',
                'Jumlah Jarak / Net Distance (KM)': diffStr,
                'Bilangan Log / Total Logs': s.logCount,
                'Status': s.logCount === 0 ? 'Tiada Rekod' : (s.isDiscrepancy ? 'Amaran Tidak Konsisten' : 'Lengkap'),
                'Gambar Mula / Start Photo': s.startLog?.photo_url || '',
                'Gambar Tamat / End Photo': s.endLog?.photo_url || '',
                'Format Ringkasan Teks': formattedSummary
            };
        });

        const ws = XLSX.utils.json_to_sheet(summaryRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `ODO Bulanan ${selectedOdoMonth}-${selectedOdoYear}`);

        ws['!cols'] = [
            { wch: 18 },
            { wch: 20 },
            { wch: 24 },
            { wch: 22 },
            { wch: 24 },
            { wch: 22 },
            { wch: 20 },
            { wch: 16 },
            { wch: 20 },
            { wch: 35 },
            { wch: 35 },
            { wch: 45 }
        ];

        const fileName = `Laporan_Odometer_Bulanan_${selectedOdoYear}_Bulan_${String(selectedOdoMonth).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getFormattedSummaryText = () => {
        const lastDayObj = new Date(selectedOdoYear, selectedOdoMonth, 0);
        const lastDay = lastDayObj.getDate();

        const lines = [
            `【${selectedOdoYear}年${selectedOdoMonth}月 车队罗里起止里程汇报 / LORRY FLEET ODOMETER REPORT】`,
            `统计区间: 1/${selectedOdoMonth}/${selectedOdoYear} ~ ${lastDay}/${selectedOdoMonth}/${selectedOdoYear}`,
            `--------------------------------------------------`
        ];

        monthlySummaries.forEach(s => {
            const startStr = s.startLog?.mileage != null ? Number(s.startLog.mileage).toLocaleString() : '________';
            const endStr = s.endLog?.mileage != null ? Number(s.endLog.mileage).toLocaleString() : '________';
            const diffStr = s.diff != null ? (s.diff >= 0 ? `+${s.diff.toLocaleString()} km` : `${s.diff.toLocaleString()} km ⚠️`) : '—';
            lines.push(`${s.plate_number}: 1/${selectedOdoMonth} ODO ${startStr} , ${lastDay}/${selectedOdoMonth} ODO ${endStr} (${diffStr})`);
        });

        lines.push(`--------------------------------------------------`);
        lines.push(`车队全月累计净行驶: ${totalNetDistance.toLocaleString()} KM (打卡车辆: ${activeLorriesCount}/${totalTrackedLorries} 辆)`);
        return lines.join('\n');
    };

    const handleResolveAlert = async (alertId: string) => {
        if (!resolveNotes.trim()) {
            alert("Please enter resolution notes!");
            return;
        }

        setIsResolving(true);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('lorry_mileage_alerts')
                .update({
                    resolved: true,
                    resolved_by: authUser.id,
                    resolved_notes: resolveNotes.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', alertId);

            if (error) throw error;

            alert("Alert resolved successfully!");
            setResolvingAlertId(null);
            setResolveNotes('');
            fetchData();
        } catch (err: any) {
            alert("Error resolving alert: " + err.message);
        } finally {
            setIsResolving(false);
        }
    };

    const handleOpenModal = (lorry: any = null) => {
        if (lorry) {
            setEditingLorry(lorry);
            setFormData({
                plate_number: lorry.plate_number,
                driver_id: lorry.driver_id || '',
                preferred_zone: lorry.preferred_zone || 'Not Specified',
                status: lorry.status || 'Available',
                max_volume_m3: lorry.max_volume_m3 != null ? Number(lorry.max_volume_m3) : 36.8098,
                max_weight_kg: lorry.max_weight_kg != null ? Number(lorry.max_weight_kg) : 3000
            });
        } else {
            setEditingLorry(null);
            setFormData({
                plate_number: '',
                driver_id: '',
                preferred_zone: 'Not Specified',
                status: 'Available',
                max_volume_m3: 36.8098,
                max_weight_kg: 3000
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedDriver = drivers.find(d => d.id === formData.driver_id);
        const driverName = selectedDriver ? (selectedDriver.name || selectedDriver.email) : null;

        const payload = {
            ...formData,
            driver_id: formData.driver_id || null,
            driver_name: driverName
        };

        try {
            if (editingLorry) {
                const { error } = await supabase.from('lorries').update(payload).eq('id', editingLorry.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('lorries').insert(payload);
                if (error) throw error;
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleDelete = async (id: string, plate: string) => {
        if (!window.confirm(`Delete Lorry ${plate}?`)) return;
        const { error } = await supabase.from('lorries').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    const filteredLorries = lorries.filter(l =>
        l.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.driver_name && l.driver_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const ZONES = ["Not Specified", "North", "Central", "South", "East", "West"];
    const STATUSES = ["Available", "On-Route", "Maintenance", "Unavailable"];

    return (
        <div className="p-4 sm:p-8 bg-[#121215] min-h-screen text-slate-100">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white italic flex items-center gap-3 uppercase tracking-tighter">
                        <Truck className="text-blue-500" size={28} />
                        {t('货车车队管理')}
                    </h1>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] font-bold tracking-[0.15em]">
                        {t('管理车队车辆、分配司机与全月里程日志')}
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
                    <button
                        onClick={() => setActiveTab('monthly-odoo')}
                        className={`px-2.5 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[11px] sm:text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg min-h-[44px] ${
                            activeTab === 'monthly-odoo' 
                                ? 'bg-blue-600 text-white shadow-blue-900/40' 
                                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-indigo-950/40'
                        }`}
                        title={t('全月里程追踪')}
                    >
                        <Calendar size={16} className="shrink-0" />
                        <span className="truncate">{t('全月里程追踪')}</span>
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-2.5 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[11px] sm:text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 min-h-[44px]"
                        title={t('导出日志')}
                    >
                        <FileSpreadsheet size={16} className="shrink-0" />
                        <span className="truncate">{t('导出日志')}</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="col-span-2 sm:col-span-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[11px] sm:text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-900/20 min-h-[44px]"
                    >
                        <Plus size={18} className="shrink-0" />
                        <span className="whitespace-nowrap">{t('添加新车')}</span>
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 sm:gap-6 mb-6 sm:mb-8 border-b border-slate-800 pb-px overflow-x-auto">
                <button
                    onClick={() => setActiveTab('fleet')}
                    className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative shrink-0 ${activeTab === 'fleet' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Truck size={14} />
                        {t('车队列表')}
                    </div>
                    {activeTab === 'fleet' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('monthly-odoo')}
                    className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative shrink-0 ${activeTab === 'monthly-odoo' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        {t('全月里程追踪 (Start/End ODO)')}
                        {discrepanciesCount > 0 ? (
                            <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                {discrepanciesCount} 异常
                            </span>
                        ) : activeLorriesCount > 0 ? (
                            <span className="bg-blue-500/20 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-full">
                                {activeLorriesCount}/{totalTrackedLorries}
                            </span>
                        ) : null}
                    </div>
                    {activeTab === 'monthly-odoo' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('mileage')}
                    className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative shrink-0 ${activeTab === 'mileage' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <FileText size={14} />
                        {t('里程日志与预警')}
                        {mileageAlerts.filter(a => !a.resolved).length > 0 && (
                            <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                {mileageAlerts.filter(a => !a.resolved).length}
                            </span>
                        )}
                    </div>
                    {activeTab === 'mileage' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
                </button>
            </div>

            {activeTab === 'fleet' && (
                <>
                    {/* Filters & View Toggle */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                placeholder={t('搜索车牌号或司机')}
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 sm:py-4 pl-12 pr-4 text-xs sm:text-sm focus:border-blue-500 outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-2xl shrink-0 self-end sm:self-auto">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                    viewMode === 'grid'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title={t('卡片')}
                            >
                                <LayoutGrid size={16} />
                                <span className="hidden sm:inline">{t('卡片')}</span>
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                    viewMode === 'table'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title={t('Table View/Table View')}
                            >
                                <TableIcon size={16} />
                                <span className="hidden sm:inline">{t('Table / Table')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Content View: Grid vs Table */}
                    {loading ? (
                        <div className="text-center py-20 text-slate-500 animate-pulse uppercase font-black tracking-widest">{t('Loading fleet data / Loading fleet data...')}</div>
                    ) : filteredLorries.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/30 rounded-[32px] border-2 border-dashed border-slate-800 text-slate-500 uppercase font-black tracking-widest">
                            
                                                            {t('No truck data / No lorries found.')}
                                                        </div>
                    ) : viewMode === 'table' ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left align-middle text-slate-300">
                                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800 font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">{t('License plate number / Lorry Plate')}</th>
                                            <th className="px-6 py-4">{t('Main driver / Driver')}</th>
                                            <th className="px-6 py-4">{t('Departure area/Zone')}</th>
                                            <th className="px-6 py-4">{t('Status / Status')}</th>
                                            <th className="px-6 py-4 text-center">{t('本月里程 (Start → End)')}</th>
                                            <th className="px-6 py-4 text-right">{t('Maximum volume / Vol (m³)')}</th>
                                            <th className="px-6 py-4 text-right">{t('Maximum load / Weight (kg)')}</th>
                                            <th className="px-6 py-4 text-center">{t('Actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {filteredLorries.map((lorry) => (
                                            <tr key={lorry.id} className="hover:bg-slate-950/40 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                                                            <Truck size={20} />
                                                        </div>
                                                        <span className="text-base font-black text-white uppercase tracking-tight">{lorry.plate_number}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <User size={14} className="text-slate-500" />
                                                        <span className="font-bold text-slate-200">{lorry.driver_name || t('Unassigned / Unassigned')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-medium">
                                                    <span className="inline-flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                                                        <MapPin size={12} className="text-slate-500" />
                                                        {lorry.preferred_zone}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                        lorry.status === 'Available' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                        lorry.status === 'On-Route' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                        lorry.status === 'Maintenance' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                        {lorry.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {(() => {
                                                        const summary = monthlySummaries.find(s => s.normalizedPlate === normalizePlate(lorry.plate_number));
                                                        if (!summary || summary.logCount === 0) {
                                                            return <span className="text-slate-600 text-xs font-mono">—</span>;
                                                        }
                                                        return (
                                                            <div className="inline-flex flex-col items-center">
                                                                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-200">
                                                                    <span>{summary.startLog ? `${summary.startLog.mileage.toLocaleString()} km` : '—'}</span>
                                                                    <ArrowRight size={12} className="text-slate-500" />
                                                                    <span>{summary.endLog ? `${summary.endLog.mileage.toLocaleString()} km` : '—'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[10px] mt-0.5">
                                                                    <span className={`font-mono font-black ${summary.diff != null ? (summary.diff >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>
                                                                        {summary.diff != null ? `${summary.diff >= 0 ? '+' : ''}${summary.diff.toLocaleString()} km` : ''}
                                                                    </span>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setMonthlySearchTerm(lorry.plate_number);
                                                                            setActiveTab('monthly-odoo');
                                                                        }}
                                                                        className="text-[9px] text-blue-400 hover:underline ml-1"
                                                                    >
                                                                        详情 →
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-blue-400">
                                                    {lorry.max_volume_m3 != null ? Number(lorry.max_volume_m3).toFixed(2) : '36.81'} m³
                                                    <span className="text-[9px] text-slate-500 block font-normal">
                                                        (~{Math.round((lorry.max_volume_m3 || 36.8098) / 0.4489)} rolls)
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-400">
                                                    {lorry.max_weight_kg != null ? Number(lorry.max_weight_kg) : '3000'} kg
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => handleOpenModal(lorry)}
                                                            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-bold text-xs"
                                                            title={t('Edit / edit')}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintQR(lorry)}
                                                            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all font-bold text-xs"
                                                            title={t('Print QR/print QR code')}
                                                        >
                                                            <QrIcon size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(lorry.id, lorry.plate_number)}
                                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
                                                            title={t('Delete / delete')}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredLorries.map((lorry) => (
                                <div key={lorry.id} className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 group hover:border-blue-500/50 transition-all relative overflow-hidden">
                                    {/* Status Indicator */}
                                    <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${lorry.status === 'Available' ? 'bg-green-500/10 text-green-500' :
                                        lorry.status === 'On-Route' ? 'bg-blue-500/10 text-blue-500' :
                                            lorry.status === 'Maintenance' ? 'bg-amber-500/10 text-amber-500' :
                                                'bg-red-500/10 text-red-500'
                                        }`}>
                                        {lorry.status}
                                    </div>

                                    <div className="flex items-center gap-4 mb-6 pt-2">
                                        <div className="w-14 h-14 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center text-blue-500">
                                            <Truck size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{lorry.plate_number}</h3>
                                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">
                                                <MapPin size={10} /> {lorry.preferred_zone}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Primary Driver</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                                    <User size={14} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-200">{lorry.driver_name || 'Unassigned'}</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Maximum Capacity</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Volume Limit</span>
                                                    <span className="text-sm font-black text-blue-400 font-mono">
                                                        {lorry.max_volume_m3 != null ? Number(lorry.max_volume_m3).toFixed(2) : '36.81'} m³
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 block mt-0.5">
                                                        (~{Math.round((lorry.max_volume_m3 || 36.8098) / 0.4489)} rolls)
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Weight Limit</span>
                                                    <span className="text-sm font-black text-emerald-400 font-mono">
                                                        {lorry.max_weight_kg != null ? Number(lorry.max_weight_kg) : '3000'} kg
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Monthly Odometer Summary Box */}
                                    {(() => {
                                        const summary = monthlySummaries.find(s => s.normalizedPlate === normalizePlate(lorry.plate_number));
                                        return (
                                            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 mb-6">
                                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} className="text-blue-400" />
                                                        {selectedOdoMonth}月里程概况
                                                    </span>
                                                    {summary && summary.logCount > 0 ? (
                                                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                            {summary.logCount} 次打卡
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600 text-[9px]">本月未打卡</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="font-mono text-xs font-bold text-slate-300">
                                                        <span>{summary?.startLog ? `${summary.startLog.mileage.toLocaleString()} km` : '—'}</span>
                                                        <span className="text-slate-600 mx-1.5">→</span>
                                                        <span>{summary?.endLog ? `${summary.endLog.mileage.toLocaleString()} km` : '—'}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-xs font-mono font-black block ${summary?.diff != null ? (summary.diff >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                                                            {summary?.diff != null ? `${summary.diff >= 0 ? '+' : ''}${summary.diff.toLocaleString()} km` : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenModal(lorry)}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-widest min-h-[44px]"
                                        >
                                            <Edit2 size={14} /> Edit
                                        </button>
                                        <button
                                            onClick={() => handlePrintQR(lorry)}
                                            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2 min-h-[44px]"
                                            title="Print QR"
                                        >
                                            <QrIcon size={16} /> QR
                                        </button>
                                        <button
                                            onClick={() => handleDelete(lorry.id, lorry.plate_number)}
                                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all min-h-[44px]"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* TAB 2: MONTHLY ODOMETER TRACKER */}
            {activeTab === 'monthly-odoo' && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                    {/* Month Selector & Action Bar */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800">
                                <Calendar size={18} className="text-blue-500" />
                                <select
                                    value={selectedOdoYear}
                                    onChange={(e) => setSelectedOdoYear(Number(e.target.value))}
                                    className="bg-transparent text-white font-black text-sm outline-none cursor-pointer"
                                >
                                    {[2025, 2026, 2027].map(y => (
                                        <option key={y} value={y} className="bg-slate-900">{y}年</option>
                                    ))}
                                </select>
                                <span className="text-slate-600">/</span>
                                <select
                                    value={selectedOdoMonth}
                                    onChange={(e) => setSelectedOdoMonth(Number(e.target.value))}
                                    className="bg-transparent text-white font-black text-sm outline-none cursor-pointer"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                        <option key={m} value={m} className="bg-slate-900">{m}月 ({new Date(2026, m - 1, 1).toLocaleString('zh-CN', { month: 'short' })})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Quick jump pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                <button
                                    onClick={() => {
                                        setSelectedOdoYear(currentRealYear);
                                        setSelectedOdoMonth(currentRealMonth);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                        selectedOdoYear === currentRealYear && selectedOdoMonth === currentRealMonth
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                    }`}
                                >
                                    本月 ({currentRealMonth}月)
                                </button>
                                {currentRealMonth > 1 && (
                                    <button
                                        onClick={() => {
                                            setSelectedOdoYear(currentRealYear);
                                            setSelectedOdoMonth(currentRealMonth - 1);
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                            selectedOdoYear === currentRealYear && selectedOdoMonth === currentRealMonth - 1
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                        }`}
                                    >
                                        上月 ({currentRealMonth - 1}月)
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setSelectedOdoYear(2026);
                                        setSelectedOdoMonth(8);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                        selectedOdoYear === 2026 && selectedOdoMonth === 8
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                    }`}
                                >
                                    8月 (完整历史)
                                </button>
                                <button
                                    onClick={() => fetchMonthlyLogs(selectedOdoYear, selectedOdoMonth)}
                                    className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 transition-all ml-1"
                                    title="刷新当月数据"
                                >
                                    <RefreshCw size={14} className={loadingMonthly ? 'animate-spin text-blue-400' : ''} />
                                </button>
                            </div>

                            <div className="text-[11px] font-bold text-slate-400 hidden lg:block bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800/60">
                                统计区间: <span className="text-slate-200">{selectedOdoYear}-0{selectedOdoMonth}-01</span> 至 <span className="text-slate-200">{selectedOdoYear}-0{selectedOdoMonth}-{new Date(selectedOdoYear, selectedOdoMonth, 0).getDate()}</span> (共 {new Date(selectedOdoYear, selectedOdoMonth, 0).getDate()} 天)
                            </div>
                        </div>

                        {/* Right Action Buttons */}
                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(getFormattedSummaryText());
                                    setCopySuccess(true);
                                    setTimeout(() => setCopySuccess(false), 2500);
                                }}
                                className="flex-1 sm:flex-none py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-slate-700/60 shadow-md min-h-[42px]"
                            >
                                <Copy size={15} className="text-indigo-400" />
                                <span>{copySuccess ? '✓ 已复制汇报文本' : '复制汇报文本'}</span>
                            </button>
                            <button
                                onClick={handleGenerateMonthlyOdometerReport}
                                className="flex-1 sm:flex-none py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 min-h-[42px]"
                            >
                                <FileSpreadsheet size={16} />
                                <span>下载月度表格 (.xlsx)</span>
                            </button>
                        </div>
                    </div>

                    {/* 4 KPI Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">车队车辆总数</span>
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400"><Truck size={16} /></div>
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-white font-mono">{totalTrackedLorries} <span className="text-xs font-sans text-slate-400">辆</span></div>
                            <div className="text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                                <span className="text-emerald-400 font-bold">{activeLorriesCount}</span> 辆本月已有打卡记录
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">全月车队净行驶</span>
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><TrendingUp size={16} /></div>
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                                {totalNetDistance > 0 ? `+${totalNetDistance.toLocaleString()}` : totalNetDistance.toLocaleString()} <span className="text-xs font-sans text-slate-400">KM</span>
                            </div>
                            <div className="text-[11px] font-bold text-slate-400 mt-1">
                                平均每车 {activeLorriesCount > 0 ? Math.round(totalNetDistance / activeLorriesCount).toLocaleString() : 0} KM
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">当月打卡总次数</span>
                                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400"><FileText size={16} /></div>
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-white font-mono">{monthlyLogs.length} <span className="text-xs font-sans text-slate-400">次</span></div>
                            <div className="text-[11px] font-bold text-slate-400 mt-1">
                                包含上班起步与下班交车
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">读数异常车次</span>
                                <div className={`p-2 rounded-xl ${discrepanciesCount > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    <AlertTriangle size={16} />
                                </div>
                            </div>
                            <div className={`text-2xl sm:text-3xl font-black font-mono ${discrepanciesCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {discrepanciesCount} <span className="text-xs font-sans text-slate-400">辆</span>
                            </div>
                            <div className="text-[11px] font-bold text-slate-400 mt-1">
                                {discrepanciesCount > 0 ? '⚠️ 存在结束读数小于起步读数' : '✅ 全部读数正常递增'}
                            </div>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                placeholder="搜索车牌号 (例如 ANW 9821) 或司机姓名..."
                                className="w-full bg-slate-900/70 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs sm:text-sm focus:border-blue-500 outline-none transition-all text-white placeholder-slate-500"
                                value={monthlySearchTerm}
                                onChange={(e) => setMonthlySearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl overflow-x-auto shrink-0">
                            <button
                                onClick={() => setMonthlyFilterStatus('all')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    monthlyFilterStatus === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                全部 ({monthlySummaries.length})
                            </button>
                            <button
                                onClick={() => setMonthlyFilterStatus('active')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    monthlyFilterStatus === 'active' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                有记录 ({activeLorriesCount})
                            </button>
                            <button
                                onClick={() => setMonthlyFilterStatus('no-logs')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    monthlyFilterStatus === 'no-logs' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                无记录 ({totalTrackedLorries - activeLorriesCount})
                            </button>
                            {discrepanciesCount > 0 && (
                                <button
                                    onClick={() => setMonthlyFilterStatus('discrepancy')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        monthlyFilterStatus === 'discrepancy' ? 'bg-red-600 text-white shadow' : 'text-red-400 hover:text-red-300'
                                    }`}
                                >
                                    异常 ({discrepanciesCount})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Main Monthly Odometer Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-2xl">
                        {loadingMonthly ? (
                            <div className="text-center py-24 text-slate-500 font-bold uppercase tracking-widest animate-pulse flex flex-col items-center gap-3">
                                <RefreshCw size={24} className="animate-spin text-blue-500" />
                                正在拉取 {selectedOdoYear}年{selectedOdoMonth}月 完整里程日志...
                            </div>
                        ) : filteredMonthlySummaries.length === 0 ? (
                            <div className="text-center py-20 text-slate-500 font-bold text-sm tracking-wide">
                                未找到匹配的罗里里程数据
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left align-middle text-slate-300">
                                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800 font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">罗里车牌 (Lorry Plate)</th>
                                            <th className="px-6 py-4">主司机 (Driver)</th>
                                            <th className="px-6 py-4">🟢 月初起步里程 (Start ODO)</th>
                                            <th className="px-6 py-4">🔴 月末/最新里程 (End ODO)</th>
                                            <th className="px-6 py-4 text-center">🛣️ 全月净行驶 (Net KM)</th>
                                            <th className="px-6 py-4 text-center">打卡次数</th>
                                            <th className="px-6 py-4 text-center">数据状态</th>
                                            <th className="px-6 py-4 text-center">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {filteredMonthlySummaries.map((s) => (
                                            <tr key={s.normalizedPlate} className="hover:bg-slate-950/40 transition-colors">
                                                {/* Plate */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                                                            <Truck size={20} />
                                                        </div>
                                                        <div>
                                                            <span className="text-base font-black text-white uppercase tracking-tight block">
                                                                {s.plate_number}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                                                <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{s.preferred_zone}</span>
                                                                <span className={`px-1.5 py-0.5 rounded font-bold ${
                                                                    s.status === 'Available' ? 'text-emerald-400' :
                                                                    s.status === 'On-Route' ? 'text-blue-400' : 'text-amber-400'
                                                                }`}>
                                                                    {s.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Driver */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                                            <User size={13} />
                                                        </div>
                                                        <span className="font-bold text-slate-200 text-xs sm:text-sm">
                                                            {s.activeDriver}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Start ODO */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {s.startLog ? (
                                                        <div className="flex items-center gap-3">
                                                            {s.startLog.photo_url ? (
                                                                <div
                                                                    onClick={() => setPreviewImageUrl(s.startLog.photo_url)}
                                                                    className="relative w-12 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 cursor-zoom-in group shrink-0"
                                                                    title="点击查看打卡仪表盘照片"
                                                                >
                                                                    <img src={s.startLog.photo_url} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-all" alt="Start ODO" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white">
                                                                        <Eye size={12} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-12 h-10 rounded-lg bg-slate-950/60 border border-slate-800/60 flex items-center justify-center text-slate-600 shrink-0">
                                                                    <ImageIcon size={14} />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="text-base font-black text-emerald-400 font-mono tracking-tight block">
                                                                    {s.startLog.mileage.toLocaleString()} <span className="text-[10px] text-slate-500 font-sans font-normal">km</span>
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                                                                    {s.startLog.timeFormatted} ({s.startLog.driverName})
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 font-mono font-bold">—</span>
                                                    )}
                                                </td>

                                                {/* End ODO */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {s.endLog ? (
                                                        <div className="flex items-center gap-3">
                                                            {s.endLog.photo_url ? (
                                                                <div
                                                                    onClick={() => setPreviewImageUrl(s.endLog.photo_url)}
                                                                    className="relative w-12 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 cursor-zoom-in group shrink-0"
                                                                    title="点击查看打卡仪表盘照片"
                                                                >
                                                                    <img src={s.endLog.photo_url} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-all" alt="End ODO" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white">
                                                                        <Eye size={12} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-12 h-10 rounded-lg bg-slate-950/60 border border-slate-800/60 flex items-center justify-center text-slate-600 shrink-0">
                                                                    <ImageIcon size={14} />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="text-base font-black text-blue-400 font-mono tracking-tight block">
                                                                    {s.endLog.mileage.toLocaleString()} <span className="text-[10px] text-slate-500 font-sans font-normal">km</span>
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                                                                    {s.endLog.timeFormatted} ({s.endLog.driverName})
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 font-mono font-bold">—</span>
                                                    )}
                                                </td>

                                                {/* Net Distance */}
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {s.diff !== null ? (
                                                        s.isDiscrepancy ? (
                                                            <div className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-xl text-xs font-black font-mono">
                                                                <AlertTriangle size={13} />
                                                                {s.diff.toLocaleString()} km
                                                            </div>
                                                        ) : (
                                                            <span className="text-base font-black text-white font-mono">
                                                                +{s.diff.toLocaleString()} <span className="text-[10px] text-slate-500 font-sans font-normal">km</span>
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-slate-600 font-mono font-bold">—</span>
                                                    )}
                                                </td>

                                                {/* Logs Count */}
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
                                                        s.logCount > 0 ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'text-slate-600'
                                                    }`}>
                                                        {s.logCount} 次
                                                    </span>
                                                </td>

                                                {/* Status Badge */}
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {s.logCount === 0 ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-800/60 text-slate-500 border border-slate-800">
                                                            无记录
                                                        </span>
                                                    ) : s.isDiscrepancy ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                                                            <AlertTriangle size={11} /> 读数异常
                                                        </span>
                                                    ) : selectedOdoMonth === currentRealMonth ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                            运行中
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            <CheckCircle2 size={11} /> 已完成
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => setTimelineModalLorry(s)}
                                                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all font-bold text-xs flex items-center gap-1"
                                                            title="查看该车当月全部打卡流水"
                                                        >
                                                            <Eye size={13} />
                                                            <span className="hidden xl:inline">流水</span>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setCalibrationModalLorry(s);
                                                                setCalibrationData({
                                                                    mileage: s.endLog?.mileage ? String(s.endLog.mileage) : '',
                                                                    log_type: 'end',
                                                                    date: `${selectedOdoYear}-${String(selectedOdoMonth).padStart(2, '0')}-${String(new Date(selectedOdoYear, selectedOdoMonth, 0).getDate()).padStart(2, '0')}T18:00`,
                                                                    notes: '管理员校准里程'
                                                                });
                                                            }}
                                                            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all font-bold text-xs flex items-center gap-1 border border-blue-500/20"
                                                            title="校准/补录起止里程"
                                                        >
                                                            <SlidersHorizontal size={13} />
                                                            <span className="hidden xl:inline">校准</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: MILEAGE ALERTS & LOGS */}
            {activeTab === 'mileage' && (
                <div className="space-y-6">
                    {/* Mobile Sub-tabs switch */}
                    <div className="flex lg:hidden gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
                        <button
                            onClick={() => setOdoSubTab('alerts')}
                            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                                odoSubTab === 'alerts'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <AlertTriangle size={14} />
                            
                                                            {t('Abnormal warning (')}{mileageAlerts.filter(a => !a.resolved).length})
                        </button>
                        <button
                            onClick={() => setOdoSubTab('logs')}
                            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                                odoSubTab === 'logs'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <FileText size={14} />
                            
                                                            {t('mileage log (')}{mileageLogs.length})
                        </button>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-3">
                        {/* Active Alerts Panel */}
                        <div className={`lg:col-span-1 space-y-6 ${odoSubTab === 'alerts' ? 'block' : 'hidden lg:block'}`}>
                            <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                                <h2 className="text-base sm:text-lg font-black uppercase text-white tracking-wider flex items-center gap-2">
                                    <AlertTriangle className="text-red-500 animate-pulse shrink-0" size={20} />
                                    
                                                                            {t('Abnormal warning/Alerts')}
                                                                        </h2>
                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider">
                                    {(() => {
                                        const activeAlerts = mileageAlerts.filter(a => !a.resolved && (selectedLorryPlate === 'All' || a.lorries?.plate_number === selectedLorryPlate));
                                        return `${activeAlerts.length} Active`;
                                    })()}
                                </span>
                            </div>

                            {(() => {
                                const activeAlerts = mileageAlerts.filter(a => !a.resolved && (selectedLorryPlate === 'All' || a.lorries?.plate_number === selectedLorryPlate));
                                
                                if (activeAlerts.length === 0) {
                                    return (
                                        <div className="bg-slate-900/30 border border-slate-800/80 rounded-[32px] p-8 text-center text-slate-500 font-bold uppercase text-xs tracking-widest">
                                            
                                                                                        {t('✅ No pending exception alerts / No active alerts!')}
                                                                                    </div>
                                    );
                                }

                                const totalAlertPages = Math.ceil(activeAlerts.length / ALERTS_PER_PAGE) || 1;
                                const safeAlertPage = Math.min(alertsPage, totalAlertPages);
                                const paginatedAlerts = activeAlerts.slice((safeAlertPage - 1) * ALERTS_PER_PAGE, safeAlertPage * ALERTS_PER_PAGE);

                                return (
                                    <div className="space-y-4">
                                        {paginatedAlerts.map((alertItem) => (
                                            <div key={alertItem.id} className="bg-slate-900 border-2 border-red-500/30 rounded-[24px] p-5 space-y-4 shadow-lg shadow-red-950/5 relative overflow-hidden transition-all hover:border-red-500/50">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="text-xl font-black text-white tracking-tighter uppercase">{alertItem.lorries?.plate_number}</h4>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                                            Driver: <span className="text-slate-200">{alertItem.driver?.name || alertItem.driver?.email}</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                            Diff: {alertItem.difference > 0 ? `+${alertItem.difference}` : alertItem.difference} km
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 text-center">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Expected Mileage</p>
                                                        <p className="text-md font-bold font-mono text-slate-300 mt-1">{alertItem.expected_mileage} km</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Logged Mileage</p>
                                                        <p className="text-md font-bold font-mono text-red-400 mt-1">{alertItem.logged_mileage} km</p>
                                                    </div>
                                                </div>

                                                {alertItem.photo_url && (
                                                    <div 
                                                        onClick={() => setPreviewImageUrl(alertItem.photo_url)}
                                                        className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-zoom-in group"
                                                    >
                                                        <img src={alertItem.photo_url} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-all" alt="Odometer" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1.5 text-xs font-bold text-white">
                                                            <ImageIcon size={18} />  {t('View Photo / View Photo')}
                                                                                                                    </div>
                                                    </div>
                                                )}

                                                {resolvingAlertId === alertItem.id ? (
                                                    <div className="space-y-3 pt-2">
                                                        <textarea
                                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-blue-500 outline-none resize-none h-20"
                                                            placeholder={t('Enter processing instructions (example: checked against delivery note)...')}
                                                            value={resolveNotes}
                                                            onChange={(e) => setResolveNotes(e.target.value)}
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setResolvingAlertId(null)}
                                                                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-slate-800 min-h-[40px]"
                                                            >
                                                                
                                                                                                                                {t('Cancel/Cancel')}
                                                                                                                            </button>
                                                            <button
                                                                onClick={() => handleResolveAlert(alertItem.id)}
                                                                disabled={isResolving}
                                                                className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-blue-950/30 min-h-[40px]"
                                                            >
                                                                {isResolving ? t('Submitting...') : t('Confirm resolution/Resolve')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setResolvingAlertId(alertItem.id)}
                                                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-red-500/20 min-h-[44px]"
                                                    >
                                                        <Check size={14} />
                                                        
                                                                                                                    {t('Handle this exception / Resolve Discrepancy')}
                                                                                                                </button>
                                                )}

                                                <div className="text-[9px] text-slate-500 text-right">
                                                    
                                                                                                        {t('time:')} {new Date(alertItem.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Alerts Pagination Controls */}
                                        {totalAlertPages > 1 && (
                                            <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
                                                <button
                                                    disabled={alertsPage <= 1}
                                                    onClick={() => setAlertsPage(prev => Math.max(1, prev - 1))}
                                                    className="p-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl border border-slate-800 flex items-center gap-1 text-[11px] font-bold"
                                                >
                                                    <ChevronLeft size={14} />  {t('term_1')}
                                                                                                    </button>
                                                <span className="font-bold text-slate-400 text-[11px]">
                                                    {alertsPage} / {totalAlertPages}
                                                </span>
                                                <button
                                                    disabled={alertsPage >= totalAlertPages}
                                                    onClick={() => setAlertsPage(prev => Math.min(totalAlertPages, prev + 1))}
                                                    className="p-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl border border-slate-800 flex items-center gap-1 text-[11px] font-bold"
                                                >
                                                    
                                                                                                        {t('term_2')} <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Logs History Panel */}
                        <div className={`lg:col-span-2 space-y-6 ${odoSubTab === 'logs' ? 'block' : 'hidden lg:block'}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                            <h2 className="text-base sm:text-lg font-black uppercase text-white tracking-wider flex items-center gap-2">
                                <FileText className="text-blue-500 shrink-0" size={20} />
                                
                                                                        {t('Mileage Logs and Resolution Records / Mileage Logs')}
                                                                    </h2>
                            <div className="flex items-center gap-2 flex-wrap">
                                <select
                                    value={selectedLorryPlate}
                                    onChange={(e) => {
                                        setSelectedLorryPlate(e.target.value);
                                        setLogsPage(1);
                                    }}
                                    className="bg-slate-950 border border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-300 rounded-xl px-3 py-2 focus:border-blue-500/50 outline-none cursor-pointer min-h-[40px]"
                                >
                                    <option value="All">{t('All Lorries')}</option>
                                    {lorries.map(l => (
                                        <option key={l.id} value={l.plate_number}>{l.plate_number}</option>
                                    ))}
                                </select>
                                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-2.5 py-2 rounded-xl uppercase tracking-wider whitespace-nowrap border border-blue-500/20">
                                    {(() => {
                                        const count = selectedLorryPlate === 'All' 
                                            ? mileageLogs.length 
                                            : mileageLogs.filter(log => log.lorries?.plate_number === selectedLorryPlate).length;
                                        return `${count} Logs`;
                                    })()}
                                </span>
                                <button
                                    onClick={handleExportExcel}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black px-3.5 py-2 rounded-xl uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 active:scale-95 min-h-[40px]"
                                    title="Export Odometer Report as Excel Sheet"
                                >
                                    <FileSpreadsheet size={14} />  {t('Export / Export Sheet (.xlsx)')}
                                                                            </button>
                            </div>
                        </div>

                        {/* Combined Table/Timeline */}
                        <div className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left align-middle text-slate-400">
                                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800 font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">{t('Time / Timestamp')}</th>
                                            <th className="px-6 py-4">{t('License Plate / Lorry Plate')}</th>
                                            <th className="px-6 py-4">{t('Driver / Driver')}</th>
                                            <th className="px-6 py-4">{t('Type / Type')}</th>
                                            <th className="px-6 py-4 text-center">{t('Reading/Mileage')}</th>
                                            <th className="px-6 py-4 text-center">{t('Photo / Photo')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {(() => {
                                            const filteredLogs = selectedLorryPlate === 'All' 
                                                ? mileageLogs 
                                                : mileageLogs.filter(log => log.lorries?.plate_number === selectedLorryPlate);
                                            
                                            if (filteredLogs.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-600 font-bold uppercase tracking-widest">
                                                            
                                                                                                                        {t('No mileage logs found.')}
                                                                                                                    </td>
                                                    </tr>
                                                );
                                            }

                                            const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE) || 1;
                                            const safePage = Math.min(logsPage, totalPages);
                                            const paginatedLogs = filteredLogs.slice((safePage - 1) * LOGS_PER_PAGE, safePage * LOGS_PER_PAGE);

                                            return paginatedLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-950/35 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-400">
                                                        {new Date(log.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-white font-black uppercase tracking-tighter">
                                                        {log.lorries?.plate_number}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-300">
                                                        {log.driver?.name || log.driver?.email}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${log.log_type === 'start' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                                            {log.log_type === 'start' ? t('Start Shift') : t('End Shift')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center font-mono font-bold text-slate-200">
                                                        {log.mileage != null ? Number(log.mileage) : (log.mileage_km != null ? Number(log.mileage_km) : 0)} km
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {log.photo_url ? (
                                                            <button 
                                                                onClick={() => setPreviewImageUrl(log.photo_url)}
                                                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all inline-flex items-center gap-1 text-xs"
                                                                title={t('View Photo / View Photo')}
                                                            >
                                                                <ImageIcon size={14} />
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {(() => {
                                const filteredLogs = selectedLorryPlate === 'All' 
                                    ? mileageLogs 
                                    : mileageLogs.filter(log => log.lorries?.plate_number === selectedLorryPlate);
                                const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE) || 1;
                                if (filteredLogs.length <= LOGS_PER_PAGE) return null;

                                return (
                                    <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-t border-slate-800 text-xs">
                                        <div className="text-slate-400 font-medium">
                                            
                                                                                        {t('show')} {(logsPage - 1) * LOGS_PER_PAGE + 1} - {Math.min(logsPage * LOGS_PER_PAGE, filteredLogs.length)}  {t('Articles (Total')} {filteredLogs.length}  {t('strip)')}
                                                                                    </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={logsPage <= 1}
                                                onClick={() => setLogsPage(prev => Math.max(1, prev - 1))}
                                                className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-lg border border-slate-800 flex items-center gap-1 text-[11px] font-bold"
                                            >
                                                <ChevronLeft size={16} />  {t('Previous Page / Prev')}
                                                                                            </button>
                                            <span className="font-bold text-slate-300 px-2">
                                                {logsPage} / {totalPages}
                                            </span>
                                            <button
                                                disabled={logsPage >= totalPages}
                                                onClick={() => setLogsPage(prev => Math.min(totalPages, prev + 1))}
                                                className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-lg border border-slate-800 flex items-center gap-1 text-[11px] font-bold"
                                            >
                                                
                                                                                                {t('Next page / Next')} <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Resolved Alerts Section */}
                        {(() => {
                            const filteredAlerts = mileageAlerts.filter(a => a.resolved && (selectedLorryPlate === 'All' || a.lorries?.plate_number === selectedLorryPlate));
                            if (filteredAlerts.length === 0) return null;
                            return (
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest text-slate-400">Resolved Alerts History</h3>
                                    <div className="space-y-3">
                                        {filteredAlerts.map((alertItem) => (
                                            <div key={alertItem.id} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-white uppercase">{alertItem.lorries?.plate_number}</span>
                                                        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Resolved</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500">
                                                        Driver: <span className="text-slate-400 font-bold">{alertItem.driver?.name || alertItem.driver?.email}</span> | Expected: {alertItem.expected_mileage}km | Logged: {alertItem.logged_mileage}km (Diff: {alertItem.difference}km)
                                                    </p>
                                                    <p className="text-[11px] text-emerald-400 font-medium italic mt-1 bg-emerald-500/[0.02] border-l-2 border-emerald-500/30 pl-2">
                                                        Notes: "{alertItem.resolved_notes}" — by {alertItem.resolver?.name || alertItem.resolver?.email}
                                                    </p>
                                                </div>
                                                {alertItem.photo_url && (
                                                    <button 
                                                        onClick={() => setPreviewImageUrl(alertItem.photo_url)}
                                                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all self-end md:self-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                                    >
                                                        <ImageIcon size={12} /> View Photo
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        )}

            {/* TIMELINE DRILLDOWN MODAL */}
            {timelineModalLorry && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setTimelineModalLorry(null)} />
                    <div className="relative bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[32px] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 text-slate-200">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight">{timelineModalLorry.plate_number}</h2>
                                        <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            {selectedOdoYear}年{selectedOdoMonth}月打卡明细
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                        共计 {timelineModalLorry.logs.length} 条打卡记录 (月初起步: {timelineModalLorry.startLog ? `${timelineModalLorry.startLog.mileage.toLocaleString()} km` : '无'} → 月末/最新: {timelineModalLorry.endLog ? `${timelineModalLorry.endLog.mileage.toLocaleString()} km` : '无'})
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setTimelineModalLorry(null)}
                                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Logs timeline list */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                            {timelineModalLorry.logs.length === 0 ? (
                                <div className="text-center py-16 text-slate-500 font-bold text-xs uppercase tracking-widest">
                                    该车辆在 {selectedOdoYear}年{selectedOdoMonth}月 尚无任何里程打卡记录
                                </div>
                            ) : (
                                timelineModalLorry.logs.map((item, idx) => (
                                    <div key={item.id || idx} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                                item.log_type === 'start'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}>
                                                {item.log_type === 'start' ? '🟢 上班起步' : '🔴 下班交车'}
                                            </span>
                                            <div>
                                                <div className="text-base font-black text-white font-mono">
                                                    {(item.mileage != null ? Number(item.mileage) : (item.mileage_km != null ? Number(item.mileage_km) : 0)).toLocaleString()} <span className="text-xs font-sans text-slate-500">km</span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                                                    <span>{new Date(item.created_at).toLocaleString('zh-CN')}</span>
                                                    <span>•</span>
                                                    <span>司机: {item.driver?.name || item.driver?.email || '未记录'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {item.photo_url && (
                                            <button
                                                onClick={() => setPreviewImageUrl(item.photo_url)}
                                                className="relative w-14 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 cursor-zoom-in group shrink-0"
                                                title="放大查看照片"
                                            >
                                                <img src={item.photo_url} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-all" alt="Odometer" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white">
                                                    <Eye size={14} />
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={() => setTimelineModalLorry(null)}
                                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CALIBRATION / MANUAL OVERRIDE MODAL */}
            {calibrationModalLorry && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setCalibrationModalLorry(null)} />
                    <div className="relative bg-slate-900 border border-slate-800 w-full max-w-md rounded-[32px] p-6 sm:p-8 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 text-slate-200">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                                    <SlidersHorizontal size={22} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-tight">校准/补录里程</h2>
                                    <p className="text-xs text-slate-400 font-bold">{calibrationModalLorry.plate_number}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setCalibrationModalLorry(null)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCalibration} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">打卡类型 (Log Type)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCalibrationData({ ...calibrationData, log_type: 'start' })}
                                        className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all ${
                                            calibrationData.log_type === 'start'
                                                ? 'bg-emerald-600 text-white shadow-md'
                                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                                        }`}
                                    >
                                        🟢 月初起步打卡 (Start)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCalibrationData({ ...calibrationData, log_type: 'end' })}
                                        className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all ${
                                            calibrationData.log_type === 'end'
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                                        }`}
                                    >
                                        🔴 月末结束打卡 (End)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">里程仪表读数 (KM)</label>
                                <input
                                    required
                                    type="number"
                                    placeholder="例如 84286"
                                    value={calibrationData.mileage}
                                    onChange={(e) => setCalibrationData({ ...calibrationData, mileage: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white font-mono font-bold text-base focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">记录时间 (Timestamp)</label>
                                <input
                                    required
                                    type="datetime-local"
                                    value={calibrationData.date}
                                    onChange={(e) => setCalibrationData({ ...calibrationData, date: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold text-xs focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">校准说明/备注</label>
                                <input
                                    type="text"
                                    placeholder="例如：修正司机误录数字 / 月初补录"
                                    value={calibrationData.notes}
                                    onChange={(e) => setCalibrationData({ ...calibrationData, notes: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setCalibrationModalLorry(null)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingCalibration}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30"
                                >
                                    {isSavingCalibration ? '保存中...' : '确认保存'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-[#1a1a1e] border border-slate-800 w-full max-w-lg rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-8 flex items-center gap-3">
                            {editingLorry ? <Edit2 className="text-blue-500" /> : <Plus className="text-blue-500" />}
                            {editingLorry ? 'Edit Lorry' : 'Add New Lorry'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Plate Number</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold tracking-widest uppercase focus:border-blue-500 outline-none"
                                    placeholder="VAA 1234"
                                    value={formData.plate_number}
                                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Zone</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none"
                                        value={formData.preferred_zone}
                                        onChange={(e) => setFormData({ ...formData, preferred_zone: e.target.value })}
                                    >
                                        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Status</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Max Volume (m³)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.0001"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none font-mono"
                                        placeholder="36.81"
                                        value={formData.max_volume_m3}
                                        onChange={(e) => setFormData({ ...formData, max_volume_m3: parseFloat(e.target.value) || 0 })}
                                    />
                                    <span className="text-[9px] text-slate-500 mt-1 block font-medium">
                                        ~{Math.round((formData.max_volume_m3 || 0) / 0.4489)} rolls bubblewrap
                                    </span>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Max Weight (kg)</label>
                                    <input
                                        required
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none font-mono"
                                        placeholder="3000"
                                        value={formData.max_weight_kg}
                                        onChange={(e) => setFormData({ ...formData, max_weight_kg: parseInt(e.target.value, 10) || 0 })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Assigned Driver (Optional)</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none"
                                    value={formData.driver_id}
                                    onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                                >
                                    <option value="">Unassigned</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name || d.email}</option>)}
                                </select>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-400 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-2 bg-blue-600 hover:bg-blue-500 text-white p-4 px-12 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-900/20"
                                >
                                    {editingLorry ? 'Update Lorry' : 'Save Lorry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Print QR Modal */}
            {isQrModalOpen && editingLorry && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsQrModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
                        {/* Printable Area */}
                        <div id="print-qr-area" className="flex flex-col items-center bg-white p-6 rounded-3xl w-full text-center print-exact">
                            <Truck size={48} className="text-blue-600 mb-2" />
                            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">
                                {editingLorry.plate_number}
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-8">Scan to Bind Lorry</p>
                            
                            <div className="bg-white p-4 rounded-3xl border-4 border-slate-900 shadow-xl inline-block mb-8 object-contain">
                                <QRCode 
                                    value={JSON.stringify({ type: 'LorryBind', lorryId: editingLorry.id, plate: editingLorry.plate_number })} 
                                    size={200}
                                    level="H"
                                    fgColor="#0f172a"
                                />
                            </div>
                        </div>

                        {/* Actions (Not Printed) */}
                        <div className="flex gap-4 w-full mt-2 print:hidden">
                            <button
                                onClick={() => setIsQrModalOpen(false)}
                                className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all shrink-0"
                            >
                                <X size={20} />
                            </button>
                            <button
                                onClick={() => {
                                    const printContent = document.getElementById('print-qr-area');
                                    const originalContents = document.body.innerHTML;
                                    if(printContent) {
                                        document.body.innerHTML = printContent.innerHTML;
                                        window.print();
                                        document.body.innerHTML = originalContents;
                                        window.location.reload(); // Reload to restore React bindings after brutal DOM manipulation
                                    }
                                }}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                <Printer size={18} /> Print Sticker
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImageUrl && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImageUrl(null)}
                >
                    <button 
                        onClick={() => setPreviewImageUrl(null)} 
                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>
                    <img 
                        src={previewImageUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200" 
                        onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-4">
                        Click anywhere to close
                    </p>
                </div>
            )}

            {/* Monthly Odometer Summary Modal */}
            {isMonthlyOdoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMonthlyOdoModalOpen(false)} />
                    <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 text-slate-200">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                                    <FileSpreadsheet size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-wider">Laporan Odometer Bulanan</h2>
                                    <p className="text-xs text-slate-400 font-semibold">Monthly Odometer Summary & Export Sheet</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsMonthlyOdoModalOpen(false)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Month & Year Selectors */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Bulan / Month</label>
                                <select
                                    value={selectedOdoMonth}
                                    onChange={(e) => setSelectedOdoMonth(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold outline-none focus:border-emerald-500 cursor-pointer"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                        <option key={m} value={m}>Bulan {m} ({new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tahun / Year</label>
                                <select
                                    value={selectedOdoYear}
                                    onChange={(e) => setSelectedOdoYear(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold outline-none focus:border-emerald-500 cursor-pointer"
                                >
                                    {[2025, 2026, 2027].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Text Preview Box matching user screenshot */}
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase">Format Teks Ringkasan (Text Format Preview)</label>
                                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">1/{selectedOdoMonth} ODO ____ , {new Date(selectedOdoYear, selectedOdoMonth, 0).getDate()}/{selectedOdoMonth} ODO ____</span>
                            </div>
                            <textarea
                                readOnly
                                value={getFormattedSummaryText()}
                                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-400 focus:outline-none resize-none leading-relaxed"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2 border-t border-slate-800">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(getFormattedSummaryText());
                                    setCopySuccess(true);
                                    setTimeout(() => setCopySuccess(false), 2000);
                                }}
                                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <FileText size={16} />
                                {copySuccess ? '✓ Copied to Clipboard!' : 'Salin Teks (Copy Text)'}
                            </button>
                            <button
                                onClick={handleGenerateMonthlyOdometerReport}
                                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
                            >
                                <FileSpreadsheet size={16} />
                                Muat Turun Sheet (.xlsx)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LorryManagement;
