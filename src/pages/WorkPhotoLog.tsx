import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { Camera, Send, Loader, Tag, AlertTriangle, Clock, X, Sparkles, Image as ImageIcon, RefreshCw, Video, Square, Zap } from 'lucide-react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { useTranslation } from "react-i18next";
import i18next from "i18next";

interface WorkPhoto {
    id: string;
    employee_id: string;
    employee_name: string;
    photo_url: string;
    ai_description: string;
    user_note: string;
    category: string;
    ai_tags: string[];
    risk_flag: boolean;
    risk_reason: string;
    created_at: string;
    machine_id?: string;
    ai_raw_json?: any;
}

interface AIResult {
    description: string;
    category: string;
    tags: string[];
    risk_flag: boolean;
    risk_reason: string;
}

const CATEGORIES: Record<string, { label: string; emoji: string; color: string }> = {
    qc: { label: i18next.t('qc'), emoji: '🔍', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    defect: { label: i18next.t('defect'), emoji: '⚠️', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    downtime: { label: i18next.t('stop'), emoji: '🛑', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    startup: { label: i18next.t('start'), emoji: '🟢', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    other: { label: i18next.t('other'), emoji: '📋', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
};

interface Props {
    user: User | null;
}

// Image compression utility
const compressImage = (file: File, maxWidth = 2048, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const WorkPhotoLog: React.FC<Props> = ({ user }) => {
    const { t } = useTranslation();
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewBase64, setPreviewBase64] = useState<string | null>(null);
    const [aiResult, setAiResult] = useState<AIResult | null>(null);
    const [userNote, setUserNote] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [selectedPhoto, setSelectedPhoto] = useState<WorkPhoto | null>(null);
    const [isZoomed, setIsZoomed] = useState<boolean>(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    useEffect(() => {
        setIsZoomed(false);
    }, [selectedPhoto]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showWebcam, setShowWebcam] = useState(false);
    const [webcamError, setWebcamError] = useState<any>(null);
    const webcamRef = useRef<Webcam>(null);

    // Video Recording States
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunks = useRef<Blob[]>([]);
    const recordingTimer = useRef<any>(null);

    const [machines, setMachines] = useState<any[]>([]);
    const [selectedMachineId, setSelectedMachineId] = useState<string>('');

    const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'Director';

    // Load photos
    const loadPhotos = async () => {
        setLoading(true);
        let query = supabase
            .from('work_photos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        // Non-admin only sees their own
        if (!isAdmin && user?.employeeId) {
            query = query.eq('employee_id', user.employeeId);
        }

        if (filterCategory !== 'all' && filterCategory !== 'discrepancy') {
            query = query.eq('category', filterCategory);
        }

        const { data, error } = await query;
        if (error) console.error('Load photos error:', error);
        let list = data || [];
        if (filterCategory === 'discrepancy') {
            list = list.filter(p => p.ai_raw_json?.needs_review === true || p.ai_raw_json?.discrepancy === true);
        }
        setPhotos(list);
        setLoading(false);
    };

    useEffect(() => { loadPhotos(); }, [filterCategory]);

    useEffect(() => {
        const loadMachines = async () => {
            const { data } = await supabase.from('sys_machines_v2').select('machine_id, name').order('name');
            if (data) setMachines(data);
        };
        loadMachines();
    }, []);

    // Supervisor One-Click Correction
    const handleSupervisorCorrect = async (photo: WorkPhoto) => {
        const aiWeight = photo.ai_raw_json?.ai_detected_weight || photo.ai_raw_json?.weight;
        if (!aiWeight || aiWeight <= 0) {
            alert("未找到该记录的 AI 识别秤读数，无法自动纠偏！");
            return;
        }
        const noteMatch = (photo.user_note || '').match(/([\d.]+)\s*KG/i);
        const currentWeight = photo.ai_raw_json?.manual_input || (noteMatch ? parseFloat(noteMatch[1]) : aiWeight);
        const diff = Math.round((aiWeight - currentWeight) * 100) / 100;
        if (!window.confirm(`⚠️ 确认执行主管纠偏？\n\n当前记录重量: ${currentWeight.toFixed(2)} KG\n纠偏为 AI 秤读数: ${aiWeight.toFixed(2)} KG (差额: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} KG)\n\n系统将自动更新生产日志并补录库存流水！`)) return;

        try {
            setUploading(true);
            // 1. Update work_photos
            const updatedJson = {
                ...photo.ai_raw_json,
                weight: aiWeight,
                corrected_from_manual: currentWeight,
                review_status: 'adopted_ai',
                needs_review: false,
                reviewed_by: user?.name || 'Supervisor',
                reviewed_at: new Date().toISOString()
            };
            await supabase.from('work_photos').update({
                ai_raw_json: updatedJson,
                user_note: `${(photo.user_note || '').split('|')[0] || ''}| ${aiWeight.toFixed(2)} KG (主管已纠偏)`
            }).eq('id', photo.id);

            // 2. Update production_logs_v2
            await supabase.from('production_logs_v2').update({
                output_qty: aiWeight,
                note: `主管纠偏为 AI 秤读数 (${aiWeight}kg)`
            }).eq('batch_code', photo.id);

            // 3. Insert stock_ledger_v2 adjustment delta
            const locId = (photo.machine_id && photo.machine_id.startsWith('N')) ? 'Nilai' : 'OPM Lama';
            const matKey = (photo.user_note || '').split('|')[0]?.trim() || 'SF.W';
            const RECYCLE_MATERIALS_MAP: Record<string, string> = {
                'SF.W': 'RM-REC-SFW',
                'SF.B': 'RM-REC-SFB',
                'BW.W': 'RM-REC-BWW',
                'BW.B': 'RM-REC-BWB',
                'MIX': 'RM-REC-MIX'
            };
            const sku = RECYCLE_MATERIALS_MAP[matKey] || 'RM-REC-SFW';

            await supabase.from('stock_ledger_v2').insert([{
                sku: sku,
                loc_id: locId,
                change_qty: diff,
                event_type: 'Adjustment',
                ref_doc: `CORR-${photo.id}`,
                notes: `Supervisor Correction: ${photo.machine_id} (${currentWeight}kg -> ${aiWeight}kg)`
            }]);

            alert(`✅ 已成功纠偏并同步库存！当前重量已更新为 ${aiWeight.toFixed(2)} KG`);
            setSelectedPhoto(null);
            loadPhotos();
        } catch (err: any) {
            alert("纠偏失败: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    // Handle file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            setSelectedFile(file); // Save uncompressed original file
            const isVideoFile = file.type.startsWith('video/');
            setMediaType(isVideoFile ? 'video' : 'image');

            if (isVideoFile) {
                const videoUrl = URL.createObjectURL(file);
                setPreviewUrl(videoUrl);
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    setPreviewBase64(base64.split(',')[1]);
                };
                reader.readAsDataURL(file);

                setAiResult({
                    description: t('Work Video Log / Work Video Log'),
                    category: 'other',
                    tags: ['video'],
                    risk_flag: false,
                    risk_reason: ''
                });
            } else {
                // Compress image
                const dataUrl = await compressImage(file);
                setPreviewUrl(dataUrl);

                // Extract base64
                const base64 = dataUrl.split(',')[1];
                setPreviewBase64(base64);

                // Call AI
                setAnalyzing(true);
                try {
                    const res = await fetch('/api/agent/ai-photo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageBase64: base64 })
                    });

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || 'AI analysis failed');
                    }

                    const result: AIResult = await res.json();
                    setAiResult(result);
                } catch (aiErr: any) {
                    console.error('AI Error:', aiErr);
                    setAiResult({
                        description: '',
                        category: 'other',
                        tags: [],
                        risk_flag: false,
                        risk_reason: ''
                    });
                }
                setAnalyzing(false);
            }
        } catch (err: any) {
            console.error('File process error:', err);
            alert(t('Failed to process file:') + err.message);
        } finally {
            setUploading(false);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const stopRecordingAndCleanup = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (recordingTimer.current) {
            clearInterval(recordingTimer.current);
            recordingTimer.current = null;
        }
        setIsRecording(false);
        setRecordingDuration(0);
        recordedChunks.current = [];
    };

    const handleCloseWebcam = () => {
        stopRecordingAndCleanup();
        setShowWebcam(false);
        setWebcamError(null);
    };

    const handleWebcamCapture = React.useCallback(async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setPreviewUrl(imageSrc);
            setMediaType('image');
            const base64 = imageSrc.split(',')[1];
            setPreviewBase64(base64);
            setShowWebcam(false);
            
            setAnalyzing(true);
            try {
                const res = await fetch('/api/agent/ai-photo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: base64 })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'AI analysis failed');
                }

                const result: AIResult = await res.json();
                setAiResult(result);
            } catch (aiErr: any) {
                console.error('AI Error:', aiErr);
                setAiResult({
                    description: '',
                    category: 'other',
                    tags: [],
                    risk_flag: false,
                    risk_reason: ''
                });
            }
            setAnalyzing(false);
        }
    }, [webcamRef]);

    const handleStartRecording = () => {
        const stream = webcamRef.current?.video?.srcObject as MediaStream;
        if (!stream) {
            alert(t('Unable to get camera video stream'));
            return;
        }

        recordedChunks.current = [];
        let options = { mimeType: 'video/webm;codecs=vp9' };
        let recorder: MediaRecorder;
        
        try {
            recorder = new MediaRecorder(stream, options);
        } catch (e) {
            try {
                recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            } catch (e2) {
                recorder = new MediaRecorder(stream);
            }
        }

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.current.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(blob);
            setPreviewUrl(videoUrl);
            setMediaType('video');

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setPreviewBase64(base64.split(',')[1]);
                setAiResult({
                    description: t('Work Video Log / Work Video Log'),
                    category: 'other',
                    tags: ['video'],
                    risk_flag: false,
                    risk_reason: ''
                });
            };
            reader.readAsDataURL(blob);

            setShowWebcam(false);
            setIsRecording(false);
            setRecordingDuration(0);
        };

        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingDuration(0);
        
        if (recordingTimer.current) clearInterval(recordingTimer.current);
        recordingTimer.current = setInterval(() => {
            setRecordingDuration(prev => prev + 1);
        }, 1000);
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (recordingTimer.current) {
            clearInterval(recordingTimer.current);
            recordingTimer.current = null;
        }
    };

    // Submit photo
    const handleSubmit = async () => {
        if (!previewBase64) {
            alert(t('Please select or take a photo! / Please select or take a photo first!'));
            return;
        }
        if (!user) {
            alert(t('The user is not logged in and cannot submit! / User not logged in, cannot submit!'));
            return;
        }
        setUploading(true);

        try {
            // 1. Upload to Supabase Storage
            const extension = mediaType === 'video' ? 'webm' : 'jpg';
            const contentType = mediaType === 'video' ? 'video/webm' : 'image/jpeg';
            const fileName = `${user.employeeId || 'unknown'}_${Date.now()}.${extension}`;
            
            // Prioritize original file if available (for maximum clarity)
            const blob = selectedFile || await fetch(`data:${contentType};base64,${previewBase64}`).then(r => r.blob());
            if (!blob) throw new Error("No image blob available");

            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: blob.type || contentType });

            if (uploadError) throw uploadError;

            // 2. Get public URL
            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const photoUrl = urlData.publicUrl;

            // 3. Insert record
            const { error: dbError } = await supabase.from('work_photos').insert({
                employee_id: user.employeeId || 'unknown',
                employee_name: user.name || 'Unknown',
                photo_url: photoUrl,
                ai_description: aiResult?.description || null,
                user_note: userNote,
                category: aiResult?.category || 'General',
                ai_tags: aiResult?.tags || [],
                risk_flag: aiResult?.risk_flag || false,
                risk_reason: aiResult?.risk_reason || null,
                machine_id: selectedMachineId || null,
            });

            if (dbError) throw dbError;

            // Reset
            setPreviewUrl(null);
            setPreviewBase64(null);
            setAiResult(null);
            setUserNote('');
            setSelectedMachineId('');
            loadPhotos();
        } catch (err: any) {
            alert(t('Upload failed:') + err.message);
        } finally {
            setUploading(false);
        }
    };

    const cancelUpload = () => {
        setPreviewUrl(null);
        setPreviewBase64(null);
        setAiResult(null);
        setUserNote('');
    };

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return t('just');
        if (diff < 3600000) return t('{{var0}} minutes ago', { var0: Math.floor(diff / 60000) });
        if (diff < 86400000) return t('{{var0}} hours ago', { var0: Math.floor(diff / 3600000) });
        return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const todayCount = photos.filter(p => {
        const d = new Date(p.created_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;

    const riskCount = photos.filter(p => p.risk_flag).length;

    return (
        <>
            <div className="min-h-screen bg-[#09090b] text-white">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-900/30 via-[#09090b] to-fuchsia-900/30 border-b border-white/5">
                    <div className="max-w-5xl mx-auto px-4 py-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                        <Camera size={22} />
                                    </div>
                                    {t('work_photos_1')}
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">{t('AI intelligent analysis · Take a photo and record it')}</p>
                            </div>
                            <div className="flex gap-3 text-xs">
                                <div className="bg-violet-500/10 border border-violet-500/20 px-3 py-2 rounded-xl">
                                    <span className="text-violet-400 font-bold">{t('📷Today')} {todayCount}</span>
                                </div>
                                {riskCount > 0 && (
                                    <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                                        <span className="text-red-400 font-bold">{t('⚠️ Risk')} {riskCount}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                    {/* Upload Area */}
                    {!previewUrl ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={() => setShowWebcam(true)}
                                className="py-12 rounded-2xl border-2 border-dashed border-violet-500/30 hover:border-violet-500/60 bg-violet-500/5 hover:bg-violet-500/10 transition-all group flex flex-col items-center justify-center gap-4 cursor-pointer"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-xl shadow-violet-500/30 group-hover:scale-110 transition-transform">
                                    <Camera size={32} className="text-white" />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-white font-sans">{t('Live camera photo taking')}</p>
                                    <p className="text-xs text-gray-500 mt-1">{t('Use the camera to take pictures in real time')}</p>
                                </div>
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="py-12 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/5 transition-all group flex flex-col items-center justify-center gap-4 cursor-pointer"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform text-gray-300 border border-white/10">
                                    <ImageIcon size={32} />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-gray-300 font-sans">{t('Select file to upload')}</p>
                                    <p className="text-xs text-gray-500 mt-1">{t('Select local pictures from album')}</p>
                                </div>
                            </button>
                        </div>
                    ) : (
                        /* Preview + AI Result */
                        <div className="rounded-2xl border border-white/10 bg-[#0c0c0e] overflow-hidden">
                            {/* Preview Media */}
                            <div className="relative">
                                {mediaType === 'video' ? (
                                    <video src={previewUrl} controls className="w-full max-h-80 bg-black" />
                                ) : (
                                    <img src={previewUrl} alt="Preview" className="w-full max-h-80 object-contain bg-black" />
                                )}
                                <button onClick={cancelUpload} className="absolute top-3 right-3 p-2 bg-black/60 rounded-full hover:bg-red-500/80 transition-colors z-10">
                                    <X size={16} />
                                </button>
                                {analyzing && (
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                                        <Sparkles size={32} className="text-violet-400 animate-pulse" />
                                        <span className="text-sm font-bold text-violet-300 animate-pulse">{t('AI analysis in progress...')}</span>
                                    </div>
                                )}
                            </div>

                            {/* AI Result */}
                            {aiResult && !analyzing && (
                                <div className="p-5 space-y-4">
                                    {/* Risk Alert */}
                                    {aiResult.risk_flag && (
                                        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                                            <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-sm font-bold text-red-300">{t('⚠️AI detects security risks')}</p>
                                                <p className="text-xs text-red-400/80 mt-1">{aiResult.risk_reason}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Description */}
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">
                                            <Sparkles size={10} className="inline mr-1" />{t('AI Description')}
                                        </label>
                                        <input
                                            value={aiResult.description}
                                            onChange={e => setAiResult(prev => prev ? { ...prev, description: e.target.value } : prev)}
                                            className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-violet-500 outline-none"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">{t('Classification')}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(CATEGORIES).map(([key, cat]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setAiResult(prev => prev ? { ...prev, category: key } : prev)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${aiResult.category === key
                                                        ? cat.color + ' scale-105'
                                                        : 'border-gray-800 text-gray-500 hover:text-gray-300'
                                                        }`}
                                                >
                                                    {cat.emoji} {cat.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Machine Select */}
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">{t('Associated machines (optional)')}</label>
                                        <select
                                            value={selectedMachineId}
                                            onChange={e => setSelectedMachineId(e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-violet-500 outline-none"
                                        >
                                            <option value="">{t('-- Select machine --')}</option>
                                            {machines.map(m => (
                                                <option key={m.machine_id} value={m.machine_id}>
                                                    {m.name} ({m.machine_id})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Tags */}
                                    {aiResult.tags.length > 0 && (
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">
                                                <Tag size={10} className="inline mr-1" />{t('AI tag')}
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {aiResult.tags.map((tag, i) => (
                                                    <span key={i} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* User Note */}
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">{t('Additional remarks (optional)')}</label>
                                        <input
                                            value={userNote}
                                            onChange={e => setUserNote(e.target.value)}
                                            placeholder={t('Add notes manually...')}
                                            className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-violet-500 outline-none"
                                        />
                                    </div>

                                    {/* Submit */}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={uploading}
                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {uploading ? (
                                            <><Loader size={16} className="animate-spin" />  {t('Submitting...')}</>
                                        ) : (
                                            <><Send size={16} />  {t('Submit record')}</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    {/* Filter Bar */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        <button
                            onClick={loadPhotos}
                            className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors shrink-0"
                        >
                            <RefreshCw size={16} />
                        </button>
                        <button
                            onClick={() => setFilterCategory('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 ${filterCategory === 'all'
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {t('all')}
                        </button>
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                            <button
                                key={key}
                                onClick={() => setFilterCategory(key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 ${filterCategory === key
                                    ? cat.color
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {cat.emoji} {cat.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setFilterCategory('discrepancy')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 flex items-center gap-1.5 ${filterCategory === 'discrepancy'
                                ? 'bg-amber-500 text-black border-amber-400 font-black shadow-lg shadow-amber-500/20'
                                : 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10'
                                }`}
                        >
                            <AlertTriangle size={13} />
                            <span>⚠️ 差异待复核</span>
                        </button>
                    </div>

                    {/* Timeline */}
                    {loading ? (
                        <div className="text-center py-20 text-gray-600 animate-pulse">{t('loading...')}</div>
                    ) : photos.length === 0 ? (
                        <div className="text-center py-20">
                            <ImageIcon size={48} className="mx-auto text-gray-700 mb-4" />
                            <p className="text-gray-500 font-bold">{t('No record yet')}</p>
                            <p className="text-gray-600 text-sm mt-1">{t('Take a photo and start documenting your work')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {photos.map(photo => {
                                const cat = CATEGORIES[photo.category] || CATEGORIES.other;
                                const isVideo = photo.photo_url.toLowerCase().endsWith('.webm') || photo.photo_url.toLowerCase().endsWith('.mp4');
                                const hasDiscrepancy = photo.ai_raw_json?.needs_review === true || photo.ai_raw_json?.discrepancy === true;
                                return (
                                    <div
                                        key={photo.id}
                                        onClick={() => setSelectedPhoto(photo)}
                                        className={`rounded-2xl border bg-[#0c0c0e] overflow-hidden hover:border-white/15 transition-all cursor-pointer group ${
                                            hasDiscrepancy ? 'border-amber-500/40 bg-amber-500/[0.02]' : 'border-white/5'
                                        }`}
                                    >
                                        <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                                            {isVideo ? (
                                                <video
                                                    src={photo.photo_url}
                                                    className="w-full h-full object-cover"
                                                    preload="metadata"
                                                    muted
                                                    playsInline
                                                />
                                            ) : (
                                                <img
                                                    src={photo.photo_url}
                                                    alt=""
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                            )}
                                            {isVideo && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                                        <Video size={20} />
                                                    </div>
                                                </div>
                                            )}
                                            {hasDiscrepancy ? (
                                                <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-amber-500 text-black text-[10px] font-black flex items-center gap-1 shadow-lg">
                                                    <AlertTriangle size={10} /> 差异待复核
                                                </div>
                                            ) : photo.risk_flag ? (
                                                <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-red-500/80 text-white text-[10px] font-bold flex items-center gap-1">
                                                    <AlertTriangle size={10} />  {t('risk')}
                                                </div>
                                            ) : null}
                                            <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold border ${cat.color}`}>
                                                {cat.emoji} {cat.label}
                                            </div>
                                            {photo.machine_id && (
                                                <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white border border-white/10 text-[10px] font-bold">
                                                    🤖 {photo.machine_id}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p className="text-sm text-gray-200 line-clamp-2">{photo.ai_description || photo.user_note || t('No description')}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] text-gray-500 font-bold">{photo.employee_name}</span>
                                                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                                    <Clock size={10} /> {formatTime(photo.created_at)}
                                                </span>
                                            </div>
                                            {photo.ai_tags && photo.ai_tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {photo.ai_tags.slice(0, 3).map((tag, i) => (
                                                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">#{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Photo Detail Modal */}
            {selectedPhoto && (
                <div key="photo-detail-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setSelectedPhoto(null)}>
                    <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#09090b]">
                            <h3 className="text-sm font-bold text-gray-300">{t('Photo Detail / Photo Detail')}</h3>
                            <div className="flex items-center gap-2">
                                {selectedPhoto.photo_url && selectedPhoto.photo_url.startsWith('http') && (
                                    <a 
                                        href={selectedPhoto.photo_url} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="text-xs text-violet-400 hover:underline font-bold px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-all"
                                    >
                                        {t('View original image / Open Original ↗')}
                                    </a>
                                )}
                                <button 
                                    onClick={() => setSelectedPhoto(null)}
                                    className="text-gray-400 hover:text-white text-xs font-bold px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                                >
                                    {t('closure')}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className={`relative bg-black rounded-xl border border-white/5 flex items-center justify-center max-h-[60vh] ${isZoomed ? 'overflow-auto cursor-zoom-out' : 'overflow-hidden'}`} onClick={isZoomed ? () => setIsZoomed(false) : undefined}>
                                {selectedPhoto.photo_url.toLowerCase().endsWith('.webm') || selectedPhoto.photo_url.toLowerCase().endsWith('.mp4') ? (
                                    <video src={selectedPhoto.photo_url} controls className="w-full max-h-[60vh] object-contain bg-black" autoPlay />
                                ) : (
                                    <img 
                                        src={selectedPhoto.photo_url} 
                                        alt="Click to zoom" 
                                        onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }}
                                        className={`transition-all duration-200 ${
                                            isZoomed 
                                                ? 'w-[250%] h-auto max-w-none max-h-none cursor-zoom-out' 
                                                : 'w-full max-h-[60vh] object-contain cursor-zoom-in'
                                        }`} 
                                    />
                                )}
                            </div>
                            <div className="p-1 space-y-3 text-left">
                                {/* Discrepancy Alert Box */}
                                {(selectedPhoto.ai_raw_json?.needs_review || selectedPhoto.ai_raw_json?.discrepancy) && (
                                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                                        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                                            <AlertTriangle size={16} />
                                            <span>⚠️ 称重数据存在差异 (待主管核销)</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                                                <span className="text-gray-400 block text-[10px]">✍️ 手动填报重量</span>
                                                <span className="text-lg font-black text-white">{selectedPhoto.ai_raw_json?.manual_input || '0.00'} KG</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                                                <span className="text-cyan-300 block text-[10px]">🤖 AI 照片识别秤读数</span>
                                                <span className="text-lg font-black text-cyan-300">{selectedPhoto.ai_raw_json?.ai_detected_weight || selectedPhoto.ai_raw_json?.weight || '0.00'} KG</span>
                                            </div>
                                        </div>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => handleSupervisorCorrect(selectedPhoto)}
                                                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                                            >
                                                <Zap size={14} />
                                                <span>✅ 采纳 AI 秤读数纠偏并同步库存 ({selectedPhoto.ai_raw_json?.ai_detected_weight || selectedPhoto.ai_raw_json?.weight} KG)</span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {selectedPhoto.risk_flag && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                        <AlertTriangle size={16} className="text-red-400 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-red-300">{t('safety hazard')}</p>
                                            <p className="text-xs text-red-400/80 mt-0.5">{selectedPhoto.risk_reason}</p>
                                        </div>
                                    </div>
                                )}
                                <p className="text-white font-bold">{selectedPhoto.ai_description}</p>
                                {selectedPhoto.user_note && <p className="text-gray-400 text-sm">📝 {selectedPhoto.user_note}</p>}
                                {selectedPhoto.machine_id && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 font-bold">
                                        {t('🤖 Associated machines:')} {selectedPhoto.machine_id}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {selectedPhoto.ai_tags?.map((tag, i) => (
                                        <span key={i} className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">#{tag}</span>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center pt-3 border-t border-white/5 text-xs text-gray-500">
                                    <span>{selectedPhoto.employee_name}</span>
                                    <span>{new Date(selectedPhoto.created_at).toLocaleString('zh-CN')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* WEBCAM CAPTURE MODAL */}
            {showWebcam && (
                <div key="webcam-capture-modal-overlay" className="fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#1c1c1f] border border-violet-500/30 p-6 rounded-3xl w-full max-w-md shadow-2xl flex flex-col gap-4">
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <h3 className="text-sm font-black text-violet-400 uppercase tracking-wider flex items-center gap-1.5 font-bold font-sans">
                                <Camera size={16} /> {t('Live Camera Photo & Video')}
                            </h3>
                            <button 
                                onClick={handleCloseWebcam}
                                className="text-gray-400 hover:text-white text-xs font-bold px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                            >
                                {t('closure')}
                            </button>
                        </div>

                        {!window.isSecureContext ? (
                            <div key="insecure-context-wpl" className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-2 text-amber-400">
                                <p className="text-xs font-bold leading-relaxed flex items-center gap-1.5">
                                    <span>{t('⚠️Camera not enabled (browser security restriction)')}</span>
                                </p>
                                <p className="text-[11px] text-gray-400 leading-normal">
                                    {t('Your browser restricts access to the camera over a non-secure connection (HTTP). Please solve it in one of the following ways:')}
                                    <br />
                                    {t('1. Use')} <span className="text-white font-mono font-bold">localhost</span> {t('Open locally;')}
                                    <br />
                                    {t('2. Configure and use on the server')} <span className="text-white font-mono font-bold">HTTPS</span> {t('secure connection;')}
                                    <br />
                                    {t('3. Use the local tunnel tool to map to the public network HTTPS link test.')}
                                </p>
                            </div>
                        ) : webcamError ? (
                            <div key="webcam-error-wpl" className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-2 text-red-400">
                                <p className="text-xs font-bold leading-relaxed">
                                    {t('⚠️Camera startup failed')}
                                </p>
                                <p className="text-[11px] text-gray-400 leading-normal">
                                    {t('The camera device cannot be accessed. Please check whether permission has been granted or if the camera is occupied by another application.')}
                                </p>
                                <button
                                    onClick={() => setWebcamError(null)}
                                    className="mt-1 self-start px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[10px] font-bold transition-all"
                                >
                                    {t('Try again')}
                                </button>
                            </div>
                        ) : (
                            <div key="webcam-active-wpl" className="relative aspect-video rounded-2xl bg-black overflow-hidden border border-white/10 flex items-center justify-center">
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
                                    onUserMediaError={(err) => setWebcamError(err)}
                                    className="w-full h-full object-cover"
                                />
                                {isRecording && (
                                    <div key="recording-banner-wpl" className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        <span>REC {recordingDuration}s</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={handleWebcamCapture}
                                disabled={!window.isSecureContext || !!webcamError || isRecording}
                                className={`flex-1 py-3.5 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md ${
                                    !window.isSecureContext || !!webcamError || isRecording
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                                        : 'bg-violet-600 hover:bg-violet-500 active:scale-95 text-white shadow-violet-600/20'
                                }`}
                            >
                                <Camera size={16} />
                                <span>{t('Take a screenshot')}</span>
                            </button>
                            
                            <button
                                onClick={isRecording ? handleStopRecording : handleStartRecording}
                                disabled={!window.isSecureContext || !!webcamError}
                                className={`flex-1 py-3.5 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md ${
                                    !window.isSecureContext || !!webcamError
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                                        : isRecording
                                            ? 'bg-red-600 hover:bg-red-500 active:scale-95 text-white animate-pulse shadow-red-600/20'
                                            : 'bg-fuchsia-600 hover:bg-fuchsia-500 active:scale-95 text-white shadow-fuchsia-600/20'
                                }`}
                            >
                                {isRecording ? (
                                    <>
                                        <Square size={14} />
                                        <span>{t('Stop recording (')}{recordingDuration}s)</span>
                                    </>
                                ) : (
                                    <>
                                        <Video size={14} />
                                        <span>{t('Video 10s')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default WorkPhotoLog;
