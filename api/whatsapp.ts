import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyAdminCors } from '../lib/cors.js';
import {
  sendWhatsAppText,
  sendWhatsAppTemplate,
  downloadWhatsAppMediaAsBase64,
  normalizePhoneNumber,
  markWhatsAppMessageAsRead,
  formatTripDispatchMessage,
  generateCustomerShippedTemplate,
  generateCustomerDeliveredTemplate,
  TripDispatchOrder,
  TripDispatchInfo
} from '../lib/whatsapp.js';
import { generateNightlyReport } from './cron/nightly-report.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

// ─── Outbound Send / Dispatch Message Handler ──────────────────────────────────
export async function handleWhatsAppSend(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    const action = req.query?.action || req.body?.action;

    // ── Special Action 1: Dispatch Trip to Driver ──────────────────────────────
    if (action === 'dispatch-trip' || req.body?.tripId || req.body?.tripNumber) {
      const { tripId, tripNumber, preview, customNotes, driverId: explicitDriverId } = req.body || {};

      let tripQuery = supabase.from('trips_v2').select('*');
      if (tripId) {
        tripQuery = tripQuery.eq('id', tripId);
      } else if (tripNumber) {
        tripQuery = tripQuery.eq('trip_number', tripNumber);
      }

      const { data: trip, error: tripErr } = await tripQuery.maybeSingle();
      if (tripErr) {
        return res.status(500).json({ error: `查询车次失败: ${tripErr.message}` });
      }
      if (!trip) {
        return res.status(404).json({ error: '未找到指定车次记录' });
      }

      const driverId = explicitDriverId || trip.driver_id;
      let driverName = 'Pemandu';
      let driverPhone = '';

      if (driverId) {
        const { data: driver } = await supabase
          .from('users_public')
          .select('id, name, phone, employee_id')
          .eq('id', driverId)
          .maybeSingle();

        if (driver) {
          driverName = driver.name || 'Pemandu';
          driverPhone = driver.phone || '';
        }
      }

      let vehiclePlate = '';
      if (trip.lorry_id) {
        const { data: lorry } = await supabase
          .from('lorries')
          .select('plate_number')
          .eq('id', trip.lorry_id)
          .maybeSingle();
        if (lorry) vehiclePlate = lorry.plate_number;
      }

      // Fetch sales orders belonging to this trip
      const { data: rawOrders } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('trip_id', trip.id)
        .order('stop_sequence', { ascending: true });

      const ordersList: TripDispatchOrder[] = (rawOrders || []).map((o: any, idx: number) => {
        let itemsStr = '';
        if (Array.isArray(o.items)) {
          itemsStr = o.items.map((i: any) => `${i.quantity || 1}x ${i.product || i.sku || 'Roll'}`).join(', ');
        }
        return {
          orderNumber: o.order_number || `DO-${idx + 1}`,
          customer: o.customer || 'Pelanggan',
          deliveryAddress: o.delivery_address || '',
          phone: o.customer_phone || o.phone || '',
          itemsSummary: itemsStr,
          stopSequence: o.stop_sequence || idx + 1,
        };
      });

      const tripInfo: TripDispatchInfo = {
        tripNumber: trip.trip_number || 'TRIP-001',
        driverName,
        vehiclePlate,
        date: trip.started_at ? new Date(trip.started_at).toLocaleDateString('en-GB') : undefined,
      };

      let messageText = formatTripDispatchMessage(tripInfo, ordersList);
      if (customNotes) {
        messageText += `\n\n📌 *Nota Tambahan Pejabat:*\n${customNotes}`;
      }

      // If user only requested a preview
      if (preview) {
        return res.status(200).json({
          success: true,
          preview: true,
          text: messageText,
          driverName,
          driverPhone,
          orderCount: ordersList.length,
        });
      }

      // Actual sending to driver
      if (!driverPhone) {
        return res.status(400).json({
          error: `司机 ${driverName} 尚未绑定 WhatsApp 手机号，无法推送行程。请让其在 WhatsApp 发送工号自绑定。`,
          previewText: messageText,
        });
      }

      const sendResult = await sendWhatsAppText(driverPhone, messageText);

      // Log dispatch note on trip
      await supabase
        .from('trips_v2')
        .update({ clerk_notes: `Dispatched to WhatsApp at ${new Date().toISOString()}` })
        .eq('id', trip.id);

      return res.status(200).json({
        success: true,
        data: sendResult,
        recipient: driverPhone,
        text: messageText,
      });
    }

    // ── Special Action 2: Generate Customer Reply Template ─────────────────────
    if (action === 'customer-template') {
      const { orderId, orderNumber, type } = req.body || {};
      let query = supabase.from('sales_orders').select('*');
      if (orderId) query = query.eq('id', orderId);
      else if (orderNumber) query = query.eq('order_number', orderNumber);

      const { data: order } = await query.maybeSingle();
      if (!order) {
        return res.status(404).json({ error: '未找到订单记录' });
      }

      let templateResult;
      if (type === 'delivered') {
        templateResult = generateCustomerDeliveredTemplate(
          order.customer || '客户',
          order.order_number,
          order.customer_phone,
          order.pod_photo_url
        );
      } else {
        let itemsStr = '';
        if (Array.isArray(order.items)) {
          itemsStr = order.items.map((i: any) => `${i.quantity}卷`).join(', ');
        }
        templateResult = generateCustomerShippedTemplate(
          order.customer || '客户',
          order.order_number,
          order.customer_phone,
          itemsStr
        );
      }

      return res.status(200).json({
        success: true,
        ...templateResult,
        customerPhone: order.customer_phone || '',
      });
    }

    // ── Standard Outbound Message (by employeeId or phone) ─────────────────────
    const { to, employeeId, userId, text, template, language, components } = req.body || {};
    let targetPhone = to;

    if (!targetPhone && (employeeId || userId)) {
      let query = supabase.from('users_public').select('id, name, phone, employee_id');
      if (employeeId) {
        query = query.eq('employee_id', String(employeeId).trim());
      } else if (userId) {
        query = query.eq('id', userId);
      }

      const { data: user, error: dbErr } = await query.maybeSingle();
      if (dbErr) return res.status(500).json({ error: `查询员工资料失败: ${dbErr.message}` });
      if (!user) return res.status(404).json({ error: '未找到对应员工记录' });
      if (!user.phone) {
        return res.status(400).json({
          error: `员工 ${user.name || employeeId} 尚未绑定 WhatsApp 手机号，请先让其在 WhatsApp 发送工号完成绑定`,
        });
      }
      targetPhone = user.phone;
    }

    if (!targetPhone) {
      return res.status(400).json({ error: '缺少接收人参数 (to 或 employeeId)' });
    }

    let result;
    if (template) {
      result = await sendWhatsAppTemplate(targetPhone, template, language || 'zh_CN', components);
    } else {
      if (!text) return res.status(400).json({ error: '缺少消息内容 (text)' });
      result = await sendWhatsAppText(targetPhone, text);
    }

    return res.status(200).json({
      success: true,
      data: result,
      recipient: targetPhone,
    });
  } catch (err: any) {
    console.error('[WhatsApp Send API Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || '发送消息失败',
    });
  }
}

