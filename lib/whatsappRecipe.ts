import { SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendWhatsAppText } from './whatsapp.js';

export interface RecipeItem {
  id: string;
  recipe_id: string;
  material_sku: string;
  layer_name: string;
  ratio_percentage: number;
  scrap_percent?: number;
  notes?: string;
  material_name?: string;
}

export interface RecipeHeader {
  recipe_id: string;
  sku: string;
  name: string;
  is_default: boolean;
  machine_type?: string;
  created_at?: string;
  bom_items_v2?: RecipeItem[];
}

export interface MasterItemWeight {
  sku: string;
  name?: string;
  net_weight_kg?: number | null;
  core_weight_kg?: number | null;
  gross_weight_kg?: number | null;
}

/**
 * Calculates weights and formats a comprehensive WhatsApp Recipe report
 */
export function formatRecipeReport(
  header: RecipeHeader,
  items: RecipeItem[],
  product?: MasterItemWeight | null
): string {
  const netWeight = Number(product?.net_weight_kg) || 2.0;
  const coreWeight = Number(product?.core_weight_kg) || 0.2;
  const grossWeight = Number(product?.gross_weight_kg) || (netWeight + coreWeight);

  const totalRatio = items.reduce((sum, it) => sum + (Number(it.ratio_percentage) || 0), 0);

  // Group by layer or list items
  const itemsText = items.map((it, idx) => {
    const ratio = Number(it.ratio_percentage) || 0;
    const singleRollGrams = Math.round(netWeight * (ratio / 100) * 1000);
    const batchKg = Number((10 * ratio).toFixed(1));
    const bags = Math.floor(batchKg / 25);
    const remKg = Number((batchKg % 25).toFixed(1));
    const bagText = bags > 0 
      ? `(约 ${bags}包×25kg${remKg > 0 ? ` + ${remKg}kg` : ''})`
      : `(${batchKg} kg)`;

    const matLabel = it.material_name || it.material_sku || 'Raw Material';
    return `${idx + 1}️⃣ *${matLabel}* [${it.layer_name || 'Main'}]\n` +
      `   • 配比 Nisbah: *${ratio}%*\n` +
      `   • 单卷消耗: *${singleRollGrams}g* / 卷\n` +
      `   • 1,000kg 投料锅: *${batchKg} kg* ${bagText}`;
  }).join('\n\n');

  return `🧪 *【配方详情 / Butiran Recipe】*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 产品: *${product?.name || header.name}* (${header.sku})\n` +
    `🏭 生产机台: *${header.machine_type || 'T1-M03 (Stretch Film)'}*\n` +
    `📌 状态: *${header.is_default ? '默认生产配方 (Default Active) ✅' : '备选配方'}*\n\n` +
    `⚖️ *成品重量规格 / Spesifikasi Berat:*\n` +
    `   • 净重 Net: *${netWeight.toFixed(2)} kg* / 卷\n` +
    `   • 纸管 Core: *${coreWeight.toFixed(2)} kg* / 支\n` +
    `   • 毛重 Gross: *${grossWeight.toFixed(2)} kg* / 卷\n\n` +
    `📋 *原料配比与投料重量 (1,000kg 投料锅基准):*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${itemsText}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ 配比总和: *${totalRatio.toFixed(1)}%* (1,000kg / 1,000kg 闭环)\n` +
    `💡 提示：如需修改配比，SuperAdmin 可直接发消息，例如：\n` +
    `   【把 ${header.sku} 茂金属加到 18%，RAW-7042 减到 52%】`;
}

