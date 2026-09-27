#!/usr/bin/env node

/**
 * Packsecure OS — WhatsApp Group MCP Server
 * Exposes WhatsApp Group management & messaging capabilities to Antigravity / Gemini via MCP (stdio).
 * Communicates with the local background daemon running at http://127.0.0.1:4005.
 */

const readline = require('readline');
const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const cacheFile = path.join(rootDir, 'data', 'whatsapp_groups_cache.json');
const qrHtmlFile = path.join(rootDir, 'scan_qr_code.html');

function makeRequest(apiPath, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 4005,
      path: apiPath,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request to WhatsApp Bot Daemon (127.0.0.1:4005) timed out'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function getBotStatus() {
  try {
    const res = await makeRequest('/status');
    return {
      daemonRunning: true,
      ...res.data
    };
  } catch (err) {
    const hasCache = fs.existsSync(cacheFile);
    const hasQr = fs.existsSync(qrHtmlFile);
    return {
      daemonRunning: false,
      status: 'offline',
      message: 'WhatsApp Bot Daemon is not running on port 4005. Launch it via: npm run bot:whatsapp',
      hasCache,
      hasQrPending: hasQr,
      qrHtmlPath: hasQr ? qrHtmlFile : null
    };
  }
}

async function listGroups() {
  try {
    const res = await makeRequest('/groups');
    if (res.data?.groups) {
      return {
        source: 'live_daemon',
        count: res.data.groups.length,
        groups: res.data.groups
      };
    }
  } catch (err) {
    // Daemon offline, try reading local cache
    if (fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        return {
          source: 'local_cache (daemon is offline)',
          count: cached.length,
          groups: cached,
          notice: 'Bot daemon is offline. Showing cached groups from last session. Run `npm run bot:whatsapp` to connect live.'
        };
      } catch (_) {}
    }
    return {
      error: 'Cannot reach WhatsApp Bot Daemon and no cache found.',
      solution: 'Start the daemon in another terminal: npm run bot:whatsapp'
    };
  }
}

async function sendGroupMessage(groupId, message) {
  try {
    const res = await makeRequest('/send', 'POST', { groupId, message });
    if (res.statusCode === 200 && res.data?.success) {
      return {
        success: true,
        groupId,
        messageId: res.data.messageId,
        preview: message
      };
    } else {
      return {
        success: false,
        error: res.data?.error || `HTTP ${res.statusCode}`
      };
    }
  } catch (err) {
    return {
      success: false,
      error: `WhatsApp Bot Daemon is offline (${err.message}). Start it with: npm run bot:whatsapp`
    };
  }
}

// MCP stdio Protocol Implementation
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
      capabilities: { tools: {} },
      serverInfo: {
        name: 'packsecure-whatsapp-group',
        version: '1.0.0'
      }
    });
  } else if (method === 'notifications/initialized') {
    // No-op
  } else if (method === 'ping') {
    sendResponse(id, {});
  } else if (method === 'tools/list') {
    sendResponse(id, {
      tools: [
        {
          name: 'get_whatsapp_bot_status',
          description: 'Check the live connection status of the WhatsApp Web Group Bot daemon (whether it is online, linked to your phone, or waiting for QR scan)',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'list_whatsapp_groups',
          description: 'List all WhatsApp groups that the user account / bot has joined, including group names (subject), JID IDs, and member counts',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'send_whatsapp_group_message',
          description: 'Send a message or announcement into a specific WhatsApp group using your existing WhatsApp account',
          inputSchema: {
            type: 'object',
            properties: {
              groupId: {
                type: 'string',
                description: 'The WhatsApp group JID (e.g. "120363048291029182@g.us")'
              },
              message: {
                type: 'string',
                description: 'The text message / announcement to send to the group'
              }
            },
            required: ['groupId', 'message']
          }
        },
        {
          name: 'request_whatsapp_pairing_code',
          description: 'Request an 8-character pairing code for phone number link (e.g. "0102328335" or "60102328335") to link without QR scanning',
          inputSchema: {
            type: 'object',
            properties: {
              phone: {
                type: 'string',
                description: 'Phone number to link (e.g. "0102328335")'
              }
            },
            required: ['phone']
          }
        }
      ]
    });
  } else if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      if (name === 'get_whatsapp_bot_status') {
        const status = await getBotStatus();
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }
          ]
        });
      } else if (name === 'list_whatsapp_groups') {
        const groups = await listGroups();
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(groups, null, 2)
            }
          ]
        });
      } else if (name === 'send_whatsapp_group_message') {
        const result = await sendGroupMessage(args.groupId, args.message);
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
      } else if (name === 'request_whatsapp_pairing_code') {
        const res = await makeRequest('/pairing-code', 'POST', { phone: args.phone });
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res.data, null, 2)
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
            text: `❌ WhatsApp Group MCP Error: ${err.message}`
          }
        ],
        isError: true
      });
    }
  }
});
