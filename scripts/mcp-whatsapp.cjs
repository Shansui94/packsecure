#!/usr/bin/env node

/**
 * Packsecure OS — WhatsApp MCP Server
 * Exposes outbound WhatsApp messaging tools via Model Context Protocol (stdio).
 */

const readline = require('readline');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables silently so stdout remains pure JSON-RPC
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';

function normalizePhoneNumber(phone) {
  let cleaned = String(phone).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '60' + cleaned.substring(1);
  }
  return cleaned;
}

async function sendWhatsAppText(to, text) {
  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is missing in .env');
  }

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
    throw new Error(data.error?.message || JSON.stringify(data));
  }
  return data;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(id, result, error = null) {
  const res = { jsonrpc: '2.0', id };
  if (error) {
    res.error = error;
  } else {
    res.result = result;
  }
  process.stdout.write(JSON.stringify(res) + '\n');
}

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    return;
  }

  const { id, method, params } = req;

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'packsecure-whatsapp',
        version: '1.0.0'
      }
    });
  } else if (method === 'notifications/initialized') {
    // Protocol notification - no response required
  } else if (method === 'ping') {
    sendResponse(id, {});
  } else if (method === 'tools/list') {
    sendResponse(id, {
      tools: [
        {
          name: 'send_whatsapp_message',
          description: 'Send a direct WhatsApp message to a recipient (driver, manager, supervisor, or customer) via Meta Cloud API',
          inputSchema: {
            type: 'object',
            properties: {
              to: {
                type: 'string',
                description: 'Recipient phone number (e.g. "0123456789" or "60123456789")'
              },
              message: {
                type: 'string',
                description: 'The plain text message content to send'
              }
            },
            required: ['to', 'message']
          }
        },
        {
          name: 'broadcast_whatsapp_notification',
          description: 'Send a WhatsApp notification/announcement to multiple recipients (e.g. list of managers or supervisors)',
          inputSchema: {
            type: 'object',
            properties: {
              recipients: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of recipient phone numbers'
              },
              message: {
                type: 'string',
                description: 'The notification message to send'
              }
            },
            required: ['recipients', 'message']
          }
        }
      ]
    });
  } else if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      if (name === 'send_whatsapp_message') {
        const res = await sendWhatsAppText(args.to, args.message);
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: `✅ WhatsApp message sent to ${args.to}! Meta Message ID: ${res.messages?.[0]?.id || 'OK'}`
            }
          ]
        });
      } else if (name === 'broadcast_whatsapp_notification') {
        const list = args.recipients || [];
        const results = [];
        for (const recipient of list) {
          try {
            const res = await sendWhatsAppText(recipient, args.message);
            results.push({ to: recipient, success: true, messageId: res.messages?.[0]?.id });
          } catch (err) {
            results.push({ to: recipient, success: false, error: err.message });
          }
        }
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: `📢 Broadcast dispatched to ${list.length} recipients:\n` + JSON.stringify(results, null, 2)
            }
          ]
        });
      } else {
        sendResponse(id, null, { code: -32601, message: `Tool not found: ${name}` });
      }
    } catch (err) {
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: `❌ WhatsApp Send Error: ${err.message}`
          }
        ],
        isError: true
      });
    }
  }
});
