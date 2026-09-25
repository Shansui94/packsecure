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

export const CANONICAL_DRIVER_PRICING_MD = `# Packsecure 司机运费与送货价格真理库 (Driver Pricing Rulebook)
**版本 / Version**: \`v1.0.0\` ｜ **更新日期 / Date**: \`2026-09-25\` ｜ **审核人 / Owner**: \`HR & Logistics\` ｜ **状态 / Status**: \`Active\`

> **说明 (Instruction)**: 本文档是 Packsecure 司机送货价格计算的核心业务真理。AI 运费核算引擎与 HR 审核工作台均以此规则为最高依据。任何管理人员或 HR 均可在前端在线修改并一键发布新版本。

---

## 1. 核心计费公式与基本原则 (Fundamental Rules)
1. **单趟行程计费 (Per-Trip Basis)**：
   $$\\text{Trip Earnings} = \\text{Base Rate (基准运费)} + \\max(0, \\text{Drops} - \\text{Max Places}) \\times \\text{Extra Rate Per Place (超点补贴)} + \\text{特殊补贴}$$
2. **多单合并一趟 (Trip Grouping)**：
   同一名司机在同一天送往相同或顺路方向的多张销售订单 (DO)，统一视为同一趟行程 (Trip) 进行运费核算，不重复发放多份基础运费。
3. **出发地基准 (Origin Hub)**：
   默认出发地为 **太平总厂 (TAIPING / OPM Lama)**。若系统或单据明确注明从汝来 (NILAI)、吉兰丹 (KELANTAN) 或柔佛 (JOHOR) 发车，按对应出发地规则结算。
4. **车型费率差异 (Vehicle Adaptation)**：
   - 标准罗里基准容量为 82 卷。
   - 特殊车辆 **\`VPC 9821\`** 为 65 卷轻卡，在特定短途或拥挤区域若规则注明 VPC 特殊价，优先适用 VPC 费率。
   - 特殊车辆 **\`APH 9821\`** 为 92 卷重卡。
5. **系统安全保底与封顶熔断 (Safety Guardrails)**：
   - 任何已确认送达的正常出车单趟，总运费**最低不得低于 RM 40.00**（太平本地保底价）。
   - 西马境内常规单趟总运费**最高不得超过 RM 650.00**。若计算超过该值，系统必须拦截并提示 HR 强制人工双人复核。

---

## 2. 太平厂起运 (TAIPING Origin) 阶梯基准价目表

### 2.1 霹雳州本地与近郊 (Perak Local & Regional)
| 目的地区域 / 常见地名关键词 (Zone / Town) | 标准基准价 (Base) | 免费落点数 (Max Places) | 超点补贴/点 (Extra Drop) | 常见涵盖地点举例 |
| :--- | :--- | :--- | :--- | :--- |
| **TAIPING 本地 (Taiping Local)** | **RM 40** | 1 点 | +RM 10 / 点 | Kamunting, Simpang, Aulong, Pokok Assam, Matang |
| **IPOH / 怡保与近郊** | **RM 80** | 3 点 | +RM 5 / 点 | Menglembu, Bercham, Jelapang, Chemor, Lahat, Batu Gajah |
| **SITIAWAN / 实兆远与沿海** | **RM 80** | 3 点 | +RM 5 / 点 | Sitiawan, Seri Manjung, Lumut, Ayer Tawar, Pantai Remis |
| **KUALA KANGSAR / 江沙** | **RM 60** | 3 点 | +RM 5 / 点 | Kuala Kangsar, Padang Rengas, Sungai Siput |
| **TELUK INTAN / 安顺** | **RM 100** | 3 点 | +RM 5 / 点 | Teluk Intan, Hutan Melintang, Langkap |
| **TANJUNG MALIM / 丹绒马林** | **RM 100** | 3 点 | +RM 5 / 点 | Tanjung Malim, Sungkai, Bidor, Tapah, Kampar |

### 2.2 槟城与威省 (Penang Island & Seberang Perai)
| 目的地区域 / 常见地名关键词 (Zone / Town) | 标准基准价 (Base) | 免费落点数 (Max Places) | 超点补贴/点 (Extra Drop) | 常见涵盖地点举例 |
| :--- | :--- | :--- | :--- | :--- |
| **SIMPANG AMPAT / 威南** | **RM 80** | 3 点 | +RM 5 / 点 | Simpang Ampat, Batu Kawan, Valdor, Jawi, Nibong Tebal |
| **BUKIT MERTAJAM (BM) / 威中** | **RM 80** | 3 点 | +RM 5 / 点 | Bukit Mertajam, Bukit Minyak, Alma, Juru, Permatang Pauh |
| **BUTTERWORTH / 威北** | **RM 80** | 3 点 | +RM 5 / 点 | Butterworth, Bagan, Mak Mandin, Kepala Batas |
| **PENANG ISLAND / 槟岛岛内** | **RM 80** | 3 点 | +RM 5 / 点 | Bayan Lepas, George Town, Jelutong, Air Itam, Batu Maung |

### 2.3 吉打与玻璃市 (Kedah & Perlis - 北马长途)
| 目的地区域 / 常见地名关键词 (Zone / Town) | 标准基准价 (Base) | 免费落点数 (Max Places) | 超点补贴/点 (Extra Drop) | 常见涵盖地点举例 |
| :--- | :--- | :--- | :--- | :--- |
| **KULIM / 居林** | **RM 80** | 3 点 | +RM 5 / 点 | Kulim Town, Kulim Hi-Tech Park, Lunas, Padang Serai |
| **SUNGAI PETANI / 双溪大年** | **RM 100** | 3 点 | +RM 5 / 点 | Sungai Petani, Bakar Arang, Tikam Batu |
| **BEDONG / PENDANG / 本同** | **RM 100** | 3 点 | +RM 5 / 点 | Bedong, Gurun, Pendang, Simpang Empat (Kedah) |
| **ALOR SETAR / 亚罗士打** | **RM 150** | 3 点 | +RM 5 / 点 | Alor Setar, Mergong, Anak Bukit, Pokok Sena |
| **JITRA / 日得拉** | **RM 150** | 3 点 | +RM 5 / 点 | Jitra, Bukit Kayu Hitam, Changlun, Kodiang |
| **BALING / SIK / 华玲锡区** | **RM 150** | 3 点 | +RM 5 / 点 | Baling, Sik, Kuala Ketil |
| **PERLIS / 玻璃市全境** | **RM 165** | 3 点 | +RM 5 / 点 | Kangar, Arau, Kuala Perlis, Padang Besar |

### 2.4 中马与南马 (Central & Southern Hubs)
| 目的地区域 / 常见地名关键词 (Zone / Town) | 标准基准价 (Base) | 免费落点数 (Max Places) | 超点补贴/点 (Extra Drop) | 常见涵盖地点举例 |
| :--- | :--- | :--- | :--- | :--- |
| **KUALA LUMPUR (KL) / 吉隆坡** | **RM 250** | 0 点 | +RM 20 / 点 | KL, Setapak, Wangsa Maju, Kepong, Cheras, Kepong |
| **SELANGOR / 雪兰莪各区** | **RM 280** | 2 点 | +RM 20 / 点 | Shah Alam, Klang, Subang Jaya, Puchong, Kajang, Rawang |
| **NEGERI SEMBILAN / 森美兰** | **RM 400** | 3 点 | +RM 15 / 点 | Nilai, Seremban, Senawang, Port Dickson |
| **MELAKA / 马六甲** | **RM 450** | 3 点 | +RM 20 / 点 | Melaka Tengah, Alor Gajah, Ayer Keroh, Jasin |
| **JOHOR / 柔佛** | **RM 550** | 3 点 | +RM 25 / 点 | Johor Bahru, Skudai, Kulai, Batu Pahat, Muar |

### 2.5 东海岸 (East Coast)
| 目的地区域 / 常见地名关键词 (Zone / Town) | 标准基准价 (Base) | 免费落点数 (Max Places) | 超点补贴/点 (Extra Drop) | 常见涵盖地点举例 |
| :--- | :--- | :--- | :--- | :--- |
| **KELANTAN / 吉兰丹全境** | **RM 380** | 3 点 | +RM 15 / 点 | Kota Bharu, Pasir Mas, Tanah Merah, Machang, Gua Musang |
| **BESUT / 勿述** | **RM 430** | 3 点 | +RM 15 / 点 | Besut, Jerteh, Kuala Besut |
| **TERENGGANU / 登嘉楼市区** | **RM 480** | 3 点 | +RM 15 / 点 | Kuala Terengganu, Marang, Dungun, Kemaman |
| **PAHANG / 彭亨** | **RM 400** | 3 点 | +RM 20 / 点 | Kuantan, Temerloh, Bentong, Mentakab |

---

## 3. 现场特殊作业与司机额外任务补贴 (Extra Allowances)
司机在出车送货之外完成的现场支援任务，经照片存证与 HR 审核后计入当月工资：
1. 🛍️ **\`SHOPEE / SPD\` 散单送件**：**RM 20.00** / 趟
2. 🚚 **\`TAIPING TRIP\` 厂区驳运**：**RM 7.00** / 趟
3. 🪵 **\`AMBIK PALLET\` 搬运托盘**：**RM 10.00** / 趟
4. 🔧 **\`LORRY SERVICE\` 送修验车**：**RM 15.00** / 趟
5. ↩️ **\`RETURN\` 客户退货调拨**：由 Admin / Manager 根据路程特批 (RM 20.00 ~ RM 50.00)

---

## 4. 常见地名消歧与归属判定准则 (Ambiguity Resolution Rules)
- **Menglembu / 万里望**：属于霹雳怡保近郊，按 **IPOH (RM 80)** 结算。
- **Batu Kawan / 峇都交湾**：属于槟城威南，按 **SIMPANG AMPAT (RM 80)** 结算。
- **Bukit Minyak / 武吉敏惹**：属于槟城威中，按 **BUKIT MERTAJAM (RM 80)** 结算。
- **Nilai 3 / 汝来 3 工业区**：属于森美兰，按 **NEGERI SEMBILAN (RM 400)** 结算。
- **Rawang / 煤炭山**：属于雪兰莪，按 **SELANGOR (RM 280)** 结算。
- 若单据填写了多个不相邻城镇（如“Pokok Sena x 2, Sungai Petani, Bukit Mertajam”），以**最远核心目的地**作为 Base Rate（此例中最远为 Pokok Sena / Alor Setar 区域 RM 150），其余经停点按超点补贴计算。
`;

const API_BASE = '/api/agent';

/**
 * 获取当前生产环境生效的 Markdown 规则
 */
export async function fetchActiveRulebook(): Promise<{ content: string; version: string; id?: string }> {
    try {
        const res = await fetch(`${API_BASE}/calc-driver-rate?mode=get-active-rulebook`);
        if (res.ok) {
            const data = await res.json();
            if (data.content && data.content.trim()) {
                return {
                    content: data.content,
                    version: data.version || 'v1.0.0',
                    id: data.id
                };
            }
        }
    } catch (e) {
        console.warn('fetchActiveRulebook network error, using canonical fallback:', e);
    }
    return {
        content: CANONICAL_DRIVER_PRICING_MD,
        version: 'v1.0.0-canonical'
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