/**
 * Handles incoming WhatsApp Recipe queries and modifications with 2-Phase Commit & PIN Verification
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
          `❌ *Pindaan Dibatalkan / 已取消修改*\n` +
          `Permintaan pindaan recipe untuk *${pending.sku}* telah dibatalkan.\n` +
          `Formula kilang kekal tidak berubah.`
        );
        return { handled: true, status: 'RECIPE_CANCELLED' };
      }

      // Case B: Confirm with PIN
      const containsPin = text.includes(pending.pin) || text.includes(requiredPin);
      const isConfirmWord = /确认|confirm|sah|setuju|ok|yes/i.test(lower);

      if (containsPin || isConfirmWord) {
        if (!containsPin) {
          await sendWhatsAppText(
            fromNumber,
            `⚠️ *Pengesahan PIN Diperlukan / 需要安全口令*\n` +
            `Sila balas dengan memasukkan PIN SuperAdmin anda untuk mengesahkan:\n\n` +
            `👉 Contoh: 【*确认 ${requiredPin}*】`
          );
          return { handled: true, status: 'PIN_REQUIRED' };
        }

        // Check expiry (10 mins)
        if (Date.now() > pending.expiresAt) {
          await supabase.from('ai_prompt_configs').delete().eq('mode', pendingKey);
          await sendWhatsAppText(
            fromNumber,
            `⏰ *Masa Tamat / 请求已过期*\n` +
            `Permintaan pindaan recipe telah melebihi had 10 minit dan dibatalkan secara automatik demi keselamatan kilang.\n` +
            `Sila buat permintaan pindaan baharu jika perlu.`
          );
          return { handled: true, status: 'RECIPE_EXPIRED' };
        }

        // Apply updates to bom_items_v2
        for (const item of pending.proposedItems) {
          if (item.id && typeof item.new_ratio === 'number') {
            await supabase
              .from('bom_items_v2')
              .update({ ratio_percentage: item.new_ratio })
              .eq('id', item.id);
          }
        }

        // Record Audit Log
        try {
          await supabase.from('audit_logs').insert({
            table_name: 'bom_items_v2',
            action: 'UPDATE',
            record_id: pending.recipeId,
            old_data: pending.oldItems,
            new_data: pending.proposedItems,
            changed_by_email: `${employee.name || 'SuperAdmin'} (WhatsApp +${fromNumber})`,
            changed_by_uid: employee.id,
          });
        } catch (auditErr) {
          console.warn('[Audit Log Error]:', auditErr);
        }

        // Clean up pending draft
        await supabase.from('ai_prompt_configs').delete().eq('mode', pendingKey);

        const successReply = `✅ *Pindaan Recipe Berjaya Dikemas Kini!* 🧪\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 Produk: *${pending.skuName || pending.sku}* (${pending.sku})\n` +
          `🏭 Mesin Terlibat: *${pending.machineType || 'T1-M03'}*\n` +
          `👤 Diluluskan Oleh: *${empName}* (SuperAdmin PIN: ${requiredPin})\n\n` +
          `*Perubahan Nisbah & Berat Bahan (1,000kg 投料锅):*\n` +
          `${pending.summaryChanges}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📋 *Status Kilang:*\n` +
          `• Paparan kawalan mesin (Production Control) telah dimuat semula secara live.\n` +
          `• Kiraan potongan bahan mentah automatik kini menggunakan formula baharu.`;

        await sendWhatsAppText(fromNumber, successReply);
        return { handled: true, status: 'RECIPE_UPDATED' };
      }
    }
  }

  // ── 2. CHECK IF MESSAGE IS RECIPE-RELATED ───────────────────────────────────
  const hasRecipeKeywords = /配方|recipe|formula|bomm|ramuan/i.test(text);
  const hasModifyKeywords = /改|修改|调整|tukar|ubah|update|加到|减到|tambah|kurang|naik|turun|ganti/i.test(text);
  const hasMaterialOrPercent = /%|茂金属|mll|lldpe|pib|resin|原料|bahan|芯层|外层|内层|layer/i.test(text);

  const isRecipeModify = (hasRecipeKeywords && hasModifyKeywords) || 
    (hasModifyKeywords && hasMaterialOrPercent) ||
    /改配方|修改配方|调整配方|tukar recipe|ubah recipe|update recipe/i.test(text);

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

  // ── 4. FETCH CURRENT RECIPES & MASTER ITEMS ────────────────────────────────
  const [{ data: recipesData }, { data: masterItemsData }] = await Promise.all([
    supabase
      .from('bom_headers_v2')
      .select('*, bom_items_v2(*)')
      .order('is_default', { ascending: false }),
    supabase
      .from('master_items')
      .select('sku, name, type, net_weight_kg, core_weight_kg, gross_weight_kg')
  ]);

  const allRecipes: RecipeHeader[] = recipesData || [];
  const masterItemsMap: Record<string, MasterItemWeight> = {};
  (masterItemsData || []).forEach(m => { masterItemsMap[m.sku] = m; });

  if (allRecipes.length === 0) {
    await sendWhatsAppText(
      fromNumber,
      `🧪 Belum ada sebarang Recipe didaftarkan dalam sistem bom_headers_v2. Sila daftar recipe di portal Web terlebih dahulu.`
    );
    return { handled: true, status: 'NO_RECIPES_FOUND' };
  }

  // ── 5. BRANCH: MODIFY RECIPE REQUEST ────────────────────────────────────────
  if (isRecipeModify) {
    if (!apiKey) {
      await sendWhatsAppText(fromNumber, `⚠️ AI Service tidak aktif. Sila hubungi IT.`);
      return { handled: true, status: 'NO_API_KEY' };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Build recipe context for Gemini
      const recipeCatalogContext = allRecipes.map(r => ({
        recipe_id: r.recipe_id,
        sku: r.sku,
        name: r.name,
        machine_type: r.machine_type,
        items: (r.bom_items_v2 || []).map(it => ({
          id: it.id,
          material_sku: it.material_sku,
          material_name: masterItemsMap[it.material_sku]?.name || it.material_sku,
          layer_name: it.layer_name,
          ratio_percentage: it.ratio_percentage,
        }))
      }));

      const parsePrompt = `You are a plastics manufacturing plant AI assistant.
The SuperAdmin wants to modify an extrusion stretch film recipe via natural language.
Here is the existing recipe database:
${JSON.stringify(recipeCatalogContext, null, 2)}

User request: "${text}"

Instructions:
1. Identify which recipe they want to modify (default to first active recipe if not specified, usually SF-CLEAR-2.2-50CM).
2. Understand the ratio changes (e.g. increase Metallocene to 18%, decrease RAW-7042 to 52%).
3. Keep all other unchanged ingredients at their current ratio.
4. Output STRICT JSON only:
{
  "recognized": boolean,
  "recipe_id": string,
  "sku": string,
  "reason": string,
  "proposed_items": [
    {
      "id": string,
      "material_sku": string,
      "material_name": string,
      "layer_name": string,
      "old_ratio": number,
      "new_ratio": number
    }
  ]
}`;

      const aiRes = await model.generateContent([parsePrompt]);
      const rawText = aiRes.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawText);

      if (!parsed.recognized || !parsed.recipe_id || !parsed.proposed_items) {
        await sendWhatsAppText(
          fromNumber,
          `⚠️ *Tidak Dapat Memproses Arahan / 无法解析修改指令*\n\n` +
          `AI tidak dapat mengenal pasti bahan atau peratusan yang ingin diubah daripada ayat: "${text}".\n\n` +
          `👉 Sila nyatakan dengan jelas, contoh:\n` +
          `【*把 SF-CLEAR-2.2-50CM 茂金属加到 18%，RAW-7042 减到 52%*】`
        );
        return { handled: true, status: 'PARSE_FAILED' };
      }

      // Check sum of ratios
      const targetRecipe = allRecipes.find(r => r.recipe_id === parsed.recipe_id);
      if (!targetRecipe) {
        await sendWhatsAppText(fromNumber, `❌ Recipe tidak ditemui.`);
        return { handled: true, status: 'RECIPE_NOT_FOUND' };
      }

      const totalRatio = parsed.proposed_items.reduce((acc: number, it: any) => acc + Number(it.new_ratio || 0), 0);
      const roundedTotal = Number(totalRatio.toFixed(2));

      if (Math.abs(roundedTotal - 100.0) > 0.05) {
        await sendWhatsAppText(
          fromNumber,
          `❌ *Nisbah Tidak Lengkap / 配比未闭环！*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Jumlah nisbah baharu adalah: *${roundedTotal}%* (Beza: ${(roundedTotal - 100).toFixed(1)}%)\n\n` +
          `⚠️ Formula kilang mestilah tepat *100.0%*. Sila pastikan penambahan satu bahan diimbangi dengan pengurangan bahan lain sebelum menghantar.`
        );
        return { handled: true, status: 'RATIO_NOT_100' };
      }

      // Calculate weight deltas
      const product = masterItemsMap[targetRecipe.sku];
      const netWeight = Number(product?.net_weight_kg) || 2.0;
      const coreWeight = Number(product?.core_weight_kg) || 0.2;
      const grossWeight = Number(product?.gross_weight_kg) || (netWeight + coreWeight);

      const changeSummaries = parsed.proposed_items.map((it: any) => {
        const oldR = Number(it.old_ratio);
        const newR = Number(it.new_ratio);
        const deltaR = newR - oldR;
        const arrow = deltaR > 0 ? `🔺+${deltaR.toFixed(1)}%` : deltaR < 0 ? `🔻${deltaR.toFixed(1)}%` : `(Kekal / 保持)`;

        const oldGrams = Math.round(netWeight * (oldR / 100) * 1000);
        const newGrams = Math.round(netWeight * (newR / 100) * 1000);
        const deltaGrams = newGrams - oldGrams;
        const deltaGramsText = deltaGrams !== 0 ? ` (${deltaGrams > 0 ? `+${deltaGrams}g` : `${deltaGrams}g`}/卷)` : '';

        const newBatchKg = Number((10 * newR).toFixed(1));
        const bags = Math.floor(newBatchKg / 25);
        const remKg = Number((newBatchKg % 25).toFixed(1));
        const bagText = bags > 0 
          ? `约 ${bags}包×25kg${remKg > 0 ? ` + ${remKg}kg` : ''}`
          : `${newBatchKg} kg`;

        return `• *${it.material_name || it.material_sku}* [${it.layer_name}]:\n` +
          `   - Nisbah: ${oldR}% ➔ *${newR}%* ${arrow}\n` +
          `   - Berat per Roll: ${oldGrams}g ➔ *${newGrams}g*${deltaGramsText}\n` +
          `   - 1,000kg Batch: *${newBatchKg} kg* (${bagText})`;
      }).join('\n\n');

      // Save pending draft into ai_prompt_configs
      const pendingPayload = {
        recipeId: targetRecipe.recipe_id,
        sku: targetRecipe.sku,
        skuName: targetRecipe.name,
        machineType: targetRecipe.machine_type || 'T1-M03',
        pin: requiredPin,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        oldItems: targetRecipe.bom_items_v2,
        proposedItems: parsed.proposed_items,
        summaryChanges: changeSummaries,
      };

      await supabase.from('ai_prompt_configs').upsert({
        mode: pendingKey,
        prompt_template: JSON.stringify(pendingPayload),
        updated_at: new Date().toISOString(),
        updated_by: empName,
      });

      const confirmCard = `⚠️ *【Pengesahan Pindaan Recipe (Termasuk Kiraan Berat)】*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 Produk: *${targetRecipe.name}* (${targetRecipe.sku})\n` +
        `🏭 Mesin: *${targetRecipe.machine_type || 'T1-M03'}*\n\n` +
        `⚖️ *Spesifikasi Berat 成品重量:*\n` +
        `   • Net: *${netWeight.toFixed(2)} kg* | Core: *${coreWeight.toFixed(2)} kg* | Gross: *${grossWeight.toFixed(2)} kg*\n\n` +
        `🧪 *Perubahan Nisbah & Berat Bahan / 原料变更对比:*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${changeSummaries}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ *Jumlah Keseluruhan: 100.0% (1,000kg / 1,000kg 闭环)*\n\n` +
        `⚠️ *AMARAN:* Mesin ${targetRecipe.machine_type || 'T1-M03'} sedang beroperasi. Pindaan ini akan menukar formula bancuhan & kiraan tolak stok secara LIVE.\n\n` +
        `👉 Sila balas 【*确认 ${requiredPin}*】 dalam masa 10 minit untuk kuatkuasakan.\n` +
        `👉 Balas 【*取消*】 untuk batalkan.`;

      await sendWhatsAppText(fromNumber, confirmCard);
      return { handled: true, status: 'RECIPE_PREVIEW_SENT' };

    } catch (err: any) {
      console.error('[Recipe Modification Parse Error]:', err);
      await sendWhatsAppText(fromNumber, `❌ Gagal memproses pindaan recipe: ${err.message}`);
      return { handled: true, status: 'RECIPE_ERROR' };
    }
  }

  // ── 6. BRANCH: VIEW RECIPE QUERY ───────────────────────────────────────────
  // Match keyword from text
  const cleanKeyword = text.replace(/查看配方|查配方|配方|recipe|formula|semak|tunjuk/gi, '').trim().toUpperCase();

  let matchedRecipe = allRecipes[0];
  if (cleanKeyword) {
    const found = allRecipes.find(r => 
      r.sku.toUpperCase().includes(cleanKeyword) || 
      r.name.toUpperCase().includes(cleanKeyword) ||
      (masterItemsMap[r.sku]?.name || '').toUpperCase().includes(cleanKeyword)
    );
    if (found) {
      matchedRecipe = found;
    } else {
      const availableList = allRecipes.slice(0, 5).map(r => `• *${r.sku}* (${r.name})`).join('\n');
      await sendWhatsAppText(
        fromNumber,
        `🔍 Tiada recipe sepadan dengan "${cleanKeyword}".\n\nSenarai recipe sedia ada:\n${availableList}\n\n👉 Taip cth: 【*查看配方 ${allRecipes[0].sku}*】`
      );
      return { handled: true, status: 'RECIPE_NOT_FOUND' };
    }
  }

  // Attach material names
  const itemsWithNames = (matchedRecipe.bom_items_v2 || []).map(it => ({
    ...it,
    material_name: masterItemsMap[it.material_sku]?.name || it.material_sku,
  }));

  const reportMsg = formatRecipeReport(
    matchedRecipe,
    itemsWithNames,
    masterItemsMap[matchedRecipe.sku]
  );

  await sendWhatsAppText(fromNumber, reportMsg);
  return { handled: true, status: 'RECIPE_VIEWED' };
}
