import { SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendWhatsAppText } from './whatsapp.js';

export interface MachineRecipeMeta {
  machineKey: string;
  machineId: string;
  machineName: string;
  factoryName: string;
  factoryId: string;
  category: string;
  sku: string;
  productName: string;
  netWeightKg: number;
  coreWeightKg: number;
  grossWeightKg: number;
  packSpec: string;
}

export const ALL_12_MACHINE_CATALOG: MachineRecipeMeta[] = [
  // Taiping
  {
    machineKey: 'T1',
    machineId: 'T1-M03',
    machineName: 'Stretch Film (T1)',
    factoryName: '太平旧厂 (Taiping)',
    factoryId: 'T1',
    category: '缠绕膜 (500mm)',
    sku: 'SF-CLEAR-2.2-50CM',
    productName: 'SF CLEAR 2.2KG X 50CM (6ROLLS/CTN)',
    netWeightKg: 2.00,
    coreWeightKg: 0.20,
    grossWeightKg: 2.20,
    packSpec: '6 卷 / 箱 (整箱毛重 13.2kg)'
  },
  {
    machineKey: 'T4',
    machineId: 'T4-M04',
    machineName: 'Stretch Film (T4)',
    factoryName: '太平旧厂 (Taiping)',
    factoryId: 'T1',
    category: '缠绕膜 (500mm)',
    sku: 'SF-CLEAR-2.2-50CM',
    productName: 'SF CLEAR 2.2KG X 50CM (6ROLLS/CTN)',
    netWeightKg: 2.00,
    coreWeightKg: 0.20,
    grossWeightKg: 2.20,
    packSpec: '6 卷 / 箱 (整箱毛重 13.2kg)'
  },
  {
    machineKey: 'T2',
    machineId: 'T2-M01',
    machineName: '2M Double Layer (T2)',
    factoryName: '太平旧厂 (Taiping)',
    factoryId: 'T1',
    category: '2米双层气泡膜',
    sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    productName: '2米双层气泡膜标准卷 (可切 1m / 50cm / 33cm)',
    netWeightKg: 5.60,
    coreWeightKg: 0.00,
    grossWeightKg: 5.60,
    packSpec: '100cm×1卷 或 50cm×2卷捆 或 33cm×3卷捆 (标准Unit: 5.6kg, 全幅双卷 11.2kg)'
  },
  {
    machineKey: 'T3',
    machineId: 'T3-M02',
    machineName: '1M Single Layer (T3)',
    factoryName: '太平旧厂 (Taiping)',
    factoryId: 'T1',
    category: '1米单层气泡膜',
    sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED',
    productName: '1米单层透明气泡膜 (MERAH / OREN)',
    netWeightKg: 3.80,
    coreWeightKg: 0.00,
    grossWeightKg: 3.80,
    packSpec: '100cm×1卷 (MERAH) 或 50cm×2卷捆 (OREN)'
  },
  {
    machineKey: 'T5',
    machineId: 'T5-M05',
    machineName: 'Recycle Machine (T5)',
    factoryName: '太平旧厂 (Taiping)',
    factoryId: 'T1',
    category: '塑料回收造粒机',
    sku: 'RM-REC-MIX',
    productName: '太平塑料再生颗粒 (Pellets)',
    netWeightKg: 25.00,
    coreWeightKg: 0.00,
    grossWeightKg: 25.00,
    packSpec: '25kg / 袋 (吨装 40包/托)'
  },

  // Nilai
  {
    machineKey: 'N1',
    machineId: 'N1-M01',
    machineName: '1M Double Layer (N1)',
    factoryName: '汝来厂区 (Nilai)',
    factoryId: 'N1',
    category: '1米双层气泡膜',
    sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    productName: '汝来 1米双层透明气泡膜 (DL-FULL / DL-HALF)',
    netWeightKg: 5.60,
    coreWeightKg: 0.00,
    grossWeightKg: 5.60,
    packSpec: '100cm×1卷 或 50cm×2卷捆 (标准Unit: 5.6kg)'
  },
  {
    machineKey: 'N2',
    machineId: 'N2-M02',
    machineName: '1M Single Layer (N2)',
    factoryName: '汝来厂区 (Nilai)',
    factoryId: 'N1',
    category: '1米单层气泡膜',
    sku: 'BW-SL-CLR-100Mx50CMx2ROLL-ORN',
    productName: '汝来 1米单层气泡膜 (OREN 50CM / MERAH 100CM)',
    netWeightKg: 3.80,
    coreWeightKg: 0.00,
    grossWeightKg: 3.80,
    packSpec: '50cm×2卷捆 或 100cm×1卷 (标准Unit: 3.8kg)'
  },
  {
    machineKey: 'N3',
    machineId: 'N3-M03',
    machineName: 'Recycle Machine (N3)',
    factoryName: '汝来厂区 (Nilai)',
    factoryId: 'N1',
    category: '塑料回收造粒机',
    sku: 'RM-REC-MIX',
    productName: '汝来厂塑料再生颗粒',
    netWeightKg: 25.00,
    coreWeightKg: 0.00,
    grossWeightKg: 25.00,
    packSpec: '25kg / 袋'
  },

  // Johor
  {
    machineKey: 'J1',
    machineId: 'J1-M01',
    machineName: '2M Double Layer (J1)',
    factoryName: '柔佛厂区 (Johor)',
    factoryId: 'J1',
    category: '2米双层气泡膜',
    sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    productName: '柔佛 2米双层气泡膜标准卷',
    netWeightKg: 5.60,
    coreWeightKg: 0.00,
    grossWeightKg: 5.60,
    packSpec: '100cm×1卷 或 50cm×2卷捆 或 33cm×3卷捆 (标准Unit: 5.6kg, 全幅双卷 11.2kg)'
  },
  {
    machineKey: 'J2',
    machineId: 'J1-M02',
    machineName: 'Recycle Machine (J1)',
    factoryName: '柔佛厂区 (Johor)',
    factoryId: 'J1',
    category: '塑料回收造粒机',
    sku: 'RM-REC-MIX',
    productName: '柔佛厂塑料再生颗粒',
    netWeightKg: 25.00,
    coreWeightKg: 0.00,
    grossWeightKg: 25.00,
    packSpec: '25kg / 袋'
  },

  // Kelantan
  {
    machineKey: 'K1',
    machineId: 'K1-M01',
    machineName: '1M Double Layer (K1)',
    factoryName: '吉兰丹厂 (Kelantan)',
    factoryId: 'K1',
    category: '1米双层气泡膜',
    sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    productName: '吉兰丹 1米双层透明气泡膜',
    netWeightKg: 5.60,
    coreWeightKg: 0.00,
    grossWeightKg: 5.60,
    packSpec: '100cm×1卷 或 50cm×2卷捆 (标准Unit: 5.6kg)'
  },
  {
    machineKey: 'K2',
    machineId: 'K1-M02',
    machineName: '1M Single Layer (K1)',
    factoryName: '吉兰丹厂 (Kelantan)',
    factoryId: 'K1',
    category: '1米单层气泡膜',
    sku: 'BW-SL-CLR-100Mx50CMx2ROLL-ORN',
    productName: '吉兰丹 1米单层气泡膜',
    netWeightKg: 3.80,
    coreWeightKg: 0.00,
    grossWeightKg: 3.80,
    packSpec: '50cm×2卷捆 (OREN) 或 100cm×1卷 (MERAH)'
  }
];

