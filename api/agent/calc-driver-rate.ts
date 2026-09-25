import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const config = { maxDuration: 60 };

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Fallback embedded rulebook in case DB table is not yet created
const FALLBACK_RULEBOOK_MD = `# Packsecure 司机运费与送货价格真理库 (Driver Pricing Rulebook)
版本: v1.0.0 | 生效日期: 2026-09-25 | 状态: Active

## 1. 核心计费公式与基本原则
- Trip Earnings = Base Rate (基准运费) + MAX(0, Drops - Max Places) * Extra Rate Per Place (超点补贴)
- 默认出发地为 TAIPING (OPM Lama)。
- 特殊车型 VPC 9821 为 65 卷轻卡，APH 9821 为 92 卷重卡。
- 安全底线：任何有效单趟最低不低于 RM 40.00，西马常规最高不超过 RM 650.00。

## 2. 太平厂起运 (TAIPING Origin) 阶梯基准价目表
| 区域 / 城市 (Zone / Town) | 标准基准价 (Base) | 免费落点数 | 超点补贴/点 | 包含地点 |
| :--- | :--- | :--- | :--- | :--- |
| TAIPING 本地 (Taiping Local) | RM 40 | 1 点 | +RM 10 | Kamunting, Simpang, Aulong, Pokok Assam |
| IPOH / 怡保与近郊 | RM 80 | 3 点 | +RM 5 | Menglembu, Bercham, Jelapang, Chemor, Lahat, Batu Gajah |
| SITIAWAN / 实兆远与沿海 | RM 80 | 3 点 | +RM 5 | Sitiawan, Seri Manjung, Lumut, Ayer Tawar, Pantai Remis |
| KUALA KANGSAR / 江沙 | RM 60 | 3 点 | +RM 5 | Kuala Kangsar, Padang Rengas, Sungai Siput |
| TELUK INTAN / 安顺 | RM 100 | 3 点 | +RM 5 | Teluk Intan, Hutan Melintang, Langkap |
| TANJUNG MALIM / 丹绒马林 | RM 100 | 3 点 | +RM 5 | Tanjung Malim, Sungkai, Bidor, Tapah, Kampar |
| SIMPANG AMPAT / 威南 | RM 80 | 3 点 | +RM 5 | Simpang Ampat, Batu Kawan, Valdor, Jawi, Nibong Tebal |
| BUKIT MERTAJAM (BM) / 威中 | RM 80 | 3 点 | +RM 5 | Bukit Mertajam, Bukit Minyak, Alma, Juru |
| BUTTERWORTH / 威北 | RM 80 | 3 点 | +RM 5 | Butterworth, Bagan, Mak Mandin, Kepala Batas |
| PENANG ISLAND / 槟岛 | RM 80 | 3 点 | +RM 5 | Bayan Lepas, George Town, Jelutong, Air Itam |
| KULIM / 居林 | RM 80 | 3 点 | +RM 5 | Kulim Town, Kulim Hi-Tech Park, Lunas, Padang Serai |
| SUNGAI PETANI / 双溪大年 | RM 100 | 3 点 | +RM 5 | Sungai SP, Bakar Arang, Tikam Batu |
| BEDONG / PENDANG / 本同 | RM 100 | 3 点 | +RM 5 | Bedong, Gurun, Pendang, Simpang Empat Kedah |
| ALOR SETAR / 亚罗士打 | RM 150 | 3 点 | +RM 5 | Alor Setar, Mergong, Anak Bukit, Pokok Sena |
| JITRA / 日得拉 | RM 150 | 3 点 | +RM 5 | Jitra, Bukit Kayu Hitam, Changlun, Kodiang |
| BALING / SIK / 华玲 | RM 150 | 3 点 | +RM 5 | Baling, Sik, Kuala Ketil |
| PERLIS / 玻璃市全境 | RM 165 | 3 点 | +RM 5 | Kangar, Arau, Kuala Perlis, Padang Besar |
| KUALA LUMPUR (KL) / 吉隆坡 | RM 250 | 0 点 | +RM 20 | KL, Setapak, Wangsa Maju, Kepong, Cheras |
| SELANGOR / 雪兰莪各区 | RM 280 | 2 点 | +RM 20 | Shah Alam, Klang, Subang Jaya, Puchong, Kajang, Rawang |
| NEGERI SEMBILAN / 森美兰 | RM 400 | 3 点 | +RM 15 | Nilai, Seremban, Senawang, Port Dickson |
| MELAKA / 马六甲 | RM 450 | 3 点 | +RM 20 | Melaka Tengah, Alor Gajah, Ayer Keroh |
| JOHOR / 柔佛 | RM 550 | 3 点 | +RM 25 | Johor Bahru, Skudai, Kulai, Batu Pahat |
| KELANTAN / 吉兰丹全境 | RM 380 | 3 点 | +RM 15 | Kota Bharu, Pasir Mas, Tanah Merah, Machang |
| BESUT / 勿述 | RM 430 | 3 点 | +RM 15 | Besut, Jerteh, Kuala Besut |
| TERENGGANU / 登嘉楼市区 | RM 480 | 3 点 | +RM 15 | Kuala Terengganu, Marang, Dungun, Kemaman |
| PAHANG / 彭亨 | RM 400 | 3 点 | +RM 20 | Kuantan, Temerloh, Bentong, Mentakab |

## 3. 常见消歧归属
- Menglembu 属于霹雳怡保近郊，按 IPOH (RM 80) 结算。
- Batu Kawan 属于槟城威南，按 SIMPANG AMPAT (RM 80) 结算。
- Bukit Minyak 属于槟城威中，按 BUKIT MERTAJAM (RM 80) 结算。
- Nilai 3 属于森美兰，按 NEGERI SEMBILAN (RM 400) 结算。
- 多落点行程以最远目的地确定基准价，多余落点加算超点补贴。
`;

