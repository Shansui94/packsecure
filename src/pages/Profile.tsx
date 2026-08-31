import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '../services/supabase';
import { User as UserType, UserRole } from '../types';
import { useTranslation } from 'react-i18next';
import { 
    User, Lock, Shield, CheckCircle, AlertTriangle, 
    Eye, EyeOff, MapPin, Building, BadgeCheck, 
    Save, Loader, QrCode, Copy, Check, Sparkles, 
    Smartphone, ArrowRight, Truck, Scan, Users, 
    FileText, Key, Clock, ShieldCheck, X, Phone,
    Edit3, Globe, PhoneCall, ChevronDown, ChevronUp,
    Award, Star, Flame, Trophy, Zap, Moon, 
    Smile, Compass, RefreshCw, Palette, Layers,
    CheckCircle2, Target
} from 'lucide-react';
import { 
    fetchAllSystemBadges, 
    fetchUserManualAwards, 
    evaluateAllBadgesForUser, 
    EvaluatedBadge 
} from '../services/badgeService';

interface ProfileProps {
    user: UserType | null;
    onNavigate?: (page: string) => void;
}

// ── Fun Factory Personas ──
const FACTORY_PERSONAS = [
    { id: 'master', emoji: '👷‍♂️', name: '车间大师 (Workshop Master)', role: 'Operator / General' },
    { id: 'trucker', emoji: '🚚', name: '风暴车神 (Storm Trucker)', role: 'Driver' },
    { id: 'dynamo', emoji: '⚡', name: '电气专家 (Power Dynamo)', role: 'Maintenance' },
    { id: 'sentinel', emoji: '🛡️', name: '安全卫士 (Safety Sentinel)', role: 'Safety' },
    { id: 'robotics', emoji: '🤖', name: '智造先锋 (Robo Pioneer)', role: 'IoT / Tech' },
    { id: 'boss', emoji: '👑', name: '核心掌门 (Operations Boss)', role: 'Management' },
    { id: 'qc', emoji: '🎯', name: '质检王牌 (QC Ace)', role: 'Quality' },
    { id: 'logistics', emoji: '📦', name: '仓储元勋 (Logistics Elite)', role: 'Logistics' },
];

// ── Daily Factory Fortune Quotes ──
const FACTORY_FORTUNES = [
    {
        title: '今日吉兆：机台丝滑零卡料',
        luck: '★★★★★ 极佳',
        quote: '宜：开足马力高效产出，温度平稳；忌：未戴手套触摸模具。',
        blessing: '“每一卷优质胶膜，都是工业安全的美妙诗篇！”'
    },
    {
        title: '今日吉兆：一路绿灯准时达',
        luck: '★★★★★ 满运',
        quote: '宜：提前检查轮胎气压，平稳驾驶；忌：急躁变道。',
        blessing: '“车轮滚滚向前，平安满载而归，全勤奖稳如泰山！”'
    },
    {
        title: '今日吉兆：团队协作神同步',
        luck: '★★★★☆ 大吉',
        quote: '宜：早会微笑问好，交接班清楚；忌：闷头单打独斗。',
        blessing: '“齐心协力断金，厂区今天也是零故障、零失误的一天！”'
    },
    {
        title: '今日吉兆：工单飞速清空',
        luck: '★★★★★ 顶峰',
        quote: '宜：精准扫码，快速出库；忌：拖延核对标签。',
        blessing: '“精准高效是您的专属超能力，今天也是满分标兵！”'
    },
    {
        title: '今日吉兆：能量充沛无懈可击',
        luck: '★★★★☆ 吉祥',
        quote: '宜：多喝温水保持专注；忌：熬夜影响白班发挥。',
        blessing: '“严谨安全第一位，下班准点享团聚！”'
    }
];

