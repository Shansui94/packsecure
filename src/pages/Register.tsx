import React, { useState } from 'react';
import { UserPlus, Mail, Lock, User, Briefcase, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';

import { pinToAuthPassword } from '../utils/pinAuth';

interface RegisterProps {
    onNavigate: (page: string) => void;
}

const Register: React.FC<RegisterProps> = ({ onNavigate }) => {
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

        // Strict 4-digit PIN validation
        const pinDigits = password.replace(/\D/g, '');
        if (pinDigits.length !== 4) {
            setErrorMsg('PIN 码必须正好为 4 位数字 (PIN must be exactly 4 digits)');
            setStatus('error');
            return;
        }

        try {
            // Automatically append "00" to 4-digit PIN for Supabase Auth requirement
            const finalPassword = pinToAuthPassword(pinDigits);

            // 1. Sign Up with Supabase Auth
            const { data: signUpData, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password: finalPassword,
                options: {
                    data: {
                        full_name: name.trim(),
                        employee_id: employeeId.trim() || pinDigits
                    }
                }
            });

            if (authError) throw authError;

            const registeredUid = signUpData.user?.id;
            if (registeredUid) {
                // Insert Pending user record to users_public for HR Portal approval
                await supabase.from('users_public').upsert({
                    id: registeredUid,
                    email: email.trim(),
                    name: name.trim(),
                    employee_id: employeeId.trim() || pinDigits,
                    role: 'Operator',
                    status: 'Pending'
                }).catch(err => console.warn("users_public pending insert warning:", err));

                // Insert Pending user record to sys_users_v2
                await supabase.from('sys_users_v2').upsert({
                    auth_user_id: registeredUid,
                    email: email.trim(),
                    name: name.trim(),
                    employee_id: employeeId.trim() || pinDigits,
                    pin_code: pinDigits,
                    role: 'Operator',
                    status: 'Pending'
                }, { onConflict: 'auth_user_id' }).catch(err => console.warn("sys_users_v2 pending insert warning:", err));
            }

            setStatus('success');
        } catch (err: any) {
            console.error("Registration Error:", err);
            setErrorMsg(err.message || "Registration Failed. Please try again.");
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 py-10 relative overflow-hidden bg-[#050505] font-sans text-white">
            {/* Ambient Background Glow (Matching Login.tsx) */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#E97132]/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FE4B13]/10 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-md bg-[#121215]/90 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in-up transition-all duration-500">

                {/* Back Button */}
                <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors p-2 rounded-xl bg-slate-900/80 border border-white/10 shadow-sm"
                    title="Return to Login"
                >
                    <ArrowLeft size={18} />
                </button>

                {/* HEADER */}
                <div className="text-center mb-6 pt-2">
                    <div className="flex justify-center mb-4">
                        <img 
                            src="/packsecure-logo.jpg" 
                            alt="PackSecure OS" 
                            className="h-16 rounded-xl shadow-lg border border-white/10" 
                        />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight mb-1 uppercase">
                        JOIN PACKSECURE
                    </h1>
                    <p className="text-slate-400 text-xs">
                        Create your staff account / 注册员工账号
                    </p>
                </div>

                {status === 'success' ? (
                    <div className="text-center space-y-6 animate-fade-in-up py-4">
                        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-2xl flex flex-col items-center">
                            <CheckCircle2 size={48} className="text-green-400 mb-3 animate-bounce" />
                            <h3 className="text-lg font-bold text-green-400 mb-2">Registration Submitted / 提交成功</h3>
                            <p className="text-slate-300 text-xs leading-relaxed">
                                Account for <strong className="text-white font-mono">{email}</strong> has been registered. Please check your email or contact Admin/HR to activate your account permissions.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate('login')}
                            className="w-full bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#E97132]/20 uppercase tracking-wider text-xs"
                        >
                            Return to Login / 返回登录
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">

                        {/* Full Name */}
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                Full Name / 姓名
                            </label>
                            <div className="relative">
                                <User size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-[#08080a] border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] focus:ring-1 focus:ring-[#E97132] transition-all text-sm shadow-inner"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>

                        {/* Work Email */}
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                Work Email / 工作邮箱
                            </label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-[#08080a] border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] focus:ring-1 focus:ring-[#E97132] transition-all font-mono text-sm shadow-inner"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@packsecure.com"
                                />
                            </div>
                        </div>

                        {/* Employee ID */}
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                Employee ID (Optional) / 工号
                            </label>
                            <div className="relative">
                                <Briefcase size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    className="w-full bg-[#08080a] border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] focus:ring-1 focus:ring-[#E97132] transition-all font-mono text-sm shadow-inner"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    placeholder="e.g. 1045"
                                />
                            </div>
                        </div>

                        {/* 4-Digit PIN */}
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                4-Digit PIN / 4位数字密码
                            </label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]{4}"
                                    maxLength={4}
                                    required
                                    className="w-full bg-[#08080a] border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] focus:ring-1 focus:ring-[#E97132] transition-all font-mono text-base tracking-widest shadow-inner"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    placeholder="••••"
                                />
                            </div>
                            <span className="block text-[10px] text-slate-500 mt-1 ml-1">
                                注：只需输入4位数字PIN码，系统会自动补齐后台验证格式。
                            </span>
                        </div>

                        {errorMsg && (
                            <div className="text-red-400 text-xs text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-shake">
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#E97132]/20 transition-all transform hover:-translate-y-0.5 active:scale-95 mt-3 disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider"
                        >
                            {status === 'loading' ? 'CREATING ACCOUNT...' : 'REGISTER ACCOUNT / 注册账号'}
                        </button>

                        <div className="text-center pt-3">
                            <button
                                type="button"
                                onClick={() => onNavigate('login')}
                                className="text-xs text-[#E97132] hover:text-[#FE4B13] font-bold uppercase tracking-widest transition-colors"
                            >
                                Already have an account? Login
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Footer placed outside card in flex layout to prevent overlap */}
            <div className="mt-8 text-center z-10 text-slate-500 text-[10px] tracking-widest uppercase">
                System v6.7 • Packsecure OS Registration Portal
            </div>
        </div>
    );
};

export default Register;
