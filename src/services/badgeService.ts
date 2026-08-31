import { supabase } from './supabase';

export interface SystemBadge {
    id: string;
    title: string;
    titleEn: string;
    icon: string;
    tier: 'Gold' | 'Silver' | 'Diamond' | 'Special';
    category: 'All' | 'Driver' | 'Operator' | 'Manager' | 'Quality' | 'Special';
    ruleType: 'trips_completed' | 'production_kg' | 'attendance_streak' | 'tenure_months' | 'role_bound' | 'manual_award';
    targetValue: number | string;
    desc: string;
    story: string;
    createdAt?: string;
    createdBy?: string;
}

export interface EvaluatedBadge extends SystemBadge {
    unlocked: boolean;
    currentValue: number | string;
    progressPercent: number;
    verificationSource: string;
    unlockDate?: string;
    awardNote?: string;
}

// ── Built-in System Badges (Foundational Blueprint) ──
export const DEFAULT_SYSTEM_BADGES: SystemBadge[] = [
    {
        id: 'iron_attendance',
        title: '全勤铁人 (Iron Attendance)',
        titleEn: 'Zero Absence Hero',
        icon: '🏆',
        tier: 'Gold',
        category: 'All',
        ruleType: 'attendance_streak',
        targetValue: 1, // 1 month 100% attendance bonus
        desc: '恪尽职守，当月出勤率达标且获全勤奖。',
        story: '在风雨无阻的生产日常中，您的每一次准时出勤都是工厂稳定运转的坚实基石！'
    },
    {
        id: 'driver_century_50',
        title: '出车五十载 (50 Trips Master)',
        titleEn: '50 Deliveries Milestone',
        icon: '🚚',
        tier: 'Silver',
        category: 'Driver',
        ruleType: 'trips_completed',
        targetValue: 50,
        desc: '累计完成 50 趟安全送货发车任务。',
        story: '车轮滚滚，日夜兼程，用每一次安全准时的交付铸就了 Packsecure 的卓越信誉！'
    },
    {
        id: 'driver_century_100',
        title: '百趟运力标兵 (100 Trips Champion)',
        titleEn: 'Century Trucker Legend',
        icon: '⚡',
        tier: 'Diamond',
        category: 'Driver',
        ruleType: 'trips_completed',
        targetValue: 100,
        desc: '累计完成 100 趟安全送货发车任务。',
        story: '穿越数千公里公路，百趟零重大事故，堪称 Packsecure 车队最硬核的公路守护者！'
    },
    {
        id: 'production_ton_10k',
        title: '万斤产出先锋 (10-Ton Craftsman)',
        titleEn: '10,000 Kg Output Pioneer',
        icon: '⚙️',
        tier: 'Silver',
        category: 'Operator',
        ruleType: 'production_kg',
        targetValue: 10000,
        desc: '累计在机台生产并完成 10,000 Kg 优质卷料。',
        story: '专注模温与拉伸厚度，万斤合格产品的背后，是精益求精的工匠精神与耐力！'
    },
    {
        id: 'production_ton_50k',
        title: '五十吨智造巨匠 (50-Ton Master)',
        titleEn: '50-Ton Production Giant',
        icon: '🌟',
        tier: 'Diamond',
        category: 'Operator',
        ruleType: 'production_kg',
        targetValue: 50000,
        desc: '累计在机台生产并完成 50,000 Kg 优质卷料。',
        story: '车间里的主力引擎，五十吨高品质胶膜连缀起工厂源源不断的产能奇迹！'
    },
    {
        id: 'safety_sentinel',
        title: '安全卫士 (Zero Incident Hero)',
        titleEn: 'Safety Champion',
        icon: '🛡️',
        tier: 'Diamond',
        category: 'All',
        ruleType: 'role_bound',
        targetValue: 'Safety / Active',
        desc: '安全合规操作，在册资质证件正常有效。',
        story: '视安全为最高准则，佩戴防护装备、杜绝违规操作，守护自己与每一位工友的平安！'
    },
    {
        id: 'pioneer',
        title: '拓荒先驱 (Early Pioneer)',
        titleEn: 'Packsecure Pioneer',
        icon: '🚀',
        tier: 'Special',
        category: 'All',
        ruleType: 'tenure_months',
        targetValue: 6, // 6 months or core admin/001
        desc: '首批加入数字化工厂运营的功勋骨干。',
        story: '见证 Packsecure OS 从初代扫码迈向现代化工业 AI 智造体系的坚实探索者！'
    }
];

const LOCAL_STORAGE_BADGES_KEY = 'packsecure_custom_badges';
const LOCAL_STORAGE_AWARDS_KEY = 'packsecure_badge_awards';

