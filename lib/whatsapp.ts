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