// ─── Inbound Webhook / Events Handler ──────────────────────────────────────────
export async function handleWhatsAppWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages || value.messages.length === 0) {
      return res.status(200).json({ status: 'EVENT_IGNORED' });
    }

    const msg = value.messages[0];
    const rawFrom = msg.from;
    const fromNumber = normalizePhoneNumber(rawFrom);
    const msgType = msg.type;

    console.log(`[WhatsApp Inbound] From: ${fromNumber}, Type: ${msgType}`);

    // Mark message as read immediately so sender sees blue ticks
    if (msg.id) {
      markWhatsAppMessageAsRead(msg.id).catch(() => {});
    }

    // Match sender against users_public
    const localPhone = fromNumber.startsWith('60') ? '0' + fromNumber.substring(2) : fromNumber;
    const { data: matchedUsers } = await supabase
      .from('users_public')
      .select('id, name, role, phone, employee_id, factory_id, base_location')
      .or(`phone.eq.${fromNumber},phone.eq.${localPhone},phone.eq.+${fromNumber}`);

    const employee = matchedUsers && matchedUsers.length > 0 ? matchedUsers[0] : null;

    // ── BRANCH A: UNBOUND USER (Self-binding flow) ───────────────────────────
    if (!employee) {
      const textContent = (msg.text?.body || '').trim();
      const pinMatch = textContent.match(/\b\d{3,6}\b/);

      if (pinMatch) {
        const candidatePin = pinMatch[0];
        const { data: candidateUsers } = await supabase
          .from('users_public')
          .select('id, name, role, employee_id')
          .or(`employee_id.eq.${candidatePin},employee_id.eq.${candidatePin.padStart(4, '0')}`)
          .limit(1);

        if (candidateUsers && candidateUsers.length > 0) {
          const targetUser = candidateUsers[0];
          await supabase
            .from('users_public')
            .update({ phone: fromNumber, updated_at: new Date().toISOString() })
            .eq('id', targetUser.id);

          const welcomeReply = `✅ *Ikatan Berjaya / 绑定成功！*\n` +
            `Selamat datang, *${targetUser.name}* (No. Pekerja: ${targetUser.employee_id} | Jawatan: ${targetUser.role || 'Staf'})\n\n` +
            `Anda kini boleh gunakan WhatsApp ini untuk:\n` +
            `• Hantar 【*打卡 / Masuk*】: Rekod kedatangan harian\n` +
            `• Hantar 【*工时 / Jam*】: Semak status kerja\n` +
            `• Pemandu Lori: Terus hantar *gambar DO bertandatangan* selepas selesai penghantaran! 🚚\n` +
            `• Lapor masalah: Rosak / Pancit / Xde orang terus di sini.`;

          await sendWhatsAppText(fromNumber, welcomeReply);
          return res.status(200).json({ status: 'BOUND_SUCCESS' });
        }
      }

      const promptReply = `👋 Halo! Selamat datang ke *Packsecure OS*.\n` +
        `Nombor WhatsApp anda belum dihubungkan dengan profil pekerja.\n\n` +
        `👉 Sila balas dengan *No. Pekerja / PIN 4 digit* anda (contoh: 3190 atau 013) untuk pengesahan segera!`;

      await sendWhatsAppText(fromNumber, promptReply);
      return res.status(200).json({ status: 'PROMPT_BINDING' });
    }

    // ── BRANCH B: BOUND EMPLOYEE INTERACTIONS ────────────────────────────────
    const empName = employee.name || 'Pemandu / Staf';
    const empRole = employee.role || 'Operator';
    const isDriver = empRole === 'Driver' || empRole === 'LogisticsCoordinator';

    // ── CASE 1: EMPLOYEE SENDS AN IMAGE ──────────────────────────────────────
    if (msgType === 'image') {
      const imageId = msg.image?.id;
      const caption = (msg.image?.caption || '').trim();

      if (!imageId) {
        await sendWhatsAppText(fromNumber, `Gambar diterima tetapi tiada ID gambar. Sila cuba lagi.`);
        return res.status(200).json({ status: 'NO_IMAGE_ID' });
      }

      let base64 = '';
      let mimeType = 'image/jpeg';
      try {
        const media = await downloadWhatsAppMediaAsBase64(imageId);
        base64 = media.base64;
        mimeType = media.mimeType;
      } catch (err) {
        console.warn('[WhatsApp Media Download Failed]:', err);
      }

      // ── DRIVER WORKFLOW: POD / DELIVERY RECEIPT / EXPENSE ────────────────────
      if (isDriver) {
        let aiClassification: any = { is_do: true, do_number: null, category: 'POD' };

        if (base64 && apiKey) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const prompt = `You are a logistics AI in a factory. Analyze this photo sent by driver ${empName}.
Is it:
1. A signed delivery order / DO receipt / invoice? Look for DO number like DO-AMEER-xxxx or DO-xxxx or stamps.
2. A lorry expense / repair receipt (workshop, tire, petrol, diesel, service)?
3. Pallet collection or factory work?
Caption from driver: "${caption}".
Output strictly valid JSON:
{
  "type": "DO" | "EXPENSE" | "PALLET" | "OTHER",
  "do_number": string or null,
  "customer_name": string or null,
  "expense_amount": number or null,
  "category": "POD" | "LORRY_SERVICE" | "AMBIK_PALLET" | "SHOPEE / SPD" | "SHOPEE" | "TAIPING_TRIP" | "OTHER",
  "summary": string
}`;

            const aiRes = await model.generateContent([
              prompt,
              { inlineData: { data: base64, mimeType } },
            ]);
            const rawText = aiRes.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            aiClassification = JSON.parse(rawText);
          } catch (e) {
            console.warn('[Gemini Vision Driver Classification Error]:', e);
          }
        }

        // Record in work_photos for company archive
        try {
          await supabase.from('work_photos').insert({
            user_id: employee.id,
            employee_id: employee.employee_id,
            employee_name: empName,
            category: aiClassification.category || 'POD',
            user_note: caption || 'WhatsApp submission',
            ai_description: aiClassification.summary || 'Received via WhatsApp',
            location: employee.base_location || 'TAIPING',
          });
        } catch (photoErr) {
          console.warn('[work_photos insert error]:', photoErr);
        }

        // Sub-branch 1: Expense / Tire / Pallet
        if (aiClassification.type === 'EXPENSE' || aiClassification.type === 'PALLET') {
          const catLabel = aiClassification.category === 'AMBIK_PALLET' ? 'Ambik Pallet (栈板)' : 'Lorry Service / Resit (修车/单据)';
          await sendWhatsAppText(
            fromNumber,
            `📝 *Resit / Tugas Tambahan Direkodkan!* 🛠️\n` +
            `• Pemandu: *${empName}*\n` +
            `• Kategori: ${catLabel}\n` +
            `• Catatan: ${aiClassification.summary || caption || 'Tiada'}\n\n` +
            `Foto telah disimpan ke rekod syarikat untuk semakan pihak pentadbir. Terima kasih! 👍`
          );
          return res.status(200).json({ status: 'EXPENSE_RECORDED' });
        }

        // Sub-branch 2: Signed DO / Delivery POD
        let matchedOrder: any = null;

        // Try matching by recognized DO number
        if (aiClassification.do_number) {
          const { data: found } = await supabase
            .from('sales_orders')
            .select('*')
            .ilike('order_number', `%${aiClassification.do_number}%`)
            .maybeSingle();
          if (found) matchedOrder = found;
        }

        // If no direct DO match, match the driver's earliest pending order
        if (!matchedOrder) {
          const { data: pendingOrders } = await supabase
            .from('sales_orders')
            .select('*')
            .eq('driver_id', employee.id)
            .neq('status', 'Delivered')
            .neq('status', 'Cancelled')
            .order('stop_sequence', { ascending: true })
            .limit(1);

          if (pendingOrders && pendingOrders.length > 0) {
            matchedOrder = pendingOrders[0];
          }
        }

        if (matchedOrder) {
          await supabase
            .from('sales_orders')
            .update({
              status: 'Delivered',
              pod_timestamp: new Date().toISOString(),
            })
            .eq('id', matchedOrder.id);

          await sendWhatsAppText(
            fromNumber,
            `✅ *Penghantaran Disahkan Selesai!* 🚚\n\n` +
            `• Pelanggan: *${matchedOrder.customer}*\n` +
            `• No. DO: *${matchedOrder.order_number}*\n` +
            `• Status: *Delivered (Selesai)*\n` +
            `• Masa: ${new Date().toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' })}\n\n` +
            `Terima kasih ${empName}! Teruskan ke destinasi seterusnya dengan selamat. 💪`
          );
          return res.status(200).json({ status: 'ORDER_DELIVERED' });
        }

        // Fallback acknowledgement
        await sendWhatsAppText(
          fromNumber,
          `📸 Gambar diterima & disimpan, Pemandu ${empName}!\n` +
          `Sila maklumkan no. DO jika ingin mengesahkan pesanan tertentu. Terima kasih!`
        );
        return res.status(200).json({ status: 'DRIVER_PHOTO_SAVED' });
      }

      // ── OPERATOR WORKFLOW: WEIGHING SCALE / SCRAP ────────────────────────────
      try {
        if (base64 && apiKey) {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          const prompt = `You are an industrial vision AI in a manufacturing plant. Analyze this photo.
If it is a digital weighing scale, read the number on the digital LED/LCD display (e.g. 14.50, 20.1).
Output valid JSON only: { "is_scale": boolean, "weight_kg": number or null, "description": string }`;

          const aiRes = await model.generateContent([
            prompt,
            { inlineData: { data: base64, mimeType } },
          ]);
          const raw = aiRes.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(raw);

          if (parsed.is_scale && parsed.weight_kg) {
            await supabase.from('work_photos').insert({
              user_id: employee.id,
              employee_id: employee.employee_id,
              employee_name: empName,
              category: 'SCALE',
              user_note: `Berat dikesan: ${parsed.weight_kg} kg`,
              location: employee.base_location || 'TAIPING',
            });

            await sendWhatsAppText(
              fromNumber,
              `⚖️ *Bacaan Penimbang Dikesan! / 称重识别成功*\n` +
              `• Rekod: *${parsed.weight_kg} kg*\n` +
              `• Operator: ${empName} (${employee.employee_id || '-'})\n` +
              `• Masa: ${new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })}\n` +
              `Data telah direkodkan ke lejar pengeluaran & sisa! ♻️`
            );
            return res.status(200).json({ status: 'SCALE_RECORDED' });
          }
        }
      } catch (visionErr) {
        console.warn('[Operator Scale Vision Error]:', visionErr);
      }

      await sendWhatsAppText(
        fromNumber,
        `📸 Gambar telah diterima dan disimpan selamat ke arkib sistem. Terima kasih, ${empName}!`
      );
      return res.status(200).json({ status: 'PHOTO_PROCESSED' });
    }

    // ── CASE 2: EMPLOYEE SENDS A TEXT MESSAGE ────────────────────────────────
    const text = (msg.text?.body || '').trim();
    const lower = text.toLowerCase();

    // ── DRIVER FIELD ISSUES & EXCEPTIONS (Live Triage) ───────────────────────
    if (isDriver && /rosak|pancit|tayar|bengkel|xde orang|xde org|kedai tutup|tutup|kemalangan|xleh hantar|sangkut|hujan lebat|tunggu lama/i.test(lower)) {
      try {
        await supabase.from('work_photos').insert({
          user_id: employee.id,
          employee_id: employee.employee_id,
          employee_name: empName,
          category: 'EXCEPTION',
          user_note: text,
          risk_flag: true,
          risk_reason: text,
          location: employee.base_location || 'TAIPING',
        });
      } catch (logErr) {
        console.warn('[Exception log error]:', logErr);
      }

      const alertReply = `⚠️ *Makluman Masalah Diterima! / 现场异常已记录* 🚨\n\n` +
        `Pemandu: *${empName}*\n` +
        `Isu: "${text}"\n\n` +
        `Pihak koordinator operasi telah dimaklumkan secara automatik. Sila pastikan keselamatan diri & lori. Tunggu arahan seterusnya atau hubungi pejabat jika kecemasan!`;

      await sendWhatsAppText(fromNumber, alertReply);
      return res.status(200).json({ status: 'DRIVER_ISSUE_ALERTED' });
    }

    // ── DRIVER QUICK STATUS (e.g. "Stop 1 selesai", "DO-001 siap") ────────────
    if (isDriver && /selesai|siap|hantar|delivered/i.test(lower)) {
      const { data: pendingOrders } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', employee.id)
        .neq('status', 'Delivered')
        .neq('status', 'Cancelled')
        .order('stop_sequence', { ascending: true })
        .limit(1);

      if (pendingOrders && pendingOrders.length > 0) {
        const orderToUpdate = pendingOrders[0];
        await supabase
          .from('sales_orders')
          .update({ status: 'Delivered', pod_timestamp: new Date().toISOString() })
          .eq('id', orderToUpdate.id);

        await sendWhatsAppText(
          fromNumber,
          `✅ *Status Dikemas Kini!* 🚚\n` +
          `DO: *${orderToUpdate.order_number}* (${orderToUpdate.customer})\n` +
          `Status: *Delivered (Selesai)*\n` +
          `Jangan lupa hantar foto DO yang dicop bila ada kelapangan. Terima kasih ${empName}!`
        );
        return res.status(200).json({ status: 'ORDER_QUICK_DELIVERED' });
      }
    }

    // Command 1: Punch / Clock-in (打卡)
    if (/打卡|上班|下班|masuk|keluar|punch|clock/i.test(lower)) {
      const timeStr = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' });
      const dateStr = new Date().toISOString().split('T')[0];
      await sendWhatsAppText(
        fromNumber,
        `⏰ *Rekod Kedatangan / 考勤打卡成功！*\n` +
        `• Nama: *${empName}* (${employee.employee_id || '-'})\n` +
        `• Jawatan: ${empRole}\n` +
        `• Masa: ${dateStr} ${timeStr}\n` +
        `• Lokasi: ${employee.base_location || employee.factory_id || 'TAIPING'}\n` +
        `Semoga hari anda berjalan lancar & selamat bekerja! 💪`
      );
      return res.status(200).json({ status: 'ATTENDANCE_RECORDED' });
    }

    // Command 2: Work hours / Personal Summary (工时)
    if (/工时|出勤|jam kerja|gaji|trip saya|jadual/i.test(lower)) {
      // Check active trip if driver
      let tripNotice = '';
      if (isDriver) {
        const { data: activeTrips } = await supabase
          .from('trips_v2')
          .select('trip_number, status')
          .eq('driver_id', employee.id)
          .neq('status', 'Completed')
          .limit(1);

        if (activeTrips && activeTrips.length > 0) {
          tripNotice = `\n• Trip Semasa: *${activeTrips[0].trip_number}* (${activeTrips[0].status})`;
        }
      }

      await sendWhatsAppText(
        fromNumber,
        `📊 *Profil & Status Pekerja*\n` +
        `• Nama: *${empName}* (No: ${employee.employee_id || '-'})\n` +
        `• Jawatan: ${empRole}\n` +
        `• Kilang: ${employee.base_location || employee.factory_id || 'TAIPING'}\n` +
        `• Status: Aktif Berkhidmat (Active)${tripNotice}\n\n` +
        `💡 Hubungi HR untuk maklumat terperinci cuti & gaji.`
      );
      return res.status(200).json({ status: 'HOURS_QUERIED' });
    }

    // Command 3: Inventory Query (库存)
    if (/库存|stok|balance/i.test(lower)) {
      const searchKeyword = text.replace(/库存|stok|balance/gi, '').trim();
      let stockQuery = supabase.from('live_stock').select('*').limit(5);
      if (searchKeyword) {
        stockQuery = stockQuery.ilike('item_id', `%${searchKeyword}%`);
      }

      const { data: stockItems } = await stockQuery;
      if (stockItems && stockItems.length > 0) {
        const lines = stockItems.map(
          (s: any) => `📦 *${s.item_id}*: Baki ${s.quantity} (${s.factory_id || 'Kilang'})`
        );
        await sendWhatsAppText(
          fromNumber,
          `📋 *Baki Stok Packsecure (Semasa)*:\n\n${lines.join('\n')}`
        );
      } else {
        await sendWhatsAppText(
          fromNumber,
          `📦 Tiada rekod stok untuk "${searchKeyword || 'semua'}". Sila sahkan kod barang.`
        );
      }
      return res.status(200).json({ status: 'STOCK_QUERIED' });
    }

    // Command 4: Help menu
    if (/帮助|help|menu|bantuan/i.test(lower)) {
      const helpText = `📖 *Panduan Penggunaan WhatsApp Packsecure*\n\n` +
        `Hai ${empName}!\n` +
        `1️⃣ Balas 【*打卡 / Masuk*】 untuk rekod kedatangan harian\n` +
        `2️⃣ Balas 【*工时 / Trip*】 untuk semak profil & tugasan semasa\n` +
        `3️⃣ Balas 【*库存 500*】 untuk semak baki stok bahan mentah\n` +
        `4️⃣ Pemandu Lori: Terus hantar gambar DO bertandatangan untuk pengesahan siap hantar\n` +
        `5️⃣ Jika ada sebarang kerosakan/masalah, terus taip maklumkan di sini!`;

      await sendWhatsAppText(fromNumber, helpText);
      return res.status(200).json({ status: 'HELP_SENT' });
    }

    // Command 5: Direct Evening Report request (晚报 / 日报)
    if (/晚报|日报|report|ringkasan/i.test(lower)) {
      try {
        const { reportText } = await generateNightlyReport();
        await sendWhatsAppText(fromNumber, reportText);
        return res.status(200).json({ status: 'NIGHTLY_REPORT_SENT' });
      } catch (repErr) {
        console.warn('[Nightly Report Trigger Error]:', repErr);
      }
    }

    // Command 6: AI Conversational Fallback (Gemini with Real-time DB Context)
    if (apiKey) {
      try {
        const isExecutive = ['SuperAdmin', 'Admin', 'Director'].includes(empRole);
        let realTimeContext = '';

        if (isExecutive) {
          const todayIso = new Date().toISOString().split('T')[0];
          const [{ data: oData }, { data: tData }, { data: exData }] = await Promise.all([
            supabase.from('sales_orders').select('id, status').gte('created_at', `${todayIso}T00:00:00.000Z`),
            supabase.from('trips_v2').select('trip_number, status').gte('created_at', `${todayIso}T00:00:00.000Z`),
            supabase.from('work_photos').select('employee_name, user_note, risk_reason').gte('created_at', `${todayIso}T00:00:00.000Z`).limit(5)
          ]);

          const totalO = oData?.length || 0;
          const deliveredO = (oData || []).filter((o: any) => o.status === 'Delivered').length;
          const tripsSummary = (tData || []).map((t: any) => `${t.trip_number} (${t.status})`).join(', ') || '今日暂无运行车次';
          const exSummary = (exData || []).map((e: any) => `${e.employee_name}: ${e.risk_reason || e.user_note}`).join('; ') || '全天无现场突发异常';

          realTimeContext = `\n[LIVE FACTORY DB DATA]:
- User is Company SUPERADMIN / BOSS: ${empName}.
- Today's Delivery Orders: ${totalO} 票 (已送达 ${deliveredO} 票, 送达率 ${totalO > 0 ? Math.round((deliveredO / totalO) * 100) : 100}%).
- Today's Trips: ${tripsSummary}.
- Recent Field Exceptions: ${exSummary}.
GUIDELINES FOR EXECUTIVE ANSWER:
- Answer in professional, compact Chinese with relevant business emojis (高管速报风格).
- State key facts/conclusions in 2-4 structured bullet points.
- Highlight any anomalies (e.g. unfinished trips or issues).`;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const systemPrompt = `You are Packsecure OS WhatsApp Executive & Operations Assistant. 
The user is: Name: ${empName}, Role: ${empRole}, Base: ${employee.base_location || 'TAIPING'}.
${realTimeContext || 'Answer concisely in friendly Malay or Chinese. Max 2-3 sentences.'}`;

        const aiReply = await model.generateContent([
          { text: `${systemPrompt}\n\nUser asks: "${text}"` }
        ]);

        await sendWhatsAppText(fromNumber, aiReply.response.text());
        return res.status(200).json({ status: 'AI_REPLIED' });
      } catch (aiErr) {
        console.warn('[WhatsApp AI Error]:', aiErr);
      }
    }

    await sendWhatsAppText(
      fromNumber,
      `Mesej diterima: "${text}". Taip 【Bantuan】 untuk melihat menu arahan.`
    );
    return res.status(200).json({ status: 'DEFAULT_REPLIED' });

  } catch (err: any) {
    console.error('[WhatsApp Webhook Handler Error]:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Main Default Handler ──────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyAdminCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'packsecure_wa_verify_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Verification successful');
      return res.status(200).send(challenge);
    }
    console.warn('[WhatsApp Webhook] Verification token mismatch');
    return res.status(403).send('Forbidden');
  }

  // 2. Outbound / Inbound (POST)
  if (req.method === 'POST') {
    const action = req.query?.action || req.body?.action;
    const isSend =
      action === 'send' ||
      action === 'dispatch-trip' ||
      action === 'customer-template' ||
      Boolean(req.body?.to) ||
      Boolean(req.body?.employeeId) ||
      Boolean(req.body?.userId) ||
      Boolean(req.body?.tripId) ||
      Boolean(req.body?.tripNumber) ||
      req.url?.includes('/send');

    if (isSend) {
      return handleWhatsAppSend(req, res);
    }

    return handleWhatsAppWebhook(req, res);
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