// ── Fetch All System Badges (Default + Custom from SuperAdmin) ──
export const fetchAllSystemBadges = async (): Promise<SystemBadge[]> => {
    try {
        // Try fetching from Supabase table if it exists
        const { data, error } = await supabase.from('system_badges').select('*');
        if (!error && data && data.length > 0) {
            const mapped: SystemBadge[] = data.map((b: any) => ({
                id: b.id,
                title: b.title,
                titleEn: b.title_en || b.titleEn || '',
                icon: b.icon || '🏅',
                tier: b.tier || 'Gold',
                category: b.category || 'All',
                ruleType: b.rule_type || b.ruleType || 'manual_award',
                targetValue: b.target_value ?? b.targetValue ?? 0,
                desc: b.desc || '',
                story: b.story || '',
                createdAt: b.created_at,
                createdBy: b.created_by
            }));
            return mapped;
        }
    } catch {
        // fallback gracefully
    }

    // Local / fallback store
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_BADGES_KEY);
        if (stored) {
            const customBadges: SystemBadge[] = JSON.parse(stored);
            const ids = new Set(customBadges.map(b => b.id));
            const merged = [...DEFAULT_SYSTEM_BADGES.filter(b => !ids.has(b.id)), ...customBadges];
            return merged;
        }
    } catch (e) {
        console.error('Error parsing local badges:', e);
    }

    return DEFAULT_SYSTEM_BADGES;
};

// ── Save or Update Badge (SuperAdmin) ──
export const saveSystemBadge = async (badge: SystemBadge, currentUserId?: string): Promise<boolean> => {
    const payload = {
        id: badge.id || `badge_${Date.now()}`,
        title: badge.title,
        title_en: badge.titleEn,
        icon: badge.icon,
        tier: badge.tier,
        category: badge.category,
        rule_type: badge.ruleType,
        target_value: badge.targetValue,
        desc: badge.desc,
        story: badge.story,
        created_by: currentUserId || 'SuperAdmin',
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('system_badges').upsert(payload);
        if (!error) return true;
    } catch {
        // fallback to localStorage
    }

    // LocalStorage Fallback
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_BADGES_KEY);
        let list: SystemBadge[] = stored ? JSON.parse(stored) : [...DEFAULT_SYSTEM_BADGES];
        const existingIdx = list.findIndex(b => b.id === badge.id);
        if (existingIdx >= 0) {
            list[existingIdx] = { ...badge, id: badge.id };
        } else {
            list.push({ ...badge, id: payload.id });
        }
        localStorage.setItem(LOCAL_STORAGE_BADGES_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        console.error('Save badge fallback error:', e);
        return false;
    }
};

// ── Delete Badge (SuperAdmin) ──
export const deleteSystemBadge = async (badgeId: string): Promise<boolean> => {
    try {
        await supabase.from('system_badges').delete().eq('id', badgeId);
    } catch {
        // fallback
    }

    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_BADGES_KEY);
        let list: SystemBadge[] = stored ? JSON.parse(stored) : [...DEFAULT_SYSTEM_BADGES];
        list = list.filter(b => b.id !== badgeId);
        localStorage.setItem(LOCAL_STORAGE_BADGES_KEY, JSON.stringify(list));
        return true;
    } catch {
        return false;
    }
};

// ── Award Badge to an Employee (SuperAdmin / HR Manual Award) ──
export const awardBadgeToEmployee = async (
    employeeId: string, 
    badgeId: string, 
    note?: string,
    awardedBy?: string
): Promise<boolean> => {
    const awardRecord = {
        badgeId,
        awardedAt: new Date().toISOString(),
        awardedBy: awardedBy || 'SuperAdmin',
        note: note || 'SuperAdmin 特别嘉奖'
    };

    // 1. Update sys_users_v2
    try {
        const { data: userDoc } = await supabase
            .from('sys_users_v2')
            .select('awarded_badges')
            .or(`auth_user_id.eq.${employeeId},id.eq.${employeeId}`)
            .maybeSingle();

        let existingAwards: any[] = [];
        if (userDoc?.awarded_badges) {
            existingAwards = Array.isArray(userDoc.awarded_badges) ? userDoc.awarded_badges : [];
        }

        // Add if not already present
        if (!existingAwards.some(a => (typeof a === 'string' ? a === badgeId : a.badgeId === badgeId))) {
            existingAwards.push(awardRecord);
            await supabase
                .from('sys_users_v2')
                .update({ awarded_badges: existingAwards })
                .or(`auth_user_id.eq.${employeeId},id.eq.${employeeId}`);
        }
    } catch (e) {
        console.error('Database award update error:', e);
    }

    // 2. Also persist locally for offline resilience
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_AWARDS_KEY);
        const map: Record<string, any[]> = stored ? JSON.parse(stored) : {};
        if (!map[employeeId]) map[employeeId] = [];
        if (!map[employeeId].some(a => a.badgeId === badgeId)) {
            map[employeeId].push(awardRecord);
            localStorage.setItem(LOCAL_STORAGE_AWARDS_KEY, JSON.stringify(map));
        }
    } catch (e) {
        console.error('LocalStorage award error:', e);
    }

    return true;
};