export const Profile: React.FC<ProfileProps> = ({ user, onNavigate }) => {
    const { t, i18n } = useTranslation();
    const userId = user?.uid || user?.id || '';

    // ── 1. In-place Edit Profile State ──
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [extraProfile, setExtraProfile] = useState<any>(null);
    const [phoneInput, setPhoneInput] = useState('');
    const [emergencyNameInput, setEmergencyNameInput] = useState('');
    const [emergencyRelationInput, setEmergencyRelationInput] = useState('');
    const [emergencyPhoneInput, setEmergencyPhoneInput] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

    // ── 2. Collapsible In-place Password State ──
    const [isPasswordExpanded, setIsPasswordExpanded] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState(false);

    // ── 3. QR Badge Modal & Copy State ──
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // ── 4. Real Data-Driven Badges State ──
    const [evaluatedBadges, setEvaluatedBadges] = useState<EvaluatedBadge[]>([]);
    const [loadingBadges, setLoadingBadges] = useState(true);
    const [activeBadgeModal, setActiveBadgeModal] = useState<EvaluatedBadge | null>(null);

    // ── 5. Fun Persona & Fortune State ──
    const [selectedPersona, setSelectedPersona] = useState<string>(() => {
        return localStorage.getItem(`persona_${userId}`) || 'master';
    });
    const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);

    const [fortuneIndex, setFortuneIndex] = useState(() => {
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        return dayOfYear % FACTORY_FORTUNES.length;
    });
    const [fortuneFlipping, setFortuneFlipping] = useState(false);

    // Canvas Confetti Ref
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // ── Confetti Burst Animation ──
    const fireConfetti = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: Array<{
            x: number;
            y: number;
            vx: number;
            vy: number;
            color: string;
            size: number;
            rotation: number;
            rotSpeed: number;
            alpha: number;
        }> = [];

        const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

        for (let i = 0; i < 90; i++) {
            particles.push({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 16,
                vy: (Math.random() - 0.8) * 18,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 12,
                alpha: 1
            });
        }

        let animationFrameId: number;
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.4; // gravity
                p.rotation += p.rotSpeed;
                p.alpha -= 0.015;

                if (p.alpha > 0) {
                    alive = true;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.globalAlpha = Math.max(0, p.alpha);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    ctx.restore();
                }
            });

            if (alive) {
                animationFrameId = requestAnimationFrame(render);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        };

        render();
    }, []);

    // ── Language Selector ──
    const currentLang = i18n.language || localStorage.getItem('packsecure_lang') || 'zh-CN';
    const supportedLanguages = [
        { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
        { code: 'zh-TW', label: '繁體中文', flag: '🇭🇰' },
        { code: 'my', label: 'မြန်မာ', flag: '🇲🇲' },
        { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
        { code: 'bn', label: 'বাংলা', flag: '🇧🇩' }
    ];

    const handleLanguageChange = (code: string) => {
        i18n.changeLanguage(code);
        localStorage.setItem('packsecure_lang', code);
    };

    // ── Fetch Real Business Stats & Evaluate Badges ──
    const loadRealBadges = useCallback(async () => {
        if (!userId) return;
        setLoadingBadges(true);

        try {
            // 1. Fetch system badges definitions
            const sysBadges = await fetchAllSystemBadges();

            // 2. Fetch Driver Trips (sales_orders)
            let totalTrips = 0;
            const { count: tripsCount } = await supabase
                .from('sales_orders')
                .select('id', { count: 'exact', head: true })
                .eq('driver_id', userId)
                .eq('status', 'Delivered');
            if (tripsCount) totalTrips = tripsCount;

            // 3. Fetch Operator Production Kg (production_logs_v2)
            let totalProductionKg = 0;
            const { data: prodLogs } = await supabase
                .from('production_logs_v2')
                .select('total_weight')
                .eq('operator_id', userId);
            if (prodLogs) {
                totalProductionKg = prodLogs.reduce((acc, r) => acc + (Number(r.total_weight) || 0), 0);
            }

            // 4. Fetch Manual Awards
            const manualAwards = await fetchUserManualAwards(userId);

            // 5. Evaluate
            const results = evaluateAllBadgesForUser(sysBadges, {
                totalTrips,
                totalProductionKg,
                role: user?.role || 'Staff',
                employeeId: user?.employeeId || extraProfile?.employee_id,
                createdAt: extraProfile?.created_at,
                attendanceBonus: Number(extraProfile?.attendance_bonus) || 200,
                manualAwards
            });

            setEvaluatedBadges(results);
        } catch (e) {
            console.error('Error evaluating real badges:', e);
        } finally {
            setLoadingBadges(false);
        }
    }, [userId, user?.role, user?.employeeId, extraProfile?.employee_id, extraProfile?.created_at, extraProfile?.attendance_bonus]);

    // Fetch Extra Profile Data from sys_users_v2
    const fetchExtraProfile = useCallback(async () => {
        if (!userId) return;
        try {
            const { data } = await supabase
                .from('sys_users_v2')
                .select('*')
                .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
                .maybeSingle();

            if (data) {
                setExtraProfile(data);
                setPhoneInput(data.phone || user?.phone || '');
                setEmergencyNameInput(data.emergency_name || user?.emergencyName || '');
                setEmergencyRelationInput(data.emergency_relation || user?.emergencyRelation || '');
                setEmergencyPhoneInput(data.emergency_phone || user?.emergencyPhone || '');
            }
        } catch (e) {
            console.error('Error fetching extra profile:', e);
        }
    }, [userId, user?.phone, user?.emergencyName, user?.emergencyRelation, user?.emergencyPhone]);

    useEffect(() => {
        fetchExtraProfile();
    }, [fetchExtraProfile]);

    useEffect(() => {
        if (userId) {
            loadRealBadges();
        }
    }, [userId, extraProfile, loadRealBadges]);

    // Handle Persona Selection
    const handleSelectPersona = (id: string) => {
        setSelectedPersona(id);
        localStorage.setItem(`persona_${userId}`, id);
        setIsPersonaModalOpen(false);
        fireConfetti();
    };

    // Roll Fortune
    const handleNextFortune = () => {
        setFortuneFlipping(true);
        setTimeout(() => {
            setFortuneIndex((prev) => (prev + 1) % FACTORY_FORTUNES.length);
            setFortuneFlipping(false);
            fireConfetti();
        }, 250);
    };

    // Handle Badge Click (Open details & shoot confetti)
    const handleBadgeClick = (badge: EvaluatedBadge) => {
        setActiveBadgeModal(badge);
        if (badge.unlocked) {
            fireConfetti();
        }
    };

    // Role Theme Colors & Styles
    const getRoleTheme = (role?: UserRole | string) => {
        switch (role) {
            case 'SuperAdmin':
                return {
                    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                    glow: 'from-purple-600/30 via-indigo-600/20 to-pink-600/20',
                    border: 'border-purple-500/30',
                    accent: 'text-purple-400',
                    bar: 'bg-purple-500'
                };
            case 'Admin':
                return {
                    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                    glow: 'from-blue-600/30 via-indigo-600/20 to-cyan-600/20',
                    border: 'border-blue-500/30',
                    accent: 'text-blue-400',
                    bar: 'bg-blue-500'
                };
            case 'Manager':
                return {
                    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                    glow: 'from-emerald-600/30 via-teal-600/20 to-cyan-600/20',
                    border: 'border-emerald-500/30',
                    accent: 'text-emerald-400',
                    bar: 'bg-emerald-500'
                };
            case 'Driver':
                return {
                    badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
                    glow: 'from-orange-600/30 via-amber-600/20 to-red-600/20',
                    border: 'border-orange-500/30',
                    accent: 'text-orange-400',
                    bar: 'bg-orange-500'
                };
            case 'Operator':
                return {
                    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                    glow: 'from-amber-600/30 via-yellow-600/20 to-orange-600/20',
                    border: 'border-amber-500/30',
                    accent: 'text-amber-400',
                    bar: 'bg-amber-500'
                };
            case 'LogisticsCoordinator':
                return {
                    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
                    glow: 'from-cyan-600/30 via-blue-600/20 to-indigo-600/20',
                    border: 'border-cyan-500/30',
                    accent: 'text-cyan-400',
                    bar: 'bg-cyan-500'
                };
            default:
                return {
                    badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
                    glow: 'from-slate-600/30 via-gray-600/20 to-zinc-600/20',
                    border: 'border-white/10',
                    accent: 'text-slate-400',
                    bar: 'bg-slate-500'
                };
        }
    };

    const roleTheme = getRoleTheme(user?.role);
    const activePersona = FACTORY_PERSONAS.find(p => p.id === selectedPersona) || FACTORY_PERSONAS[0];

    // Password Strength Meter
    const getPasswordStrength = (pwd: string) => {
        if (!pwd) return 0;
        let score = 0;
        if (pwd.length >= 6) score += 1;
        if (pwd.length >= 8) score += 1;
        if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
        if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;
        return score;
    };

    const pwdStrength = getPasswordStrength(newPassword);

    const getStrengthLabel = (score: number) => {
        switch (score) {
            case 1: return { text: t('弱 (Weak)'), color: 'text-red-400', bar: 'w-1/4 bg-red-500' };
            case 2: return { text: t('一般 (Fair)'), color: 'text-amber-400', bar: 'w-2/4 bg-amber-500' };
            case 3: return { text: t('良好 (Good)'), color: 'text-blue-400', bar: 'w-3/4 bg-blue-500' };
            case 4: return { text: t('极强 (Strong)'), color: 'text-emerald-400', bar: 'w-full bg-emerald-500' };
            default: return { text: '', color: '', bar: 'w-0' };
        }
    };

    const strengthInfo = getStrengthLabel(pwdStrength);

    // Save Profile Changes
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileSuccessMsg('');

        try {
            const { error } = await supabase
                .from('sys_users_v2')
                .update({
                    phone: phoneInput.trim() || null,
                    emergency_name: emergencyNameInput.trim() || null,
                    emergency_relation: emergencyRelationInput.trim() || null,
                    emergency_phone: emergencyPhoneInput.trim() || null
                })
                .or(`auth_user_id.eq.${userId},id.eq.${userId}`);

            if (error) throw error;

            setProfileSuccessMsg(t('✅ 个人联系信息已成功更新！'));
            setIsEditingProfile(false);
            fetchExtraProfile();
            setTimeout(() => setProfileSuccessMsg(''), 4000);
        } catch (err: any) {
            console.error('Save profile error:', err);
            alert(t('保存失败：') + err.message);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCancelEditProfile = () => {
        setIsEditingProfile(false);
        setPhoneInput(extraProfile?.phone || user?.phone || '');
        setEmergencyNameInput(extraProfile?.emergency_name || user?.emergencyName || '');
        setEmergencyRelationInput(extraProfile?.emergency_relation || user?.emergencyRelation || '');
        setEmergencyPhoneInput(extraProfile?.emergency_phone || user?.emergencyPhone || '');
    };

    // Update Password Handler
    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdError('');
        setPwdSuccess(false);

        if (newPassword.length < 6) {
            setPwdError(t('密码长度至少需要 6 个字符 (Minimum 6 characters required)'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwdError(t('两次输入的密码不一致 (Passwords do not match)'));
            return;
        }

        setPwdLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setPwdSuccess(true);
            setNewPassword('');
            setConfirmPassword('');
            fireConfetti();
            setTimeout(() => {
                setPwdSuccess(false);
                setIsPasswordExpanded(false);
            }, 3000);
        } catch (err: any) {
            console.error('Update password failed:', err);
            setPwdError(err.message || t('修改密码失败，请稍后重试'));
        } finally {
            setPwdLoading(false);
        }
    };

    // QR Payload
    const qrPayload = JSON.stringify({
        type: 'PACKSECURE_STAFF_BADGE',
        uid: userId,
        empId: user?.employeeId || extraProfile?.employee_id || '',
        name: user?.name || '',
        role: user?.role || '',
        persona: activePersona.name,
        loc: user?.base_location || extraProfile?.base_location || 'Taiping'
    });

    const handleCopyUid = () => {
        const textToCopy = user?.employeeId || extraProfile?.employee_id || userId;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Safety Leads Directory
    const baseContacts = [
        { loc: 'Taiping (T1)', officer: 'Encik Razak (Safety Officer)', phone: '012-5551234', ext: 'T1-101' },
        { loc: 'Nilai (N1)', officer: 'Mr. Wong (Plant Manager)', phone: '016-8889922', ext: 'N1-202' },
        { loc: 'Johor (J1)', officer: 'En. Faizal (Site Supervisor)', phone: '019-7773311', ext: 'J1-301' },
        { loc: 'Kelantan (K1)', officer: 'Ustaz Azman (Logistics Lead)', phone: '013-9994455', ext: 'K1-401' }
    ];

    const currentFortune = FACTORY_FORTUNES[fortuneIndex];

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 space-y-6 max-w-6xl mx-auto animate-fade-in pb-20 relative">
            {/* Confetti Canvas Overlay */}
            <canvas 
                ref={canvasRef} 
                className="fixed inset-0 pointer-events-none z-50 w-full h-full"
            />

            {/* ── 1. Hero Identity Banner with Custom Persona ── */}
            <div className={`bg-gradient-to-r ${roleTheme.glow} border ${roleTheme.border} rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-2xl`}>
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
                    {/* Left: Avatar with Persona Switcher & Identity Details */}
                    <div className="flex items-center gap-5">
                        <div className="relative group cursor-pointer" onClick={() => setIsPersonaModalOpen(true)} title={t('点击更换工装趣味形象')}>
                            <div className="w-18 h-18 md:w-22 md:h-22 rounded-3xl bg-gradient-to-tr from-white/20 to-white/5 p-1 shadow-2xl transition-transform group-hover:scale-105">
                                <div className="w-full h-full bg-[#0d0d14] rounded-2xl flex items-center justify-center overflow-hidden border border-white/10 relative">
                                    {user?.photoURL ? (
                                        <img src={user.photoURL} alt={user.name || 'User'} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl md:text-4xl filter drop-shadow-md select-none">{activePersona.emoji}</span>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl text-[10px] font-bold text-amber-300 gap-1">
                                        <Palette size={12} /> {t('换装')}
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-3 border-[#07070a] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" title={t('当前在线 / Active Session')} />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                                    <span>{user?.name || t('未命名用户')}</span>
                                    <span className="text-sm font-normal text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                        {activePersona.emoji} {activePersona.name.split(' ')[0]}
                                    </span>
                                </h1>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${roleTheme.badgeBg}`}>
                                    <BadgeCheck size={14} /> {user?.role || 'Staff'}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {user?.status || extraProfile?.status || 'Active'}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs md:text-sm font-mono flex items-center gap-2 flex-wrap">
                                <span>{user?.email || extraProfile?.email || 'No email registered'}</span>
                                {(user?.employeeId || extraProfile?.employee_id) && (
                                    <span className="text-gray-500 font-mono">| ID: #{user?.employeeId || extraProfile?.employee_id}</span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Right: Quick QR Badge & Copy UID */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <button
                            type="button"
                            onClick={() => setIsQrModalOpen(true)}
                            className="flex-1 sm:flex-initial px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg cursor-pointer"
                        >
                            <QrCode size={16} className="text-amber-400" />
                            <span>{t('出示专属电子工牌 (My QR Badge)')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyUid}
                            className="px-3.5 py-3 bg-black/40 hover:bg-black/60 border border-white/10 rounded-2xl text-xs font-mono text-gray-300 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                            title={t('点击复制工号')}
                        >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-gray-400" />}
                            <span>{copied ? t('已复制!') : t('复制工号')}</span>
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Work Center Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                            <MapPin size={12} className="text-orange-400" /> {t('常驻运营基地')}
                        </div>
                        <div className="font-bold text-gray-200 text-sm">{user?.base_location || extraProfile?.base_location || 'Taiping'}</div>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                            <Building size={12} className="text-blue-400" /> {t('厂区代码')}
                        </div>
                        <div className="font-bold text-gray-200 text-sm">{user?.factoryId || extraProfile?.factory_id || 'T1'}</div>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                            <ShieldCheck size={12} className="text-emerald-400" /> {t('安全认证架构')}
                        </div>
                        <div className="font-bold text-emerald-300 text-sm">Supabase RBAC</div>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                            <Clock size={12} className="text-purple-400" /> {t('本次登录时间')}
                        </div>
                        <div className="font-mono text-gray-300 text-xs truncate">{user?.loginTime || new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
            </div>

            {/* ── 2. Real Data-Driven Achievement Showcase (真实数据荣誉勋章展厅) ── */}
            <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-6 md:p-7 shadow-xl relative backdrop-blur-xl">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                            <Trophy size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white flex items-center gap-2">
                                <span>{t('真实业务数据荣誉勋章展厅 (Achievement Showcase)')}</span>
                                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                    {evaluatedBadges.filter(b => b.unlocked).length} / {evaluatedBadges.length} UNLOCKED
                                </span>
                            </h2>
                            <p className="text-[11px] text-gray-400">{t('基于出车单数、生产吨数、考勤与管理员嘉奖真实判定，点击查看数据依据 📊')}</p>
                        </div>
                    </div>

                    <button
                        onClick={loadRealBadges}
                        className="text-[11px] text-gray-500 hover:text-white flex items-center gap-1 bg-white/5 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                        title={t('重新核验数据')}
                    >
                        <RefreshCw size={12} className={loadingBadges ? 'animate-spin' : ''} /> {t('核验数据')}
                    </button>
                </div>

                {/* Badges Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {evaluatedBadges.map((badge) => (
                        <div
                            key={badge.id}
                            onClick={() => handleBadgeClick(badge)}
                            className={`p-3.5 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center cursor-pointer relative group ${
                                badge.unlocked
                                    ? 'bg-black/50 border-white/10 hover:border-amber-500/50 hover:scale-105 shadow-lg'
                                    : 'bg-black/20 border-white/5 opacity-40 grayscale hover:opacity-60'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
                                {badge.icon}
                            </div>
                            <div className="font-bold text-xs text-gray-200 truncate w-full mb-0.5">
                                {badge.title.split(' ')[0]}
                            </div>
                            <div className="text-[9px] text-gray-500 font-mono truncate w-full">
                                {badge.unlocked ? `● ${badge.tier} (${badge.progressPercent}%)` : `🔒 进度 ${badge.progressPercent}%`}
                            </div>

                            {/* Real Mini Progress Bar */}
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        badge.unlocked ? 'bg-amber-400' : 'bg-gray-600'
                                    }`}
                                    style={{ width: `${badge.progressPercent}%` }}
                                />
                            </div>

                            {badge.unlocked && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 3. Main Two-Column Layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* ── Left Column (7 cols): Personal Profile & Contact Information ── */}
                <div className="lg:col-span-7 bg-[#0d0d12] border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl relative backdrop-blur-xl space-y-6">
                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                                <User size={20} />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-white">{t('个人档案与联系方式')}</h2>
                                <p className="text-xs text-gray-400">{t('基础档案由系统管理，个人联系方式可按需修改')}</p>
                            </div>
                        </div>

                        {!isEditingProfile ? (
                            <button
                                type="button"
                                onClick={() => setIsEditingProfile(true)}
                                className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                            >
                                <Edit3 size={14} />
                                <span>{t('✏️ 编辑资料 (Edit)')}</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCancelEditProfile}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer"
                                >
                                    {t('取消')}
                                </button>
                            </div>
                        )}
                    </div>

                    {profileSuccessMsg && (
                        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
                            <CheckCircle size={16} /> {profileSuccessMsg}
                        </div>
                    )}

                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        {/* Read-only System Managed Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5">
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center justify-between mb-1">
                                    <span>{t('员工全名 (Full Name)')}</span>
                                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-gray-500 font-mono">LOCKED</span>
                                </div>
                                <div className="text-sm font-bold text-gray-200">{user?.name || 'N/A'}</div>
                            </div>

                            <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5">
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center justify-between mb-1">
                                    <span>{t('系统角色 / 职位')}</span>
                                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-gray-500 font-mono">LOCKED</span>
                                </div>
                                <div className="text-sm font-bold text-purple-300">{user?.role || 'Staff'}</div>
                            </div>

                            <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5">
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center justify-between mb-1">
                                    <span>{t('工号 (Employee ID)')}</span>
                                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-gray-500 font-mono">LOCKED</span>
                                </div>
                                <div className="text-sm font-mono font-bold text-emerald-300">
                                    {user?.employeeId || extraProfile?.employee_id || '----'}
                                </div>
                            </div>

                            <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5">
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center justify-between mb-1">
                                    <span>{t('认证邮箱 (Email)')}</span>
                                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-gray-500 font-mono">LOCKED</span>
                                </div>
                                <div className="text-xs font-mono text-gray-300 truncate">{user?.email || extraProfile?.email || 'N/A'}</div>
                            </div>
                        </div>

                        {/* Editable Section */}
                        <div className="pt-3 border-t border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                                    {t('个人联系与紧急求助信息')}
                                </div>
                                {isEditingProfile && (
                                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
                                        ● {t('编辑中 / Editing')}
                                    </span>
                                )}
                            </div>

                            {/* Personal Phone */}
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">
                                    {t('个人手机号码 (Personal Phone)')}
                                </label>
                                {isEditingProfile ? (
                                    <input
                                        type="tel"
                                        value={phoneInput}
                                        onChange={e => setPhoneInput(e.target.value)}
                                        placeholder="e.g. 012-3456789"
                                        className="w-full bg-black/50 border border-purple-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-purple-400 transition"
                                    />
                                ) : (
                                    <div className="bg-black/30 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-200">
                                        {extraProfile?.phone || user?.phone || <span className="text-gray-600 italic">{t('未填写电话')}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Emergency Contact Group */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">
                                        {t('直系家属姓名')}
                                    </label>
                                    {isEditingProfile ? (
                                        <input
                                            type="text"
                                            value={emergencyNameInput}
                                            onChange={e => setEmergencyNameInput(e.target.value)}
                                            placeholder="e.g. Siti binti Abu"
                                            className="w-full bg-black/50 border border-purple-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-400 transition"
                                        />
                                    ) : (
                                        <div className="bg-black/30 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-gray-200">
                                            {extraProfile?.emergency_name || user?.emergencyName || <span className="text-gray-600 italic">{t('未填写')}</span>}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">
                                        {t('与本人关系')}
                                    </label>
                                    {isEditingProfile ? (
                                        <input
                                            type="text"
                                            value={emergencyRelationInput}
                                            onChange={e => setEmergencyRelationInput(e.target.value)}
                                            placeholder="e.g. 配偶 / 父母 / 兄弟"
                                            className="w-full bg-black/50 border border-purple-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-400 transition"
                                        />
                                    ) : (
                                        <div className="bg-black/30 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-gray-200">
                                            {extraProfile?.emergency_relation || user?.emergencyRelation || <span className="text-gray-600 italic">{t('未填写')}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Emergency Phone */}
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">
                                    {t('紧急联系人电话 (Emergency Phone)')}
                                </label>
                                {isEditingProfile ? (
                                    <input
                                        type="tel"
                                        value={emergencyPhoneInput}
                                        onChange={e => setEmergencyPhoneInput(e.target.value)}
                                        placeholder="e.g. 013-9876543"
                                        className="w-full bg-black/50 border border-purple-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-purple-400 transition"
                                    />
                                ) : (
                                    <div className="bg-black/30 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-200">
                                        {extraProfile?.emergency_phone || user?.emergencyPhone || <span className="text-gray-600 italic">{t('未填写')}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Save Button when in Edit Mode */}
                            {isEditingProfile && (
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleCancelEditProfile}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer"
                                    >
                                        {t('取消编辑')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="flex-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition active:scale-95 cursor-pointer"
                                    >
                                        {savingProfile ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                                        <span>{t('💾 保存联系信息 (Save Changes)')}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* ── Right Column (5 cols): Security, Preferences & Direct Launchpad ── */}
                <div className="lg:col-span-5 space-y-6">

                    {/* 1. Account Security & In-place Collapsible Password Card */}
                    <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-6 shadow-xl relative backdrop-blur-xl">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                                    <Lock size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">{t('登录密码与安全防护')}</h3>
                                    <p className="text-[11px] text-gray-400">{t('Supabase Auth 密码安全管理')}</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsPasswordExpanded(!isPasswordExpanded);
                                    setPwdError('');
                                    setPwdSuccess(false);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${
                                    isPasswordExpanded 
                                        ? 'bg-white/10 border-white/20 text-gray-300' 
                                        : 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/30 text-blue-300'
                                }`}
                            >
                                <Key size={13} />
                                <span>{isPasswordExpanded ? t('收起') : t('🔑 修改登录密码')}</span>
                                {isPasswordExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                        </div>

                        {/* Collapsed State Info */}
                        {!isPasswordExpanded && (
                            <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5 flex items-center justify-between text-xs mt-3">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <ShieldCheck size={16} />
                                    <span>{t('登录密码已受安全保护')}</span>
                                </div>
                                <span className="text-[10px] text-gray-500 font-mono">ACTIVE</span>
                            </div>
                        )}

                        {/* Expanded Password Form */}
                        {isPasswordExpanded && (
                            <form onSubmit={handleUpdatePassword} className="space-y-3.5 mt-4 pt-3 border-t border-white/5 animate-fade-in">
                                {pwdSuccess && (
                                    <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                                        <CheckCircle size={15} /> {t('✅ 密码已成功更新！')}
                                    </div>
                                )}

                                {pwdError && (
                                    <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
                                        <AlertTriangle size={15} /> {pwdError}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                                        {t('新登录密码 (New Password)')} <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder={t('至少 6 个字符')}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                                        >
                                            {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>

                                    {/* Strength Indicator */}
                                    {newPassword.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            <div className="flex justify-between items-center text-[9px]">
                                                <span className="text-gray-500">{t('密码强度')}</span>
                                                <span className={`font-bold ${strengthInfo.color}`}>{strengthInfo.text}</span>
                                            </div>
                                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-300 rounded-full ${strengthInfo.bar}`} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                                        {t('确认新密码 (Confirm New Password)')} <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            placeholder={t('再次输入新密码')}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                                        >
                                            {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsPasswordExpanded(false)}
                                        className="py-2.5 px-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer"
                                    >
                                        {t('取消')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={pwdLoading || !newPassword || !confirmPassword || newPassword.length < 6}
                                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/25 transition active:scale-95 cursor-pointer"
                                    >
                                        {pwdLoading ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                                        <span>{t('确认更新密码')}</span>
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* 2. System Language & Preferences */}
                    <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-6 shadow-xl relative backdrop-blur-xl">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                                <Globe size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white">{t('系统语言偏好 (Language)')}</h3>
                                <p className="text-[11px] text-gray-400">{t('即时切换系统显示语言')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3">
                            {supportedLanguages.slice(0, 4).map(l => (
                                <button
                                    key={l.code}
                                    type="button"
                                    onClick={() => handleLanguageChange(l.code)}
                                    className={`p-2.5 rounded-2xl text-xs font-bold flex items-center justify-between border transition cursor-pointer ${
                                        currentLang === l.code
                                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                                            : 'bg-black/40 text-gray-400 border-white/5 hover:border-white/10 hover:text-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{l.flag}</span>
                                        <span>{l.label}</span>
                                    </div>
                                    {currentLang === l.code && <Check size={14} className="text-cyan-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Direct Role Workspace Launchpad */}
                    <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-6 shadow-xl relative backdrop-blur-xl">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                            <ArrowRight size={14} className="text-blue-400" />
                            <span>{t('主要工作台快捷通道')}</span>
                        </h3>

                        <div className="space-y-2">
                            {user?.role === 'Driver' && onNavigate && (
                                <button
                                    onClick={() => onNavigate('delivery-driver')}
                                    className="w-full p-3 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Truck size={16} /> <span>{t('进入我的配送 (Driver App)')}</span>
                                    </div>
                                    <ArrowRight size={14} />
                                </button>
                            )}

                            {(user?.role === 'Operator' || user?.role === 'Manager') && onNavigate && (
                                <button
                                    onClick={() => onNavigate('scanner')}
                                    className="w-full p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Scan size={16} /> <span>{t('进入生产控制中枢 (Production Control)')}</span>
                                    </div>
                                    <ArrowRight size={14} />
                                </button>
                            )}

                            {['SuperAdmin', 'Admin', 'HR'].includes(user?.role || '') && onNavigate && (
                                <button
                                    onClick={() => onNavigate('hr')}
                                    className="w-full p-3 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Users size={16} /> <span>{t('进入人事管理中心 (HR Portal)')}</span>
                                    </div>
                                    <ArrowRight size={14} />
                                </button>
                            )}

                            {onNavigate && (
                                <button
                                    onClick={() => onNavigate('sop-center')}
                                    className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <FileText size={16} /> <span>{t('查看标准作业指引 (SOP Guide)')}</span>
                                    </div>
                                    <ArrowRight size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── 4. Daily Factory Fortune & Energy Quote Card ── */}
            <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 border border-amber-500/20 rounded-3xl p-6 shadow-xl relative backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className={`space-y-1 transition-opacity duration-300 ${fortuneFlipping ? 'opacity-30' : 'opacity-100'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-amber-400 font-black text-sm flex items-center gap-1.5">
                            <Sparkles size={16} className="text-amber-400" /> {t(currentFortune.title)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                            {currentFortune.luck}
                        </span>
                    </div>
                    <p className="text-xs text-gray-300">{t(currentFortune.quote)}</p>
                    <p className="text-[11px] text-gray-500 italic">{t(currentFortune.blessing)}</p>
                </div>

                <button
                    type="button"
                    onClick={handleNextFortune}
                    className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-2xl text-xs font-bold text-amber-300 flex items-center gap-2 transition active:scale-95 shrink-0 cursor-pointer shadow-md"
                >
                    <RefreshCw size={14} className={fortuneFlipping ? 'animate-spin' : ''} />
                    <span>{t('✨ 摇一摇换新签 (Roll Fortune)')}</span>
                </button>
            </div>

            {/* ── 5. Factory Safety & Emergency Contacts Section ── */}
            <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-6 shadow-xl relative backdrop-blur-xl">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                        <PhoneCall size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white">{t('厂区安全主管与紧急调度直拨热线 (Site Safety Leads)')}</h3>
                        <p className="text-[11px] text-gray-400">{t('现场遇突发工伤救援、设备故障或安全隐患请直接拨打')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {baseContacts.map(c => (
                        <div key={c.loc} className="bg-black/40 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between space-y-2">
                            <div>
                                <div className="font-bold text-xs text-white">{c.loc}</div>
                                <div className="text-[11px] text-gray-400 mt-0.5">{c.officer}</div>
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">EXT: {c.ext}</div>
                            </div>
                            <a
                                href={`tel:${c.phone}`}
                                className="px-3 py-2 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 rounded-xl text-orange-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                            >
                                <PhoneCall size={13} /> {c.phone}
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 6. Fullscreen Digital QR Badge Modal ── */}
            {isQrModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#0e0e16] border border-white/15 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative flex flex-col items-center text-center">
                        <button
                            onClick={() => setIsQrModalOpen(false)}
                            className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl mb-3 mt-2">
                            {activePersona.emoji}
                        </div>

                        <h3 className="text-lg font-black text-white">{t('专属员工电子工牌')}</h3>
                        <p className="text-xs text-gray-400 mb-5">{user?.name || 'Staff Member'} • {user?.role || 'Staff'}</p>

                        <div className="bg-white p-5 rounded-3xl shadow-2xl mb-5">
                            <QRCode
                                value={qrPayload}
                                size={220}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 220 220`}
                            />
                        </div>

                        <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-2.5 w-full text-xs font-mono text-gray-300 mb-4 flex justify-between items-center">
                            <span>ID: {user?.employeeId || extraProfile?.employee_id || userId?.slice(0, 12)}</span>
                            <span className="text-emerald-400 font-bold">● VERIFIED</span>
                        </div>

                        <button
                            onClick={() => setIsQrModalOpen(false)}
                            className="w-full py-3 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer"
                        >
                            {t('关闭 (Close)')}
                        </button>
                    </div>
                </div>
            )}

            {/* ── 7. Custom Persona Chooser Modal ── */}
            {isPersonaModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#0e0e16] border border-white/15 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <Palette size={20} className="text-amber-400" />
                                <h3 className="text-base font-black text-white">{t('自选工厂工装形象 (Avatar Persona)')}</h3>
                            </div>
                            <button
                                onClick={() => setIsPersonaModalOpen(false)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-xs text-gray-400 mb-4">{t('挑选一个最符合您日常岗位气质的专属趣味工装头像：')}</p>

                        <div className="grid grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
                            {FACTORY_PERSONAS.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleSelectPersona(p.id)}
                                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                                        selectedPersona === p.id
                                            ? 'bg-amber-500/20 border-amber-500/50 shadow-md scale-102'
                                            : 'bg-black/40 border-white/5 hover:border-white/15 hover:bg-white/5'
                                    }`}
                                >
                                    <span className="text-2xl">{p.emoji}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-gray-200 truncate">{p.name.split(' ')[0]}</div>
                                        <div className="text-[10px] text-gray-500 truncate">{p.role}</div>
                                    </div>
                                    {selectedPersona === p.id && <Check size={16} className="text-amber-400 shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 8. Real-Data Achievement Detail Modal (真实数据判定与进度) ── */}
            {activeBadgeModal && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#0e0e16] border border-white/15 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative flex flex-col items-center text-center">
                        <button
                            onClick={() => setActiveBadgeModal(null)}
                            className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-white/15 flex items-center justify-center text-4xl mb-3 mt-2 shadow-inner">
                            {activeBadgeModal.icon}
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider mb-1.5 border ${
                            activeBadgeModal.unlocked ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                            {activeBadgeModal.unlocked ? `● TIER ${activeBadgeModal.tier} (已点亮)` : '🔒 未达成 (LOCKED)'}
                        </span>

                        <h3 className="text-lg font-black text-white">{activeBadgeModal.title}</h3>
                        <p className="text-xs text-gray-400 font-mono mb-4">{activeBadgeModal.titleEn}</p>

                        <div className="bg-black/50 border border-white/10 rounded-2xl p-4 w-full text-left space-y-3 mb-5">
                            {/* Real Data Progress Bar */}
                            <div>
                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 mb-1">
                                    <span>{t('真实业务指标核验')}</span>
                                    <span className={activeBadgeModal.unlocked ? 'text-emerald-400' : 'text-amber-400'}>
                                        {activeBadgeModal.currentValue} / {String(activeBadgeModal.targetValue)} ({activeBadgeModal.progressPercent}%)
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            activeBadgeModal.unlocked ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${activeBadgeModal.progressPercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* Verification Source */}
                            <div className="bg-white/5 rounded-xl p-2.5 text-[11px] text-gray-300 flex items-center gap-2 border border-white/5">
                                <ShieldCheck size={14} className="text-blue-400 shrink-0" />
                                <div>
                                    <span className="text-gray-500 font-bold">{t('认证来源：')}</span> {activeBadgeModal.verificationSource}
                                </div>
                            </div>

                            {/* Requirement */}
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t('达成规则说明 / Requirement')}</div>
                                <div className="text-xs text-gray-300 mt-0.5">{activeBadgeModal.desc}</div>
                            </div>

                            {/* Lore */}
                            <div className="pt-2 border-t border-white/5">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t('荣誉寄语 / Praise')}</div>
                                <div className="text-xs text-amber-300/90 mt-0.5 italic leading-relaxed">{activeBadgeModal.story}</div>
                            </div>

                            {activeBadgeModal.awardNote && (
                                <div className="pt-2 border-t border-white/5">
                                    <div className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">{t('特别嘉奖评语')}</div>
                                    <div className="text-xs text-purple-200 mt-0.5 font-mono">{activeBadgeModal.awardNote} ({activeBadgeModal.unlockDate})</div>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setActiveBadgeModal(null)}
                            className="w-full py-3 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold text-white transition cursor-pointer"
                        >
                            {t('关闭成就卡 (Close)')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