/**
 * Formats the full 12-machine recipe catalog menu
 */
export function formatRecipeCatalog(): string {
  const taipingList = ALL_12_MACHINE_CATALOG.filter(m => m.factoryId === 'T1')
    .map(m => `  • 【*配方 ${m.machineKey}*】: ${m.machineName} (${m.category})`)
    .join('\n');

  const nilaiList = ALL_12_MACHINE_CATALOG.filter(m => m.factoryId === 'N1')
    .map(m => `  • 【*配方 ${m.machineKey}*】: ${m.machineName} (${m.category})`)
    .join('\n');

  const johorList = ALL_12_MACHINE_CATALOG.filter(m => m.factoryId === 'J1')
    .map(m => `  • 【*配方 ${m.machineKey}*】: ${m.machineName} (${m.category})`)
    .join('\n');

  const kelantanList = ALL_12_MACHINE_CATALOG.filter(m => m.factoryId === 'K1')
    .map(m => `  • 【*配方 ${m.machineKey}*】: ${m.machineName} (${m.category})`)
    .join('\n');

  return `🧪 *【Packsecure 全厂 12 台机台配方目录】* 🏢\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏭 *一、太平总厂 (Taiping)*:\n${taipingList}\n\n` +
    `🏭 *二、汝来厂区 (Nilai - Central)*:\n${nilaiList}\n\n` +
    `🏭 *三、柔佛厂区 (Johor - South)*:\n${johorList}\n\n` +
    `🏭 *四、吉兰丹厂区 (Kelantan - East)*:\n${kelantanList}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 *快速查阅方法*：\n` +
    `直接回复对应机台指令，例如发送：\n` +
    `• 【*配方 T1*】 或 【*配方 500*】（查缠绕膜主力机）\n` +
    `• 【*配方 T2*】 或 【*配方 J1*】（查 2米双层大机）\n` +
    `• 【*配方 N1*】（查汝来双层机台）\n\n` +
    `💡 *修改配方*：SuperAdmin 可直接发消息，如【把 T1 螺杆A 的 7042 改为 16包】`;
}

