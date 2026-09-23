import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { 
    Camera, 
    Image as ImageIcon, 
    Sparkles, 
    CheckCircle2, 
    Clock, 
    Layers, 
    AlertTriangle, 
    Loader, 
    X, 
    TrendingUp, 
    History,
    Calendar,
    Printer,
    Check,
    Plus,
    Minus,
    RefreshCw,
    Pause,
    Package
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { compressImage, dataURLtoBlob } from '../utils/imageCompress';
import { useTranslation } from 'react-i18next';
import { thermalPrinterService, LabelData } from '../services/thermalPrinterService';

export interface StretchFilmPreset {
    sku: string;
    name: string;
    weightKg: number;
    rollsPerBox: number;
    defaultBoxes: number;
    description: string;
}

export const SF_PRESETS: StretchFilmPreset[] = [
    {
        sku: 'SF-CLEAR-2.2-50CM',
        name: '50cm 透明手用膜 (2.2kg / 6卷箱)',
        weightKg: 2.2,
        rollsPerBox: 6,
        defaultBoxes: 10,
        description: '标准透明手用膜，一车10箱共60卷'
    },
    {
        sku: 'SF-BLACK-2.2-50CM',
        name: '50cm 黑色防窥膜 (2.2kg / 6卷箱)',
        weightKg: 2.2,
        rollsPerBox: 6,
        defaultBoxes: 10,
        description: '黑色不透光防窥膜，一车10箱共60卷'
    },
    {
        sku: 'SF-CLEAR-2.0',
        name: '50cm 透明轻量膜 (2.0kg / 6卷箱)',
        weightKg: 2.0,
        rollsPerBox: 6,
        defaultBoxes: 10,
        description: '2.0kg 轻量化拉伸膜，一车10箱共60卷'
    },
    {
        sku: 'SF-BLACK-2.0',
        name: '50cm 黑色轻量膜 (2.0kg / 6卷箱)',
        weightKg: 2.0,
        rollsPerBox: 6,
        defaultBoxes: 10,
        description: '2.0kg 黑色拉伸膜，一车10箱共60卷'
    },
    {
        sku: 'SF-BABYROLL-CLEAR',
        name: '10cm Baby Roll 小卷透明 (24卷箱)',
        weightKg: 0.5,
        rollsPerBox: 24,
        defaultBoxes: 10,
        description: '小卷分切膜，每箱24卷，一车10箱共240卷'
    }
];

export const SF_DOWNTIME_REASONS = [
    { key: '换卷接膜', label: '换卷接膜 (Roll Splicing)', icon: '🔄' },
    { key: '换网清滤网', label: '换网清滤网 (Filter Change)', icon: '🧼' },
    { key: '断膜破损处理', label: '断膜破损处理 (Film Tear)', icon: '⚡' },
    { key: '机械电气故障', label: '机械电气故障 (Machine Fault)', icon: '🛠️' },
    { key: '待原料/待纸管', label: '待原料/纸管 (Waiting Material)', icon: '⏳' },
    { key: '调机升温温控', label: '调机升温 (Temp Adjust)', icon: '🌡️' },
    { key: '用餐例行休息', label: '用餐休息 (Meal / Break)', icon: '🍱' },
    { key: '其他原因', label: '其他停机 (Other)', icon: '📝' }
];

interface StretchFilmControlProps {
    machineId: string;
    machineName: string;
    operatorId: string | null;
    operatorEmployeeId: string | null;
    operatorName: string | null;
    user: User | null;
    isControlMode: boolean;
    onTakeoverClick?: () => void;
    onProductionComplete?: () => void;
    onOpenPrinterModal?: () => void;
}

interface SfBatchLog {
    id: string;
    created_at: string;
    sku: string;
    output_qty: number;
    boxes: number;
    weight: number;
    note: string;
    photo_url?: string;
    operator_name?: string;
}

export const StretchFilmControl: React.FC<StretchFilmControlProps> = ({
    machineId,
    machineName,
    operatorId,
    operatorEmployeeId,
    operatorName,
    user,
    isControlMode,
    onTakeoverClick,
    onProductionComplete,
    onOpenPrinterModal
}) => {
    const { t } = useTranslation();

    // 1. Preset & Spec state
    const [selectedPreset, setSelectedPreset] = useState<StretchFilmPreset>(SF_PRESETS[0]);
    const [boxesCount, setBoxesCount] = useState<number>(10); // Standard 10 boxes per blue trolley
    const [rollsPerBox, setRollsPerBox] = useState<number>(6);
    const [batchNote, setBatchNote] = useState<string>('');

    // 2. Photo capture state
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [showWebcam, setShowWebcam] = useState<boolean>(false);
    const [webcamFacing, setWebcamFacing] = useState<'user' | 'environment'>('environment');
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 3. Submission & Async AI validation state
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [aiVerificationText, setAiVerificationText] = useState<string | null>(null);
    const [lastSavedBatch, setLastSavedBatch] = useState<SfBatchLog | null>(null);

    // 4. Batch history & Totals
    const [todayBatches, setTodayBatches] = useState<SfBatchLog[]>([]);
    const [todayTotalBoxes, setTodayTotalBoxes] = useState<number>(0);
    const [todayTotalRolls, setTodayTotalRolls] = useState<number>(0);
    const [todayTotalKg, setTodayTotalKg] = useState<number>(0);

    // 5. Downtime Stop Modal
    const [showDowntimeModal, setShowDowntimeModal] = useState<boolean>(false);
    const [selectedDowntimeReason, setSelectedDowntimeReason] = useState<string>('换卷接膜');
    const [downtimeDetailNote, setDowntimeDetailNote] = useState<string>('');
    const [isLoggingDowntime, setIsLoggingDowntime] = useState<boolean>(false);

    // Update rollsPerBox when preset changes
    useEffect(() => {
        setRollsPerBox(selectedPreset.rollsPerBox);
    }, [selectedPreset]);

    // Fetch Today's SF Batches from production_logs_v2
    const fetchTodaySfLogs = useCallback(async () => {
        if (!machineId) return;
        try {
            const now = new Date();
            const myt = new Date(now.getTime() + 8 * 3600000);
            const ymd = myt.toISOString().slice(0, 10);
            const todayStart = new Date(`${ymd}T00:00:00+08:00`).toISOString();

            const { data, error } = await supabase
                .from('production_logs_v2')
                .select('*')
                .eq('machine_id', machineId)
                .gte('created_at', todayStart)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Failed to fetch SF logs:", error);
                return;
            }

            let sumBoxes = 0;
            let sumRolls = 0;
            let sumKg = 0;

            const mapped: SfBatchLog[] = (data || []).map(row => {
                const rolls = Number(row.output_qty) || 0;
                // Parse boxes from note if available, else derive
                const boxMatch = row.note?.match(/(\d+)\s*箱/);
                const boxes = boxMatch ? parseInt(boxMatch[1], 10) : (rolls > 0 ? Math.ceil(rolls / 6) : 0);
                
                // Weight estimation
                const weightMatch = row.note?.match(/([\d.]+)\s*kg/i);
                const wt = weightMatch ? parseFloat(weightMatch[1]) : (rolls * 2.2);

                if (rolls > 0) {
                    sumRolls += rolls;
                    sumBoxes += boxes;
                    sumKg += wt;
                }

                return {
                    id: row.log_id || row.id,
                    created_at: row.created_at,
                    sku: row.sku || 'SF-GENERAL',
                    output_qty: rolls,
                    boxes: boxes,
                    weight: Number(wt.toFixed(1)),
                    note: row.note || '',
                    photo_url: row.photo_url || undefined,
                    operator_name: row.operator_id || undefined
                };
            });

            setTodayBatches(mapped);
            setTodayTotalBoxes(sumBoxes);
            setTodayTotalRolls(sumRolls);
            setTodayTotalKg(Number(sumKg.toFixed(1)));
        } catch (err) {
            console.error("Error in fetchTodaySfLogs:", err);
        }
    }, [machineId]);

    useEffect(() => {
        fetchTodaySfLogs();
    }, [fetchTodaySfLogs]);

    // Handle File Selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.8 });
            const previewUrl = URL.createObjectURL(compressed);
            setPhotoBlob(compressed);
            setPhotoPreview(previewUrl);

            // Convert to base64 for async AI
            const reader = new FileReader();
            reader.onloadend = () => {
                const b64 = (reader.result as string).split(',')[1];
                setPhotoBase64(b64);
            };
            reader.readAsDataURL(compressed);

            // Default to 10 boxes per user rule!
            setBoxesCount(10);
        } catch (err) {
            console.error("Error reading photo:", err);
            alert(t('图片加载失败，请重试'));
        }
    };

    // Capture from Webcam
    const captureWebcam = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setPhotoPreview(imageSrc);
            const b64 = imageSrc.split(',')[1];
            setPhotoBase64(b64);
            const blob = dataURLtoBlob(imageSrc);
            setPhotoBlob(blob);
            setShowWebcam(false);
            setBoxesCount(10); // Standard trolley 10 boxes
        }
    }, [webcamRef]);

    const resetPhoto = () => {
        setPhotoPreview(null);
        setPhotoBlob(null);
        setPhotoBase64(null);
        setAiVerificationText(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Derived Batch Metrics
    const totalRollsInBatch = boxesCount * rollsPerBox;
    const totalWeightInBatch = Number((totalRollsInBatch * selectedPreset.weightKg).toFixed(1));

    // Confirm Batch Submission
    const handleSubmitTrolleyBatch = async () => {
        const uploaderEmployeeId = operatorEmployeeId || user?.employeeId || user?.uid || 'OP-AUTO';
        const uploaderName = operatorName || user?.name || '操作员';

        if (boxesCount <= 0) {
            alert(t('箱数必须大于 0'));
            return;
        }

        setIsSubmitting(true);
        try {
            let uploadedPhotoUrl = '';

            // 1. Upload Photo to work-photos bucket if photo is present
            if (photoBlob) {
                const fileName = `sf_trolley_${uploaderEmployeeId}_${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from('work-photos')
                    .upload(fileName, photoBlob, { contentType: 'image/jpeg' });

                if (!uploadError) {
                    const { data: urlData } = supabase.storage
                        .from('work-photos')
                        .getPublicUrl(fileName);
                    uploadedPhotoUrl = urlData.publicUrl;
                } else {
                    console.warn("Storage upload failed, continuing with log:", uploadError);
                }
            }

            // 2. Insert into production_logs_v2 (SOP Truth)
            const finalNote = `【推车拍照报工】${boxesCount} 箱 (${totalRollsInBatch} 卷) | 净重约 ${totalWeightInBatch}kg | 规格: ${selectedPreset.sku}${batchNote ? ` | 备注: ${batchNote}` : ''}`;
            
            const { data: insertedLog, error: logError } = await supabase
                .from('production_logs_v2')
                .insert([{
                    machine_id: machineId,
                    sku: selectedPreset.sku,
                    output_qty: totalRollsInBatch,
                    operator_id: operatorId || uploaderEmployeeId,
                    note: finalNote
                }])
                .select()
                .single();

            if (logError) throw logError;

            // 3. Insert into work_photos for visual proof & audit
            if (uploadedPhotoUrl) {
                await supabase.from('work_photos').insert([{
                    employee_id: uploaderEmployeeId,
                    employee_name: uploaderName,
                    photo_url: uploadedPhotoUrl,
                    category: 'production_batch',
                    ai_description: `蓝色推车拉伸膜码放 ${boxesCount} 箱 (${totalRollsInBatch} 卷)`,
                    user_note: finalNote,
                    machine_id: machineId,
                    risk_flag: false
                }]);
            }

            // 4. Update UI State & Notify parent
            const savedBatch: SfBatchLog = {
                id: insertedLog?.log_id || insertedLog?.id || String(Date.now()),
                created_at: new Date().toISOString(),
                sku: selectedPreset.sku,
                output_qty: totalRollsInBatch,
                boxes: boxesCount,
                weight: totalWeightInBatch,
                note: finalNote,
                photo_url: uploadedPhotoUrl,
                operator_name: uploaderName
            };
            setLastSavedBatch(savedBatch);

            // 5. Trigger Non-blocking Async Gemini AI verification
            if (photoBase64) {
                triggerAsyncAiVerification(photoBase64, boxesCount);
            }

            // Reset photo and notes for the next trolley
            resetPhoto();
            setBatchNote('');
            await fetchTodaySfLogs();
            if (onProductionComplete) onProductionComplete();

        } catch (err: any) {
            console.error("SF Trolley submit failed:", err);
            alert(t('报工保存失败') + ': ' + (err.message || '网络异常'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Non-blocking Gemini Vision AI verification
    const triggerAsyncAiVerification = async (b64: string, expectedBoxes: number) => {
        try {
            const res = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: b64, mode: 'sf_trolley' })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.description) {
                    const notice = `AI 智能校验: ${data.description}${data.boxes_count ? ` (识别箱数: ${data.boxes_count}箱)` : ''}`;
                    setAiVerificationText(notice);
                }
            }
        } catch (e) {
            console.warn("Async AI verification ignored error:", e);
        }
    };

    // Print Carton Label for Last Saved Batch or Selected Preset
    const handlePrintCartonLabels = async (copies: number = 10) => {
        const now = new Date();
        const lotNo = `LOT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${machineId}`;
        
        const labelData: LabelData = {
            sku: selectedPreset.sku,
            productName: selectedPreset.name,
            machineCode: machineId,
            operatorName: operatorName || operatorId || 'OP',
            operatorId: operatorId || 'OP',
            lotNo: lotNo,
            timestamp: now.toISOString(),
            rolls: rollsPerBox,
            weight: selectedPreset.weightKg * rollsPerBox,
            note: `${boxesCount} 箱批次打标`
        };

        try {
            await thermalPrinterService.printLabel(labelData, copies);
            alert(t(`正在打印 ${copies} 张拉伸膜外箱标签...`));
        } catch (err: any) {
            console.error("Print error:", err);
            alert(t('打印失败，请检查打印机连接状态') + ': ' + (err.message || 'Error'));
        }
    };

    // Downtime Stop Run
    const handleConfirmDowntime = async () => {
        setIsLoggingDowntime(true);
        try {
            const finalDowntimeNote = `【停机归因】原因: ${selectedDowntimeReason}${downtimeDetailNote ? ` | 备注: ${downtimeDetailNote}` : ''}`;
            
            const { error } = await supabase.from('production_logs_v2').insert([{
                machine_id: machineId,
                sku: selectedPreset.sku || 'SF-DOWNTIME',
                output_qty: 0,
                operator_id: operatorId || user?.employeeId || null,
                note: finalDowntimeNote
            }]);

            if (error) throw error;

            setShowDowntimeModal(false);
            setDowntimeDetailNote('');
            await fetchTodaySfLogs();
            if (onProductionComplete) onProductionComplete();
            alert(t('已记录停机归因') + ': ' + selectedDowntimeReason);
        } catch (err: any) {
            console.error("Downtime logging failed:", err);
            alert(t('停机记录失败') + ': ' + (err.message || 'Error'));
        } finally {
            setIsLoggingDowntime(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* 1. TOP STATS BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-purple-950/20 border border-purple-500/20 p-4 rounded-2xl">
                    <div className="flex items-center justify-between text-purple-400 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">{t('今日累计出箱')}</span>
                        <Package size={15} />
                    </div>
                    <div className="text-2xl font-black text-white font-mono">
                        {todayTotalBoxes} <span className="text-xs text-purple-300 font-normal">{t('箱')}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Today's Cartons</p>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-2xl">
                    <div className="flex items-center justify-between text-emerald-400 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">{t('今日累计卷数')}</span>
                        <Layers size={15} />
                    </div>
                    <div className="text-2xl font-black text-emerald-300 font-mono">
                        {todayTotalRolls} <span className="text-xs text-emerald-400 font-normal">{t('卷')}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Today's Total Rolls</p>
                </div>

                <div className="bg-blue-950/20 border border-blue-500/20 p-4 rounded-2xl">
                    <div className="flex items-center justify-between text-blue-400 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">{t('预估总产重')}</span>
                        <TrendingUp size={15} />
                    </div>
                    <div className="text-2xl font-black text-blue-300 font-mono">
                        {todayTotalKg} <span className="text-xs text-blue-400 font-normal">kg</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Total Weight (Net)</p>
                </div>

                <div className="bg-zinc-900/60 border border-white/10 p-4 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">{t('停机归因登记')}</span>
                        <Pause size={15} className="text-amber-400" />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowDowntimeModal(true)}
                        className="w-full py-2 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <Pause size={13} />
                        <span>{t('登记停机 / 换网')}</span>
                    </button>
                </div>
            </div>

            {/* 2. MAIN SF PRODUCTION CONTROLLER (拍照算箱核心面板) */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 md:p-6 backdrop-blur-md shadow-2xl relative">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xl shadow-inner">
                            🛒
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white flex items-center gap-2">
                                <span>{t('拉伸膜推车拍照算箱')}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-bold">
                                    {machineId}
                                </span>
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('现场 SOP：每车通常堆放 10 箱（每箱 6 卷），拍摄蓝色推车即可极速完成报工')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {onOpenPrinterModal && (
                            <button
                                type="button"
                                onClick={onOpenPrinterModal}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <Printer size={13} className="text-emerald-400" />
                                <span>{t('打标机直连')}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={fetchTodaySfLogs}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 rounded-xl transition cursor-pointer"
                            title={t('刷新')}
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {/* SKU SPEC CHIPS SELECTION */}
                <div className="mb-5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                        1. {t('选择当前生产规格 (Product SKU)')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {SF_PRESETS.map(preset => {
                            const isSelected = selectedPreset.sku === preset.sku;
                            return (
                                <button
                                    key={preset.sku}
                                    type="button"
                                    onClick={() => setSelectedPreset(preset)}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                        isSelected
                                            ? 'bg-purple-600/25 border-purple-500 text-white shadow-lg shadow-purple-900/30 scale-[1.01]'
                                            : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono font-bold text-purple-300">{preset.sku}</span>
                                        {isSelected && <CheckCircle2 size={15} className="text-purple-400" />}
                                    </div>
                                    <p className="text-xs font-semibold mt-1 text-white">{preset.name}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {preset.weightKg} kg/卷 · {preset.rollsPerBox} 卷/箱
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* PHOTO CAPTURE & BOX COUNTING WORKSPACE */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* LEFT: PHOTO CAPTURE AREA (6 cols) */}
                    <div className="lg:col-span-6 flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                            2. {t('拍摄蓝色推车上的成品箱 (现场存证留痕)')}
                        </label>

                        {!photoPreview && !showWebcam && (
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowWebcam(true)}
                                    className="py-10 bg-purple-600/10 hover:bg-purple-600/20 border-2 border-dashed border-purple-500/30 hover:border-purple-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 group-hover:scale-110 flex items-center justify-center text-purple-400 transition-transform">
                                        <Camera size={24} />
                                    </div>
                                    <span className="text-xs font-bold text-purple-200">{t('开启相机拍摄推车')}</span>
                                    <span className="text-[10px] text-gray-400">{t('自动对准蓝色推车拍照')}</span>
                                </button>

                                <label className="py-10 bg-white/[0.03] hover:bg-white/[0.08] border-2 border-dashed border-white/10 hover:border-white/20 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 group">
                                    <div className="w-12 h-12 rounded-full bg-white/5 group-hover:scale-110 flex items-center justify-center text-gray-300 transition-transform">
                                        <ImageIcon size={22} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-200">{t('相册选取推车照片')}</span>
                                    <span className="text-[10px] text-gray-400">{t('从手机图库中选择')}</span>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        )}

                        {showWebcam && (
                            <div className="relative rounded-2xl overflow-hidden bg-black border border-purple-500/40 aspect-video shadow-xl">
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{
                                        facingMode: webcamFacing
                                    }}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute top-3 right-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setWebcamFacing(prev => prev === 'user' ? 'environment' : 'user')}
                                        className="p-2 rounded-xl bg-black/70 text-white hover:bg-black text-xs font-semibold cursor-pointer"
                                        title="翻转镜头"
                                    >
                                        🔄
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowWebcam(false)}
                                        className="p-2 rounded-xl bg-black/70 text-white hover:bg-rose-600 text-xs font-semibold cursor-pointer"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                                <div className="absolute bottom-4 inset-x-0 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={captureWebcam}
                                        className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full font-black text-xs shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer border border-white/20"
                                    >
                                        <Camera size={16} />
                                        <span>{t('拍下推车照片 (预填10箱)')}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {photoPreview && (
                            <div className="space-y-2">
                                <div className="relative rounded-2xl overflow-hidden bg-black border border-white/15 aspect-video max-h-56 flex items-center justify-center">
                                    <img
                                        src={photoPreview}
                                        alt="Trolley preview"
                                        className="w-full h-full object-contain"
                                    />
                                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] text-purple-300 font-semibold border border-purple-500/30 flex items-center gap-1">
                                        🛒 {t('蓝色推车已拍下')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={resetPhoto}
                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                                        title="重新拍照"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                {aiVerificationText && (
                                    <p className="text-[11px] text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                        <Sparkles size={12} className="text-purple-400 shrink-0" />
                                        <span>{aiVerificationText}</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: BOX COUNT ADJUSTER & INSTANT INTAKE (6 cols) */}
                    <div className="lg:col-span-6 bg-white/[0.03] border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col justify-between">
                        <div>
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                                3. {t('核对箱数 (默认 10 箱，可一键微调)')}
                            </label>

                            {/* Stepper with Large Buttons */}
                            <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-3 mb-3">
                                <button
                                    type="button"
                                    onClick={() => setBoxesCount(prev => Math.max(1, prev - 1))}
                                    className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white flex items-center justify-center text-xl font-bold border border-white/10 transition cursor-pointer"
                                >
                                    <Minus size={20} />
                                </button>
                                
                                <div className="flex-1 text-center">
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className="text-4xl font-black font-mono text-purple-300">
                                            {boxesCount}
                                        </span>
                                        <span className="text-sm font-bold text-gray-400">{t('箱')}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400">
                                        = {totalRollsInBatch} {t('卷')} ({totalWeightInBatch} kg)
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setBoxesCount(prev => prev + 1)}
                                    className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white flex items-center justify-center text-xl font-bold border border-white/10 transition cursor-pointer"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            {/* Quick Selection Chips */}
                            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                                {[8, 9, 10, 11, 12].map(count => (
                                    <button
                                        key={count}
                                        type="button"
                                        onClick={() => setBoxesCount(count)}
                                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                                            boxesCount === count
                                                ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/30'
                                                : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                                        }`}
                                    >
                                        {count === 10 ? `⭐ 10箱` : `${count}箱`}
                                    </button>
                                ))}
                            </div>

                            {/* Calculation Formula Card */}
                            <div className="bg-black/30 border border-white/5 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
                                <div className="flex justify-between text-gray-400">
                                    <span>{t('每箱标准规格')}:</span>
                                    <span className="text-white font-mono">{rollsPerBox} 卷/箱 ({selectedPreset.weightKg} kg/卷)</span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                    <span>{t('本次推车总卷数')}:</span>
                                    <span className="text-emerald-300 font-mono font-bold">{totalRollsInBatch} 卷</span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                    <span>{t('本次推车总重量')}:</span>
                                    <span className="text-blue-300 font-mono font-bold">~ {totalWeightInBatch} kg</span>
                                </div>
                            </div>

                            {/* Optional note */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder={t('生产批次备注 (选填，如: 白班第3车 / 胶水充足) ...')}
                                    value={batchNote}
                                    onChange={e => setBatchNote(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 text-xs px-3.5 py-2.5 rounded-xl focus:border-purple-500 focus:outline-none text-white placeholder-gray-500"
                                />
                            </div>
                        </div>

                        {/* Submit Action */}
                        <div className="space-y-2 pt-2 border-t border-white/10">
                            <button
                                type="button"
                                onClick={handleSubmitTrolleyBatch}
                                disabled={isSubmitting || boxesCount <= 0}
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/40 border border-emerald-400/40 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader className="animate-spin" size={16} />
                                        <span>{t('正在入库记录...')}</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} />
                                        <span>{t('确认入库')} {boxesCount} {t('箱')} ({totalRollsInBatch} {t('卷')} · {totalWeightInBatch}kg)</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => handlePrintCartonLabels(boxesCount)}
                                className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                                title="一键打印本批次所有外箱标签"
                            >
                                <Printer size={13} className="text-purple-400" />
                                <span>{t('一键打印')} {boxesCount} {t('张外箱标签 (Carton Labels)')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. TODAY'S BATCH LOG TABLE */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                    <div className="flex items-center gap-2">
                        <History size={16} className="text-purple-400" />
                        <h4 className="text-sm font-bold text-white">
                            {t('今日推车报工记录')} ({todayBatches.length} {t('车')})
                        </h4>
                    </div>
                    <span className="text-xs text-gray-400">
                        {t('按推车计件实时同步至 production_logs_v2')}
                    </span>
                </div>

                {todayBatches.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-xs">
                        {t('今日该机台暂无推车报工记录，请对推车拍照并确认入库')}
                    </div>
                ) : (
                    <div className="divide-y divide-white/5 overflow-x-auto">
                        {todayBatches.map(batch => (
                            <div key={batch.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-3 min-w-0">
                                    {batch.photo_url ? (
                                        <a href={batch.photo_url} target="_blank" rel="noreferrer" className="shrink-0">
                                            <img
                                                src={batch.photo_url}
                                                alt="Batch proof"
                                                className="w-10 h-10 rounded-xl object-cover border border-white/15 hover:opacity-80 transition"
                                            />
                                        </a>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 shrink-0">
                                            📦
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-purple-300">{batch.sku}</span>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(batch.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 truncate max-w-md mt-0.5">
                                            {batch.note}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0 text-right">
                                    <div>
                                        <div className="text-sm font-black text-white font-mono">
                                            {batch.boxes} {t('箱')} <span className="text-gray-400 text-xs font-normal">({batch.output_qty}卷)</span>
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                            ~ {batch.weight} kg
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handlePrintCartonLabels(batch.boxes || 10)}
                                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition cursor-pointer"
                                        title="补打外箱标签"
                                    >
                                        <Printer size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. DOWNTIME MODAL (停机原因归因模态框) */}
            {showDowntimeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-zinc-900 border border-white/15 rounded-3xl max-w-md w-full p-5 md:p-6 shadow-2xl relative space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2 text-white font-black text-base">
                                <Pause className="text-amber-400" size={18} />
                                <span>{t('登记停机归因 / 设备暂停')}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDowntimeModal(false)}
                                className="p-1 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-2">
                                {t('请选择停机主要原因')}:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {SF_DOWNTIME_REASONS.map(r => (
                                    <button
                                        key={r.key}
                                        type="button"
                                        onClick={() => setSelectedDowntimeReason(r.key)}
                                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer text-left ${
                                            selectedDowntimeReason === r.key
                                                ? 'bg-amber-500/20 text-amber-200 border-amber-500/60 shadow-md'
                                                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        <span className="text-base">{r.icon}</span>
                                        <span className="truncate">{r.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                                {t('补充说明 (选填)')}:
                            </label>
                            <textarea
                                value={downtimeDetailNote}
                                onChange={e => setDowntimeDetailNote(e.target.value)}
                                placeholder="例: 换3号滤网用时约15分钟 / 加温区升温中..."
                                className="w-full bg-black/40 border border-white/10 text-xs p-3 rounded-xl focus:border-amber-500 focus:outline-none text-white min-h-[60px]"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDowntimeModal(false)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                {t('取消')}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDowntime}
                                disabled={isLoggingDowntime}
                                className="flex-2 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                {isLoggingDowntime ? t('正在保存...') : t('确认登记停机')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StretchFilmControl;
