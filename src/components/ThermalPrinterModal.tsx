import React, { useState, useEffect, useRef } from 'react';
import {
    Printer, X, Usb, Bluetooth, CheckCircle2, AlertCircle,
    Sliders, RefreshCw, Zap, ShieldCheck, Check, Sparkles
} from 'lucide-react';
import {
    thermalPrinterService,
    PrinterSettings,
    ConnectionType,
    LabelData
} from '../services/thermalPrinterService';
import { useTranslation } from 'react-i18next';

interface ThermalPrinterModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentMachine?: string | null;
    currentSku?: string | null;
    operatorName?: string | null;
}

export const ThermalPrinterModal: React.FC<ThermalPrinterModalProps> = ({
    isOpen,
    onClose,
    currentMachine,
    currentSku,
    operatorName
}) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState(thermalPrinterService.getStatus());
    const [settings, setSettings] = useState<PrinterSettings>(thermalPrinterService.getSettings());
    const [isConnecting, setIsConnecting] = useState(false);
    const [isPrintingTest, setIsPrintingTest] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    // 订阅打印机状态
    useEffect(() => {
        const unsubscribe = thermalPrinterService.subscribe((newStatus) => {
            setStatus(newStatus);
        });
        return unsubscribe;
    }, []);

    // 实时更新 Canvas 预览
    useEffect(() => {
        if (!isOpen || !previewCanvasRef.current) return;

        const sampleData: LabelData = {
            sku: currentSku || 'BW-DL-CLR-100Mx50CMx2ROLL-TRP',
            productName: '双层透明气泡膜 100M x 50CM (2卷)',
            machineCode: currentMachine || 'N1-M01',
            operatorName: operatorName || 'Operator #01',
            operatorId: 'OP-01',
            lotNo: `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`,
            timestamp: new Date().toISOString(),
            rolls: 2,
            layer: 'Double',
            material: 'Clear',
            size: '50cm',
            color: 'Transparent',
            yieldCount: 1,
            barcode: currentSku || 'BW-DL-CLR-100M',
            qrCode: `PS|${currentSku || 'BW'}|${currentMachine || 'M01'}|OK`
        };

        thermalPrinterService.renderLabelToCanvas(previewCanvasRef.current, sampleData, settings);
    }, [isOpen, settings, currentSku, currentMachine, operatorName]);

    if (!isOpen) return null;

    // 连接 USB 串口
    const handleConnectSerial = async () => {
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsConnecting(true);
        try {
            await thermalPrinterService.connectSerial(9600);
            setSuccessMsg('已成功通过 USB 串口连接 SoonMark M4201 打印机！');
        } catch (err: any) {
            setErrorMsg(err.message || '串口连接失败，请确认 USB 线已插紧并选择对应设备。');
        } finally {
            setIsConnecting(false);
        }
    };

    // 连接蓝牙
    const handleConnectBluetooth = async () => {
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsConnecting(true);
        try {
            await thermalPrinterService.connectBluetooth();
            setSuccessMsg('已成功通过蓝牙 BLE 连接 SoonMark M4201 打印机！');
        } catch (err: any) {
            setErrorMsg(err.message || '蓝牙连接失败，请确认打印机已开机且蓝牙已开启。');
        } finally {
            setIsConnecting(false);
        }
    };

    // 断开连接
    const handleDisconnect = async () => {
        await thermalPrinterService.disconnect();
        setSuccessMsg(null);
    };

    // 保存设置更新
    const handleUpdateSettings = (newVal: Partial<PrinterSettings>) => {
        thermalPrinterService.updateSettings(newVal);
        setSettings(thermalPrinterService.getSettings());
    };

    // 打印测试页
    const handlePrintTest = async () => {
        setErrorMsg(null);
        setIsPrintingTest(true);
        try {
            await thermalPrinterService.printTestPage();
            setSuccessMsg('测试标签已发出！若未出纸请检查打印机状态指示灯与热敏纸安装。');
        } catch (err: any) {
            setErrorMsg(err.message || '打印失败');
        } finally {
            setIsPrintingTest(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
                {/* 弹窗头部 */}
                <div className="flex justify-between items-center pb-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <Printer size={22} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <span>SoonMark M4201 热敏打印机</span>
                                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono">
                                    USB+BT+WiFi
                                </span>
                            </h3>
                            <p className="text-xs text-gray-400">车间免弹窗直连出纸控制中心</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 主滚动体 */}
                <div className="flex-1 overflow-y-auto space-y-5 py-4 custom-scrollbar">

                    {/* 消息提示 */}
                    {errorMsg && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs animate-shake">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-2.5 text-emerald-300 text-xs animate-fade-in">
                            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* 当前设备连接状态卡片 */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                        status.connected
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-gray-400'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-3.5 h-3.5 rounded-full ${
                                    status.connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                                }`} />
                                <div>
                                    <div className="text-sm font-bold text-white">
                                        {status.connected ? status.name : '打印机未直连'}
                                    </div>
                                    <div className="text-xs opacity-75 mt-0.5">
                                        {status.connected
                                            ? `已就绪 (通道: ${status.type === 'serial' ? 'USB 串口' : '蓝牙 BLE'})`
                                            : '未连接时将降级调用浏览器打印窗口'}
                                    </div>
                                </div>
                            </div>
                            {status.connected && (
                                <button
                                    onClick={handleDisconnect}
                                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-gray-300 hover:text-rose-300 text-xs font-bold transition cursor-pointer"
                                >
                                    断开连接
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 直连方式选择 (USB 或 蓝牙) */}
                    {!status.connected && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                                选择免弹窗直连通道 (Connect Device)
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* USB 串口直连 */}
                                <button
                                    onClick={handleConnectSerial}
                                    disabled={isConnecting}
                                    className="p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-blue-600/10 hover:border-blue-500/40 text-left transition-all group active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-2.5 text-blue-400 font-bold text-sm mb-1">
                                        <Usb size={18} />
                                        <span>USB 串口直连</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 group-hover:text-gray-300 leading-relaxed">
                                        适合车间一体机/电脑，插上 USB 方口线，无延迟、抗电机干扰。
                                    </p>
                                </button>

                                {/* 蓝牙无线直连 */}
                                <button
                                    onClick={handleConnectBluetooth}
                                    disabled={isConnecting}
                                    className="p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-purple-600/10 hover:border-purple-500/40 text-left transition-all group active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-2.5 text-purple-400 font-bold text-sm mb-1">
                                        <Bluetooth size={18} />
                                        <span>蓝牙无线直连</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 group-hover:text-gray-300 leading-relaxed">
                                        适合车间平板 (iPad/安卓) 或手机工位，搜索 SoonMark 设备一键配对。
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 标签纸尺寸与打印选项 */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                标签纸张规格 (Paper Size)
                            </label>
                            <span className="text-[11px] text-blue-400 font-mono">
                                {settings.widthMm}mm × {settings.heightMm}mm
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { w: 100, h: 100, label: '100×100 mm', note: '标准成品标签' },
                                { w: 100, h: 150, label: '100×150 mm', note: '托盘物流大标' },
                                { w: 70, h: 50, label: '70×50 mm', note: '中型卷标' },
                                { w: 50, h: 30, label: '50×30 mm', note: '货架条码标' },
                            ].map((spec) => {
                                const isSelected = settings.widthMm === spec.w && settings.heightMm === spec.h;
                                return (
                                    <button
                                        key={spec.label}
                                        onClick={() => handleUpdateSettings({ widthMm: spec.w, heightMm: spec.h })}
                                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-blue-600/20 border-blue-500 text-white font-bold shadow-lg shadow-blue-900/20'
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="text-xs font-mono">{spec.label}</div>
                                        <div className="text-[10px] opacity-75 mt-0.5">{spec.note}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 自动化与打印模式 */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Zap size={16} className="text-amber-400" />
                                <div>
                                    <div className="text-xs font-bold text-white">每次做完一卷自动出纸</div>
                                    <div className="text-[10px] text-gray-400">车间扫码或脉冲记件触发产出时自动秒打标签</div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleUpdateSettings({ autoPrintOnCount: !settings.autoPrintOnCount })}
                                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                                    settings.autoPrintOnCount ? 'bg-emerald-500' : 'bg-gray-700'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                                    settings.autoPrintOnCount ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>

                        <div className="h-px bg-white/5" />

                        {/* 渲染引擎切换 */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sliders size={16} className="text-blue-400" />
                                <div>
                                    <div className="text-xs font-bold text-white">打印渲染引擎</div>
                                    <div className="text-[10px] text-gray-400">
                                        {settings.printMode === 'tspl' ? 'TSPL 硬件指令 (极速、毫秒响应)' : 'Canvas 高清位图 (所见即所得、字体全兼容)'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10 text-[11px]">
                                <button
                                    onClick={() => handleUpdateSettings({ printMode: 'tspl' })}
                                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                                        settings.printMode === 'tspl' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400'
                                    }`}
                                >
                                    TSPL 原生
                                </button>
                                <button
                                    onClick={() => handleUpdateSettings({ printMode: 'bitmap' })}
                                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                                        settings.printMode === 'bitmap' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400'
                                    }`}
                                >
                                    Canvas 位图
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 标签视觉预览 (WYSIWYG Preview) */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                            标签实时效果预览 (Label Preview)
                        </label>
                        <div className="flex justify-center p-3 bg-black/40 rounded-2xl border border-white/5">
                            <canvas
                                ref={previewCanvasRef}
                                className="max-w-full h-auto max-h-56 rounded-lg shadow-xl border border-gray-700 bg-white"
                            />
                        </div>
                    </div>

                </div>

                {/* 底部按钮栏 */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
                    <button
                        onClick={handlePrintTest}
                        disabled={isPrintingTest}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                        {isPrintingTest ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} />}
                        <span>{isPrintingTest ? '正在出纸...' : '📄 打印测试标签 (Test Print)'}</span>
                    </button>

                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/30 transition cursor-pointer active:scale-95"
                    >
                        完成设置 (Done)
                    </button>
                </div>
            </div>
        </div>
    );
};