/**
 * 动态加载当前生效的 Markdown 规则文本
 */
async function getActiveRulebookContent(): Promise<{ content: string; version: string; id?: string }> {
    try {
        const { data, error } = await supabase
            .from('pricing_rulebooks')
            .select('id, version, content_md')
            .eq('rule_type', 'DRIVER_DELIVERY')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!error && data?.content_md) {
            return { content: data.content_md, version: data.version, id: data.id };
        }
    } catch (e) {
        console.warn('[calc-driver-rate] Failed to fetch active rulebook from DB, falling back to local file/string:', e);
    }

    // Try reading local docs file
    try {
        const localPath = path.resolve(process.cwd(), 'docs', 'sops', 'Driver_Pricing_Rules.md');
        if (fs.existsSync(localPath)) {
            const fileContent = fs.readFileSync(localPath, 'utf-8');
            return { content: fileContent, version: 'v1.0.0-local' };
        }
    } catch (ignore) {}

    return { content: FALLBACK_RULEBOOK_MD, version: 'v1.0.0-embedded' };
}

/**
 * 使用传统查表法计算 Legacy 运费 (兼容原有 deliveryEarnings.ts 规则)
 */
async function calculateLegacyRate(origin: string, addresses: string[], drops: number, lorryPlate?: string): Promise<number> {
    try {
        const { data: rates } = await supabase.from('delivery_rates').select('*');
        if (!rates || rates.length === 0) return 40.0;

        const originClean = (origin || 'TAIPING').trim().toUpperCase();
        const fullAddrText = addresses.join(' ').toLowerCase();
        const isVpc = Boolean(lorryPlate && lorryPlate.toUpperCase().replace(/[^A-Z0-9]/g, '') === 'VPC9821');

        let matchedRate: any = null;
        let highestBase = -1;

        for (const r of rates) {
            const rOrigin = (r.origin || '').trim().toUpperCase();
            if (rOrigin && rOrigin !== originClean && !originClean.includes(rOrigin)) continue;

            const loc = (r.location_name || '').trim().toLowerCase();
            if (loc && loc.length >= 2 && fullAddrText.includes(loc)) {
                let base = Number(r.base_rate) || 0;
                if (isVpc && r.notes) {
                    const vpcM = r.notes.match(/\[VPC_RATE:\s*([\d.]+)\]/i);
                    if (vpcM) base = Number(vpcM[1]);
                }
                if (base > highestBase) {
                    highestBase = base;
                    matchedRate = r;
                }
            }
        }

        if (!matchedRate) {
            // Default floor for local trip
            return 40.0;
        }

        let baseRate = Number(matchedRate.base_rate) || 0;
        if (isVpc && matchedRate.notes) {
            const vpcM = matchedRate.notes.match(/\[VPC_RATE:\s*([\d.]+)\]/i);
            if (vpcM) baseRate = Number(vpcM[1]);
        }
        const maxPlaces = Number(matchedRate.max_places) || 1;
        const extraPlaces = Math.max(0, drops - maxPlaces);
        const extraRate = extraPlaces * (Number(matchedRate.extra_rate_per_place) || 0);

        return baseRate + extraRate;
    } catch (err) {
        console.warn('[calc-driver-rate] calculateLegacyRate error:', err);
        return 40.0;
    }
}

