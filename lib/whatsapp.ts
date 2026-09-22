/**
 * Meta WhatsApp Cloud API Helper Service
 * Provides outbound messaging and media download capabilities for Packsecure OS.
 */

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

export function getWhatsAppConfig(): WhatsAppConfig {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';

  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is not configured.');
  }

  return { phoneNumberId, accessToken };
}

/**
 * Normalizes phone numbers to international standard format without leading '+' or special chars.
 * E.g., '012-345 6789' in Malaysia -> '60123456789'
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '60' + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Send a plain text message via WhatsApp Cloud API
 */
export async function sendWhatsAppText(to: string, text: string): Promise<any> {
  const { phoneNumberId, accessToken } = getWhatsAppConfig();
  const recipient = normalizePhoneNumber(to);

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[WhatsApp] sendWhatsAppText failed:', data);
    throw new Error(data.error?.message || 'Failed to send WhatsApp text message');
  }

  return data;
}

/**
 * Marks an incoming WhatsApp message as read (triggers blue ticks on sender's phone)
 */
export async function markWhatsAppMessageAsRead(messageId: string): Promise<any> {
  try {
    const { phoneNumberId, accessToken } = getWhatsAppConfig();
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
    return await response.json();
  } catch (err) {
    console.warn('[WhatsApp] Failed to mark message as read:', err);
    return null;
  }
}

/**
 * Send an approved WhatsApp Template message
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'zh_CN',
  components?: any[]
): Promise<any> {
  const { phoneNumberId, accessToken } = getWhatsAppConfig();
  const recipient = normalizePhoneNumber(to);

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  if (components && components.length > 0) {
    payload.template.components = components;
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[WhatsApp] sendWhatsAppTemplate failed:', data);
    throw new Error(data.error?.message || 'Failed to send WhatsApp template message');
  }

  return data;
}

/**
 * Downloads media (image/audio/document) by its WhatsApp Media ID.
 * Returns { base64: string, mimeType: string } for direct use in Gemini vision/photo parsing.
 */
export async function downloadWhatsAppMediaAsBase64(mediaId: string): Promise<{ base64: string; mimeType: string }> {
  const { accessToken } = getWhatsAppConfig();

  // 1. Get media URL
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const metaData = await metaRes.json();
  if (!metaRes.ok || !metaData.url) {
    throw new Error(metaData.error?.message || 'Failed to retrieve media metadata');
  }

  const mimeType = metaData.mime_type || 'image/jpeg';

  // 2. Download binary
  const binaryRes = await fetch(metaData.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!binaryRes.ok) {
    throw new Error(`Failed to download media binary: ${binaryRes.statusText}`);
  }

  const arrayBuffer = await binaryRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { base64, mimeType };
}

export interface TripDispatchOrder {
  orderNumber: string;
  customer: string;
  deliveryAddress: string;
  phone?: string;
  itemsSummary?: string;
  stopSequence?: number;
}

export interface TripDispatchInfo {
  tripNumber: string;
  driverName?: string;
  vehiclePlate?: string;
  date?: string;
}

/**
 * Formats a comprehensive Malay dispatch schedule with Google Maps links for drivers.
 */
export function formatTripDispatchMessage(
  trip: TripDispatchInfo,
  orders: TripDispatchOrder[]
): string {
  const driver = trip.driverName || 'Pemandu';
  const lori = trip.vehiclePlate ? ` (${trip.vehiclePlate})` : '';
  const dateStr = trip.date || new Date().toLocaleDateString('en-GB');

  let text = `🚛 *Jadual Penghantaran Pek Laju*\n` +
    `Pemandu: *${driver}*${lori}\n` +
    `Trip: *${trip.tripNumber}* (${orders.length} Hantaran)\n` +
    `Tarikh: ${dateStr}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n`;

  const sortedOrders = [...orders].sort(
    (a, b) => (a.stopSequence || 0) - (b.stopSequence || 0)
  );

  sortedOrders.forEach((o, idx) => {
    const seq = o.stopSequence || idx + 1;
    const cleanAddr = o.deliveryAddress?.trim() || 'Alamat tidak dinyatakan';
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}`;

    text += `📍 *Stop ${seq}: ${o.customer}*\n` +
      `• DO: *${o.orderNumber}* ${o.itemsSummary ? `(${o.itemsSummary})` : ''}\n` +
      `• Alamat: ${cleanAddr}\n`;

    if (o.phone) {
      text += `• Tel: ${o.phone}\n`;
    }

    text += `🗺️ *Navigasi Google Maps:*\n${mapsLink}\n\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *Arahan Lapangan (SOP):*\n` +
    `1. Lepas selesai hantar barang, *ambil gambar DO yang sudah dicop/ditandatangan* & terus hantar ke sini.\n` +
    `2. Jika ada masalah (kedai tutup / xde orang / tayar pancit / lori rosak), terus maklumkan di sini!`;

  return text;
}

/**
 * Generates a copyable customer shipping notification template & direct wa.me link
 * (For sales/customer service/drivers to send via their personal WhatsApp if needed).
 */
export function generateCustomerShippedTemplate(
  customerName: string,
  orderNumber: string,
  customerPhone?: string,
  itemsSummary?: string
): { text: string; waMeLink?: string } {
  const text = `老板您好！您在 Pek Laju 采购的包装材料已装车发货啦！📦\n` +
    `• 单号: ${orderNumber} ${itemsSummary ? `(${itemsSummary})` : ''}\n` +
    `• 收货单位: ${customerName}\n` +
    `罗里司机正在配送途中，收到货后如有任何问题请随时联系我们，感谢您的支持！🙏`;

  let waMeLink = undefined;
  if (customerPhone) {
    const cleanPhone = normalizePhoneNumber(customerPhone);
    waMeLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }

  return { text, waMeLink };
}

/**
 * Generates a copyable customer delivery confirmation template & direct wa.me link
 */
export function generateCustomerDeliveredTemplate(
  customerName: string,
  orderNumber: string,
  customerPhone?: string,
  podPhotoUrl?: string
): { text: string; waMeLink?: string } {
  let text = `✅ *Pek Laju: 送达签收通知*\n\n` +
    `尊敬的 ${customerName}，您的订单 (*${orderNumber}*) 已由司机送达完成签收！\n` +
    `感谢您的信任与合作！祝生意兴隆！🎉`;

  if (podPhotoUrl) {
    text += `\n\n📄 *电子签收凭单 (POD):*\n${podPhotoUrl}`;
  }

  let waMeLink = undefined;
  if (customerPhone) {
    const cleanPhone = normalizePhoneNumber(customerPhone);
    waMeLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }

  return { text, waMeLink };
}
