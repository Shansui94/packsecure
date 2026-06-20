import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import {
    PackagingColor,
    ProductSize,
    ProductLayer,
    ProductMaterial,
    JobOrder,
    ProductionLog,
    User,
    Machine
} from '../types';
import { PRODUCT_SIZES } from '../data/constants';
import { getRecommendedPackaging } from '../utils/packagingRules';
import { getBubbleWrapSku } from '../utils/skuMapper';
import { 
    Box, Settings, Clock, Layers, LogOut, Calendar, Package,
    Camera, Check, AlertTriangle, User as UserIcon, RefreshCw, Play, Loader, Send, Sparkles, Image as ImageIcon,
    Video, Square, X
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { getMachineByCode, getMachineById } from '../services/productionService';
import { Scanner } from '@yudiel/react-qr-scanner';


// --- TYPE DEFINITIONS ---
interface OperatorTask {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    due_date: string | null;
}

interface ParsedSku {
    layer: ProductLayer;
    material: ProductMaterial;
    size: ProductSize;
    rolls: number;
    color: PackagingColor;
}

interface ScheduleItem {
    id: string;
    machine_id: string;
    sku: string;
    target_qty: number;
    scheduled_time: string | null;
    notes: string | null;
    status: string;
}

const CATEGORIES: Record<string, { label: string; emoji: string; color: string }> = {
    qc: { label: 'QC 质检', emoji: '🔍', color: 'bg-apple-blue/20 text-blue-300 border-apple-blue/30' },
    defect: { label: 'Defect 次品', emoji: '⚠️', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    downtime: { label: '停机 Stop', emoji: '🛑', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    startup: { label: '开机 Start', emoji: '🟢', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    recipe: { label: '原料配方', emoji: '🧪', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    carton: { label: '成品纸箱', emoji: '📦', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    other: { label: '其他 Other', emoji: '📋', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
};

// Parser for SKU
const parseBubbleWrapSku = (sku: string): ParsedSku | null => {
    try {
        if (!sku.startsWith('BW-')) return null;
        const parts = sku.split('-');
        if (parts.length < 4) return null;
        
        const layer: ProductLayer = parts[1] === 'DL' ? 'Double' : 'Single';
        
        let material: ProductMaterial = 'Clear';
        if (parts[2] === 'CLR') material = 'Clear';
        else if (parts[2] === 'BLK') material = 'Black';
        else if (parts[2] === 'YLW') material = 'Yellow';
        
        const specPart = parts[3]; // e.g. 100Mx50CMx2ROLL
        const match = specPart.match(/100Mx(\d+)CMx(\d+)ROLL/i);
        if (!match) return null;
        
        const width = match[1];
        const rolls = parseInt(match[2]);
        const size: ProductSize = `${width}cm` as ProductSize;
        
        let color: PackagingColor = 'Transparent';
        if (parts[4]) {
            const code = parts[4];
            if (code === 'ORN') color = 'Orange';
            else if (code === 'RED') color = 'Pink';
            else if (code === 'BLU') color = 'Blue';
            else if (code === 'YEL') color = 'Yellow';
            else if (code === 'GRN') color = 'Green';
            else if (code === 'TRP') color = 'Transparent';
        }
        
        return { layer, material, size, rolls, color };
    } catch (e) {
        console.error("Failed to parse SKU:", sku, e);
        return null;
    }
};

const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
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

// --- PRODUCTION LANE COMPONENT ---
interface ProductionLaneProps {
    laneId: 'Left' | 'Right' | 'Single' | 'Lane1' | 'Lane2';
    machineMetadata: Machine | null;
    user: User | null;
    operatorId: string | null;
    activeJob: JobOrder | null;
    jobs: JobOrder[];
    onProductionComplete: () => void;
    onBeforeProduce?: () => boolean;
    className?: string;
    presetSku?: string | null;
    isControlMode: boolean;
    onTakeoverClick?: () => void;
}

const ProductionLane: React.FC<ProductionLaneProps> = ({ 
    laneId, machineMetadata, operatorId, jobs, onProductionComplete, onBeforeProduce, className, presetSku, isControlMode, onTakeoverClick
}) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedLayer, setSelectedLayer] = useState<ProductLayer>('Single');
    const [selectedMaterial, setSelectedMaterial] = useState<ProductMaterial>('Clear');
    const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
    const [derivedPackaging, setDerivedPackaging] = useState<PackagingColor | null>(null);
    const [productionNote, setProductionNote] = useState<string>('');

    const [isLiveRun, setIsLiveRun] = useState(false);
    const [liveCount, setLiveCount] = useState(0);
    const [activeSku, setActiveSku] = useState<string | null>(null);
    const [selectedRolls, setSelectedRolls] = useState<number>(1);

    // Apply Preset SKU if clicked from schedule
    useEffect(() => {
        if (presetSku) {
            const parsed = parseBubbleWrapSku(presetSku);
            if (parsed) {
                setSelectedLayer(parsed.layer);
                setSelectedMaterial(parsed.material);
                setSelectedSize(parsed.size);
                setSelectedRolls(parsed.rolls);
                setDerivedPackaging(parsed.color);
                setStep(3);
            }
        }
    }, [presetSku]);

    // Auto-update packaging color when rolls count changes
    useEffect(() => {
        if (selectedSize) {
            const pack = getRecommendedPackaging(selectedLayer, selectedMaterial, selectedSize, selectedRolls);
            if (pack !== derivedPackaging) {
                setDerivedPackaging(pack);
            }
        }
    }, [selectedRolls, selectedSize, selectedLayer, selectedMaterial]);

    // Query active product from database to restore running state
    useEffect(() => {
        if (!machineMetadata) return;
        const machineId = machineMetadata.id;

        const loadActiveProduct = async () => {
            try {
                const { data, error } = await supabase
                    .from('machine_active_products')
                    .select('*')
                    .eq('machine_id', machineId)
                    .eq('lane_id', laneId)
                    .maybeSingle();

                if (error) {
                    console.error("Error fetching active product:", error);
                    return;
                }

                if (data && data.product_sku) {
                    console.log(`[Lane] Restoring active product for ${machineId} ${laneId}:`, data.product_sku);
                    const parsed = parseBubbleWrapSku(data.product_sku);
                    if (parsed) {
                        setSelectedLayer(parsed.layer);
                        setSelectedMaterial(parsed.material);
                        setSelectedSize(parsed.size);
                        setSelectedRolls(parsed.rolls);
                        setDerivedPackaging(parsed.color);
                        setActiveSku(data.product_sku);
                        setIsLiveRun(true);
                        setStep(3);

                        // Query existing production logs since updated_at to calculate current session yield
                        const startTime = data.updated_at;
                        const { data: logsData } = await supabase
                            .from('production_logs_v2')
                            .select('output_qty')
                            .eq('machine_id', machineId)
                            .eq('sku', data.product_sku)
                            .gte('created_at', startTime);

                        if (logsData) {
                            const { data: siblingLanes } = await supabase
                                .from('machine_active_products')
                                .select('lane_id')
                                .eq('machine_id', machineId)
                                .eq('product_sku', data.product_sku);
                            
                            const activeLanesCount = siblingLanes && siblingLanes.length > 0 ? siblingLanes.length : 1;

                            const total = logsData.reduce((sum, log) => {
                                const logLane = log.Source_Lane || log.source_lane;
                                if (logLane && logLane !== 'Unknown' && logLane !== laneId) {
                                    return sum;
                                }
                                return sum + (Number(log.output_qty) || 1);
                            }, 0);
                            setLiveCount(Math.floor(total / activeLanesCount));
                        } else {
                            setLiveCount(0);
                        }
                    }
                } else {
                    // No active product for this lane, reset to step 1
                    setIsLiveRun(false);
                    setActiveSku(null);
                    setLiveCount(0);
                    setStep(1);
                }
            } catch (err) {
                console.error("Failed to load active product:", err);
            }
        };

        loadActiveProduct();
    }, [machineMetadata, laneId]);

    const handleTypeSelect = (layer: ProductLayer, material: ProductMaterial) => {
        setSelectedLayer(layer);
        setSelectedMaterial(material);
        setStep(2);
    };

    const handleSizeSelect = (size: ProductSize) => {
        setSelectedSize(size);
        const numericSize = parseInt(size.replace(/[^0-9]/g, '')) || 100;
        const machineWidth = 100; // Fixed per user instructions
        const maxRollsAcross = Math.floor(machineWidth / numericSize) || 1;

        const defaultRolls = size === '100cm' ? 1 :
            size === '50cm' ? 2 :
            size === '33cm' ? 3 :
            size === '25cm' ? 4 : 5;

        const finalDefault = Math.min(defaultRolls, maxRollsAcross);
        setSelectedRolls(finalDefault);

        const pack = getRecommendedPackaging(selectedLayer, selectedMaterial, size, finalDefault);
        setDerivedPackaging(pack);

        setStep(3);
        setIsLiveRun(false);
        setLiveCount(0);
        setActiveSku(null);
    };

    const toggleProductionRun = async () => {
        if (isLiveRun) {
            try {
                const machineId = machineMetadata?.id || 'T1.2-M01';
                await supabase.from('machine_active_products')
                    .delete()
                    .eq('machine_id', machineId)
                    .eq('lane_id', laneId);
            } catch (err) {
                console.error("Failed to clear active product:", err);
            }
            setIsLiveRun(false);
            setActiveSku(null);
        } else {
            if (onBeforeProduce && !onBeforeProduce()) return;
            if (!derivedPackaging || !selectedSize) {
                alert("Error: Packaging or Size not selected.");
                return;
            }
            const v3Sku = getBubbleWrapSku(selectedLayer, selectedMaterial, selectedSize, selectedRolls, derivedPackaging);

            const numericSize = parseInt(selectedSize.replace(/[^0-9]/g, '')) || 100;
            const machineBaseWidth = 100;
            const calculatedYield = Math.floor((machineBaseWidth / numericSize) / selectedRolls) || 1;

            try {
                const machineId = machineMetadata?.id || 'T1.2-M01';

                // --- AUTO-REGISTRATION OF UNKNOWN SKU ---
                const { data: existingItem } = await supabase
                    .from('master_items_v2')
                    .select('sku')
                    .eq('sku', v3Sku)
                    .single();

                if (!existingItem) {
                    const autoName = `${selectedLayer} ${selectedMaterial} ${selectedSize} ${selectedRolls}Rolls ${derivedPackaging || ''}`.trim();
                    await supabase
                        .from('master_items_v2')
                        .insert({
                            sku: v3Sku,
                            name: `[AUTO-REG] ${autoName}`,
                            type: 'FG',
                            status: 'Active',
                            uom: 'Roll',
                            supply_type: 'Manufactured'
                        });
                }

                const { error } = await supabase.from('machine_active_products').upsert({
                    machine_id: machineId,
                    lane_id: laneId,
                    product_sku: v3Sku,
                    cutting_size: numericSize,
                    yield: calculatedYield,
                    operator_id: operatorId,
                    updated_at: new Date()
                }, { onConflict: 'machine_id,lane_id' });
                if (error) throw error;
                setIsLiveRun(true);
                setLiveCount(0);
                setActiveSku(v3Sku);
            } catch (error: any) {
                console.error("Failed to start run:", error);
                alert("Failed to start run: " + error.message);
            }
        }
    };

    // LIVE COUNT & AUTO-JOB UPDATE
    useEffect(() => {
        if (!isLiveRun || !activeSku) return;

        const machineId = machineMetadata?.id || 'T1.2-M01';
        const channelName = `prod-ctrl-${laneId}-${Date.now()}`;

        const channel = supabase.channel(channelName)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'production_logs_v2' },
                async (payload) => {
                    const newLog = payload.new;
                    
                    const logId = newLog.log_id;
                    if (logId) {
                        if (processedLogIds.has(logId)) return;
                        processedLogIds.add(logId);
                    }
                    
                    const logSku = newLog.sku || newLog.product_sku;
                    const logQty = newLog.output_qty || newLog.alarm_count || 1;
                    const logLane = newLog.lane_id || newLog.source_lane;

                    const isOldFirmwareSkipped = logSku === 'UNKNOWN' && logLane === 'Unknown';

                    const matchMachine = newLog.machine_id?.trim() === machineId?.trim();
                    const matchSku = logSku?.trim() === activeSku?.trim();

                    if (!isOldFirmwareSkipped && (!matchMachine || !matchSku)) {
                        return;
                    }
                    
                    if (!isOldFirmwareSkipped && logLane && logLane !== laneId) return;

                    setLiveCount(prev => prev + logQty);

                    // --- AUTO-UPDATE MATCHING JOB ---
                    const currentProduct = `${selectedLayer} ${selectedMaterial} ${selectedSize}`;
                    const qty = logQty;
                    const matchingJob = jobs.find(j =>
                        (j.machine === machineId || j.Machine_ID === machineId) &&
                        j.status !== 'Completed' &&
                        j.product === currentProduct
                    );

                    if (matchingJob) {
                        const newProduced = (matchingJob.produced || 0) + qty;
                        const isComplete = newProduced >= matchingJob.target;
                        await supabase.from('job_orders').update({
                            produced: newProduced,
                            status: isComplete ? 'Completed' : matchingJob.status
                        }).eq('job_id', matchingJob.Job_ID || matchingJob.id);
                    }

                    onProductionComplete();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isLiveRun, activeSku, machineMetadata, laneId, jobs, selectedLayer, selectedMaterial, selectedSize]);

    const canProduceDL = !machineMetadata || machineMetadata.name?.includes('Double Layer') || machineMetadata.type?.includes('Double') || machineMetadata.name?.includes('Double');

    return (
        <div className={`flex-1 apple-glass rounded-3xl p-1 relative overflow-hidden flex flex-col min-h-[460px] shadow-lg border border-black/5 dark:border-white/10 ${className}`}>
            {/* Lane Badge */}
            {laneId !== 'Single' && (
                <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold uppercase rounded-bl-xl border-l border-b border-black/5 dark:border-white/10 z-20 ${laneId === 'Left' || laneId === 'Lane1' ? 'bg-apple-blue/10 text-apple-blue' : 'bg-purple-500/10 text-purple-500'
                    }`}>
                    {laneId === 'Left' || laneId === 'Right' ? `${laneId} Lane` : laneId}
                </div>
            )}

            {/* PROGRESS BAR */}
            <div className="flex border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                {[
                    { id: 1, label: "01. TYPE", icon: Layers },
                    { id: 2, label: "02. SIZE", icon: Box },
                    { id: 3, label: "03. PRODUCE", icon: Settings }
                ].map((s) => {
                    const isActive = step === s.id;
                    const isPast = step > s.id;
                    const Icon = s.icon;
                    return (
                        <div
                            key={s.id}
                            className={`flex-1 py-4 text-center relative transition-all duration-500 flex items-center justify-center gap-2
                                ${isActive ? (laneId === 'Left' || laneId === 'Single' ? 'text-apple-blue bg-apple-blue/5' : 'text-purple-500 bg-purple-500/5') : ''}
                                ${isPast ? 'text-apple-textMain dark:text-white' : 'text-apple-textMuted'}
                            `}
                        >
                            <Icon size={16} className={isActive ? 'animate-bounce' : ''} />
                            <span className={`hidden md:inline text-xs font-bold tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>{s.label}</span>
                            {isActive && (
                                <div className={`absolute bottom-0 left-0 w-full h-0.5 shadow-sm ${laneId === 'Left' || laneId === 'Single' ? 'bg-apple-blue' : 'bg-purple-500'
                                    }`}></div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* CONTENT */}
            <div className="flex-1 p-4 md:p-6 relative overflow-y-auto custom-scrollbar">

                {/* STEP 1 */}
                {step === 1 && (
                    <div className="flex flex-col gap-3 h-full animate-slide-up">
                        {!canProduceDL && (
                            <div className="text-[10px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 font-mono">
                                This machine produces Single Layer only
                            </div>
                        )}
                        <div className={`grid gap-3 h-full ${canProduceDL ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
                            {[
                                { layer: 'Single', mat: 'Clear', label: 'SL Clear', img: '/assets/product-types/single-clear.png', border: 'border-cyan-500/30', bg: 'bg-white/10' },
                                { layer: 'Single', mat: 'Black', label: 'SL Black', img: '/assets/product-types/double-black.png', border: 'border-gray-600', bg: 'bg-black/60' },
                                { layer: 'Double', mat: 'Clear', label: 'DL Clear', img: '/assets/product-types/double-clear.png', border: 'border-blue-400', glow: true, bg: 'bg-white/10' },
                                { layer: 'Double', mat: 'Black', label: 'DL Black', img: '/assets/product-types/single-black.png', border: 'border-slate-500', bg: 'bg-black/80' },
                            ].filter(item => canProduceDL || item.layer === 'Single')
                                .map((item, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleTypeSelect(item.layer as any, item.mat as any)}
                                        className={`
                                            relative group rounded-3xl border ${item.bg === 'bg-white/10' ? 'border-apple-blue' : 'border-black/5 dark:border-white/10'} bg-black/5 dark:bg-white/5 overflow-hidden
                                            hover:scale-[1.02] active:scale-95 transition-all duration-300 flex flex-col justify-between
                                            hover:shadow-xl hover:border-apple-blue
                                            min-h-[140px] p-0
                                            ${item.glow ? 'shadow-apple-card' : ''}
                                        `}
                                    >
                                        <div className="h-2/3 w-full relative bg-black/5 dark:bg-black/20 p-2">
                                            <img src={item.img} alt={item.label} className="w-full h-full object-contain drop-shadow-xl" />
                                        </div>
                                        <div className="h-1/3 w-full flex items-center justify-center bg-white/50 dark:bg-white/5 border-t border-black/5 dark:border-white/5">
                                            <span className="text-xs md:text-sm font-black text-apple-textMain dark:text-white uppercase">{item.label}</span>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <div className="flex flex-col h-full animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-apple-textMuted text-xs font-mono uppercase">Select Size</span>
                            <button onClick={() => setStep(1)} className="text-xs font-bold text-apple-textMuted hover:text-apple-textMain dark:hover:text-white px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10">BACK</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {PRODUCT_SIZES.map(size => {
                                return (
                                    <button
                                        key={size.value}
                                        onClick={() => handleSizeSelect(size.value as ProductSize)}
                                        className="relative group rounded-2xl py-6 flex flex-col items-center gap-1 transition-all apple-card hover:bg-apple-blue/5 border border-black/5 dark:border-white/10 hover:border-apple-blue active:scale-95"
                                    >
                                        <span className="text-3xl font-black text-apple-textMain dark:text-white">{size.label.replace(/[^0-9]/g, '')}</span>
                                        <span className="text-xs text-apple-textMuted">{size.rolls} Rolls</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* STEP 3 */}
                {step === 3 && derivedPackaging && (() => {
                    const colorMap: any = {
                        'Orange': { hex: '#FF3D00' },
                        'Pink': { hex: '#F50057' },
                        'Blue': { hex: '#2979FF' },
                        'Yellow': { hex: '#FFD600' },
                        'Green': { hex: '#00E676' },
                        'Transparent': { hex: '#FFFFFF' }
                    };
                    const theme = colorMap[derivedPackaging] || colorMap['Transparent'];

                    return (
                        <div className="h-full flex flex-col gap-4 animate-slide-up">
                            {/* Visualizer Compact */}
                            <div
                                className={`p-4 rounded-2xl border bg-black/5 dark:bg-white/5 relative overflow-hidden flex items-center justify-between transition-colors duration-300`}
                                style={{ borderColor: theme.hex }}
                            >
                                <div className="absolute inset-0 opacity-10 transition-colors duration-300" style={{ backgroundColor: theme.hex }}></div>
                                <div className="relative z-10">
                                    <div className="text-[10px] text-apple-textMuted uppercase font-bold tracking-wider">Pack Color</div>
                                    <div
                                        className="text-3xl font-black flex items-center gap-2 drop-shadow-md"
                                        style={{ color: theme.hex }}
                                    >
                                        {derivedPackaging === 'Pink' ? 'RED' : derivedPackaging.toUpperCase()}

                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-apple-textMain dark:text-white">{selectedLayer}</span>
                                        <span className="text-[10px] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-apple-textMain dark:text-white">{selectedSize}</span>
                                    </div>
                                </div>
                                <button onClick={() => setStep(2)} className="relative z-10 px-3 py-1 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-lg text-xs text-apple-textMain dark:text-white">Change</button>
                            </div>

                            {/* Note Input */}
                            <div className="flex gap-2">
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-2 gap-2">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Pack x</span>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setSelectedRolls(Math.max(1, selectedRolls - 1))}
                                            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs"
                                        >-</button>
                                        <span className="text-sm font-black text-white w-4 text-center">{selectedRolls}</span>
                                        <button
                                            onClick={() => {
                                                const numericSize = parseInt(selectedSize?.replace(/[^0-9]/g, '') || '100');
                                                const maxRolls = Math.floor(100 / numericSize) || 1;
                                                if (selectedRolls < maxRolls) {
                                                    setSelectedRolls(selectedRolls + 1);
                                                }
                                            }}
                                            disabled={(() => {
                                                const numericSize = parseInt(selectedSize?.replace(/[^0-9]/g, '') || '100');
                                                const maxRolls = Math.floor(100 / numericSize) || 1;
                                                return selectedRolls >= maxRolls;
                                            })()}
                                            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs disabled:opacity-20 disabled:cursor-not-allowed"
                                        >+</button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Note (Optional)"
                                    value={productionNote}
                                    onChange={(e) => setProductionNote(e.target.value)}
                                    className="flex-1 bg-black/30 text-white text-xs px-3 py-2 rounded-xl border border-white/10 focus:border-cyan-500 focus:outline-none"
                                />
                            </div>

                            {/* RUN CONTROLS */}
                            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                                {!isControlMode && !isLiveRun ? (
                                    <button
                                        onClick={onTakeoverClick}
                                        className="w-full text-center p-6 border border-dashed border-white/10 hover:border-apple-blue/50 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md transition-all active:scale-[0.98] group"
                                    >
                                        <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">🔒</span>
                                        <span className="text-sm font-bold text-gray-400 uppercase tracking-wider block group-hover:text-apple-blue transition-colors">Takeover Controls</span>
                                        <span className="text-[10px] text-gray-500 block mt-1">Click to enter PIN & bind operator to run machine.</span>
                                    </button>
                                ) : isLiveRun ? (
                                    <div className="w-full flex flex-col items-center animate-fade-in-up">
                                        <div className="text-center mb-4">
                                            <div className="text-apple-green font-bold text-xs uppercase tracking-[0.2em] mb-1 animate-pulse">Live Production Active</div>
                                            <div className="text-[60px] font-black text-apple-textMain dark:text-white leading-none tabular-nums drop-shadow-md">
                                                {liveCount}
                                            </div>
                                            <div className="text-apple-textMuted text-xs font-mono">Units Produced This Session</div>
                                        </div>

                                        {isControlMode ? (
                                            <button
                                                onClick={toggleProductionRun}
                                                className="w-full py-4 bg-apple-red/10 hover:bg-apple-red/20 rounded-2xl font-black text-apple-red border border-apple-red/20 active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
                                            >
                                                <div className="w-3 h-3 bg-apple-red rounded-sm"></div>
                                                STOP RUN
                                            </button>
                                        ) : (
                                            <button
                                                onClick={onTakeoverClick}
                                                className="w-full text-xs text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 px-4 py-2.5 rounded-xl text-center transition-all active:scale-95 font-bold flex items-center justify-center gap-1.5"
                                            >
                                                <span>🔒 Click to Enter PIN & Takeover to STOP</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={toggleProductionRun}
                                        className="w-full h-32 bg-apple-green/10 hover:bg-apple-green/20 rounded-2xl font-black text-apple-green border border-apple-green/20 active:scale-95 transition-all text-2xl flex flex-col items-center justify-center gap-2 group"
                                    >
                                        <div className="w-12 h-12 rounded-full border-[3px] border-apple-green flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-apple-green border-b-[8px] border-b-transparent ml-1"></div>
                                        </div>
                                        START RUN
                                        <span className="text-xs font-normal opacity-80">Set Machine to This Product</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })()}

            </div>
        </div>
    );
};

const processedLogIds = new Set<string>();

const formatMachineName = (name: string) => {
    return name
        .replace('DOUBLE LAYER', 'DL')
        .replace('SINGLE LAYER', 'SL');
};

// --- MAIN CONTROLLER COMPONENT ---
interface ProductionControlProps {
    user: User | null;
    jobs?: JobOrder[];
}

const ProductionControl: React.FC<ProductionControlProps> = ({ user, jobs = [] }) => {
    // Machine Selection State
    const [selectedMachine, setSelectedMachine] = useState<string | null>(
        sessionStorage.getItem('selectedMachine') || localStorage.getItem('device_machine_id')
    );
    const [machines, setMachines] = useState<Machine[]>([]);
    const [machineMetadata, setMachineMetadata] = useState<Machine | null>(null);
    const [isScanningMachine, setIsScanningMachine] = useState<boolean>(false);
    const currentMachineName = machineMetadata?.name || selectedMachine || 'Unknown Machine';


    // Active Job State
    const [activeJob, setActiveJob] = useState<JobOrder | null>(null);
    const [recentLogs, setRecentLogs] = useState<ProductionLog[]>([]);

    // Operator ID State
    const [operatorId, setOperatorId] = useState<string | null>(localStorage.getItem('operatorId'));
    const [operatorEmployeeId, setOperatorEmployeeId] = useState<string | null>(localStorage.getItem('operatorEmployeeId'));
    const [operatorName, setOperatorName] = useState<string | null>(localStorage.getItem('operatorName'));

    // Control vs Monitor Mode State
    const [isControlMode, setIsControlMode] = useState<boolean>(false);

    // Shift Clock stopwatch
    const [clockInTime, setClockInTime] = useState<string | null>(localStorage.getItem('operatorClockInTime'));
    const [durationText, setDurationText] = useState('00:00:00');

    // Production Schedule State
    const [scheduleTasks, setScheduleTasks] = useState<ScheduleItem[]>([]);
    // Operator Tasks State
    const [operatorTasks, setOperatorTasks] = useState<OperatorTask[]>([]);
    const [presetSku, setPresetSku] = useState<string | null>(null);

    // Takeover Warning Modal State
    const [takeoverWarningRecord, setTakeoverWarningRecord] = useState<any>(null);
    const [lastTakeoverWarning, setLastTakeoverWarning] = useState<any>(null);

    useEffect(() => {
        if (takeoverWarningRecord) {
            setLastTakeoverWarning(takeoverWarningRecord);
        }
    }, [takeoverWarningRecord]);

    // Photo log state
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [photoCategory, setPhotoCategory] = useState('qc');
    const [photoNote, setPhotoNote] = useState('');
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
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

    // Operator Selection Modal State
    const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
    const [operators, setOperators] = useState<any[]>([]);
    const [loadingOperators, setLoadingOperators] = useState(false);
    const [operatorSearchQuery, setOperatorSearchQuery] = useState('');

    // Defect values
    const [defectWeight, setDefectWeight] = useState('');
    const [defectReason, setDefectReason] = useState('');

    // Recipe and Carton values
    const [recipeName, setRecipeName] = useState('');
    const [recipeMaterials, setRecipeMaterials] = useState<any[]>([]);
    const [recipeTotalWeight, setRecipeTotalWeight] = useState('');
    const [cartonSku, setCartonSku] = useState('');
    const [cartonRolls, setCartonRolls] = useState('6');
    const [cartonGrossWeight, setCartonGrossWeight] = useState('');
    const [cartonNetWeight, setCartonNetWeight] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // PIN Confirmation Modal for Machine Selection
    const [pendingMachine, setPendingMachine] = useState<string | null>(null);
    const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
    const [enteredPin, setEnteredPin] = useState<string>('');
    const [pinError, setPinError] = useState<string | null>(null);

    // Machine Active Operator tracking
    interface MachineOperatorDetails {
        name: string;
        employeeId: string;
        clockIn: string;
    }
    const [machineOperator, setMachineOperator] = useState<MachineOperatorDetails | null>(null);

    // Stopwatch Effect
    useEffect(() => {
        if (!clockInTime) return;
        
        const interval = setInterval(() => {
            const start = new Date(clockInTime).getTime();
            const now = new Date().getTime();
            const diffMs = Math.max(0, now - start);
            
            const hours = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            const seconds = Math.floor((diffMs % 60000) / 1000);
            
            const format = (n: number) => String(n).padStart(2, '0');
            setDurationText(`${format(hours)}:${format(minutes)}:${format(seconds)}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [clockInTime]);

    // Sync operator details if logged in as Operator role
    useEffect(() => {
        if (user) {
            if (user.role === 'Operator') {
                localStorage.setItem('operatorId', user.uid);
                if (user.employeeId) localStorage.setItem('operatorEmployeeId', user.employeeId);
                if (user.name) localStorage.setItem('operatorName', user.name);
                
                setOperatorId(user.uid);
                setOperatorEmployeeId(user.employeeId || null);
                setOperatorName(user.name || null);
                setIsControlMode(true);
            } else {
                // Admins/Managers default to Monitor Mode
                setIsControlMode(false);
            }
        }
    }, [user]);

    // Check Takeover Warning
    useEffect(() => {
        if (!operatorEmployeeId) return;

        const checkTakeoverWarning = async () => {
            try {
                // Find any shift for this operator that was auto-logged out by takeover and not confirmed yet
                const { data } = await supabase
                    .from('operator_attendance')
                    .select('*')
                    .eq('operator_id', operatorEmployeeId)
                    .like('notes', 'Auto-Logout: Kicked by%')
                    .not('notes', 'like', '%(Confirmed)')
                    .order('clock_in', { ascending: false })
                    .limit(1);

                if (data && data.length > 0) {
                    setTakeoverWarningRecord(data[0]);
                }
            } catch (err) {
                console.error("Failed to check takeover warning:", err);
            }
        };

        checkTakeoverWarning();
    }, [operatorEmployeeId]);

    const confirmTakeoverWarning = async () => {
        if (!takeoverWarningRecord) return;
        try {
            const updatedNotes = `${takeoverWarningRecord.notes} (Confirmed)`;
            await supabase
                .from('operator_attendance')
                .update({ notes: updatedNotes })
                .eq('id', takeoverWarningRecord.id);

            setTakeoverWarningRecord(null);
        } catch (err) {
            console.error("Failed to confirm takeover warning:", err);
            alert("System error. Please try again.");
        }
    };

    // Fetch currently active operator on selected machine
    const fetchMachineOperator = async () => {
        if (!selectedMachine) {
            setMachineOperator(null);
            return;
        }
        try {
            const { data } = await supabase
                .from('operator_attendance')
                .select('clock_in, operator_id')
                .eq('machine_id', selectedMachine)
                .is('clock_out', null)
                .limit(1);

            if (data && data.length > 0) {
                const activeShift = data[0];
                const { data: operatorUser } = await supabase
                    .from('sys_users_v2')
                    .select('name')
                    .eq('employee_id', activeShift.operator_id)
                    .maybeSingle();

                setMachineOperator({
                    name: operatorUser?.name || 'Unknown Operator',
                    employeeId: activeShift.operator_id,
                    clockIn: activeShift.clock_in
                });
            } else {
                setMachineOperator(null);
            }
        } catch (err) {
            console.error("Error fetching machine operator:", err);
            setMachineOperator(null);
        }
    };

    useEffect(() => {
        fetchMachineOperator();
        
        // Setup real-time listener for attendance changes on this machine to update active operator
        const channel = supabase.channel(`attendance-operator-${selectedMachine}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'operator_attendance'
            }, () => {
                fetchMachineOperator();
            })
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedMachine]);

    const handleMachineTabClick = (machineId: string) => {
        if (selectedMachine === machineId) return; // Already selected
        
        // Reset control mode to false (Monitor Mode) when switching tabs to prevent auto-takeover on the new machine
        setIsControlMode(false);
        
        sessionStorage.setItem('selectedMachine', machineId);
        localStorage.setItem('device_machine_id', machineId);
        setSelectedMachine(machineId);
    };

    const initiateTakeover = async (machineId: string) => {
        setPendingMachine(machineId);
        setIsOperatorModalOpen(true);
        setOperatorSearchQuery('');
        setLoadingOperators(true);
        try {
            const { data, error } = await supabase
                .from('sys_users_v2')
                .select('auth_user_id, employee_id, name, photo_url, role')
                .eq('status', 'Active')
                .order('name');
            if (error) throw error;
            if (data) {
                const filtered = data.filter(u => u.role === 'Operator' || u.role === 'SuperAdmin' || u.role === 'Admin' || u.role === 'Manager');
                setOperators(filtered);
            }
        } catch (err) {
            console.error("Error loading operators:", err);
        } finally {
            setLoadingOperators(false);
        }
    };

    const handleSelectOperator = async (op: any) => {
        localStorage.setItem('operatorId', op.auth_user_id);
        if (op.employee_id) localStorage.setItem('operatorEmployeeId', op.employee_id);
        if (op.name) localStorage.setItem('operatorName', op.name);
        
        setOperatorId(op.auth_user_id);
        setOperatorEmployeeId(op.employee_id || null);
        setOperatorName(op.name || null);
        setIsControlMode(true);

        const targetMachine = pendingMachine || selectedMachine;
        if (targetMachine) {
            sessionStorage.setItem('selectedMachine', targetMachine);
            localStorage.setItem('device_machine_id', targetMachine);
            setSelectedMachine(targetMachine);
        }
        
        setIsOperatorModalOpen(false);
        setPendingMachine(null);
    };

    const proceedMachineSelection = (machineId: string) => {
        sessionStorage.setItem('selectedMachine', machineId);
        localStorage.setItem('device_machine_id', machineId);
        setSelectedMachine(machineId);
        setIsControlMode(true);
        setIsPinModalOpen(false);
        setPendingMachine(null);
        setEnteredPin('');
        setPinError(null);
    };

    const handlePinInput = async (num: number) => {
        if (enteredPin.length >= 4) return;
        const newPin = enteredPin + num;
        setEnteredPin(newPin);
        
        if (newPin.length === 4) {
            try {
                if (user) {
                    // Personal account: verify against logged-in user's pinCode
                    if (user.pinCode === newPin) {
                        localStorage.setItem('operatorId', user.uid);
                        if (user.employeeId) localStorage.setItem('operatorEmployeeId', user.employeeId);
                        if (user.name) localStorage.setItem('operatorName', user.name);
                        
                        setOperatorId(user.uid);
                        setOperatorEmployeeId(user.employeeId || null);
                        setOperatorName(user.name || null);
                        
                        proceedMachineSelection(pendingMachine!);
                    } else {
                        // Double check directly on DB in case state was not sync'd
                        const { data } = await supabase
                            .from('sys_users_v2')
                            .select('pin_code, name, employee_id')
                            .eq('auth_user_id', user.uid)
                            .maybeSingle();
                        
                        if (data && data.pin_code === newPin) {
                            localStorage.setItem('operatorId', user.uid);
                            if (data.employee_id) localStorage.setItem('operatorEmployeeId', data.employee_id);
                            if (data.name) localStorage.setItem('operatorName', data.name);
                            
                            setOperatorId(user.uid);
                            setOperatorEmployeeId(data.employee_id || null);
                            setOperatorName(data.name || null);

                            proceedMachineSelection(pendingMachine!);
                        } else {
                            // Check if this PIN code matches another operator in the database!
                            const { data: anyOperator } = await supabase
                                .from('sys_users_v2')
                                .select('auth_user_id, employee_id, name, role')
                                .eq('pin_code', newPin)
                                .maybeSingle();

                            if (anyOperator && (anyOperator.role === 'Operator' || anyOperator.role === 'SuperAdmin' || anyOperator.role === 'Admin' || anyOperator.role === 'Manager')) {
                                localStorage.setItem('operatorId', anyOperator.auth_user_id);
                                localStorage.setItem('operatorEmployeeId', anyOperator.employee_id);
                                localStorage.setItem('operatorName', anyOperator.name);
                                
                                setOperatorId(anyOperator.auth_user_id);
                                setOperatorEmployeeId(anyOperator.employee_id);
                                setOperatorName(anyOperator.name);

                                proceedMachineSelection(pendingMachine!);
                            } else {
                                setPinError("Invalid PIN code.");
                                setEnteredPin('');
                            }
                        }
                    }
                } else {
                    // Shared Kiosk Mode (user is null): query sys_users_v2 to resolve the operator by pin_code
                    const { data } = await supabase
                        .from('sys_users_v2')
                        .select('auth_user_id, employee_id, name, role')
                        .eq('pin_code', newPin)
                        .maybeSingle();
                    
                    if (data && data.role === 'Operator') {
                        localStorage.setItem('operatorId', data.auth_user_id);
                        localStorage.setItem('operatorEmployeeId', data.employee_id);
                        localStorage.setItem('operatorName', data.name);
                        
                        setOperatorId(data.auth_user_id);
                        setOperatorEmployeeId(data.employee_id);
                        setOperatorName(data.name);
                        setIsControlMode(true);
                        
                        proceedMachineSelection(pendingMachine!);
                    } else if (data && data.role !== 'Operator') {
                        setPinError("Only Operators can bind via Kiosk PIN.");
                        setEnteredPin('');
                    } else {
                        setPinError("Incorrect PIN or operator not found.");
                        setEnteredPin('');
                    }
                }
            } catch (err) {
                console.error("PIN verification error:", err);
                setPinError("System error. Please try again.");
                setEnteredPin('');
            }
        }
    };

    // Auto Clock In / Attendance Sync when machine is selected
    useEffect(() => {
        if (!selectedMachine || !operatorEmployeeId || !isControlMode) return;

        const syncAttendance = async () => {
            try {
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const clockEventTime = now.toISOString();

                // 1. CHECK AND HANDLE TAKEOVER FOR THIS MACHINE
                const { data: activeShifts } = await supabase
                    .from('operator_attendance')
                    .select('id, clock_in, operator_id')
                    .eq('machine_id', selectedMachine)
                    .is('clock_out', null);

                if (activeShifts && activeShifts.length > 0) {
                    for (const shift of activeShifts) {
                        if (shift.operator_id !== operatorEmployeeId) {
                            // Kick the other operator
                            const clockInTimeVal = new Date(shift.clock_in).getTime();
                            const hoursWorked = Math.max(0, (now.getTime() - clockInTimeVal) / 3600000);
                            
                            const kickerName = operatorName || 'System';
                            const kickerEmp = operatorEmployeeId || 'Unknown';

                            await supabase.from('operator_attendance')
                                .update({
                                    clock_out: clockEventTime,
                                    hours_worked: Math.round(hoursWorked * 100) / 100,
                                    notes: `Auto-Logout: Kicked by ${kickerName} (${kickerEmp})`
                                })
                                .eq('id', shift.id);
                        }
                    }
                }

                // 2. CHECK IF CURRENT OPERATOR ALREADY HAS AN ACTIVE SHIFT ON THIS MACHINE
                const { data: myShifts } = await supabase
                    .from('operator_attendance')
                    .select('id, clock_in')
                    .eq('operator_id', operatorEmployeeId)
                    .eq('machine_id', selectedMachine)
                    .is('clock_out', null)
                    .limit(1);

                if (myShifts && myShifts.length > 0) {
                    const myShift = myShifts[0];
                    localStorage.setItem('operatorClockInTime', myShift.clock_in);
                    setClockInTime(myShift.clock_in);
                } else {
                    // Not clocked in on this machine.
                    // First, close any active shifts the current operator has on OTHER machines
                    const { data: myOtherShifts } = await supabase
                        .from('operator_attendance')
                        .select('id, clock_in')
                        .eq('operator_id', operatorEmployeeId)
                        .is('clock_out', null);

                    if (myOtherShifts && myOtherShifts.length > 0) {
                        for (const otherShift of myOtherShifts) {
                            const clockInTimeVal = new Date(otherShift.clock_in).getTime();
                            const hoursWorked = Math.max(0, (now.getTime() - clockInTimeVal) / 3600000);
                            await supabase.from('operator_attendance')
                                .update({
                                    clock_out: clockEventTime,
                                    hours_worked: Math.round(hoursWorked * 100) / 100,
                                    notes: 'System Auto-Logout (Switched Machine)'
                                })
                                .eq('id', otherShift.id);
                        }
                    }

                    // Create new shift on the selected machine
                    const { data: newShift } = await supabase
                        .from('operator_attendance')
                        .insert({
                            operator_id: operatorEmployeeId,
                            date: todayStr,
                            clock_in: clockEventTime,
                            machine_id: selectedMachine
                        })
                        .select('clock_in')
                        .single();

                    const newClockIn = newShift?.clock_in || clockEventTime;
                    localStorage.setItem('operatorClockInTime', newClockIn);
                    setClockInTime(newClockIn);
                }
            } catch (err) {
                console.error("Failed to sync attendance:", err);
            }
        };

        syncAttendance();
    }, [selectedMachine, operatorEmployeeId, isControlMode]);

    const handleManualClockOut = async () => {
        if (!operatorEmployeeId || !selectedMachine) return;
        try {
            const now = new Date();
            const clockEventTime = now.toISOString();

            const { data: activeShifts } = await supabase
                .from('operator_attendance')
                .select('id, clock_in')
                .eq('operator_id', operatorEmployeeId)
                .eq('machine_id', selectedMachine)
                .is('clock_out', null);

            if (activeShifts && activeShifts.length > 0) {
                for (const shift of activeShifts) {
                    const clockIn = new Date(shift.clock_in);
                    const hoursWorked = Math.max(0, (now.getTime() - clockIn.getTime()) / 3600000);
                    await supabase.from('operator_attendance')
                        .update({
                            clock_out: clockEventTime,
                            hours_worked: Math.round(hoursWorked * 100) / 100,
                            notes: 'Manual Clock-Out'
                        })
                        .eq('id', shift.id);
                }
            }

            localStorage.removeItem('operatorClockInTime');
            setClockInTime(null);
            
            sessionStorage.removeItem('selectedMachine');
            localStorage.removeItem('device_machine_id');
            setSelectedMachine(null);
            setMachineMetadata(null);

        } catch (err) {
            console.error("Failed to clock out:", err);
        }
    };

    const handleDeviceLogout = async () => {
        const confirmLogout = window.confirm("您确定要退出账户并登出网址吗？\nAre you sure you want to log out?");
        if (!confirmLogout) return;

        try {
            if (clockInTime) {
                await handleManualClockOut();
            }
            
            sessionStorage.removeItem('selectedMachine');
            localStorage.removeItem('device_machine_id');
            localStorage.removeItem('operatorClockInTime');
            localStorage.removeItem('operatorId');
            localStorage.removeItem('operatorEmployeeId');
            localStorage.removeItem('operatorName');
            
            setSelectedMachine(null);
            setMachineMetadata(null);
            setOperatorId(null);
            setOperatorName(null);
            setOperatorEmployeeId(null);
            setClockInTime(null);

            await supabase.auth.signOut();
            window.location.reload();
        } catch (err) {
            console.error("Error exiting device:", err);
        }
    };

    // Fetch machines list
    useEffect(() => {
        supabase.from('sys_machines_v2')
            .select('*')
            .order('factory_id')
            .then(({ data }) => { if (data) setMachines(data as Machine[]); });
    }, []);

    // Filter machines based on location (factoryId)
    const filteredMachines = machines.filter(m => {
        if (m.type === 'Extruder' && m.base_width === 50) return false;
        
        // Filter by user's factoryId if the user is an Operator and has a location bound
        if (user && user.role === 'Operator' && user.factoryId) {
            return m.factory_id === user.factoryId;
        }
        return true;
    });

    // Fetch schedule tasks
    useEffect(() => {
        if (!selectedMachine) { setScheduleTasks([]); return; }

        const machineId = machineMetadata?.id || selectedMachine;
        const fetchSchedule = async () => {
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const { data } = await supabase.from('production_schedule')
                .select('*')
                .eq('machine_id', machineId)
                .gte('created_at', todayStart.toISOString())
                .in('status', ['Pending', 'In-Progress'])
                .order('scheduled_time', { ascending: true, nullsFirst: false });
            if (data) setScheduleTasks(data as ScheduleItem[]);
        };

        fetchSchedule();
        const sub = supabase.channel('schedule-' + machineId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'production_schedule' }, fetchSchedule)
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [selectedMachine, machineMetadata]);

    // Fetch operator checklist tasks
    const fetchOperatorTasks = async () => {
        if (!user) return;
        const { data } = await supabase.from('tasks')
            .select('*')
            .eq('assigned_to', user.uid)
            .neq('status', 'Done')
            .order('created_at', { ascending: false });
        if (data) setOperatorTasks(data as OperatorTask[]);
    };

    useEffect(() => {
        fetchOperatorTasks();
    }, [user]);

    // Resolve Machine Metadata
    useEffect(() => {
        if (!selectedMachine) return;
        const resolveMachine = async () => {
            let machine = await getMachineByCode(selectedMachine);
            if (!machine && selectedMachine.length > 5) {
                machine = await getMachineById(selectedMachine);
            }
            if (machine) {
                setMachineMetadata(machine);
                if (machine.rolls_per_alarm) {
                    setSelectedRolls(machine.rolls_per_alarm);
                }
            }
        };
        resolveMachine();
    }, [selectedMachine]);

    // Find Active Job
    useEffect(() => {
        if (!jobs || !selectedMachine) return;
        const job = jobs.find(j =>
            (j.machine === selectedMachine || j.Machine_ID === selectedMachine) &&
            j.status === 'Production'
        );
        setActiveJob(job || null);
    }, [jobs, selectedMachine]);

    // Fetch Recent logs
    const fetchUserLogs = async () => {
        const targetMachine = (machineMetadata?.id || selectedMachine)?.trim();
        if (!targetMachine) return;

        const { data } = await supabase.from('production_logs_v2')
            .select('log_id, sku, output_qty, created_at')
            .eq('machine_id', targetMachine)
            .not('sku', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10);

        if (data) {
            const mapped: ProductionLog[] = data.map((log: any) => ({
                Log_ID: log.log_id,
                Timestamp: log.created_at,
                Job_ID: 'N/A',
                Operator_Email: '',
                Output_Qty: log.output_qty || 1,
                Note: log.sku || 'Production Log',
            }));
            setRecentLogs(mapped);
        }
    };

    useEffect(() => {
        if (selectedMachine) {
            fetchUserLogs();
            const sub = supabase.channel(`recent-logs-${selectedMachine}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_logs_v2' },
                    (payload) => {
                        const targetMatch = (machineMetadata?.id || selectedMachine)?.trim();
                        if (payload.new.machine_id?.trim() === targetMatch) {
                            fetchUserLogs();
                        }
                    })
                .subscribe();
            return () => { supabase.removeChannel(sub); };
        } else {
            setRecentLogs([]);
        }
    }, [selectedMachine, machineMetadata]);

    const handleProductionAttempt = () => {
        if (!operatorId) {
            alert("No active Operator identity loaded. Please login through App profile.");
            return false;
        }
        if (!isControlMode) {
            alert("Live Controls are locked in Monitor Mode. Please enable Takeover Mode in Header first.");
            return false;
        }
        return true;
    };

    // Schedule task triggers
    const startScheduleTask = async (task: ScheduleItem) => {
        await supabase.from('production_schedule')
            .update({ status: 'In-Progress' })
            .eq('id', task.id);
        setPresetSku(task.sku);
    };

    const completeScheduleTask = async (task: ScheduleItem) => {
        await supabase.from('production_schedule')
            .update({ status: 'Done' })
            .eq('id', task.id);
        setPresetSku(null);
    };

    // Operator Checklist check off
    const toggleTaskComplete = async (taskId: string) => {
        await supabase.from('tasks')
            .update({ status: 'Done' })
            .eq('id', taskId);
        fetchOperatorTasks();
    };

    // File selection
    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    const runAIAnalysis = async (base64Data: string) => {
        setAnalyzingPhoto(true);
        try {
            const res = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64Data })
            });
            if (res.ok) {
                const data = await res.json();
                setAiAnalysis(data.description || 'Job scene detected');
                if (data.category && data.category !== 'defect') {
                    setPhotoCategory(data.category);
                }
            } else {
                setAiAnalysis('Logged work session photo');
            }
        } catch (e) {
            setAiAnalysis('Logged production setup photo');
        } finally {
            setAnalyzingPhoto(false);
        }
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingPhoto(true);
            const compressed = await compressImage(file);
            setPhotoPreview(compressed);
            const base64 = compressed.split(',')[1];
            setPhotoBase64(base64);

            await runAIAnalysis(base64);
        } catch (err) {
            console.error(err);
            alert("Failed to process image.");
        } finally {
            setUploadingPhoto(false);
        }
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

    const handleWebcamCapture = React.useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setPhotoPreview(imageSrc);
            setMediaType('image');
            const base64 = imageSrc.split(',')[1];
            setPhotoBase64(base64);
            setShowWebcam(false);
            
            runAIAnalysis(base64);
        }
    }, [webcamRef]);

    const handleStartRecording = () => {
        const stream = webcamRef.current?.video?.srcObject as MediaStream;
        if (!stream) {
            alert("无法获取摄像头视频流");
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
            setPhotoPreview(videoUrl);
            setMediaType('video');

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setPhotoBase64(base64.split(',')[1]);
                setAiAnalysis('工作视频记录 / Work Video Log');
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

    // Run AI Defect Scan
    const runAIDefectScan = async () => {
        if (!photoBase64) return;
        setAnalyzingPhoto(true);
        try {
            const res = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: photoBase64, mode: 'defect' })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.weight !== undefined) {
                    setDefectWeight(String(data.weight));
                }
                if (data.defect_reason) {
                    setDefectReason(data.defect_reason);
                }
                if (data.description) {
                    setAiAnalysis(data.description);
                }
            } else {
                alert("AI Scan failed to parse the display. Please enter the weight manually.");
            }
        } catch (err) {
            console.error("AI Scan Error:", err);
            alert("AI Scan failed. Please enter weight manually.");
        } finally {
            setAnalyzingPhoto(false);
        }
    };

    const runAIRecipeScan = async () => {
        if (!photoBase64) return;
        setAnalyzingPhoto(true);
        try {
            const res = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: photoBase64, mode: 'recipe' })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.recipe_name) setRecipeName(data.recipe_name);
                if (data.materials) setRecipeMaterials(data.materials);
                if (data.total_input_weight_kg !== undefined) {
                    setRecipeTotalWeight(String(data.total_input_weight_kg));
                }
                if (data.description) setAiAnalysis(data.description);
            } else {
                alert("AI Scan failed. Please enter recipe manually.");
            }
        } catch (err) {
            console.error("AI Recipe Scan Error:", err);
            alert("AI Scan failed. Please enter recipe manually.");
        } finally {
            setAnalyzingPhoto(false);
        }
    };

    const runAICartonScan = async () => {
        if (!photoBase64) return;
        setAnalyzingPhoto(true);
        try {
            const res = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: photoBase64, mode: 'carton' })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.sku) setCartonSku(data.sku);
                if (data.rolls_per_carton) setCartonRolls(String(data.rolls_per_carton));
                if (data.gross_weight) setCartonGrossWeight(String(data.gross_weight));
                if (data.net_weight) setCartonNetWeight(String(data.net_weight));
                if (data.description) setAiAnalysis(data.description);
            } else {
                alert("AI Scan failed. Please enter carton details manually.");
            }
        } catch (err) {
            console.error("AI Carton Scan Error:", err);
            alert("AI Scan failed. Please enter carton details manually.");
        } finally {
            setAnalyzingPhoto(false);
        }
    };

    // Submit Photo Log
    const submitPhotoLog = async () => {
        if (!photoBase64 || !operatorEmployeeId) return;
        setUploadingPhoto(true);

        try {
            const isVideo = mediaType === 'video';
            const fileExt = isVideo ? 'webm' : 'jpg';
            const mimeType = isVideo ? 'video/webm' : 'image/jpeg';
            const fileName = `${operatorEmployeeId}_${Date.now()}.${fileExt}`;
            const blob = await fetch(`data:${mimeType};base64,${photoBase64}`).then(r => r.blob());

            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: mimeType });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const photoUrl = urlData.publicUrl;

            let finalNote = photoNote;
            let isRisk = false;
            let riskReason = "";
            
            if (photoCategory === 'defect') {
                finalNote = `[Defect] Weight: ${defectWeight || '0.00'} KG | Reason: ${defectReason || 'other'} | Notes: ${photoNote}`;
                isRisk = true;
                riskReason = `Defect product recorded: ${defectReason || 'other'} (${defectWeight || '0.00'} KG)`;

                // Insert into production_metrics_calibration
                const netWeightCalc = Number(defectWeight) - (selectedRolls * 0.35); // deduct paper core weight
                await supabase.from('production_metrics_calibration').insert({
                    machine_id: selectedMachine || 'unknown',
                    operator_id: operatorId || null,
                    operator_name: operatorName || 'Unknown Operator',
                    sku: activeSku || 'unknown',
                    set_length: 150, 
                    producing_speed: 65, 
                    temp_zone1: 220,
                    temp_zone2: 230,
                    gross_weight: Number(defectWeight) || 0,
                    net_weight: netWeightCalc > 0 ? netWeightCalc : Number(defectWeight),
                    rolls_count: selectedRolls || 1,
                    photo_url: photoUrl,
                    ai_raw_json: { weight: defectWeight, reason: defectReason }
                });
            } else if (photoCategory === 'recipe') {
                finalNote = `[Recipe] Name: ${recipeName || 'unknown'} | Total Input Weight: ${recipeTotalWeight || '0.00'} kg | Notes: ${photoNote}`;
                
                // Insert into production_material_inputs
                await supabase.from('production_material_inputs').insert({
                    machine_id: selectedMachine || 'unknown',
                    operator_id: operatorId || null,
                    operator_name: operatorName || 'Unknown Operator',
                    recipe_name: recipeName || 'unknown',
                    materials: recipeMaterials,
                    total_weight: Number(recipeTotalWeight) || 0,
                    photo_url: photoUrl,
                    user_note: photoNote
                });
            } else if (photoCategory === 'carton') {
                finalNote = `[Carton] SKU: ${cartonSku || 'unknown'} | Rolls: ${cartonRolls || '6'} | Gross: ${cartonGrossWeight || '0'} kg | Net: ${cartonNetWeight || '0'} kg | Notes: ${photoNote}`;
                
                // Insert into production_metrics_calibration
                await supabase.from('production_metrics_calibration').insert({
                    machine_id: selectedMachine || 'unknown',
                    operator_id: operatorId || null,
                    operator_name: operatorName || 'Unknown Operator',
                    sku: cartonSku || activeSku || 'unknown',
                    set_length: 150, 
                    producing_speed: 70, 
                    temp_zone1: 230,
                    temp_zone2: 240,
                    gross_weight: Number(cartonGrossWeight) || 0,
                    net_weight: Number(cartonNetWeight) || 0,
                    rolls_count: Number(cartonRolls) || 6,
                    photo_url: photoUrl,
                    ai_raw_json: { sku: cartonSku, rolls_per_carton: cartonRolls, gross_weight: cartonGrossWeight, net_weight: cartonNetWeight }
                });
            }

            const { error: dbError } = await supabase.from('work_photos').insert({
                employee_id: operatorEmployeeId,
                employee_name: operatorName || 'Unknown Operator',
                photo_url: photoUrl,
                ai_description: aiAnalysis || (photoCategory === 'defect' ? 'Defect product photo' : 'Work scene logged'),
                user_note: finalNote,
                category: photoCategory,
                risk_flag: isRisk,
                risk_reason: riskReason,
                machine_id: selectedMachine || null // Added machine_id
            });

            if (dbError) throw dbError;

            // Reset States
            setPhotoPreview(null);
            setPhotoBase64(null);
            setPhotoNote('');
            setAiAnalysis(null);
            setDefectWeight('');
            setDefectReason('');
            setRecipeName('');
            setRecipeMaterials([]);
            setRecipeTotalWeight('');
            setCartonSku('');
            setCartonRolls('6');
            setCartonGrossWeight('');
            setCartonNetWeight('');
            setMediaType('image');
            alert(isVideo ? "Work video logged successfully!" : "Work photo logged successfully!");
        } catch (err: any) {
            alert("Failed to upload: " + err.message);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const cancelPhotoSelect = () => {
        setPhotoPreview(null);
        setPhotoBase64(null);
        setPhotoNote('');
        setAiAnalysis(null);
        setDefectWeight('');
        setDefectReason('');
        setRecipeName('');
        setRecipeMaterials([]);
        setRecipeTotalWeight('');
        setCartonSku('');
        setCartonRolls('6');
        setCartonGrossWeight('');
        setCartonNetWeight('');
        setMediaType('image');
    };
    return (
        <>
            <div className="min-h-screen text-apple-textMain dark:text-white font-sans selection:bg-apple-blue/30 overflow-x-hidden relative animate-fade-in notranslate" translate="no">
                <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 flex flex-col min-h-screen">

                {/* HEADER */}
                <header className="flex justify-between items-center mb-6 apple-glass px-6 py-4 rounded-3xl shadow-xl sticky top-4 z-50 border border-black/5 dark:border-white/10 gap-4 flex-wrap md:flex-nowrap">
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-apple-textMain dark:text-white flex items-center gap-2">
                            <Settings className="text-apple-blue animate-spin-slow shrink-0" size={20} />
                            <span>PRODUCTION WORKSPACE</span>
                        </h2>
                        {selectedMachine && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-apple-green font-mono text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-apple-green animate-pulse"></div>
                                    Standard Mode
                                </span>
                                <span className="text-apple-textMuted text-xs">| {currentMachineName}</span>
                            </div>
                        )}
                    </div>

                    {/* CONTROL MODE TOGGLE FOR ADMINS/MANAGERS */}
                    {user && user.role !== 'Operator' && selectedMachine && (
                        <button
                            onClick={() => {
                                if (!isControlMode) {
                                    initiateTakeover(selectedMachine);
                                } else {
                                    setIsControlMode(false);
                                }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 shrink-0 ${
                                isControlMode
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-lg shadow-rose-500/5'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${isControlMode ? 'bg-rose-400 animate-pulse' : 'bg-blue-400'}`}></div>
                            {isControlMode ? 'Takeover Mode Active' : 'Monitor Mode Active'}
                        </button>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                        {clockInTime && (
                            <button
                                onClick={handleManualClockOut}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg border border-red-400/50 flex items-center gap-2 text-xs shrink-0"
                            >
                                <LogOut size={14} /> CLOCK OUT
                            </button>
                        )}

                    </div>
                </header>

                {/* MACHINE TABS SWITCHER */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4">
                    {filteredMachines.map(m => {
                        const isSelected = selectedMachine === m.machine_id;
                        return (
                            <button
                                key={m.machine_id}
                                onClick={() => handleMachineTabClick(m.machine_id)}
                                className={`px-2.5 py-2 rounded-xl text-[11px] sm:px-4 sm:py-2.5 sm:text-xs font-bold uppercase tracking-wider transition-all border text-center sm:shrink-0 ${
                                    isSelected
                                        ? 'bg-apple-blue text-white border-apple-blue shadow-lg shadow-apple-blue/20'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {formatMachineName(m.name)}
                            </button>
                        );
                    })}
                </div>

                {!selectedMachine ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-3xl min-h-[40vh] text-center backdrop-blur-md gap-4">
                        {isScanningMachine ? (
                            <div className="w-full max-w-[320px] flex flex-col gap-4 animate-fade-in-up">
                                <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Scan Machine QR Code</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsScanningMachine(false)}
                                        className="p-1 rounded-full bg-white/10 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="w-full aspect-square overflow-hidden rounded-2xl border-2 border-[#E97132] shadow-lg shadow-[#E97132]/10 relative">
                                    <Scanner
                                        onResult={(text) => {
                                            if (text) {
                                                const cleanText = text.trim();
                                                const found = machines.find(m => m.machine_id === cleanText || m.name === cleanText);
                                                if (found) {
                                                    handleMachineTabClick(found.machine_id);
                                                    setIsScanningMachine(false);
                                                } else {
                                                    alert(`⚠️ Unknown machine QR: ${cleanText}`);
                                                }
                                            }
                                        }}
                                        onError={(err) => {
                                            console.error("QR Scan Error:", err);
                                            alert("⚠️ Failed to access camera for QR scanning.");
                                            setIsScanningMachine(false);
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-3xl shadow-inner">🏭</div>
                                <div>
                                    <h2 className="text-xl font-black text-white">Select a Machine</h2>
                                    <p className="text-xs text-gray-500 max-w-sm mt-1">Please select a machine from the tabs above, or scan the machine QR code to bind.</p>
                                </div>
                                
                                <button
                                    type="button"
                                    onClick={() => setIsScanningMachine(true)}
                                    className="px-6 py-3 bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg shadow-[#E97132]/10 active:scale-95 transition-all mt-2 cursor-pointer border border-[#E97132]/20"
                                >
                                    <Camera size={14} />
                                    Scan QR Code to Bind / 扫码绑定机台
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* LEFT COLUMN: COCKPIT LANES & MANAGER SCHEDULES (8 cols) */}
                        <div className="lg:col-span-8 flex flex-col gap-6">

                            {/* OPERATOR STATUS BANNER */}
                            {machineOperator ? (
                                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                                            <UserIcon size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-green-400 text-xs font-bold uppercase tracking-wider">Active Operator On duty</p>
                                            <p className="text-white font-bold text-base leading-none truncate">
                                                {machineOperator.name} (Employee ID: {machineOperator.employeeId})
                                                {operatorEmployeeId === machineOperator.employeeId && " — You"}
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1 truncate">
                                                Clock In Time: {new Date(machineOperator.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {operatorEmployeeId === machineOperator.employeeId && ` | Duration: ${durationText}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => initiateTakeover(selectedMachine!)}
                                        className="px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-green-500/20 active:scale-95 shrink-0 cursor-pointer"
                                    >
                                        🔄 切换人
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">No Operator Duty</p>
                                            <p className="text-white font-bold text-sm leading-none truncate">No active operator is currently bound to this machine.</p>
                                            <p className="text-[10px] text-gray-500 mt-1 truncate">Please bind an operator to select and start production.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => initiateTakeover(selectedMachine!)}
                                        className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-amber-500/20 active:scale-95 shrink-0 cursor-pointer"
                                    >
                                        🔑 绑定操作员
                                    </button>
                                </div>
                            )}

                            {/* MANAGER ASSIGNED TASKS BANNER */}
                            {scheduleTasks.length > 0 && (
                                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/20 border border-blue-500/30 rounded-2xl overflow-hidden">
                                    <div className="px-4 py-2.5 border-b border-blue-500/20 flex items-center justify-between bg-blue-500/10">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} className="text-blue-400" />
                                            <span className="text-xs font-black text-blue-300 uppercase tracking-widest">Manager Schedule Queue</span>
                                            <span className="bg-blue-500/30 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">{scheduleTasks.length} tasks</span>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-blue-500/10">
                                        {scheduleTasks.map(task => {
                                            const isCurrentActive = presetSku === task.sku && task.status === 'In-Progress';
                                            return (
                                                <div key={task.id} className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                    isCurrentActive ? 'bg-green-500/5 border-l-2 border-green-500' : ''
                                                }`}>
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                            task.status === 'In-Progress' ? 'bg-blue-500/20' : 'bg-yellow-500/20'
                                                        }`}>
                                                            <Package size={16} className={task.status === 'In-Progress' ? 'text-blue-400' : 'text-yellow-400'} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-sm font-mono text-cyan-300 truncate">{task.sku}</div>
                                                            {task.notes && <div className="text-[10px] text-gray-500 truncate mt-0.5">{task.notes}</div>}
                                                            {task.scheduled_time && (
                                                                <div className="text-[9px] text-blue-400 font-mono mt-0.5">
                                                                    Scheduled: {new Date(task.scheduled_time).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                                                        <div className="text-right">
                                                            <div className="text-xl font-black text-white leading-none">{task.target_qty}</div>
                                                            <div className="text-[8px] text-gray-500 uppercase tracking-widest">target</div>
                                                        </div>
                                                        
                                                        {isControlMode && (
                                                            task.status !== 'In-Progress' ? (
                                                                <button 
                                                                    onClick={() => startScheduleTask(task)}
                                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all active:scale-95"
                                                                >
                                                                    <Play size={12} />
                                                                    <span>Accept</span>
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => completeScheduleTask(task)}
                                                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all active:scale-95"
                                                                >
                                                                    <Check size={12} />
                                                                    <span>Done</span>
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* LANE LAYOUT */}
                            {selectedMachine === 'T1.2-M01' ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-center mb-2">
                                            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-3 py-1 rounded-full">Lane 1</span>
                                        </div>
                                        <ProductionLane
                                            laneId="Lane1"
                                            machineMetadata={machineMetadata}
                                            user={user}
                                            operatorId={operatorId}
                                            activeJob={activeJob}
                                            jobs={jobs}
                                            onProductionComplete={fetchUserLogs}
                                            onBeforeProduce={handleProductionAttempt}
                                            presetSku={presetSku}
                                            isControlMode={isControlMode}
                                            onTakeoverClick={() => initiateTakeover(selectedMachine!)}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-center mb-2">
                                            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest bg-purple-500/10 px-3 py-1 rounded-full">Lane 2</span>
                                        </div>
                                        <ProductionLane
                                            laneId="Lane2"
                                            machineMetadata={machineMetadata}
                                            user={user}
                                            operatorId={operatorId}
                                            activeJob={activeJob}
                                            jobs={jobs}
                                            onProductionComplete={fetchUserLogs}
                                            onBeforeProduce={handleProductionAttempt}
                                            presetSku={presetSku}
                                            isControlMode={isControlMode}
                                            onTakeoverClick={() => initiateTakeover(selectedMachine!)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <ProductionLane
                                    laneId="Single"
                                    machineMetadata={machineMetadata}
                                    user={user}
                                    operatorId={operatorId}
                                    activeJob={activeJob}
                                    jobs={jobs}
                                    onProductionComplete={fetchUserLogs}
                                    onBeforeProduce={handleProductionAttempt}
                                    presetSku={presetSku}
                                    isControlMode={isControlMode}
                                    onTakeoverClick={() => initiateTakeover(selectedMachine!)}
                                />
                            )}
                        </div>

                        {/* RIGHT COLUMN: WORK PHOTO LOGGER, TASKS, ACTIVITY LOGS (4 cols) */}
                        <div className="lg:col-span-4 flex flex-col gap-6">

                            {/* 1. WORK PHOTO LOGGER */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-md">
                                <h3 className="text-xs font-black tracking-widest text-purple-400 uppercase flex items-center gap-1.5 mb-3">
                                    <Camera size={14} /> Work Photo Logger
                                </h3>

                                {!photoPreview ? (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setShowWebcam(true)} 
                                            className="flex-1 py-8 bg-purple-600/10 hover:bg-purple-600/20 border border-dashed border-purple-500/20 hover:border-purple-500/40 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                                        >
                                            <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                                                <Camera size={16} />
                                            </div>
                                            <span className="text-xs font-bold text-purple-300">Live Camera</span>
                                            <span className="text-[8px] text-gray-500">使用系统相机拍照</span>
                                        </button>
                                        
                                        <button 
                                            onClick={triggerFileSelect} 
                                            className="flex-1 py-8 bg-white/[0.02] hover:bg-white/5 border border-dashed border-white/10 hover:border-white/20 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                                        >
                                            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/10">
                                                <ImageIcon size={16} />
                                            </div>
                                            <span className="text-xs font-bold text-gray-300">Upload File</span>
                                            <span className="text-[8px] text-gray-500">从相册选择图片</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="relative aspect-video rounded-xl bg-black overflow-hidden border border-white/10">
                                            {mediaType === 'video' ? (
                                                <video src={photoPreview} controls className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                            )}
                                            {(uploadingPhoto || analyzingPhoto) && (
                                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                                                    <Loader className="animate-spin text-purple-400" size={20} />
                                                    <span className="text-[10px] text-purple-300 font-bold">AI Processing...</span>
                                                </div>
                                            )}
                                        </div>

                                        {aiAnalysis && (
                                            <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                                                <div className="text-[9px] text-purple-400 uppercase font-black tracking-widest flex items-center gap-1">
                                                    <Sparkles size={10} /> AI Scene Analysis:
                                                </div>
                                                <p className="text-xs text-white mt-1 leading-tight font-bold">{aiAnalysis}</p>
                                            </div>
                                        )}

                                        {/* Category selector */}
                                        <div className="grid grid-cols-3 gap-1">
                                            {Object.entries(CATEGORIES).map(([key, cat]) => (
                                                <button 
                                                    key={key} 
                                                    onClick={() => setPhotoCategory(key)} 
                                                    className={`px-2 py-1 border text-[9px] rounded-lg font-bold transition-all truncate ${
                                                        photoCategory === key ? cat.color : 'border-white/5 text-gray-500 hover:text-gray-300'
                                                    }`}
                                                >
                                                    {cat.emoji} {cat.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* DEFECT SPECIFIC INPUTS */}
                                        {photoCategory === 'defect' && (
                                            <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-3">
                                                <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Defect Logging Details</div>
                                                
                                                <div className="space-y-1">
                                                    <label className="text-[9px] text-gray-400 font-bold">Weight (KG)</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. 10.90"
                                                            value={defectWeight}
                                                            onChange={e => setDefectWeight(e.target.value)}
                                                            className="flex-1 bg-white/5 border border-white/10 text-xs px-2.5 py-1.5 rounded-lg focus:border-rose-500 focus:outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={runAIDefectScan}
                                                            disabled={analyzingPhoto || !photoBase64}
                                                            className="px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] rounded-lg border border-rose-500/30 flex items-center gap-1 transition-all"
                                                        >
                                                            {analyzingPhoto ? <Loader className="animate-spin" size={10} /> : <Sparkles size={10} />}
                                                            <span>AI Scan</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[9px] text-gray-400 font-bold">Defect Reason</label>
                                                    <select
                                                        value={defectReason}
                                                        onChange={e => setDefectReason(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 text-xs px-2.5 py-1.5 rounded-lg focus:border-rose-500 focus:outline-none text-white [&>option]:bg-zinc-900"
                                                    >
                                                        <option value="">Select Reason...</option>
                                                        <option value="underweight">Underweight (克重不足)</option>
                                                        <option value="deformation">Deformation (变形)</option>
                                                        <option value="damage">Damage (破损)</option>
                                                        <option value="other">Other</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {/* RECIPE SPECIFIC INPUTS */}
                                        {photoCategory === 'recipe' && (
                                            <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-3">
                                                <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">原料配方详情 / Recipe Details</div>
                                                
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 space-y-1">
                                                            <label className="text-[9px] text-gray-400 font-bold">配方名称 / Recipe Name</label>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Sf(clear)"
                                                                value={recipeName}
                                                                onChange={e => setRecipeName(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/10 text-xs px-2.5 py-1.5 rounded-lg focus:border-amber-500 focus:outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={runAIRecipeScan}
                                                                disabled={analyzingPhoto || !photoBase64}
                                                                className="h-[34px] px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-bold text-[11px] rounded-lg border border-amber-600/30 flex items-center gap-1 transition-all disabled:opacity-50"
                                                            >
                                                                {analyzingPhoto ? <Loader className="animate-spin" size={10} /> : <Sparkles size={10} />} AI 识别
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[9px] text-gray-400 font-bold">投料明细 (JSON 数组) / Ingredients</label>
                                                        <textarea
                                                            placeholder='[{"code": "C1802", "quantity": 10, "unit": "bag"}]'
                                                            value={recipeMaterials.length > 0 ? JSON.stringify(recipeMaterials, null, 2) : ''}
                                                            onChange={e => {
                                                                try {
                                                                    setRecipeMaterials(JSON.parse(e.target.value));
                                                                } catch(err) {}
                                                            }}
                                                            rows={3}
                                                            className="w-full bg-white/5 border border-white/10 text-[10px] font-mono p-2 rounded-lg focus:border-amber-500 focus:outline-none"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[9px] text-gray-400 font-bold">投入总重 (kg) / Total Weight (kg)</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. 376.5"
                                                            value={recipeTotalWeight}
                                                            onChange={e => setRecipeTotalWeight(e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 text-xs px-2.5 py-1.5 rounded-lg focus:border-amber-500 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* CARTON SPECIFIC INPUTS */}
                                        {photoCategory === 'carton' && (
                                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-3">
                                                <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">成品纸箱详情 / Carton Details</div>
                                                
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 space-y-1">
                                                            <label className="text-[9px] text-gray-400 font-bold">规格 SKU / Product SKU</label>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. SF-500-150-18-CLR"
                                                                value={cartonSku}
                                                                onChange={e => setCartonSku(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/10 text-xs px-2.5 py-1.5 rounded-lg focus:border-emerald-500 focus:outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={runAICartonScan}
                                                                disabled={analyzingPhoto || !photoBase64}
                                                                className="h-[34px] px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-[11px] rounded-lg border border-emerald-600/30 flex items-center gap-1 transition-all disabled:opacity-50"
                                                            >
                                                                {analyzingPhoto ? <Loader className="animate-spin" size={10} /> : <Sparkles size={10} />} AI 识别
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] text-gray-400 font-bold">每箱卷数 / Rolls</label>
                                                            <input
                                                                type="text"
                                                                value={cartonRolls}
                                                                onChange={e => setCartonRolls(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/10 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] text-gray-400 font-bold">毛重 (kg) / Gross</label>
                                                            <input
                                                                type="text"
                                                                value={cartonGrossWeight}
                                                                onChange={e => setCartonGrossWeight(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/10 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] text-gray-400 font-bold">净重 (kg) / Net</label>
                                                            <input
                                                                type="text"
                                                                value={cartonNetWeight}
                                                                onChange={e => setCartonNetWeight(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/10 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Manual Note */}
                                        <input 
                                            type="text" 
                                            value={photoNote} 
                                            onChange={e => setPhotoNote(e.target.value)} 
                                            placeholder="Add notes..."
                                            className="w-full bg-white/5 border border-white/10 text-xs p-2.5 rounded-xl focus:border-purple-500 focus:outline-none"
                                        />

                                        <div className="flex gap-2">
                                            <button onClick={cancelPhotoSelect} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs rounded-xl border border-white/5 transition-all">Cancel</button>
                                            <button onClick={submitPhotoLog} disabled={uploadingPhoto || analyzingPhoto} className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 shadow-md shadow-purple-500/20">
                                                <Send size={12} />
                                                <span>Upload</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handlePhotoSelect} />
                            </div>

                            {/* 2. OPERATOR TASKS CHECKLIST */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-md">
                                <h3 className="text-xs font-black tracking-widest text-amber-400 uppercase flex items-center gap-1.5 mb-3">
                                    <Check size={14} /> Assigned Tasks Checklist
                                </h3>

                                {operatorTasks.length === 0 ? (
                                    <p className="text-center py-4 text-xs text-gray-500 font-bold">No pending tasks 👍</p>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {operatorTasks.map(task => (
                                            <div key={task.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center group">
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-xs font-bold text-white truncate">{task.title}</p>
                                                    {task.description && <p className="text-[10px] text-gray-500 truncate mt-0.5">{task.description}</p>}
                                                </div>
                                                <button onClick={() => toggleTaskComplete(task.id)} className="w-5 h-5 rounded-lg border border-amber-500/30 group-hover:border-amber-500 flex items-center justify-center text-transparent hover:text-amber-400 hover:bg-amber-500/10 transition-all shrink-0">
                                                    <Check size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 3. RECENT COMPLETED RUNS */}
                            <div className="apple-card p-0 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10">
                                <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-apple-textMuted uppercase tracking-widest">
                                        Recent Activity
                                    </h4>
                                    <span className="text-[10px] text-apple-blue font-mono">{recentLogs.length} Records</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    {recentLogs.map((log) => (
                                        <div key={log.Log_ID} className="px-4 py-2 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 flex justify-between items-center transition-colors">
                                            <div>
                                                <div className="text-xs font-bold text-apple-textMain dark:text-gray-200">
                                                    {log.Note?.includes('V2 Production:') ? log.Note.replace('V2 Production: ', '') : log.Note}
                                                </div>
                                                <div className="text-[10px] text-apple-textMuted">{new Date(log.Timestamp).toLocaleTimeString()}</div>
                                            </div>
                                            <div className="text-sm font-black text-apple-blue">+{log.Output_Qty}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

            {/* TAKEOVER WARNING MODAL */}
            <div 
                key="takeover-warning-modal-overlay" 
                className={`fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 notranslate transition-all duration-200 ${
                    takeoverWarningRecord ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'
                }`} 
                translate="no"
            >
                {lastTakeoverWarning && (
                    <div className="bg-[#1c1c1f] border border-rose-500/30 p-6 rounded-3xl w-full max-w-sm shadow-2xl relative animate-scale-in">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 mx-auto mb-3 border border-rose-500/20">
                                <AlertTriangle size={24} />
                            </div>
                            <h2 className="text-lg font-black tracking-wider text-white uppercase font-bold">Shift Takeover Warning</h2>
                            <p className="text-[11px] text-rose-300/80 font-bold bg-rose-500/5 py-1 px-3 rounded-lg border border-rose-500/10 mt-2">
                                You forgot to clock out last time!
                            </p>
                        </div>
                        
                        <div className="text-xs text-gray-400 space-y-2.5 mb-6 border-y border-white/5 py-4 font-sans leading-relaxed">
                            <p>
                                Our records show that on <strong className="text-white">{lastTakeoverWarning.date}</strong>, you left your shift open on Machine <strong className="text-cyan-400 font-mono">{lastTakeoverWarning.machine_id}</strong>.
                            </p>
                            <p>
                                The shift started at <strong className="text-white">{new Date(lastTakeoverWarning.clock_in).toLocaleTimeString()}</strong> and was automatically ended because another operator logged in to take over the machine.
                            </p>
                            <p className="text-[10px] text-gray-500 italic">
                                Please confirm that you are aware of this to unlock the workspace console.
                            </p>
                        </div>

                        <button 
                            onClick={confirmTakeoverWarning}
                            className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 shadow-lg shadow-rose-600/20"
                        >
                            <Check size={14} />
                            <span>Confirm & Acknowledge</span>
                        </button>
                    </div>
                )}
            </div>

            {/* PIN CONFIRMATION MODAL FOR MACHINE SWITCHING */}
            <div 
                key="pin-confirmation-modal-overlay" 
                className={`fixed inset-0 z-[400] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 notranslate transition-all duration-200 ${
                    isPinModalOpen ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'
                }`} 
                translate="no"
            >
                <div className="bg-[#1c1c1f] border border-apple-blue/30 p-6 rounded-3xl w-full max-w-sm shadow-2xl relative animate-scale-in">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 rounded-full bg-apple-blue/10 flex items-center justify-center text-apple-blue mx-auto mb-3 border border-apple-blue/20">
                            <Clock size={24} />
                        </div>
                        <h2 className="text-lg font-black tracking-wider text-white uppercase font-bold">Confirm Selection</h2>
                        <p className="text-[11px] text-gray-400 mt-1">
                            Enter your 4-digit PIN to switch or log into machine <strong className="text-cyan-400 font-mono">{pendingMachine}</strong>.
                        </p>
                        {pinError && (
                            <p className="text-[11px] text-rose-400 font-bold bg-rose-500/10 py-1 px-3 rounded-lg border border-rose-500/20 mt-2 animate-pulse">
                                {pinError}
                            </p>
                        )}
                    </div>

                    {/* DOTS VISUALIZER */}
                    <div className="flex justify-center gap-4 mb-6">
                        {[0, 1, 2, 3].map((idx) => (
                            <div
                                key={idx}
                                className={`w-3.5 h-3.5 rounded-full border border-white/20 transition-all duration-200 ${
                                    enteredPin.length > idx ? 'bg-apple-blue border-apple-blue scale-110 shadow-lg shadow-apple-blue/30' : 'bg-white/5'
                                }`}
                            ></div>
                        ))}
                    </div>

                    {/* KEYPAD */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                onClick={() => handlePinInput(num)}
                                className="h-14 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                setIsPinModalOpen(false);
                                setPendingMachine(null);
                                setEnteredPin('');
                                setPinError(null);
                            }}
                            className="h-14 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-xs text-gray-400 transition-all flex items-center justify-center font-bold"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={() => handlePinInput(0)}
                            className="h-14 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center"
                        >
                            0
                        </button>
                        <button
                            onClick={() => {
                                setEnteredPin('');
                                setPinError(null);
                            }}
                            className="h-14 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-xs text-rose-400 transition-all flex items-center justify-center font-bold"
                        >
                            CLEAR
                        </button>
                    </div>
                </div>
            </div>

            {/* OPERATOR SELECTION MODAL */}
            <div 
                key="operator-selection-modal-overlay" 
                className={`fixed inset-0 z-[400] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 notranslate transition-all duration-200 ${
                    isOperatorModalOpen ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'
                }`} 
                translate="no"
            >
                <div className="bg-[#1c1c1f] border border-white/10 p-6 rounded-3xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[85vh] animate-scale-in">
                    <div className="text-center mb-4 shrink-0">
                        <h2 className="text-lg font-black tracking-wider text-white uppercase font-bold flex items-center justify-center gap-2">
                            <UserIcon size={20} className="text-apple-blue" />
                            <span>选择操作员 / Select Operator</span>
                        </h2>
                        <p className="text-[11px] text-apple-textMuted mt-1">
                            请选择负责机台 <strong className="text-cyan-400 font-mono">{pendingMachine || selectedMachine}</strong> 的人员以进行绑定。
                        </p>
                    </div>

                    {/* SEARCH INPUT */}
                    <div className="mb-4 shrink-0">
                        <input
                            type="text"
                            value={operatorSearchQuery}
                            onChange={(e) => setOperatorSearchQuery(e.target.value)}
                            placeholder="输入名字或工号搜索 / Search name or ID..."
                            className="w-full bg-white/5 border border-white/10 text-xs p-3 rounded-xl focus:border-apple-blue focus:outline-none text-white font-bold"
                        />
                    </div>

                    {/* OPERATORS GRID */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-[200px]">
                        {loadingOperators ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500 animate-pulse">
                                <Loader className="animate-spin text-apple-blue" size={24} />
                                <span className="text-xs font-bold">正在加载人员列表...</span>
                            </div>
                        ) : (
                            (() => {
                                const filtered = operators.filter(op => 
                                    op.name?.toLowerCase().includes(operatorSearchQuery.toLowerCase()) ||
                                    op.employee_id?.toLowerCase().includes(operatorSearchQuery.toLowerCase())
                                );
                                if (filtered.length === 0) {
                                    return (
                                        <div className="text-center py-12 text-xs text-gray-500 font-bold">
                                            未找到匹配的人员 🔍
                                        </div>
                                    );
                                }
                                return (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {filtered.map(op => {
                                            const initials = op.name ? op.name.charAt(0).toUpperCase() : '?';
                                            const isCurrent = operatorEmployeeId === op.employee_id;
                                            return (
                                                <button
                                                    key={op.auth_user_id}
                                                    onClick={() => handleSelectOperator(op)}
                                                    className={`p-3 rounded-2xl border transition-all active:scale-95 flex flex-col items-center justify-center text-center gap-2 cursor-pointer group hover:bg-white/5 ${
                                                        isCurrent 
                                                            ? 'bg-apple-blue/20 border-apple-blue shadow-lg shadow-apple-blue/10' 
                                                            : 'bg-white/[0.02] border-white/5'
                                                    }`}
                                                >
                                                    {op.photo_url ? (
                                                        <img 
                                                            src={op.photo_url} 
                                                            alt={op.name} 
                                                            className="w-12 h-12 rounded-full object-cover border border-white/10 group-hover:scale-105 transition-transform" 
                                                        />
                                                    ) : (
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg border group-hover:scale-105 transition-transform ${
                                                            op.role === 'Operator' ? 'bg-purple-600/30 border-purple-500/40 text-purple-300' : 'bg-blue-600/30 border-blue-500/40 text-blue-300'
                                                        }`}>
                                                            {initials}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 w-full">
                                                        <p className="text-xs font-bold text-white truncate">{op.name}</p>
                                                        <p className="text-[9px] text-gray-500 font-mono mt-0.5">工号: {op.employee_id}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()
                        )}
                    </div>

                    <div className="pt-4 border-t border-white/5 mt-4 shrink-0 flex gap-2">
                        <button
                            onClick={() => setIsOperatorModalOpen(false)}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs rounded-xl border border-white/5 transition-all active:scale-95"
                        >
                            取消 / CANCEL
                        </button>
                    </div>
                </div>
            </div>

            {/* WEBCAM CAPTURE MODAL */}
            <div 
                key="webcam-capture-modal-overlay" 
                className={`fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center p-4 overflow-y-auto notranslate transition-all duration-200 ${
                    showWebcam ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'
                }`} 
                translate="no"
            >
                <div className="bg-[#1c1c1f] border border-purple-500/30 p-6 rounded-3xl w-full max-w-md shadow-2xl flex flex-col gap-4">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <h3 className="text-sm font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                            <Camera size={16} /> 实时相机拍照/录像
                        </h3>
                        <button 
                            onClick={handleCloseWebcam}
                            className="text-gray-400 hover:text-white text-xs font-bold px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                        >
                            关闭
                        </button>
                    </div>

                    {isRecording && (
                        <div key="recording-banner-pc" className="flex items-center justify-between bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-red-400 text-xs font-bold animate-pulse">
                            <span className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                正在录制视频中...
                            </span>
                            <span className="font-mono">{Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                        </div>
                    )}

                    {!window.isSecureContext ? (
                        <div key="insecure-context-pc" className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-2 text-amber-400">
                            <p className="text-xs font-bold leading-relaxed flex items-center gap-1.5">
                                <span>⚠️ 摄像头未启用 (浏览器安全限制)</span>
                            </p>
                            <p className="text-[11px] text-gray-400 leading-normal">
                                您的浏览器限制在非安全连接 (HTTP) 下访问摄像头。请通过以下方式之一解决：
                                <br />
                                1. 使用 <span className="text-white font-mono font-bold">localhost</span> 在本地打开；
                                <br />
                                2. 在服务器上配置并使用 <span className="text-white font-mono font-bold">HTTPS</span> 安全连接；
                                <br />
                                3. 使用本地隧道工具映射为公网 HTTPS 链接测试。
                            </p>
                        </div>
                    ) : webcamError ? (
                        <div key="webcam-error-pc" className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-2 text-red-400">
                            <p className="text-xs font-bold leading-relaxed">
                                ⚠️ 摄像头启动失败
                            </p>
                            <p className="text-[11px] text-gray-400 leading-normal">
                                无法访问摄像头设备，请检查是否已授予权限，或该摄像头是否已被其他应用占用。
                            </p>
                            <button
                                onClick={() => setWebcamError(null)}
                                className="mt-1 self-start px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[10px] font-bold transition-all"
                            >
                                重试
                            </button>
                        </div>
                    ) : (
                        <div key="webcam-active-pc" className="relative aspect-video rounded-2xl bg-black overflow-hidden border border-white/10 flex items-center justify-center">
                            {showWebcam && (
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{
                                        facingMode: "environment"
                                    }}
                                    onUserMediaError={(err) => setWebcamError(err)}
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                    )}

                    <div className="flex gap-3">
                        {!isRecording ? (
                            <>
                                <button
                                    onClick={handleWebcamCapture}
                                    disabled={!window.isSecureContext || !!webcamError}
                                    className={`flex-1 py-3 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md ${
                                        !window.isSecureContext || !!webcamError
                                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                                            : 'bg-purple-600 hover:bg-purple-500 active:scale-95 text-white shadow-purple-600/20'
                                    }`}
                                >
                                    <Camera size={14} />
                                    <span>拍照截图</span>
                                </button>
                                <button
                                    onClick={handleStartRecording}
                                    disabled={!window.isSecureContext || !!webcamError}
                                    className={`flex-1 py-3 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md ${
                                        !window.isSecureContext || !!webcamError
                                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                                            : 'bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-red-600/20'
                                    }`}
                                >
                                    <Video size={14} />
                                    <span>录制视频</span>
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleStopRecording}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/30"
                            >
                                <Square size={14} />
                                <span>停止录像并保存</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
                @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-spin-slow { animation: spin 12s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .scrollbar-none::-webkit-scrollbar { display: none; }
                .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </>
    );
};

export default ProductionControl;
