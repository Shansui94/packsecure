import React, { useState } from 'react';
import { UserPlus, Mail, Lock, User, Briefcase, ArrowLeft } from 'lucide-react';
import { supabase } from '../services/supabase';

const Register: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [employeeId, setEmployeeId] = useState('');

    // Status State
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMsg('');

        try {
            // 1. Sign Up with Supabase Auth
            const { error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        employee_id: employeeId
                    }
                }
            });

            if (authError) throw authError;

            // 2. Insert into users_public (if not handled by Trigger)
            // Note: Best practice is using a Postgres Trigger on auth.users to insert into public.users
            // But if that's not set up, we might need to do it manually. 
            // For safety, we'll assume auth is enough or trigger exists.

            // If we needed manual insert:
            /*
            const { error: dbError } = await supabase.from('users_public').insert({
                id: authData.user?.id,
                email: email,
                name: name,
                employee_id: employeeId,
                role: 'Operator' // Default role
            });
            if (dbError) console.warn("DB Insert warning:", dbError);
            */

            setStatus('success');
        } catch (err: any) {
            console.error("Registration Error:", err);
            setErrorMsg(err.message || "Registration Failed");
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900 font-sans">
            {/* Background Effects (Same as Login) */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in-up">

                {/* Back Button */}
                <button
                    onClick={() => onNavigate('login')}
                    className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* HEADER */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/20">
                        <UserPlus size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                        JOIN PACKSECURE
                    </h1>
                    <p className="text-slate-400 text-sm">
                        Create your staff account
                    </p>
                </div>

                {status === 'success' ? (
                    <div className="text-center space-y-6">
                        <div className="p-6 bg-green-500/20 border border-green-500/50 rounded-2xl">
                            <h3 className="text-xl font-bold text-green-400 mb-2">Registration Successful!</h3>
                            <p className="text-slate-300 text-sm">
                                Please check your email <strong>({email})</strong> to confirm your account before logging in.
                            </p>
                        </div>
                        <button
                            onClick={() => onNavigate('login')}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-all"
                        >
                            Back to Login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">

                        {/* Name */}
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Full Name</label>
                            <div className="relative">
                                <User size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Work Email</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@packsecure.com"
                                />
                            </div>
                        </div>

                        {/* Employee ID */}
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Employee ID (Optional)</label>
                            <div className="relative">
                                <Briefcase size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    placeholder="e.g. 1045"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                />
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="text-red-400 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-shake">
                                {errorMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'loading' ? 'CREATING ACCOUNT...' : 'REGISTER ACCOUNT'}
                        </button>

                        <div className="text-center pt-4">
                            <button
                                type="button"
                                onClick={() => onNavigate('login')}
                                className="text-xs text-slate-500 hover:text-white font-bold uppercase tracking-widest transition-colors"
                            >
                                Already have an account? Login
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="absolute bottom-6 text-center w-full z-10 text-slate-700 text-[10px] tracking-widest uppercase">
                Packsecure OS • Registration System
            </div>
        </div>
    );
};

export default Register;
