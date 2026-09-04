import React, { useState, useRef, useEffect } from 'react';
import {
    Camera,
    Mic,
    MicOff,
    Check,
    X,
    Sparkles,
    AlertTriangle,
    Upload,
    Clock,
    MapPin,
    RefreshCw,
    Layers,
    ChevronRight,
    WifiOff,
    Send,
    Cpu,
    ChevronDown,
    QrCode,
    LogOut
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useTranslation } from 'react-i18next';
import {
    createFastOcrThumbnail,
    uploadOriginalImageToSupabase,
    parseUniversalIntake,
    commitUniversalIntake,
    getOfflineQueue,
    syncOfflineQueue,
    bindOperatorMachine,
    unbindOperatorMachine,
    getBoundOperatorMachine,
    getAvailableMachines
} from '../services/universalIntakeService';
import { UniversalIntakeData, UniversalIntakeIntent, OperatorWorkCategory } from '../types';

interface SmartIntakeModalProps {
    currentUser?: any;
    pageContext?: any;
}

const SPECIAL_WORK_CATEGORIES: {
    key: OperatorWorkCategory;
    label: string;
    icon: string;
    badgeColor: string;
    desc: string;
}[] = [
    { key: 'Container', label: 'Container 原料采购', icon: '🚢', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', desc: '树脂/物料到厂卸柜' },
    { key: 'OT', label: 'OT 车间加班', icon: '🕒', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40', desc: '换网/赶单/检修' },
    { key: 'driver_order', label: '协助行程 Trip', icon: '🚚', badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40', desc: '协助司机配货装车' },
    { key: 'handling', label: '搬运 (卸柜打托)', icon: '📦', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', desc: '到货卸柜搬运码托' },
    { key: 'shopee', label: 'Shopee 散单', icon: '🛍️', badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40', desc: '电商小包打包贴单' },
    { key: 'boss_order', label: 'Boss 特单', icon: '⭐', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40', desc: '老板交代加急特批' }
];

const INTENT_NAMES: Record<UniversalIntakeIntent, { label: string; color: string; icon: string }> = {
    scale_production: { label: '生产报工称重', color: 'bg-emerald-600 border-emerald-500 text-white', icon: '🟢' },
    defect_scrap: { label: '废料次品报废', color: 'bg-rose-600 border-rose-500 text-white', icon: '🔴' },
    machine_anomaly: { label: '设备异常与点检', color: 'bg-amber-600 border-amber-500 text-white', icon: '⚠️' },
    delivery_pod: { label: '物流送货签收 (POD)', color: 'bg-blue-600 border-blue-500 text-white', icon: '📦' },
    attendance_patrol: { label: '现场巡查与考勤', color: 'bg-purple-600 border-purple-500 text-white', icon: '📍' },
    raw_material_intake: { label: '原料配方与投料', color: 'bg-cyan-600 border-cyan-500 text-white', icon: '🧪' },
    operator_special_work: { label: '操作员专项作业', color: 'bg-gradient-to-r from-amber-600 to-orange-600 border-orange-500 text-white', icon: '⚡' },
    machine_login: { label: '机台登录与绑定', color: 'bg-indigo-600 border-indigo-500 text-white', icon: '💻' },
    unknown: { label: '智能分析中', color: 'bg-zinc-600 border-zinc-500 text-white', icon: '🔍' }
};

export const SmartIntakeModal: React.FC<SmartIntakeModalProps> = ({ currentUser, pageContext }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [rawImageUrl, setRawImageUrl] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [parsedData, setParsedData] = useState<UniversalIntakeData | null>(null);
    const [speechText, setSpeechText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [gpsLocation, setGpsLocation] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<string>('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [offlineCount, setOfflineCount] = useState(0);
    const [selectedWorkCategory, setSelectedWorkCategory] = useState<OperatorWorkCategory | null>(null);

    // 机台登录状态与扫码器（切换机台一定要扫码）
    const [boundMachine, setBoundMachine] = useState<string>(() => getBoundOperatorMachine());
    const [availableMachines, setAvailableMachines] = useState<{ machine_id: string; name: string }[]>([]);
    const [isScanningMachineQr, setIsScanningMachineQr] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const hasScannedMachineQrRef = useRef(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    // 监听离线队列数量
    useEffect(() => {
        const updateQueueCount = () => {
            const queue = getOfflineQueue();
            setOfflineCount(queue.length);
        };
        updateQueueCount();
        const interval = setInterval(updateQueueCount, 10000);
        return () => clearInterval(interval);
    }, []);

    // 监听系统机台列表与机台切换事件
    useEffect(() => {
        getAvailableMachines().then(setAvailableMachines);

        const handleMachineChange = (e: any) => {
            const machine = e.detail || getBoundOperatorMachine();
            setBoundMachine(machine);
        };
        const handleStorage = () => {
            setBoundMachine(getBoundOperatorMachine());
        };

        window.addEventListener('packsecure:machine-changed', handleMachineChange);
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('packsecure:machine-changed', handleMachineChange);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // 扫码切换/绑定机台动作（规则：切换机台必须扫码）
    const handleQrMachineScan = (rawText: string) => {
        if (hasScannedMachineQrRef.current) return;
        hasScannedMachineQrRef.current = true;

        let cleanCode = rawText.trim();
        // 兼容 URL 深度链接 e.g. #/production/T1-1 或 https://.../#/production/T1-1
        if (cleanCode.includes('#/production/')) {
            cleanCode = cleanCode.split('#/production/')[1].split('?')[0].split('/')[0];
        }
        // 兼容前缀 MACHINE:T1-1
        if (cleanCode.toUpperCase().startsWith('MACHINE:')) {
            cleanCode = cleanCode.substring(8).trim();
        }

        // 匹配系统机台表
        const matched = availableMachines.find(
            (m) => m.machine_id.toUpperCase() === cleanCode.toUpperCase() || m.name.toUpperCase() === cleanCode.toUpperCase()
        );
        const targetCode = matched ? matched.machine_id : cleanCode;

        if (!targetCode) {
            setToastMessage('⚠️ 未能识别有效的机台二维码');
            setTimeout(() => { hasScannedMachineQrRef.current = false; }, 1500);
            return;
        }

        // 震动提示
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        bindOperatorMachine(targetCode);
        setBoundMachine(targetCode);
        setIsScanningMachineQr(false);
        setToastMessage(`✅ 扫码成功！当前已切换绑定至机台: ${targetCode}`);

        if (parsedData) {
            setParsedData({
                ...parsedData,
                machineId: targetCode,
                machineLoginCode: targetCode
            });
        }
    };

    // 提取实时 GPS 与时间
    const refreshGpsAndTime = () => {
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

        const storedGps = sessionStorage.getItem('last_known_gps') || (window as any).__CURRENT_GPS__;
        if (storedGps) {
            setGpsLocation(storedGps);
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coord = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
                    setGpsLocation(coord);
                    sessionStorage.setItem('last_known_gps', coord);
                },
                () => setGpsLocation('Taiping/Nilai Plant'),
                { enableHighAccuracy: false, timeout: 5000 }
            );
        }
    };

    // 语音输入支持 (Web Speech API)
    const toggleSpeechRecognition = () => {
        if (isListening) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('当前浏览器不支持语音听写，请手动输入');
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'zh-CN';

            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setSpeechText((prev) => (prev ? `${prev} ${transcript}` : transcript));
                setIsListening(false);
            };
            recognition.onerror = () => setIsListening(false);
            recognition.onend = () => setIsListening(false);

            recognitionRef.current = recognition;
            recognition.start();
        } catch {
            setIsListening(false);
        }
    };

    // 处理拍照选择与双流极速识别
    const handleFileSelect = async (file: File) => {
        setSelectedFile(file);
        refreshGpsAndTime();
        setIsAnalyzing(true);
        setParsedData(null);

        try {
            // 1. 生成极速 OCR 缩略图副本（约 180KB）
            const thumbnailBase64 = await createFastOcrThumbnail(file);
            setImagePreview(thumbnailBase64);

            // 2. 异步后台上传原始高清大图存证
            uploadOriginalImageToSupabase(file).then((url) => {
                if (url) setRawImageUrl(url);
            });

            // 3. 毫秒级调用 Gemini 识别
            const result = await parseUniversalIntake({
                imageBase64: thumbnailBase64,
                speechText,
                gps: gpsLocation || 'Taiping/Nilai Plant',
                timestamp: new Date().toISOString(),
                operatorId: currentUser?.employeeId || currentUser?.uid,
                operatorName: currentUser?.name || '现场操作员',
                context: {
                    ...(pageContext || {}),
                    currentMachine: boundMachine,
                    route: window.location.hash
                }
            });

            if (!result.machineId && boundMachine) {
                result.machineId = boundMachine;
            }

            setParsedData(result);
        } catch (err: any) {
            console.error('Fast intake failed:', err);
            setToastMessage(`识别失败: ${err.message || '网络不稳定'}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 处理纯文字或语音说明提交与极速识别 (支持无图快捷入库)
    const handleTextSubmit = async (customText?: string) => {
        const textToSubmit = (customText !== undefined ? customText : speechText).trim();
        if (!textToSubmit) {
            setToastMessage('⚠️ 请输入文字说明或点击拍照');
            return;
        }

        refreshGpsAndTime();
        setIsAnalyzing(true);
        setParsedData(null);

        try {
            const result = await parseUniversalIntake({
                imageBase64: imagePreview || undefined,
                rawImageUrl: rawImageUrl || undefined,
                speechText: textToSubmit,
                gps: gpsLocation || 'Taiping/Nilai Plant',
                timestamp: new Date().toISOString(),
                operatorId: currentUser?.employeeId || currentUser?.uid,
                operatorName: currentUser?.name || '现场操作员',
                context: {
                    ...(pageContext || {}),
                    currentMachine: boundMachine,
                    route: window.location.hash,
                    selectedWorkCategory: selectedWorkCategory || undefined
                }
            });

            if (!result.machineId && boundMachine) {
                result.machineId = boundMachine;
            }

            setParsedData(result);
        } catch (err: any) {
            console.error('Fast text intake failed:', err);
            setToastMessage(`识别失败: ${err.message || '网络不稳定'}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 确认入库提交
    const handleCommit = async () => {
        if (!parsedData) return;
        setIsCommitting(true);

        try {
            const isLogout = !!parsedData.isLogout ||
                (parsedData.summary && (parsedData.summary.includes('登出') || parsedData.summary.includes('下机'))) ||
                (speechText && (speechText.includes('登出') || speechText.includes('下机')));

            // 若包含登出意图，执行解绑；若为登录/开机，执行本地绑定
            if (isLogout) {
                unbindOperatorMachine();
                setBoundMachine('');
            } else if (parsedData.intent === 'machine_login' || parsedData.machineLoginCode) {
                const targetMachine = parsedData.machineLoginCode || parsedData.machineId || boundMachine;
                if (targetMachine) {
                    bindOperatorMachine(targetMachine);
                    setBoundMachine(targetMachine);
                }
            }

            const res = await commitUniversalIntake(parsedData, rawImageUrl || imagePreview, speechText);
            if (res.success) {
                if (isLogout) {
                    setToastMessage('✅ 登出机台成功！已解除当前机台绑定');
                } else {
                    setToastMessage('✅ 入库成功！已自动沉淀到对应业务台账');
                }
                setTimeout(() => {
                    handleReset();
                    setIsOpen(false);
                }, 1500);
            }
        } catch (err: any) {
            setToastMessage(`入库异常: ${err.message}`);
        } finally {
            setIsCommitting(false);
        }
    };

    // 一键登出当前机台
    const handleDirectLogout = async () => {
        if (!boundMachine) {
            setToastMessage('⚠️ 当前未绑定任何机台');
            return;
        }

        const currentMachineName = boundMachine;

        if (!window.confirm(`确认要一键登出机台【${currentMachineName}】吗？\n系统将自动记录下线考勤时间并解除机台绑定。`)) {
            return;
        }

        setIsLoggingOut(true);
        try {
            // 提交下线考勤到后台
            await commitUniversalIntake(
                {
                    intent: 'machine_login',
                    isLogout: true,
                    summary: `操作员一键登出机台: ${currentMachineName}`,
                    machineLoginCode: currentMachineName,
                    machineId: currentMachineName,
                    confidence: 1.0,
                    gps: gpsLocation || 'Taiping/Nilai Plant',
                    timestamp: new Date().toISOString(),
                    operatorId: currentUser?.employeeId || currentUser?.uid || '',
                    operatorName: currentUser?.name || '现场操作员',
                    suggestedActions: []
                },
                undefined,
                `一键登出机台 ${currentMachineName}`
            );

            // 本地解除机台绑定
            unbindOperatorMachine();
            setBoundMachine('');

            setToastMessage(`✅ 已成功登出机台【${currentMachineName}】！`);
            setTimeout(() => {
                handleReset();
            }, 600);
        } catch (err: any) {
            console.error('Logout failed:', err);
            // 兜底本地解绑，确保操作员不被卡住
            unbindOperatorMachine();
            setBoundMachine('');
            setToastMessage(`✅ 已解除机台【${currentMachineName}】绑定`);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setImagePreview('');
        setRawImageUrl('');
        setParsedData(null);
        setSpeechText('');
        setSelectedWorkCategory(null);
        setIsAnalyzing(false);
        setIsCommitting(false);
    };

    // 意图防呆切换
    const switchIntent = (newIntent: UniversalIntakeIntent) => {
        if (!parsedData) return;
        setParsedData({
            ...parsedData,
            intent: newIntent,
            summary: `已修正为: ${INTENT_NAMES[newIntent]?.label || newIntent}`
        });
    };

    // 专项作业切换
    const switchWorkCategory = (category: OperatorWorkCategory) => {
        if (!parsedData) return;
        const catInfo = SPECIAL_WORK_CATEGORIES.find((c) => c.key === category);
        setParsedData({
            ...parsedData,
            intent: 'operator_special_work',
            workCategory: category,
            summary: `【${catInfo?.label || category}】操作员专项作业记录`
        });
    };

    return (
        <>
            {/* 全局悬浮触发胶囊 (固定于右下方，醒目且不遮挡常规内容) */}
            <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
                {offlineCount > 0 && (
                    <button
                        onClick={() => syncOfflineQueue(() => setOfflineCount((prev) => Math.max(0, prev - 1)))}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/90 text-white rounded-full text-xs font-semibold shadow-lg hover:bg-amber-600 transition"
                        title="点击同步离线暂存队列"
                    >
                        <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                        <span>待同步 ({offlineCount})</span>
                    </button>
                )}

                <button
                    onClick={() => {
                        refreshGpsAndTime();
                        setIsOpen(true);
                    }}
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 group"
                    title="点击打开万能快拍与作业录入"
                >
                    <div className="relative">
                        <Camera className="w-5 h-5 text-white" />
                        <Sparkles className="w-2.5 h-2.5 text-amber-300 absolute -top-1 -right-1 animate-ping" />
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                        <span className="font-bold text-sm tracking-wide">万能快拍</span>
                        {boundMachine ? (
                            <span className="text-[10px] text-emerald-100 font-mono font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                                {boundMachine}
                            </span>
                        ) : (
                            <span className="text-[10px] text-emerald-200/80 font-mono">现场录入</span>
                        )}
                    </div>
                </button>
            </div>

            {/* 隐藏的相机触发原生 input */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                }}
            />

            {/* 模态弹窗 */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
                    <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* 顶部标题栏 */}
                        <div className="px-5 py-4 bg-zinc-800/80 border-b border-zinc-700/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/40 text-emerald-400">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        万能快拍 (Smart Intake)
                                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            0.8s 极速识别
                                        </span>
                                    </h3>
                                    <p className="text-xs text-zinc-400 flex items-center gap-3 mt-0.5">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-zinc-500" />
                                            {currentTime || '刚刚'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-zinc-500" />
                                            {gpsLocation || '定位中...'}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    handleReset();
                                    setIsOpen(false);
                                }}
                                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-700/50 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 机台登录状态与扫码换机 / 一键登出按钮（切换机台一定要扫码） */}
                        <div className="px-5 py-2.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-400 flex items-center gap-1 font-medium">
                                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                                    当前机台:
                                </span>
                                {boundMachine ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        {boundMachine}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                                        <AlertTriangle className="w-3 h-3" /> 未绑定机台
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {boundMachine && (
                                    <button
                                        type="button"
                                        onClick={handleDirectLogout}
                                        disabled={isLoggingOut}
                                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white font-bold flex items-center gap-1.5 border border-rose-500/40 shadow-sm transition active:scale-95 text-xs disabled:opacity-50"
                                        title="一键解绑当前机台并记录下线考勤"
                                    >
                                        {isLoggingOut ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                        ) : (
                                            <LogOut className="w-3.5 h-3.5" />
                                        )}
                                        <span>{isLoggingOut ? '登出中...' : '一键登出'}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        hasScannedMachineQrRef.current = false;
                                        setIsScanningMachineQr((prev) => !prev);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold flex items-center gap-1.5 border border-indigo-400/40 shadow-md transition active:scale-95 text-xs"
                                    title="现场规则：切换机台必须对准机台二维码进行扫码"
                                >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>{boundMachine ? '扫码换机' : '扫码登录机台'}</span>
                                </button>
                            </div>
                        </div>

                        {/* 强制机台扫码取景器（切换机台一定要扫码） */}
                        {isScanningMachineQr && (
                            <div className="p-4 bg-zinc-950/95 border-b border-indigo-500/40 flex flex-col items-center justify-center gap-3 animate-fadeIn">
                                <div className="w-full flex items-center justify-between text-xs pb-1.5 border-b border-zinc-800">
                                    <span className="text-white font-bold flex items-center gap-1.5">
                                        <QrCode className="w-4 h-4 text-indigo-400 animate-pulse" />
                                        <span>切换机台一定要扫码</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsScanningMachineQr(false)}
                                        className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="w-full max-w-[260px] aspect-square overflow-hidden rounded-2xl border-2 border-indigo-500 shadow-xl shadow-indigo-500/20 relative bg-black">
                                    <Scanner
                                        key="intake-machine-scanner"
                                        onScan={(detectedCodes) => {
                                            if (detectedCodes && detectedCodes.length > 0) {
                                                const rawText = detectedCodes[0]?.rawValue;
                                                if (rawText) {
                                                    handleQrMachineScan(rawText);
                                                }
                                            }
                                        }}
                                        onError={(err) => {
                                            console.warn('QR Scanner Error:', err);
                                        }}
                                    />
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse pointer-events-none" />
                                </div>

                                <p className="text-[11px] text-zinc-400 text-center font-medium">
                                    请将摄像头对准机身铭牌或二维码标签 (如 T1-1, N1-1 等)
                                </p>
                            </div>
                        )}

                        {/* 内容主体 */}
                        <div className="p-5 overflow-y-auto space-y-4 flex-1">
                            {/* 拍照/文字/专项录入区 (无数据且未分析时展示) */}
                            {(!imagePreview && !parsedData && !isAnalyzing) ? (
                                <div className="space-y-4">
                                    {/* 1. 拍照/上传核心区 */}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/80 bg-zinc-800/40 hover:bg-zinc-800/80 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 group"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition shadow-inner">
                                            <Camera className="w-7 h-7" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                                                <span>点击调用相机拍照</span>
                                                <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded font-mono">首选推荐</span>
                                            </p>
                                            <p className="text-xs text-zinc-400 mt-1">支持称重磅秤、废料次品、机台铭牌、送货单、配方投料</p>
                                        </div>
                                    </div>

                                    {/* 2. 操作员 6 大专项作业快速点选 */}
                                    <div className="bg-zinc-800/40 p-3 rounded-2xl border border-zinc-700/60 space-y-2">
                                        <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-amber-400">
                                                <Sparkles className="w-3 h-3" /> 操作员 6 大专项作业快捷分类
                                            </span>
                                            <span className="text-[10px] text-zinc-500">点选分类后可写字或拍照</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {SPECIAL_WORK_CATEGORIES.map((cat) => {
                                                const isSelected = selectedWorkCategory === cat.key;
                                                return (
                                                    <button
                                                        key={cat.key}
                                                        type="button"
                                                        onClick={() => {
                                                            const newCat = isSelected ? null : cat.key;
                                                            setSelectedWorkCategory(newCat);
                                                            if (newCat) {
                                                                setSpeechText((prev) => {
                                                                    const clean = prev.replace(/^【.*?】\s*/, '').trim();
                                                                    return `【${cat.label}】 ${clean}`.trim();
                                                                });
                                                            }
                                                        }}
                                                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-start justify-center gap-0.5 transition active:scale-95 ${cat.badgeColor} ${
                                                            isSelected ? 'ring-2 ring-amber-400 font-bold shadow-lg scale-[1.02]' : 'hover:brightness-110 opacity-80 hover:opacity-100'
                                                        } shadow-sm text-left relative`}
                                                    >
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-base">{cat.icon}</span>
                                                                <span className="font-bold">{cat.label}</span>
                                                            </div>
                                                            {isSelected && (
                                                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] opacity-75 font-normal line-clamp-1">{cat.desc}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 3. 文字 / 语音万能快捷输入区 (支持写了文字直接提交) */}
                                    <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-3.5 space-y-2.5 shadow-md">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> 文字 / 语音快速输入 (写完点发送直接上传)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={toggleSpeechRecognition}
                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition ${
                                                    isListening
                                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                                                }`}
                                            >
                                                {isListening ? (
                                                    <>
                                                        <MicOff className="w-3 h-3 text-rose-400" /> 正在倾听...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Mic className="w-3 h-3 text-cyan-400" /> 按此说话
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={speechText}
                                                onChange={(e) => setSpeechText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleTextSubmit();
                                                    }
                                                }}
                                                placeholder="输入文字，如：3号机称重 18.5kg、OT加班2小时、卸柜20托..."
                                                className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition shadow-inner"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleTextSubmit()}
                                                disabled={!speechText.trim() || isAnalyzing}
                                                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg border border-emerald-400/30 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 active:scale-95"
                                                title="提交文字智能识别并入库"
                                            >
                                                {isAnalyzing ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Send className="w-3.5 h-3.5" />
                                                )}
                                                <span>发送识别</span>
                                            </button>
                                        </div>

                                        {/* 快捷输入词条 */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                                            <span className="text-[10px] text-zinc-500 shrink-0">快捷输入:</span>
                                            {[
                                                '登出当前机台',
                                                '3号机称重 18.5kg',
                                                'OT加班 2.0小时',
                                                '原料卸柜 20托',
                                                '协助送货行程 TRIP-01',
                                                'Shopee 打包 5件',
                                                '5号机切刀过热停机'
                                            ].map((example) => (
                                                <button
                                                    key={example}
                                                    type="button"
                                                    onClick={() => {
                                                        setSpeechText(example);
                                                        handleTextSubmit(example);
                                                    }}
                                                    className={`px-2 py-0.5 rounded-lg ${
                                                        example === '登出当前机台'
                                                            ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30'
                                                            : 'bg-zinc-900/90 hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-800'
                                                    } text-[10px] border transition whitespace-nowrap shrink-0`}
                                                >
                                                    {example}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* 已拍摄预览 / 纯文字录入结论卡片 */
                                <div className="space-y-4">
                                    {/* 画面或文字录入指示卡 */}
                                    {imagePreview ? (
                                        <div className="relative rounded-2xl overflow-hidden border border-zinc-700 max-h-48 bg-black flex items-center justify-center">
                                            <img src={imagePreview} alt="Intake" className="w-full h-48 object-contain" />
                                            <button
                                                onClick={() => {
                                                    handleReset();
                                                    setTimeout(() => fileInputRef.current?.click(), 100);
                                                }}
                                                className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs rounded-full border border-white/20 backdrop-blur-md flex items-center gap-1"
                                            >
                                                <RefreshCw className="w-3 h-3" /> 重拍
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-3.5 bg-zinc-800/90 rounded-2xl border border-zinc-700 flex items-center justify-between gap-2 shadow-lg">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
                                                    <Sparkles className="w-4 h-4" />
                                                </div>
                                                <div className="truncate">
                                                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">已提交文字/语音录入:</span>
                                                    <p className="text-xs text-white font-semibold truncate mt-0.5">{speechText || parsedData?.summary || '无文字备注'}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleReset}
                                                className="px-2.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-600 shrink-0 transition"
                                            >
                                                重新输入
                                            </button>
                                        </div>
                                    )}

                                    {/* 极速分析 Loading */}
                                    {isAnalyzing && (
                                        <div className="p-6 bg-zinc-800/60 rounded-2xl border border-zinc-700 flex flex-col items-center justify-center gap-3 animate-pulse">
                                            <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                            <p className="text-sm font-semibold text-white">Gemini 极速分析识别中...</p>
                                            <p className="text-xs text-zinc-400">正在提取业务意图、关键数字与归属分类</p>
                                        </div>
                                    )}

                                    {/* 极速核对卡片 */}
                                    {parsedData && !isAnalyzing && (
                                        <div className="space-y-3 animate-fadeIn">
                                            {/* 防呆模式胶囊切换 (一指禅极速切换) */}
                                            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                                {(['scale_production', 'defect_scrap', 'machine_anomaly', 'delivery_pod', 'machine_login'] as UniversalIntakeIntent[]).map((intentKey) => {
                                                    const isCurrent = parsedData.intent === intentKey;
                                                    const info = INTENT_NAMES[intentKey];
                                                    return (
                                                        <button
                                                            key={intentKey}
                                                            onClick={() => switchIntent(intentKey)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 whitespace-nowrap transition ${
                                                                isCurrent
                                                                    ? `${info.color} ring-2 ring-emerald-400/50 shadow-md`
                                                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                                                            }`}
                                                        >
                                                            <span>{info.icon}</span>
                                                            <span>{info.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* 操作员 6 大专项作业一键切换胶囊 */}
                                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-zinc-800">
                                                <span className="text-[10px] uppercase font-bold text-amber-500 whitespace-nowrap">专项:</span>
                                                {SPECIAL_WORK_CATEGORIES.map((cat) => {
                                                    const isSelected = parsedData.intent === 'operator_special_work' && (parsedData.workCategory === cat.key || (cat.key === 'handling' && parsedData.workCategory === 'pallet'));
                                                    return (
                                                        <button
                                                            key={cat.key}
                                                            type="button"
                                                            onClick={() => switchWorkCategory(cat.key)}
                                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 whitespace-nowrap transition ${
                                                                isSelected
                                                                    ? `${cat.badgeColor} ring-1 ring-amber-400 font-bold shadow-md`
                                                                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white'
                                                            }`}
                                                        >
                                                            <span>{cat.icon}</span>
                                                            <span>{cat.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* 识别到机台一键切换/绑定提示 */}
                                            {(parsedData.machineLoginCode || parsedData.machineId) && (parsedData.machineLoginCode || parsedData.machineId) !== boundMachine && (
                                                <div className="p-3 bg-indigo-950/70 border border-indigo-500/50 rounded-2xl flex items-center justify-between gap-2 shadow-lg">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-xl">💻</span>
                                                        <div>
                                                            <p className="text-xs font-bold text-indigo-200">
                                                                识别到机台: <span className="text-white bg-indigo-600 px-1.5 py-0.5 rounded font-mono font-black">{parsedData.machineLoginCode || parsedData.machineId}</span>
                                                            </p>
                                                            <p className="text-[10px] text-indigo-300/80">当前绑定为 {boundMachine || '未绑定'}，是否登录此机台？</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const target = parsedData.machineLoginCode || parsedData.machineId!;
                                                            bindOperatorMachine(target);
                                                            setBoundMachine(target);
                                                            setToastMessage(`✅ 已切换绑定至机台: ${target}`);
                                                        }}
                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md border border-indigo-400/30 whitespace-nowrap"
                                                    >
                                                        立即登录绑定
                                                    </button>
                                                </div>
                                            )}

                                            {/* 大字提炼卡片 */}
                                            <div className="p-4 bg-zinc-800/90 rounded-2xl border border-emerald-500/40 shadow-xl space-y-3">
                                                <div className="flex items-center justify-between border-b border-zinc-700/60 pb-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                                        <Sparkles className="w-3.5 h-3.5" /> AI 识别结论
                                                    </span>
                                                    <span className="text-xs text-zinc-400 font-mono">
                                                        置信度: {Math.round((parsedData.confidence || 0.95) * 100)}%
                                                    </span>
                                                </div>

                                                <p className="text-base font-bold text-white leading-snug">
                                                    {parsedData.summary}
                                                </p>

                                                {/* 核心数值展示 (针对不同场景显示关键输入) */}
                                                <div className="grid grid-cols-2 gap-2 pt-1">
                                                    {/* 重量 */}
                                                    {(parsedData.intent === 'scale_production' || parsedData.intent === 'defect_scrap') && (
                                                        <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                            <span className="text-[11px] text-zinc-400">实测重量 (kg)</span>
                                                            <div className="flex items-baseline gap-1 mt-0.5">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={parsedData.weight ?? ''}
                                                                    onChange={(e) => setParsedData({ ...parsedData, weight: parseFloat(e.target.value) || 0 })}
                                                                    className="w-full bg-transparent text-xl font-black text-emerald-400 focus:outline-none"
                                                                />
                                                                <span className="text-xs text-zinc-500">kg</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 关联机台 (规则：切换机台必须扫码，禁止手动编辑输入) */}
                                                    {parsedData.intent !== 'operator_special_work' && parsedData.intent !== 'machine_login' && (
                                                        <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700 flex items-center justify-between">
                                                            <div>
                                                                <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                                                                    <Cpu className="w-3 h-3 text-indigo-400" />
                                                                    关联机台 (扫码绑定)
                                                                </span>
                                                                <div className="text-sm font-bold text-white mt-0.5 font-mono">
                                                                    {parsedData.machineId || boundMachine || '未扫码机台'}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    hasScannedMachineQrRef.current = false;
                                                                    setIsScanningMachineQr(true);
                                                                }}
                                                                className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 active:scale-95 text-[11px] text-white font-bold rounded-lg flex items-center gap-1 border border-indigo-400/30 shadow transition shrink-0"
                                                                title="现场规则：切换机台必须扫码"
                                                            >
                                                                <QrCode className="w-3 h-3" />
                                                                <span>扫码换机</span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* 送货单号 (若是 POD) */}
                                                    {parsedData.intent === 'delivery_pod' && (
                                                        <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700 col-span-2">
                                                            <span className="text-[11px] text-zinc-400">送货单号 (DO Number)</span>
                                                            <input
                                                                type="text"
                                                                value={parsedData.doNumber || ''}
                                                                placeholder="例: DO-8821"
                                                                onChange={(e) => setParsedData({ ...parsedData, doNumber: e.target.value })}
                                                                className="w-full bg-transparent text-sm font-bold text-cyan-400 focus:outline-none mt-0.5"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* 异常原因 */}
                                                    {(parsedData.intent === 'defect_scrap' || parsedData.intent === 'machine_anomaly') && (
                                                        <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700 col-span-2">
                                                            <span className="text-[11px] text-zinc-400">异常/原因分类</span>
                                                            <input
                                                                type="text"
                                                                value={parsedData.defectReason || ''}
                                                                placeholder="例如: 膜卷气泡过厚 / 换网停机"
                                                                onChange={(e) => setParsedData({ ...parsedData, defectReason: e.target.value })}
                                                                className="w-full bg-transparent text-xs text-white focus:outline-none mt-0.5"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* 机台登录专属卡片 (切换机台一定要扫码) */}
                                                    {parsedData.intent === 'machine_login' && (
                                                        <div className="bg-zinc-900/80 p-3 rounded-xl border border-indigo-500/40 col-span-2 space-y-2">
                                                            <span className="text-[11px] text-zinc-400">机台扫码登录确认 (切换机台需对准机身二维码)</span>
                                                            <div className="flex items-center justify-between p-2.5 bg-zinc-800/80 rounded-xl border border-zinc-700">
                                                                <div className="flex items-center gap-2">
                                                                    <QrCode className="w-5 h-5 text-indigo-400" />
                                                                    <div>
                                                                        <p className="text-[10px] text-zinc-400">待绑定机台</p>
                                                                        <p className="text-base font-black text-indigo-300 font-mono">
                                                                            {parsedData.machineLoginCode || parsedData.machineId || '未扫码机台'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            hasScannedMachineQrRef.current = false;
                                                                            setIsScanningMachineQr(true);
                                                                        }}
                                                                        className="px-2.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                                                                    >
                                                                        <QrCode className="w-3.5 h-3.5" />
                                                                        <span>重新扫码</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const target = parsedData.machineLoginCode || parsedData.machineId || boundMachine;
                                                                            if (target) {
                                                                                bindOperatorMachine(target);
                                                                                setBoundMachine(target);
                                                                                setToastMessage(`✅ 已成功登录绑定至机台: ${target}`);
                                                                            }
                                                                        }}
                                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow"
                                                                    >
                                                                        立即绑定
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ---------------- 6 大专项工作专属字段 ---------------- */}

                                                    {/* 1. Container 原料采购卸柜 */}
                                                    {parsedData.workCategory === 'Container' && (
                                                        <>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">货柜柜号 (Container No)</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.containerNo || ''}
                                                                    placeholder="例: MSCU-882910"
                                                                    onChange={(e) => setParsedData({ ...parsedData, containerNo: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-cyan-400 focus:outline-none mt-0.5 uppercase"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">铅封号 (Seal No)</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.sealNo || ''}
                                                                    placeholder="例: SL-123456"
                                                                    onChange={(e) => setParsedData({ ...parsedData, sealNo: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-white focus:outline-none mt-0.5 uppercase"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">采购物料类别</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.materialType || ''}
                                                                    placeholder="例: 聚乙烯树脂 / 色母"
                                                                    onChange={(e) => setParsedData({ ...parsedData, materialType: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-amber-300 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">卸柜件数 / 托数</span>
                                                                <input
                                                                    type="number"
                                                                    value={parsedData.palletCount ?? ''}
                                                                    placeholder="例: 20 托"
                                                                    onChange={(e) => setParsedData({ ...parsedData, palletCount: parseInt(e.target.value) || 0 })}
                                                                    className="w-full bg-transparent text-sm font-bold text-emerald-400 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* 2. OT 车间加班 */}
                                                    {parsedData.workCategory === 'OT' && (
                                                        <>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">加班工时 (小时)</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.5"
                                                                    value={parsedData.otHours ?? ''}
                                                                    placeholder="例: 2.0"
                                                                    onChange={(e) => setParsedData({ ...parsedData, otHours: parseFloat(e.target.value) || 0 })}
                                                                    className="w-full bg-transparent text-lg font-black text-amber-400 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700 flex items-center justify-between">
                                                                <div>
                                                                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                                                                        <Cpu className="w-3 h-3 text-indigo-400" />
                                                                        关联机台 (扫码绑定)
                                                                    </span>
                                                                    <div className="text-sm font-bold text-white mt-0.5 font-mono">
                                                                        {parsedData.machineId || boundMachine || '未扫码机台'}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        hasScannedMachineQrRef.current = false;
                                                                        setIsScanningMachineQr(true);
                                                                    }}
                                                                    className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 active:scale-95 text-[11px] text-white font-bold rounded-lg flex items-center gap-1 border border-indigo-400/30 shadow transition shrink-0"
                                                                    title="现场规则：切换机台必须扫码"
                                                                >
                                                                    <QrCode className="w-3 h-3" />
                                                                    <span>扫码换机</span>
                                                                </button>
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700 col-span-2">
                                                                <span className="text-[11px] text-zinc-400">加班原因与任务</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.defectReason || ''}
                                                                    placeholder="例: 换网调机、紧急赶工出货"
                                                                    onChange={(e) => setParsedData({ ...parsedData, defectReason: e.target.value })}
                                                                    className="w-full bg-transparent text-xs text-white focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* 3. driver_order 协助行程 Trip */}
                                                    {parsedData.workCategory === 'driver_order' && (
                                                        <>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">关联司机 / 车牌</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.driverNameOrPlate || ''}
                                                                    placeholder="例: 张师傅 / WXV 8899"
                                                                    onChange={(e) => setParsedData({ ...parsedData, driverNameOrPlate: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-blue-400 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">行程Trip单号</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.tripId || ''}
                                                                    placeholder="例: TRIP-2026-03"
                                                                    onChange={(e) => setParsedData({ ...parsedData, tripId: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-cyan-400 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700 col-span-2">
                                                                <span className="text-[11px] text-zinc-400">协助送货单 (DO No)</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.doNumber || ''}
                                                                    placeholder="例: DO-8891, DO-8892"
                                                                    onChange={(e) => setParsedData({ ...parsedData, doNumber: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-white focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* 4. handling / pallet 搬运 (卸柜打托) */}
                                                    {(parsedData.workCategory === 'handling' || parsedData.workCategory === 'pallet') && (
                                                        <>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">搬运托数 (Pallets)</span>
                                                                <input
                                                                    type="number"
                                                                    value={parsedData.palletCount ?? ''}
                                                                    placeholder="例: 10 托"
                                                                    onChange={(e) => setParsedData({ ...parsedData, palletCount: parseInt(e.target.value) || 0 })}
                                                                    className="w-full bg-transparent text-lg font-black text-emerald-400 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">存放库位 / 区域</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.warehouseBay || ''}
                                                                    placeholder="例: Raw Material Bay A"
                                                                    onChange={(e) => setParsedData({ ...parsedData, warehouseBay: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-cyan-300 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700 col-span-2">
                                                                <span className="text-[11px] text-zinc-400">货物类型 / 规格型号</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.sku || ''}
                                                                    placeholder="例: 原料树脂包 / SF-500-150-18-CLR"
                                                                    onChange={(e) => setParsedData({ ...parsedData, sku: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-white focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* 5. shopee 电商散单打包 */}
                                                    {parsedData.workCategory === 'shopee' && (
                                                        <>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">运单号 / Tracking</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.trackingNo || ''}
                                                                    placeholder="例: SPXMY1234567"
                                                                    onChange={(e) => setParsedData({ ...parsedData, trackingNo: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-orange-400 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">包裹件数</span>
                                                                <input
                                                                    type="number"
                                                                    value={parsedData.palletCount ?? ''}
                                                                    placeholder="例: 5 件"
                                                                    onChange={(e) => setParsedData({ ...parsedData, palletCount: parseInt(e.target.value) || 0 })}
                                                                    className="w-full bg-transparent text-sm font-bold text-white focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* 6. boss_order 老板特单 */}
                                                    {parsedData.workCategory === 'boss_order' && (
                                                        <>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">VIP 客户名称</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.customer || ''}
                                                                    placeholder="例: TopGlove / 某大客户"
                                                                    onChange={(e) => setParsedData({ ...parsedData, customer: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-purple-400 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                            <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700">
                                                                <span className="text-[11px] text-zinc-400">特单备注 / 紧急度</span>
                                                                <input
                                                                    type="text"
                                                                    value={parsedData.bossOrderNote || '加急特批'}
                                                                    onChange={(e) => setParsedData({ ...parsedData, bossOrderNote: e.target.value })}
                                                                    className="w-full bg-transparent text-sm font-bold text-amber-300 focus:outline-none mt-0.5"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* 补充说明与操作员现场备注 */}
                                                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-700 col-span-2">
                                                        <span className="text-[11px] text-zinc-400">操作员补充说明 / 文字备注 (可修改)</span>
                                                        <input
                                                            type="text"
                                                            value={speechText}
                                                            onChange={(e) => setSpeechText(e.target.value)}
                                                            placeholder="可补充或修改说明备注..."
                                                            className="w-full bg-transparent text-xs text-white focus:outline-none mt-0.5"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 一键确认入库/登出大按钮 */}
                                            <button
                                                onClick={handleCommit}
                                                disabled={isCommitting}
                                                className={`w-full py-3.5 ${
                                                    parsedData.isLogout || (parsedData.summary && (parsedData.summary.includes('登出') || parsedData.summary.includes('下机')))
                                                        ? 'bg-gradient-to-r from-rose-600 via-rose-700 to-red-600 border-rose-400/30'
                                                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 border-emerald-400/30'
                                                } hover:brightness-110 active:scale-[0.99] text-white rounded-2xl font-bold text-base shadow-xl flex items-center justify-center gap-2 border transition disabled:opacity-50`}
                                            >
                                                {isCommitting ? (
                                                    <>
                                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                                        <span>正在记录落库...</span>
                                                    </>
                                                ) : parsedData.isLogout || (parsedData.summary && (parsedData.summary.includes('登出') || parsedData.summary.includes('下机'))) ? (
                                                    <>
                                                        <LogOut className="w-5 h-5 text-rose-200" />
                                                        <span>一键确认登出机台 (Clock Out)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-5 h-5 text-emerald-200" />
                                                        <span>一键确认入库 (Commit)</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Toast 提示 */}
                        {toastMessage && (
                            <div className="px-4 py-2.5 bg-zinc-800 border-t border-zinc-700/80 text-xs text-center font-medium text-white flex items-center justify-center gap-2 animate-fadeIn">
                                <span>{toastMessage}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default SmartIntakeModal;
