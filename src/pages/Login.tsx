
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
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
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
                                {/* Machine Select */}
                                <div className="group">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Machine Station</label>
                                    <div className="relative">
                                        <select
                                            required
                                            value={selectedMachine}
                                            onChange={(e) => setSelectedMachine(e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-4 text-white appearance-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                                        >
                                            <option value="" disabled>-- Select Machine --</option>
                                            {machines.map(m => (
                                                <option key={m.machine_id} value={m.machine_id}>
                                                    {m.name} ({m.machine_id})
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div className="group">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Device Password</label>
                                    <input
                                        type="password"
                                        required
                                        maxLength={4}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-center tracking-[0.5em] font-mono text-xl"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••"
                                    />
                                </div>

                                {error && (
                                    <div className="text-red-400 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-shake">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-4"
                                >
                                    {isLoading ? 'Accessing...' : 'UNLOCK DEVICE'}
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                <form onSubmit={handleStaffLogin} className="space-y-6">
                                    {/* Email Input */}
                                    <div className="group">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="email"
                                                required
                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="name@packsecure.com"
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
                System v4.3 • Device Refactor Live
            </div>
        </div>
    );
};

export default Login;
