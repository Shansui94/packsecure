import React, { useState, useEffect } from 'react';
import {
    PackagingColor,
    ProductSize,
    ProductLayer,
    ProductMaterial
} from '../types';
import {
    PACKAGING_COLORS,
    PRODUCT_SIZES,
} from '../data/constants';
import { getRecommendedPackaging } from '../utils/packagingRules';
import { getBubbleWrapSku } from '../utils/skuMapper';
import { RotateCcw, Box, Settings, Clock, Layers, LogOut, Columns } from 'lucide-react';


import { JobOrder, ProductionLog, User } from '../types';
import { supabase } from '../services/supabase';
import { getMachineByCode, getMachineById } from '../services/productionService';
import { Machine } from '../types';

// --- PRODUCTION LANE COMPONENT ---
interface ProductionLaneProps {
    laneId: 'Left' | 'Right' | 'Single';
    machineMetadata: Machine | null;
    user: User | null;
    operatorId: string | null; // NEW PROP
    activeJob: JobOrder | null;
    onProductionComplete: () => void;
    onBeforeProduce?: () => boolean; // New Prop
    className?: string;
}

const ProductionLane: React.FC<ProductionLaneProps> = ({ laneId, machineMetadata, user, operatorId, activeJob, onProductionComplete, onBeforeProduce, className }) => {

    // Local State for this Lane
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedLayer, setSelectedLayer] = useState<ProductLayer>('Single');
    const [selectedMaterial, setSelectedMaterial] = useState<ProductMaterial>('Clear');
    const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
    const [derivedPackaging, setDerivedPackaging] = useState<PackagingColor | null>(null);
    const [productionNote, setProductionNote] = useState<string>('');
    const [isEditingColor, setIsEditingColor] = useState(false);

    // Cooldown State
    const [lastProducedTime, setLastProducedTime] = useState<number>(0);

    const [cooldownActive, setCooldownActive] = useState<boolean>(false);

    // Live Run State
    const [isLiveRun, setIsLiveRun] = useState(false);
    const [liveCount, setLiveCount] = useState(0);

    // STEP 1 HANDLER
    const handleTypeSelect = (layer: ProductLayer, material: ProductMaterial) => {
        setSelectedLayer(layer);
        setSelectedMaterial(material);
        setStep(2);
    };

    // STEP 2 HANDLER
    const handleSizeSelect = (size: ProductSize) => {
        setSelectedSize(size);
        const pack = getRecommendedPackaging(selectedLayer, selectedMaterial, size);
        setDerivedPackaging(pack);
        setStep(3);
        // Reset Live State on new selection
        setIsLiveRun(false);
        setLiveCount(0);
    };

    // STEP 3 HANDLER: TOGGLE RUN
    const toggleProductionRun = async () => {
        if (isLiveRun) {
            // STOP
            setIsLiveRun(false);
            // Optionally clear active product in DB or keep it?
            // User likely just wants to stop matching counts to this specific run session locally.
            // Backend keeps "last set" product until changed.
        } else {
            // START
            // PRE-CHECK: Operator Login
            if (onBeforeProduce && !onBeforeProduce()) return;

            if (!derivedPackaging || !selectedSize) {
                alert("Error: Packaging or Size not selected.");
                return;
            }

            const v3Sku = getBubbleWrapSku(selectedLayer, selectedMaterial, selectedSize);

            try {
                // 1. Tell Backend we are now producing this SKU
                // Send to Backend (Serverless or Local)
                try {
                    // Use relative path so it works on Vercel and Local (via Vite Proxy)
                    await fetch('/api/set-product', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            machine_id: 'T1.2-M01', // Hardcoded for single machine setup
                            product_sku: v3Sku
                        })
                    });
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (e) {
                    console.error("Failed to update active product", e);
                }

                // 2. Set Local State
                setIsLiveRun(true);
                setLiveCount(0); // Reset session count

            } catch (error: any) {
                console.error("Failed to start run:", error);
                alert("Failed to start run: " + error.message);
            }
        }
    };

    // LIVE COUNT SUBSCRIPTION
    useEffect(() => {
        const start = Date.now();
        console.log(`[Lane: ${laneId}] [${start}] Effect Triggered. isLiveRun: ${isLiveRun}`);

        if (!isLiveRun) return;

        // DIAGNOSTIC: Check if we can actually READ the table
        supabase.from('production_logs').select('id, machine_id').limit(1)
            .then(({ data, error }) => {
                console.log(`[Lane: ${laneId}] RLS Check:`, error ? 'FAIL' : 'PASS', error || data);
            });

        const channelName = `prod-ctrl-${laneId}`; // Simple static name
        console.log(`[Lane: ${laneId}] Subscribing to: ${channelName}`);

        const channel = supabase.channel(channelName)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'production_logs' },
                (payload) => {
                    console.log(`[Lane: ${laneId}] [${Date.now()}] ⚡ SIGNAL RECEIVED:`, payload.new);
                    const newLog = payload.new;
                    setLiveCount(prev => prev + (newLog.alarm_count || 1));
                    onProductionComplete();
                }
            )
            .subscribe((status, err) => {
                console.log(`[Lane: ${laneId}] [${Date.now()}] Subscription Status: ${status}`, err);
            });

        return () => {
            const end = Date.now();
            console.log(`[Lane: ${laneId}] [${end}] Cleaning up channel. Duration: ${(end - start)}ms`);
            supabase.removeChannel(channel);
        };
    }, [isLiveRun]); // Removed machineMetadata dependency

    // --- RENDER LANE ---
    return (
        <div className={`flex-1 bg-black/20 backdrop-blur-md border border-white/5 rounded-3xl p-1 relative overflow-hidden flex flex-col min-h-[500px] ${className}`}>
            {/* Lane Badge */}
            {laneId !== 'Single' && (
                <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold uppercase rounded-bl-xl border-l border-b border-white/10 z-20 ${laneId === 'Left' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                    {laneId === 'Left' ? 'Left Lane' : 'Right Lane'}
                </div>
            )}

            {/* PROGRESS BAR */}
            <div className="flex border-b border-white/5 bg-black/20">
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
                                ${isActive ? (laneId === 'Left' || laneId === 'Single' ? 'text-cyan-400 bg-cyan-500/5' : 'text-purple-400 bg-purple-500/5') : ''}
                                ${isPast ? 'text-blue-500' : 'text-gray-600'}
                            `}
                        >
                            <Icon size={16} className={isActive ? 'animate-bounce' : ''} />
                            <span className={`hidden md:inline text-xs font-bold tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>{s.label}</span>
                            {isActive && (
                                <div className={`absolute bottom-0 left-0 w-full h-0.5 shadow-[0_0_10px_rgba(6,182,212,0.8)] ${laneId === 'Left' || laneId === 'Single' ? 'bg-cyan-500' : 'bg-purple-500'
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
                    <div className="grid grid-cols-2 gap-3 h-full animate-slide-up">
                        {[
                            { layer: 'Single', mat: 'Clear', label: '1L Clear', img: '/assets/product-types/single-clear.png', border: 'border-cyan-500/30' },
                            { layer: 'Single', mat: 'Black', label: '1L Black', img: '/assets/product-types/double-black.png', border: 'border-gray-600' },
                            { layer: 'Double', mat: 'Clear', label: '2L Clear', img: '/assets/product-types/double-clear.png', border: 'border-blue-400', glow: true },
                            { layer: 'Double', mat: 'Black', label: '2L Black', img: '/assets/product-types/single-black.png', border: 'border-slate-500' },
                        ].map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleTypeSelect(item.layer as any, item.mat as any)}
                                className={`
                                    relative group rounded-3xl border-2 ${item.border} bg-gray-900/50 overflow-hidden
                                    hover:scale-[1.02] active:scale-95 transition-all duration-300 flex flex-col justify-between
                                    hover:shadow-xl hover:border-white/80 min-h-[140px]
                                    ${item.glow ? 'shadow-[0_0_20px_rgba(59,130,246,0.2)]' : ''}
                                `}
                            >
                                <div className="h-2/3 w-full relative bg-black/20 p-2">
                                    <img src={item.img} alt={item.label} className="w-full h-full object-contain drop-shadow-xl" />
                                </div>
                                <div className="h-1/3 w-full flex items-center justify-center bg-white/5 border-t border-white/5">
                                    <span className="text-xs md:text-sm font-black text-white uppercase">{item.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <div className="flex flex-col h-full animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-gray-400 text-xs font-mono uppercase">Select Size</span>
                            <button onClick={() => setStep(1)} className="text-xs font-bold text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-white/10">BACK</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {PRODUCT_SIZES.map(size => (
                                <button
                                    key={size.value}
                                    onClick={() => handleSizeSelect(size.value as ProductSize)}
                                    className="relative group bg-gray-800/60 hover:bg-cyan-900/40 border-2 border-white/10 hover:border-cyan-400 rounded-2xl py-6 flex flex-col items-center gap-1 active:scale-95 transition-all"
                                >
                                    <span className="text-3xl font-black text-white">{size.label.replace(/[^0-9]/g, '')}</span>
                                    <span className="text-xs text-gray-400">{size.rolls} Rolls</span>
                                </button>
                            ))}
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
                                className={`p-4 rounded-2xl border-2 bg-black/40 relative overflow-hidden flex items-center justify-between transition-colors duration-300`}
                                style={{ borderColor: theme.hex }}
                            >
                                <div className="absolute inset-0 opacity-50 transition-colors duration-300" style={{ backgroundColor: theme.hex }}></div>
                                <div className="relative z-10">
                                    <div className="text-[10px] text-white/80 uppercase font-bold tracking-wider">Pack Color</div>
                                    <div
                                        className="text-3xl font-black flex items-center gap-2 drop-shadow-md"
                                        style={{ color: '#FFF', textShadow: `0 0 10px ${theme.hex}` }}
                                    >
                                        {derivedPackaging === 'Pink' ? 'RED' : derivedPackaging.toUpperCase()}
                                        <button
                                            onClick={() => setIsEditingColor(!isEditingColor)}
                                            className="w-8 h-8 rounded-full bg-gradient-to-r from-red-500 via-green-500 to-blue-500 hover:scale-110 transition-transform shadow-lg border-2 border-white/20 flex items-center justify-center group"
                                            title="Change Color"
                                        >
                                            <div className={`w-2 h-2 rounded-full bg-white transition-opacity ${isEditingColor ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100`}></div>
                                        </button>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-white">{selectedLayer}</span>
                                        <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-white">{selectedSize}</span>
                                    </div>
                                </div>
                                <button onClick={() => setStep(2)} className="relative z-10 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white">Change</button>
                            </div>

                            {isEditingColor && (
                                <div className="grid grid-cols-3 gap-4 p-4 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 animate-fade-in-up absolute top-0 left-0 w-full h-full z-50 flex items-center justify-center content-center">
                                    <button
                                        onClick={() => setIsEditingColor(false)}
                                        className="absolute top-2 right-2 text-gray-500 hover:text-white"
                                    >
                                        <div className="bg-white/10 p-1 rounded-full"><span className="text-xs">✕</span></div>
                                    </button>
                                    {PACKAGING_COLORS.map((colorObj: any) => (
                                        <button
                                            key={colorObj.value}
                                            onClick={() => { setDerivedPackaging(colorObj.value as any); setIsEditingColor(false); }}
                                            className={`
                                                relative p-2 rounded-2xl transition-all flex flex-col items-center gap-2
                                                ${derivedPackaging === colorObj.value
                                                    ? 'border-2 border-white bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                                                    : 'border-2 border-transparent hover:bg-white/5'}
                                            `}
                                        >
                                            <div
                                                className={`w-12 h-12 rounded-full shadow-lg border-2 border-white/10`}
                                                style={{ backgroundColor: colorObj.hex }}
                                            ></div>
                                            <span
                                                className="text-[10px] font-black uppercase tracking-widest"
                                                style={{ color: colorObj.value === 'Transparent' ? '#999' : '#DDD' }}
                                            >{colorObj.value === 'Pink' ? 'RED' : colorObj.value}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Note Input */}
                            <input
                                type="text"
                                placeholder="Note (Optional)"
                                value={productionNote}
                                onChange={(e) => setProductionNote(e.target.value)}
                                className="w-full bg-black/30 text-white text-xs px-3 py-2 rounded-xl border border-white/10 focus:border-cyan-500 focus:outline-none"
                            />

                            {/* RUN CONTROLS */}
                            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                                {isLiveRun ? (
                                    <div className="w-full flex flex-col items-center animate-fade-in-up">
                                        <div className="text-center mb-4">
                                            <div className="text-green-400 font-bold text-xs uppercase tracking-[0.2em] mb-1 animate-pulse">Live Production Active</div>
                                            <div className="text-[80px] font-black text-white leading-none tabular-nums drop-shadow-[0_0_30px_rgba(74,222,128,0.5)]">
                                                {liveCount}
                                            </div>
                                            <div className="text-gray-400 text-xs font-mono">Units Produced This Session</div>
                                        </div>

                                        <button
                                            onClick={toggleProductionRun}
                                            className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-black text-white shadow-lg border-2 border-red-400/50 active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
                                        >
                                            <div className="w-3 h-3 bg-white rounded-sm"></div>
                                            STOP RUN
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={toggleProductionRun}
                                        className="w-full h-32 bg-green-600 hover:bg-green-500 rounded-2xl font-black text-white shadow-[0_0_40px_rgba(22,163,74,0.3)] border-b-8 border-green-800 active:border-b-0 active:translate-y-2 transition-all text-2xl flex flex-col items-center justify-center gap-2 group"
                                    >
                                        <div className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1"></div>
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


// --- MAIN CONTROLLER COMPONENT ---

interface ProductionControlProps {
    user: User | null;
    jobs?: JobOrder[];
}

const ProductionControl: React.FC<ProductionControlProps> = ({ user, jobs = [] }) => {
    // Machine Selection State (Persisted in Session & Local)
    const [selectedMachine, setSelectedMachine] = useState<string | null>(
        sessionStorage.getItem('selectedMachine') || localStorage.getItem('device_machine_id')
    );
    const [machineMetadata, setMachineMetadata] = useState<Machine | null>(null);
    const currentMachineName = machineMetadata?.name || selectedMachine || 'Unknown Machine';

    // Active Job State
    const [activeJob, setActiveJob] = useState<JobOrder | null>(null);
    const [recentLogs, setRecentLogs] = useState<ProductionLog[]>([]);

    // Operator ID State
    const [operatorId, setOperatorId] = useState<string | null>(null);
    const [operatorName, setOperatorName] = useState<string | null>(null);
    // PIN Login State
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isLogoutMode, setIsLogoutMode] = useState(false); // New: Track if PIN is for logout
    const [pinCode, setPinCode] = useState("");
    const [loginError, setLoginError] = useState("");

    // PIN Handlers
    const handlePinPress = (num: number) => {
        if (pinCode.length < 4) {
            const newPin = pinCode + num;
            setPinCode(newPin);
            if (newPin.length === 4) {
                verifyPin(newPin);
            }
        }
    };

    const handleClearPin = () => {
        setPinCode("");
        setLoginError("");
    };

    const verifyPin = async (code: string) => {
        setLoginError("");
        try {
            // Check sys_users_v2 for this PIN
            const { data, error } = await supabase
                .from('sys_users_v2')
                .select('id, name')
                .eq('pin_code', code)
                .eq('status', 'Active') // Ensure active
                .eq('status', 'Active') // Ensure active
                .limit(1);

            if (data && data.length > 0) {
                const user = data[0];
                if (isLogoutMode) {
                    // VERIFY LOGOUT
                    if (user.id === operatorId) {
                        setOperatorId(null);
                        setOperatorName(null);
                        setIsLoginModalOpen(false);
                        setIsLogoutMode(false);
                        setPinCode("");
                    } else {
                        setLoginError("Wrong PIN for current user");
                        setTimeout(() => setPinCode(""), 500);
                    }
                } else {
                    // LOGIN
                    setOperatorId(user.id);
                    setOperatorName(user.name);
                    setIsLoginModalOpen(false);
                    setPinCode("");
                }
            } else {
                setLoginError("Invalid PIN");
                setTimeout(() => setPinCode(""), 500); // Auto clear after visual feedback
            }
        } catch (err) {
            setLoginError("System Error");
            console.error(err);
        }
    };

    const initiateClockOut = () => {
        setIsLogoutMode(true);
        setIsLoginModalOpen(true);
    };

    const handleDeviceLogout = async () => {
        if (window.confirm("Disconnect Device from this Machine?")) {
            sessionStorage.removeItem('selectedMachine');
            localStorage.removeItem('device_machine_id');
            // Force reload to trigger App-level logout or re-login flow
            window.location.reload();
        }
    };

    // Effect: Resolve Machine Metadata
    useEffect(() => {
        if (!selectedMachine) return;
        const resolveMachine = async () => {
            let machine = await getMachineByCode(selectedMachine);
            if (!machine && selectedMachine.length > 5) {
                machine = await getMachineById(selectedMachine);
            }
            if (machine) setMachineMetadata(machine);
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

    // Fetch Logs
    const fetchUserLogs = async () => {
        if (!operatorId) return;
        const { data } = await supabase.from('production_logs_v2')
            .select('*')
            .eq('operator_id', operatorId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) {
            const mapped: ProductionLog[] = data.map((log: any) => ({
                Log_ID: log.log_id,
                Timestamp: log.created_at || log.start_time,
                Job_ID: log.job_id,
                Operator_Email: user?.email || 'Unknown',
                Output_Qty: log.output_qty || 0,
                Note: log.note || `V2 Production: ${log.sku}`,
            }));
            setRecentLogs(mapped);
        }
    };

    useEffect(() => {
        if (operatorId) {
            fetchUserLogs();
            const sub = supabase.channel('my-logs-v2-broad')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_logs_v2' },
                    (payload) => { if (payload.new.operator_id === operatorId) fetchUserLogs(); })
                .subscribe();
            return () => { supabase.removeChannel(sub); };
        } else {
            setRecentLogs([]);
        }
    }, [operatorId]);


    // --- DUAL LANE CHECK ---
    const isDualLane = selectedMachine === 'T1.2-M01' || machineMetadata?.id === 'T1.2-M01';

    // TRIGGER FOR PRODUCTION (Pass to Lanes)
    // We need to intercept the lane's attempt to produce and check Operator ID
    const handleProductionAttempt = () => {
        if (!operatorId) {
            setIsLogoutMode(false);
            setIsLoginModalOpen(true);
            return false; // Block production
        }
        return true; // Allow production
    };

    // We need to pass this check down to ProductionLane? 
    // Or ProductionLane calls a callback?
    // Let's modify ProductionLane to accept an `onBeforeProduce` prop.

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-cyan-500/30 overflow-x-hidden relative">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse"></div>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-6 flex flex-col min-h-screen">

                {/* HEADER */}
                <header className="flex justify-between items-center mb-6 bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-xl sticky top-4 z-50">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center gap-2">
                            <Settings className="text-cyan-400" size={24} />
                            PRODUCTION CONTROL <span className="text-xs text-gray-500 ml-2 font-mono">v4.7</span>                        </h2>
                        {selectedMachine && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-green-400 font-mono text-xs uppercase tracking-widest flex items-center gap-1">
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                    {isDualLane ? 'Dual Lane Mode' : 'Standard Mode'}
                                </span>
                                <span className="text-gray-500 text-xs">| {currentMachineName}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* CLOCK IN / OUT BUTTONS - HEADER PLACEMENT */}
                        {!operatorId ? (
                            <button
                                onClick={() => setIsLoginModalOpen(true)}
                                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg border border-green-400/50 flex items-center gap-2 animate-pulse"
                            >
                                <Clock size={16} /> CLOCK IN
                            </button>
                        ) : (
                            <button
                                onClick={initiateClockOut}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg border border-red-400/50 flex items-center gap-2"
                            >
                                <LogOut size={16} /> CLOCK OUT
                            </button>
                        )}

                        {/* DEVICE LOGOUT */}
                        <button onClick={handleDeviceLogout} className="px-3 py-1.5 rounded-lg bg-gray-800 text-red-400 text-xs font-bold border border-red-500/20 hover:bg-red-900/40 flex items-center gap-1 ml-4">
                            EXIT DEVICE
                        </button>
                    </div>
                </header>

                {!selectedMachine ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="text-center p-10 bg-black/40 rounded-3xl border border-white/10">
                            <div className="text-red-400 text-6xl mb-4">⚠️</div>
                            <h2 className="text-2xl font-bold text-white mb-2">Device Not Configured</h2>
                            <p className="text-gray-400 mb-6">No machine selected. Please login as a device.</p>
                            <button onClick={handleDeviceLogout} className="bg-red-600 px-6 py-2 rounded-xl font-bold">Return to Login</button>
                        </div>
                    </div>
                ) : (
                    <main className="flex-1 flex flex-col gap-4">

                        {/* OPERATOR STATUS BANNER */}
                        {operatorId ? (
                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <p className="text-green-400 text-xs font-bold uppercase tracking-wider">Operator On Duty</p>
                                        <p className="text-white font-bold text-lg leading-none">{operatorName}</p>
                                    </div>
                                </div>
                                {/* Clock Out button moved to header */}
                            </div>
                        ) : (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                                        <LogOut size={20} />
                                    </div>
                                    <div>
                                        <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Device Locked</p>
                                        <p className="text-white font-bold text-sm leading-none">Clock In Required to Produce</p>
                                    </div>
                                </div>
                                {/* Clock In button moved to header */}
                            </div>
                        )}

                        {/* DUAL LANE LAYOUT */}
                        {isDualLane ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ProductionLane
                                    laneId="Left"
                                    machineMetadata={machineMetadata}
                                    user={user}
                                    operatorId={operatorId} // Pass ID
                                    activeJob={activeJob}
                                    onProductionComplete={fetchUserLogs}
                                    onBeforeProduce={handleProductionAttempt}
                                />
                                <ProductionLane
                                    laneId="Right"
                                    machineMetadata={machineMetadata}
                                    user={user}
                                    operatorId={operatorId} // Pass ID
                                    activeJob={activeJob}
                                    onProductionComplete={fetchUserLogs}
                                    onBeforeProduce={handleProductionAttempt}
                                />

                            </div>
                        ) : (
                            // STANDARD LAYOUT
                            <ProductionLane
                                laneId="Single"
                                machineMetadata={machineMetadata}
                                user={user}
                                operatorId={operatorId} // Pass ID
                                activeJob={activeJob}
                                onProductionComplete={fetchUserLogs}

                                onBeforeProduce={handleProductionAttempt}
                            />
                        )}

                        {/* LOGS */}
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/5 bg-black/20 flex justify-between items-center">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Recent Activity
                                    {operatorId && <span className="ml-2 text-[9px] text-gray-600 font-mono">({operatorId.slice(0, 4)})</span>}
                                </h4>
                                <span className="text-[10px] text-cyan-500 font-mono">{recentLogs.length} Records</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {recentLogs.map((log) => (
                                    <div key={log.Log_ID} className="px-4 py-2 border-b border-white/5 hover:bg-white/5 flex justify-between items-center">
                                        <div>
                                            <div className="text-xs font-bold text-gray-200">
                                                {log.Note?.includes('V2 Production:') ? log.Note.replace('V2 Production: ', '') : log.Note}
                                            </div>
                                            <div className="text-[10px] text-gray-500">{new Date(log.Timestamp).toLocaleTimeString()}</div>
                                        </div>
                                        <div className="text-sm font-black text-cyan-500">+{log.Output_Qty}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </main>
                )}

                {/* PIN MODAL */}
                {isLoginModalOpen && (
                    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
                        <div className="bg-gray-900 border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative">
                            <button
                                onClick={() => setIsLoginModalOpen(false)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-white"
                            >
                                <div className="bg-white/10 p-2 rounded-full"><span className="text-xl">✕</span></div>
                            </button>

                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black text-white mb-2">{isLogoutMode ? 'CLOCK OUT' : 'OPERATOR LOGIN'}</h2>
                                <p className="text-gray-400 text-sm">Enter your 4-digit PIN code</p>
                            </div>

                            {/* PIN DOTS */}
                            <div className="flex justify-center gap-4 mb-8">
                                {[0, 1, 2, 3].map(i => (
                                    <div
                                        key={i}
                                        className={`w-4 h-4 rounded-full transition-all duration-200 ${
                                            // Show filled valid dots
                                            i < pinCode.length
                                                ? (loginError ? 'bg-red-500' : 'bg-green-400')
                                                : 'bg-gray-700'
                                            }`}
                                    ></div>
                                ))}
                            </div>

                            {loginError && <div className="text-red-400 text-center font-bold mb-4 animate-shake">{loginError}</div>}

                            {/* KEYPAD */}
                            <div className="grid grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => handlePinPress(num)}
                                        className="h-16 rounded-2xl bg-gray-800 text-2xl font-bold text-white hover:bg-gray-700 active:bg-gray-600 transition-colors border border-white/5"
                                    >
                                        {num}
                                    </button>
                                ))}
                                <div className="col-span-1"></div>
                                <button
                                    onClick={() => handlePinPress(0)}
                                    className="h-16 rounded-2xl bg-gray-800 text-2xl font-bold text-white hover:bg-gray-700 active:bg-gray-600 transition-colors border border-white/5"
                                >
                                    0
                                </button>
                                <button
                                    onClick={handleClearPin}
                                    className="h-16 rounded-2xl bg-red-900/40 text-red-400 font-bold hover:bg-red-900/60 active:bg-red-900 transition-colors border border-red-500/20 flex items-center justify-center"
                                >
                                    CLR
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
                @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

export default ProductionControl;
