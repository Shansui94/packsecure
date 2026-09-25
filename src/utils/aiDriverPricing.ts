import { supabase } from '../services/supabase';

export type DiscrepancyLevel = 'AUTO_MATCH' | 'AI_ENRICHED' | 'MINOR_DRIFT' | 'HIGH_DISCREPANCY';
export type AuditStatus = 'PENDING' | 'APPROVED' | 'ADJUSTED';

export interface PricingRulebook {
    id: string;
    version: string;
    title: string;
    content_md: string;
    is_active: boolean;
    changelog?: string;
    created_by?: string;
    created_at?: string;
}

export interface TripRateAudit {
    id?: string;
    trip_id: string;
    trip_number?: string;
    driver_id?: string;
    driver_name?: string;
    lorry_plate?: string;
    origin?: string;
    delivery_addresses?: string[];
    raw_address_summary?: string;
    drop_count?: number;
    legacy_rate: number;
    ai_rate: number;
    diff_amount: number;
    standardized_location?: string;
    ai_zone?: string;
    rule_citations?: string[];
    confidence_score?: number;
    ai_reasoning?: string;
    discrepancy_level: DiscrepancyLevel;
    audit_status: AuditStatus;
    approved_amount?: number | null;
    hr_note?: string;
    reviewed_by?: string;
    reviewed_at?: string;
    stage?: 'PRE_DISPATCH' | 'POST_DELIVERY';
    created_at?: string;
    order_ids?: string[];
}

export interface SandboxResult {
    success: boolean;
    origin: string;
    lorryPlate: string;
    testAddress: string;
    dropCount: number;
    legacy_rate: number;
    ai_rate: number;
    diff_amount: number;
    discrepancy_level: DiscrepancyLevel;
    is_extreme_blocked?: boolean;
    standardized_location: string;
    ai_zone: string;
    base_rate: number;
    extra_drops_rate: number;
    special_surcharge: number;
    rule_citations: string[];
    confidence_score: number;
    reasoning: string;
}

export interface BacktestComparisonItem {
    order_number: string;
    customer: string;
    address: string;
    legacy_rate: number;
    ai_rate: number;
    diff_amount: number;
    level: DiscrepancyLevel;
    reasoning: string;
    citations?: string[];
}

export interface BacktestReport {
    success: boolean;
    totalTested: number;
    legacyTotal: number;
    aiTotal: number;
    netDiff: number;
    netDiffPercent: string;
    matchCount: number;
    enrichedCount: number;
    driftCount: number;
    discrepancyCount: number;
    comparisons: BacktestComparisonItem[];
}

export interface RulePatchSuggestion {
    title: string;
    targetSection?: string;
    markdownPatch: string;
    explanation?: string;
}

const API_BASE = '/api/agent';

/**
 * 获取当前生产环境生效的 Markdown 规则
 */
export async function fetchActiveRulebook(): Promise<{ content: string; version: string; id?: string }> {
    try {
        const res = await fetch(`${API_BASE}/calc-driver-rate?mode=get-active-rulebook`);
        if (res.ok) {
            const data = await res.json();
            return {
                content: data.content || '',
                version: data.version || 'v1.0.0',
                id: data.id
            };
        }
    } catch (e) {
        console.warn('fetchActiveRulebook network error:', e);
    }
    return {
        content: '# 运费规则加载中...',
        version: 'v1.0.0-fallback'
    };
}

/**
 * 获取规则历史版本列表
 */
export async function fetchRulebookHistory(): Promise<PricingRulebook[]> {
    try {
        const res = await fetch(`${API_BASE}/calc-driver-rate?mode=list-rulebooks`);
        if (res.ok) {
            const data = await res.json();
            return data.rulebooks || [];
        }
    } catch (e) {
        console.warn('fetchRulebookHistory network error:', e);
    }
    return [];
}

/**
 * 发布新版本规则
 */
export async function saveNewRulebook(params: {
    content_md: string;
    changelog: string;
    created_by?: string;
}): Promise<{ success: boolean; rulebook?: PricingRulebook; message?: string }> {
    const res = await fetch(`${API_BASE}/calc-driver-rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'save-rulebook',
            ...params
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to publish new rulebook version');
    }
    return await res.json();
}

/**
 * 执行沙盒单地址测试
 */
export async function runSandboxTest(params: {
    testAddress: string;
    origin?: string;
    lorryPlate?: string;
    dropCount?: number;
    rulebookMd?: string;
}): Promise<SandboxResult> {
    const res = await fetch(`${API_BASE}/calc-driver-rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'sandbox',
            ...params
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Sandbox test failed');
    }
    return await res.json();
}

