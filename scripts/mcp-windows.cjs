#!/usr/bin/env node

/**
 * Packsecure OS — Windows MCP Server
 * Exposes native Windows Desktop and Hardware Automation tools via Model Context Protocol (stdio).
 */

const readline = require('readline');
const os = require('os');
const { exec, execFile } = require('child_process');

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    // Encode script as base64 for PowerShell -EncodedCommand to avoid any escaping issues
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Display native Windows 10/11 Toast Notification
 */
async function showToast(title, message) {
  const psScript = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$textNodes = $template.GetElementsByTagName("text")
$textNodes.Item(0).AppendChild($template.CreateTextNode(${JSON.stringify(title)})) > $null
$textNodes.Item(1).AppendChild($template.CreateTextNode(${JSON.stringify(message)})) > $null
$toast = [Windows.UI.Notifications.ToastNotification]::new($template)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Packsecure OS").Show($toast)
`;
  await runPowerShell(psScript);
  return true;
}

/**
 * Play native Windows System Sound
 */
async function playSound(type = 'exclamation') {
  let soundMethod = '[System.Media.SystemSounds]::Exclamation.Play()';
  if (type === 'beep') soundMethod = '[System.Console]::Beep(800, 300)';
  else if (type === 'hand' || type === 'error') soundMethod = '[System.Media.SystemSounds]::Hand.Play()';
  else if (type === 'asterisk') soundMethod = '[System.Media.SystemSounds]::Asterisk.Play()';

  await runPowerShell(soundMethod);
  return true;
}

/**
 * List COM Ports / Connected Serial Devices (electronic scales, label printers)
 */
async function listSerialPorts() {
  const psScript = `
$ports = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | Select-Object Name, DeviceID, Manufacturer, Status
if ($ports) {
    $ports | ConvertTo-Json -Compress
} else {
    "[]"
}
`;
  try {
    const raw = await runPowerShell(psScript);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return [{ error: e.message }];
  }
}

/**
 * Collect Windows System Health Metrics
 */
async function getSystemMetrics() {
  const totalMemGB = (os.totalmem() / (1024 ** 3)).toFixed(2);
  const freeMemGB = (os.freemem() / (1024 ** 3)).toFixed(2);
  const uptimeHours = (os.uptime() / 3600).toFixed(1);

  let diskInfo = 'N/A';
  try {
    const psScript = `
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace/1GB, 2)}}, @{Name="TotalGB";Expression={[math]::Round($_.Size/1GB, 2)}} | ConvertTo-Json -Compress
`;
    const diskRaw = await runPowerShell(psScript);
    diskInfo = JSON.parse(diskRaw || '[]');
  } catch (e) {
    diskInfo = e.message;
  }

  return {
    platform: os.platform(),
    release: os.release(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Generic',
    totalMemoryGB: totalMemGB,
    freeMemoryGB: freeMemGB,
    uptimeHours: `${uptimeHours} hours`,
    disks: diskInfo
  };
}

/**
 * Control local logged-in WhatsApp Desktop application
 */
async function controlDesktopWhatsApp(message, autoSend = false, phone = null) {
  let psScript = '';
  if (phone) {
    let cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '60' + cleanPhone.slice(1);
    psScript = `
Start-Process "whatsapp://send?phone=${cleanPhone}"
Start-Sleep -Milliseconds 1200
Set-Clipboard -Value ${JSON.stringify(message)}
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^v${autoSend ? '{ENTER}' : ''}")
`;
  } else {
    // Bring currently active WhatsApp chat window (e.g. OPM (MAIN)) to front and paste
    psScript = `
Start-Process "whatsapp://"
Start-Sleep -Milliseconds 800
Set-Clipboard -Value ${JSON.stringify(message)}
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^v${autoSend ? '{ENTER}' : ''}")
`;
  }
  await runPowerShell(psScript);
  return {
    success: true,
    action: autoSend ? 'sent' : 'drafted_in_input_box',
    target: phone || 'active_chat',
    preview: message
  };
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
      capabilities: { tools: {} },
      serverInfo: {
        name: 'packsecure-windows',
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
          name: 'show_toast_notification',
          description: 'Show a native Windows desktop Toast Notification in the bottom-right corner of the user screen with sound',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Notification title (e.g. "Packsecure Alert")'
              },
              message: {
                type: 'string',
                description: 'Notification message text'
              }
            },
            required: ['title', 'message']
          }
        },
        {
          name: 'play_system_alert',
          description: 'Play a native Windows audible system alert sound (exclamation, beep, hand/error, asterisk)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['exclamation', 'beep', 'error', 'asterisk'],
                description: 'Alert sound type'
              }
            }
          }
        },
        {
          name: 'list_serial_ports',
          description: 'Detect and list all connected COM / Serial ports and hardware devices (e.g. weighing scales, barcode scanners, printers)',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_windows_system_metrics',
          description: 'Inspect Windows system health, CPU, RAM usage, storage disk free space, and uptime',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'control_desktop_whatsapp',
          description: 'Directly control the locally opened and logged-in WhatsApp Desktop application on this Windows PC. Can draft or send text into the currently active chat (or jump to a specific contact phone).',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The message text to type or send'
              },
              autoSend: {
                type: 'boolean',
                description: 'If false (default), pastes the message into the chat input box as a draft for review. If true, simulates pressing Enter to send immediately.'
              },
              phone: {
                type: 'string',
                description: 'Optional recipient phone number (e.g. 0102328335). If omitted, types directly into the currently active chat (like the open group chat).'
              }
            },
            required: ['message']
          }
        }
      ]
    });
  } else if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      if (name === 'control_desktop_whatsapp') {
        const res = await controlDesktopWhatsApp(args.message, args.autoSend || false, args.phone || null);
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2)
            }
          ]
        });
      } else if (name === 'show_toast_notification') {
        await showToast(args.title, args.message);
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: `🔔 Windows Toast notification displayed: [${args.title}] ${args.message}`
            }
          ]
        });
      } else if (name === 'play_system_alert') {
        await playSound(args?.type || 'exclamation');
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: `🔊 Windows sound played (${args?.type || 'exclamation'})`
            }
          ]
        });
      } else if (name === 'list_serial_ports') {
        const ports = await listSerialPorts();
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ports, null, 2)
            }
          ]
        });
      } else if (name === 'get_windows_system_metrics') {
        const metrics = await getSystemMetrics();
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(metrics, null, 2)
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
            text: `❌ Windows Tool Error: ${err.message}`
          }
        ],
        isError: true
      });
    }
  }
});
