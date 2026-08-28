import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import { 
    Camera, 
    Image as ImageIcon, 
    Sparkles, 
    CheckCircle2, 
    Clock, 
    Layers, 
    Scale, 
    Zap, 
    AlertTriangle, 
    Send, 
    Loader, 
    X, 
    TrendingUp, 
    History,
    Calendar,
    ChevronRight,
    Play,
    Filter,
    RefreshCw
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { compressImage } from '../utils/imageCompress';
import { useTranslation } from 'react-i18next';

interface RecycleMachineControlProps {
    machineId: string;
    machineName: string;
    operatorId: string | null;
    operatorEmployeeId: string | null;
    operatorName: string | null;
    user: User | null;
    isControlMode: boolean;
    onTakeoverClick?: () => void;
}

interface RecycleBatchLog {
    id: string;
    created_at: string;
    timeLocal: string;
    dateStr: string;
    materialKey: string;
    materialLabel: string;
    materialColor: string;
    weight: number;
    intervalMinutes: number;
    downtimeReason?: string;
    operatorName: string;
    photoUrl?: string;
    userNote?: string;
}

const RECYCLE_MATERIALS = [
    { key: 'SF.W', sku: 'RM-REC-SFW', label: '白拉伸膜', sub: 'Stretch Film Clear/White', color: 'border-cyan-400 bg-cyan-500/10 text-cyan-300', dot: 'bg-cyan-400' },
    { key: 'SF.B', sku: 'RM-REC-SFB', label: '黑拉伸膜', sub: 'Stretch Film Black', color: 'border-slate-400 bg-slate-800/60 text-slate-200', dot: 'bg-slate-300' },
    { key: 'BW.W', sku: 'RM-REC-BWW', label: '白气泡膜', sub: 'Bubble Wrap White', color: 'border-emerald-400 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
    { key: 'BW.B', sku: 'RM-REC-BWB', label: '黑气泡膜', sub: 'Bubble Wrap Black', color: 'border-purple-400 bg-purple-500/10 text-purple-300', dot: 'bg-purple-400' },
    { key: 'MIX',  sku: 'RM-REC-MIX', label: '混合再生料', sub: 'Mixed Recycle Granules', color: 'border-amber-400 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' }
];

const DOWNTIME_REASONS = [
    '换网 / 清滤网 (Screen Change)',
    '待料 / 备料 (Waiting Raw Material)',
    '螺杆清理 / 排堵 (Screw Purge)',
    '用餐 / 休息 (Meal Break)',
    '机器调机 / 检修 (Maintenance)'
];

export const RecycleMachineControl: React.FC<RecycleMachineControlProps> = ({
    machineId,
    machineName,
    operatorId,
    operatorEmployeeId,
    operatorName,
    user,
    isControlMode,
    onTakeoverClick
}) => {
    const { t } = useTranslation();

    // Active Material Selection
    const [selectedMaterialKey, setSelectedMaterialKey] = useState<string>('SF.W');

    // Input States (default 15.0 KG for fast logging)
    const [weightInput, setWeightInput] = useState<string>('15.0');
    const [userNote, setUserNote] = useState<string>('');
    const [downtimeReason, setDowntimeReason] = useState<string>('');

    // Photo Capture States
    const [showWebcam, setShowWebcam] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isAiScanning, setIsAiScanning] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const webcamRef = useRef<Webcam>(null);

    // All Historical Logs & Filter
    const [logs, setLogs] = useState<RecycleBatchLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL'); // 'ALL' | 'TODAY' | 'YYYY-MM-DD'

    // Lightbox modal for photos
    const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

    // Fetch Logs for this Recycle Machine (Loads all historical logs)
    const fetchRecycleLogs = async () => {
        try {
            setLoadingLogs(true);
            const shortKey = machineId.split('-')[0].trim();

            const { data, error } = await supabase
                .from('work_photos')
                .select('*')
                .or(`machine_id.eq.${machineId},machine_id.eq.${shortKey},machine_id.ilike.${shortKey}-%`)
                .order('created_at', { ascending: true })
                .limit(500);

            if (error) throw error;

            if (data) {
                const parsedLogs: RecycleBatchLog[] = [];

                data.forEach((p, idx) => {
                    const note = (p.user_note || '').trim().toUpperCase();
                    const ai = p.ai_description || '';

                    // Match weight with high precision
                    let weight = 0;
                    if (p.ai_raw_json && p.ai_raw_json.weight && Number(p.ai_raw_json.weight) > 0) {
                        weight = parseFloat(p.ai_raw_json.weight);
                    } else {
                        const noteMatch = note.match(/([\d.]+)\s*KG/i) || note.match(/\|\s*([\d.]+)/);
                        if (noteMatch) {
                            weight = parseFloat(noteMatch[1]);
                        } else {
                            const aiMatch = ai.match(/读数(?:为|：|:)?\s*([\d.]+)/) ||
                                            ai.match(/([\d.]+)\s*(?:公斤|kg|KG)/i) || 
                                            ai.match(/重量(?:为|：|:)?\s*([\d.]+)/) || 
                                            ai.match(/数值\s*([\d.]+)/) || 
                                            ai.match(/显示\s*([\d.]+)/);
                            if (aiMatch) {
                                weight = parseFloat(aiMatch[1]);
                            }
                        }
                    }

                    // Match material
                    let matKey = 'SF.W';
                    if (note.includes('SF.B') || note.includes('SF B')) matKey = 'SF.B';
                    else if (note.includes('SF.W') || note.includes('SF W')) matKey = 'SF.W';
                    else if (note.includes('BW.W') || note.includes('BW W')) matKey = 'BW.W';
                    else if (note.includes('BW.B') || note.includes('BW B')) matKey = 'BW.B';
                    else if (note.includes('MIX')) matKey = 'MIX';

                    const matConfig = RECYCLE_MATERIALS.find(m => m.key === matKey) || RECYCLE_MATERIALS[0];

                    // Calculate interval from previous batch
                    let intervalMin = 0;
                    if (idx > 0) {
                        const prevTime = new Date(data[idx - 1].created_at).getTime();
                        const currTime = new Date(p.created_at).getTime();
                        intervalMin = Math.round((currTime - prevTime) / 60000);
                    }

                    const localDate = new Date(new Date(p.created_at).getTime() + 8 * 3600000);
                    const timeLocal = localDate.toISOString().substring(11, 16);
                    const dateStr = localDate.toISOString().substring(0, 10);

                    parsedLogs.push({
                        id: p.id,
                        created_at: p.created_at,
                        timeLocal,
                        dateStr,
                        materialKey: matKey,
                        materialLabel: matConfig.label,
                        materialColor: matConfig.color,
                        weight: weight > 0 ? weight : 14.5,
                        intervalMinutes: intervalMin,
                        downtimeReason: p.ai_raw_json?.downtimeReason,
                        operatorName: p.employee_name || 'Operator',
                        photoUrl: p.photo_url,
                        userNote: p.user_note
                    });
                });

                // Display newest first
                setLogs(parsedLogs.reverse());
            }
        } catch (err) {
            console.error("Error fetching recycle logs:", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    useEffect(() => {
        fetchRecycleLogs();

        const channel = supabase.channel(`recycle-logs-${machineId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_photos' }, () => {
                fetchRecycleLogs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [machineId]);

    // Available Distinct Dates
    const distinctDates = Array.from(new Set(logs.map(l => l.dateStr))).sort().reverse();
    const todayStr = new Date(Date.now() + 8 * 3600000).toISOString().substring(0, 10);

    // Filtered logs to display
    const displayedLogs = logs.filter(l => {
        if (selectedDateFilter === 'ALL') return true;
        if (selectedDateFilter === 'TODAY') return l.dateStr === todayStr;
        return l.dateStr === selectedDateFilter;
    });

    // Compute Metrics based on displayed scope
    const totalKg = displayedLogs.reduce((sum, item) => sum + item.weight, 0);
    const totalBags = displayedLogs.length;

    // Time calculations
    const earliestTime = displayedLogs.length > 0 ? new Date(displayedLogs[displayedLogs.length - 1].created_at) : null;
    const latestTime = displayedLogs.length > 0 ? new Date(displayedLogs[0].created_at) : null;

    let totalSpanHours = 0;
    let activeHours = 0;
    let downtimeHours = 0;
    let avgCycleMinutes = 0;

    if (earliestTime && latestTime && displayedLogs.length >= 2) {
        totalSpanHours = Math.max(0.1, (latestTime.getTime() - earliestTime.getTime()) / 3600000);
        
        let activeMin = 0;
        let downMin = 0;
        const validIntervals: number[] = [];

        const chronoLogs = [...displayedLogs].reverse();
        chronoLogs.forEach((item, i) => {
            if (i > 0) {
                const diff = item.intervalMinutes;
                validIntervals.push(diff);
                if (diff <= 60) {
                    activeMin += diff;
                } else {
                    downMin += diff;
                }
            }
        });

        avgCycleMinutes = validIntervals.length > 0 ? Math.round(validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length) : 0;
        activeHours = Math.max(0.1, (activeMin + (avgCycleMinutes || 30)) / 60);
        downtimeHours = Math.round((downMin / 60) * 10) / 10;
    } else if (displayedLogs.length === 1) {
        totalSpanHours = 0.5;
        activeHours = 0.5;
        avgCycleMinutes = 35;
    }

    const currentSpeedKgPerHour = activeHours > 0 ? Math.round((totalKg / activeHours) * 10) / 10 : 0;

    // Last Bag Cycle Time
    const lastBagInterval = logs.length >= 2 ? logs[0].intervalMinutes : 35;
    const showDowntimeWarning = lastBagInterval > 60;

    // Trigger AI OCR on scale photo
    const runAIOCRScan = async (base64Img: string) => {
        setIsAiScanning(true);
        try {
            const res = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64Img, mode: 'scale' })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.weight !== undefined && Number(data.weight) > 0) {
                    const cleanWeight = Number(data.weight).toFixed(2);
                    setWeightInput(cleanWeight);
                }
                if (data.material_type && ['SF.W', 'SF.B', 'BW.W', 'BW.B', 'MIX'].includes(data.material_type)) {
                    setSelectedMaterialKey(data.material_type);
                }
                if (data.digits_raw_seen || data.description) {
                    setAiAnalysis(`电子秤读数: ${data.weight} kg (仪表显示: ${data.digits_raw_seen || data.weight})`);
                }
            }
        } catch (e) {
            console.warn("AI scale OCR skipped:", e);
        } finally {
            setIsAiScanning(false);
        }
    };

    // File selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const compressed = await compressImage(file, 2560, 0.90);
            setPhotoPreview(compressed);
            const base64 = compressed.split(',')[1];
            setPhotoBase64(base64);
            setPhotoBlob(file);

            await runAIOCRScan(base64);
        } catch (err: any) {
            console.error("Failed to process photo:", err);
            alert("图片读取失败: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Webcam capture
    const handleWebcamCapture = React.useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setPhotoPreview(imageSrc);
            const base64 = imageSrc.split(',')[1];
            setPhotoBase64(base64);
            setShowWebcam(false);

            fetch(imageSrc)
                .then(r => r.blob())
                .then(blob => setPhotoBlob(blob))
                .catch(err => console.error("Webcam blob conversion failed:", err));

            runAIOCRScan(base64);
        }
    }, [webcamRef]);

    const resetForm = () => {
        setPhotoPreview(null);
        setPhotoBlob(null);
        setPhotoBase64(null);
        setWeightInput('15.0');
        setUserNote('');
        setDowntimeReason('');
        setAiAnalysis(null);
        setShowWebcam(false);
    };

    // Submit Recycle Output Log
    const handleSubmitRecycleOutput = async () => {
        const parsedWeight = parseFloat(weightInput);
        if (!parsedWeight || parsedWeight <= 0) {
            alert("请输入有效称重重量（如 15.6 KG）！\nPlease enter a valid weight!");
            return;
        }

        const effectiveOpId = operatorId || user?.uid || 'OP-REC';
        const effectiveOpEmpId = operatorEmployeeId || user?.employeeId || 'OP-001';
        const effectiveOpName = operatorName || user?.name || user?.email?.split('@')[0] || 'Aung';

        const selectedConfig = RECYCLE_MATERIALS.find(m => m.key === selectedMaterialKey) || RECYCLE_MATERIALS[0];

        try {
            setIsUploading(true);

            let uploadedPhotoUrl = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80';

            // 1. Upload photo to Supabase storage if available
            if (photoBlob || photoBase64) {
                const blob = photoBlob || await fetch(`data:image/jpeg;base64,${photoBase64}`).then(r => r.blob());
                const fileName = `recycle_${machineId}_${effectiveOpEmpId}_${Date.now()}.jpg`;

                const { error: uploadErr } = await supabase.storage
                    .from('work-photos')
                    .upload(fileName, blob, { contentType: 'image/jpeg' });

                if (!uploadErr) {
                    const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
                    uploadedPhotoUrl = urlData.publicUrl;
                }
            }

            const formattedNote = `${selectedConfig.key} | ${parsedWeight.toFixed(2)} KG | ${userNote || 'Recycle Output'}`;

            // 2. Insert into work_photos table for historical tracking
            const { data: insertedPhoto, error: photoErr } = await supabase.from('work_photos').insert([{
                employee_id: effectiveOpEmpId,
                employee_name: effectiveOpName,
                machine_id: machineId,
                category: 'qc',
                photo_url: uploadedPhotoUrl,
                user_note: formattedNote,
                ai_description: `电子秤称量再生颗粒，重量为 ${parsedWeight.toFixed(2)} 公斤。`,
                ai_raw_json: {
                    materialKey: selectedConfig.key,
                    sku: selectedConfig.sku,
                    weight: parsedWeight,
                    downtimeReason: downtimeReason || null
                }
            }]).select().single();

            if (photoErr) throw photoErr;

            // 3. Insert structured log into production_logs_v2 for company-wide ledger
            await supabase.from('production_logs_v2').insert([{
                machine_id: machineId,
                sku: selectedConfig.sku,
                output_qty: parsedWeight,
                operator_id: effectiveOpId,
                source_lane: 'Recycle',
                alarm_count: 1
            }]);

            // Optimistic UI update: instantly prepend the new record to table
            const nowLocal = new Date(Date.now() + 8 * 3600000);
            const newLogItem: RecycleBatchLog = {
                id: insertedPhoto?.id || String(Date.now()),
                created_at: new Date().toISOString(),
                timeLocal: nowLocal.toISOString().substring(11, 16),
                dateStr: nowLocal.toISOString().substring(0, 10),
                materialKey: selectedConfig.key,
                materialLabel: selectedConfig.label,
                materialColor: selectedConfig.color,
                weight: parsedWeight,
                intervalMinutes: logs.length > 0 ? Math.round((Date.now() - new Date(logs[0].created_at).getTime()) / 60000) : 0,
                downtimeReason: downtimeReason || undefined,
                operatorName: effectiveOpName,
                photoUrl: uploadedPhotoUrl,
                userNote: formattedNote
            };

            setLogs(prev => [newLogItem, ...prev]);
            resetForm();
            alert(`✅ 成功登记入库！\n第 ${logs.length + 1} 包: ${parsedWeight.toFixed(2)} KG (${selectedConfig.label})`);
        } catch (err: any) {
            console.error("Failed to submit recycle output:", err);
            alert("提交失败: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* 1. TOP LIVE TIME & CAPACITY ANALYTICS BAR (实时时间与产能指标大屏) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* 累计总产出 */}
                <div className="apple-glass rounded-2xl p-4 border border-white/10 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-cyan-900/20 to-blue-900/10">
                    <div className="flex items-center justify-between text-cyan-400 text-xs font-bold uppercase tracking-wider">
                        <span>{selectedDateFilter === 'ALL' ? '累计总产出' : (selectedDateFilter === 'TODAY' ? '今日总产出' : `${selectedDateFilter} 产出`)}</span>
                        <Scale size={16} />
                    </div>
                    <div className="mt-2">
                        <div className="text-3xl font-black text-white tabular-nums">
                            {totalKg.toFixed(1)} <span className="text-xs font-normal text-cyan-300">KG</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">累计 {totalBags} 包再生颗粒</div>
                    </div>
                </div>

                {/* 实时造粒速度 */}
                <div className="apple-glass rounded-2xl p-4 border border-white/10 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-emerald-900/20 to-teal-900/10">
                    <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <span>平均造粒速率</span>
                        <Zap size={16} />
                    </div>
                    <div className="mt-2">
                        <div className="text-3xl font-black text-white tabular-nums">
                            {currentSpeedKgPerHour.toFixed(1)} <span className="text-xs font-normal text-emerald-300">KG/h</span>
                        </div>
                        <div className="text-[10px] text-emerald-400/80 mt-0.5">10h 班次预估 {Math.round(currentSpeedKgPerHour * 10)} KG</div>
                    </div>
                </div>

                {/* 单包产出周期 */}
                <div className="apple-glass rounded-2xl p-4 border border-white/10 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-purple-900/20 to-indigo-900/10">
                    <div className="flex items-center justify-between text-purple-400 text-xs font-bold uppercase tracking-wider">
                        <span>平均单包节拍</span>
                        <Clock size={16} />
                    </div>
                    <div className="mt-2">
                        <div className="text-3xl font-black text-white tabular-nums">
                            {avgCycleMinutes || '--'} <span className="text-xs font-normal text-purple-300">min/包</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">上一包耗时: {lastBagInterval} min</div>
                    </div>
                </div>

                {/* 今日运行时间 */}
                <div className="apple-glass rounded-2xl p-4 border border-white/10 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-amber-900/20 to-orange-900/10">
                    <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
                        <span>有效造粒工时</span>
                        <TrendingUp size={16} />
                    </div>
                    <div className="mt-2">
                        <div className="text-3xl font-black text-white tabular-nums">
                            {activeHours.toFixed(1)} <span className="text-xs font-normal text-amber-300">小时</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">跨度: {totalSpanHours.toFixed(1)}h | 待料: {downtimeHours}h</div>
                    </div>
                </div>

                {/* 首尾时间窗口 */}
                <div className="col-span-2 md:col-span-1 apple-glass rounded-2xl p-4 border border-white/10 flex flex-col justify-between relative overflow-hidden bg-white/5">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
                        <span>作业时间窗口</span>
                        <Calendar size={16} />
                    </div>
                    <div className="mt-2">
                        <div className="text-sm font-mono font-bold text-white">
                            {earliestTime ? new Date(earliestTime.getTime() + 8*3600000).toISOString().substring(11, 16) : '--:--'}
                            <span className="text-gray-500 mx-1">~</span>
                            {latestTime ? new Date(latestTime.getTime() + 8*3600000).toISOString().substring(11, 16) : '--:--'}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 truncate">
                            值班: {operatorName || 'Aung (0024)'}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. RECYCLE WORKPLACE INTERACTIVE PANEL (主操作台：物料选型 + 拍照称重 + 一键入库) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT 7 COLS: QUICK MATERIAL SELECT & WEIGHING */}
                <div className="lg:col-span-7 apple-glass rounded-3xl p-6 border border-white/10 flex flex-col justify-between gap-6 shadow-xl">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                                <Layers size={14} /> 1. 选择造粒物料种类 / Select Material
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">{machineName} ({machineId})</span>
                        </div>

                        {/* 5 Material Big Buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {RECYCLE_MATERIALS.map((mat) => {
                                const isSelected = selectedMaterialKey === mat.key;
                                return (
                                    <button
                                        key={mat.key}
                                        type="button"
                                        onClick={() => setSelectedMaterialKey(mat.key)}
                                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between active:scale-95 cursor-pointer ${
                                            isSelected 
                                                ? `${mat.color} ring-2 ring-cyan-500/50 shadow-lg scale-[1.02]` 
                                                : 'border-white/10 bg-white/[0.02] hover:bg-white/5 text-gray-400'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black tracking-wider text-white">{mat.key}</span>
                                            <div className={`w-2.5 h-2.5 rounded-full ${mat.dot}`} />
                                        </div>
                                        <div className="mt-2">
                                            <div className="text-sm font-bold text-white">{mat.label}</div>
                                            <div className="text-[9px] opacity-70 truncate mt-0.5">{mat.sub}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* WEIGHING & PHOTO REGISTRATION */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <span className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                            <Scale size={14} /> 2. 电子秤称重与快捷填报 / Enter Weight & Submit
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Weight Input Box */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-300">
                                    单包重量 (KG) <span className="text-red-400">*</span>
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="例: 15.60"
                                        value={weightInput}
                                        onChange={(e) => setWeightInput(e.target.value)}
                                        className="w-full bg-black/40 border border-cyan-500/30 focus:border-cyan-400 rounded-2xl py-3 px-4 text-2xl font-black text-white placeholder-gray-600 focus:outline-none tabular-nums shadow-inner"
                                    />
                                    <span className="absolute right-4 text-xs font-bold text-cyan-400 uppercase">KG</span>
                                </div>
                                <div className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap pt-1">
                                    <span className="font-bold text-gray-500">常用重量:</span>
                                    {['12.0', '13.5', '14.0', '15.0', '16.0', '18.0', '20.0'].map(w => (
                                        <button
                                            key={w}
                                            type="button"
                                            onClick={() => setWeightInput(w)}
                                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono transition ${weightInput === w ? 'bg-cyan-500 text-black font-black border-cyan-400' : 'bg-white/5 border-white/10 text-cyan-300 hover:bg-white/10'}`}
                                        >
                                            {w}kg
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Note Input */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-300">
                                    生产备注 / 编号 (选填)
                                </label>
                                <input
                                    type="text"
                                    placeholder="如: 换网后第一包 / 杂质清理..."
                                    value={userNote}
                                    onChange={(e) => setUserNote(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 focus:border-purple-400 rounded-2xl py-3 px-4 text-xs text-white placeholder-gray-600 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* DOWNTIME GAP REASON (If interval > 60 mins) */}
                        {showDowntimeWarning && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 animate-fade-in">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                                    <AlertTriangle size={14} /> 距离上一包间隔 {lastBagInterval} 分钟（超过1小时），请选择停机/待料原因：
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {DOWNTIME_REASONS.map(reason => (
                                        <button
                                            key={reason}
                                            type="button"
                                            onClick={() => setDowntimeReason(reason)}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all ${
                                                downtimeReason === reason
                                                    ? 'bg-amber-500 text-black border-amber-400'
                                                    : 'bg-black/30 border-amber-500/20 text-amber-200/80 hover:bg-amber-500/20'
                                            }`}
                                        >
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SUBMIT BUTTON */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={handleSubmitRecycleOutput}
                                disabled={isUploading || !weightInput}
                                className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                            >
                                {isUploading ? (
                                    <Loader className="animate-spin" size={18} />
                                ) : (
                                    <CheckCircle2 size={20} />
                                )}
                                <span>确认称重并入库 ({weightInput || '0'} KG {RECYCLE_MATERIALS.find(m => m.key === selectedMaterialKey)?.label})</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT 5 COLS: CAMERA / PHOTO PREVIEW & AI OCR */}
                <div className="lg:col-span-5 apple-glass rounded-3xl p-6 border border-white/10 flex flex-col justify-between gap-4 shadow-xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                            <Camera size={14} /> 现场电子秤拍照 (支持拍照/选图)
                        </span>
                        {photoPreview && (
                            <button onClick={resetForm} className="text-[10px] text-gray-400 hover:text-red-400 flex items-center gap-0.5">
                                <X size={12} /> 清除照片
                            </button>
                        )}
                    </div>

                    {/* Camera view / Preview box */}
                    <div className="flex-1 min-h-[220px] rounded-2xl bg-black/50 border border-dashed border-white/10 overflow-hidden relative flex items-center justify-center">
                        {showWebcam ? (
                            <div className="relative w-full h-full aspect-video">
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    screenshotQuality={0.95}
                                    videoConstraints={{
                                        facingMode: "environment",
                                        width: { ideal: 1920, min: 1280 },
                                        height: { ideal: 1080, min: 720 }
                                    }}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleWebcamCapture}
                                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
                                    >
                                        <Camera size={14} /> 立即拍摄称重
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowWebcam(false)}
                                        className="px-3 py-2.5 bg-black/60 hover:bg-black text-gray-300 font-bold text-xs rounded-xl"
                                    >
                                        关闭
                                    </button>
                                </div>
                            </div>
                        ) : photoPreview ? (
                            <div className="relative w-full h-full group flex items-center justify-center bg-black">
                                <img src={photoPreview} alt="Scale Preview" className="w-full h-full max-h-[260px] object-contain" />
                                {isAiScanning && (
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                                        <Loader className="animate-spin text-purple-400" size={24} />
                                        <span className="text-xs text-purple-300 font-bold">AI 正在识别电子秤读数...</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                                    <Scale size={22} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-300">现场电子秤拍照存证</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">拍摄或上传电子秤照片（选填）</p>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowWebcam(true)}
                                        className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                                    >
                                        <Camera size={13} /> 开启相机
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                                    >
                                        <ImageIcon size={13} /> 相册选择
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

                    {aiAnalysis && (
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                            <div className="text-[10px] text-purple-400 uppercase font-bold flex items-center gap-1">
                                <Sparkles size={11} /> AI 视觉解析结果:
                            </div>
                            <p className="text-xs text-white mt-1 leading-tight">{aiAnalysis}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. RECYCLE TIMELINE & BATCH HISTORY (全量历史流水明细表 + 智能日期筛选) */}
            <div className="apple-glass rounded-3xl p-6 border border-white/10 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <History size={18} className="text-cyan-400" />
                        <h3 className="text-sm font-black uppercase tracking-wider text-white">
                            造粒称重流水明细 ({displayedLogs.length} 条记录 / 总库 {logs.length} 条)
                        </h3>
                    </div>

                    {/* Date Selector Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
                        <button
                            type="button"
                            onClick={() => setSelectedDateFilter('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 border ${
                                selectedDateFilter === 'ALL'
                                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                        >
                            全部历史 ({logs.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedDateFilter('TODAY')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 border ${
                                selectedDateFilter === 'TODAY'
                                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                        >
                            今日 ({logs.filter(l => l.dateStr === todayStr).length})
                        </button>

                        {distinctDates.slice(0, 7).map(d => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setSelectedDateFilter(d)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition shrink-0 border ${
                                    selectedDateFilter === d
                                        ? 'bg-purple-600 text-white border-purple-400 font-bold shadow-md'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                }`}
                            >
                                {d.slice(5)} ({logs.filter(l => l.dateStr === d).length})
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={fetchRecycleLogs}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-cyan-400 rounded-xl border border-white/10 shrink-0"
                            title="刷新最新数据"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {loadingLogs ? (
                    <div className="py-16 flex flex-col justify-center items-center gap-2 text-gray-400 text-xs">
                        <Loader className="animate-spin text-cyan-400" size={24} />
                        <span>正在加载历史造粒与称重流水...</span>
                    </div>
                ) : displayedLogs.length === 0 ? (
                    <div className="py-16 text-center text-gray-500 text-xs font-mono">
                        未查询到选定日期的称重记录。请切换至「全部历史」或在上方登记新批次！
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400 font-mono text-[10px] uppercase">
                                    <th className="pb-3 px-3">序号</th>
                                    <th className="pb-3 px-3">日期 / 时间</th>
                                    <th className="pb-3 px-3">物料类别</th>
                                    <th className="pb-3 px-3">单包重量</th>
                                    <th className="pb-3 px-3">产出耗时</th>
                                    <th className="pb-3 px-3">操作员</th>
                                    <th className="pb-3 px-3 text-right">现场称重照片</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono">
                                {displayedLogs.map((log, idx) => {
                                    const bagIndex = displayedLogs.length - idx;
                                    const isDowntime = log.intervalMinutes > 60;
                                    return (
                                        <tr key={log.id} className="hover:bg-white/[0.02] transition">
                                            <td className="py-3 px-3 text-gray-400 font-bold">
                                                #{bagIndex}
                                            </td>
                                            <td className="py-3 px-3 text-white font-bold">
                                                <span className="text-[10px] text-gray-400 mr-1.5 font-normal">{log.dateStr}</span>
                                                <span>{log.timeLocal}</span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${log.materialColor}`}>
                                                    {log.materialLabel} ({log.materialKey})
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-sm font-black text-white tabular-nums">
                                                {log.weight.toFixed(2)} <span className="text-[10px] text-gray-400">KG</span>
                                            </td>
                                            <td className="py-3 px-3">
                                                {idx === displayedLogs.length - 1 ? (
                                                    <span className="text-[10px] text-gray-500">首包开机</span>
                                                ) : (
                                                    <span className={`text-[11px] font-bold ${isDowntime ? 'text-amber-400' : 'text-purple-300'}`}>
                                                        {log.intervalMinutes} min
                                                        {isDowntime && <span className="text-[9px] ml-1 opacity-80">({log.downtimeReason || '间歇'})</span>}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-gray-300">
                                                {log.operatorName}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                {log.photoUrl && !log.photoUrl.includes('unsplash') ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setLightboxPhoto(log.photoUrl!)}
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 transition"
                                                    >
                                                        <ImageIcon size={11} /> 称重照片
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600">已入库</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* LIGHTBOX MODAL (Portaled to document.body to avoid parent CSS transform clipping) */}
            {lightboxPhoto && typeof document !== 'undefined' && createPortal(
                <div
                    onClick={() => setLightboxPhoto(null)}
                    className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in select-none"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
                >
                    {/* Header Controls */}
                    <div 
                        className="w-full max-w-3xl flex items-center justify-between py-2 px-4 mb-2 bg-white/10 rounded-2xl border border-white/10 text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                            <Scale size={16} />
                            <span>现场电子秤实拍照片 / Weighing Scale Photo</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setLightboxPhoto(null)}
                            className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow"
                        >
                            <X size={14} />
                            <span>关闭 (Close)</span>
                        </button>
                    </div>

                    {/* Image Container */}
                    <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="relative max-w-3xl max-h-[80vh] w-full flex items-center justify-center bg-black/80 rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-2"
                    >
                        <img 
                            src={lightboxPhoto} 
                            alt="Scale Full Photo" 
                            className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-inner" 
                        />
                    </div>

                    <div className="text-[11px] text-gray-400 mt-2 font-mono">
                        点击遮罩任意区域或右上角按钮即可关闭
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
