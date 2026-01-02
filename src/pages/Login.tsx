
import React, { useState } from 'react';
import { User } from 'lucide-react';
import { supabase } from '../services/supabase';

interface LoginProps {
    onLogin: (email: string | null, gps: string, role: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [machines, setMachines] = useState<any[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<string>('');
    const [password, setPassword] = useState<string>('');
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

    const handleDeviceLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // 1. Validate Password
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
            // 2. Persist Machine Selection
            sessionStorage.setItem('selectedMachine', selectedMachine);
            localStorage.setItem('device_machine_id', selectedMachine); // Persist across reloads

            // 3. Fake Auth / Anonymous Login for Device
            // We use a dummy email based on machine ID to satisfy the App's user state
            const deviceEmail = `device-${selectedMachine.toLowerCase()}@packsecure.local`;

            // Note: In a real app we might want a real DB user for the device, 
            // but for this "Device Mode", we just need to satisfy the onLogin callback.
            // Let's pass the Machine ID as the "User" effectively.

            // Get GPS (Optional)
            let gps = "GPS_SKIPPED";
            // Check Permissions first or skip to speed up

            onLogin(deviceEmail, gps, 'Device');

        } catch (err: any) {
            console.error("Login Error:", err);
            setError("Login Failed");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900 font-sans">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in-up">

                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/20">
                        <User size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">DEVICE ACCESS</h1>
                    <p className="text-slate-400 text-sm">Select Production Machine</p>
                </div>

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
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500">
                                ▼
                            </div>
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

                    <p className="text-center text-xs text-slate-600 mt-6">
                        Restricted Access • Authorized Personnel Only
                    </p>
                </form>
            </div>

            <div className="absolute bottom-6 text-center w-full z-10 text-slate-700 text-[10px] tracking-widest uppercase">
                System v4.3 • Device Refactor Live
            </div>
        </div>
    );
};

export default Login;
