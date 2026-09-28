import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: raw, error } = await supabase
        .from('delivery_rates')
        .select('id, origin, location_name, base_rate, max_places, extra_rate_per_place, notes')
        .order('origin', { ascending: true })
        .order('base_rate', { ascending: false })
        .order('location_name', { ascending: true });

    if (error || !raw) {
        console.error('Failed to fetch delivery_rates:', error);
        return;
    }

    const groups: Record<string, any[]> = {};
    for (const r of raw) {
        const orig = (r.origin || 'TAIPING').toUpperCase();
        if (!groups[orig]) groups[orig] = [];
        groups[orig].push(r);
    }

    function renderTableRows(items: any[]) {
        let md = '| 目的地区域 (Zone / Location) | 标准基准价 (Base Rate) | 免费落点数 (Max Place) | 超点补贴/点 (Tambah Tempat Rate) | 备注说明 (Notes) |\n';
        md += '| :--- | :---: | :---: | :---: | :--- |\n';
        for (const it of items) {
            const notes = it.notes ? it.notes.replace(/\r?\n/g, ' ') : '-';
            md += `| **${it.location_name}** | **RM ${Number(it.base_rate).toFixed(0)}** | ${it.max_places} 点 | +RM ${Number(it.extra_rate_per_place).toFixed(0)} / 点 | ${notes} |\n`;
        }
        return md;
    }

    function processOrigin(origName: string) {
        const list = groups[origName] || [];
        const locMap = new Map();
        for (const it of list) {
            const key = it.location_name.trim().toUpperCase();
            if (!locMap.has(key)) {
                locMap.set(key, it);
            } else {
                const existing = locMap.get(key);
                if (Number(it.base_rate) > Number(existing.base_rate)) {
                    locMap.set(key, it);
                }
            }
        }
        const clean = Array.from(locMap.values());
        const standard = clean.filter(it => Number(it.base_rate) > 0 && !['MC', 'NO TRIP', 'OFF DAY', 'PH', 'STANDBY'].includes(it.location_name.toUpperCase()));
        const zeroRates = clean.filter(it => Number(it.base_rate) === 0 && !['MC', 'NO TRIP', 'OFF DAY', 'PH', 'STANDBY'].includes(it.location_name.toUpperCase()));
        
        standard.sort((a,b) => Number(b.base_rate) - Number(a.base_rate) || a.location_name.localeCompare(b.location_name));
        zeroRates.sort((a,b) => a.location_name.localeCompare(b.location_name));
        
        return { standard, zeroRates };
    }

    const taiping = processOrigin('TAIPING');
    const nilai = processOrigin('NILAI');
    const johor = processOrigin('JOHOR');
    const kelantan = processOrigin('KELANTAN');

    const fullMd = `# Packsecure 司机运费与送货价格真理库 (Driver Pricing Rulebook)
**版本 / Version**: \`v2.1.0 (Excel 官方对照校准版)\` ｜ **更新日期 / Date**: \`2026-09-28\` ｜ **审核人 / Owner**: \`HR & Logistics\` ｜ **状态 / Status**: \`Active\`

> **说明 (Instruction)**: 本文档是 Packsecure 司机送货价格计算的核心业务真理，与系统数据库 \`delivery_rates\` 官方有效运费表及工厂最新核定 Excel 100% 对齐。覆盖 **太平 (TAIPING)**、**汝来 (NILAI)**、**柔佛 (JOHOR)** 与 **吉兰丹 (KELANTAN)** 4 大出车起运基地。AI 运费核算引擎与 HR 审核工作台均以此规则为最高依据。任何管理人员或 HR 均可在前端在线修改并一键发布新版本。

---

## 1. 核心计费公式与基本原则 (Fundamental Rules)
1. **单趟行程计费公式 (Per-Trip Formula)**：
   $$\\text{Trip Earnings} = \\text{Base Rate (基准运费)} + \\max(0, \\text{Drops} - \\text{Max Places}) \\times \\text{Extra Rate Per Place (超点补贴)} + \\text{特殊额外任务补贴}$$
   - **\`Base Rate (基准运费)\`**：依据 **起运工厂 (\`trip_origin\`)** 与 **送达区域 (\`zone\` / \`location_name\`)** 匹配对应起步价。
   - **\`Max Places (免费落点数)\`**：该区域基准运费包含的送货目的地数量，未超出时不加收超点费。
   - **\`Extra Rate Per Place (超点补贴)\`**：送货落点数超出 \`Max Places\` 后，每增加 1 个经停客户点加发的津贴（通常为 +RM 5、+RM 10 或 +RM 15 / 点）。
2. **多单合并一趟 (Trip Grouping)**：
   同一名司机在同一天送往相同或顺路方向的多张销售订单 (DO)，统一视为同一趟行程 (Trip) 进行运费核算，不重复发放多份基础运费。
3. **4 大起运基地 (Origin Hubs)**：
   系统支持以下 4 个工厂出车起点。若单据未注明，默认按司机档案归属或 **TAIPING (太平总厂)** 起运：
   - **TAIPING (太平 / OPM Lama / SPD)**
   - **NILAI (汝来)**
   - **JOHOR (柔佛 / Weheng)**
   - **KELANTAN (吉兰丹)**
4. **车型容量与特殊费率差异 (Vehicle Adaptation)**：
   - 标准卡车容量基准：**82 卷气泡膜**。
   - 特殊车辆 **\`VPC 9821\`**：65 卷轻卡，若路线或区域注明 VPC 专属费率（如 \`[VPC_RATE: 75]\` 等），优先适用 VPC 费率。
   - 特殊车辆 **\`APH 9821\`**：92 卷重卡。
5. **现场特殊支援任务补贴 (Extra Allowances)**：
   司机在日常干线/外坡送货之外，在厂区或本地完成的现场支援任务，经照片存证与 HR 审核后计入当月工资：
   - 🛍️ **\`OPM - SHOPEE/SPD\` (或 \`SHOPEE / SPD\`) 散单送件**：**RM 20.00** / 趟（包含 1 点，超点 +RM 20 / 点）
   - 🚚 **\`TAIPING TRIP\` 厂区驳运**：**RM 7.00** / 趟（包含 1 点，超点 +RM 7 / 点）
   - 🪵 **\`AMBIL PALLET\` (或 \`AMBIK PALLET\`) 搬运托盘**：**RM 10.00** / 趟
   - 🔧 **\`LORRY SERVICE\` 送修验车 (Puspakom)**：**RM 15.00** / 趟
   - ↩️ **\`RETURN\` / \`OTHER\`**：客户退货调拨或特定临时任务，由 Admin / Manager 依实际路程特批审核。

---

## 2. 太平厂起运 (TAIPING Origin) 价目表
> 太平总厂 (TAIPING / OPM Lama) 出车，覆盖霹雳本地、槟城威省、吉打玻州、雪隆森美兰及东海岸各州的标准配送费率（与官方 Excel 表完全一致）：

### 2.1 太平标准生效价目表 (Active Rates)
${renderTableRows(taiping.standard)}
${taiping.zeroRates.length > 0 ? `### 2.2 太平待确权与待定义区域 (Pending Definitions)
> ⚠️ 以下区域在数据库原表中费率为 0，开单时不可直接按 0 结算，必须由调度或 HR 明确具体经停城镇或手动补录有效费率：

