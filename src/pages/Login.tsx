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
    const hasScannedRef = React.useRef(false);

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

            // 1. Resolve Employee ID to Email (support 2 to 4 digits with auto padding)
            if (!loginEmail.includes('@')) {
                const empId = loginEmail.replace(/\D/g, '');
                if (empId.length < 2 || empId.length > 4) {
                    throw new Error('Employee ID must be 2 to 4 digits.');
                }
                let resolvedEmail: string | null = null;

                const resolveByField = async (idVal: string) => {
                    const { data: v2 } = await supabase
                        .from('sys_users_v2')
                        .select('email')
                        .eq('employee_id', idVal)
                        .maybeSingle();
                    if (v2?.email) return v2.email;

                    const { data: pub } = await supabase
                        .from('users_public')
                        .select('email')
                        .eq('employee_id', idVal)
                        .maybeSingle();
                    return pub?.email ?? null;
                };

                resolvedEmail = await resolveByField(empId);

                // If not found and entered ID is shorter than 4 digits, try padding with leading zeros
                if (!resolvedEmail && empId.length < 4) {
                    const padded3 = empId.padStart(3, '0');
                    const padded4 = empId.padStart(4, '0');

                    resolvedEmail = await resolveByField(padded3);
                    if (!resolvedEmail) {
                        resolvedEmail = await resolveByField(padded4);
                    }
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
        <div className="h-screen w-screen overflow-hidden flex flex-col items-center justify-center relative bg-[#050505] font-sans p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-[#E97132]/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#FE4B13]/10 rounded-full blur-[90px] animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-sm relative z-10 animate-fade-in-up transition-all duration-300">

                {/* HEADER */}
                <div className="text-center mb-4">
                    {!isForgotPassword && (
                        <>
                            <div className="flex justify-center mb-3">
                                <img src="/packsecure-logo.png" alt="PackSecure" className="h-24 sm:h-32 max-w-full object-contain filter drop-shadow-[0_8px_20px_rgba(233,113,50,0.3)]" />
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight mb-0.5">
                                STAFF PORTAL
                            </h1>
                            <p className="text-slate-400 text-xs">
                                Enter Credentials
                            </p>
                        </>
                    )}
                    {isForgotPassword && (
                        <>
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg bg-gradient-to-tr from-orange-500 to-red-600 shadow-orange-500/20">
                                <Lock size={28} className="text-white" />
                            </div>
                            <h1 className="text-xl font-black text-white tracking-tight mb-1">RESET PASSWORD</h1>
                            <p className="text-slate-400 text-xs">Enter your email to receive reset link</p>
                        </>
                    )}
                </div>

                {/* FORGOT PASSWORD VIEW */}
                {isForgotPassword ? (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    placeholder="name@packsecure.com"
                                />
                            </div>
                        </div>

                        {resetStatus === 'success' && (
                            <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 text-xs text-center font-bold">
                                ✅ Reset link sent! Check your inbox.
                            </div>
                        )}
                        {resetStatus === 'error' && (
                            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-xs text-center">
                                ❌ {error || 'Failed to send link'}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || resetStatus === 'success'}
                            className="w-full bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#E97132]/20 transition-all transform hover:-translate-y-0.5 active:scale-95 text-xs tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Sending...' : 'SEND RESET LINK'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setIsForgotPassword(false); setResetStatus('idle'); setError(''); }}
                            className="w-full text-slate-500 hover:text-[#E97132] text-xs font-bold py-1 mt-1 uppercase tracking-widest"
                        >
                            Cancel & Return
                        </button>
                    </form>
                ) : (
                    /* MAIN STAFF LOGIN VIEW */
                    <div className="space-y-4">
                        <form onSubmit={handleStaffLogin} className="space-y-4">
                            {/* Email / ID Input */}
                            <div className="group">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Email or Employee ID</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132]/60 focus:ring-1 focus:ring-[#E97132]/60 transition-all font-mono text-sm"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email or ID (e.g., 001)"
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="group">
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                                    <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-[#E97132] hover:text-[#FE4B13] font-bold hover:underline">Forgot Password?</button>
                                </div>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="password"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132]/60 focus:ring-1 focus:ring-[#E97132]/60 transition-all text-sm"
                                        value={staffPassword}
                                        onChange={(e) => setStaffPassword(e.target.value)}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="text-red-400 text-xs text-center bg-red-500/10 py-2.5 rounded-xl border border-red-500/20 animate-shake font-bold">
                                    ⚠️ {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#E97132]/20 transition-all transform hover:-translate-y-0.5 active:scale-95 text-xs uppercase tracking-wider"
                            >
                                {isLoading ? 'Verifying...' : 'LOGIN TO DASHBOARD'}
                            </button>

                            <div className="text-center pt-1">
                                <button
                                    type="button"
                                    onClick={() => onNavigate('register')}
                                    className="text-xs text-[#E97132] hover:text-[#FE4B13] font-bold uppercase tracking-widest transition-colors"
                                >
                                    Don't have an account? Register
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            <div className="absolute bottom-4 text-center w-full z-10 text-slate-700 text-[10px] tracking-widest uppercase">
                System v6.7 • Data Center Active
            </div>
        </div>
    );
};

export default Login;
