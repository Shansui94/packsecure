import React, { useState } from 'react';
import { X, Play, Download, CheckCircle2, Truck, FileCheck, Upload } from 'lucide-react';

interface DriverTutorialModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'delivery' | 'monthly';
}

export const DriverTutorialModal: React.FC<DriverTutorialModalProps> = ({
    isOpen,
    onClose,
    initialTab = 'delivery'
}) => {
    const [activeTab, setActiveTab] = useState<'delivery' | 'monthly'>(initialTab);

    if (!isOpen) return null;

    const deliveryVideoWebm = '/videos/driver_delivery_tutorial.webm';
    const deliveryVideoMp4 = '/videos/driver_delivery_tutorial.mp4';
    const monthlyVideoWebm = '/videos/driver_monthly_check_tutorial.webm';
    const monthlyVideoMp4 = '/videos/driver_monthly_check_tutorial.mp4';
    const currentVideo = activeTab === 'delivery' ? deliveryVideoMp4 : monthlyVideoMp4;
    const currentFallback = activeTab === 'delivery' ? deliveryVideoWebm : monthlyVideoWebm;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            {/* Modal Card */}
            <div className="bg-[#131722] border border-slate-700/80 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-4 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                            <Play size={16} fill="currentColor" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-wider">
                                Video Tutorial / 教学视频
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold">
                                Panduan Pemandu Packsecure OS
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-full transition-all cursor-pointer"
                        aria-label="Tutup"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="p-2.5 bg-slate-950/60 border-b border-slate-800/80 flex gap-2 shrink-0">
                    <button
                        onClick={() => setActiveTab('delivery')}
                        className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'delivery'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-500/50'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                    >
                        <Truck size={14} />
                        <span>🚚 1. Hantar & POD</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'monthly'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 border border-emerald-500/50'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                    >
                        <FileCheck size={14} />
                        <span>📊 2. Semak Trip ✓</span>
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                    {/* Video Player */}
                    <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-[9/16] max-h-[50vh] w-full flex items-center justify-center shadow-inner">
                        <video
                            key={activeTab}
                            controls
                            playsInline
                            autoPlay
                            loop
                            className="w-full h-full object-contain"
                        >
                            <source src={currentVideo} type="video/mp4" />
                            <source src={currentFallback} type="video/webm" />
                            Pelayar anda tidak menyokong video HTML5. / Your browser does not support HTML5 video.
                        </video>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] font-mono text-slate-400 font-bold truncate">
                            {activeTab === 'delivery' ? '9:16 • 🚚 Delivery & POD' : '9:16 • 📊 Daily Check & [✓]'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <a
                                href="/upload_tutorial.html"
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 rounded-xl text-[11px] font-black border border-amber-500/40 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
                                title="Upload / Ganti Video Tutorial (上传或更换教学视频)"
                            >
                                <Upload size={13} />
                                <span>Tukar / 上传</span>
                            </a>
                            <a
                                href={currentVideo}
                                download
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-[11px] font-black border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
                            >
                                <Download size={13} />
                                <span>Muat Turun / 下载</span>
                            </a>
                        </div>
                    </div>

                    {/* Step Guidelines Card */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2 text-xs">
                        {activeTab === 'delivery' ? (
                            <>
                                <h4 className="font-black text-blue-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="text-blue-400" />
                                    <span>Langkah Utama Penghantaran / 送货关键步骤:</span>
                                </h4>
                                <ol className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed pl-4 list-decimal marker:text-blue-400 marker:font-bold">
                                    <li>
                                        <strong className="text-white">Imbas QR Lori:</strong> Imbas kod QR di papan pemuka lori sebelum bertolak (出车前扫描绑定货车).
                                    </li>
                                    <li>
                                        <strong className="text-white">Wajib 2 Gambar POD:</strong> Ambil gambar DO bercop pembeli & gambar susunan barang di kedai (必须拍摄盖章签收单与现场货物双照片).
                                    </li>
                                    <li>
                                        <strong className="text-white">Tamat Syif:</strong> Selepas selesai semua hantaran, imbas QR untuk pulangkan lori (送完全部点后，扫描归还货车交更).
                                    </li>
                                </ol>
                            </>
                        ) : (
                            <>
                                <h4 className="font-black text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="text-emerald-400" />
                                    <span>Langkah Semakan Trip Harian / 每日核对步骤:</span>
                                </h4>
                                <ol className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed pl-4 list-decimal marker:text-emerald-400 marker:font-bold">
                                    <li>
                                        <strong className="text-white">Buka Laporan Bulanan:</strong> Semak rekod kerja anda setiap petang selepas tamat syif (每天下班进入个人月报).
                                    </li>
                                    <li>
                                        <strong className="text-white">Periksa Trip & Komisen:</strong> Semak jumlah drop, elaun asas, dan komisen tambahan hari ini (仔细核对今日出车单号、底薪与每单提成).
                                    </li>
                                    <li>
                                        <strong className="text-white">Tandakan [✓] Pengesahan:</strong> Klik kotak pengesahan [✓] jika semua maklumat betul (无误后勾选确认；若有差异请在月底HR锁单前报备).
                                    </li>
                                </ol>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                        TUTUP / 明白并关闭
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DriverTutorialModal;