${renderTableRows(taiping.zeroRates)}` : ''}

---

## 3. 汝来厂起运 (NILAI Origin) 价目表
> 汝来基地 (NILAI) 出车，向森美兰、雪兰莪、吉隆坡、马六甲、彭亨、登嘉楼及柔佛等地的配送费率：

### 3.1 汝来标准生效价目表 (Active Rates)
${renderTableRows(nilai.standard)}
${nilai.zeroRates.length > 0 ? `### 3.2 汝来待确权与待定义区域 (Pending Definitions)
> ⚠️ 以下区域在数据库原表中费率为 0，开单时不可直接按 0 结算，必须由调度或 HR 明确具体经停城镇或手动补录有效费率：

${renderTableRows(nilai.zeroRates)}` : ''}

---

## 4. 柔佛厂起运 (JOHOR Origin) 价目表
> 柔佛基地 (JOHOR) 出车，向新山、古来、笨珍、峇株巴辖、居銮、麻坡、丰盛港及昔加末等地的配送费率：

### 4.1 柔佛标准生效价目表 (Active Rates)
${renderTableRows(johor.standard)}
${johor.zeroRates.length > 0 ? `### 4.2 柔佛待确权与待定义区域 (Pending Definitions)
> ⚠️ 以下区域在数据库原表中费率为 0，开单时不可直接按 0 结算，必须由调度或 HR 明确具体经停城镇或手动补录有效费率：