/**
 * 执行历史 50 单批次回测
 */
export async function runHistoricalBacktest(params: {
    rulebookMd?: string;
    limit?: number;
}): Promise<BacktestReport> {
    const res = await fetch(`${API_BASE}/calc-driver-rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'backtest',
            ...params
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Backtest execution failed');
    }
    return await res.json();
}

/**
 * 计算单趟车次运费 (事前排单或事后核销)
 */
export async function calculateTripRate(params: {
    tripId?: string;
    tripNumber?: string;
    driverId?: string;
    driverName?: string;
    lorryPlate?: string;
    origin?: string;
    deliveryAddresses: string[];
    dropCount?: number;
    stage?: 'PRE_DISPATCH' | 'POST_DELIVERY';
    saveAudit?: boolean;
    orderIds?: string[];
}): Promise<TripRateAudit> {
    const res = await fetch(`${API_BASE}/calc-driver-rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'single',
            ...params
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Trip rate calculation failed');
    }
    return await res.json();
}

/**
 * 记录 HR 纠错案例
 */
export async function recordHrCorrection(params: {
    audit_id?: string;
    trip_id?: string;
    address_text: string;
    lorry_plate?: string;
    ai_rate: number;
    hr_rate: number;
    diff_reason: string;
    reviewed_by?: string;
}): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/suggest-rule-patch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'record-correction',
                ...params
            })
        });
        return res.ok;
    } catch (e) {
        console.warn('recordHrCorrection error:', e);
        return false;
    }
}

/**
 * 获取 AI 提炼的规则补丁建议
 */
export async function fetchRulePatchSuggestions(): Promise<{
    hasSuggestions: boolean;
    summary?: string;
    suggestions: RulePatchSuggestion[];
    unabsorbedCount?: number;
}> {
    try {
        const res = await fetch(`${API_BASE}/suggest-rule-patch?action=suggest`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('fetchRulePatchSuggestions error:', e);
    }
    return {
        hasSuggestions: false,
        suggestions: []
    };
}

/**
 * 安全平滑地将 HR 确认价格回写至 sales_orders 的 notes 字段中的 [APPROVED_AMOUNT: xxx]
 * 确保 PersonalMonthlyReport.tsx 和既有系统 100% 稳定读取！
 */
export async function syncApprovedAmountToOrderNotes(
    orderId: string,
    existingNotes: string | null | undefined,
    approvedAmount: number
): Promise<boolean> {
    try {
        const current = existingNotes || '';
        // Remove existing tag if present, then append cleanly
        const cleanNotes = current.replace(/\[APPROVED_AMOUNT:\s*[\d.]+\]/gi, '').trim();
        const finalNotes = `${cleanNotes}${cleanNotes ? ' ' : ''}[APPROVED_AMOUNT: ${Number(approvedAmount).toFixed(2)}]`.trim();

        const { error } = await supabase
            .from('sales_orders')
            .update({ notes: finalNotes })
            .eq('id', orderId);

        return !error;
    } catch (e) {
        console.error('syncApprovedAmountToOrderNotes error:', e);
        return false;
    }
}

/**
 * 获取红绿灯状态视觉徽章配置
 */
export function getDiscrepancyBadge(level: DiscrepancyLevel) {
    switch (level) {
        case 'AUTO_MATCH':
            return {
                label: '完全一致',
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                dot: 'bg-emerald-500',
                icon: '✅',
                desc: '原系统与 AI 计算金额完全吻合，可一键批量通过'
            };
        case 'AI_ENRICHED':
            return {
                label: 'AI 智能补全',
                bg: 'bg-amber-50 text-amber-700 border-amber-200',
                dot: 'bg-amber-500',
                icon: '⭐',
                desc: '老系统未匹配到地名（跌落底价），AI 成功识别具体工业区'
            };
        case 'MINOR_DRIFT':
            return {
                label: '轻度差异',
                bg: 'bg-blue-50 text-blue-700 border-blue-200',
                dot: 'bg-blue-500',
                icon: 'ℹ️',
                desc: '金额差异在合理微调区间内 (通常由于车型或落点阶梯计算)'
            };
        case 'HIGH_DISCREPANCY':
        default:
            return {
                label: '重点复核',
                bg: 'bg-rose-50 text-rose-700 border-rose-200',
                dot: 'bg-rose-500',
                icon: '🚨',
                desc: '金额偏差 > RM25 或触发系统熔断限制，需 HR 强制人工审查'
            };
    }
}
