
import React, { useState } from 'react';
import { Mail, Lock, Camera, QrCode, X, HardHat, Truck } from 'lucide-react';
import { supabase } from '../services/supabase';
import { loginPasswordFromInput } from '../utils/pinAuth';
import { Scanner } from '@yudiel/react-qr-scanner';


interface LoginProps {
    onLogin: (email: string | null, gps: string, role: string) => void;
    onNavigate: (page: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onNavigate }) => {
    const [machines, setMachines] = useState<any[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<string>('');
    const [password, setPassword] = useState<string>(''); // Device 1234
    const [email, setEmail] = useState<string>(''); // Staff Email
    const [staffPassword, setStaffPassword] = useState<string>(''); // Staff Password

    // Mode State: 'device' | 'staff'
    const [loginMode, setLoginMode] = useState<'device' | 'staff'>('staff');
    const [isScanning, setIsScanning] = useState<boolean>(false);

    // Forgot Password State
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Fetch Machines on Mount
    React.useEffect(() => {
        const fetchMachines = async () => {
            const { data } = await supabase.from('sys_machines_v2').select('machine_id, name').order('name');
            if (data) setMachines(data);
        };
        fetchMachines();
    }, []);

    // DEVICE LOGIN HANDLER
    const handleDeviceLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (password !== '1234') {
            setError('Invalid Device Password');
            setPassword('');
            setIsLoading(false);
            return;
        }
        if (!selectedMachine) {
            setError('Please select a machine');
            setIsLoading(false);
            return;
        }

        try {
            sessionStorage.setItem('selectedMachine', selectedMachine);
            localStorage.setItem('device_machine_id', selectedMachine);
            const deviceEmail = `device-${selectedMachine.toLowerCase()}@packsecure.local`;
            onLogin(deviceEmail, "GPS_SKIPPED", 'Device');
        } catch (err: any) {
            console.error("Login Error:", err);
            setError("Login Failed");
            setIsLoading(false);
        }
    };

    // STAFF LOGIN HANDLER
    const handleStaffLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            let loginEmail = email.trim();

            // 1. Resolve Employee ID to Email (4-digit ID — staff + drivers)
            if (!loginEmail.includes('@')) {
                const empId = loginEmail.replace(/\D/g, '');
                if (empId.length !== 4) {
                    throw new Error('Employee ID must be 4 digits.');
                }
                let resolvedEmail: string | null = null;

                const { data: v2User } = await supabase
                    .from('sys_users_v2')
                    .select('email')
                    .eq('employee_id', empId)
                    .maybeSingle();

                if (v2User?.email) {
                    resolvedEmail = v2User.email;
                } else {
                    const { data: pubUser } = await supabase
                        .from('users_public')
                        .select('email')
                        .eq('employee_id', empId)
                        .maybeSingle();
                    resolvedEmail = pubUser?.email ?? null;
                }

                if (!resolvedEmail) {
                    throw new Error('Invalid Employee ID or User not found.');
                }

                console.log(`Resolved ID ${empId} to ${resolvedEmail}`);
                loginEmail = resolvedEmail;
            }

            // 2. Auth: company policy — 4-digit PIN → stored as PIN + "00"
            const finalPassword = loginPasswordFromInput(staffPassword);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: finalPassword,
            });

            if (error) throw error;

            if (data.user) {
                onLogin(data.user.email || null, "GPS_AUTO", 'Staff');
            }
        } catch (err: any) {
            console.error("Staff Login Error:", err);
            setError(err.message || "Authentication Failed");
            setIsLoading(false);
        }
    };

    // FORGOT PASSWORD HANDLER
    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetStatus('idle');
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: window.location.origin + '/reset-password',
            });
            if (error) throw error;
            setResetStatus('success');
        } catch (err: any) {
            console.error("Reset Error:", err);
            setError(err.message);
            setResetStatus('error');
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#050505] font-sans">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#E97132]/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FE4B13]/10 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-md bg-[#121215]/80 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in-up transition-all duration-500">

                {/* HEADER */}
                <div className="text-center mb-8">
                    {!isForgotPassword && (
                        <>
                            <div className="flex justify-center mb-6">
                                <img src="/packsecure-logo.jpg" alt="PackSecure" className="h-32 rounded-xl shadow-lg border border-white/10" />
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                                {loginMode === 'device' ? 'DEVICE ACCESS' : 'STAFF PORTAL'}
                            </h1>
                            <p className="text-slate-400 text-sm">
                                {loginMode === 'device' ? 'Select Production Machine' : 'Enter Credentials'}
                            </p>
                        </>
                    )}
                    {isForgotPassword && (
                        <>
                            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg bg-gradient-to-tr from-orange-500 to-red-600 shadow-orange-500/20">
                                <Lock size={40} className="text-white" />
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight mb-2">RESET PASSWORD</h1>
                            <p className="text-slate-400 text-sm">Enter your email to receive reset link</p>
                        </>
                    )}
                </div>

                {/* FORGOT PASSWORD VIEW */}
                {isForgotPassword ? (
                    <form onSubmit={handleForgotPassword} className="space-y-6">
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    placeholder="name@packsecure.com"
                                />
                            </div>
                        </div>

                        {resetStatus === 'success' && (
                            <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 text-sm text-center font-bold">
                                ✅ Reset link sent! Check your inbox.
                            </div>
                        )}
                        {resetStatus === 'error' && (
                            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">
                                ❌ {error || 'Failed to send link'}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || resetStatus === 'success'}
                            className="w-full bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#E97132]/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Sending...' : 'SEND RESET LINK'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setIsForgotPassword(false); setResetStatus('idle'); setError(''); }}
                            className="w-full text-slate-500 hover:text-[#E97132] text-xs font-bold py-2 mt-2 uppercase tracking-widest"
                        >
                            Cancel & Return
                        </button>
                    </form>
                ) : (
                    /* MAIN LOGIN VIEWS */
                    <>
                        {/* FORM SWITCHER */}
                        {loginMode === 'device' ? (
                            <form onSubmit={handleDeviceLogin} className="space-y-6">

                                {/* LOW: 1. Machine Selection View */}
                                {!selectedMachine ? (
                                    <div className="space-y-4">
                                        {isScanning ? (
                                            <div className="space-y-4 animate-fade-in-up">
                                                <div className="flex justify-between items-center bg-[#E97132]/10 border border-[#E97132]/20 rounded-xl px-4 py-2.5">
                                                    <span className="text-xs font-bold text-[#E97132] uppercase tracking-wider">Scan Machine QR Code</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                             setTimeout(() => {
                                                                 setIsScanning(false);
                                                             }, 100);
                                                         }}
                                                        className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <div className="w-full aspect-square max-w-[280px] mx-auto overflow-hidden rounded-2xl border-2 border-[#E97132] shadow-lg shadow-[#E97132]/10 relative">
                                                    <Scanner
                                                         onScan={(detectedCodes) => {
                                                             if (detectedCodes && detectedCodes.length > 0) {
                                                                 const text = detectedCodes[0].rawValue;
                                                                 if (text) {
                                                                     const cleanText = text.trim();
                                                                     const found = machines.find(m => m.machine_id === cleanText || m.name === cleanText);
                                                                     if (found) {
                                                                         setSelectedMachine(found.machine_id);
                                                                         setTimeout(() => {
                                                                             setIsScanning(false);
                                                                         }, 100);
                                                                     } else {
                                                                         setError(`Unknown machine QR: ${cleanText}`);
                                                                     }
                                                                 }
                                                             }
                                                         }}
                                                         onError={(err) => {
                                                             console.error("QR Scan Error:", err);
                                                             setError("Failed to access camera for QR scanning.");
                                                         }}
                                                     />
                                                </div>
                                                {error && (
                                                    <div className="text-red-400 text-xs text-center font-bold">
                                                        ⚠️ {error}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                                                    Select Your Station
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => { setIsScanning(true); setError(''); }}
                                                    className="w-full py-4 mb-2 bg-[#E97132]/10 hover:bg-[#E97132]/20 border border-[#E97132]/30 rounded-2xl flex items-center justify-center gap-2 text-xs font-black text-[#E97132] transition-all hover:scale-[1.01] active:scale-95 shadow-md uppercase tracking-wider"
                                                >
                                                    <Camera size={14} />
                                                    Scan Machine QR Code / 扫码登录机台
                                                </button>
                                                <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
                                                    {machines.map(m => (
                                                        <button
                                                            key={m.machine_id}
                                                            type="button"
                                                            onClick={() => setSelectedMachine(m.machine_id)}
                                                            className="p-6 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all bg-[#121215]/50 border-slate-800 text-slate-300 hover:bg-[#E97132]/10 hover:border-[#E97132]/50 hover:text-[#E97132] hover:scale-[1.02] active:scale-95 shadow-lg"
                                                        >
                                                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/50 text-white shadow-inner mb-1">
                                                                <span className="text-lg font-bold">{m.machine_id.replace('M', '')}</span>
                                                            </div>
                                                            <span className="text-sm font-black uppercase tracking-wide truncate w-full text-center">{m.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    /* LOW: 2. Password Entry View */
                                    <div className="space-y-4 animate-fade-in-up">
                                        {/* Selected Machine Header */}
                                        <div className="flex items-center justify-between bg-[#E97132]/10 border border-[#E97132]/30 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#E97132] flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                                    {selectedMachine.replace('M', '')}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-[10px] text-[#E97132] font-bold uppercase tracking-wider">Selected Station</div>
                                                    <div className="text-white font-bold">{machines.find(m => m.machine_id === selectedMachine)?.name || selectedMachine}</div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedMachine(''); setPassword(''); }}
                                                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-400 hover:text-white uppercase transition-colors"
                                            >
                                                Change
                                            </button>
                                        </div>

                                        {/* Numeric Keypad Input */}
                                        <div className="relative">
                                            <input
                                                type="password"
                                                readOnly
                                                value={password}
                                                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-4 text-center text-3xl font-mono tracking-[0.5em] text-[#E97132] focus:outline-none focus:border-[#E97132] shadow-inner"
                                                placeholder="••••"
                                            />
                                            {password.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPassword('')}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors"
                                                >
                                                    CLEAR
                                                </button>
                                            )}
                                        </div>

                                        {/* Keypad */}
                                        <div className="grid grid-cols-3 gap-3">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => setPassword(prev => (prev.length < 4 ? prev + num : prev))}
                                                    className="h-16 rounded-xl bg-[#121215] border border-slate-800 text-3xl font-bold text-white hover:bg-slate-800 hover:border-slate-700 active:scale-95 active:bg-[#E97132] transition-all shadow-sm"
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                            <button disabled className="opacity-0 cursor-default"></button>
                                            <button
                                                type="button"
                                                onClick={() => setPassword(prev => (prev.length < 4 ? prev + 0 : prev))}
                                                className="h-16 rounded-xl bg-[#121215] border border-slate-800 text-3xl font-bold text-white hover:bg-slate-800 hover:border-slate-700 active:scale-95 active:bg-[#E97132] transition-all shadow-sm"
                                            >
                                                0
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPassword(prev => prev.slice(0, -1))}
                                                className="h-16 rounded-xl bg-slate-800/50 border border-slate-700 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center font-bold text-lg"
                                            >
                                                DEL
                                            </button>
                                        </div>

                                        {error && (
                                            <div className="text-red-400 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-shake">
                                                {error}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isLoading || password.length !== 4}
                                            className="w-full bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#E97132]/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? 'ACCESSING...' : 'CONFIRM PIN'}
                                        </button>
                                    </div>
                                )}
                            </form>
                        ) : (
                            <div className="space-y-6">
                                <form onSubmit={handleStaffLogin} className="space-y-6">
                                    {/* Email / ID Input */}
                                    <div className="group">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Email or Employee ID</label>
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-slate-955 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132]/50 focus:ring-1 focus:ring-[#E97132]/50 transition-all font-mono"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="Email or ID (e.g. 001)"
                                            />
                                        </div>
                                    </div>

                                    {/* Password Input */}
                                    <div className="group">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                                            <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-[#E97132] hover:text-[#FE4B13] font-bold hover:underline">Forgot Password?</button>
                                        </div>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="password"
                                                required
                                                className="w-full bg-slate-955 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132]/50 focus:ring-1 focus:ring-[#E97132]/50 transition-all"
                                                value={staffPassword}
                                                onChange={(e) => setStaffPassword(e.target.value)}
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="text-red-400 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-shake">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#E97132]/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-4"
                                    >
                                        {isLoading ? 'Verifying...' : 'LOGIN TO DASHBOARD'}
                                    </button>


                                    <div className="text-center pt-2">
                                        <button
                                            type="button"
                                            onClick={() => onNavigate('register')}
                                            className="text-xs text-[#E97132] hover:text-[#FE4B13] font-bold uppercase tracking-widest transition-colors"
                                        >
                                            Don't have an account? Register
                                        </button>
                                    </div>
                                </form>

                                { /* DEMO ACCOUNTS HIDDEN
                                <div className="pt-6 border-t border-white/5">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">— Quick Demo Access —</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['Admin', 'Manager', 'Finance', 'HR', 'Sales', 'Operator', 'Driver'].map(role => (
                                            <button
                                                key={role}
                                                onClick={() => handleDemoLogin(role)}
                                                className={`px-2 py-2 rounded-lg border text-[10px] font-bold uppercase transition-all ${role === 'SuperAdmin' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-500 text-slate-300'}`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                */ }
                            </div>
                        )}

                        {/* TOGGLE LINK */}
                        <div className="mt-8 text-center pt-6 border-t border-white/5">
                            <button
                                onClick={() => {
                                    setLoginMode(loginMode === 'device' ? 'staff' : 'device');
                                    setError('');
                                }}
                                className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-bold flex items-center justify-center gap-2 mx-auto"
                            >
                                {loginMode === 'device' ? (
                                    <>
                                        <HardHat size={14} /> Switch to Staff Login
                                    </>
                                ) : (
                                    <>
                                        <Truck size={14} /> Back to Device Access
                                    </>
                                )}
                            </button>
                        </div>

                    </>
                )}
            </div>

            <div className="absolute bottom-6 text-center w-full z-10 text-slate-700 text-[10px] tracking-widest uppercase">
                System v6.7 • Data Center Active
            </div>
        </div >
    );
};

export default Login;