/**
 * Formats a single machine's comprehensive recipe report
 */
export function formatMachineRecipeReport(
  meta: MachineRecipeMeta,
  screwsData: Record<string, any[]>,
  lastUpdatedBy?: string,
  lastUpdatedAt?: string
): string {
  const screwNames: Record<string, string> = {
    Screw_A: '🔩 Screw A (外层 / 主螺杆)',
    Screw_B: '🔩 Screw B (中层 / 辅螺杆)',
    Screw_C: '🔩 Screw C (底膜 / 内层螺杆)'
  };

  const screwSections: string[] = [];

  const safeScrews = screwsData || {};

  ['Screw_A', 'Screw_B', 'Screw_C'].forEach(screwId => {
    const rawItems = safeScrews[screwId] || [];
    const activeItems = rawItems.filter(it => (Number(it.newQty) || 0) > 0);

    if (activeItems.length === 0) return;

    let screwTotalKg = 0;
    activeItems.forEach(it => {
      const isBag = it.unit === 'bag' || it.unit === '包' || it.unit === 'Bag';
      screwTotalKg += isBag ? Number(it.newQty) * 25 : Number(it.newQty);
    });

    const itemLines = activeItems.map((it, idx) => {
      const isBag = it.unit === 'bag' || it.unit === '包' || it.unit === 'Bag';
      const qtyNum = Number(it.newQty) || 0;
      const itemKg = isBag ? qtyNum * 25 : qtyNum;
      const ratio = screwTotalKg > 0 ? ((itemKg / screwTotalKg) * 100).toFixed(1) : '0';
      const displayQty = isBag ? `*${qtyNum} 包* (${itemKg} kg)` : `*${qtyNum} kg*`;

      return `  ${idx + 1}️⃣ *${it.name}*: ${displayQty} • 占比: ${ratio}%`;
    });

    screwSections.push(
      `${screwNames[screwId] || screwId}\n` +
      `   (螺杆单次投料总计: *${screwTotalKg} kg*):\n` +
      itemLines.join('\n')
    );
  });

  const timeText = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })
    : '系统标准';

  return `🧪 *【${meta.machineName} 现场生产配方】*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏭 归属厂区: *${meta.factoryName}* [${meta.machineId}]\n` +
    `📦 生产品类: *${meta.category}* (${meta.sku})\n` +
    `⏱️ 最近调机: *${timeText}* (${lastUpdatedBy || '现场班组'})\n\n` +
    `⚖️ *成品单卷重量与包装规格:*\n` +
    `   • 单卷净重 (Net): *${meta.netWeightKg.toFixed(2)} kg* / 卷\n` +
    `   • 纸管重量 (Core): *${meta.coreWeightKg.toFixed(2)} kg* / 支\n` +
    `   • 单卷毛重 (Gross): *${meta.grossWeightKg.toFixed(2)} kg* / 卷\n` +
    `   • 出货包装: *${meta.packSpec}*\n\n` +
    `📋 *各螺杆实际投料与配比:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${screwSections.join('\n\n')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *修改配比指令 (SuperAdmin 专享)*：\n` +
    `直接发消息发起调整，例如：\n` +
    `【把 ${meta.machineKey} 螺杆A 的 7042 改成 16包，回料减到 5kg】`;
}

/**
 * Resolves which machine is requested from natural user text
 */
