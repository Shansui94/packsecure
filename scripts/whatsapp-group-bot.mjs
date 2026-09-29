/**
 * Packsecure OS — WhatsApp Web Group Agent & Automation Daemon
 * Runs Baileys WhatsApp Web session, auto-replies in groups, and exposes local IPC for MCP.
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import QRCodeImage from 'qrcode';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { handleSmartAgentQuery } from '../lib/whatsappSmartAgent.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Load .env
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

// Setup Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Setup Gemini AI
const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// Data directory for group cache & auth
const authDir = path.join(rootDir, 'auth_info_baileys');
const dataDir = path.join(rootDir, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const groupsCacheFile = path.join(dataDir, 'whatsapp_groups_cache.json');
const qrHtmlFile = path.join(rootDir, 'scan_qr_code.html');

let sock = null;
let currentGroups = [];
let connectionStatus = 'idle';

// Load cache if available
if (fs.existsSync(groupsCacheFile)) {
  try {
    currentGroups = JSON.parse(fs.readFileSync(groupsCacheFile, 'utf-8'));
  } catch (_) {}
}

/**
 * Write HTML file for easy browser-based QR scanning
 */
function saveQrAsHtml(qrString) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="8">
  <title>Packsecure WhatsApp Bot - Scan QR</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white; margin: 0; }
    .card { background: #1e293b; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 400px; }
    h2 { margin-top: 0; color: #38bdf8; }
    p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
    #qrcode { background: white; padding: 1rem; border-radius: 0.5rem; display: inline-block; margin: 1rem 0; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
</head>
<body>
  <div class="card">
    <h2>📱 Packsecure WhatsApp Bot</h2>
    <p>打开手机 WhatsApp -> <b>设置 / 已关联设备 (Linked Devices)</b> -> <b>关联设备</b> 扫描下方二维码：</p>
    <div id="qrcode"></div>
    <p>扫码绑定后此页面可关闭，凭据将保存在本地自动重连。</p>
  </div>
  <script>
    new QRCode(document.getElementById("qrcode"), {
      text: ${JSON.stringify(qrString)},
      width: 256,
      height: 256
    });
  </script>
</body>
</html>`;
  fs.writeFileSync(qrHtmlFile, html, 'utf-8');
  try {
    const pngPath1 = path.join(rootDir, 'whatsapp_qr.png');
    const pngPath2 = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\fdd87612-1449-40cb-b4ea-cba85f167082\\whatsapp_qr.png';
    QRCodeImage.toFile(pngPath1, qrString, { width: 360, margin: 2 }).catch(() => {});
    QRCodeImage.toFile(pngPath2, qrString, { width: 360, margin: 2 }).catch(() => {});
  } catch (_) {}
}

/**
 * Handle Inbound WhatsApp Message
 */
async function handleMessage(m) {
  if (!m.message || m.key.fromMe) return;

  const chatJid = m.key.remoteJid;
  const isGroup = chatJid.endsWith('@g.us');
  const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
  if (!text) return;

  const senderJid = m.key.participant || chatJid;
  const senderPhone = senderJid.replace(/[^0-9]/g, '');

  console.log(`[WA-Bot] Incoming (${isGroup ? 'Group' : 'DM'}): "${text}" from ${senderPhone}`);

  // In groups, only respond if message starts with ! or # or includes bot trigger
  const isTriggered = !isGroup || text.startsWith('!') || text.startsWith('#') || text.includes('@bot') || /查单|库存|晚报|配方/i.test(text);
  if (!isTriggered) return;

  const cleanText = text.replace(/^[!#@]\s*/, '').trim();

  // Command 1: Order Query (!查单 OPMxxxx)
  if (/^查单\s*(.+)/i.test(cleanText) || /^order\s*(.+)/i.test(cleanText)) {
    const match = cleanText.match(/^(?:查单|order)\s*(.+)/i);
    const orderNo = match ? match[1].trim() : '';

    if (!supabase) {
      await sock.sendMessage(chatJid, { text: '⚠️ 系统数据库连接未配置，无法查询订单。' }, { quoted: m });
      return;
    }

    const { data: order, error } = await supabase
      .from('sales_orders')
      .select('order_number, customer, status, delivery_date, items')
      .ilike('order_number', `%${orderNo}%`)
      .limit(1)
      .maybeSingle();

    if (error || !order) {
      await sock.sendMessage(chatJid, { text: `🔍 未找到订单号包含 "${orderNo}" 的记录，请核对单号。` }, { quoted: m });
      return;
    }

    let itemsSummary = '';
    if (Array.isArray(order.items)) {
      itemsSummary = order.items.map(i => `${i.product_name || i.item_id || '货品'}: ${i.quantity || 1}卷`).join('\n• ');
    }

    const reply = `📦 *订单状态查询成功*\n` +
      `• 单号: *${order.order_number}*\n` +
      `• 客户: *${order.customer}*\n` +
      `• 当前状态: *${order.status}*\n` +
      `• 预订送货日期: ${order.delivery_date || '未指定'}\n` +
      (itemsSummary ? `• 明细:\n• ${itemsSummary}` : '');

    await sock.sendMessage(chatJid, { text: reply }, { quoted: m });
    return;
  }

  // Command 2: Inventory Query (!库存 xxx)
  if (/^库存\s*(.*)/i.test(cleanText) || /^stok\s*(.*)/i.test(cleanText)) {
    const match = cleanText.match(/^(?:库存|stok)\s*(.*)/i);
    const keyword = match ? match[1].trim() : '';

    if (!supabase) {
      await sock.sendMessage(chatJid, { text: '⚠️ 数据库未配置。' }, { quoted: m });
      return;
    }

    let q = supabase.from('live_stock').select('*').limit(5);
    if (keyword) q = q.ilike('item_id', `%${keyword}%`);

    const { data: items } = await q;
    if (!items || items.length === 0) {
      await sock.sendMessage(chatJid, { text: `📦 暂未查到 "${keyword || '所有'}" 的库存数据。` }, { quoted: m });
      return;
    }

    const lines = items.map(s => `• *${s.item_id}*: 余量 ${s.quantity} (${s.factory_id || '厂区'})`);
    await sock.sendMessage(chatJid, { text: `📋 *Packsecure 实时库存*:\n\n${lines.join('\n')}` }, { quoted: m });
    return;
  }

  // Command 3: AI Conversational Query (Smart Agent with Multi-Turn Memory & DB Tools)
  try {
    const answer = await handleSmartAgentQuery({
      sessionId: chatJid,
      userText: cleanText,
      senderName: senderPhone ? `User-${senderPhone.slice(-4)}` : 'GroupMember',
      senderRole: isGroup ? 'OperationsGroup' : 'Operator',
      userPhone: senderPhone,
      baseLocation: 'TAIPING'
    });

    if (answer) {
      await sock.sendMessage(chatJid, { text: answer }, { quoted: m });
      return;
    }
  } catch (e) {
    console.warn('[WA-Bot SmartAgent Error]:', e.message);
  }

  // Default Fallback
  await sock.sendMessage(chatJid, {
    text: `👋 您好！我是 Packsecure 现场调度机器人。\n可发送：\n• 【!查单 OPM2609-0999】\n• 【!库存 500】\n• 【!晚报】`
  }, { quoted: m });
}

/**
 * Start Baileys Connection
 */
async function startBot() {
  console.log('🚀 Initializing WhatsApp Web Baileys session...');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.windows('Desktop'),
    syncFullHistory: false
  });

  const pairArg = process.argv.find(a => a.startsWith('--phone='));
  const pairPhone = (pairArg ? pairArg.split('=')[1] : process.env.WA_PHONE || '').replace(/[^0-9]/g, '');
  if (pairPhone && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        let normalized = pairPhone;
        if (normalized.startsWith('0')) normalized = '60' + normalized.slice(1);
        const code = await sock.requestPairingCode(normalized);
        console.log('\n======================================================');
        console.log(`🔑 手机号码 ${normalized} 的配对验证码: [ ${code} ]`);
        console.log('打开手机 WhatsApp -> 设置 -> 已关联设备 -> 用电话号码关联');
        console.log(`输入上面的 8 位验证码: ${code}`);
        console.log('======================================================\n');
      } catch (err) {
        console.warn('Pairing code request failed:', err.message);
      }
    }, 2500);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'waiting_qr';
      console.log('\n======================================================');
      console.log('📲 请使用手机 WhatsApp 扫描以下二维码登录关联设备：');
      console.log('======================================================\n');
      qrcode.generate(qr, { small: true });
      saveQrAsHtml(qr);
      console.log(`\n💡 也可以在浏览器中双击打开本地网页扫码:\n👉 ${qrHtmlFile}\n`);
    }

    if (connection === 'close') {
      connectionStatus = 'disconnected';
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(startBot, 5000);
      }
    } else if (connection === 'open') {
      connectionStatus = 'connected';
      console.log('\n🎉 ====================================================');
      console.log(`✅ WhatsApp Group Bot 已成功上线！已连接账号: ${sock.user?.id || 'Bot'}`);
      console.log('🎉 ====================================================\n');

      // Remove QR html after successful connection
      if (fs.existsSync(qrHtmlFile)) {
        try { fs.unlinkSync(qrHtmlFile); } catch (e) {}
      }

      // Fetch and cache groups
      try {
        const groups = await sock.groupFetchAllParticipating();
        currentGroups = Object.values(groups).map(g => ({
          id: g.id,
          subject: g.subject,
          creation: g.creation,
          owner: g.owner,
          size: g.participants?.length || 0
        }));
        fs.writeFileSync(groupsCacheFile, JSON.stringify(currentGroups, null, 2), 'utf-8');
        console.log(`📋 当前已加入 ${currentGroups.length} 个 WhatsApp 群聊，已缓存至 data/whatsapp_groups_cache.json`);
      } catch (gErr) {
        console.warn('Could not fetch initial groups:', gErr.message);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify') {
      for (const m of messages) {
        try {
          await handleMessage(m);
        } catch (err) {
          console.error('[WA-Bot Error handling message]:', err);
        }
      }
    }
  });
}

/**
 * Local IPC Server on 127.0.0.1:4005 for MCP integration
 */
function startIpcServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && req.url === '/status') {
      return res.end(JSON.stringify({
        success: true,
        status: connectionStatus,
        user: sock?.user || null,
        groupsCount: currentGroups.length,
        hasQrPending: fs.existsSync(qrHtmlFile),
        qrHtmlPath: qrHtmlFile
      }));
    }

    if (req.method === 'GET' && req.url === '/groups') {
      return res.end(JSON.stringify({ success: true, groups: currentGroups, status: connectionStatus }));
    }

    const urlObj = new URL(req.url, 'http://127.0.0.1:4005');
    if (urlObj.pathname === '/pairing-code') {
      let phone = urlObj.searchParams.get('phone') || '';
      const handlePair = async (targetPhone) => {
        targetPhone = (targetPhone || '').replace(/[^0-9]/g, '');
        if (targetPhone.startsWith('0')) targetPhone = '60' + targetPhone.slice(1);
        if (!targetPhone) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Missing phone' }));
        }
        if (!sock) {
          res.statusCode = 503;
          return res.end(JSON.stringify({ error: 'Bot is not ready' }));
        }
        try {
          const code = await sock.requestPairingCode(targetPhone);
          return res.end(JSON.stringify({ success: true, phone: targetPhone, pairingCode: code }));
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      };

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            handlePair(parsed.phone || phone);
          } catch (_) {
            handlePair(phone);
          }
        });
        return;
      } else {
        return handlePair(phone);
      }
    }

    if (req.method === 'POST' && req.url === '/send') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { groupId, message } = JSON.parse(body || '{}');
          if (!groupId || !message) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing groupId or message' }));
          }
          if (!sock) {
            res.statusCode = 503;
            return res.end(JSON.stringify({ error: 'WhatsApp bot is not connected yet' }));
          }

          const sent = await sock.sendMessage(groupId, { text: message });
          res.end(JSON.stringify({ success: true, messageId: sent.key.id }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(4005, '127.0.0.1', () => {
    console.log('🔌 Local WhatsApp Bot IPC API listening on http://127.0.0.1:4005');
  });
}

startIpcServer();
startBot();
