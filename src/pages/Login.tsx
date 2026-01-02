
import React, { useState } from 'react';
import { User, HardHat, Truck, ShieldCheck, Mail, Lock } from 'lucide-react'; // Added Mail, Lock
import { supabase } from '../services/supabase';

interface LoginProps {
    onLogin: (email: string | null, gps: string, role: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [machines, setMachines] = useState<any[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<string>('');
    const [password, setPassword] = useState<string>(''); // Device 1234
    const [email, setEmail] = useState<string>(''); // Staff Email
    const [staffPassword, setStaffPassword] = useState<string>(''); // Staff Password

    // Mode State: 'device' | 'staff'
    const [loginMode, setLoginMode] = useState<'device' | 'staff'>('device');
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

            // 1. Resolve Employee ID to Email logic
            // If input does NOT contain '@', assume it is an Employee ID
            if (!loginEmail.includes('@')) {
                const { data, error: fetchError } = await supabase
                    .from('users_public')
                    .select('email')
                    .eq('employee_id', loginEmail)
                    .single();

                if (fetchError || !data || !data.email) {
                    throw new Error("Invalid Employee ID or User not found.");
                }

                console.log(`Resolved ID ${loginEmail} to ${data.email}`);
                loginEmail = data.email;
            }

            // 2. Perform Standard Auth
            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: staffPassword,
            });

            if (error) throw error;

            if (data.user) {
                onLogin(data.user.email, "GPS_AUTO", 'Staff');
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

    // DEMO LOGIN
    const handleDemoLogin = (role: string) => {
        const demoEmail = `demo.${role.toLowerCase()}@packsecure.com`;
        onLogin(demoEmail, "GPS_MOCK", role);
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900 font-sans">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in-up transition-all duration-500">

                {/* HEADER */}
                <div className="text-center mb-8">
                    {!isForgotPassword && (
                        <>
                            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg transition-all duration-500 ${loginMode === 'device' ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-cyan-500/20' : 'bg-gradient-to-tr from-purple-500 to-pink-600 shadow-purple-500/20'}`}>
                                {loginMode === 'device' ? <User size={40} className="text-white" /> : <ShieldCheck size={40} className="text-white" />}
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
                            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Sending...' : 'SEND RESET LINK'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setIsForgotPassword(false); setResetStatus('idle'); setError(''); }}
                            className="w-full text-slate-500 hover:text-white text-xs font-bold py-2 mt-2 uppercase tracking-widest"
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
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">
                                            Select Your Station
                                        </label>
                                        <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1">
                                            {machines.map(m => (
                                                <button
                                                    key={m.machine_id}
                                                    type="button"
                                                    onClick={() => setSelectedMachine(m.machine_id)}
                                                    className="p-6 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-cyan-900/20 hover:border-cyan-500/50 hover:text-cyan-400 hover:scale-[1.02] active:scale-95 shadow-lg"
                                                >
                                                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-700/50 text-white shadow-inner mb-1">
                                                        <span className="text-lg font-bold">{m.machine_id.replace('M', '')}</span>
                                                    </div>
                                                    <span className="text-sm font-black uppercase tracking-wide truncate w-full text-center">{m.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* LOW: 2. Password Entry View */
                                    <div className="space-y-4 animate-fade-in-up">
                                        {/* Selected Machine Header */}
                                        <div className="flex items-center justify-between bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                                    {selectedMachine.replace('M', '')}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">Selected Station</div>
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
                                                className="w-full bg-slate-900/80 border-2 border-slate-700 rounded-2xl py-4 text-center text-3xl font-mono tracking-[0.5em] text-cyan-400 focus:outline-none focus:border-cyan-500 shadow-inner"
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
                                                    className="h-16 rounded-xl bg-slate-800 border border-slate-700 text-3xl font-bold text-white hover:bg-slate-700 hover:border-slate-500 active:scale-95 active:bg-cyan-600 transition-all shadow-sm"
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                            <button disabled className="opacity-0 cursor-default"></button>
                                            <button
                                                type="button"
                                                onClick={() => setPassword(prev => (prev.length < 4 ? prev + 0 : prev))}
                                                className="h-16 rounded-xl bg-slate-800 border border-slate-700 text-3xl font-bold text-white hover:bg-slate-700 hover:border-slate-500 active:scale-95 active:bg-cyan-600 transition-all shadow-sm"
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
                                            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
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
                                            <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-purple-400 hover:text-purple-300 font-bold hover:underline">Forgot Password?</button>
                                        </div>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="password"
                                                required
                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
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
                                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-4"
                                    >
                                        {isLoading ? 'Verifying...' : 'LOGIN TO DASHBOARD'}
                                    </button>
                                </form>

                                {/* DEMO ACCOUNTS */}
                                <div className="pt-6 border-t border-white/5">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">— Quick Demo Access —</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['SuperAdmin', 'Admin', 'Manager', 'Finance', 'HR', 'Sales', 'Operator', 'Driver'].map(role => (
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
                System v5.3 • Data Center Active
            </div>
        </div>
    );
};

export default Login;