export function resolveMachineTarget(text: string): MachineRecipeMeta | null {
  const upper = text.toUpperCase();

  // 1. Direct machine key match: T1, T4, T2, T3, T5, N1, N2, N3, J1, J2, K1, K2
  for (const m of ALL_12_MACHINE_CATALOG) {
    const regex = new RegExp(`\\b${m.machineKey}\\b|${m.machineId}`, 'i');
    if (regex.test(upper) || upper.includes(`配方 ${m.machineKey}`) || upper.includes(`配方${m.machineKey}`)) {
      return m;
    }
  }

  // 2. Keyword fallback match
  if (/500|缠绕膜|拉伸膜|stretch/i.test(text)) {
    return ALL_12_MACHINE_CATALOG.find(m => m.machineKey === 'T1') || null;
  }
  if (/2米|双层|2m/i.test(text)) {
    return ALL_12_MACHINE_CATALOG.find(m => m.machineKey === 'T2') || null;
  }
  if (/1米单层|单层/i.test(text)) {
    return ALL_12_MACHINE_CATALOG.find(m => m.machineKey === 'T3') || null;
  }
  if (/造粒|回收|recycle/i.test(text)) {
    return ALL_12_MACHINE_CATALOG.find(m => m.machineKey === 'T5') || null;
  }

  return null;
}

/**
 * Master handler for incoming WhatsApp Recipe queries and modifications
 */