${renderTableRows(johor.zeroRates)}` : ''}

---

## 5. 吉兰丹厂起运 (KELANTAN Origin) 价目表
> 吉兰丹基地 (KELANTAN) 出车，向哥打峇鲁、巴西马、道北、马樟、巴西富地、丹那美拉、日里及话望生等地的配送费率：

### 5.1 吉兰丹标准生效价目表 (Active Rates)
${renderTableRows(kelantan.standard)}
${kelantan.zeroRates.length > 0 ? `### 5.2 吉兰丹待确权与待定义区域 (Pending Definitions)
> ⚠️ 以下区域在数据库原表中费率为 0，开单时不可直接按 0 结算，必须由调度或 HR 明确具体经停城镇或手动补录有效费率：

${renderTableRows(kelantan.zeroRates)}` : ''}

---

## 6. 常见地名消歧与归属判定准则 (Ambiguity Resolution Rules)
- **Menglembu / 万里望**：属于霹雳怡保近郊，按 **IPOH (RM 80)** 结算。
- **Batu Kawan / 峇都交湾**：属于槟城威南，按 **SIMPANG AMPAT (PENANG) (RM 80)** 结算。
- **Bukit Minyak / 武吉敏惹**：属于槟城威中，按 **BM (RM 80)** 结算。
- **Nilai 3 / 汝来 3 工业区**：若从太平起运按 **NEGERI SEMBILAN (RM 400)** 结算；若从汝来本地起运按 **NILAI (RM 30)** 或 **NEGERI SEMBILAN (RM 80)** 结算。
- **Karak / 加叻**：属于彭亨近郊，太平起运按 **KARAK (RM 330, 3点, +RM 10/点)** 结算。
- **Jengka / 增卡**：属于彭亨腹地，太平起运按 **JENGKA (RM 380, 3点, +RM 10/点)** 结算。
- **Skudai / 士姑来**：属于柔佛新山近郊，柔佛起运按 **JOHOR BAHRU (RM 40)** 结算。
- **Rawang / 煤炭山**：属于雪兰莪，汝来起运按 **SELANGOR (RM 80)** 结算；太平起运按 **KL** 相应标准结算。
- **多单拼车计费原则**：同一趟行程包含多个城镇时，以**最远核心目的地**作为 Base Rate，其余经停点按超点补贴 (+RM 5 ~ +RM 15 / 点) 累计。
`;

    // 1. Write to docs/sops/Driver_Pricing_Rules.md
    const docPath = path.resolve('docs/sops/Driver_Pricing_Rules.md');
    fs.writeFileSync(docPath, fullMd, 'utf8');
    console.log('✓ Updated docs/sops/Driver_Pricing_Rules.md');

    // 2. Update src/utils/aiDriverPricing.ts
    const tsPath = path.resolve('src/utils/aiDriverPricing.ts');
    const ts = fs.readFileSync(tsPath, 'utf8');
    const startMarker = 'export const CANONICAL_DRIVER_PRICING_MD = `';
    const startIdx = ts.indexOf(startMarker);
    const apiBaseIdx = ts.indexOf("const API_BASE = '/api/agent';");

    if (startIdx !== -1 && apiBaseIdx !== -1) {
        const endIdx = ts.lastIndexOf('`', apiBaseIdx);
        const escaped = fullMd.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        const newTs = ts.substring(0, startIdx + startMarker.length) + escaped + ts.substring(endIdx);
        fs.writeFileSync(tsPath, newTs, 'utf8');
        console.log('✓ Updated src/utils/aiDriverPricing.ts');
    }
}

main().catch(console.error);