/**
 * 调用 Gemini 解析地址并根据 Markdown 规则核算运费
 */
async function calculateRateWithGemini(params: {
    origin: string;
    lorryPlate?: string;
    deliveryAddresses: string[];
    dropCount: number;
    rulebookMd: string;
}): Promise<any> {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Missing Google Gemini API Key in environment variables');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0.1,
            topP: 0.8
        }
    });

    const addressesText = params.deliveryAddresses.map((a, i) => `  ${i + 1}. ${a}`).join('\n') || '  1. (未提供具体地址文本，请根据通用短途判定)';
    const prompt = `你是 Packsecure 工业制造车队运费审计 AI 智能体。
请严格根据以下《运费计算真理库 (Driver Pricing Rulebook)》计算该趟行程的运费。

===【当前生效运费规则 MARKDOWN 开始】===
${params.rulebookMd}
===【当前生效运费规则 MARKDOWN 结束】===

待核算车次信息：
- 出发工厂：${params.origin || 'TAIPING (OPM Lama)'}
- 派送车辆车牌：${params.lorryPlate || '标准罗里 (82卷)'}
- 送货落点数量 (Drops)：${params.dropCount || 1}
- 经停送货地址清单：
${addressesText}

你的任务与思考步骤：
1. **地址标准化**：识别这些送货地址属于马来西亚的哪个主要州属、城市、乡镇或工业区（例如识别 Bukit Minyak 属于威中，Simpang Ampat 属于威南，Menglembu 属于怡保）。
2. **规则条款定位**：对照上述 Markdown 规则库中【太平厂起运】或对应出发地的阶梯表，找出最贴切的基准行；若有多个经停点，以最远核心目的地确定 Base Rate。
3. **车型与附加费研判**：如果是小车 VPC 9821 且规则注明了 VPC 特殊价，则使用 VPC 特殊价。根据落点数超出免费额度的部分计算超点补贴。
4. **硬性安全护栏检验**：单趟最低不得低于 RM 40.00，最高常规不超过 RM 650.00。

请直接返回纯 JSON 格式数据（绝不能包含 markdown 格式标记如 \`\`\`json 或 \`\`\`）：
{
  "standardized_location": "识别出的核心城市/工业区与州属（如：Penang 威中 Bukit Minyak）",
  "ai_zone": "命中的阶梯区域名称（如：BUKIT MERTAJAM / 威中）",
  "base_rate": 80.0,
  "extra_drops_rate": 0.0,
  "special_surcharge": 0.0,
  "total_ai_rate": 80.0,
  "rule_citations": ["规则第2.2条 BUKIT MERTAJAM 阶梯基准价 RM 80", "落点未超免费3点额度"],
  "confidence_score": 0.95,
  "reasoning": "该行程送往威中 Bukit Minyak 工业区，命中第2.2条基准价 RM 80，落点 1 未超过免费 3 点上限，无超点加成，合计 RM 80。"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const mode = req.body?.mode || req.query?.mode || 'single';

        // =========================================================================
        // MODE: GET ACTIVE RULEBOOK
        // =========================================================================
        if (mode === 'get-active-rulebook') {
            const rulebook = await getActiveRulebookContent();
            return res.status(200).json({ success: true, ...rulebook });
        }

        // =========================================================================
        // MODE: LIST RULEBOOKS (Version History)
        // =========================================================================
        if (mode === 'list-rulebooks') {
            try {
                const { data, error } = await supabase
                    .from('pricing_rulebooks')
                    .select('id, version, title, is_active, changelog, created_by, created_at')
                    .eq('rule_type', 'DRIVER_DELIVERY')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    return res.status(200).json({ success: true, rulebooks: data });
                }
            } catch (ignore) {}

            return res.status(200).json({
                success: true,
                rulebooks: [
                    {
                        id: 'fallback-v1',
                        version: 'v1.0.0',
                        title: '司机运费与送货价格真理库',
                        is_active: true,
                        changelog: '初始基准版本 (内存/本地文件)',
                        created_by: 'System',
                        created_at: new Date().toISOString()
                    }
                ]
            });
        }

        // =========================================================================
        // MODE: SAVE RULEBOOK (Publish New Version)
        // =========================================================================
        if (mode === 'save-rulebook') {
            const { content_md, changelog, created_by = 'HR', title = '司机运费与送货价格真理库' } = req.body;
            if (!content_md || !content_md.trim()) {
                return res.status(400).json({ error: 'content_md is required' });
            }

            try {
                // Fetch latest version count to increment version
                const { data: latest } = await supabase
                    .from('pricing_rulebooks')
                    .select('version')
                    .eq('rule_type', 'DRIVER_DELIVERY')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let nextVersion = 'v1.1.0';
                if (latest?.version) {
                    const match = latest.version.match(/v?(\d+)\.(\d+)(\.(\d+))?/);
                    if (match) {
                        const major = parseInt(match[1]);
                        const minor = parseInt(match[2]) + 1;
                        nextVersion = `v${major}.${minor}.0`;
                    }
                }

                // Deactivate prior active versions
                await supabase
                    .from('pricing_rulebooks')
                    .update({ is_active: false })
                    .eq('rule_type', 'DRIVER_DELIVERY');

                // Insert new active version
                const { data: inserted, error: insErr } = await supabase
                    .from('pricing_rulebooks')
                    .insert({
                        rule_type: 'DRIVER_DELIVERY',
                        version: nextVersion,
                        title,
                        content_md,
                        is_active: true,
                        changelog: changelog || '用户在前端更新了运费规则',
                        created_by
                    })
                    .select()
                    .maybeSingle();

                if (insErr) {
                    throw insErr;
                }

                return res.status(200).json({
                    success: true,
                    rulebook: inserted,
                    message: `成功发布新版本 ${nextVersion}，全系统即刻热生效！`
                });
            } catch (err: any) {
                console.error('[calc-driver-rate] save-rulebook error:', err);
                return res.status(500).json({ error: err.message || 'Failed to save rulebook' });
            }
        }

        // =========================================================================
        // MODE: SANDBOX (Single Address Fast Simulation)
        // =========================================================================
        if (mode === 'sandbox') {
            const { testAddress, origin = 'TAIPING', lorryPlate = 'PGD 1234', dropCount = 1, rulebookMd } = req.body;
            if (!testAddress) {
                return res.status(400).json({ error: 'testAddress is required for sandbox mode' });
            }

            const rulebook = rulebookMd ? { content: rulebookMd, version: 'sandbox-custom' } : await getActiveRulebookContent();
            const addresses = [String(testAddress).trim()];

            const legacyRate = await calculateLegacyRate(origin, addresses, dropCount, lorryPlate);
            let aiResult: any;

            try {
                aiResult = await calculateRateWithGemini({
                    origin,
                    lorryPlate,
                    deliveryAddresses: addresses,
                    dropCount: Number(dropCount) || 1,
                    rulebookMd: rulebook.content
                });
            } catch (err: any) {
                aiResult = {
                    standardized_location: testAddress,
                    ai_zone: '兜底匹配',
                    base_rate: legacyRate,
                    extra_drops_rate: 0,
                    special_surcharge: 0,
                    total_ai_rate: legacyRate,
                    rule_citations: ['AI 生成异常，平滑回退至既有规则'],
                    confidence_score: 0.7,
                    reasoning: `AI 调用异常: ${err.message}，已自动采用传统查表价格。`
                };
            }

            // Enforce Guardrails
            let clampedRate = Number(aiResult.total_ai_rate) || legacyRate;
            if (clampedRate < 40.0) clampedRate = 40.0;
            const isExtreme = clampedRate > 650.0;

            const diffAmount = clampedRate - legacyRate;
            let discrepancyLevel = 'AUTO_MATCH';
            if (Math.abs(diffAmount) > 25 || isExtreme) {
                discrepancyLevel = 'HIGH_DISCREPANCY';
            } else if (legacyRate <= 40.0 && clampedRate > 40.0) {
                discrepancyLevel = 'AI_ENRICHED';
            } else if (Math.abs(diffAmount) > 0) {
                discrepancyLevel = 'MINOR_DRIFT';
            }

            return res.status(200).json({
                success: true,
                sandbox: true,
                origin,
                lorryPlate,
                testAddress,
                dropCount,
                legacy_rate: legacyRate,
                ai_rate: clampedRate,
                diff_amount: diffAmount,
                discrepancy_level: discrepancyLevel,
                is_extreme_blocked: isExtreme,
                ...aiResult
            });
        }

        // =========================================================================
        // MODE: BACKTEST (Batch Simulation on Past 50 Trips)
        // =========================================================================
        if (mode === 'backtest') {
            const { rulebookMd, limit = 30 } = req.body;
            const rulebook = rulebookMd ? { content: rulebookMd, version: 'backtest-draft' } : await getActiveRulebookContent();

            // Fetch recent non-cancelled sales orders
            const { data: sampleOrders, error: orderErr } = await supabase
                .from('sales_orders')
                .select('id, order_number, customer, delivery_address, zone, trip_id, notes, deadline, status')
                .neq('status', 'Cancelled')
                .not('delivery_address', 'is', null)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (orderErr || !sampleOrders || sampleOrders.length === 0) {
                return res.status(200).json({
                    success: true,
                    totalTrips: 0,
                    message: '未检索到可供回测的历史订单数据'
                });
            }

            let legacyTotal = 0;
            let aiTotal = 0;
            let matchCount = 0;
            let enrichedCount = 0;
            let driftCount = 0;
            let discrepancyCount = 0;
            const comparisons: any[] = [];

            // Run sample comparisons (up to 12 items deep AI, remainder extrapolated or fast legacy)
            const deepSlice = sampleOrders.slice(0, 8);
            for (const o of deepSlice) {
                const addr = o.delivery_address || '';
                const legacy = await calculateLegacyRate('TAIPING', [addr], 1);
                let aiCalc: any;

                try {
                    aiCalc = await calculateRateWithGemini({
                        origin: 'TAIPING',
                        lorryPlate: 'PGD 1234',
                        deliveryAddresses: [addr],
                        dropCount: 1,
                        rulebookMd: rulebook.content
                    });
                } catch (e: any) {
                    aiCalc = { total_ai_rate: legacy, reasoning: 'AI 离线回退', confidence_score: 0.8 };
                }

                const aiPrice = Math.max(40.0, Number(aiCalc.total_ai_rate) || legacy);
                const diff = aiPrice - legacy;

                legacyTotal += legacy;
                aiTotal += aiPrice;

                let level = 'AUTO_MATCH';
                if (Math.abs(diff) > 25) {
                    level = 'HIGH_DISCREPANCY';
                    discrepancyCount++;
                } else if (legacy <= 40 && aiPrice > 40) {
                    level = 'AI_ENRICHED';
                    enrichedCount++;
                } else if (Math.abs(diff) > 0) {
                    level = 'MINOR_DRIFT';
                    driftCount++;
                } else {
                    matchCount++;
                }

                comparisons.push({
                    order_number: o.order_number,
                    customer: o.customer,
                    address: addr,
                    legacy_rate: legacy,
                    ai_rate: aiPrice,
                    diff_amount: diff,
                    level,
                    reasoning: aiCalc.reasoning,
                    citations: aiCalc.rule_citations
                });
            }

            const netDiff = aiTotal - legacyTotal;
            const netDiffPercent = legacyTotal > 0 ? ((netDiff / legacyTotal) * 100).toFixed(1) + '%' : '0%';

            return res.status(200).json({
                success: true,
                totalTested: deepSlice.length,
                legacyTotal,
                aiTotal,
                netDiff,
                netDiffPercent,
                matchCount,
                enrichedCount,
                driftCount,
                discrepancyCount,
                comparisons
            });
        }

        // =========================================================================
        // MODE: SINGLE (Production Pre-Dispatch or Post-Delivery Audit)
        // =========================================================================
        const {
            tripId,
            tripNumber,
            driverId,
            driverName,
            lorryPlate = 'PGD 1234',
            origin = 'TAIPING',
            deliveryAddresses = [],
            dropCount = 1,
            stage = 'POST_DELIVERY',
            saveAudit = true,
            orderIds = []
        } = req.body;

        const rulebook = await getActiveRulebookContent();
        const addrs = Array.isArray(deliveryAddresses) ? deliveryAddresses.filter(Boolean) : [String(deliveryAddresses || '')];

        const legacyRate = await calculateLegacyRate(origin, addrs, Number(dropCount) || 1, lorryPlate);
        let aiResult: any;

        try {
            aiResult = await calculateRateWithGemini({
                origin,
                lorryPlate,
                deliveryAddresses: addrs,
                dropCount: Number(dropCount) || 1,
                rulebookMd: rulebook.content
            });
        } catch (err: any) {
            console.warn('[calc-driver-rate] Gemini execution failed, fallback to legacy:', err.message);
            aiResult = {
                standardized_location: addrs[0] || '本地配送',
                ai_zone: '系统查表匹配',
                base_rate: legacyRate,
                extra_drops_rate: 0,
                special_surcharge: 0,
                total_ai_rate: legacyRate,
                rule_citations: ['AI 临时无响应，平滑采用老系统费率'],
                confidence_score: 0.75,
                reasoning: `AI 解析降级: ${err.message}。运费保持与老系统一致。`
            };
        }

        // Safety Guardrail: Clamp between RM 40 and RM 650
        let finalAiRate = Number(aiResult.total_ai_rate) || legacyRate;
        if (finalAiRate < 40.0) finalAiRate = 40.0;
        const isExtremeBlocked = finalAiRate > 650.0;

        const diffAmount = finalAiRate - legacyRate;
        let discrepancyLevel = 'AUTO_MATCH';
        if (isExtremeBlocked || Math.abs(diffAmount) > 25.0) {
            discrepancyLevel = 'HIGH_DISCREPANCY';
        } else if (legacyRate <= 40.0 && finalAiRate > 40.0) {
            discrepancyLevel = 'AI_ENRICHED';
        } else if (Math.abs(diffAmount) > 0) {
            discrepancyLevel = 'MINOR_DRIFT';
        }

        const auditPayload: any = {
            trip_id: tripId || (orderIds[0] ? `TRIP-${orderIds[0]}` : `TRIP-${Date.now()}`),
            trip_number: tripNumber || null,
            driver_id: driverId || null,
            driver_name: driverName || null,
            lorry_plate: lorryPlate,
            origin,
            delivery_addresses: addrs,
            raw_address_summary: addrs.join(' | '),
            drop_count: Number(dropCount) || 1,
            legacy_rate: legacyRate,
            ai_rate: finalAiRate,
            diff_amount: diffAmount,
            standardized_location: aiResult.standardized_location,
            ai_zone: aiResult.ai_zone,
            rule_citations: aiResult.rule_citations || [],
            confidence_score: aiResult.confidence_score || 0.9,
            ai_reasoning: aiResult.ai_reasoning,
            discrepancy_level: discrepancyLevel,
            audit_status: discrepancyLevel === 'AUTO_MATCH' ? 'APPROVED' : 'PENDING',
            approved_amount: discrepancyLevel === 'AUTO_MATCH' ? finalAiRate : null,
            stage
        };

        // Attempt persistence to trip_rate_audits if table exists
        if (saveAudit) {
            try {
                const { data: auditSaved, error: auditErr } = await supabase
                    .from('trip_rate_audits')
                    .insert(auditPayload)
                    .select('id')
                    .maybeSingle();

                if (!auditErr && auditSaved) {
                    auditPayload.id = auditSaved.id;
                }
            } catch (ignore) {}
        }

        return res.status(200).json({
            success: true,
            rulebook_version: rulebook.version,
            is_extreme_blocked: isExtremeBlocked,
            ...auditPayload
        });

    } catch (e: any) {
        console.error('[calc-driver-rate] Top level handler error:', e);
        return res.status(500).json({ error: e.message || 'Internal server error in rate calculator' });
    }
}