export async function handleWhatsAppRecipeWorkflow(
  supabase: SupabaseClient,
  fromNumber: string,
  text: string,
  employee: any,
  apiKey?: string
): Promise<{ handled: boolean; status: string }> {
  const empRole = employee?.role || '';
  const empName = employee?.name || 'SuperAdmin';
  const isSuperAdmin = empRole === 'SuperAdmin';
  const requiredPin = employee?.employee_id || '8335';
  const pendingKey = `pending_recipe_${fromNumber}`;

  // ── 1. CHECK PENDING CONFIRMATION / CANCELLATION FIRST ───────────────────────
  const { data: pendingRecord } = await supabase
    .from('ai_prompt_configs')
    .select('*')
    .eq('mode', pendingKey)
    .maybeSingle();

  if (pendingRecord) {
    let pending: any = null;
    try {
      pending = JSON.parse(pendingRecord.prompt_template);
    } catch {
      await supabase.from('ai_prompt_configs').delete().eq('mode', pendingKey);
    }

    if (pending) {
      const lower = text.toLowerCase().trim();

      // Case A: Cancel
      if (/取消|batal|cancel|x jadi|tak jadi|no/i.test(lower)) {
        await supabase.from('ai_prompt_configs').delete().eq('mode', pendingKey);
        await sendWhatsAppText(
          fromNumber,
          `🚫 *Pindaan Dibatalkan / 已取消修改*\n\n` +
          `Permintaan pindaan Recipe untuk [${pending.machineName || pending.machineKey}] telah dibatalkan dengan selamat.`
        );
        return { handled: true, status: 'MODIFICATION_CANCELLED' };
      }

      // Case B: PIN Verification
      const pinCandidate = text.replace(/[^0-9]/g, '');
      const validPins = [requiredPin, '8335', '9821']; // SuperAdmin master PINs

      if (pinCandidate && validPins.includes(pinCandidate)) {
        // ── 2-PHASE COMMIT: EXECUTE UPDATE ON LIVE MACHINE FORMULA ────────────
        const targetMachineKey = pending.machineKey;
        const targetMachine = ALL_12_MACHINE_CATALOG.find(m => m.machineKey === targetMachineKey) || ALL_12_MACHINE_CATALOG[0];

        // Fetch current live formula
        const { data: liveData } = await supabase
          .from('work_photos')
          .select('user_note')
          .eq('category', 'MACHINE_SCREW_FORMULA')
          .eq('machine_id', targetMachineKey)
          .order('created_at', { ascending: false })
          .limit(1);

        let currentScrews: Record<string, any[]> = { Screw_A: [], Screw_B: [], Screw_C: [] };
        if (liveData && liveData[0]?.user_note) {
          try {
            currentScrews = JSON.parse(liveData[0].user_note);
          } catch {}
        }

        // Apply proposed changes to currentScrews
        (pending.changes || []).forEach((ch: any) => {
          const scList = currentScrews[ch.screw_id] || [];
          const existing = scList.find(it => it.name.toLowerCase().includes(ch.name.toLowerCase()) || it.sku === ch.sku);

          if (existing) {
            existing.prevQty = existing.newQty;
            existing.newQty = Number(ch.new_qty);
          } else {
            scList.push({
              id: `${ch.screw_id.toLowerCase()}_${Date.now()}`,
              name: ch.name,
              sku: ch.sku || 'RM-CUSTOM',
              unit: ch.unit || 'bag',
              prevQty: 0,
              newQty: Number(ch.new_qty)
            });
          }
          currentScrews[ch.screw_id] = scList;
        });

        // 1. Sync directly to work_photos for immediate mobile workshop reactivity
        await supabase
          .from('work_photos')
          .delete()
          .eq('category', 'MACHINE_SCREW_FORMULA')
          .eq('machine_id', targetMachineKey);

        await supabase.from('work_photos').insert({
          employee_id: employee?.employee_id || '8335',
          employee_name: `${empName} (SuperAdmin via WA)`,
          machine_id: targetMachineKey,
          category: 'MACHINE_SCREW_FORMULA',
          user_note: JSON.stringify(currentScrews),
          photo_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80',
          location: targetMachine.factoryId
        });

        // 2. Also sync to bom_items_v2 to keep central BOM ERP perfectly aligned
        try {
          const { data: bomHeader } = await supabase
            .from('bom_headers_v2')
            .select('recipe_id')
            .eq('product_sku', targetMachine.sku)
            .limit(1)
            .maybeSingle();

          if (bomHeader?.recipe_id) {
            let totalKg = 0;
            const screwNamesMap: Record<string, string> = {
              Screw_A: 'Screw A (外层/主螺杆)',
              Screw_B: 'Screw B (中层/成型螺杆)',
              Screw_C: 'Screw C (底膜/内层螺杆)'
            };

            ['Screw_A', 'Screw_B', 'Screw_C'].forEach(scKey => {
              const items = currentScrews[scKey] || [];
              items.forEach((it: any) => {
                const qtyNum = Number(it.newQty) || 0;
                if (qtyNum > 0) {
                  const isBag = it.unit === 'bag' || it.unit === '包' || it.unit === 'Bag';
                  totalKg += isBag ? qtyNum * 25 : qtyNum;
                }
              });
            });

            const itemsToInsert: any[] = [];
            ['Screw_A', 'Screw_B', 'Screw_C'].forEach(scKey => {
              const items = currentScrews[scKey] || [];
              items.forEach((it: any) => {
                const qtyNum = Number(it.newQty) || 0;
                if (qtyNum > 0) {
                  const isBag = it.unit === 'bag' || it.unit === '包' || it.unit === 'Bag';
                  const itemKg = isBag ? qtyNum * 25 : qtyNum;
                  const ratio = totalKg > 0 ? Number(((itemKg / totalKg) * 100).toFixed(1)) : 0;
                  itemsToInsert.push({
                    recipe_id: bomHeader.recipe_id,
                    material_sku: it.sku || 'RM-CUSTOM',
                    layer_name: screwNamesMap[scKey] || scKey,
                    ratio_percentage: ratio,
                    notes: `${it.name}: ${qtyNum}${isBag ? '包' : 'kg'}`,
                    scrap_percent: 0.015
                  });
                }
              });
            });

            if (itemsToInsert.length > 0) {
              await supabase.from('bom_items_v2').delete().eq('recipe_id', bomHeader.recipe_id);
              await supabase.from('bom_items_v2').insert(itemsToInsert);
            }
          }
        } catch (bomSyncErr) {
          console.warn('[BOM Sync Error]:', bomSyncErr);
        }

        // 3. Clear pending state
        await supabase.from('ai_prompt_configs').delete().eq('mode', pendingKey);

        const changeDetails = (pending.changes || []).map((c: any) =>
          `  • [${c.screw_id}] *${c.name}*: ${c.old_qty} ➔ *${c.new_qty} ${c.unit || ''}*`
        ).join('\n');

        const successReply = `✅ *【配方已成功更新并生效！】* 🚀\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🏭 目标设备: *${targetMachine.machineName}* [${targetMachineKey}]\n` +
          `👤 操作人员: *${empName}* (PIN: ****)\n` +
          `⏱️ 生效时间: ${new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })}\n\n` +
          `📝 *变更明细:*\n${changeDetails}\n\n` +
          `📱 *状态*：车间操作工手机/平板端已即时同步，已写入机台唯一生产真理！`;

        await sendWhatsAppText(fromNumber, successReply);
        return { handled: true, status: 'RECIPE_UPDATED' };
      }

      // If user typed wrong PIN
      if (pinCandidate && pinCandidate.length >= 3) {
        await sendWhatsAppText(
          fromNumber,
          `❌ *PIN Tidak Sah / PIN 码错误*\n\n` +
          `PIN yang dimasukkan salah. Sila masukkan *4 digit PIN SuperAdmin* yang sah untuk mengesahkan pindaan [${pending.machineName || pending.machineKey}], atau balas 【*取消 / Batal*】 untuk batalkan.`
        );
        return { handled: true, status: 'WRONG_PIN' };
      }
    }
  }

  // ── 2. INTENT DETECTION (QUERY VS MODIFY) ────────────────────────────────────
  const hasRecipeKeywords = /配方|recipe|formula|nisbah|原料|bancuhan/i.test(text);
  const isRecipeModify = /改配方|修改配方|调整配方|tukar recipe|ubah recipe|update recipe|改成|加到|减到|增加|减少/i.test(text) &&
    /包|kg|7042|2426|7260|回料|母粒|recycle|black|ldpe|hdpe/i.test(text);

  const isRecipeQuery = hasRecipeKeywords && !isRecipeModify;

  if (!isRecipeQuery && !isRecipeModify) {
    return { handled: false, status: 'NOT_RECIPE' };
  }

  // ── 3. STRICT SUPERADMIN PERMISSION CHECK ──────────────────────────────────
  if (!isSuperAdmin) {
    await sendWhatsAppText(
      fromNumber,
      `🔒 *Akses Terhad / 权限受限*\n\n` +
      `Maklumat terperinci dan pindaan Recipe (Formula Kilang) adalah sulit & hanya dibenarkan untuk *SuperAdmin*.\n` +
      `Sila hubungi pihak pengurusan jika anda memerlukan maklumat ini.`
    );
    return { handled: true, status: 'RECIPE_UNAUTHORIZED' };
  }

  // ── 4. BRANCH: RECIPE QUERY ────────────────────────────────────────────────
  if (isRecipeQuery) {
    const targetMachine = resolveMachineTarget(text);

    // If no specific machine is requested, show full 12-machine catalog
    if (!targetMachine) {
      await sendWhatsAppText(fromNumber, formatRecipeCatalog());
      return { handled: true, status: 'CATALOG_SENT' };
    }

    // Specific machine requested: Fetch live formula from work_photos
    const { data: liveData } = await supabase
      .from('work_photos')
      .select('user_note, employee_name, created_at')
      .eq('category', 'MACHINE_SCREW_FORMULA')
      .eq('machine_id', targetMachine.machineKey)
      .order('created_at', { ascending: false })
      .limit(1);

    let screwsObj: Record<string, any[]> = { Screw_A: [], Screw_B: [], Screw_C: [] };
    let lastUpdatedBy = '现场操作工';
    let lastUpdatedAt = '';

    if (liveData && liveData[0]?.user_note) {
      try {
        screwsObj = JSON.parse(liveData[0].user_note);
        lastUpdatedBy = liveData[0].employee_name || '车间班组';
        lastUpdatedAt = liveData[0].created_at;
      } catch {}
    }

    const reportText = formatMachineRecipeReport(targetMachine, screwsObj, lastUpdatedBy, lastUpdatedAt);
    await sendWhatsAppText(fromNumber, reportText);
    return { handled: true, status: 'MACHINE_RECIPE_SENT' };
  }

  // ── 5. BRANCH: RECIPE MODIFICATION ─────────────────────────────────────────
  if (isRecipeModify) {
    if (!apiKey) {
      await sendWhatsAppText(fromNumber, `⚠️ AI Service tidak aktif. Sila hubungi IT.`);
      return { handled: true, status: 'NO_API_KEY' };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const targetMachine = resolveMachineTarget(text) || ALL_12_MACHINE_CATALOG[0];

      // Fetch live formula for this machine
      const { data: liveData } = await supabase
        .from('work_photos')
        .select('user_note')
        .eq('category', 'MACHINE_SCREW_FORMULA')
        .eq('machine_id', targetMachine.machineKey)
        .order('created_at', { ascending: false })
        .limit(1);

      let currentScrews: Record<string, any[]> = { Screw_A: [], Screw_B: [], Screw_C: [] };
      if (liveData && liveData[0]?.user_note) {
        try {
          currentScrews = JSON.parse(liveData[0].user_note);
        } catch {}
      }

      const parsePrompt = `You are a plastics manufacturing plant AI assistant.
The SuperAdmin wants to modify an extruder machine's recipe via natural language.
Target Machine: ${targetMachine.machineName} (${targetMachine.machineKey})
Current Machine Screws & Ingredients:
${JSON.stringify(currentScrews, null, 2)}

User request: "${text}"

Instructions:
1. Identify which machine (default to "${targetMachine.machineKey}" if not mentioned).
2. Identify which screw: "Screw_A", "Screw_B", or "Screw_C" (default to "Screw_A" if not specified).
3. Identify the ingredients changed (e.g. C1802 / 7042, Recycle, LDPE 2426H).
4. Parse the new quantity and unit (bag or kg).
5. Output STRICT JSON only:
{
  "recognized": boolean,
  "machine_key": string,
  "machine_name": string,
  "changes": [
    {
      "screw_id": "Screw_A" | "Screw_B" | "Screw_C",
      "name": string,
      "sku": string,
      "old_qty": number,
      "new_qty": number,
      "unit": "bag" | "kg"
    }
  ]
}`;

      const aiRes = await model.generateContent([parsePrompt]);
      const rawText = aiRes.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawText);

      if (!parsed.recognized || !parsed.changes || parsed.changes.length === 0) {
        await sendWhatsAppText(
          fromNumber,
          `⚠️ *Tidak Dapat Memproses Arahan / 无法解析修改指令*\n\n` +
          `AI tidak dapat mengenal pasti bahan atau kuantiti yang ingin diubah daripada ayat: "${text}".\n\n` +
          `👉 Sila nyatakan dengan jelas, contoh:\n` +
          `【*把 T1 螺杆A 的 7042 改成 16包，回料减到 5kg*】`
        );
        return { handled: true, status: 'PARSE_FAILED' };
      }

      // Format Comparison Card
      const diffLines = parsed.changes.map((ch: any) => {
        const delta = ch.new_qty - ch.old_qty;
        const arrow = delta > 0 ? `🔺+${delta}` : delta < 0 ? `🔻${delta}` : `(保持)`;
        return `  • [${ch.screw_id}] *${ch.name}*: ${ch.old_qty} ➔ *${ch.new_qty} ${ch.unit}* ${arrow}`;
      });

      const confirmCard = `⚠️ *【配方修改待核验 / Pengesahan Pindaan Recipe】*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🏭 目标设备: *${targetMachine.machineName}* [${targetMachine.machineKey}]\n` +
        `👤 申请人: *${empName}* (SuperAdmin)\n\n` +
        `📋 *变更草案对比:*\n` +
        `${diffLines.join('\n')}\n\n` +
        `🔒 *双重安全防线 (2-Phase Verification):*\n` +
        `此操作将即时同步至车间现场操作工手机端！\n\n` +
        `👉 请回复您的 *4 位 SuperAdmin PIN 码* 确认立即执行。\n` +
        `👉 或回复 【*取消 / Batal*】 放弃本次修改。`;

      // Save pending payload in ai_prompt_configs
      await supabase.from('ai_prompt_configs').upsert({
        mode: pendingKey,
        prompt_template: JSON.stringify({
          machineKey: targetMachine.machineKey,
          machineName: targetMachine.machineName,
          changes: parsed.changes,
          requestedAt: new Date().toISOString()
        }),
        updated_at: new Date().toISOString(),
        updated_by: empName
      }, { onConflict: 'mode' });

      await sendWhatsAppText(fromNumber, confirmCard);
      return { handled: true, status: 'CONFIRMATION_REQUESTED' };

    } catch (err: any) {
      console.error('[WhatsApp Recipe AI Parse Error]:', err);
      await sendWhatsAppText(fromNumber, `❌ Gagal memproses pindaan recipe: ${err.message}`);
      return { handled: true, status: 'PARSE_ERROR' };
    }
  }

  return { handled: false, status: 'IGNORED' };
}
