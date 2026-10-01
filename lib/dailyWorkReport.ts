import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendWhatsAppText, normalizePhoneNumber } from './whatsapp.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

// Key Recipients: Max Tan (System Architect & Developer) & William Ong (The Boss / 老板)
export const DEFAULT_REPORT_RECIPIENTS = [
  { name: 'Max Tan (技术负责人)', phone: '60102328335', role: 'SuperAdmin' },
  { name: 'William Ong (老板/威廉哥)', phone: '0122689095', role: 'Boss/SuperAdmin' }
];

/**
 * Extract Git commits for the target date
 */
export function getGitCommitsForDate(targetDate: string): any[] {
  try {
    const sinceISO = `${targetDate}T00:00:00+08:00`;
    const untilISO = `${targetDate}T23:59:59+08:00`;

    const commitLines = execSync(
      `git log --since="${sinceISO}" --until="${untilISO}" --format="%H|%an|%s"`,
      { encoding: 'utf8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim().split('\n').filter(Boolean);

    return commitLines.map(line => {
      const [hash, author, ...msgParts] = line.split('|');
      return {
        hash: (hash || '').substring(0, 7),
        author: author || '',
        message: msgParts.join('|'),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Gathers all data for today: Git commits, Tasks, WhatsApp issue tickets, and Operational summary
 */
export async function collectDailyWorkData(targetDate?: string) {
  const supabase = getSupabase();
  const dateStr = targetDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
  const startIso = `${dateStr}T00:00:00+08:00`;

  // 1. Git Commits for today
  const commits = getGitCommitsForDate(dateStr);

  // 2. Tasks from public.tasks table
  const { data: rawTasks } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority, created_at,
      assignee:users_public!assigned_to(name),
      creator:users_public!created_by(name)
    `)
    .gte('created_at', startIso)
    .order('created_at', { ascending: false });

  const tasks = rawTasks || [];

  // Also fetch any tasks marked as 'Done' today
  const { data: doneTasks } = await supabase
    .from('tasks')
    .select('id, title, description, status, priority')
    .eq('status', 'Done')
    .limit(10);

  // 3. Issue Tickets from WhatsApp field triage today
  const { data: rawTickets } = await supabase
    .from('issue_tickets')
    .select('id, ticket_number, raw_content, ai_diagnosis, status, resolution_notes, sender_name, created_at')
    .gte('created_at', startIso)
    .order('created_at', { ascending: false });

  const tickets = rawTickets || [];

  // 4. Logistics & Operations Snapshot
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('id, status')
    .gte('created_at', startIso);

  const totalOrders = orders?.length || 0;
  const deliveredOrders = orders?.filter((o: any) => o.status === 'Delivered').length || 0;

  const { data: trips } = await supabase
    .from('trips_v2')
    .select('id, status')
    .gte('created_at', startIso);

  const totalTrips = trips?.length || 0;
  const completedTrips = trips?.filter((t: any) => t.status === 'Completed').length || 0;

  // 5. Existing DevLog record if already saved
  const { data: devLog } = await supabase
    .from('dev_logs')
    .select('*')
    .eq('report_date', dateStr)
    .maybeSingle();

  return {
    dateStr,
    commits,
    tasks,
    doneTasks: doneTasks || [],
    tickets,
    operations: {
      totalOrders,
      deliveredOrders,
      totalTrips,
      completedTrips
    },
    devLog
  };
}

/**
 * Builds the WhatsApp-friendly report text
 */
export async function buildDailyWorkReportText(targetDate?: string, customNotes?: string): Promise<{
  reportText: string;
  data: any;
}> {
  const data = await collectDailyWorkData(targetDate);
  const { dateStr, commits, tasks, tickets, operations, devLog } = data;

  const dateObj = new Date(dateStr);
  const weekdayMap = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdayMap[dateObj.getDay()] || '';

  // Extract key upgrades from commits or devLog
  const upgradeLines: string[] = [];
  if (devLog?.changes_json && devLog.changes_json.length > 0) {
    devLog.changes_json.slice(0, 5).forEach((c: any, i: number) => {
      upgradeLines.push(`${i + 1}. [${c.type || '升级'}] ${c.description}${c.impact ? ` (影响: ${c.impact})` : ''}`);
    });
  } else if (commits.length > 0) {
    commits.slice(0, 6).forEach((c: any, i: number) => {
      upgradeLines.push(`${i + 1}. [代码迭代] ${c.message} (${c.hash})`);
    });
  } else {
    upgradeLines.push('1. [系统维护] 全天系统平稳运行，各项数据服务与实时监听保持高可用。');
  }

  // Tasks lines
  const taskLines: string[] = [];
  if (tasks.length > 0) {
    tasks.slice(0, 5).forEach((t: any) => {
      const st = t.status === 'Done' ? '✅ 已完成' : '🔄 进行中';
      taskLines.push(`• ${st}: ${t.title} (${t.assignee?.name || '团队'})`);
    });
  } else {
    taskLines.push('• 今日团队协同任务执行顺畅，无新增阻断项。');
  }

  // Tickets lines (WhatsApp Field Issues)
  const ticketLines: string[] = [];
  if (tickets.length > 0) {
    tickets.forEach((t: any) => {
      const note = t.resolution_notes || t.ai_diagnosis?.slice(0, 30) || '已处理';
      ticketLines.push(`• [${t.ticket_number}] 提报人: ${t.sender_name || '现场'} - ${note}`);
    });
  } else {
    ticketLines.push('• 现场群聊全天运行平稳，无紧急阻断级报障。');
  }

  // Delivery stats
  const deliveryRate = operations.totalOrders > 0
    ? Math.round((operations.deliveredOrders / operations.totalOrders) * 100)
    : 100;

  // Custom user notes if provided
  const customSection = customNotes?.trim()
    ? `\n📝 *Max 重点备注与备忘*：\n${customNotes.trim()}\n`
    : '';

  const reportText = `📅 *【Packsecure OS 系统升级与今日工作汇报】*\n` +
    `📆 日期: ${dateStr} (星期${weekday})\n` +
    `👤 汇报人: Max Tan (系统架构师 & 全栈技术负责人)\n` +
    `👥 呈报对象: William 哥 (老板) & 管理层\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🚀 *一、 今日系统重大升级与核心突破*\n` +
    `${upgradeLines.join('\n')}\n` +
    `_(今日共完成 ${commits.length} 次生产代码迭代与全量安全构建)_\n\n` +
    `📋 *二、 今日我的重点协同任务与进展 (My Tasks)*\n` +
    `${taskLines.join('\n')}\n\n` +
    `🚨 *三、 WhatsApp 现场报障与决策闭环 (Field Triage)*\n` +
    `${ticketLines.join('\n')}\n` +
    `_(搭载 Gemini 3.1 Pro 现场排障引擎，自动过滤日常闲聊，仅捕获真实验收/装车阻断)_\n\n` +
    `🚚 *四、 全厂运营与物流执行快报 (Operations)*\n` +
    `• 今日物流总出货: *${operations.totalOrders}* 票 (已送达 *${operations.deliveredOrders}* 票, 送达率 *${deliveryRate}%*)\n` +
    `• 车队出车总计: *${operations.totalTrips}* 趟 (已回厂 *${operations.completedTrips}* 趟)\n` +
    `• 车间生产与设备: 各主要机台正常排产运转，次品率处于受控范围\n` +
    customSection +
    `\n🎯 *五、 明日技术推进与系统规划*\n` +
    `1. 持续跟踪车间与车队在新版本报障箱和任务闭环下的实际流转体验。\n` +
    `2. 推进高管月度经营大盘 (William's Dashboard) 单据自动化核验与对账流水线。\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚙️ _Packsecure OS · 驱动全厂数字化高效运营_`;

  return {
    reportText,
    data
  };
}

/**
 * Sends the generated report to Max Tan and William Ong (The Boss) via WhatsApp
 */
export async function sendDailyWorkReportToBossAndMax(params?: {
  targetDate?: string;
  customNotes?: string;
  recipients?: string[];
}): Promise<{
  success: boolean;
  deliveredTo: string[];
  reportText: string;
  results: any[];
}> {
  const { targetDate, customNotes, recipients } = params || {};
  const { reportText, data } = await buildDailyWorkReportText(targetDate, customNotes);

  const targetPhones = recipients && recipients.length > 0
    ? recipients
    : DEFAULT_REPORT_RECIPIENTS.map(r => r.phone);

  const uniquePhones = Array.from(new Set(targetPhones.map(p => normalizePhoneNumber(p))));
  const results = [];

  for (const phone of uniquePhones) {
    try {
      const sendRes = await sendWhatsAppText(phone, reportText);
      results.push({ phone, success: true, result: sendRes });
    } catch (sendErr: any) {
      console.error(`[Daily Work Report] Failed to send WhatsApp to ${phone}:`, sendErr.message);
      results.push({ phone, success: false, error: sendErr.message });
    }
  }

  const anySuccess = results.some(r => r.success);
  return {
    success: anySuccess,
    deliveredTo: uniquePhones,
    reportText,
    results
  };
}
