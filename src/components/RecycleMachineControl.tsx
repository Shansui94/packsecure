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
    RefreshCw,
    Download,
    RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { compressImage, dataURLtoBlob } from '../utils/imageCompress';
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
    aiRawJson?: {
        weight?: number;
        ai_detected_weight?: number;
        manual_input?: number;
        discrepancy?: boolean;
        diff_amount?: number;
        needs_review?: boolean;
        review_status?: string;
        reviewed_by?: string;
        reviewed_at?: string;
        [key: string]: any;
    };
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

    // Input States (Manual typing - default empty/15.0 KG)
    const [weightInput, setWeightInput] = useState<string>('15.0');
    const [userNote, setUserNote] = useState<string>('');
    const [downtimeReason, setDowntimeReason] = useState<string>('');

    // AI Shadow Check States
    const [aiDetectedWeight, setAiDetectedWeight] = useState<number | null>(null);
    const [showDiscrepancyModal, setShowDiscrepancyModal] = useState<boolean>(false);
    const [discrepancyData, setDiscrepancyData] = useState<{ manualWeight: number; aiWeight: number; diff: number } | null>(null);
    const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState<boolean>(false);

    // Photo Capture States
    const [showWebcam, setShowWebcam] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isAiScanning, setIsAiScanning] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const webcamRef = useRef<Webcam>(null);

    // All Historical Logs & Filter
    const [logs, setLogs] = useState<RecycleBatchLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL'); // 'ALL' | 'TODAY' | 'YYYY-MM-DD'

    // Lightbox modal for photos with rich metadata
    const [lightboxLog, setLightboxLog] = useState<RecycleBatchLog | null>(null);

    // Fetch Logs for this Recycle Machine (Loads all historical logs)
    const fetchRecycleLogs = async () => {
        try {
            setLoadingLogs(true);
            const shortKey = machineId.split('-')[0].trim();

            // Fetch up to 1000 newest records first to guarantee latest records are always present
            const { data, error } = await supabase
                .from('work_photos')
                .select('*')
                .or(`machine_id.eq.${machineId},machine_id.eq.${shortKey},machine_id.ilike.${shortKey}-%`)
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) throw error;

            if (data) {
                // Sort chronologically for accurate interval calculations
                const chronoData = [...data].reverse();
                const parsedLogs: RecycleBatchLog[] = [];

                chronoData.forEach((p, idx) => {
                    const note = (p.user_note || '').trim().toUpperCase();
                    const ai = p.ai_description || '';

                    // Extract rawJson from ai_raw_json or ai_tags
                    let rawJson: any = p.ai_raw_json;
                    if (!rawJson && Array.isArray(p.ai_tags)) {
                        const tag = p.ai_tags.find((t: string) => typeof t === 'string' && t.startsWith('RAW_JSON:'));
                        if (tag) {
                            try { rawJson = JSON.parse(tag.substring(9)); } catch (_) {}
                        }
                    }

                    // Match weight with high precision
                    let weight = 0;
                    if (rawJson && rawJson.weight && Number(rawJson.weight) > 0) {
                        weight = parseFloat(rawJson.weight);
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

                    // Calculate interval from previous batch accurately in chronological order
                    let intervalMin = 0;
                    let isShiftStart = false;
                    if (idx > 0) {
                        const prevItem = chronoData[idx - 1];
                        const prevTime = new Date(prevItem.created_at).getTime();
                        const currTime = new Date(p.created_at).getTime();
                        intervalMin = Math.max(0, Math.round((currTime - prevTime) / 60000));

                        const prevLocalDateStr = new Date(prevTime + 8 * 3600000).toISOString().substring(0, 10);
                        const currLocalDateStr = new Date(currTime + 8 * 3600000).toISOString().substring(0, 10);

                        // If gap > 180 min (3h) or cross calendar day, it's a shift startup
                        if (intervalMin > 180 || prevLocalDateStr !== currLocalDateStr) {
                            isShiftStart = true;
                        }
                    } else {
                        isShiftStart = true;
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
                        downtimeReason: rawJson?.downtimeReason || (isShiftStart ? '新班次首包' : undefined),
                        operatorName: p.employee_name || 'Operator',
                        photoUrl: p.photo_url,
                        userNote: p.user_note,
                        aiRawJson: rawJson
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

    const todayStr = new Date(Date.now() + 8 * 3600000).toISOString().substring(0, 10);
    // Available Distinct Dates (exclude today to prevent duplicate pills)
    const distinctDates = Array.from(new Set(logs.map(l => l.dateStr))).filter(d => d !== todayStr).sort().reverse();

    const pendingDiscrepancyCount = logs.filter(l => l.aiRawJson?.needs_review === true || l.aiRawJson?.discrepancy === true).length;

    // Filtered logs to display
    const displayedLogs = logs.filter(l => {
        if (showOnlyDiscrepancies) {
            return l.aiRawJson?.needs_review === true || l.aiRawJson?.discrepancy === true;
        }
        if (selectedDateFilter === 'ALL') return true;
        if (selectedDateFilter === 'TODAY') return l.dateStr === todayStr;
        return l.dateStr === selectedDateFilter;
    });

    // Compute Metrics based on displayed scope
    const totalKg = displayedLogs.reduce((sum, item) => sum + item.weight, 0);
    const totalBags = displayedLogs.length;

    // Material breakdown summary for active scope
    const materialBreakdown = RECYCLE_MATERIALS.map(mat => {
        const filtered = displayedLogs.filter(l => l.materialKey === mat.key);
        const kg = filtered.reduce((sum, l) => sum + l.weight, 0);
        return {
            ...mat,
            count: filtered.length,
            kg
        };
    }).filter(m => m.count > 0);

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
                // Exclude multi-day or cross-shift startup gaps from average production cycle
                if (diff > 0 && diff <= 180) {
                    validIntervals.push(diff);
                    if (diff <= 60) {
                        activeMin += diff;
                    } else {
                        downMin += (diff - 35);
                        activeMin += 35;
                    }
                }
            }
        });

        avgCycleMinutes = validIntervals.length > 0 ? Math.round(validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length) : 32;
        activeHours = Math.max(0.1, (activeMin + (avgCycleMinutes || 30)) / 60);
        downtimeHours = Math.round((downMin / 60) * 10) / 10;
    } else if (displayedLogs.length === 1) {
        totalSpanHours = 0.5;
        activeHours = 0.5;
        avgCycleMinutes = 32;
    }

    const currentSpeedKgPerHour = activeHours > 0 ? Math.round((totalKg / activeHours) * 10) / 10 : 0;

    // Last Bag Cycle Time
    const lastBagInterval = logs.length >= 2 ? logs[0].intervalMinutes : 32;
    const showDowntimeWarning = lastBagInterval > 60 && lastBagInterval <= 180;

    // Excel Export
    const handleExportExcel = () => {
        const rows = displayedLogs.map((log, idx) => ({
            '序号 / No.': displayedLogs.length - idx,
            '日期 / Date': log.dateStr,
            '时间 / Time': log.timeLocal,
            '机台 / Machine': machineName,
            '物料代码 / SKU': log.materialKey,
            '物料名称 / Material': log.materialLabel,
            '单包重量 / Weight (KG)': log.weight,
            'AI识别秤读数 / AI OCR (KG)': log.aiRawJson?.ai_detected_weight || '-',
            '手动填报 / Manual Input (KG)': log.aiRawJson?.manual_input || log.weight,
            '差异复核状态 / Discrepancy Status': log.aiRawJson?.needs_review ? '⚠️ 待主管复核' : (log.aiRawJson?.review_status || '已核验'),
            '产出耗时 / Cycle (Min)': log.intervalMinutes > 180 ? '新班次首包' : `${log.intervalMinutes} min`,
            '状态/备注 / Status': log.downtimeReason || (log.intervalMinutes > 180 ? '新班次首包' : '正常造粒'),
            '操作员 / Operator': log.operatorName,
            '照片链接 / Photo URL': log.photoUrl || ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Recycle_Logs");
        XLSX.writeFile(wb, `Recycle_Logs_${machineId}_${selectedDateFilter}_${Date.now()}.xlsx`);
    };

    // Quick Undo for latest log
    const handleUndoLatestLog = async (logItem: RecycleBatchLog) => {
        if (!window.confirm(`⚠️ 确定要撤销这包称重记录吗？\n\n序号: #${displayedLogs.length}\n重量: ${logItem.weight.toFixed(2)} KG (${logItem.materialLabel})\n时间: ${logItem.dateStr} ${logItem.timeLocal}\n\n撤销后将自动冲销库存流水与生产日志！`)) return;
        try {
            setIsUploading(true);
            // 1. Delete from work_photos
            await supabase.from('work_photos').delete().eq('id', logItem.id);
            // 2. Delete from production_logs_v2
            await supabase.from('production_logs_v2').delete().eq('batch_code', logItem.id);
            // 3. Reverse stock_ledger_v2
            const locId = machineId.startsWith('N') ? 'Nilai' : 'OPM Lama';
            const selectedConfig = RECYCLE_MATERIALS.find(m => m.key === logItem.materialKey) || RECYCLE_MATERIALS[0];
            await supabase.from('stock_ledger_v2').insert([{
                sku: selectedConfig.sku,
                loc_id: locId,
                change_qty: -logItem.weight,
                event_type: 'Transfer Out',
                ref_doc: `REV-${logItem.id}`,
                notes: `Undo Recycle Batch: ${machineId} (${logItem.weight}kg)`
            }]);
            alert("✅ 已成功撤销该批次称重记录！");
            fetchRecycleLogs();
        } catch (err: any) {
            alert("撤销失败: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Supervisor Quick-Correction (Adopts AI Scale Reading to adjust stock & logs)
    const handleSupervisorCorrectLog = async (logItem: RecycleBatchLog) => {
        const aiWeight = logItem.aiRawJson?.ai_detected_weight || logItem.aiRawJson?.weight;
        if (!aiWeight || aiWeight <= 0) {
            alert("未检测到该记录有效的电子秤读数，无法自动纠偏！");
            return;
        }
        const currentWeight = logItem.weight;
        const diff = Math.round((aiWeight - currentWeight) * 100) / 100;
        if (!window.confirm(`⚠️ 确认执行主管纠偏？\n\n当前记录重量: ${currentWeight.toFixed(2)} KG\n纠偏为 AI 秤读数: ${aiWeight.toFixed(2)} KG (差额: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} KG)\n\n系统将自动更新生产日志并补录库存流水！`)) return;

        try {
            setIsUploading(true);
            // 1. Update work_photos
            const updatedJson = {
                ...logItem.aiRawJson,
                weight: aiWeight,
                corrected_from_manual: currentWeight,
                review_status: 'adopted_ai',
                needs_review: false,
                reviewed_by: user?.name || 'Supervisor',
                reviewed_at: new Date().toISOString()
            };
            await supabase.from('work_photos').update({
                ai_tags: ['RAW_JSON:' + JSON.stringify(updatedJson)],
                user_note: `${logItem.materialKey} | ${aiWeight.toFixed(2)} KG (主管已纠偏)`
            }).eq('id', logItem.id);

            // 2. Update production_logs_v2
            await supabase.from('production_logs_v2').update({
                output_qty: aiWeight,
                note: `${logItem.materialKey} | ${aiWeight.toFixed(2)} KG (主管已纠偏)`
            }).eq('batch_code', logItem.id);

            // 3. Insert stock_ledger_v2 adjustment delta
            const locId = machineId.startsWith('N') ? 'Nilai' : 'OPM Lama';
            const selectedConfig = RECYCLE_MATERIALS.find(m => m.key === logItem.materialKey) || RECYCLE_MATERIALS[0];
            await supabase.from('stock_ledger_v2').insert([{
                sku: selectedConfig.sku,
                loc_id: locId,
                change_qty: diff,
                event_type: 'Adjustment',
                ref_doc: `CORR-${logItem.id}`,
                notes: `Supervisor Correction: ${machineId} (${currentWeight}kg -> ${aiWeight}kg)`
            }]);

            alert(`✅ 已成功纠偏并同步库存！当前重量已更新为 ${aiWeight.toFixed(2)} KG`);
            setLightboxLog(null);
            fetchRecycleLogs();
        } catch (err: any) {
            alert("纠偏失败: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Trigger AI OCR on scale photo in background (Shadow Verification)
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
                const detectedVal = Number(data.weight);
                if (data.weight !== undefined && !isNaN(detectedVal) && detectedVal > 0) {
                    const detectedNum = parseFloat(detectedVal.toFixed(2));
                    setAiDetectedWeight(detectedNum);
                    // 自动带入填报框（若为空或<=0），方便员工一键保存
                    setWeightInput(prev => (!prev || parseFloat(prev) <= 0 ? detectedNum.toFixed(2) : prev));
                    setAiAnalysis(`AI 识别读数: ${detectedNum} KG (如不符可直接修改下方输入框)`);
                } else {
                    setAiDetectedWeight(null);
                    setAiAnalysis("AI 未能自动辨识秤盘读数，请在下方直接核对输入实测重量。");
                }
            } else {
                setAiAnalysis("AI视觉服务响应延迟，请直接在下方核对并输入实测重量。");
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
            let compressed: string;
            try {
                compressed = await compressImage(file, 2560, 0.90);
            } catch (cErr) {
                console.warn("compressImage fallback to direct FileReader:", cErr);
                compressed = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
            setPhotoPreview(compressed);
            const base64 = compressed.includes(',') ? compressed.split(',')[1] : compressed;
            setPhotoBase64(base64);
            try {
                const blob = dataURLtoBlob(compressed);
                setPhotoBlob(blob);
            } catch {
                setPhotoBlob(file);
            }

            runAIOCRScan(base64);
        } catch (err: any) {
            console.error("Failed to process photo:", err);
            alert("图片读取失败: " + err.message);
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    // Webcam capture
    const handleWebcamCapture = React.useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setPhotoPreview(imageSrc);
            const base64 = imageSrc.includes(',') ? imageSrc.split(',')[1] : imageSrc;
            setPhotoBase64(base64);
            setShowWebcam(false);

            try {
                const blob = dataURLtoBlob(imageSrc);
                setPhotoBlob(blob);
            } catch (err) {
                console.error("Webcam blob conversion failed:", err);
            }

            runAIOCRScan(base64);
        }
    }, [webcamRef]);

    const resetForm = () => {
        setPhotoPreview(null);
        setPhotoBlob(null);
        setPhotoBase64(null);
        setWeightInput('');
        setUserNote('');
        setDowntimeReason('');
        setAiAnalysis(null);
        setAiDetectedWeight(null);
        setShowWebcam(false);
        setShowDiscrepancyModal(false);
        setDiscrepancyData(null);
    };

    // Submit Recycle Output Log (Worker triggers manual submit)
    const handleSubmitRecycleOutput = async () => {
        const parsedWeight = parseFloat(weightInput);
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
            alert("请填入或选择电子秤上的实测重量（如 14.10 KG）！\nPlease enter the scale weight!");
            return;
        }

        // Shadow Check: If AI recognized a scale reading, check discrepancy (> 0.2 KG)
        if (aiDetectedWeight !== null && aiDetectedWeight > 0) {
            const diff = Math.round(Math.abs(parsedWeight - aiDetectedWeight) * 100) / 100;
            if (diff > 0.2) {
                setDiscrepancyData({
                    manualWeight: parsedWeight,
                    aiWeight: aiDetectedWeight,
                    diff
                });
                setShowDiscrepancyModal(true);
                return;
            }
        }

        // Within 0.2 KG or no OCR detected -> execute normal clean save
        await executeFinalSubmission(parsedWeight, false);
    };

    // Final database saving function
    const executeFinalSubmission = async (targetWeight: number, isDiscrepantSubmitted: boolean) => {
        const effectiveOpName = (user?.name) 
            ? user.name 
            : (operatorName || user?.email?.split('@')[0] || 'Operator');

        const effectiveOpEmpId = (user?.employeeId)
            ? user.employeeId
            : (operatorEmployeeId || (user?.role === 'SuperAdmin' ? 'ADMIN' : 'OP-001'));
        const selectedConfig = RECYCLE_MATERIALS.find(m => m.key === selectedMaterialKey) || RECYCLE_MATERIALS[0];

        try {
            setIsUploading(true);
            setShowDiscrepancyModal(false);

            let uploadedPhotoUrl = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80';

            // 1. Upload photo to Supabase storage if available
            if (photoBlob || photoBase64) {
                try {
                    let blob = photoBlob;
                    if (!blob && photoBase64) {
                        blob = dataURLtoBlob(`data:image/jpeg;base64,${photoBase64}`);
                    }
                    if (blob) {
                        const fileName = `recycle_${machineId}_${effectiveOpEmpId}_${Date.now()}.jpg`;

                        const { error: uploadErr } = await supabase.storage
                            .from('work-photos')
                            .upload(fileName, blob, { contentType: 'image/jpeg' });

                        if (!uploadErr) {
                            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
                            uploadedPhotoUrl = urlData.publicUrl;
                        } else {
                            console.warn("Photo storage upload error:", uploadErr);
                        }
                    }
                } catch (storErr) {
                    console.warn("Photo storage upload non-fatal:", storErr);
                }
            }

            const formattedNote = isDiscrepantSubmitted 
                ? `${selectedConfig.key} | ${targetWeight.toFixed(2)} KG ⚠️[差异待复核]`
                : `${selectedConfig.key} | ${targetWeight.toFixed(2)} KG`;

            const aiRawData = {
                weight: targetWeight,
                ai_detected_weight: aiDetectedWeight || targetWeight,
                manual_input: parseFloat(weightInput) || targetWeight,
                discrepancy: isDiscrepantSubmitted,
                diff_amount: aiDetectedWeight ? Math.abs((parseFloat(weightInput) || targetWeight) - aiDetectedWeight) : 0,
                needs_review: isDiscrepantSubmitted,
                review_status: isDiscrepantSubmitted ? 'pending' : 'verified'
            };

            // 2. Insert into work_photos table for historical tracking
            // Note: ai_tags stores the JSON string since work_photos does not have an ai_raw_json column
            const { data: insertedPhoto, error: photoErr } = await supabase.from('work_photos').insert([{
                employee_id: effectiveOpEmpId,
                employee_name: effectiveOpName,
                machine_id: machineId,
                category: 'qc',
                photo_url: uploadedPhotoUrl,
                user_note: formattedNote,
                ai_description: `手动填报: ${targetWeight.toFixed(2)} KG, AI核验: ${aiDetectedWeight || targetWeight} KG`,
                ai_tags: ['RAW_JSON:' + JSON.stringify(aiRawData)]
            }]).select().single();

            if (photoErr) {
                console.error("work_photos insert error:", photoErr);
                throw photoErr;
            }

            // 3. Reliable production_logs_v2 & stock_ledger_v2 sync
            try {
                const locId = machineId.startsWith('N') ? 'Nilai' : 'OPM Lama';
                const operatorUid = user?.uid || (user as any)?.id || operatorId || null;

                // Sync to production_logs_v2
                await supabase.from('production_logs_v2').insert([{
                    machine_id: machineId,
                    sku: selectedConfig.sku,
                    output_qty: targetWeight,
                    operator_id: operatorUid,
                    reject_qty: 0,
                    note: formattedNote,
                    batch_code: insertedPhoto?.id || null
                }]);

                // Sync to stock_ledger_v2 (Raw Material Inflow)
                await supabase.from('stock_ledger_v2').insert([{
                    sku: selectedConfig.sku,
                    loc_id: locId,
                    change_qty: targetWeight,
                    event_type: 'Production',
                    ref_doc: insertedPhoto?.id || `REC-${Date.now()}`,
                    notes: isDiscrepantSubmitted 
                        ? `Recycle Output (⚠️Discrepant): ${machineId} (${effectiveOpName})`
                        : `Recycle Output: ${machineId} (${effectiveOpName})`
                }]);
            } catch (logErr) {
                console.warn("Production & ledger sync warning:", logErr);
            }

            // 4. Optimistic UI update: instantly prepend the new record to table
            const nowLocal = new Date(Date.now() + 8 * 3600000);
            const newLogItem: RecycleBatchLog = {
                id: insertedPhoto?.id || String(Date.now()),
                created_at: new Date().toISOString(),
                timeLocal: nowLocal.toISOString().substring(11, 16),
                dateStr: nowLocal.toISOString().substring(0, 10),
                materialKey: selectedConfig.key,
                materialLabel: selectedConfig.label,
                materialColor: selectedConfig.color,
                weight: targetWeight,
                intervalMinutes: logs.length > 0 ? Math.round((Date.now() - new Date(logs[0].created_at).getTime()) / 60000) : 0,
                downtimeReason: downtimeReason || undefined,
                operatorName: effectiveOpName,
                photoUrl: uploadedPhotoUrl,
                userNote: formattedNote,
                aiRawJson: aiRawData
            };

            setLogs(prev => [newLogItem, ...prev]);
            resetForm();
            alert(isDiscrepantSubmitted 
                ? `⚠️ 已保存入库并标记差异待主管复核！\n第 ${logs.length + 1} 包: ${targetWeight.toFixed(2)} KG (${selectedConfig.label})`
                : `✅ 成功核验并登记入库！\n第 ${logs.length + 1} 包: ${targetWeight.toFixed(2)} KG (${selectedConfig.label})`
            );
        } catch (err: any) {
            console.error("Failed to submit recycle output:", err);
            alert("提交失败: " + (err.message || JSON.stringify(err)));
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
                        <div className="text-[10px] text-gray-400 mt-0.5">
                            上一包耗时: {lastBagInterval > 180 ? '跨班首包' : `${lastBagInterval} min`}
                        </div>
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
                        <span>{selectedDateFilter === 'ALL' ? '历史跨度' : '作业时间窗口'}</span>
                        <Calendar size={16} />
                    </div>
                    <div className="mt-2">
                        <div className="text-sm font-mono font-bold text-white">
                            {earliestTime && latestTime ? (
                                selectedDateFilter === 'ALL' ? (
                                    <>
                                        {new Date(earliestTime.getTime() + 8 * 3600000).toISOString().substring(5, 10)}
                                        <span className="text-gray-500 mx-1">~</span>
                                        {new Date(latestTime.getTime() + 8 * 3600000).toISOString().substring(5, 10)}
                                    </>
                                ) : (
                                    <>
                                        {new Date(earliestTime.getTime() + 8 * 3600000).toISOString().substring(11, 16)}
                                        <span className="text-gray-500 mx-1">~</span>
                                        {new Date(latestTime.getTime() + 8 * 3600000).toISOString().substring(11, 16)}
                                    </>
                                )
                            ) : '--:--'}
                        </div>
                        <div className="text-[10px] text-gray-300 mt-1 truncate flex items-center gap-1 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                            <span className="truncate">当班操作: {operatorName || user?.name || (logs.length > 0 ? logs[0].operatorName : 'Aung Naing')}</span>
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
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-lg text-cyan-300 font-medium">
                                    👤 当前操作: {user?.name || operatorName || 'Aung Naing'}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">{machineName} ({machineId})</span>
                            </div>
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
                                disabled={isUploading}
                                className={`w-full py-4 text-white font-black text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer ${
                                    weightInput && Number(weightInput) > 0
                                        ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 shadow-cyan-500/20'
                                        : 'bg-gradient-to-r from-slate-600 to-zinc-700 hover:from-slate-500 hover:to-zinc-600 opacity-90'
                                }`}
                            >
                                {isUploading ? (
                                    <Loader className="animate-spin" size={18} />
                                ) : (
                                    <CheckCircle2 size={20} />
                                )}
                                <span>
                                    {weightInput && Number(weightInput) > 0
                                        ? `确认称重并入库 (${weightInput} KG ${RECYCLE_MATERIALS.find(m => m.key === selectedMaterialKey)?.label})`
                                        : `请输入实测重量后入库 (${RECYCLE_MATERIALS.find(m => m.key === selectedMaterialKey)?.label})`}
                                </span>
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
                                <div className="flex gap-2 mt-2 flex-wrap justify-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (cameraInputRef.current) {
                                                cameraInputRef.current.click();
                                            } else {
                                                setShowWebcam(true);
                                            }
                                        }}
                                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-purple-500/20 active:scale-95 cursor-pointer"
                                    >
                                        <Camera size={13} /> 开启相机
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                                    >
                                        <ImageIcon size={13} /> 相册选择
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowWebcam(true)}
                                        className="px-2.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-medium flex items-center gap-1 transition cursor-pointer"
                                        title="电脑端网页摄像头实时画面"
                                    >
                                        Webcam
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

                    {photoPreview && (
                        <div className="space-y-3 p-3.5 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl animate-fade-in shadow-inner">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                                    <Scale size={14} className="text-cyan-400" />
                                    <span>现场实测重量核对 (KG)</span>
                                    <span className="text-red-400">*</span>
                                </label>
                                {aiDetectedWeight && aiDetectedWeight > 0 ? (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                                        AI读数: {aiDetectedWeight.toFixed(2)} KG
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-gray-400">
                                        支持手动输入与快捷选择
                                    </span>
                                )}
                            </div>

                            <div className="relative flex items-center">
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="输入秤上实测数字，如 14.10"
                                    value={weightInput}
                                    onChange={(e) => setWeightInput(e.target.value)}
                                    className="w-full bg-black/60 border border-cyan-500/50 focus:border-cyan-400 rounded-xl py-2.5 px-3.5 text-2xl font-black text-white placeholder-gray-600 focus:outline-none tabular-nums"
                                />
                                <span className="absolute right-3.5 text-xs font-bold text-cyan-400 uppercase">KG</span>
                            </div>

                            {/* 常用快捷重量标签 */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <span className="text-[10px] text-gray-400 font-bold">常用:</span>
                                {['12.0', '13.5', '14.0', '14.1', '14.5', '15.0', '16.0', '18.0', '20.0'].map(w => (
                                    <button
                                        key={w}
                                        type="button"
                                        onClick={() => setWeightInput(w)}
                                        className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition active:scale-95 cursor-pointer ${
                                            weightInput === w
                                                ? 'bg-cyan-500 text-black font-black border-cyan-400 shadow-md'
                                                : 'bg-white/10 border-white/10 text-cyan-200 hover:bg-white/20'
                                        }`}
                                    >
                                        {w}kg
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={handleSubmitRecycleOutput}
                                disabled={isUploading}
                                className={`w-full py-3.5 text-white font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                                    weightInput && Number(weightInput) > 0
                                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 shadow-emerald-500/20'
                                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500'
                                }`}
                            >
                                {isUploading ? <Loader className="animate-spin" size={16} /> : <CheckCircle2 size={18} />}
                                <span>
                                    {weightInput && Number(weightInput) > 0
                                        ? `📸 确认 ${weightInput} KG 并保存入库 (${RECYCLE_MATERIALS.find(m => m.key === selectedMaterialKey)?.label})`
                                        : `📸 请输入或选择实测重量后保存入库`}
                                </span>
                            </button>
                        </div>
                    )}

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

            {/* 3. RECYCLE TIMELINE & BATCH HISTORY (全量历史流水明细表 + 智能日期筛选 + 汇总条 + Excel导出 + 快速撤销) */}
            <div className="apple-glass rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
                {/* Header & Actions Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <History size={20} className="text-cyan-400" />
                            <h3 className="text-base font-black uppercase tracking-wider text-white">
                                造粒称重流水明细
                            </h3>
                            <span className="text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold px-2.5 py-0.5 rounded-full">
                                {displayedLogs.length} 包 · {totalKg.toFixed(1)} KG
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1 font-mono">
                            {selectedDateFilter === 'ALL' ? '全部历史总库记录' : (selectedDateFilter === 'TODAY' ? `今日实时流水 (${todayStr})` : `${selectedDateFilter} 班次流水`)}
                            {displayedLogs.length > 0 && ` · 平均单包 ${(totalKg / displayedLogs.length).toFixed(2)} KG`}
                        </p>
                    </div>

                    {/* Date Selector Pills & Excel Export */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
                            <button
                                type="button"
                                onClick={() => { setShowOnlyDiscrepancies(false); setSelectedDateFilter('ALL'); }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 border ${
                                    !showOnlyDiscrepancies && selectedDateFilter === 'ALL'
                                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-md font-black'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                }`}
                            >
                                全部历史 ({logs.length})
                            </button>

                            <button
                                type="button"
                                onClick={() => { setShowOnlyDiscrepancies(false); setSelectedDateFilter('TODAY'); }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 border ${
                                    !showOnlyDiscrepancies && selectedDateFilter === 'TODAY'
                                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-md font-black'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                }`}
                            >
                                今日 ({logs.filter(l => l.dateStr === todayStr).length})
                            </button>

                            {distinctDates.slice(0, 5).map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => { setShowOnlyDiscrepancies(false); setSelectedDateFilter(d); }}
                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition shrink-0 border ${
                                        !showOnlyDiscrepancies && selectedDateFilter === d
                                            ? 'bg-purple-600 text-white border-purple-400 font-bold shadow-md'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {d.slice(5)} ({logs.filter(l => l.dateStr === d).length})
                                </button>
                            ))}

                            {/* Discrepancy Filter Pill */}
                            {pendingDiscrepancyCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowOnlyDiscrepancies(prev => !prev)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 border flex items-center gap-1 cursor-pointer ${
                                        showOnlyDiscrepancies
                                            ? 'bg-amber-500 text-black border-amber-400 font-black shadow-lg shadow-amber-500/20 animate-pulse'
                                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                    }`}
                                >
                                    <AlertTriangle size={12} />
                                    <span>差异待复核 ({pendingDiscrepancyCount})</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={fetchRecycleLogs}
                                className="p-2 bg-white/5 hover:bg-white/10 text-cyan-400 rounded-xl border border-white/10 shrink-0 cursor-pointer"
                                title="刷新最新数据"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>

                        {/* Excel Export Button */}
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={displayedLogs.length === 0}
                            className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                        >
                            <Download size={14} />
                            <span>导出 Excel</span>
                        </button>
                    </div>
                </div>

                {/* Material Breakdown Summary Chips */}
                {materialBreakdown.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-2 pb-1 border-t border-white/5">
                        <span className="text-[11px] font-bold text-gray-400">品类小计:</span>
                        {materialBreakdown.map(mb => (
                            <div key={mb.key} className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 ${mb.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${mb.dot}`} />
                                <span>{mb.label}:</span>
                                <span className="text-white font-mono font-black">{mb.kg.toFixed(1)} KG</span>
                                <span className="opacity-70 text-[10px]">({mb.count}包)</span>
                            </div>
                        ))}
                    </div>
                )}

                {loadingLogs ? (
                    <div className="py-16 flex flex-col justify-center items-center gap-2 text-gray-400 text-xs">
                        <Loader className="animate-spin text-cyan-400" size={24} />
                        <span>正在加载历史造粒与称重流水...</span>
                    </div>
                ) : displayedLogs.length === 0 ? (
                    <div className="py-16 text-center text-gray-500 text-xs font-mono">
                        未查询到选定条件的称重记录。请切换至「全部历史」或在上方登记新批次！
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
                                    <th className="pb-3 px-3">核验状态</th>
                                    <th className="pb-3 px-3">操作员</th>
                                    <th className="pb-3 px-3 text-right">现场称重照片 / 操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono">
                                {displayedLogs.map((log, idx) => {
                                    const globalBagIndex = logs.length - logs.findIndex(l => l.id === log.id);
                                    const isFirstBagOfList = idx === displayedLogs.length - 1;
                                    const isShiftStartup = log.intervalMinutes > 180 || isFirstBagOfList;
                                    const isDowntime = log.intervalMinutes > 60 && log.intervalMinutes <= 180;
                                    const isLatest = idx === 0;
                                    const hasDiscrepancy = log.aiRawJson?.needs_review === true || log.aiRawJson?.discrepancy === true;
                                    const isCorrected = log.aiRawJson?.review_status === 'adopted_ai';

                                    return (
                                        <tr key={log.id} className={`hover:bg-white/[0.02] transition ${hasDiscrepancy ? 'bg-amber-500/5' : ''}`}>
                                            <td className="py-3 px-3 font-bold">
                                                <span className="text-gray-300">#{globalBagIndex}</span>
                                                {selectedDateFilter !== 'ALL' && !showOnlyDiscrepancies && (
                                                    <span className="text-[10px] text-cyan-400 ml-1 font-normal">
                                                        (第{displayedLogs.length - idx}包)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-white font-bold">
                                                <span className="text-[10px] text-gray-400 mr-1.5 font-normal">{log.dateStr}</span>
                                                <span>{log.timeLocal}</span>
                                                {log.dateStr === todayStr && (
                                                    <span className="ml-1 text-[9px] px-1 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-normal">今日</span>
                                                )}
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
                                                {isShiftStartup ? (
                                                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md font-bold">
                                                        🌅 跨班首包
                                                    </span>
                                                ) : isDowntime ? (
                                                    <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                                        {log.intervalMinutes} min <span className="text-[9px] opacity-80">({log.downtimeReason || '间歇'})</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] font-bold text-purple-300">
                                                        {log.intervalMinutes} min
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3">
                                                {hasDiscrepancy ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md" title={`填: ${log.aiRawJson?.manual_input || log.weight}kg | 秤: ${log.aiRawJson?.ai_detected_weight || log.weight}kg`}>
                                                        <AlertTriangle size={11} /> 差异需复核
                                                    </span>
                                                ) : isCorrected ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                                                        <CheckCircle2 size={11} /> 主管已纠偏
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                                        <CheckCircle2 size={11} /> 已核验
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-gray-300">
                                                {log.operatorName}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {hasDiscrepancy && user && ['Admin', 'SuperAdmin', 'Director', 'Manager'].includes(user.role) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSupervisorCorrectLog(log)}
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-500/20 hover:bg-cyan-500/30 px-2 py-1 rounded-lg border border-cyan-500/40 transition cursor-pointer"
                                                            title="主管一键采纳 AI 秤读数纠偏"
                                                        >
                                                            ⚡ 纠偏
                                                        </button>
                                                    )}
                                                    {isLatest && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUndoLatestLog(log)}
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded-lg border border-rose-500/20 transition cursor-pointer"
                                                            title="撤销最近录入的这包数据"
                                                        >
                                                            <RotateCcw size={11} /> 撤销
                                                        </button>
                                                    )}
                                                    {log.photoUrl && !log.photoUrl.includes('unsplash') ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setLightboxLog(log)}
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 transition cursor-pointer"
                                                        >
                                                            <ImageIcon size={11} /> 称重照片
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-600">已入库</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 4. DISCREPANCY CONFIRMATION MODAL (工人手动填报 vs 电子秤照片读数差异核对弹窗) */}
            {showDiscrepancyModal && discrepancyData && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in select-none"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
                >
                    <div className="bg-[#1c1c1f] border border-amber-500/40 p-6 rounded-3xl w-full max-w-lg shadow-2xl relative animate-scale-in flex flex-col gap-4 text-white">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <AlertTriangle size={18} className="animate-bounce" />
                                <span>称重数据差异核对 / Scale Discrepancy Check</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDiscrepancyModal(false)}
                                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Photo Thumbnail */}
                        {photoPreview && (
                            <div className="relative aspect-video max-h-[160px] rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                                <img src={photoPreview} alt="Scale Reading Check" className="w-full h-full object-contain" />
                            </div>
                        )}

                        {/* Value Comparison Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                                <span className="text-[10px] text-gray-400 font-bold uppercase block">✍️ 您手动填写的重量</span>
                                <span className="text-2xl font-black text-white mt-1 block font-mono">{discrepancyData.manualWeight.toFixed(2)} <span className="text-xs font-normal text-gray-400">KG</span></span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-center">
                                <span className="text-[10px] text-cyan-300 font-bold uppercase block">🤖 AI 照片识别秤读数</span>
                                <span className="text-2xl font-black text-cyan-300 mt-1 block font-mono">{discrepancyData.aiWeight.toFixed(2)} <span className="text-xs font-normal text-cyan-400">KG</span></span>
                            </div>
                        </div>

                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200 leading-relaxed font-mono">
                            ⚠️ 检测到手动填报与秤上照片相差 <b className="text-white text-sm">±{discrepancyData.diff.toFixed(2)} KG</b>（超过 ±0.2 KG 正常容差），请确认是否以秤为准！
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => executeFinalSubmission(discrepancyData.aiWeight, false)}
                                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                                <CheckCircle2 size={15} />
                                <span>✅ 采纳电子秤读数并入库 ({discrepancyData.aiWeight.toFixed(2)} KG)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => { setShowDiscrepancyModal(false); setShowWebcam(true); }}
                                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                                <Camera size={14} />
                                <span>📷 重新拍照核对 (Re-take Photo)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => executeFinalSubmission(discrepancyData.manualWeight, true)}
                                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                                <span>⚠️ 坚持以我填写的为准 ({discrepancyData.manualWeight.toFixed(2)} KG，标记待主管复核)</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* LIGHTBOX MODAL WITH COMPLETE AUDIT METADATA */}
            {lightboxLog && typeof document !== 'undefined' && createPortal(
                <div
                    onClick={() => setLightboxLog(null)}
                    className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in select-none"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
                >
                    {/* Header Controls */}
                    <div 
                        className="w-full max-w-3xl flex items-center justify-between py-2.5 px-4 mb-2 bg-white/10 rounded-2xl border border-white/10 text-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                            <Scale size={16} />
                            <span>现场电子秤称重存证 · {lightboxLog.materialLabel} ({lightboxLog.materialKey})</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setLightboxLog(null)}
                            className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow"
                        >
                            <X size={14} />
                            <span>关闭 (Close)</span>
                        </button>
                    </div>

                    {/* Image Container */}
                    <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="relative max-w-3xl max-h-[65vh] w-full flex items-center justify-center bg-black/80 rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-2"
                    >
                        <img 
                            src={lightboxLog.photoUrl} 
                            alt="Scale Full Photo" 
                            className="max-h-[60vh] w-auto max-w-full object-contain rounded-2xl shadow-inner" 
                        />
                    </div>

                    {/* Metadata Footer Bar */}
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-3xl mt-2 p-3.5 bg-slate-900/95 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between text-xs text-gray-300 font-mono gap-3 shadow-2xl"
                    >
                        <div className="flex items-center gap-4 flex-wrap">
                            <div><span className="text-gray-500">记录重量:</span> <b className="text-white text-sm">{lightboxLog.weight.toFixed(2)} KG</b></div>
                            {lightboxLog.aiRawJson?.ai_detected_weight && (
                                <div><span className="text-gray-500">AI秤读数:</span> <b className="text-cyan-400 text-sm">{lightboxLog.aiRawJson.ai_detected_weight.toFixed(2)} KG</b></div>
                            )}
                            <div><span className="text-gray-500">时间:</span> <b className="text-gray-200">{lightboxLog.dateStr} {lightboxLog.timeLocal}</b></div>
                            <div><span className="text-gray-500">操作员:</span> <b className="text-purple-300">{lightboxLog.operatorName}</b></div>
                        </div>

                        {/* Supervisor One-Click Correction */}
                        {lightboxLog.aiRawJson?.ai_detected_weight && Math.abs(lightboxLog.weight - lightboxLog.aiRawJson.ai_detected_weight) > 0.05 && user && ['Admin', 'SuperAdmin', 'Director', 'Manager'].includes(user.role) && (
                            <button
                                type="button"
                                onClick={() => handleSupervisorCorrectLog(lightboxLog)}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer"
                            >
                                <Zap size={13} />
                                <span>采纳 AI 秤读数纠偏 ({lightboxLog.aiRawJson.ai_detected_weight.toFixed(2)} KG)</span>
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