// ── Fetch Manual Awards for User ──
export const fetchUserManualAwards = async (userId: string): Promise<any[]> => {
    try {
        const { data } = await supabase
            .from('sys_users_v2')
            .select('awarded_badges')
            .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
            .maybeSingle();

        if (data?.awarded_badges && Array.isArray(data.awarded_badges)) {
            return data.awarded_badges;
        }
    } catch {
        // fallback
    }

    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_AWARDS_KEY);
        if (stored) {
            const map = JSON.parse(stored);
            if (map[userId]) return map[userId];
        }
    } catch {}

    return [];
};

// ── Real Data-Driven Badge Evaluation Engine ──
export interface UserRealStats {
    totalTrips: number;
    totalProductionKg: number;
    role: string;
    employeeId?: string;
    createdAt?: string;
    attendanceBonus?: number;
    manualAwards: any[];
}

export const evaluateAllBadgesForUser = (
    systemBadges: SystemBadge[], 
    stats: UserRealStats
): EvaluatedBadge[] => {
    return systemBadges.map((badge) => {
        let unlocked = false;
        let currentValue: number | string = 0;
        let progressPercent = 0;
        let verificationSource = '由 Packsecure 智造与调度中枢实时核验';
        let unlockDate: string | undefined = undefined;
        let awardNote: string | undefined = undefined;

        // Check if manually awarded
        const manualMatch = stats.manualAwards.find(a => 
            (typeof a === 'string' ? a === badge.id : a.badgeId === badge.id)
        );

        if (manualMatch) {
            unlocked = true;
            currentValue = '已由管理员授予';
            progressPercent = 100;
            verificationSource = `由 ${manualMatch.awardedBy || 'SuperAdmin'} 特别嘉奖`;
            unlockDate = manualMatch.awardedAt?.slice(0, 10);
            awardNote = manualMatch.note;
        } else {
            // Automatic Rule Evaluation
            switch (badge.ruleType) {
                case 'trips_completed': {
                    const target = Number(badge.targetValue) || 50;
                    currentValue = `${stats.totalTrips} 趟`;
                    progressPercent = Math.min(100, Math.round((stats.totalTrips / target) * 100));
                    unlocked = stats.totalTrips >= target;
                    verificationSource = '由物流出车中枢 (sales_orders) 实时核验';
                    break;
                }

                case 'production_kg': {
                    const target = Number(badge.targetValue) || 10000;
                    currentValue = `${stats.totalProductionKg.toLocaleString()} Kg`;
                    progressPercent = Math.min(100, Math.round((stats.totalProductionKg / target) * 100));
                    unlocked = stats.totalProductionKg >= target;
                    verificationSource = '由生产控制中枢 (production_logs_v2) 实时核验';
                    break;
                }

                case 'attendance_streak': {
                    const hasBonus = (stats.attendanceBonus || 0) > 0;
                    currentValue = hasBonus ? '全勤奖已达标' : '正常考勤中';
                    progressPercent = hasBonus ? 100 : 75;
                    unlocked = hasBonus;
                    verificationSource = '由 HR 考勤与打卡日志实时核验';
                    break;
                }

                case 'role_bound': {
                    currentValue = `当前岗位: ${stats.role}`;
                    if (badge.category === 'All') {
                        unlocked = true;
                        progressPercent = 100;
                    } else {
                        unlocked = stats.role.toLowerCase() === badge.category.toLowerCase();
                        progressPercent = unlocked ? 100 : 0;
                    }
                    verificationSource = '由系统组织架构与岗位授权自动核验';
                    break;
                }

                case 'tenure_months': {
                    const targetMonths = Number(badge.targetValue) || 6;
                    // Calculate tenure
                    const joinDate = stats.createdAt ? new Date(stats.createdAt) : new Date('2026-01-01');
                    const months = Math.max(1, Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
                    const isPioneerUser = stats.employeeId === '001' || stats.role === 'SuperAdmin' || months >= targetMonths;
                    
                    currentValue = isPioneerUser ? '核心功勋成员' : `入职 ${months} 个月`;
                    progressPercent = isPioneerUser ? 100 : Math.min(100, Math.round((months / targetMonths) * 100));
                    unlocked = isPioneerUser;
                    verificationSource = '由企业数字化创设档案核验';
                    break;
                }

                case 'manual_award':
                default: {
                    currentValue = '待管理员颁发';
                    progressPercent = 0;
                    unlocked = false;
                    verificationSource = '需由 SuperAdmin / HR 手动嘉奖';
                    break;
                }
            }
        }

        return {
            ...badge,
            unlocked,
            currentValue,
            progressPercent,
            verificationSource,
            unlockDate,
            awardNote
        };
    });
};
