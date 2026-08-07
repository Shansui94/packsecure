
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Truck, Plus, Trash2, Edit2, Search, User, MapPin, QrCode as QrIcon, Printer, X, AlertTriangle, Check, FileText, Image as ImageIcon, FileSpreadsheet, LayoutGrid, Table as TableIcon, ChevronLeft, ChevronRight } from 'lucide-react';
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

    // Odometer Logs & Alerts State
    const [activeTab, setActiveTab] = useState<'fleet' | 'mileage'>('fleet');
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
    const [selectedOdoMonth, setSelectedOdoMonth] = useState<number>(7); // Default July or current month
    const [selectedOdoYear, setSelectedOdoYear] = useState<number>(2026);
    const [copySuccess, setCopySuccess] = useState(false);

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

    const handleGenerateMonthlyOdometerReport = () => {
        const lastDayObj = new Date(selectedOdoYear, selectedOdoMonth, 0);
        const lastDay = lastDayObj.getDate();

        const firstDayStr = `${selectedOdoYear}-${String(selectedOdoMonth).padStart(2, '0')}-01`;
        const lastDayStr = `${selectedOdoYear}-${String(selectedOdoMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const defaultPlates = [
            "ANW9821", "ANX9821", "APD9821", "APH9821", "BSQ9821", 
            "DFK9821", "JYH9821", "KGG9821", "NEH9821", "PETRA9821", 
            "RAU9821", "RBC9821", "TDE9821", "VPC9821"
        ];

        const allDbPlates = lorries.map(l => (l.plate_number || '').trim().toUpperCase()).filter(Boolean);
        const mergedPlates = Array.from(new Set([...defaultPlates, ...allDbPlates])).sort();

        const monthLogs = mileageLogs.filter(log => {
            const logDate = log.created_at.split('T')[0];
            return logDate >= firstDayStr && logDate <= lastDayStr;
        });

        const summaryRows: any[] = [];
        const textLines: string[] = [];

        mergedPlates.forEach(plate => {
            const plateLogs = monthLogs.filter(log => {
                const logPlate = (log.lorries?.plate_number || '').trim().toUpperCase();
                return logPlate === plate;
            });

            plateLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const startLog = plateLogs.length > 0 ? (plateLogs[0].mileage != null ? plateLogs[0].mileage : plateLogs[0].mileage_km) : null;
            const endLog = plateLogs.length > 0 ? (plateLogs[plateLogs.length - 1].mileage != null ? plateLogs[plateLogs.length - 1].mileage : plateLogs[plateLogs.length - 1].mileage_km) : null;

            const startStr = startLog != null ? String(startLog) : '________';
            const endStr = endLog != null ? String(endLog) : '________';

            const distanceTraveled = (startLog != null && endLog != null && Number(endLog) >= Number(startLog)) 
                ? (Number(endLog) - Number(startLog)) 
                : '-';

            const formattedSummary = `${plate}: 1/${selectedOdoMonth} ODO ${startStr} , ${lastDay}/${selectedOdoMonth} ODO ${endStr}`;
            textLines.push(formattedSummary);

            summaryRows.push({
                'No. Plate Lori / Lorry Plate': plate,
                [`1/${selectedOdoMonth} ODO (Awal Bulan / Start)`]: startLog != null ? startLog : '_____',
                [`${lastDay}/${selectedOdoMonth} ODO (Akhir Bulan / End)`]: endLog != null ? endLog : '_____',
                'Jumlah Jarak / Distance (KM)': distanceTraveled,
                'Format Ringkasan Teks': formattedSummary
            });
        });

        const ws = XLSX.utils.json_to_sheet(summaryRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `ODO Bulanan ${selectedOdoMonth}-${selectedOdoYear}`);

        ws['!cols'] = [
            { wch: 18 },
            { wch: 22 },
            { wch: 22 },
            { wch: 20 },
            { wch: 45 }
        ];

        const fileName = `Ringkasan_Odometer_Bulanan_${selectedOdoYear}_Bulan_${String(selectedOdoMonth).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getFormattedSummaryText = () => {
        const lastDayObj = new Date(selectedOdoYear, selectedOdoMonth, 0);
        const lastDay = lastDayObj.getDate();

        const firstDayStr = `${selectedOdoYear}-${String(selectedOdoMonth).padStart(2, '0')}-01`;
        const lastDayStr = `${selectedOdoYear}-${String(selectedOdoMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const defaultPlates = [
            "ANW9821", "ANX9821", "APD9821", "APH9821", "BSQ9821", 
            "DFK9821", "JYH9821", "KGG9821", "NEH9821", "PETRA9821", 
            "RAU9821", "RBC9821", "TDE9821", "VPC9821"
        ];

        const allDbPlates = lorries.map(l => (l.plate_number || '').trim().toUpperCase()).filter(Boolean);
        const mergedPlates = Array.from(new Set([...defaultPlates, ...allDbPlates])).sort();

        const monthLogs = mileageLogs.filter(log => {
            const logDate = log.created_at.split('T')[0];
            return logDate >= firstDayStr && logDate <= lastDayStr;
        });

        return mergedPlates.map(plate => {
            const plateLogs = monthLogs.filter(log => {
                const logPlate = (log.lorries?.plate_number || '').trim().toUpperCase();
                return logPlate === plate;
            });
            plateLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const startLog = plateLogs.length > 0 ? (plateLogs[0].mileage != null ? plateLogs[0].mileage : plateLogs[0].mileage_km) : null;
            const endLog = plateLogs.length > 0 ? (plateLogs[plateLogs.length - 1].mileage != null ? plateLogs[plateLogs.length - 1].mileage : plateLogs[plateLogs.length - 1].mileage_km) : null;

            const startStr = startLog != null ? String(startLog) : '________';
            const endStr = endLog != null ? String(endLog) : '________';

            return `${plate}: 1/${selectedOdoMonth} ODO ${startStr} , ${lastDay}/${selectedOdoMonth} ODO ${endStr}`;
        }).join('\n');
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
                        {t('管理车队车辆、分配司机与里程日志')}
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
                    <button
                        onClick={() => setIsMonthlyOdoModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-2.5 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[11px] sm:text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40 min-h-[44px]"
                        title={t('月度总结')}
                    >
                        <FileText size={16} className="shrink-0" />
                        <span className="truncate">{t('月度总结')}</span>
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

            {activeTab === 'fleet' ? (
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
                                title="Table View / 表格视图"
                            >
                                <TableIcon size={16} />
                                <span className="hidden sm:inline">表格 / Table</span>
                            </button>
                        </div>
                    </div>

                    {/* Content View: Grid vs Table */}
                    {loading ? (
                        <div className="text-center py-20 text-slate-500 animate-pulse uppercase font-black tracking-widest">加载车队数据中 / Loading fleet data...</div>
                    ) : filteredLorries.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/30 rounded-[32px] border-2 border-dashed border-slate-800 text-slate-500 uppercase font-black tracking-widest">
                            暂无货车数据 / No lorries found.
                        </div>
                    ) : viewMode === 'table' ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left align-middle text-slate-300">
                                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800 font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">车牌号 / Lorry Plate</th>
                                            <th className="px-6 py-4">主司机 / Driver</th>
                                            <th className="px-6 py-4">出车区域 / Zone</th>
                                            <th className="px-6 py-4">状态 / Status</th>
                                            <th className="px-6 py-4 text-right">最大体积 / Vol (m³)</th>
                                            <th className="px-6 py-4 text-right">最大载重 / Weight (kg)</th>
                                            <th className="px-6 py-4 text-center">操作 / Actions</th>
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
                                                        <span className="font-bold text-slate-200">{lorry.driver_name || '未分配 / Unassigned'}</span>
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
                                                            title="Edit / 编辑"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintQR(lorry)}
                                                            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all font-bold text-xs"
                                                            title="Print QR / 打印二维码"
                                                        >
                                                            <QrIcon size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(lorry.id, lorry.plate_number)}
                                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
                                                            title="Delete / 删除"
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
            ) : (
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
                            异常预警 ({mileageAlerts.filter(a => !a.resolved).length})
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
                            里程日志 ({mileageLogs.length})
                        </button>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-3">
                        {/* Active Alerts Panel */}
                        <div className={`lg:col-span-1 space-y-6 ${odoSubTab === 'alerts' ? 'block' : 'hidden lg:block'}`}>
                            <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                                <h2 className="text-base sm:text-lg font-black uppercase text-white tracking-wider flex items-center gap-2">
                                    <AlertTriangle className="text-red-500 animate-pulse shrink-0" size={20} />
                                    异常预警 / Alerts
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
                                            ✅ 暂无待处理异常预警 / No active alerts!
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
                                                            <ImageIcon size={18} /> 查看照片 / View Photo
                                                        </div>
                                                    </div>
                                                )}

                                                {resolvingAlertId === alertItem.id ? (
                                                    <div className="space-y-3 pt-2">
                                                        <textarea
                                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-blue-500 outline-none resize-none h-20"
                                                            placeholder="输入处理说明 (例如: 已与送货单核对)..."
                                                            value={resolveNotes}
                                                            onChange={(e) => setResolveNotes(e.target.value)}
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setResolvingAlertId(null)}
                                                                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-slate-800 min-h-[40px]"
                                                            >
                                                                取消 / Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => handleResolveAlert(alertItem.id)}
                                                                disabled={isResolving}
                                                                className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-blue-950/30 min-h-[40px]"
                                                            >
                                                                {isResolving ? '提交中...' : '确认解决 / Resolve'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setResolvingAlertId(alertItem.id)}
                                                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-red-500/20 min-h-[44px]"
                                                    >
                                                        <Check size={14} />
                                                        处理此异常 / Resolve Discrepancy
                                                    </button>
                                                )}

                                                <div className="text-[9px] text-slate-500 text-right">
                                                    时间: {new Date(alertItem.created_at).toLocaleString()}
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
                                                    <ChevronLeft size={14} /> 上一页
                                                </button>
                                                <span className="font-bold text-slate-400 text-[11px]">
                                                    {alertsPage} / {totalAlertPages}
                                                </span>
                                                <button
                                                    disabled={alertsPage >= totalAlertPages}
                                                    onClick={() => setAlertsPage(prev => Math.min(totalAlertPages, prev + 1))}
                                                    className="p-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl border border-slate-800 flex items-center gap-1 text-[11px] font-bold"
                                                >
                                                    下一页 <ChevronRight size={14} />
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
                                里程日志与解决记录 / Mileage Logs
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
                                    <option value="All">All Lorries (全部货车)</option>
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
                                    <FileSpreadsheet size={14} /> 导出 / Export Sheet (.xlsx)
                                </button>
                            </div>
                        </div>

                        {/* Combined Table/Timeline */}
                        <div className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left align-middle text-slate-400">
                                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800 font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">时间 / Timestamp</th>
                                            <th className="px-6 py-4">车牌 / Lorry Plate</th>
                                            <th className="px-6 py-4">司机 / Driver</th>
                                            <th className="px-6 py-4">类型 / Type</th>
                                            <th className="px-6 py-4 text-center">读数 / Mileage</th>
                                            <th className="px-6 py-4 text-center">照片 / Photo</th>
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
                                                            暂无里程日志记录 / No mileage logs found.
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
                                                            {log.log_type === 'start' ? 'Start Shift (开工)' : 'End Shift (完工)'}
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
                                                                title="查看照片 / View Photo"
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
                                            显示 {(logsPage - 1) * LOGS_PER_PAGE + 1} - {Math.min(logsPage * LOGS_PER_PAGE, filteredLogs.length)} 条 (共 {filteredLogs.length} 条)
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={logsPage <= 1}
                                                onClick={() => setLogsPage(prev => Math.max(1, prev - 1))}
                                                className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-lg border border-slate-800 flex items-center gap-1 text-[11px] font-bold"
                                            >
                                                <ChevronLeft size={16} /> 上一页 / Prev
                                            </button>
                                            <span className="font-bold text-slate-300 px-2">
                                                {logsPage} / {totalPages}
                                            </span>
                                            <button
                                                disabled={logsPage >= totalPages}
                                                onClick={() => setLogsPage(prev => Math.min(totalPages, prev + 1))}
                                                className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-lg border border-slate-800 flex items-center gap-1 text-[11px] font-bold"
                                            >
                                                下一页 / Next <ChevronRight size={16} />
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
